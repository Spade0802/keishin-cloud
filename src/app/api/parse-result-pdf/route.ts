/**
 * 経審結果通知書PDFパーサー API
 *
 * 総合評定値通知書PDFをDocument AI/OCRで読み取り、
 * Y, X2, X21, X22, W, 業種別X1, Z, P を抽出する。
 */

import { NextRequest, NextResponse } from 'next/server';
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';

const PROJECT_ID = process.env.GCP_PROJECT_ID || 'jww-dxf-converter';
const LOCATION = process.env.DOCAI_LOCATION || 'us';
const PROCESSOR_ID = process.env.DOCAI_PROCESSOR_ID || '660ca751a3b05c46';

interface ExtractedScores {
  label: string;
  Y: string;
  X2: string;
  X21: string;
  X22: string;
  W: string;
  industries: Array<{ name: string; X1: string; Z: string; P: string }>;
}

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

function extractScoresFromText(text: string): ExtractedScores {
  const result: ExtractedScores = {
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
  // パターン: 業種名 ... X1値 ... Z値 ... P値
  const lines = text.split('\n');
  for (const line of lines) {
    // 業種行パターン: 業種コードor名前 + 数値群
    const indMatch = line.match(
      /(?:([一-龥ぁ-んァ-ヴ]{1,6})\s+.*?)?(\d{3,5})\s+.*?(\d{3,5})\s+.*?(\d{3,5})\s*$/
    );
    if (indMatch) {
      const [, name, v1, v2, v3] = indMatch;
      // P点は通常3-4桁、X1とZも3-4桁
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

  // 結果通知書の標準テーブル形式を追加パース
  // "業種 | X1 | X2 | Y | Z | W | P" の行パターン
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
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'ファイルが選択されていません' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let fullText = '';

    // Document AI で OCR
    try {
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
      console.warn('Document AI failed, falling back to empty text:', docaiErr);
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
    });
  } catch (error) {
    console.error('Result PDF parse failed:', error);
    return NextResponse.json(
      { error: '結果通知書の解析に失敗しました' },
      { status: 500 }
    );
  }
}
