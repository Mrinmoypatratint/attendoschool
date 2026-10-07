import * as XLSX from 'xlsx';
import { pool, isPostgresConfigured } from '../db';
import { isFirebaseConfigured, collections } from '../firebase';
import { memAttendanceSessions, memAttendanceRecords } from './teacher';
import { demoStudents } from './schoolData';
import { Router, Request, Response } from 'express';
import {
  attendanceSummary,
  studentAttendanceReport,
  dailyAttendanceReport
} from '../services/attendanceReportService';
import { isTestSchool } from './auth';
import { fastCache } from '../utils/cache';

const router = Router();

function schoolId(req: Request) {
  const qId = (req as any).query?.schoolId;
  if (qId === 'all') return 'all';
  if (qId) return qId;
  const user = (req as any).user;
  if (user?.role === 'SUPER_ADMIN') {
    return 'all';
  }
  return user?.schoolId || null;
}

function validDate(v: any) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const sid = schoolId(req);
    const today = new Date().toISOString().slice(0, 10);
    const startOfMonth = today.slice(0, 8) + '01';
    const from = String(req.query.from || startOfMonth);
    const to = String(req.query.to || today);
    if (!sid) {
      return res.json({ present: 0, absent: 0, left_early: 0, leftEarly: 0, marked: 0, percentage: 0 });
    }
    const cacheKey = `reports:summary:${sid}:${from}:${to}`;
    const cached = fastCache.get<any>(cacheKey);
    if (cached) return res.json(cached);

    const data = await attendanceSummary(sid, from, to);
    fastCache.set(cacheKey, data, 30);
    res.json(data);
  } catch (_e: any) {
    res.json({ present: 0, absent: 0, left_early: 0, leftEarly: 0, marked: 0, percentage: 0 });
  }
});

router.get('/summary', async (req: Request, res: Response) => {
  try {
    const sid = schoolId(req);
    const today = new Date().toISOString().slice(0, 10);
    const startOfMonth = today.slice(0, 8) + '01';
    const from = String(req.query.from || startOfMonth);
    const to = String(req.query.to || today);
    if (!sid || !validDate(from) || !validDate(to)) {
      return res.status(400).json({ message: 'from and to are required as YYYY-MM-DD' });
    }
    const cacheKey = `reports:summary:${sid}:${from}:${to}`;
    const cached = fastCache.get<any>(cacheKey);
    if (cached) return res.json(cached);

    const data = await attendanceSummary(sid, from, to);
    fastCache.set(cacheKey, data, 30);
    res.json(data);
  } catch (_e: any) {
    res.json({ present: 0, absent: 0, left_early: 0, leftEarly: 0, marked: 0, percentage: 0 });
  }
});

router.get('/students', async (req: Request, res: Response) => {
  try {
    const sid = schoolId(req);
    const from = String(req.query.from || '');
    const to = String(req.query.to || '');
    const studentId = req.query.studentId ? String(req.query.studentId) : undefined;
    if (!sid || !validDate(from) || !validDate(to)) {
      return res.status(400).json({ message: 'from and to are required as YYYY-MM-DD' });
    }
    const cacheKey = `reports:students:${sid}:${from}:${to}:${studentId || ''}`;
    const cached = fastCache.get<any>(cacheKey);
    if (cached) return res.json(cached);

    const data = await studentAttendanceReport(sid, from, to, studentId);
    fastCache.set(cacheKey, data, 30);
    res.json(data);
  } catch (_e: any) {
    res.json([]);
  }
});

router.get('/daily', async (req: Request, res: Response) => {
  try {
    const sid = schoolId(req);
    const from = String(req.query.from || '');
    const to = String(req.query.to || '');
    if (!sid || !validDate(from) || !validDate(to)) {
      return res.status(400).json({ message: 'from and to are required as YYYY-MM-DD' });
    }
    const cacheKey = `reports:daily:${sid}:${from}:${to}`;
    const cached = fastCache.get<any>(cacheKey);
    if (cached) return res.json(cached);

    const data = await dailyAttendanceReport(sid, from, to);
    fastCache.set(cacheKey, data, 30);
    res.json(data);
  } catch (_e: any) {
    res.json([]);
  }
});

