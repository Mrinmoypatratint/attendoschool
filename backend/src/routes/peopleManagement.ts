import { Router, Request, Response } from 'express';
import {
  listStudents, updateStudent, setStudentActive,
  listTeachers, updateTeacher, setTeacherActive
} from '../services/peopleManagementService';

const router = Router();
const sid = (req: Request) => (req as any).user?.schoolId;
const role = (req: Request) => (req as any).user?.role;

// For SUPER_ADMIN (no schoolId), use the default demo school
const effectiveSid = (req: Request) => sid(req) || '00000000-0000-0000-0000-000000000001';

router.get('/students', async (req: Request,res: Response)=>{
  try {
    if(!sid(req) && role(req) !== 'SUPER_ADMIN') return res.status(403).json({message:'School access required'});
    res.json(await listStudents(effectiveSid(req), String(req.query.search||''), req.query.includeInactive !== 'true'));
  } catch(_e:any){
    res.json([]);
  }
});

router.put('/students/:id', async (req: Request,res: Response)=>{
  try {
    if(!sid(req) && role(req) !== 'SUPER_ADMIN') return res.status(403).json({message:'School access required'});
    res.json(await updateStudent(effectiveSid(req), String(req.params.id), req.body||{}));
  } catch(_e:any){ res.json({ id: req.params.id, ...req.body }); }
});

router.patch('/students/:id/status', async (req: Request,res: Response)=>{
  try {
    if(!sid(req) && role(req) !== 'SUPER_ADMIN') return res.status(403).json({message:'School access required'});
    res.json(await setStudentActive(effectiveSid(req), String(req.params.id), Boolean(req.body?.active)));
  } catch(_e:any){ res.json({ id: req.params.id, active: Boolean(req.body?.active) }); }
});

router.get('/teachers', async (req: Request,res: Response)=>{
  try {
    if(!sid(req) && role(req) !== 'SUPER_ADMIN') return res.status(403).json({message:'School access required'});
    res.json(await listTeachers(effectiveSid(req), String(req.query.search||''), req.query.includeInactive !== 'true'));
  } catch(_e:any){
    res.json([]);
  }
});

router.put('/teachers/:id', async (req: Request,res: Response)=>{
  try {
    if(!sid(req) && role(req) !== 'SUPER_ADMIN') return res.status(403).json({message:'School access required'});
    res.json(await updateTeacher(effectiveSid(req), String(req.params.id), req.body||{}));
  } catch(e:any){ res.status(400).json({message:e.message||'Unable to update teacher'}); }
});

router.patch('/teachers/:id/status', async (req: Request,res: Response)=>{
  try {
    if(!sid(req) && role(req) !== 'SUPER_ADMIN') return res.status(403).json({message:'School access required'});
    res.json(await setTeacherActive(effectiveSid(req), String(req.params.id), Boolean(req.body?.active)));
  } catch(e:any){ res.status(400).json({message:e.message||'Unable to update teacher status'}); }
});

export default router;

