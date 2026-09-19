import { Pool } from 'pg';
import { env } from './config/env';

const usePostgres = process.env.USE_POSTGRES === 'true' && Boolean(env.databaseUrl);

class DisabledPool {
  async query(_text?: any, _params?: any): Promise<{ rows: any[]; rowCount: number }> {
    // Pure Cloud Firestore mode: return empty results immediately without opening sockets
    return { rows: [], rowCount: 0 };
  }
  async connect(): Promise<{ query: (_t?: any, _p?: any) => Promise<{ rows: any[]; rowCount: number }>; release: () => void }> {
    return {
      query: async () => ({ rows: [], rowCount: 0 }),
      release: () => {}
    };
  }
  async end(): Promise<void> {}
  on(_event: string, _listener: (...args: any[]) => void): this { return this; }
}

export const pool: Pool = (usePostgres
  ? new Pool({
      connectionString: env.databaseUrl,
      ssl: env.databaseUrl.includes('sslmode=require') || env.databaseUrl.includes('ssl=true')
        ? { rejectUnauthorized: false }
        : undefined,
    })
  : new DisabledPool() as unknown as Pool);

if (!usePostgres) {
  console.log('[Database] Pure Cloud Firestore mode active. PostgreSQL connections disabled.');
}
