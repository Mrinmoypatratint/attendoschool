import {Request,Response,NextFunction} from 'express';

const buckets=new Map<string,{count:number,start:number}>();
const WINDOW=60_000;
const LIMIT = process.env.RATE_LIMIT ? Number(process.env.RATE_LIMIT) : (process.env.NODE_ENV === 'production' ? 120 : 1000);

export function requestContext(req:Request,_res:Response,next:NextFunction){
 (req as any).securityContext={
  userId:(req as any).user?.id||null,
  schoolId:(req as any).user?.schoolId||null,
  ip:req.ip,
  userAgent:req.get('user-agent')||''
 };
 next();
}

export function apiRateLimit(req:Request,res:Response,next:NextFunction){
 const key=`${req.ip}:${(req as any).user?.id||'anon'}`,now=Date.now();
 const b=buckets.get(key);
 if(!b||now-b.start>=WINDOW){buckets.set(key,{count:1,start:now});return next()}
 b.count++;
 if(b.count>LIMIT)return res.status(429).json({message:'Too many requests. Please try again later.'});
 next();
}

export function securityHeaders(_req:Request,res:Response,next:NextFunction){
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('X-Frame-Options','DENY');
 res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
 res.setHeader('Permissions-Policy','camera=(),microphone=(),geolocation=(self)');
 next();
}
