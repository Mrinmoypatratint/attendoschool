import { Router } from 'express';
import * as svc from '../services/parentOnboardingService';
import { requireAuth, requireRoles } from '../middleware/auth';
import { canonicalSchoolId } from '../utils/tenant';

const router = Router();
router.use(requireAuth, requireRoles('SUPER_ADMIN', 'SCHOOL_ADMIN'));

/** Security fix (P6): tenant scope. SCHOOL_ADMIN → own school; SUPER_ADMIN → ?schoolId / body.schoolId (or all for listing). */
function scope(req:any):string|null{
 const u=req.user;
 if(u?.role==='SUPER_ADMIN'){
  const s=(req.query?.schoolId||req.body?.schoolId||'').toString().trim();
  return s?canonicalSchoolId(s):null;
 }
 return canonicalSchoolId(u?.schoolId)||null;
}
function fail(res:any,e:any,fallback:number){
 const status=e instanceof svc.ParentOnboardingError?e.status:fallback;
 res.status(status).json({message:e.message});
}

router.get('/', async(req, res)=>{
 const u=(req as any).user;
 const sid=scope(req);
 if(u?.role!=='SUPER_ADMIN' && !sid) return res.status(403).json({message:'School context required'});
 try{res.json(await svc.listParents(sid))}catch(e:any){fail(res,e,500)}
});
router.post('/',async(req,res)=>{
 const u=(req as any).user;
 if(!u || !['SUPER_ADMIN','SCHOOL_ADMIN'].includes(u.role)) return res.status(403).json({message:'Admin access required'});
 try{res.status(201).json(await svc.createParent({...req.body,initiatedBy:u.id,schoolId:scope(req)}))}catch(e:any){fail(res,e,400)}
});
router.post('/:parentUserId/link',async(req,res)=>{
 const u=(req as any).user;
 if(!u || !['SUPER_ADMIN','SCHOOL_ADMIN'].includes(u.role)) return res.status(403).json({message:'Admin access required'});
 try{res.status(201).json(await svc.linkStudent(scope(req),String(req.params.parentUserId),req.body?.studentId,req.body?.relationship||'Parent'))}
 catch(e:any){fail(res,e,400)}
});
export default router;
