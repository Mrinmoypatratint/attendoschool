import fs from 'fs';
import path from 'path';
import { PoolClient } from 'pg';
import { pool, isPostgresConfigured } from '../db';

async function runSeed() {
  console.log('Starting standalone database seed for AttendoSchool...');

  if (!isPostgresConfigured) {
    console.error('ERROR: PostgreSQL / Supabase connection is not configured or uses placeholder credentials.');
    console.error('Please configure SUPABASE_DATABASE_URL or DATABASE_URL before running seed.');
    process.exit(1);
  }

  let client: PoolClient | null = null;
  try {
    client = await pool.connect();

    const candidates = [
      path.resolve(__dirname, '../../../database'),
      path.resolve(__dirname, '../../database'),
      path.resolve(process.cwd(), '../database'),
      path.resolve(process.cwd(), 'database'),
    ];
    const dbDir = candidates.find((dir) => fs.existsSync(dir));
    if (!dbDir) {
      throw new Error(`Database directory not found in candidate paths: ${candidates.join(', ')}`);
    }
    const seedFile = path.join(dbDir, 'seed.sql');
    if (!fs.existsSync(seedFile)) {
      throw new Error(`seed.sql not found at ${seedFile}`);
    }

    console.log(`Applying seed from: ${seedFile}`);
    const seedSql = fs.readFileSync(seedFile, 'utf8');

    await client.query('BEGIN');
    await client.query(seedSql);
    await client.query('COMMIT');

    console.log('Seed data applied successfully.');
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore rollback error
      }
    }
    console.error('Seed execution failed:', error);
    process.exitCode = 1;
    throw error;
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

runSeed().catch(() => {
  process.exit(1);
});
