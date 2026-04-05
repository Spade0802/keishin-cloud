/**
 * 経審結果通知書PDFパーサー API
 *
 * 総合評定値通知書PDFからY, X2, X21, X22, W, 業種別X1, Z, P を抽出する。
 *
 * 抽出方式:
 * 1. Gemini Vision AI（プライマリ） — 高精度
 * 2. Document AI + regex フォールバック
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractResultPdfWithGemini, type ResultPdfScores } from '@/lib/gemini-extractor';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';

// Document AI設定（フォールバック用）
const PROJECT_ID = process.env.GCP_PROJECT_ID || 'jww-dxf-converter';
const LOCATION = process.env.DOCAI_LOCATION || 'us';
const PROCESSOR_ID = process.env.DOCAI_PROCESSOR_ID || '660ca751a3b05c46';

// 業種名マッピング（短縮表記→正式名）
const INDUSTRY_NAMES: Record<string, string> = {
  '土': '土木', '建': '建築', '大': '大工', '左': '左官', 'と': 'とび',
  '石': '石', '屋': '屋根', '電': '電気', '管': '管', 'タ': 'タイル',
  '鋼': '鋼構造物', '筋': '鉄筋', '舗': '舗装', 'し': 'しゅんせつ',
  '板': '板金', 'ガ': 'ガラス', '塗': '塗装', '防': '防水',
  '内': '内装', '機': '機械器具', '絶': '熱絶縁', '通': '電気通信',
  '園': '造園', 'さ': 'さく井', '建具': '建具', '水': '水道施設',
  '消': '消防施設', '清': '清掃施設', '解': '解体',
};

function extractScoresFromText(text: string): ResultPdfScores {
  const result: ResultPdfScores = {
    label: '',
    Y: '', X2: '', X21: '', X22: '', W: '',
    industries: [],
  };

  // 期ラベル抽出（例: "第58期", "令和6年3月期"）
  const periodMatch = text.match(/第\s*(\d+)\s*期/);
  if (periodMatch) {
    result.label = `第${periodMatch[1]}期`;
  }

  // Y点（経営状況分析）
  const yMatch = text.match(/(?:Y|経営状況)[^\d]*?(\d{3,4})/);
  if (yMatch) result.Y = yMatch[1];

  // X2（自己資本額及び利益額）
  const x2Match = text.match(/X\s*2[^\d]*?(\d{3,4})/);
  if (x2Match) result.X2 = x2Match[1];

  // X21
  const x21Match = text.match(/X\s*2\s*1[^\d]*?(\d{3,4})/);
  if (x21Match) result.X21 = x21Match[1];

  // X22
  const x22Match = text.match(/X\s*2\s*2[^\d]*?(\d{3,4})/);
  if (x22Match) result.X22 = x22Match[1];

  // W点（社会性等）
  const wMatch = text.match(/(?:W|社会性)[^\d]*?(\d{3,4})/);
  if (wMatch) result.W = wMatch[1];

  // 業種別スコア（結果通知書のテーブル行パターン）
  const lines = text.split('\n');
  for (const line of lines) {
    const indMatch = line.match(
      /(?:([一-龥ぁ-んァ-ヴ]{1,6})\s+.*?)?(\d{3,5})\s+.*?(\d{3,5})\s+.*?(\d{3,5})\s*$/
    );
    if (indMatch) {
      const [, name, v1, v2, v3] = indMatch;
      if (name && parseInt(v3) >= 100 && parseInt(v3) <= 2000) {
        const resolvedName = INDUSTRY_NAMES[name] || name;
        result.industries.push({
          name: resolvedName,
          X1: v1,
          Z: v2,
          P: v3,
        });
      }
    }
  }

  // 標準テーブル形式の追加パース
  const tablePattern = /([一-龥ぁ-んァ-ヴー]{1,8})\s+(\d{3,5})\s+(\d{3,4})\s+(\d{3,4})\s+(\d{3,5})\s+(\d{3,4})\s+(\d{3,4})/g;
  let tableMatch;
  while ((tableMatch = tablePattern.exec(text)) !== null) {
    const [, name, x1, , , z, , p] = tableMatch;
    const existing = result.industries.find(i => i.name === name);
    if (!existing) {
      result.industries.push({
        name: INDUSTRY_NAMES[name] || name,
        X1: x1,
        Z: z,
        P: p,
      });
    }
  }

  return result;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'ファイルが選択されていません' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // 1) Gemini Vision AIで高精度抽出を試行
    try {
      const geminiResult = await extractResultPdfWithGemini(buffer);
      if (geminiResult) {
        return NextResponse.json({
          scores: geminiResult.scores,
          method: geminiResult.method,
        });
      }
    } catch (geminiErr) {
      logger.warn('Gemini result PDF extraction failed, falling back to Document AI:', geminiErr);
    }

    // 2) フォールバック: Document AI + regex
    let fullText = '';
    try {
      const { DocumentProcessorServiceClient } = await import('@google-cloud/documentai');
      const client = new DocumentProcessorServiceClient();
      const processorName = `projects/${PROJECT_ID}/locations/${LOCATION}/processors/${PROCESSOR_ID}`;
      const [result] = await client.processDocument({
        name: processorName,
        rawDocument: {
          content: buffer.toString('base64'),
          mimeType: file.type || 'application/pdf',
        },
      });
      fullText = result.document?.text || '';
    } catch (docaiErr) {
      logger.warn('Document AI failed:', docaiErr);
    }

    if (!fullText) {
      return NextResponse.json(
        { error: 'PDFからテキストを抽出できませんでした。スキャン品質を確認してください。' },
        { status: 422 }
      );
    }

    const scores = extractScoresFromText(fullText);

    return NextResponse.json({
      scores,
      textLength: fullText.length,
      method: 'Document AI',
    });
  } catch (error) {
    logger.error('Result PDF parse failed:', error);
    return NextResponse.json(
      { error: '結果通知書の解析に失敗しました' },
      { status: 500 }
    );
  }
}
