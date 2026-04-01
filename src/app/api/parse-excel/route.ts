import { NextRequest, NextResponse } from 'next/server';
import { parseExcel } from '@/lib/excel-parser';

export async function POST(req: NextRequest) {
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
    const result = parseExcel(buffer);

    return NextResponse.json(result);
  } catch (e) {
    console.error('Excel parse error:', e);
    return NextResponse.json(
      { error: 'ファイルの解析に失敗しました。' },
      { status: 500 }
    );
  }
}
