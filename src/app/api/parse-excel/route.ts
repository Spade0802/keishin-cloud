import { NextRequest, NextResponse } from 'next/server';
import { parseExcel } from '@/lib/excel-parser';
import { extractFinancialDataFromExcel } from '@/lib/gemini-extractor';
import { auth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'ファイルが指定されていません。' },
        { status: 400 }
      );
    }

    // 50MB上限
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'ファイルサイズが50MBを超えています。' },
        { status: 400 }
      );
    }

    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.xlsx?$/i)) {
      return NextResponse.json(
        { error: 'Excelファイル（.xlsx/.xls）のみ対応しています。' },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();

    // 1) Gemini AIで高精度抽出を試行
    const geminiResult = await extractFinancialDataFromExcel(buffer);

    if (geminiResult) {
      // Gemini成功 → AI抽出結果を返す
      return NextResponse.json({
        data: geminiResult.data,
        warnings: geminiResult.warnings,
        mappings: [],
        method: geminiResult.method,
      });
    }

    // 2) フォールバック: 従来のキーワードマッチ
    const fallbackResult = parseExcel(buffer);

    return NextResponse.json({
      ...fallbackResult,
      method: 'keyword-match',
    });
  } catch (e) {
    console.error('Excel parse error:', e);
    return NextResponse.json(
      { error: 'ファイルの解析に失敗しました。' },
      { status: 500 }
    );
  }
}
