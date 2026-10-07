import fs from 'fs';
import path from 'path';
import { pool, isPostgresConfigured } from '../db';

async function backupPostgresql() {
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('          CREATING COMPREHENSIVE POSTGRESQL BACKUP               ');
  console.log('═════════════════════════════════════════════════════════════════\n');

  if (!isPostgresConfigured) {
    console.error('❌ PostgreSQL / Supabase is not configured!');
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    const backupDir = path.resolve(__dirname, '../../../backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilePath = path.join(backupDir, `supabase_backup_${timestamp}.json`);

    console.log(`[Backup] Fetching list of all public tables...`);
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const backupData: {
      timestamp: string;
      totalTables: number;
      totalRows: number;
      tables: Record<string, any[]>;
    } = {
      timestamp: new Date().toISOString(),
      totalTables: tablesRes.rows.length,
      totalRows: 0,
      tables: {}
    };

    let totalRowsCount = 0;
    for (const r of tablesRes.rows) {
      const tbl = r.table_name;
      try {
        const dataRes = await client.query(`SELECT * FROM "${tbl}"`);
        if (dataRes.rows.length > 0) {
          backupData.tables[tbl] = dataRes.rows;
          totalRowsCount += dataRes.rows.length;
          console.log(`   ✓ Backed up "${tbl}": ${dataRes.rows.length} rows`);
        }
      } catch (err: any) {
        console.warn(`   ⚠️ Warning reading table "${tbl}": ${err.message}`);
      }
    }

    backupData.totalRows = totalRowsCount;
    fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), 'utf8');

    const fileStat = fs.statSync(backupFilePath);
    const sizeMb = (fileStat.size / (1024 * 1024)).toFixed(2);

    console.log('\n═════════════════════════════════════════════════════════════════');
    console.log('   BACKUP COMPLETED SUCCESSFULLY');
    console.log('═════════════════════════════════════════════════════════════════');
    console.log(`• Destination: ${backupFilePath}`);
    console.log(`• File Size:   ${sizeMb} MB`);
    console.log(`• Tables:      ${Object.keys(backupData.tables).length} with data`);
    console.log(`• Total Rows:  ${totalRowsCount} rows captured`);
    console.log('═════════════════════════════════════════════════════════════════\n');

  } catch (err: any) {
    console.error('❌ Error during backup creation:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

backupPostgresql().catch(console.error);
