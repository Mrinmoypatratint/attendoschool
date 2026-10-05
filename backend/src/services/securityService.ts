import {pool} from '../db';
import crypto from 'crypto';
import { validatePasswordStrength } from '../utils/passwordPolicy';

const MAX_ATTEMPTS=5, LOCK_MINUTES=15;

export async function recordSecurityEvent(eventType:string,ctx:any,metadata:any={}){
 try{
  await pool.query(`INSERT INTO security_events(user_id,school_id,event_type,ip_address,user_agent,metadata)
    VALUES($1,$2,$3,$4,$5,$6)`,
    [ctx?.userId||null,ctx?.schoolId||null,eventType,ctx?.ip||null,ctx?.userAgent||null,metadata]);
 }catch{}
}

export async function getUserForLogin(email:string){
 const {rows}=await pool.query(`SELECT * FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1`,[email]);
 return rows[0]||null;
}

export function isLocked(user:any){
 return !!user?.locked_until && new Date(user.locked_until)>new Date();
}

export async function registerLoginFailure(user:any,ctx:any){
 const attempts=Number(user.failed_login_attempts||0)+1;
 const locked=attempts>=MAX_ATTEMPTS;
 await pool.query(`UPDATE users SET failed_login_attempts=$1,locked_until=$2 WHERE id=$3`,
  [attempts,locked?new Date(Date.now()+LOCK_MINUTES*60000):null,user.id]);
 await recordSecurityEvent(locked?'ACCOUNT_LOCKED':'LOGIN_FAILED',ctx,{attempts});
 return {locked,attempts};
}

export async function registerLoginSuccess(user:any,ctx:any){
 await pool.query(`UPDATE users SET failed_login_attempts=0,locked_until=NULL,last_login_at=NOW() WHERE id=$1`,[user.id]);
 await recordSecurityEvent('LOGIN_SUCCESS',ctx,{});
}


export function passwordStrongEnough(password:string){
 return validatePasswordStrength(password).valid;
}

export function hashToken(token:string){
 return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createRefreshSession(userId:string,token:string,ctx:any,days=7){
 const expires=new Date(Date.now()+days*86400000);
 const {rows}=await pool.query(`INSERT INTO refresh_sessions(user_id,token_hash,ip_address,user_agent,expires_at)
 VALUES($1,$2,$3,$4,$5) RETURNING id,expires_at`,[userId,hashToken(token),ctx?.ip||null,ctx?.userAgent||null,expires]);
 return rows[0];
}

export async function revokeRefreshToken(token:string){
 await pool.query(`UPDATE refresh_sessions SET revoked_at=NOW() WHERE token_hash=$1`,[hashToken(token)]);
}

export async function cleanupSecurity(){
 const a=await pool.query(`DELETE FROM refresh_sessions WHERE expires_at<NOW() OR revoked_at IS NOT NULL`);
 const b=await pool.query(`DELETE FROM api_idempotency_keys WHERE expires_at<NOW()`);
 return {refreshSessionsRemoved:a.rowCount||0,idempotencyKeysRemoved:b.rowCount||0};
}
