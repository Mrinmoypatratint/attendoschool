import { Router } from 'express';
import * as svc from '../services/productionService';
import { requireAuth, requireRoles } from '../middleware/auth';
const router=Router();

router.get('/health',async(_req,res)=>{
 const r=await svc.health();res.status(r.status==='ok'?200:503).json(r);
});
router.get('/ready',async(_req,res)=>{
 const r=await svc.readiness();res.status(r.ready?200:503).json(r);
});
// Security fix (P6): the mount is unauthenticated, so authenticate here (req.user was never populated).
router.get('/jobs',requireAuth,requireRoles('SUPER_ADMIN'),async(req,res)=>{
 const u=(req as any).user;
 if(!u||!['SUPER_ADMIN'].includes(u.role))return res.status(403).json({message:'Super Admin access required'});
 try{res.json(await svc.jobHistory())}catch(e:any){res.status(500).json({message:e.message})}
});
export default router;
