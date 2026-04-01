import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { generatePScoreExcel } from '@/lib/excel-export';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const wb = generatePScoreExcel(data);
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buf, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="keishin_result.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Excel export failed:', error);
    return NextResponse.json(
      { error: 'Excel生成に失敗しました' },
      { status: 500 }
    );
  }
}
