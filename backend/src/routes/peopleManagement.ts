import { Router, Request, Response } from 'express';
import { requireRoles } from '../middleware/auth';
import {
  listStudents, getStudentById, updateStudent, setStudentActive,
  listTeachers, updateTeacher, setTeacherActive
} from '../services/peopleManagementService';

const router = Router();
router.use(requireRoles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER'));
const adminOnly = requireRoles('SUPER_ADMIN', 'SCHOOL_ADMIN');

const sid = (req: Request) => (req as any).user?.schoolId;
const role = (req: Request) => (req as any).user?.role;

// For SUPER_ADMIN (no schoolId), use the default demo school
const effectiveSid = (req: Request) => sid(req) || '00000000-0000-0000-0000-000000000001';

router.get('/', async (req: Request, res: Response) => {
  try {
    if (!sid(req) && role(req) !== 'SUPER_ADMIN') return res.status(403).json({ message: 'School access required' });
    const [students, teachers] = await Promise.all([
      listStudents(effectiveSid(req), '', true).catch(() => []),
      listTeachers(effectiveSid(req), '', true).catch(() => [])
    ]);
    res.json({ students, teachers, totalStudents: students.length, totalTeachers: teachers.length });
  } catch (_e: any) {
    res.json({ students: [], teachers: [], totalStudents: 0, totalTeachers: 0 });
  }
});

function paginateResults(req: Request, res: Response, allRows: any[], maxLimit = 500) {
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const rawLimit = req.query.limit ? parseInt(String(req.query.limit), 10) : null;
  const isExplicitPagination = Boolean(req.query.page || req.query.limit || req.query.paginated === 'true');
  const total = allRows.length;
  const limit = rawLimit && rawLimit > 0 ? Math.min(rawLimit, maxLimit) : (isExplicitPagination ? 50 : total || 50);
  const totalPages = Math.ceil(total / (limit || 1)) || 1;
  const pagedRows = isExplicitPagination ? allRows.slice((page - 1) * limit, page * limit) : allRows;

  res.setHeader('X-Total-Count', String(total));
  res.setHeader('X-Page', String(page));
  res.setHeader('X-Per-Page', String(limit));
  res.setHeader('X-Total-Pages', String(totalPages));

  if (req.query.paginated === 'true' || req.query.format === 'object') {
    return res.json({
      data: pagedRows,
      pagination: { total, page, limit, totalPages }
    });
  }
  return res.json(pagedRows);
}

router.get('/students', async (req: Request, res: Response) => {
  try {
    if (!sid(req) && role(req) !== 'SUPER_ADMIN') return res.status(403).json({ message: 'School access required' });
    const session = String(req.query.session || req.query.academicSession || (req.headers['x-academic-session'] ? decodeURIComponent(String(req.headers['x-academic-session'])) : '') || '').trim();
    const academicYearId = String(req.query.academicYearId || req.query.academic_year_id || req.headers['x-academic-year-id'] || '').trim();
    const classId = String(req.query.classId || req.query.class_id || '').trim();
    const sectionId = String(req.query.sectionId || req.query.section_id || '').trim();
    const students = await listStudents(effectiveSid(req), String(req.query.search || ''), req.query.includeInactive !== 'true', session, academicYearId, classId, sectionId);
    return paginateResults(req, res, students || [], 5000);
  } catch (_e: any) {
    return paginateResults(req, res, []);
  }
});

router.get('/students/:id', async (req: Request, res: Response) => {
  try {
    if (!sid(req) && role(req) !== 'SUPER_ADMIN') return res.status(403).json({ message: 'School access required' });
    const student = await getStudentById(effectiveSid(req), String(req.params.id));
    if (!student) return res.status(404).json({ message: 'Student not found' });
    return res.json(student);
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

router.put('/students/:id', adminOnly, async (req: Request, res: Response) => {
  try {
    if (!sid(req) && role(req) !== 'SUPER_ADMIN') return res.status(403).json({ message: 'School access required' });
    const updated = await updateStudent(effectiveSid(req), String(req.params.id), req.body || {});
    res.json(updated);
  } catch (e: any) {
    const status = typeof e.status === 'number' ? e.status : 400;
    res.status(status).json({
      message: e.message || 'Unable to update student',
      ...(e.errors ? { errors: e.errors } : {})
    });
  }
});

router.patch('/students/:id/status', adminOnly, async (req: Request,res: Response)=>{
  try {
    if(!sid(req) && role(req) !== 'SUPER_ADMIN') return res.status(403).json({message:'School access required'});
    res.json(await setStudentActive(effectiveSid(req), String(req.params.id), Boolean(req.body?.active)));
  } catch(_e:any){ res.json({ id: req.params.id, active: Boolean(req.body?.active) }); }
});

router.get('/teachers', async (req: Request,res: Response)=>{
  try {
    if(!sid(req) && role(req) !== 'SUPER_ADMIN') return res.status(403).json({message:'School access required'});
    let teachers = await listTeachers(effectiveSid(req), String(req.query.search||''), req.query.includeInactive !== 'true').catch(() => []);
    if (!teachers || teachers.length === 0) {
      const { demoTeachers } = await import('./schoolData');
      const sid = effectiveSid(req);
      teachers = demoTeachers.filter(t => !t.school_id || t.school_id === sid || (t.schoolId && t.schoolId === sid));
    }
    return paginateResults(req, res, teachers || [], 500);
  } catch(_e:any){
    return paginateResults(req, res, []);
  }
});

router.put('/teachers/:id', adminOnly, async (req: Request,res: Response)=>{
  try {
    if(!sid(req) && role(req) !== 'SUPER_ADMIN') return res.status(403).json({message:'School access required'});
    res.json(await updateTeacher(effectiveSid(req), String(req.params.id), req.body||{}));
  } catch(e:any){ res.status(400).json({message:e.message||'Unable to update teacher'}); }
});

router.patch('/teachers/:id/status', adminOnly, async (req: Request,res: Response)=>{
  try {
    if(!sid(req) && role(req) !== 'SUPER_ADMIN') return res.status(403).json({message:'School access required'});
    res.json(await setTeacherActive(effectiveSid(req), String(req.params.id), Boolean(req.body?.active)));
  } catch(e:any){ res.status(400).json({message:e.message||'Unable to update teacher status'}); }
});

export default router;

