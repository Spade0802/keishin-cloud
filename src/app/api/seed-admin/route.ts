import { NextRequest, NextResponse } from 'next/server';
import { seedAdmin } from '@/lib/seed-admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const expectedSecret = process.env.ADMIN_SEED_SECRET;
    if (!expectedSecret || body.secret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await seedAdmin();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('seed-admin error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
