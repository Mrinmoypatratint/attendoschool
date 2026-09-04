
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

export function requireRoles(...roles:string[]){
 return (req:Request,res:Response,next:NextFunction)=>{
  const user=(req as any).user;
  if(!user) return res.status(401).json({message:'Authentication required'});
  if(!roles.includes(user.role)) return res.status(403).json({message:'Insufficient role'});
  next();
 };
}

export function requireSuperAdmin(){
 return requireRoles('SUPER_ADMIN');
}

export function idempotencyKey(req:Request):string|undefined{
 const v=req.header('Idempotency-Key');
 return v?.trim() || undefined;
}

export function sha256(value:string|Buffer){
 return crypto.createHash('sha256').update(value).digest('hex');
}
