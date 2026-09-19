import { Router, Request, Response } from 'express';
import {
  listAcademicYears, createAcademicYear,
  setActiveAcademicYear, archiveAcademicYear, getActiveAcademicYear
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

// In-memory store per school tenant
const inMemoryAcademicYears: Record<string, AcademicYearItem[]> = {};

function createDefaultSessions(schoolId: string): AcademicYearItem[] {
  return [
    { id: 'ay-2024-25', school_id: schoolId, name: '2024–25 Academic Session', code: '2024-25', start_date: '2024-04-01', end_date: '2025-03-31', is_active: false, is_archived: true, student_count: 140, class_count: 8 },
    { id: 'ay-2025-26', school_id: schoolId, name: '2025–26 Academic Session', code: '2025-26', start_date: '2025-04-01', end_date: '2026-03-31', is_active: true, is_archived: false, student_count: 185, class_count: 12 },
    { id: 'ay-2026-27', school_id: schoolId, name: '2026–27 Academic Session', code: '2026-27', start_date: '2026-04-01', end_date: '2027-03-31', is_active: false, is_archived: false, student_count: 42, class_count: 6 }
  ];
}

export function getInMemoryAcademicYears(schoolId?: string | null): AcademicYearItem[] {
  const sid = schoolId || 'default';
  if (!inMemoryAcademicYears[sid] || inMemoryAcademicYears[sid].length === 0) {
    if (isTestSchool(sid)) {
      inMemoryAcademicYears[sid] = createDefaultSessions(sid);
    } else {
      inMemoryAcademicYears[sid] = [];
    }
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

const router = Router();
const schoolId = (req: Request) => (req as any).user?.schoolId;

router.get('/', async (req, res) => {
  const user = (req as any).user;
  const sid = schoolId(req) || (user?.role === 'SUPER_ADMIN' ? 'default' : null);
  if (!sid && user?.role !== 'SUPER_ADMIN') return res.status(403).json({ message: 'School access required' });
  try {
    const rows = await listAcademicYears(sid);
    if (rows && rows.length > 0) {
      return res.json(rows);
    }
    return res.json(getInMemoryAcademicYears(sid));
  } catch (_e: any) {
    return res.json(getInMemoryAcademicYears(sid));
  }
});

router.get('/active', async (req, res) => {
  const user = (req as any).user;
  const sid = schoolId(req) || (user?.role === 'SUPER_ADMIN' ? 'default' : null);
  if (!sid && user?.role !== 'SUPER_ADMIN') return res.status(403).json({ message: 'School access required' });
  try {
    const row = await getActiveAcademicYear(sid);
    if (row) {
      return res.json(row);
    }
    return res.json(getInMemoryActiveAcademicYear(sid));
  } catch (_e: any) {
    return res.json(getInMemoryActiveAcademicYear(sid));
  }
});

router.post('/', async (req: Request, res: Response) => {
  const sid = schoolId(req) || 'default';
  const { name, startDate, endDate, makeActive } = req.body || {};
  if (!name || !startDate || !endDate) return res.status(400).json({ message: 'name, startDate and endDate are required' });
  try {
    const created = await createAcademicYear(sid, name, startDate, endDate, Boolean(makeActive));
    addInMemoryAcademicYear(sid, created);
    return res.status(201).json(created);
  } catch (_e: any) {
    const memoryItem = addInMemoryAcademicYear(sid, {
      name,
      start_date: startDate,
      end_date: endDate,
      is_active: Boolean(makeActive)
    });
    return res.status(201).json(memoryItem);
  }
});

router.post('/:id/activate', async (req, res) => {
  const sid = schoolId(req) || 'default';
  const yearId = String(req.params.id);
  // Always update in-memory state so demo/offline mode updates instantly
  const inMem = setInMemoryActiveAcademicYear(sid, yearId);
  try {
    const dbResult = await setActiveAcademicYear(sid, yearId);
    return res.json(dbResult || inMem || { id: yearId, is_active: true, is_archived: false });
  } catch (_e: any) {
    return res.json(inMem || { id: yearId, is_active: true, is_archived: false });
  }
});

router.post('/:id/archive', async (req, res) => {
  const sid = schoolId(req) || 'default';
  const yearId = String(req.params.id);
  const inMem = archiveInMemoryAcademicYear(sid, yearId);
  try {
    const dbResult = await archiveAcademicYear(sid, yearId);
    return res.json(dbResult || inMem || { id: yearId, is_active: false, is_archived: true });
  } catch (_e: any) {
    return res.json(inMem || { id: yearId, is_active: false, is_archived: true });
  }
});

export default router;
