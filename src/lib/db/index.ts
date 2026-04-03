import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

function createPool() {
  const databaseUrl = process.env.DATABASE_URL || '';

  // Cloud SQL Proxy uses Unix socket via ?host=/cloudsql/...
  // Format: postgresql://user:pass@/dbname?host=/cloudsql/instance
  // new URL() cannot parse this (no hostname), so we extract manually
  if (databaseUrl.includes('/cloudsql/')) {
    const match = databaseUrl.match(
      /^postgresql:\/\/([^:]+):([^@]+)@\/([^?]+)\?host=(.+)$/
    );
    if (match) {
      return new Pool({
        user: match[1],
        password: decodeURIComponent(match[2]),
        database: match[3],
        host: match[4],
      });
    }
  }

  return new Pool({ connectionString: databaseUrl });
}

const pool = createPool();

export const db = drizzle(pool, { schema });
