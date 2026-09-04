import { Router } from 'express';
import { pool } from '../db';
const r=Router();
r.get('/',async(_req,res)=>{try{await pool.query('SELECT 1');res.json({status:'ok',database:'connected',version:'v02'});}catch{res.status(503).json({status:'error',database:'unavailable'});}});
export default r;
