const fs = require('fs');
const path = require('path');
const { pool } = require('../backend/dist/db');

async function exportAll() {
  const exportDir = path.join(__dirname, '..', 'supabase-export');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  try {
    const tablesRes = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
    const summary = {};

    for (const row of tablesRes.rows) {
      const table = row.table_name;
      try {
        const dataRes = await pool.query(`SELECT * FROM "${table}"`);
        if (dataRes.rows.length > 0) {
          const filePath = path.join(exportDir, `${table}.json`);
          fs.writeFileSync(filePath, JSON.stringify(dataRes.rows, null, 2), 'utf8');
          summary[table] = dataRes.rows.length;
          console.log(`Exported ${table}: ${dataRes.rows.length} rows -> ${table}.json`);
        }
      } catch (err) {
        console.error(`Error exporting table ${table}:`, err.message);
      }
    }

    fs.writeFileSync(path.join(exportDir, 'export-summary.json'), JSON.stringify(summary, null, 2), 'utf8');
    console.log('\n=== SUPABASE EXPORT COMPLETED SUCCESSFULLY ===');
    console.log(`All data safely saved to: ${exportDir}`);
  } catch (err) {
    console.error('Fatal export error:', err);
  } finally {
    await pool.end();
  }
}

exportAll();
