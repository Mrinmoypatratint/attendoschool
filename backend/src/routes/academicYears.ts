import { Router, Request, Response } from 'express';
import {
  listAcademicYears, createAcademicYear, updateAcademicYear,
  setActiveAcademicYear, deactivateAcademicYear,
  archiveAcademicYear, unarchiveAcademicYear,
  getActiveAcademicYear
} from '../services/academicYearService';
import { isTestSchool } from './auth';

export interface AcademicYearItem {
  id: string;
  school_id: string;
  name: string;
  code: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  is_archived: boolean;
  student_count: number;
  class_count: number;
}

// In-memory store per school tenant (fallback only when database is unavailable)
const inMemoryAcademicYears: Record<string, AcademicYearItem[]> = {};

function createDefaultSessions(schoolId: string): AcademicYearItem[] {
  return [
    { id: 'ay-2024-25', school_id: schoolId, name: '2024–25 Academic Session', code: '2024-25', start_date: '2024-04-01', end_date: '2025-03-31', is_active: false, is_archived: true, student_count: 0, class_count: 0 },
    { id: 'ay-2025-26', school_id: schoolId, name: '2025–26 Academic Session', code: '2025-26', start_date: '2025-04-01', end_date: '2026-03-31', is_active: true, is_archived: false, student_count: 0, class_count: 0 },
    { id: 'ay-2026-27', school_id: schoolId, name: '2026–27 Academic Session', code: '2026-27', start_date: '2026-04-01', end_date: '2027-03-31', is_active: false, is_archived: false, student_count: 0, class_count: 0 }
  ];
}

export function getInMemoryAcademicYears(schoolId?: string | null): AcademicYearItem[] {
  const sid = schoolId || 'default';
  if (!inMemoryAcademicYears[sid] || inMemoryAcademicYears[sid].length === 0) {
    inMemoryAcademicYears[sid] = createDefaultSessions(sid);
  }
  return inMemoryAcademicYears[sid];
}

export function getInMemoryActiveAcademicYear(schoolId?: string | null): AcademicYearItem | null {
  const years = getInMemoryAcademicYears(schoolId);
  const active = years.find(y => y.is_active && !y.is_archived);
  return active || (isTestSchool(schoolId) ? (years[1] || years[0] || null) : null);
}

export function setInMemoryActiveAcademicYear(schoolId: string | null | undefined, yearId: string): AcademicYearItem | null {
  const sid = schoolId || 'default';
  const targets = [sid];
  if (sid !== 'default') targets.push('default');

  let activated: AcademicYearItem | null = null;
  for (const s of targets) {
    const list = getInMemoryAcademicYears(s);
    for (const item of list) {
      if (item.id === yearId) {
        item.is_active = true;
        item.is_archived = false;
        activated = item;
      } else {
        item.is_active = false;
      }
    }
  }
  return activated;
}

export function deactivateInMemoryAcademicYear(schoolId: string | null | undefined, yearId: string): AcademicYearItem | null {
  const sid = schoolId || 'default';
  const list = getInMemoryAcademicYears(sid);
  let deactivated: AcademicYearItem | null = null;
  for (const item of list) {
    if (item.id === yearId) {
      item.is_active = false;
      deactivated = item;
    }
  }
  return deactivated;
}

export function archiveInMemoryAcademicYear(schoolId: string | null | undefined, yearId: string): AcademicYearItem | null {
  const sid = schoolId || 'default';
  const list = getInMemoryAcademicYears(sid);
  let archived: AcademicYearItem | null = null;
  for (const item of list) {
    if (item.id === yearId) {
      item.is_active = false;
      item.is_archived = true;
      archived = item;
    }
  }
  return archived;
}

export function unarchiveInMemoryAcademicYear(schoolId: string | null | undefined, yearId: string): AcademicYearItem | null {
  const sid = schoolId || 'default';
  const list = getInMemoryAcademicYears(sid);
  let unarchived: AcademicYearItem | null = null;
  for (const item of list) {
    if (item.id === yearId) {
      item.is_archived = false;
      item.is_active = false;
      unarchived = item;
    }
  }
  return unarchived;
}


export function updateInMemoryAcademicYear(
  schoolId: string | null | undefined,
  yearId: string,
  data: { name?: string; startDate?: string; endDate?: string }
): AcademicYearItem | null {
  const sid = schoolId || 'default';
  const list = getInMemoryAcademicYears(sid);
  let updated: AcademicYearItem | null = null;
  for (const item of list) {
    if (item.id === yearId) {
      if (data.name !== undefined) {
        item.name = data.name.trim();
        item.code = String(data.name.trim()).slice(0, 10);
      }
      if (data.startDate !== undefined) item.start_date = data.startDate;
      if (data.endDate !== undefined) item.end_date = data.endDate;
      updated = item;
    }
  }
  return updated;
}