router.get('/monthly', async (req: Request, res: Response) => {
  try {
    const sid = schoolId(req) || '00000000-0000-0000-0000-000000000001';
    const month = String(req.query.month || new Date().toISOString().slice(0, 7));
    const cacheKey = `reports:monthly:${sid}:${month}`;
    const cached = fastCache.get<any>(cacheKey);
    if (cached) return res.json(cached);

    const parts = month.split('-');
    const year = Number(parts[0]) || new Date().getFullYear();
    const m = Number(parts[1]) || (new Date().getMonth() + 1);
    const lastDay = new Date(year, m, 0).getDate();
    const from = `${year}-${String(m).padStart(2, '0')}-01`;
    const to = `${year}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const records = await studentAttendanceReport(sid, from, to);
    const payload = { month, from, to, records };
    fastCache.set(cacheKey, payload, 30);
    res.json(payload);
  } catch (_e: any) {
    res.json({ month: req.query.month, records: [] });
  }
});


router.get('/defaulters', async (req: Request, res: Response) => {
  try {
    const sid = schoolId(req) || '00000000-0000-0000-0000-000000000001';
    const threshold = Number(req.query.threshold || 75);
    const today = new Date().toISOString().slice(0, 10);
    const startOfMonth = today.slice(0, 8) + '01';
    const from = String(req.query.from || startOfMonth);
    const to = String(req.query.to || today);
    const all = await studentAttendanceReport(sid, from, to);
    const defaulters = all.filter((s: any) => (s.attendance_percentage ?? 100) < threshold);
    res.json({ threshold, count: defaulters.length, defaulters });
  } catch (_e: any) {
    res.json({ threshold: req.query.threshold, count: 0, defaulters: [] });
  }
});

router.get('/export/csv', async (req: Request, res: Response) => {
  try {
    const sid = schoolId(req) || '00000000-0000-0000-0000-000000000001';
    const today = new Date().toISOString().slice(0, 10);
    const startOfMonth = today.slice(0, 8) + '01';
    const from = String(req.query.from || startOfMonth);
    const to = String(req.query.to || today);

    let records: any[] = [];
    try {
      records = await studentAttendanceReport(sid, from, to);
    } catch {
      records = [];
    }

    const header = ['Student Name', 'Roll Number', 'Class', 'Section', 'Present Days', 'Absent Days', 'Left Early Days', 'Total Sessions', 'Attendance Rate (%)'];
    const lines = [header.join(',')];
    for (const r of records) {
      lines.push([
        `"${String(r.student_name || '').replace(/"/g, '""')}"`,
        `"${String(r.roll || '').replace(/"/g, '""')}"`,
        `"${String(r.class_name || '').replace(/"/g, '""')}"`,
        `"${String(r.section_name || '').replace(/"/g, '""')}"`,
        r.present_days ?? 0,
        r.absent_days ?? 0,
        r.left_early_days ?? 0,
        r.marked_days ?? 0,
        `${r.attendance_percentage ?? 0}%`
      ].join(','));
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-report-${from}-to-${to}.csv"`);
    res.send(lines.join('\n'));
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to export CSV' });
  }
});

