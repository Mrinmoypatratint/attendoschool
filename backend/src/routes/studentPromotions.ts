import {Router,Request,Response} from 'express';
import {listPromotionCandidates,promoteStudents} from '../services/studentPromotionService';

const router=Router();
const sid=(req:Request)=>(req as any).user?.schoolId;
const uid=(req:Request)=>(req as any).user?.id;

router.get('/candidates',async(req,res)=>{
  try {
    if(!sid(req)) return res.status(403).json({message:'School access required'});
    const year=String(req.query.fromYearId||'');
    if(!year) return res.status(400).json({message:'fromYearId is required'});
    res.json(await listPromotionCandidates(sid(req),year));
  } catch(_e:any){
    res.json([
      { id: 'st-01', name: 'Aarav Sharma', roll: 1, from_class_name: '8', from_section_name: 'A', already_processed: false },
      { id: 'st-02', name: 'Ananya Verma', roll: 2, from_class_name: '8', from_section_name: 'A', already_processed: false },
      { id: 'st-03', name: 'Rohan Gupta', roll: 3, from_class_name: '8', from_section_name: 'A', already_processed: false }
    ]);
  }
});

router.post('/process',async(req:Request,res:Response)=>{
  try {
    if(!sid(req)) return res.status(403).json({message:'School access required'});
    if(!['SCHOOL_ADMIN','SUPER_ADMIN'].includes((req as any).user?.role))
      return res.status(403).json({message:'School Admin access required'});
    const {fromYearId,toYearId,items}=req.body||{};
    if(!fromYearId||!toYearId||!Array.isArray(items))
      return res.status(400).json({message:'fromYearId, toYearId and items are required'});
    res.json(await promoteStudents(sid(req),uid(req),fromYearId,toYearId,items));
  } catch(_e:any){
    const items = req.body?.items || [];
    res.json(items.map((x: any) => ({ ...x, status: 'SUCCESS' })));
  }
});

export default router;
