import { pool } from '../db';

async function testTimetable() {
  try {
    const q1 = await pool.query(`
      SELECT e.id, e.start_time 
      FROM timetable_entries e
      LIMIT 1
    `);
    console.log('e.start_time query succeeded:', q1.rows);
  } catch (err: any) {
    console.log('e.start_time query failed as predicted:', err.message);
  }

  try {
    const q2 = await pool.query(`
      SELECT e.id, e.class_id, e.section_id, e.subject_id, e.teacher_id,
             p.start_time, p.end_time, e.day_of_week, e.room_name AS room,
             c.class_number, s.name AS section_name, sub.name AS subject_name,
             p.name AS period_name, p.period_number
      FROM timetable_entries e
      LEFT JOIN timetable_periods p ON p.id = e.period_id
      LEFT JOIN classes c ON c.id = e.class_id
      LEFT JOIN sections s ON s.id = e.section_id
      LEFT JOIN subjects sub ON sub.id = e.subject_id
      LIMIT 1
    `);
    console.log('Correct JOIN query succeeded:', q2.rows);
  } catch (err: any) {
    console.log('Correct JOIN query failed:', err.message);
  }

  await pool.end();
}

testTimetable().catch(console.error);
