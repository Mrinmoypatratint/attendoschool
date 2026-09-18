import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db';
import { env } from '../config/env';
import { requireAuth, AuthRequest, Role } from '../middleware/auth';
import { findDemoUser } from '../store/demoUsers';
import { demoSchools } from './superAdmin';
import { findFirestoreUserByEmail } from '../services/firestoreService';

const router = Router();

// GET /api/auth/institutes - Public active institutes for multi-tenant selector
router.get('/institutes', async (_req, res) => {
  try {
    const q = await pool.query(
      `SELECT id, name, code, COALESCE(address, 'Main Campus') AS address
       FROM schools
       WHERE status = 'ACTIVE'
       ORDER BY name ASC`
    );
    if (q.rowCount && q.rowCount > 0) {
      return res.json(q.rows);
    }
  } catch (_e) {}

  // Fallback active institutes
  const activeFallback = demoSchools
    .filter((s) => s.status === 'ACTIVE')
    .map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      address: 'Main Campus'
    }));
  return res.json(activeFallback);
});

// POST /api/auth/login - Multi-tenant login supporting Firestore, PostgreSQL, and Demo fallback
router.post('/login', async (req, res) => {
  const { instituteId, email, studentId, password } = req.body ?? {};
  const identifier = String(email || studentId || '').trim();

  if (!identifier || !password) {
    return res.status(400).json({ message: 'Email/Student ID and password are required' });
  }

  // 1. Try Firebase Cloud Firestore
  try {
    const fUser = await findFirestoreUserByEmail(identifier);
    if (fUser && fUser.status === 'ACTIVE' && (await bcrypt.compare(password, fUser.passwordHash))) {
      // Validate tenant if instituteId provided and not super admin
      if (instituteId && fUser.role !== 'SUPER_ADMIN' && fUser.schoolId && fUser.schoolId !== instituteId) {
        return res.status(401).json({ message: 'Account does not belong to the selected institute' });
      }

      const role = fUser.role as Role;
      const userPayload: any = {
        id: fUser.id,
        schoolId: fUser.schoolId,
        name: fUser.name,
        email: fUser.email,
        role
      };

      if (role === 'STUDENT') {
        userPayload.studentId = fUser.id;
        userPayload.className = 'Class 10';
        userPayload.sectionName = 'Section A';
        userPayload.rollNumber = '25';
        userPayload.schoolName = 'Greenwood International School';
      }

      const token = jwt.sign(userPayload, env.jwtSecret, { expiresIn: '8h' });
      return res.json({ token, user: userPayload, provider: 'firestore' });
    }
  } catch (fsErr: any) {
    // Continue to SQL fallback if Firestore is offline/uninitialized
  }

  // 2. Try PostgreSQL Database
  try {
    let selectedSchoolName = 'Greenwood International School';
    let instituteValid = true;

    if (instituteId) {
      const schCheck = await pool.query(
        `SELECT id, name, status FROM schools WHERE id = $1 LIMIT 1`,
        [instituteId]
      );
      if (schCheck.rowCount && schCheck.rowCount > 0) {
        if (schCheck.rows[0].status !== 'ACTIVE') {
          return res.status(401).json({ message: 'Selected institute is inactive or invalid' });
        }
        selectedSchoolName = schCheck.rows[0].name;
      } else {
        // Check if instituteId is a valid demo school
        const demoMatch = demoSchools.find(s => s.id === instituteId && s.status === 'ACTIVE');
        if (!demoMatch) {
          instituteValid = false;
        } else {
          selectedSchoolName = demoMatch.name;
        }
      }
    }

    if (!instituteValid) {
      return res.status(401).json({ message: 'Selected institute is inactive or invalid' });
    }

    const query = `
      SELECT u.id, u.school_id, u.name, u.email, u.password_hash, u.role, u.is_active,
             st.id AS student_id, st.roll_number, st.admission_number,
             c.id AS class_id, c.class_number, sec.id AS section_id, sec.name AS section_name,
             sch.name AS school_name
      FROM users u
      LEFT JOIN schools sch ON sch.id = u.school_id
      LEFT JOIN students st ON (st.user_id = u.id OR (st.school_id = u.school_id AND (LOWER(st.roll_number) = LOWER($1) OR LOWER(st.admission_number) = LOWER($1))))
      LEFT JOIN classes c ON c.id = st.class_id
      LEFT JOIN sections sec ON sec.id = st.section_id
      WHERE (LOWER(u.email) = LOWER($1) OR (st.id IS NOT NULL AND (LOWER(st.roll_number) = LOWER($1) OR LOWER(st.admission_number) = LOWER($1))))
      ORDER BY (u.role = 'STUDENT') DESC
      LIMIT 1
    `;
    const result = await pool.query(query, [identifier]);
    const u = result.rows[0];

    if (u && u.is_active && (await bcrypt.compare(password, u.password_hash))) {
      if (instituteId && u.role !== 'SUPER_ADMIN' && u.school_id && u.school_id !== instituteId) {
        return res.status(401).json({ message: 'Account does not belong to the selected institute' });
      }

      const role = u.role as Role;
      const userPayload: any = {
        id: u.id,
        schoolId: u.school_id,
        name: u.name,
        email: u.email,
        role
      };

      if (role === 'STUDENT') {
        userPayload.studentId = u.student_id;
        userPayload.classId = u.class_id;
        userPayload.sectionId = u.section_id;
        userPayload.className = u.class_number ? `Class ${u.class_number}` : 'Class 10';
        userPayload.sectionName = u.section_name || 'A';
        userPayload.rollNumber = u.roll_number || '25';
        userPayload.schoolName = u.school_name || selectedSchoolName;
      }

      const token = jwt.sign(userPayload, env.jwtSecret, { expiresIn: '8h' });
      return res.json({ token, user: userPayload, provider: 'postgres' });
    }
  } catch (_e) {
    // SQL query skipped or failed
  }

  // 3. In-memory demo fallback store
  const demo = findDemoUser(identifier);
  if (demo && password === demo.password) {
    if (instituteId && demo.role !== 'SUPER_ADMIN' && demo.schoolId !== instituteId) {
      return res.status(401).json({ message: 'Account does not belong to the selected institute' });
    }

    const userPayload: any = {
      id: demo.id,
      schoolId: demo.schoolId,
      name: demo.name,
      email: demo.email,
      role: demo.role as Role
    };

    if (demo.role === 'STUDENT') {
      userPayload.studentId = '00000000-0000-0000-0000-000000000099';
      userPayload.classId = 'cls-10';
      userPayload.sectionId = 'sec-10-a';
      userPayload.className = 'Class 10';
      userPayload.sectionName = 'Section A';
      userPayload.rollNumber = '25';
      userPayload.schoolName = 'Greenwood International School';
    }

    const token = jwt.sign(userPayload, env.jwtSecret, { expiresIn: '8h' });
    return res.json({ token, user: userPayload, provider: 'demo' });
  }

  return res.status(401).json({ message: 'Invalid credentials or account not found' });
});

router.get('/me', requireAuth, (req: AuthRequest, res) => res.json({ user: req.user }));

export default router;
