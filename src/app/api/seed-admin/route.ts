import { NextRequest, NextResponse } from 'next/server';
import { seedAdmin } from '@/lib/seed-admin';
import { ERR_UNAUTHORIZED, ERR_ADMIN_INTERNAL } from '@/lib/error-messages';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const expectedSecret = process.env.ADMIN_SEED_SECRET;
    if (!expectedSecret || body.secret !== expectedSecret) {
      return NextResponse.json({ error: ERR_UNAUTHORIZED }, { status: 401 });
    }

    const result = await seedAdmin();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('seed-admin error:', error);
    return NextResponse.json(
      { error: ERR_ADMIN_INTERNAL },
      { status: 500 }
    );
  }
}
