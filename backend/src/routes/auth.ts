import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db';
import { env } from '../config/env';
import { requireAuth, AuthRequest, Role } from '../middleware/auth';
import { findDemoUser } from '../store/demoUsers';
import { demoSchools } from './superAdmin';
import { findFirestoreUserByEmail, getFirestoreSchools, getFirestoreSchoolById } from '../services/firestoreService';
import { sendPasswordResetEmail } from '../services/emailService';

const router = Router();

/**
 * Tenant matching helper supporting ID & code aliases across Firestore, SQL, and Demo stores.
 */
export function isSameSchool(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return true;
  if (a === b) return true;
  const greenwoodAliases = [
    'school-greenwood-001',
    '00000000-0000-0000-0000-000000000001',
    'greenwood',
    'GIS001',
    'GWIS-2025'
  ];
  return greenwoodAliases.includes(a) && greenwoodAliases.includes(b);
}

export function canonicalSchoolId(id?: string | null): string | null {
  if (!id) return null;
  if (isSameSchool(id, '00000000-0000-0000-0000-000000000001')) {
    return '00000000-0000-0000-0000-000000000001';
  }
  return id;
}

// GET /api/auth/institutes - Public active institutes for multi-tenant selector
router.get('/institutes', async (_req, res) => {
  const combinedMap = new Map<string, { id: string; name: string; code: string; address: string }>();

  // 1. PostgreSQL (Ground truth for multi-tenant relational data)
  try {
    const q = await pool.query(
      `SELECT id, name, code, COALESCE(address, 'Main Campus') AS address
       FROM schools
       WHERE status = 'ACTIVE'
       ORDER BY name ASC`
    );
    if (q.rows) {
      for (const s of q.rows) {
        const key = (s.code || s.name).toUpperCase();
        combinedMap.set(key, {
          id: s.id,
          name: s.name,
          code: s.code || 'SCH001',
          address: s.address || 'Main Campus'
        });
      }
    }
  } catch (_e) {}

  // 2. Firebase Cloud Firestore
  try {
    const fsSchools = await getFirestoreSchools();
    if (fsSchools && fsSchools.length > 0) {
      for (const s of fsSchools) {
        if (s.status === 'ACTIVE') {
          const key = (s.code || s.name).toUpperCase();
          if (!combinedMap.has(key)) {
            combinedMap.set(key, {
              id: s.id,
              name: s.name,
              code: s.code || 'SCH001',
              address: s.address || 'Main Campus'
            });
          }
        }
      }
    }
  } catch (_e) {}

  // 3. Fallback active demo schools
  for (const s of demoSchools) {
    if (s.status === 'ACTIVE') {
      const key = (s.code || s.name).toUpperCase();
      if (!combinedMap.has(key)) {
        combinedMap.set(key, {
          id: s.id,
          name: s.name,
          code: s.code || 'SCH001',
          address: 'Main Campus'
        });
      }
    }
  }

  // Ensure Greenwood is present with standard ID
  if (!combinedMap.has('GIS001') && !combinedMap.has('GREENWOOD INTERNATIONAL SCHOOL')) {
    combinedMap.set('GIS001', {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Greenwood International School',
      code: 'GIS001',
      address: 'Campus 4, Tech Park Boulevard, Bengaluru, Karnataka'
    });
  }

  const result = Array.from(combinedMap.values());
  return res.json(result);
});

function roleMatches(userRole: string, expectedRole?: string): boolean {
  if (!expectedRole) return true;
  const norm = expectedRole.toUpperCase();
  if (norm === 'ADMIN' || norm === 'ADMINISTRATOR' || norm === 'SUPER_ADMIN') {
    return userRole === 'SUPER_ADMIN';
  }
  return userRole === norm;
}

