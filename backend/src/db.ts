import { Pool } from 'pg';
import { env } from './config/env';

const isCloudDb =
  env.databaseUrl.includes('sslmode=require') ||
  env.databaseUrl.includes('ssl=true') ||
  env.databaseUrl.includes('neon.tech') ||
  env.databaseUrl.includes('render.com') ||
  env.databaseUrl.includes('railway.app') ||
  env.databaseUrl.includes('supabase.co') ||
  (process.env.NODE_ENV === 'production' &&
    !env.databaseUrl.includes('localhost') &&
    !env.databaseUrl.includes('127.0.0.1'));

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: isCloudDb ? { rejectUnauthorized: false } : undefined,
});