router.get('/export/pdf', async (req: Request, res: Response) => {
  try {
    const PDFDocument = require('pdfkit');
    const sid = schoolId(req) || '00000000-0000-0000-0000-000000000001';
    const today = new Date().toISOString().slice(0, 10);
    const startOfMonth = today.slice(0, 8) + '01';
    const from = String(req.query.from || startOfMonth);
    const to = String(req.query.to || today);

    let records: any[] = [];
    try {
      records = await studentAttendanceReport(sid, from, to);
    } catch {
      records = [];
    }


    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-report-${from}-to-${to}.pdf"`);
    doc.pipe(res);

    doc.fontSize(20).text('AttendoSchool — Attendance Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(11).text(`Reporting Period: ${from} to ${to}`, { align: 'center' });
    doc.moveDown(1);

    doc.fontSize(10).text('Student Name', 40).text('Roll', 200).text('Class-Sec', 260).text('Present', 350).text('Rate', 450);
    doc.moveTo(40, doc.y + 4).lineTo(550, doc.y + 4).stroke();
    doc.moveDown(0.5);

    for (const r of records) {
      doc.text(String(r.student_name || ''), 40)
         .text(String(r.roll || ''), 200)
         .text(`${r.class_name || ''}-${r.section_name || ''}`, 260)
         .text(`${r.present_days}/${r.marked_days}`, 350)
         .text(`${r.attendance_percentage}%`, 450);
      doc.moveDown(0.4);
    }

    doc.end();
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to export PDF' });
  }
});


// ── GET /attendance-reports/template (Offline Attendance Spreadsheet Template) ──
router.get('/template', async (_req: Request, res: Response) => {
  try {
    const sampleData = [
      {
        'Admission Number': 'ADM-2026-001',
        'Student Name': 'Aarav Sharma',
        'Status': 'P',
        'Date': new Date().toISOString().slice(0, 10)
      },
      {
        'Admission Number': 'ADM-2026-002',
        'Student Name': 'Ananya Verma',
        'Status': 'A',
        'Date': new Date().toISOString().slice(0, 10)
      },
      {
        'Admission Number': 'ADM-2026-003',
        'Student Name': 'Rohan Gupta',
        'Status': 'L',
        'Date': new Date().toISOString().slice(0, 10)
      },
      {
        'Admission Number': 'ADM-2026-004',
        'Student Name': 'Diya Sen',
        'Status': 'HD',
        'Date': new Date().toISOString().slice(0, 10)
      }
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sampleData);
    ws['!cols'] = [{ wch: 20 }, { wch: 25 }, { wch: 12 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Offline Attendance');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="offline_attendance_template.xlsx"');
    return res.send(buffer);
  } catch (err: any) {
    return res.status(500).json({ message: err.message || 'Failed to generate template' });
  }
});

// ── POST /attendance-reports/import-offline ──
router.post('/import-offline', async (req: Request, res: Response) => {
  try {
    const sid = schoolId(req) || 'school-1';
    const { classId, sectionId, records = [], date = new Date().toISOString().slice(0, 10) } = req.body || {};

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ message: 'Array of attendance records is required' });
    }

    // Pre-validation: ensure every record has student identification
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const adm = String(r.admissionNumber || r['Admission Number'] || r.admission_number || r.roll || r['Roll Number'] || '').trim();
      const stName = String(r.studentName || r['Student Name'] || r.name || '').trim();
      if (!adm && !stName) {
        return res.status(422).json({
          success: false,
          message: `Record at row #${i + 1} is missing both admission/roll number and student name. Entire operation cancelled; no attendance data was stored in the database.`
        });
      }
    }

    // Breakdown counters
    let total = 0;
    let present = 0;
    let absent = 0;
    let late = 0;
    let halfDay = 0;
    let leftEarly = 0;

    const normalizedRecords: any[] = [];
    for (const r of records) {
      const rawStatus = String(r.status || r.Status || 'P').trim().toUpperCase();
      let status = 'PRESENT';
      let isPresent = true;

      if (rawStatus === 'A' || rawStatus === 'ABSENT') {
        status = 'ABSENT';
        isPresent = false;
        absent++;
      } else if (rawStatus === 'L' || rawStatus === 'LATE') {
        status = 'LATE';
        isPresent = true;
        late++;
      } else if (rawStatus === 'LE' || rawStatus === 'LEFT_EARLY' || rawStatus === 'LEFT EARLY' || rawStatus === 'EARLY') {
        status = 'LEFT_EARLY';
        isPresent = true;
        leftEarly++;
      } else if (rawStatus === 'HD' || rawStatus === 'HALF_DAY' || rawStatus === 'HALF DAY') {
        status = 'HALF_DAY';
        isPresent = true;
        halfDay++;
      } else {
        status = 'PRESENT';
        isPresent = true;
        present++;
      }
      total++;

      normalizedRecords.push({
        admissionNumber: String(r.admissionNumber || r['Admission Number'] || r.admission_number || r.roll || r['Roll Number'] || '').trim(),
        rollNumber: String(r.rollNumber || r['Roll Number'] || r.roll || '').trim(),
        studentName: String(r.studentName || r['Student Name'] || r.name || '').trim(),
        date: String(r.date || r.Date || date || new Date().toISOString().slice(0, 10)).trim(),
        status,
        isPresent
      });
    }

    // 1. PostgreSQL Atomic Upsert
    if (isPostgresConfigured) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        await client.query(`
          CREATE TABLE IF NOT EXISTS daily_attendance (
            id VARCHAR(64) PRIMARY KEY,
            school_id VARCHAR(64) NOT NULL,
            class_id VARCHAR(64),
            section_id VARCHAR(64),
            attendance_date DATE NOT NULL,
            total_count INT DEFAULT 0,
            present_count INT DEFAULT 0,
            absent_count INT DEFAULT 0,
            late_count INT DEFAULT 0,
            half_day_count INT DEFAULT 0,
            updated_at TIMESTAMP DEFAULT NOW(),
            CONSTRAINT uq_daily_attendance UNIQUE (school_id, class_id, section_id, attendance_date)
          )
        `);

        const dailyId = `da-${sid}-${classId || 'all'}-${sectionId || 'all'}-${date}`;
        await client.query(`
          INSERT INTO daily_attendance (id, school_id, class_id, section_id, attendance_date, total_count, present_count, absent_count, late_count, half_day_count, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
          ON CONFLICT (school_id, class_id, section_id, attendance_date)
          DO UPDATE SET
            total_count = EXCLUDED.total_count,
            present_count = EXCLUDED.present_count,
            absent_count = EXCLUDED.absent_count,
            late_count = EXCLUDED.late_count,
            half_day_count = EXCLUDED.half_day_count,
            updated_at = NOW()
        `, [dailyId, sid, classId || null, sectionId || null, date, total, present, absent, late, halfDay]);

        let sessionId = '';
        const dup = await client.query(
          `SELECT id FROM attendance_sessions WHERE school_id=$1 AND class_id=$2 AND section_id=$3 AND attendance_date=$4 LIMIT 1`,
          [sid, classId || 'cls-10', sectionId || 'sec-10-a', date]
        );
        if (dup.rowCount) {
          sessionId = dup.rows[0].id;
          await client.query(`DELETE FROM attendance_records WHERE attendance_session_id=$1`, [sessionId]);
        } else {
          sessionId = `sess-${Date.now()}`;
          await client.query(
            `INSERT INTO attendance_sessions (id, school_id, class_id, section_id, attendance_date, total_count, present_count, absent_count)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [sessionId, sid, classId || 'cls-10', sectionId || 'sec-10-a', date, total, present, absent]
          );
        }

        const enrolledStudents = (await client.query(
          `SELECT id, name, roll_number, admission_number FROM students WHERE school_id=$1 AND is_active`,
          [sid]
        )).rows;

        for (const nr of normalizedRecords) {
          const st = enrolledStudents.find(s =>
            (nr.admissionNumber && (s.admission_number === nr.admissionNumber || s.roll_number === nr.admissionNumber)) ||
            (nr.rollNumber && s.roll_number === nr.rollNumber) ||
            (nr.studentName && s.name && s.name.toLowerCase() === nr.studentName.toLowerCase())
          ) || { id: `st-off-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };

          await client.query(
            `INSERT INTO attendance_records (attendance_session_id, student_id, is_present, status)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (attendance_session_id, student_id) DO UPDATE SET is_present=EXCLUDED.is_present, status=EXCLUDED.status`,
            [sessionId, st.id, nr.isPresent, nr.status]
          );
        }

        await client.query('COMMIT');
        client.release();
      } catch (txErr: any) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(400).json({
          success: false,
          message: `Offline attendance import failed: ${txErr.message || 'Database transaction error'}. The entire operation was rolled back and no records were saved in the database.`
        });
      }
    }

    // 2. Cloud Firestore & In-Memory Upsert (Only executes if Postgres succeeded or non-Postgres)
    const sessId = `sess-${sid}-${date}`;
    if (isFirebaseConfigured()) {
      try {
        await collections.attendanceSessions().doc(sessId).set({
          school_id: sid,
          class_id: classId || 'cls-10',
          section_id: sectionId || 'sec-10-a',
          attendance_date: date,
          total_count: total,
          present_count: present,
          absent_count: absent,
          late_count: late,
          half_day_count: halfDay,
          updated_at: new Date().toISOString()
        }, { merge: true });

        for (const nr of normalizedRecords) {
          const recId = `rec-${sessId}-${nr.admissionNumber || nr.rollNumber || nr.studentName.replace(/\s+/g, '_')}`;
          await collections.attendanceRecords().doc(recId).set({
            sessionId: sessId,
            attendance_session_id: sessId,
            schoolId: sid,
            studentName: nr.studentName,
            admissionNumber: nr.admissionNumber,
            rollNumber: nr.rollNumber,
            attendanceDate: nr.date,
            status: nr.status,
            is_present: nr.isPresent,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }
      } catch (fsErr: any) {
        console.warn('[OfflineAttendance] Firestore upsert error:', fsErr.message);
      }
    }

    // In-memory update
    for (const nr of normalizedRecords) {
      (memAttendanceRecords as any[]).unshift({
        id: `rec-mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sessionId: sessId,
        attendance_session_id: sessId,
        schoolId: sid,
        studentName: nr.studentName,
        rollNumber: nr.rollNumber,
        admissionNumber: nr.admissionNumber,
        attendanceDate: nr.date,
        attendance_date: nr.date,
        status: nr.status,
        is_present: nr.isPresent
      });
    }

    return res.status(201).json({
      success: true,
      count: total,
      breakdown: {
        total,
        present,
        absent,
        late,
        halfDay
      },
      message: `Offline attendance imported for ${total} student(s) on ${date}.`
    });
  } catch (err: any) {
    console.error('[OfflineAttendance] Error:', err);
    return res.status(500).json({ message: err.message || 'Failed to import offline attendance' });
  }
});

export default router;

