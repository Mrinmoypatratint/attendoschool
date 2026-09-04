
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import {pool} from '../db';

export async function createParent(input:{email:string;name:string;phone?:string;initiatedBy:string}){
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const password=crypto.randomBytes(18).toString('base64url');
  const hash=await bcrypt.hash(password,12);
  const u=await client.query(
   `INSERT INTO users(email,password_hash,role,name,phone,active)
    VALUES($1,$2,'PARENT',$3,$4,true)
    ON CONFLICT(email) DO UPDATE SET name=EXCLUDED.name,phone=EXCLUDED.phone
    RETURNING id,email,role,name,phone,active`,
   [input.email,hash,input.name,input.phone||null]
  );
  const user=u.rows[0];
  await client.query(
   `INSERT INTO parent_profiles(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING`,[user.id]
  );
  const token=crypto.randomBytes(32).toString('hex');
  const tokenHash=crypto.createHash('sha256').update(token).digest('hex');
  await client.query(
   `INSERT INTO parent_onboarding_v27(parent_user_id,initiated_by,status,invite_token_hash,expires_at)
    VALUES($1,$2,'PENDING',$3,NOW()+INTERVAL '24 hours')`,
   [user.id,input.initiatedBy,tokenHash]
  );
  await client.query('COMMIT');
  return {user,temporaryPassword:password,inviteToken:token};
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}

export async function linkStudent(parentUserId:string,studentId:string,relationship:string){
 const r=await pool.query(
  `INSERT INTO parent_student_links(parent_user_id,student_id,relationship)
   VALUES($1,$2,$3)
   ON CONFLICT(parent_user_id,student_id) DO UPDATE SET relationship=EXCLUDED.relationship
   RETURNING *`,[parentUserId,studentId,relationship]
 );
 return r.rows[0];
}

export async function listParents(){
 return (await pool.query(`
 SELECT u.id,u.email,u.name,u.phone,u.active,
        count(psl.student_id)::int AS children
 FROM users u LEFT JOIN parent_student_links psl ON psl.parent_user_id=u.id
 WHERE u.role='PARENT'
 GROUP BY u.id ORDER BY u.name NULLS LAST,u.email
 `)).rows;
}