// POST /api/auth/login - Multi-tenant login supporting Firestore, PostgreSQL, and Demo fallback
router.post('/login', async (req, res) => {
  const { instituteId, email, studentId, password, role: expectedRole } = req.body ?? {};
  const identifier = String(email || studentId || '').trim();

  if (!identifier || !password) {
    return res.status(400).json({ message: 'Email/Student ID and password are required' });
  }

  // 1. Try Firebase Cloud Firestore
  try {
    const fUser = await findFirestoreUserByEmail(identifier);
    if (fUser && fUser.status === 'ACTIVE' && (await bcrypt.compare(password, fUser.passwordHash))) {
      // Validate role if expectedRole provided
      if (expectedRole && !roleMatches(fUser.role, expectedRole)) {
        return res.status(401).json({ message: 'Account is not authorized for the selected role' });
      }

      // Validate tenant if instituteId provided and not super admin
      if (instituteId && fUser.role !== 'SUPER_ADMIN' && fUser.schoolId && !isSameSchool(fUser.schoolId, instituteId)) {
        return res.status(401).json({ message: 'Account does not belong to the selected institute' });
      }

      const role = fUser.role as Role;
      let schoolName = fUser.schoolName;
      let schoolCode = fUser.schoolCode;
      if (fUser.schoolId) {
        try {
          const fsSch = await getFirestoreSchoolById(fUser.schoolId);
          if (fsSch) {
            schoolName = fsSch.name;
            schoolCode = fsSch.code;
          }
        } catch {}
      }

      const userPayload: any = {
        id: fUser.id,
        schoolId: canonicalSchoolId(fUser.schoolId),
        schoolName: schoolName || 'Greenwood International School',
        schoolCode: schoolCode || 'GIS001',
        name: fUser.name,
        email: fUser.email,
        role
      };

      if (role === 'STUDENT') {
        userPayload.studentId = fUser.id;
        userPayload.classId = 'cls-10';
        userPayload.sectionId = 'sec-10-a';
        userPayload.className = 'Class 10';
        userPayload.sectionName = 'Section A';
        userPayload.rollNumber = '25';
        userPayload.schoolName = schoolName || 'Greenwood International School';
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
        const demoMatch = demoSchools.find(s => isSameSchool(s.id, instituteId) && s.status === 'ACTIVE');
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
      // Validate role if expectedRole provided
      if (expectedRole && !roleMatches(u.role, expectedRole)) {
        return res.status(401).json({ message: 'Account is not authorized for the selected role' });
      }

      if (instituteId && u.role !== 'SUPER_ADMIN' && u.school_id && !isSameSchool(u.school_id, instituteId)) {
        return res.status(401).json({ message: 'Account does not belong to the selected institute' });
      }

      const role = u.role as Role;
      const userPayload: any = {
        id: u.id,
        schoolId: u.school_id,
        schoolName: u.school_name || selectedSchoolName,
        schoolCode: u.school_code || 'GIS001',
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
    // Validate role if expectedRole provided
    if (expectedRole && !roleMatches(demo.role, expectedRole)) {
      return res.status(401).json({ message: 'Account is not authorized for the selected role' });
    }

    if (instituteId && demo.role !== 'SUPER_ADMIN' && !isSameSchool(demo.schoolId, instituteId)) {
      return res.status(401).json({ message: 'Account does not belong to the selected institute' });
    }

    const userPayload: any = {
      id: demo.id,
      schoolId: demo.schoolId,
      schoolName: 'Greenwood International School',
      schoolCode: 'GIS001',
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

/* ────── Password Reset Architecture ────── */

export interface DemoResetTokenRecord {
  token: string;
  email: string;
  name: string;
  role: string;
  schoolName: string;
  userId?: string;
  expiresAt: Date;
  used: boolean;
}

export const inMemoryResetTokens = new Map<string, DemoResetTokenRecord>();

/**
 * Creates a secure reset token, records it in PostgreSQL (and in-memory fallback),
 * and dispatches an anti-spam compliant setup email.
 */
export async function createAndSendPasswordReset(params: {
  email: string;
  name: string;
  role: 'STUDENT' | 'PARENT' | 'TEACHER' | 'SCHOOL_ADMIN' | string;
  userId?: string;
  schoolName?: string;
  req?: any;
}) {
  const { email, name, role, userId, schoolName = 'Greenwood International School', req } = params;
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // 1. Record in PostgreSQL if available
  try {
    await pool.query(
      `INSERT INTO password_resets(email, user_id, role, token, expires_at, used)
       VALUES($1, $2, $3, $4, $5, FALSE)
       ON CONFLICT (token) DO NOTHING`,
      [email.toLowerCase().trim(), userId || null, role, token, expiresAt]
    );
  } catch (err: any) {
    console.warn(`[PasswordReset] Could not persist token to SQL (${err.message}). Using in-memory store.`);
  }

  // 2. Always record in in-memory map for fast fallback/demo coverage
  inMemoryResetTokens.set(token, {
    token,
    email: email.toLowerCase().trim(),
    name,
    role,
    schoolName,
    userId,
    expiresAt,
    used: false
  });

  // 3. Construct clean destination URL using client's actual origin
  let baseUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
  if (req) {
    const origin = req.get('origin') || req.get('referer');
    if (origin) {
      try {
        const u = new URL(origin);
        baseUrl = `${u.protocol}//${u.host}`;
      } catch {}
    }
  }

  const resetUrl = `${baseUrl}/#/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

  // 4. Dispatch Email with Anti-Spam Headers and Multipart Text+HTML
  const emailResult = await sendPasswordResetEmail({
    to: email,
    name,
    role,
    schoolName,
    resetToken: token,
    resetUrl
  });

  return { token, resetUrl, emailResult };
}

// GET /api/auth/verify-reset-token - Validates token existence and expiry
router.get('/verify-reset-token', async (req, res) => {
  const token = String(req.query.token || '').trim();
  if (!token) {
    return res.status(400).json({ valid: false, message: 'Password reset token is required' });
  }

  // 1. Check PostgreSQL
  try {
    const q = await pool.query(
      `SELECT pr.id, pr.email, pr.role, pr.expires_at, pr.used,
              COALESCE(u.name, pr.email) AS name,
              COALESCE(sch.name, 'Greenwood International School') AS school_name
       FROM password_resets pr
       LEFT JOIN users u ON (u.id = pr.user_id OR LOWER(u.email) = LOWER(pr.email))
       LEFT JOIN schools sch ON sch.id = u.school_id
       WHERE pr.token = $1
       LIMIT 1`,
      [token]
    );

    if (q.rowCount && q.rowCount > 0) {
      const row = q.rows[0];
      if (row.used) {
        return res.status(400).json({ valid: false, message: 'This password reset link has already been used. Please request a new one.' });
      }
      if (new Date(row.expires_at) < new Date()) {
        return res.status(400).json({ valid: false, message: 'This password reset link has expired (24-hour limit). Please request a new one.' });
      }
      return res.json({
        valid: true,
        email: row.email,
        name: row.name,
        role: row.role,
        schoolName: row.school_name
      });
    }
  } catch (err) {}

  // 2. Check in-memory store
  const mem = inMemoryResetTokens.get(token);
  if (mem) {
    if (mem.used) {
      return res.status(400).json({ valid: false, message: 'This password reset link has already been used. Please request a new one.' });
    }
    if (mem.expiresAt < new Date()) {
      return res.status(400).json({ valid: false, message: 'This password reset link has expired (24-hour limit). Please request a new one.' });
    }
    return res.json({
      valid: true,
      email: mem.email,
      name: mem.name,
      role: mem.role,
      schoolName: mem.schoolName
    });
  }

  return res.status(400).json({ valid: false, message: 'Invalid or expired password reset link.' });
});

// POST /api/auth/reset-password - Sets new password using verified token
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) {
    return res.status(400).json({ message: 'Token and new password are required' });
  }

  if (String(newPassword).length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters long and include numbers/letters.' });
  }

  let targetEmail = '';
  let targetUserId: string | null = null;
  let isFromDb = false;

  // 1. Verify in PostgreSQL
  try {
    const q = await pool.query(
      `SELECT id, email, user_id, role, expires_at, used
       FROM password_resets
       WHERE token = $1
       LIMIT 1`,
      [token]
    );
    if (q.rowCount && q.rowCount > 0) {
      const r = q.rows[0];
      if (r.used) {
        return res.status(400).json({ message: 'This password reset link has already been used.' });
      }
      if (new Date(r.expires_at) < new Date()) {
        return res.status(400).json({ message: 'This password reset link has expired.' });
      }
      targetEmail = r.email;
      targetUserId = r.user_id;
      isFromDb = true;
    }
  } catch (err) {}

  // 2. If not found in DB, check in-memory map
  if (!targetEmail) {
    const mem = inMemoryResetTokens.get(token);
    if (mem) {
      if (mem.used) {
        return res.status(400).json({ message: 'This password reset link has already been used.' });
      }
      if (mem.expiresAt < new Date()) {
        return res.status(400).json({ message: 'This password reset link has expired.' });
      }
      targetEmail = mem.email;
      targetUserId = mem.userId || null;
      mem.used = true;
    }
  }

  if (!targetEmail) {
    return res.status(400).json({ message: 'Invalid or unrecognized reset token.' });
  }

  // Hash new password
  const newHash = await bcrypt.hash(newPassword, 10);

  // Update in PostgreSQL
  try {
    if (targetUserId) {
      await pool.query(
        `UPDATE users
         SET password_hash = $1, password_changed_at = NOW(), updated_at = NOW(), failed_login_attempts = 0, locked_until = NULL
         WHERE id = $2`,
        [newHash, targetUserId]
      );
    } else {
      await pool.query(
        `UPDATE users
         SET password_hash = $1, password_changed_at = NOW(), updated_at = NOW(), failed_login_attempts = 0, locked_until = NULL
         WHERE LOWER(email) = LOWER($2)`,
        [newHash, targetEmail]
      );
    }

    if (isFromDb) {
      await pool.query(
        `UPDATE password_resets SET used = TRUE WHERE token = $1`,
        [token]
      );
    }
  } catch (err: any) {
    console.warn(`[ResetPassword] Error updating SQL password:`, err.message);
  }

  // Update demo user if applicable
  const demoUser = findDemoUser(targetEmail);
  if (demoUser) {
    demoUser.password = newPassword;
  }

  // Mark in-memory map
  const mem = inMemoryResetTokens.get(token);
  if (mem) mem.used = true;

  console.log(`[ResetPassword] Password successfully updated for account: ${targetEmail}`);

  return res.json({
    success: true,
    message: 'Your password has been successfully updated. You may now sign in with your new password.',
    email: targetEmail
  });
});

// POST /api/auth/request-password-reset - Public forgot password request
router.post('/request-password-reset', async (req, res) => {
  const { email } = req.body || {};
  if (!email || !String(email).trim()) {
    return res.status(400).json({ message: 'Email address is required' });
  }
  const cleanEmail = String(email).trim().toLowerCase();

  let userName = 'User';
  let userRole = 'STUDENT';
  let userId: string | undefined = undefined;
  let schoolName = 'Greenwood International School';

  // Check SQL
  try {
    const q = await pool.query(
      `SELECT u.id, u.name, u.role, sch.name AS school_name
       FROM users u
       LEFT JOIN schools sch ON sch.id = u.school_id
       WHERE LOWER(u.email) = LOWER($1)
       LIMIT 1`,
      [cleanEmail]
    );
    if (q.rowCount && q.rowCount > 0) {
      const u = q.rows[0];
      userName = u.name;
      userRole = u.role;
      userId = u.id;
      schoolName = u.school_name || schoolName;
    }
  } catch (err) {}

  const result = await createAndSendPasswordReset({
    email: cleanEmail,
    name: userName,
    role: userRole,
    userId,
    schoolName,
    req
  });

  return res.json({
    success: true,
    message: 'If an account exists with this email address, a password setup link has been sent.',
    resetUrl: result.resetUrl
  });
});

export default router;
