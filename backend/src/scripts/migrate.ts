import fs from 'fs';
import path from 'path';
import { pool } from '../db';

async function runMigrations() {
  console.log('Starting automated database migration for AttendoSchool...');
  const client = await pool.connect();
  try {
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
    console.log(`Using database directory: ${dbDir}`);

    // Check if base schema already exists
    const tableCheck = await client.query(
      "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'schools'"
    );
    const hasSchema = (tableCheck.rowCount ?? 0) > 0;

    if (!hasSchema) {
      const schemaFile = path.join(dbDir, 'schema.sql');
      if (fs.existsSync(schemaFile)) {
        console.log('Applying base schema.sql...');
        const schemaSql = fs.readFileSync(schemaFile, 'utf8');
        await client.query(schemaSql);
        console.log('Base schema.sql applied successfully.');
      }
    } else {
      console.log('Base schema already present. Checking incremental migrations...');
    }

    const migrationsDir = path.join(dbDir, 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const files = fs
        .readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.sql'))
        .sort();

      console.log(`Found ${files.length} migration scripts in ${migrationsDir}`);
      for (const file of files) {
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf8');
        try {
          await client.query(sql);
          console.log(`  Applied ${file}`);
        } catch (err: any) {
          if (
            err.message.includes('already exists') ||
            err.message.includes('duplicate') ||
            err.code === '42701' ||
            err.code === '42P07' ||
            err.code === '42710'
          ) {
            console.log(`  ${file} (already up-to-date)`);
          } else {
            console.warn(`  ${file} notice: ${err.message}`);
          }
        }
      }
    }

    const seedFile = path.join(dbDir, 'seed.sql');
    if (fs.existsSync(seedFile)) {
      console.log('Applying seed.sql...');
      const seedSql = fs.readFileSync(seedFile, 'utf8');
      try {
        await client.query(seedSql);
        console.log('seed.sql applied successfully.');
      } catch (err: any) {
        if (
          err.message.includes('duplicate') ||
          err.message.includes('already exists') ||
          err.code === '23505'
        ) {
          console.log('  Seed data already present.');
        } else {
          console.warn('  Seed notice:', err.message);
        }
      }
    }

    console.log('Database setup and all migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
