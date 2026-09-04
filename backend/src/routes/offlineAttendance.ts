import {Router,Request} from 'express';
import * as svc from '../services/offlineAttendanceService';
const router=Router();const u=(r:Request)=>(r as any).user;
router.use((req,res,next)=>{
 if(!u(req)?.schoolId||!['SUPER_ADMIN','SCHOOL_ADMIN','TEACHER'].includes(u(req).role))
  return res.status(403).json({message:'Attendance access required'});
 next();
});
router.post('/sync',async(req,res)=>{
 try{res.json(await svc.receiveBatch(u(req).schoolId,u(req).id,req.body))}
 catch(e:any){res.status(400).json({message:e.message||'Unable to receive sync batch'})}
});
router.post('/sync/:id/process',async(req,res)=>{
 try{res.json(await svc.processBatch(u(req).schoolId,u(req).id,req.params.id))}
 catch(e:any){res.status(400).json({message:e.message||'Unable to process sync batch'})}
});
router.get('/sync/:id',async(req,res)=>{
 try{res.json(await svc.batchStatus(u(req).schoolId,u(req).id,req.params.id))}
 catch(e:any){res.status(404).json({message:e.message||'Sync batch not found'})}
});
export default router;
