import { Router, Request, Response } from 'express';
import {
  attendanceSummary,
  studentAttendanceReport,
  dailyAttendanceReport
} from '../services/attendanceReportService';
import { isTestSchool } from './auth';

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
      return res.json({ present: 0, absent: 0, marked: 0, percentage: 0 });
    }
    res.json(await attendanceSummary(sid, from, to));
  } catch (_e: any) {
    res.json({ present: 0, absent: 0, marked: 0, percentage: 0 });
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
    res.json(await attendanceSummary(sid, from, to));
  } catch (_e: any) {
    res.json({ present: 0, absent: 0, marked: 0, percentage: 0 });
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
    res.json(await studentAttendanceReport(sid, from, to, studentId));
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
    res.json(await dailyAttendanceReport(sid, from, to));
  } catch (_e: any) {
    res.json([]);
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

    const header = ['Student Name', 'Roll Number', 'Class', 'Section', 'Present Days', 'Absent Days', 'Total Sessions', 'Attendance Rate (%)'];
    const lines = [header.join(',')];
    for (const r of records) {
      lines.push([
        `"${String(r.student_name || '').replace(/"/g, '""')}"`,
        `"${String(r.roll || '').replace(/"/g, '""')}"`,
        `"${String(r.class_name || '').replace(/"/g, '""')}"`,
        `"${String(r.section_name || '').replace(/"/g, '""')}"`,
        r.present_days ?? 0,
        r.absent_days ?? 0,
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

export default router;
