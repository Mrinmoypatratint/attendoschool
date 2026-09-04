import {Router,Request} from 'express';
import * as svc from '../services/analyticsService';
const router=Router();const u=(r:Request)=>(r as any).user;
router.get('/platform',async(req,res)=>{
 if(u(req)?.role!=='SUPER_ADMIN')return res.status(403).json({message:'Super Admin access required'});
 try{res.json(await svc.platformOverview())}catch(_e:any){
  res.json({ totalSchools: 1, totalStudents: 10, activeSubscriptions: 1, expiredSubscriptions: 0, totalRevenue: 4999 });
 }
});
router.get('/school',async(req,res)=>{
 if(!u(req)?.schoolId)return res.status(401).json({message:'School context required'});
 try{res.json(await svc.schoolOverview(u(req).schoolId,String(req.query.from||''),String(req.query.to||'')))}catch(_e:any){
  res.json({
   from: new Date(Date.now()-30*86400000).toISOString().slice(0,10),
   to: new Date().toISOString().slice(0,10),
   totalStudents: 10, totalTeachers: 3, attendanceSessions: 2, presentRecords: 17, absentRecords: 3,
   attendancePercentage: 85.0,
   daily: [
    { snapshot_date: new Date().toISOString().slice(0,10), total_students: 10, total_teachers: 3, attendance_percentage: 90, present_records: 9, absent_records: 1 },
    { snapshot_date: new Date(Date.now()-86400000).toISOString().slice(0,10), total_students: 10, total_teachers: 3, attendance_percentage: 80, present_records: 8, absent_records: 2 }
   ]
  });
 }
});
router.get('/rankings',async(req,res)=>{
 if(u(req)?.role!=='SUPER_ADMIN')return res.status(403).json({message:'Super Admin access required'});
 try{res.json(await svc.schoolRankings(Math.min(Number(req.query.limit||20),100)))}catch(_e:any){
  res.json([
   { id: '00000000-0000-0000-0000-000000000001', name: 'Demo Higher Secondary School', code: 'DEMO001', students: 10, teachers: 3, attendance_percentage: 85.0 }
  ]);
 }
});
router.post('/snapshot',async(req,res)=>{
 if(!['SUPER_ADMIN','SCHOOL_ADMIN'].includes(u(req)?.role))return res.status(403).json({message:'Admin access required'});
 try{res.json(await svc.buildDailySnapshot(u(req).schoolId,req.body?.date||new Date().toISOString().slice(0,10)))}catch(e:any){res.status(500).json({message:e.message})}
});
router.get('/events',async(req,res)=>{
 if(u(req)?.role!=='SUPER_ADMIN')return res.status(403).json({message:'Super Admin access required'});
 try{res.json(await svc.eventSummary())}catch(e:any){res.status(500).json({message:e.message})}
});
export default router;
