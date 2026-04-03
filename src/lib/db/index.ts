import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

function createPool() {
  const databaseUrl = process.env.DATABASE_URL || '';

  // Cloud SQL Proxy uses Unix socket via ?host=/cloudsql/...
  // pg module needs the host in the connection config, not as a URL param
  if (databaseUrl.includes('/cloudsql/')) {
    const url = new URL(databaseUrl);
    const socketPath = url.searchParams.get('host');
    return new Pool({
      user: url.username,
      password: decodeURIComponent(url.password),
      database: url.pathname.slice(1),
      host: socketPath || undefined,
    });
  }

  return new Pool({ connectionString: databaseUrl });
}

const pool = createPool();

export const db = drizzle(pool, { schema });
