import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { generatePdfReport } from '@/lib/pdf-report';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    // Require authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    const data = await req.json();
    const pdfBytes = await generatePdfReport(data);

    const companyName = data.companyName ?? 'keishin';
    const safeFileName = companyName.replace(/[^a-zA-Z0-9\u3040-\u9FFF]/g, '_');
    const fileName = `${safeFileName}_report.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    logger.error('PDF export failed:', error);
    return NextResponse.json(
      { error: 'PDF生成に失敗しました' },
      { status: 500 }
    );
  }
}
