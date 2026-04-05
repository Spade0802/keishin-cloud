import { NextRequest, NextResponse } from 'next/server';
import { seedAdmin } from '@/lib/seed-admin';
import { ERR_UNAUTHORIZED, ERR_ADMIN_INTERNAL } from '@/lib/error-messages';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  // Block in production unless explicitly allowed for initial setup
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEED_ADMIN !== 'true') {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const body = await req.json();

    const expectedSecret = process.env.ADMIN_SEED_SECRET;
    if (!expectedSecret || body.secret !== expectedSecret) {
      return NextResponse.json({ error: ERR_UNAUTHORIZED }, { status: 401 });
    }

    const result = await seedAdmin();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    logger.error('seed-admin error:', error);
    return NextResponse.json(
      { error: ERR_ADMIN_INTERNAL },
      { status: 500 }
    );
  }
}
