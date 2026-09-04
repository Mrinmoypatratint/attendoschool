import { pool } from '../db';

export async function seedSystemRoles(schoolId:string){
 const roleDefs=[
  ['School Manager','Core school administration',['STUDENTS_MANAGE','TEACHERS_MANAGE','ATTENDANCE_MANAGE','REPORTS_VIEW','NOTIFICATIONS_MANAGE','ACADEMIC_MANAGE','SETTINGS_MANAGE']],
  ['Attendance Manager','Attendance and reports',['ATTENDANCE_MANAGE','REPORTS_VIEW']],
  ['Student Manager','Student records',['STUDENTS_MANAGE']],
  ['Teacher Manager','Teacher records',['TEACHERS_MANAGE']],
  ['Reports Manager','Attendance reports',['REPORTS_VIEW']],
  ['Notification Manager','Parent notifications',['NOTIFICATIONS_MANAGE']],
  ['Billing Manager','School billing',['BILLING_MANAGE']]
 ];
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  for(const [name,desc,keys] of roleDefs as any){
   const r=await client.query(
    `INSERT INTO school_admin_roles(school_id,name,description,is_system)
     VALUES($1,$2,$3,TRUE) ON CONFLICT(school_id,name) DO UPDATE SET description=EXCLUDED.description
     RETURNING id`,[schoolId,name,desc]);
   for(const key of keys){
    const p=await client.query(`SELECT id FROM permission_definitions WHERE permission_key=$1`,[key]);
    if(p.rowCount) await client.query(
     `INSERT INTO school_admin_role_permissions(role_id,permission_id)
      VALUES($1,$2) ON CONFLICT DO NOTHING`,[r.rows[0].id,p.rows[0].id]);
   }
  }
  await client.query('COMMIT');
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}

export async function listRoles(schoolId:string){
 const {rows}=await pool.query(
  `SELECT r.id,r.name,r.description,r.is_system,
          COALESCE(json_agg(p.permission_key) FILTER(WHERE p.id IS NOT NULL),'[]') AS permissions
   FROM school_admin_roles r
   LEFT JOIN school_admin_role_permissions rp ON rp.role_id=r.id
   LEFT JOIN permission_definitions p ON p.id=rp.permission_id
   WHERE r.school_id=$1 GROUP BY r.id ORDER BY r.is_system DESC,r.name`,[schoolId]);
 return rows;
}

export async function listPermissions(){
 const {rows}=await pool.query(`SELECT * FROM permission_definitions ORDER BY permission_key`);
 return rows;
}

export async function assignRole(schoolId:string,userId:string,roleId:string){
 const ok=await pool.query(
  `SELECT 1 FROM users WHERE id=$1 AND school_id=$2 AND role='SCHOOL_ADMIN'`,[userId,schoolId]);
 if(!ok.rowCount) throw new Error('School admin user not found');
 const role=await pool.query(`SELECT id FROM school_admin_roles WHERE id=$1 AND school_id=$2`,[roleId,schoolId]);
 if(!role.rowCount) throw new Error('Role not found');
 const {rows}=await pool.query(
  `INSERT INTO school_admin_assignments(school_id,user_id,role_id)
   VALUES($1,$2,$3) ON CONFLICT(user_id,role_id) DO UPDATE SET role_id=EXCLUDED.role_id
   RETURNING *`,[schoolId,userId,roleId]);
 return rows[0];
}

export async function getUserPermissions(schoolId:string,userId:string){
 const {rows}=await pool.query(
  `SELECT DISTINCT p.permission_key
   FROM school_admin_assignments a
   JOIN school_admin_role_permissions rp ON rp.role_id=a.role_id
   JOIN permission_definitions p ON p.id=rp.permission_id
   WHERE a.school_id=$1 AND a.user_id=$2`,[schoolId,userId]);
 return rows.map(x=>x.permission_key);
}

export async function logAdminActivity(schoolId:string,userId:string,action:string,resourceType?:string,resourceId?:string,metadata?:any){
 await pool.query(
  `INSERT INTO admin_activity_logs(school_id,user_id,action,resource_type,resource_id,metadata)
   VALUES($1,$2,$3,$4,$5,$6)`,
  [schoolId,userId,action,resourceType||null,resourceId||null,metadata||null]);
}
