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
  schoolName?: string;
};
export interface AuthRequest extends Request { user?: AuthUser }

export function requireAuth(req:AuthRequest,res:Response,next:NextFunction) {
  const h=req.headers.authorization;
  const token = h?.startsWith('Bearer ') ? h.slice(7) : (req.query?.token as string);
  if(!token) return res.status(401).json({message:'Authentication required', code: 'AUTH_REQUIRED'});

  try {
    req.user=jwt.verify(token,env.jwtSecret) as AuthUser;
    return next();
  } catch (primaryErr: any) {
    // Only try fallback secrets in development (never in production — security risk + CPU waste)
    if (process.env.NODE_ENV !== 'production') {
      const fallbackSecrets = [
        'super-secret-jwt-key-for-local-testing-12345',
        'development-only-secret'
      ].filter(s => s !== env.jwtSecret);

      for (const secret of fallbackSecrets) {
        try {
          req.user=jwt.verify(token, secret) as AuthUser;
          return next();
        } catch {}
      }
    }

    const isExpired = primaryErr?.name === 'TokenExpiredError';
    return res.status(401).json({
      message: isExpired ? 'Session expired. Please log in again.' : 'Invalid or expired token',
      code: isExpired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN'
    });
  }
}
export function requireRoles(...roles:Role[]) {
  return (req:AuthRequest,res:Response,next:NextFunction)=>{
    if(!req.user || !roles.includes(req.user.role)) return res.status(403).json({message:'Access denied'});
    next();
  };
}
