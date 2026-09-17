import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db';
import { env } from '../config/env';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { findDemoUser } from '../store/demoUsers';

import { findFirestoreUserByEmail } from '../services/firestoreService';

const router=Router();

router.post('/login',async(req,res)=>{
  const {email,password}=req.body??{};
  if(!email||!password) return res.status(400).json({message:'Email and password are required'});

  // 1. Try Firebase Cloud Firestore
  try {
    const fUser = await findFirestoreUserByEmail(email);
    if (fUser && fUser.status === 'ACTIVE' && (await bcrypt.compare(password, fUser.passwordHash))) {
      const user = { id: fUser.id, schoolId: fUser.schoolId, name: fUser.name, email: fUser.email, role: fUser.role };
      const token = jwt.sign(user, env.jwtSecret, { expiresIn: '8h' });
      return res.json({ token, user, provider: 'firestore' });
    }
  } catch (fsErr: any) {
    // Continue to SQL fallback if Firestore is offline/uninitialized
  }

  // 2. Try PostgreSQL Database
  try {
    const result=await pool.query(`SELECT id,school_id,name,email,password_hash,role,is_active FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1`,[email]);
    const u=result.rows[0];
    if(u && u.is_active && (await bcrypt.compare(password,u.password_hash))) {
      const user={id:u.id,schoolId:u.school_id,name:u.name,email:u.email,role:u.role};
      const token=jwt.sign(user,env.jwtSecret,{expiresIn:'8h'});
      return res.json({token,user,provider:'postgres'});
    }
  } catch (_e) {
    // SQL query skipped or failed
  }

  // 3. In-memory demo fallback store
  const demo = findDemoUser(email);
  if (demo && password === demo.password) {
    const user = { id: demo.id, schoolId: demo.schoolId, name: demo.name, email: demo.email, role: demo.role };
    const token = jwt.sign(user, env.jwtSecret, { expiresIn: '8h' });
    return res.json({ token, user, provider: 'demo' });
  }

  return res.status(401).json({ message: 'Invalid email or password' });
});

router.get('/me',requireAuth,(req:AuthRequest,res)=>res.json({user:req.user}));
export default router;

