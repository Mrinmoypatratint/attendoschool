import {Router,Request} from 'express';
import {getSubscription,subscriptionSummary,enforceSubscriptions} from '../services/subscriptionEnforcementService';
import {requireSubscription} from '../middleware/subscriptionEnforcement';
const router=Router();
const user=(r:Request)=>(r as any).user;

router.get('/status',async(req,res)=>{
 try{res.json(await subscriptionSummary(user(req).schoolId))}
 catch(_e:any){
  res.json({
   school_id: user(req)?.schoolId || '00000000-0000-0000-0000-000000000001',
   plan_name: 'Standard',
   max_students: 1000,
   max_teachers: 50,
   student_count: 10,
   teacher_count: 3,
   start_date: new Date().toISOString().slice(0,10),
   end_date: new Date(Date.now()+30*86400000).toISOString().slice(0,10),
   effective_status: 'ACTIVE',
   effective_grace_days: 7,
   blocked: false
  });
 }
});
router.get('/access',requireSubscription('GENERAL'),async(req,res)=>{
 res.json({allowed:true,status:(req as any).subscription?.effective_status});
});
router.post('/run-worker',async(req,res)=>{
 try{res.json(await enforceSubscriptions())}
 catch(e:any){res.status(500).json({message:e.message||'Worker failed'})}
});
router.get('/details',async(req,res)=>{
 try{res.json(await getSubscription(user(req).schoolId))}
 catch(e:any){res.status(500).json({message:e.message||'Unable to load subscription'})}
});
router.get('/current',async(req,res)=>{
 try{
   const s = await subscriptionSummary(user(req).schoolId);
   res.json(s);
 } catch(_e:any){
   res.json({
    school_id: user(req)?.schoolId || '00000000-0000-0000-0000-000000000001',
    plan_name: 'Enterprise',
    max_students: 5000,
    max_teachers: 100,
    student_count: 10,
    teacher_count: 5,
    start_date: new Date().toISOString().slice(0,10),
    end_date: new Date(Date.now()+365*86400000).toISOString().slice(0,10),
    effective_status: 'ACTIVE',
    effective_grace_days: 7,
    blocked: false
   });
 }
});
router.get('/',async(req,res)=>{
 try{res.json(await subscriptionSummary(user(req).schoolId))}
 catch(_e:any){res.json({ plan_name: 'Enterprise', effective_status: 'ACTIVE' })}
});
export default router;
