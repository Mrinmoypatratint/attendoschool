import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export type Role = 'SUPER_ADMIN'|'SCHOOL_ADMIN'|'TEACHER'|'PARENT'|'STUDENT';
export type AuthUser = {
  id: string;
  schoolId: string | null;
  name: string;
  email: string;
  role: Role;
  studentId?: string;
  classId?: string;
  sectionId?: string;
};
export interface AuthRequest extends Request { user?: AuthUser }

export function requireAuth(req:AuthRequest,res:Response,next:NextFunction) {
  const h=req.headers.authorization;
  if(!h?.startsWith('Bearer ')) return res.status(401).json({message:'Authentication required'});
  try { req.user=jwt.verify(h.slice(7),env.jwtSecret) as AuthUser; next(); }
  catch { return res.status(401).json({message:'Invalid or expired token'}); }
}
export function requireRoles(...roles:Role[]) {
  return (req:AuthRequest,res:Response,next:NextFunction)=>{
    if(!req.user || !roles.includes(req.user.role)) return res.status(403).json({message:'Access denied'});
    next();
  };
}
