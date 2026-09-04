import {Request,Response,NextFunction} from 'express';
import {checkAccess} from '../services/subscriptionEnforcementService';

export function requireSubscription(action:'ATTENDANCE'|'GENERAL'='GENERAL'){
 return async(req:Request,res:Response,next:NextFunction)=>{
  const user=(req as any).user;
  if(!user?.schoolId)return res.status(401).json({message:'School context required'});
  try{
   const result=await checkAccess(user.schoolId,action);
   if(!result.allowed)return res.status(402).json(result);
   (req as any).subscription=result.subscription;
   next();
  }catch(e:any){res.status(500).json({message:e.message||'Subscription check failed'});}
 };
}