export function addInMemoryAcademicYear(schoolId: string | null | undefined, data: Partial<AcademicYearItem>): AcademicYearItem {
  const sid = schoolId || 'default';
  const list = getInMemoryAcademicYears(sid);
  const isAct = Boolean(data.is_active);
  if (isAct) {
    for (const item of list) {
      item.is_active = false;
    }
  }
  const newItem: AcademicYearItem = {
    id: data.id || `ay-${Date.now()}`,
    school_id: sid,
    name: data.name || 'New Academic Session',
    code: data.code || String(data.name || '').slice(0, 10),
    start_date: data.start_date || new Date().toISOString().slice(0, 10),
    end_date: data.end_date || new Date().toISOString().slice(0, 10),
    is_active: isAct,
    is_archived: false,
    student_count: 0,
    class_count: 0
  };
  list.unshift(newItem);
  return newItem;
}

import { requireRoles } from '../middleware/auth';
import { fastCache } from '../utils/cache';

const router = Router();
const schoolId = (req: Request) => (req as any).user?.schoolId;
const staffOrAdmin = requireRoles('SCHOOL_ADMIN', 'SUPER_ADMIN', 'TEACHER');
const adminOnly = requireRoles('SCHOOL_ADMIN', 'SUPER_ADMIN');

// Auto-invalidate academic year cache on mutations
router.use((req, res, next) => {
  if (req.method !== 'GET') {
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        const sid = schoolId(req) || 'default';
        fastCache.invalidatePattern(`academic_years:${sid}`);
        fastCache.invalidatePattern('academic_years');
        fastCache.invalidatePattern(`dashboard:school:${sid}`);
      }
    });
  }
  next();
});

// GET /api/academic-years - Query real database records (Staff and Admin)
router.get('/', staffOrAdmin, async (req, res) => {
  const user = (req as any).user;
  const sid = schoolId(req) || (user?.role === 'SUPER_ADMIN' ? 'default' : null);
  if (!sid && user?.role !== 'SUPER_ADMIN') return res.status(403).json({ message: 'School access required' });
  const cacheKey = `academic_years:${sid}:list`;
  const forceFresh = req.query.fresh === '1' || req.query.fresh === 'true';
  const cached = forceFresh ? null : fastCache.get<any>(cacheKey);
  if (cached) return res.json(cached);

  try {
    const rows = await listAcademicYears(sid);
    if (rows && rows.length > 0) {
      fastCache.set(cacheKey, rows, 120);
      return res.json(rows);
    }
    const memRows = getInMemoryAcademicYears(sid);
    fastCache.set(cacheKey, memRows, 60);
    return res.json(memRows);
  } catch (_e: any) {
    const memRows = getInMemoryAcademicYears(sid);
    return res.json(memRows);
  }
});

// GET /api/academic-years/active - Current active academic session
router.get('/active', async (req, res) => {
  const user = (req as any).user;
  const sid = schoolId(req) || (user?.role === 'SUPER_ADMIN' ? 'default' : null);
  if (!sid && user?.role !== 'SUPER_ADMIN') return res.status(403).json({ message: 'School access required' });
  const cacheKey = `academic_years:${sid}:active`;
  const forceFresh = req.query.fresh === '1' || req.query.fresh === 'true';
  const cached = forceFresh ? null : fastCache.get<any>(cacheKey);
  if (cached) return res.json(cached);

  try {
    const row = await getActiveAcademicYear(sid);
    if (row) {
      fastCache.set(cacheKey, row, 120);
      return res.json(row);
    }
    const memActive = getInMemoryActiveAcademicYear(sid);
    if (memActive) fastCache.set(cacheKey, memActive, 60);
    return res.json(memActive);
  } catch (_e: any) {
    return res.json(getInMemoryActiveAcademicYear(sid));
  }
});

// POST /api/academic-years - Create new academic session
router.post('/', adminOnly, async (req: Request, res: Response) => {
  const sid = schoolId(req) || 'default';
  const { name, startDate, endDate, makeActive } = req.body || {};
  if (!name || !startDate || !endDate) return res.status(400).json({ message: 'name, startDate and endDate are required' });

  if (!/^\d{4}-\d{4}$/.test(String(name).trim())) {
    return res.status(400).json({ message: 'Session name must be in YYYY-YYYY format (e.g. 2028-2029)' });
  }

  const sYear = String(startDate).split('-')[0];
  const eYear = String(endDate).split('-')[0];
  if (!/^\d{4}$/.test(sYear) || !/^\d{4}$/.test(eYear)) {
    return res.status(400).json({ message: 'Start and end dates must have a 4-digit year' });
  }

  try {
    const created = await createAcademicYear(sid, name, startDate, endDate, Boolean(makeActive));
    addInMemoryAcademicYear(sid, created);
    return res.status(201).json(created);
  } catch (err: any) {
    return res.status(400).json({ message: err.message || 'Failed to create academic year' });
  }
});

