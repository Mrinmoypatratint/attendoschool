import { Pool } from 'pg';
import { env } from './config/env';

/**
 * Supabase Connection Normalizer:
 * Supabase pooler port 5432 is Session Mode (hard-capped to 15 clients -> throws EMAXCONNSESSION).
 * Port 6543 is Transaction Mode (multiplexed via PgBouncer -> handles thousands of clients).
 * This function guarantees port 6543 is always used for pooler connections, even if port was omitted.
 */
export function normalizeSupabaseUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  let url = rawUrl.trim();

  // If using direct Supabase DB domain, route through transaction pooler gateway
  if (url.includes('db.widbnephnmbufxaggflw.supabase.co')) {
    url = url.replace('db.widbnephnmbufxaggflw.supabase.co', 'aws-0-ap-northeast-2.pooler.supabase.com');
  }

  // Force pooler.supabase.com to Transaction Mode port 6543
  if (url.includes('pooler.supabase.com')) {
    url = url.replace(/pooler\.supabase\.com(:5432)?(?=[\/\?]|$)/g, 'pooler.supabase.com:6543');
  }

  return url;
}

const rawPgConnectionString = env.supabaseDatabaseUrl || env.databaseUrl || '';
const pgConnectionString = normalizeSupabaseUrl(rawPgConnectionString);
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
      release: () => { }
    };
  }
  async end(): Promise<void> { }
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
    min: 2,
    max: Math.min(Number(process.env.PG_POOL_MAX || 10), 15),
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 15000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    statement_timeout: 15000,
    allowExitOnIdle: false,
  })
  : new DisabledPool() as unknown as Pool);

// Proactively warm up database connections immediately at process boot
if (isPostgresConfigured) {
  pool.query('SELECT 1').catch(() => {});
}

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



