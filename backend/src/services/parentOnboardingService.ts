
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import {pool} from '../db';

/**
 * Parent onboarding. Security fix (P6): every operation is scoped to the caller's school.
 * schoolId === null means SUPER_ADMIN without a school context (platform-wide listing only).
 */
export class ParentOnboardingError extends Error {
 constructor(public status:number,message:string){super(message)}
}

export async function createParent(input:{email:string;name:string;phone?:string;initiatedBy:string;schoolId:string|null}){
 if(!input.schoolId) throw new ParentOnboardingError(400,'School context required to create a parent');
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const password=crypto.randomBytes(18).toString('base64url');
  const hash=await bcrypt.hash(password,12);
  // Only update an existing account when it is a PARENT of the SAME school (never hijack other tenants' users).
  const u=await client.query(
   `INSERT INTO users(email,password_hash,role,name,phone,active,school_id)
    VALUES($1,$2,'PARENT',$3,$4,true,$5)
    ON CONFLICT(email) DO UPDATE SET name=EXCLUDED.name,phone=EXCLUDED.phone
    WHERE users.role='PARENT' AND users.school_id::text=$5::text
    RETURNING id,email,role,name,phone,active`,
   [input.email,hash,input.name,input.phone||null,input.schoolId]
  );
  if(!u.rows.length) throw new ParentOnboardingError(409,'This e-mail already belongs to another account');
  const user=u.rows[0];
  await client.query(
   `INSERT INTO parent_profiles(user_id,school_id) VALUES($1,$2) ON CONFLICT(user_id) DO NOTHING`,[user.id,input.schoolId]
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

export async function linkStudent(schoolId:string|null,parentUserId:string,studentId:string,relationship:string){
 if(!schoolId) throw new ParentOnboardingError(400,'School context required to link a parent');
 if(!parentUserId||!studentId) throw new ParentOnboardingError(400,'parentUserId and studentId are required');
 const parent=await pool.query(
  `SELECT 1 FROM users WHERE id::text=$1 AND role='PARENT' AND school_id::text=$2 LIMIT 1`,[parentUserId,schoolId]);
 if(!parent.rowCount) throw new ParentOnboardingError(404,'Parent not found in this school');
 const student=await pool.query(
  `SELECT 1 FROM students WHERE id::text=$1 AND school_id::text=$2 LIMIT 1`,[studentId,schoolId]);
 if(!student.rowCount) throw new ParentOnboardingError(404,'Student not found in this school');
 const r=await pool.query(
  `INSERT INTO parent_student_links(parent_user_id,student_id,relationship,school_id)
   VALUES($1,$2,$3,$4)
   ON CONFLICT(parent_user_id,student_id) DO UPDATE SET relationship=EXCLUDED.relationship
   RETURNING *`,[parentUserId,studentId,relationship,schoolId]
 );
 return r.rows[0];
}

export async function listParents(schoolId:string|null){
 const params:any[]=[];
 let scope='';
 if(schoolId){params.push(schoolId);scope=`AND u.school_id::text=$1`;}
 return (await pool.query(`
 SELECT u.id,u.email,u.name,u.phone,u.active,
        count(psl.student_id)::int AS children
 FROM users u LEFT JOIN parent_student_links psl ON psl.parent_user_id=u.id
 WHERE u.role='PARENT' ${scope}
 GROUP BY u.id ORDER BY u.name NULLS LAST,u.email
 `,params)).rows;
}
