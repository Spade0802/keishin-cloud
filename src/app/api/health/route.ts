/**
 * Health check endpoint
 *
 * No auth required - intended for load balancer health checks.
 * Returns 200 with status, timestamp, and version.
 * Optionally checks DB connectivity.
 */
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  const version = process.env.npm_package_version ?? '0.1.0';

  let dbStatus: 'ok' | 'error' = 'ok';
  try {
    await db.execute(sql`SELECT 1`);
  } catch {
    dbStatus = 'error';
  }

  const status = dbStatus === 'ok' ? 'ok' : 'degraded';
  const statusCode = dbStatus === 'ok' ? 200 : 503;

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      version,
      db: dbStatus,
    },
    { status: statusCode },
  );
}
