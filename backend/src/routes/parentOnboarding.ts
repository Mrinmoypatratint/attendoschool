
import {Router} from 'express';
import * as svc from '../services/parentOnboardingService';
const router=Router();

router.get('/',async(_req,res)=>{
 try{res.json(await svc.listParents())}catch(e:any){res.status(500).json({message:e.message})}
});
router.post('/',async(req,res)=>{
 const u=(req as any).user;
 if(!u || !['SUPER_ADMIN','SCHOOL_ADMIN'].includes(u.role)) return res.status(403).json({message:'Admin access required'});
 try{res.status(201).json(await svc.createParent({...req.body,initiatedBy:u.id}))}catch(e:any){res.status(400).json({message:e.message})}
});
router.post('/:parentUserId/link',async(req,res)=>{
 const u=(req as any).user;
 if(!u || !['SUPER_ADMIN','SCHOOL_ADMIN'].includes(u.role)) return res.status(403).json({message:'Admin access required'});
 try{res.status(201).json(await svc.linkStudent(req.params.parentUserId,req.body.studentId,req.body.relationship||'Parent'))}
 catch(e:any){res.status(400).json({message:e.message})}
});
export default router;
