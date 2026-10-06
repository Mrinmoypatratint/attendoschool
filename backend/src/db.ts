import { Pool } from 'pg';
import { env } from './config/env';

const pgConnectionString = env.supabaseDatabaseUrl || env.databaseUrl;
const isPlaceholder = !pgConnectionString || 
  pgConnectionString.includes('[YOUR-PASSWORD]') || 
  pgConnectionString.includes('[YOUR-PROJECT-REF]') ||
  pgConnectionString.includes('postgres:postgres@127.0.0.1');

export const isPostgresConfigured = Boolean(pgConnectionString) && !isPlaceholder;


class DisabledPool {
  async query(_text?: any, _params?: any): Promise<{ rows: any[]; rowCount: number }> {
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

const requiresSsl = pgConnectionString.includes('supabase.co') ||
  pgConnectionString.includes('neon.tech') ||
  pgConnectionString.includes('sslmode=require') ||
  pgConnectionString.includes('ssl=true') ||
  (process.env.NODE_ENV === 'production' && !pgConnectionString.includes('127.0.0.1') && !pgConnectionString.includes('localhost'));

export const pool: Pool = (isPostgresConfigured
  ? new Pool({
      connectionString: pgConnectionString,
      ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
      max: Math.min(Number(process.env.PG_POOL_MAX || 10), 12),
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 5000,
      allowExitOnIdle: false,
    })
  : new DisabledPool() as unknown as Pool);

// Prevent pool from crashing the process on transient connection errors
if (isPostgresConfigured) {
  pool.on('error', (err) => {
    console.error('[Database] Unexpected pool error (connection will be recycled):', err.message);
  });
}

if (isPostgresConfigured) {
  const isSupabase = pgConnectionString.includes('supabase.co');
  console.log(`[Database] ${isSupabase ? 'Supabase' : 'PostgreSQL'} connection pool configured${requiresSsl ? ' with SSL' : ''}.`);
} else {
  console.log('[Database] Pure Cloud Firestore mode active. Secondary PostgreSQL connections disabled.');
}

/**
 * Health check helper for PostgreSQL / Supabase
 */
export async function checkPostgresHealth(): Promise<{ ok: boolean; message: string; latency?: number }> {
  if (!isPostgresConfigured) {
    return { ok: false, message: 'PostgreSQL / Supabase connection URL not configured.' };
  }
  const start = Date.now();
  try {
    await pool.query('SELECT NOW() as current_time');
    const latency = Date.now() - start;
    return { ok: true, message: `Connected to PostgreSQL successfully (${latency}ms).`, latency };
  } catch (err: any) {
    return { ok: false, message: `PostgreSQL connection error: ${err.message}` };
  }
}

