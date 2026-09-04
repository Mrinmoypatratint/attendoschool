import {Router,Request,Response} from 'express';
import {getParentChildren,getChildAttendance} from '../services/parentPortalService';
const router=Router();
const u=(req:Request)=>(req as any).user;
router.use((req,res,next)=>{
  if(!u(req)?.schoolId || u(req)?.role!=='PARENT') return res.status(403).json({message:'Parent access required'});
  next();
});
router.get('/children',async(req,res)=>{
  try{res.json(await getParentChildren(u(req).schoolId,u(req).id))}
  catch(e:any){res.status(500).json({message:e.message||'Unable to load children'});}
});
router.get('/children/:id/attendance',async(req:Request,res:Response)=>{
  try{
    const from=String(req.query.from||new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().slice(0,10));
    const to=String(req.query.to||new Date().toISOString().slice(0,10));
    res.json(await getChildAttendance(u(req).schoolId,u(req).id,String(req.params.id),from,to));
  }catch(e:any){res.status(400).json({message:e.message||'Unable to load attendance'});}
});
export default router;
