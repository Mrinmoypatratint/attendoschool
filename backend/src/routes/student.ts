import { Router, Response } from 'express';
import { requireAuth, requireRoles, AuthRequest } from '../middleware/auth';
import * as svc from '../services/studentService';
import { memEntries } from './timetable';
import { isSameSchool, isTestSchool } from './auth';
import { collections, isFirebaseConfigured } from '../firebase';

const router = Router();

// Strict RBAC & Tenant context protection
router.use(requireAuth, requireRoles('STUDENT'), (req: AuthRequest, res: Response, next) => {
  if (!req.user?.schoolId) {
    return res.status(403).json({ message: 'Active institutional enrollment required' });
  }
  next();
});

// GET /api/student/me - Authenticated student profile
router.get('/me', async (req: AuthRequest, res: Response) => {
  try {
    const data = await svc.getStudentProfile(req.user!.schoolId!, req.user!.id);
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ message: e.message || 'Unable to load profile' });
  }
});

// GET /api/student/dashboard - Consolidated dashboard KPIs & widgets
router.get('/dashboard', async (req: AuthRequest, res: Response) => {
  try {
    const data = await svc.getStudentDashboard(req.user!.schoolId!, req.user!.id);
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ message: e.message || 'Unable to load dashboard' });
  }
});

// GET /api/student/attendance - Student attendance logs & summary
router.get('/attendance', async (req: AuthRequest, res: Response) => {
  try {
    const from = req.query.from ? String(req.query.from) : undefined;
    const to = req.query.to ? String(req.query.to) : undefined;
    const data = await svc.getStudentAttendance(req.user!.schoolId!, req.user!.id, from, to);
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ message: e.message || 'Unable to load attendance' });
  }
});


// GET /api/student/timetable - Routine & timetable
router.get('/timetable', async (req: AuthRequest, res: Response) => {
  const sid = req.user!.schoolId!;
  try {
    const data = await svc.getStudentTimetable(sid, req.user!.id);
    if (data && data.length > 0) return res.json(data);
  } catch (e: any) {}

  // Fallback to in-memory timetable entries filtered by student's class/section and tenant
  const classId = (req.user as any)?.classId;
  const sectionId = (req.user as any)?.sectionId;
  const filtered = memEntries.filter(e => {
    if (e.school_id && !isSameSchool(e.school_id, sid)) return false;
    if (!e.school_id && !isTestSchool(sid)) return false;
    if (classId && sectionId) {
      return (e.class_id === classId || String(e.class_number) === String(classId)) &&
             (e.section_id === sectionId || String(e.section_name).toLowerCase() === String(sectionId).toLowerCase());
    }
    return true;
  });
  filtered.sort((a: any, b: any) => a.day_of_week - b.day_of_week || a.period_number - b.period_number);
  res.json(filtered);
});

// GET /api/student/announcements - Published announcements
router.get('/announcements', async (req: AuthRequest, res: Response) => {
  try {
    const data = await svc.getStudentAnnouncements(req.user!.schoolId!, req.user!.id);
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ message: e.message || 'Unable to load announcements' });
  }
});

// GET /api/student/assignments - Homework & assignments
router.get('/assignments', async (req: AuthRequest, res: Response) => {
  try {
    const data = await svc.getStudentAssignments(req.user!.schoolId!, req.user!.id);
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ message: e.message || 'Unable to load assignments' });
  }
});

// POST /api/student/assignments/:id/submit - Submit assignment
router.post('/assignments/:id/submit', async (req: AuthRequest, res: Response) => {
  try {
    const text = String(req.body.submissionText || req.body.text || '').trim();
    if (!text) return res.status(400).json({ message: 'Submission content is required' });
    const data = await svc.submitStudentAssignment(req.user!.schoolId!, req.user!.id, String(req.params.id), text);
    res.json({ success: true, message: 'Assignment submitted successfully', data });
  } catch (e: any) {
    res.status(400).json({ message: e.message || 'Unable to submit assignment' });
  }
});

// GET /api/student/exams - Exams and test results
router.get('/exams', async (req: AuthRequest, res: Response) => {
  try {
    const data = await svc.getStudentExams(req.user!.schoolId!, req.user!.id);
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ message: e.message || 'Unable to load exams' });
  }
});

// GET /api/student/leave-requests - List leave requests
router.get('/leave-requests', async (req: AuthRequest, res: Response) => {
  try {
    const data = await svc.getStudentLeaveRequests(req.user!.schoolId!, req.user!.id);
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ message: e.message || 'Unable to load leave requests' });
  }
});

// POST /api/student/leave-requests - Submit a leave request
router.post('/leave-requests', async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate, reason } = req.body || {};
    const data = await svc.createStudentLeaveRequest(req.user!.schoolId!, req.user!.id, { startDate, endDate, reason });
    res.status(201).json({ success: true, message: 'Leave request submitted', data });
  } catch (e: any) {
    res.status(400).json({ message: e.message || 'Failed to submit leave request' });
  }
});

// PUT /api/student/change-password - Change password
router.put('/change-password', async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required' });
    }
    const data = await svc.changeStudentPassword(req.user!.id, currentPassword, newPassword);
    res.json(data);
  } catch (e: any) {
    res.status(400).json({ message: e.message || 'Failed to change password' });
  }
});

export default router;