// PUT /api/academic-years/:id - Update academic session
router.put('/:id', adminOnly, async (req: Request, res: Response) => {
  const sid = schoolId(req) || 'default';
  const yearId = String(req.params.id);
  const { name, startDate, endDate } = req.body || {};

  if (!name && !startDate && !endDate) {
    return res.status(400).json({ message: 'At least one field (name, startDate, endDate) is required' });
  }

  if (name && !/^\d{4}-\d{4}$/.test(String(name).trim())) {
    return res.status(400).json({ message: 'Session name must be in YYYY-YYYY format (e.g. 2028-2029)' });
  }

  if (startDate) {
    const sYear = String(startDate).split('-')[0];
    if (!/^\d{4}$/.test(sYear)) {
      return res.status(400).json({ message: 'Start date year must be exactly 4 digits' });
    }
  }
  if (endDate) {
    const eYear = String(endDate).split('-')[0];
    if (!/^\d{4}$/.test(eYear)) {
      return res.status(400).json({ message: 'End date year must be exactly 4 digits' });
    }
  }

  try {
    updateInMemoryAcademicYear(sid, yearId, { name, startDate, endDate });
    const updated = await updateAcademicYear(sid, yearId, { name, startDate, endDate });
    return res.json(updated || { id: yearId, name, start_date: startDate, end_date: endDate });
  } catch (err: any) {
    return res.status(400).json({ message: err.message || 'Failed to update academic session' });
  }
});

// POST /api/academic-years/:id/activate - Make this year the sole active session
router.post('/:id/activate', adminOnly, async (req, res) => {
  const sid = schoolId(req) || 'default';
  const yearId = String(req.params.id);
  setInMemoryActiveAcademicYear(sid, yearId);
  try {
    const dbResult = await setActiveAcademicYear(sid, yearId);
    return res.json(dbResult || { id: yearId, is_active: true, is_archived: false });
  } catch (err: any) {
    return res.status(400).json({ message: err.message || 'Failed to activate academic session' });
  }
});

// POST /api/academic-years/:id/deactivate - Make session inactive
router.post('/:id/deactivate', adminOnly, async (req, res) => {
  const sid = schoolId(req) || 'default';
  const yearId = String(req.params.id);
  deactivateInMemoryAcademicYear(sid, yearId);
  try {
    const dbResult = await deactivateAcademicYear(sid, yearId);
    return res.json(dbResult || { id: yearId, is_active: false });
  } catch (err: any) {
    return res.status(400).json({ message: err.message || 'Failed to deactivate academic session' });
  }
});

// POST /api/academic-years/:id/archive - Archive session (read-only)
router.post('/:id/archive', adminOnly, async (req, res) => {
  const sid = schoolId(req) || 'default';
  const yearId = String(req.params.id);
  archiveInMemoryAcademicYear(sid, yearId);
  try {
    const dbResult = await archiveAcademicYear(sid, yearId);
    return res.json(dbResult || { id: yearId, is_active: false, is_archived: true });
  } catch (err: any) {
    return res.status(400).json({ message: err.message || 'Failed to archive academic session' });
  }
});

// POST /api/academic-years/:id/unarchive - Unarchive session (restore to inactive)
router.post('/:id/unarchive', adminOnly, async (req, res) => {
  const sid = schoolId(req) || 'default';
  const yearId = String(req.params.id);
  unarchiveInMemoryAcademicYear(sid, yearId);
  try {
    const dbResult = await unarchiveAcademicYear(sid, yearId);
    return res.json(dbResult || { id: yearId, is_active: false, is_archived: false });
  } catch (err: any) {
    return res.status(400).json({ message: err.message || 'Failed to unarchive academic session' });
  }
});

// Catch-all parameterized action endpoint: POST /:id/:action
router.post('/:id/:action', adminOnly, async (req, res) => {
  const sid = schoolId(req) || 'default';
  const yearId = String(req.params.id);
  const action = String(req.params.action).toLowerCase();

  try {
    if (action === 'activate') {
      const dbResult = await setActiveAcademicYear(sid, yearId);
      return res.json(dbResult);
    } else if (action === 'deactivate') {
      const dbResult = await deactivateAcademicYear(sid, yearId);
      return res.json(dbResult);
    } else if (action === 'archive') {
      const dbResult = await archiveAcademicYear(sid, yearId);
      return res.json(dbResult);
    } else if (action === 'unarchive') {
      const dbResult = await unarchiveAcademicYear(sid, yearId);
      return res.json(dbResult);
    } else {
      return res.status(400).json({ message: `Unknown action: ${action}` });
    }
  } catch (err: any) {
    return res.status(400).json({ message: err.message || `Action ${action} failed` });
  }
});

export default router;
