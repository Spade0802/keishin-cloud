import { NextRequest, NextResponse } from 'next/server';
import { parseKeishinPDF } from '@/lib/keishin-pdf-parser';
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
      return NextResponse.json({ error: 'ファイルが指定されていません。' }, { status: 400 });
    }

    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'ファイルサイズが50MBを超えています。' }, { status: 400 });
    }

    if (!file.name.match(/\.pdf$/i)) {
      return NextResponse.json({ error: 'PDFファイル（.pdf）のみ対応しています。' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const result = await parseKeishinPDF(buffer);

    return NextResponse.json(result);
  } catch (e) {
    console.error('Keishin PDF parse error:', e);
    return NextResponse.json({ error: '提出書PDFの解析に失敗しました。' }, { status: 500 });
  }
}
