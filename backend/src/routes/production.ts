import {Router,Request} from 'express';
import * as svc from '../services/productionService';
const router=Router();

router.get('/health',async(_req,res)=>{
 const r=await svc.health();res.status(r.status==='ok'?200:503).json(r);
});
router.get('/ready',async(_req,res)=>{
 const r=await svc.readiness();res.status(r.ready?200:503).json(r);
});
router.get('/jobs',async(req,res)=>{
 const u=(req as any).user;
 if(!u||!['SUPER_ADMIN'].includes(u.role))return res.status(403).json({message:'Super Admin access required'});
 try{res.json(await svc.jobHistory())}catch(e:any){res.status(500).json({message:e.message})}
});
export default router;
