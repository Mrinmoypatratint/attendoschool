import { pool } from '../db';

async function main() {
  try {
    console.log('Creating school_working_days...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS school_working_days (
        school_id UUID PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
        working_days SMALLINT[] DEFAULT ARRAY[1,2,3,4,5,6],
        weekend_days SMALLINT[] DEFAULT ARRAY[0],
        saturday_rule VARCHAR(20) DEFAULT 'WORKING',
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('✓ school_working_days created or exists.');

    console.log('Creating school_holidays...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS school_holidays (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        holiday_date DATE NOT NULL,
        holiday_type VARCHAR(50) DEFAULT 'GAZETTED',
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_school_holiday_date UNIQUE (school_id, holiday_date)
      )
    `);
    console.log('✓ school_holidays created or exists.');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_school_holidays_date ON school_holidays(school_id, holiday_date)
    `);
    console.log('✓ idx_school_holidays_date created or exists.');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_school_holidays_active ON school_holidays(school_id, is_active)
    `);
    console.log('✓ idx_school_holidays_active created or exists.');

    // Seed default holidays for Greenwood International School
    const schoolRes = await pool.query(`SELECT id, name FROM schools`);
    console.log(`Found ${schoolRes.rowCount} schools in database.`);

    for (const school of schoolRes.rows) {
      const defaultHolidays = [
        { name: 'Republic Day', date: '2026-01-26', type: 'NATIONAL' },
        { name: 'Holi', date: '2026-03-04', type: 'FESTIVAL' },
        { name: 'Good Friday', date: '2026-04-03', type: 'GAZETTED' },
        { name: 'Independence Day', date: '2026-08-15', type: 'NATIONAL' }, // Saturday!
        { name: 'Gandhi Jayanti', date: '2026-10-02', type: 'NATIONAL' },
        { name: 'Durga Puja / Dussehra', date: '2026-10-20', type: 'FESTIVAL' },
        { name: 'Diwali', date: '2026-11-08', type: 'FESTIVAL' }, // Sunday! (Great for testing weekend + holiday overlap!)
        { name: 'Guru Nanak Jayanti', date: '2026-11-24', type: 'GAZETTED' },
        { name: 'Christmas Day', date: '2026-12-25', type: 'GAZETTED' }
      ];

      for (const h of defaultHolidays) {
        await pool.query(`
          INSERT INTO school_holidays (school_id, name, holiday_date, holiday_type, is_active)
          VALUES ($1, $2, $3::date, $4, TRUE)
          ON CONFLICT (school_id, holiday_date) DO NOTHING
        `, [school.id, h.name, h.date, h.type]);
      }

      await pool.query(`
        INSERT INTO school_working_days (school_id, working_days, weekend_days, saturday_rule)
        VALUES ($1, ARRAY[1,2,3,4,5,6], ARRAY[0], 'WORKING')
        ON CONFLICT (school_id) DO NOTHING
      `, [school.id]);
    }

    console.log('✓ Default holidays and working calendar seeded successfully.');
  } catch (err: any) {
    console.error('Migration error:', err.message);
  } finally {
    await pool.end();
  }
}

main();
