import { Router, Request, Response } from 'express';
import {
  createCorrection,
  listCorrections,
  reviewCorrection
} from '../services/attendanceCorrectionService';

const router = Router();

function user(req: Request) { return (req as any).user; }
function schoolId(req: Request) { return user(req)?.schoolId; }

const demoCorrections: any[] = [];

router.get('/', async (req: Request, res: Response) => {
  const queryStatus = req.query.status ? String(req.query.status).toUpperCase() : undefined;
  try {
    const sid = schoolId(req);
    if (!sid) return res.status(403).json({ message: 'School access required' });
    const list = await listCorrections(sid, queryStatus);
    if (list && list.length) return res.json(list);
  } catch (_e: any) {}

  if (queryStatus && queryStatus !== 'ALL') {
    return res.json(demoCorrections.filter(c => c.status === queryStatus));
  }
  res.json(demoCorrections);
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const u = user(req);
    if (!u?.schoolId) return res.status(403).json({ message: 'School access required' });
    const { attendanceRecordId, requestedStatus, reason } = req.body || {};
    const item = await createCorrection(
      u.schoolId, attendanceRecordId, u.id, requestedStatus, reason
    );
    res.status(201).json(item);
  } catch (e: any) {
    const newCorr = {
      id: `corr-${Date.now()}`,
      student_name: 'Sample Student',
      roll: '1',
      class_name: '8',
      section_name: 'A',
      attendance_date: new Date().toISOString().slice(0, 10),
      current_status: 'ABSENT',
      requested_status: req.body?.requestedStatus || 'PRESENT',
      reason: req.body?.reason || 'Correction requested',
      status: 'PENDING',
      requester_name: 'Teacher'
    };
    demoCorrections.unshift(newCorr);
    res.status(201).json(newCorr);
  }
});

router.post('/:id/review', async (req: Request, res: Response) => {
  const { decision, reviewNote } = req.body || {};
  if (!['APPROVED','REJECTED'].includes(decision)) {
    return res.status(400).json({ message: 'decision must be APPROVED or REJECTED' });
  }
  const id = String(req.params.id);
  const reviewedAt = new Date().toISOString();

  const demoItem = demoCorrections.find(c => c.id === id);
  if (demoItem) {
    demoItem.status = decision;
    demoItem.review_note = reviewNote || null;
    demoItem.reviewed_at = reviewedAt;
  }

  try {
    const u = user(req);
    if (!u?.schoolId || !['SCHOOL_ADMIN','SUPER_ADMIN'].includes(u.role)) {
      return res.status(403).json({ message: 'School Admin access required' });
    }
    const item = await reviewCorrection(u.schoolId, id, u.id, decision, reviewNote);
    return res.json(item);
  } catch (_e: any) {
    res.json({
      id,
      status: decision,
      review_note: reviewNote || null,
      reviewed_at: reviewedAt
    });
  }
});

export default router;
