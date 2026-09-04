import {Router} from 'express';import * as svc from '../services/finalIntegrationService';
const router=Router();
router.get('/db-check',async(_req,res)=>{try{res.json(await svc.dbCheck());}catch(e:any){res.status(503).json({ok:false,message:e.message});}});
router.get('/migration-smoke',async(_req,res)=>{try{const r=await svc.migrationSmoke();res.status(r.ok?200:503).json(r);}catch(e:any){res.status(500).json({message:e.message});}});
router.get('/integrity',async(_req,res)=>{try{const r=await svc.coreIntegrity();res.status(r.ok?200:503).json(r);}catch(e:any){res.status(500).json({message:e.message});}});
router.get('/parent-isolation/:parentUserId/:studentId',async(req,res)=>{try{res.json(await svc.parentIsolation(req.params.parentUserId,req.params.studentId));}catch(e:any){res.status(500).json({message:e.message});}});
export default router;
