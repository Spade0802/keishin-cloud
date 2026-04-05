import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { generatePScoreExcel } from '@/lib/excel-export';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await req.json();
    const wb = generatePScoreExcel(data);
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const companyName = data.companyName ?? 'keishin';
    const safeFileName = companyName.replace(/[^a-zA-Z0-9\u3040-\u9FFF]/g, '_');
    const fileName = `${safeFileName}_result.xlsx`;

    return new NextResponse(buf, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    logger.error('Excel export failed:', error);
    return NextResponse.json(
      { error: 'Excel生成に失敗しました' },
      { status: 500 }
    );
  }
}
