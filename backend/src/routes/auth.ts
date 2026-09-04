import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db';
import { env } from '../config/env';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { findDemoUser } from '../store/demoUsers';

const router=Router();

router.post('/login',async(req,res)=>{
  const {email,password}=req.body??{};
  if(!email||!password) return res.status(400).json({message:'Email and password are required'});
  try {
    const result=await pool.query(`SELECT id,school_id,name,email,password_hash,role,is_active FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1`,[email]);
    const u=result.rows[0];
    if(!u||!u.is_active||!(await bcrypt.compare(password,u.password_hash))) return res.status(401).json({message:'Invalid email or password'});
    const user={id:u.id,schoolId:u.school_id,name:u.name,email:u.email,role:u.role};
    const token=jwt.sign(user,env.jwtSecret,{expiresIn:'8h'});
    return res.json({token,user});
  } catch (_e) {
    // Database unavailable — use in-memory demo user store
    const demo = findDemoUser(email);
    if (demo && password === demo.password) {
      const user = { id: demo.id, schoolId: demo.schoolId, name: demo.name, email: demo.email, role: demo.role };
      const token = jwt.sign(user, env.jwtSecret, { expiresIn: '8h' });
      return res.json({ token, user });
    }
    return res.status(401).json({ message: 'Invalid email or password' });
  }
});

router.get('/me',requireAuth,(req:AuthRequest,res)=>res.json({user:req.user}));
export default router;

