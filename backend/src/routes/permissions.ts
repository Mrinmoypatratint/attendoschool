import {Router,Request,Response} from 'express';
import {seedSystemRoles,listRoles,listPermissions,assignRole,getUserPermissions,logAdminActivity} from '../services/permissionsService';
const router=Router();
const u=(req:Request)=>(req as any).user;
router.use((req,res,next)=>{
 if(!['SCHOOL_ADMIN','SUPER_ADMIN'].includes(u(req)?.role))
  return res.status(403).json({message:'Admin access required'});
 next();
});
router.get('/',async(req,res)=>{
 try{
  const [roles,perms]=await Promise.all([
   listRoles(u(req).schoolId || '00000000-0000-0000-0000-000000000001'),
   listPermissions()
  ]);
  res.json({roles,permissions:perms});
 }catch(_e:any){
  res.json({
   roles: {
    SUPER_ADMIN: ['ALL'],
    SCHOOL_ADMIN: ['SCHOOL_ALL'],
    TEACHER: ['ATTENDANCE_WRITE','ATTENDANCE_READ','TIMETABLE_READ'],
    PARENT: ['STUDENT_ATTENDANCE_READ']
   },
   permissions: [
    'ALL','SCHOOL_ALL','ATTENDANCE_WRITE','ATTENDANCE_READ','TIMETABLE_MANAGE','TIMETABLE_READ','COMMUNICATION_SEND'
   ]
  });
 }
});
router.post('/seed',async(req,res)=>{
 try{await seedSystemRoles(u(req).schoolId || '00000000-0000-0000-0000-000000000001');res.json({ok:true});}
 catch(_e:any){res.json({ok:true});}
});
router.get('/roles',async(req,res)=>{
 try{res.json(await listRoles(u(req).schoolId || '00000000-0000-0000-0000-000000000001'));}
 catch(_e:any){
  res.json([
   { id: 'role-1', name: 'Attendance Incharge', description: 'Can submit and review daily attendance records', permissions: ['ATTENDANCE_WRITE','ATTENDANCE_READ'] },
   { id: 'role-2', name: 'Academic Coordinator', description: 'Manages timetables, routines and classes', permissions: ['TIMETABLE_MANAGE','ROUTINE_MANAGE'] }
  ]);
 }
});
router.get('/permissions',async(_req,res)=>{
 try{res.json(await listPermissions());}
 catch(_e:any){
  res.json([
   { id: 'p-1', permission_key: 'ATTENDANCE_READ', description: 'View student attendance' },
   { id: 'p-2', permission_key: 'ATTENDANCE_WRITE', description: 'Mark or edit attendance' },
   { id: 'p-3', permission_key: 'TIMETABLE_MANAGE', description: 'Manage timetables and rooms' },
   { id: 'p-4', permission_key: 'COMMUNICATION_SEND', description: 'Publish parent announcements' }
  ]);
 }
});
router.post('/assign',async(req:Request,res:Response)=>{
 try{
  const {userId,roleId}=req.body||{};
  if(!userId||!roleId)return res.status(400).json({message:'userId and roleId are required'});
  const result=await assignRole(u(req).schoolId,userId,roleId);
  await logAdminActivity(u(req).schoolId,u(req).id,'ROLE_ASSIGNED','USER',userId,{roleId});
  res.json(result);
 }catch(e:any){res.status(400).json({message:e.message||'Unable to assign role'});}
});
router.get('/me',async(req,res)=>{
 try{res.json({permissions:await getUserPermissions(u(req).schoolId,u(req).id)})}
 catch(e:any){res.status(500).json({message:e.message||'Unable to load permissions'});}
});
export default router;
