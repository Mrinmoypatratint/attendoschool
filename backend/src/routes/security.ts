import {Router,Request} from 'express';
import {getUserForLogin,isLocked,registerLoginFailure,registerLoginSuccess,passwordStrongEnough,revokeRefreshToken,cleanupSecurity,recordSecurityEvent} from '../services/securityService';
import bcrypt from 'bcryptjs';
const router=Router();
const ctx=(req:Request)=>({userId:(req as any).user?.id,schoolId:(req as any).user?.schoolId,ip:req.ip,userAgent:req.get('user-agent')||''});

router.post('/check-login',async(req,res)=>{
 const {email,password}=req.body||{};
 if(!email||!password)return res.status(400).json({message:'Email and password are required'});
 try{
  const user=await getUserForLogin(email);
  if(!user)return res.status(401).json({message:'Invalid credentials'});
  if(isLocked(user))return res.status(423).json({message:'Account temporarily locked. Try again later.',lockedUntil:user.locked_until});
  const ok=await bcrypt.compare(password,user.password_hash||user.password||'');
  if(!ok){const r=await registerLoginFailure(user,ctx(req));return res.status(401).json({message:r.locked?'Too many failed attempts. Account locked temporarily.':'Invalid credentials'});}
  await registerLoginSuccess(user,ctx(req));
  res.json({ok:true,userId:user.id,role:user.role,schoolId:user.school_id});
 }catch(e:any){res.status(500).json({message:e.message||'Security check failed'});}
});

router.post('/validate-password',async(req,res)=>{
 const {password}=req.body||{};
 res.json({valid:passwordStrongEnough(password),requirements:['8+ characters','uppercase','lowercase','number','special character']});
});

router.post('/logout-refresh',async(req,res)=>{
 try{if(req.body?.token)await revokeRefreshToken(req.body.token);await recordSecurityEvent('REFRESH_REVOKED',ctx(req),{});res.json({ok:true})}
 catch(e:any){res.status(500).json({message:e.message||'Logout failed'})}
});

router.post('/cleanup',async(_req,res)=>{
 try{res.json(await cleanupSecurity())}catch(e:any){res.status(500).json({message:e.message||'Cleanup failed'})}
});
export default router;
