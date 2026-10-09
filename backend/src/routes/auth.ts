import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, isPostgresConfigured } from '../db';
import { env } from '../config/env';
import { requireAuth, AuthRequest, Role } from '../middleware/auth';
import { findDemoUser } from '../store/demoUsers';
import { demoSchools } from './superAdmin';
import { findFirestoreUserByEmail, getFirestoreSchools, getFirestoreSchoolById } from '../services/firestoreService';
import { sendPasswordResetEmail } from '../services/emailService';
import { queueEmailNotification } from '../services/notificationService';
import { isFirebaseConfigured, collections } from '../firebase';
import { validatePasswordStrength } from '../utils/passwordPolicy';

const router = Router();

export { isSameSchool, canonicalSchoolId, isTestSchool, GREENWOOD_TEST_ALIASES } from '../utils/tenant';
import { isSameSchool, canonicalSchoolId, isTestSchool, isTintSchool } from '../utils/tenant';

// GET /api/auth/institutes - Public active institutes strictly from Database (Supabase / Firestore)
router.get('/institutes', async (_req, res) => {
  let list: any[] = [];
  const existingIds = new Set<string>();
  const existingCodes = new Set<string>();

  // 1. Supabase / PostgreSQL Database (Live SQL query)
  if (isPostgresConfigured) {
    try {
      const q = await pool.query(
        `SELECT id, name, code, COALESCE(address, 'Main Campus') AS address
         FROM schools
         WHERE status = 'ACTIVE'
         ORDER BY name ASC`
      );
      if (q.rows && q.rows.length > 0) {
        list = q.rows.map(s => {
          const sid = String(s.id);
          const scode = String(s.code || 'SCH001').toUpperCase();
          existingIds.add(sid);
          existingCodes.add(scode);
          return {
            id: sid,
            name: String(s.name),
            code: scode,
            address: String(s.address || 'Main Campus')
          };
        });
      }
    } catch (err: any) {
      console.warn('[Auth] Database error fetching schools from PostgreSQL/Supabase:', err.message);
    }
  }

  // 2. Direct Firebase Cloud Firestore - merge any additional active schools
  if (isFirebaseConfigured()) {
    try {
      const fsSchools = await getFirestoreSchools();
      fsSchools
        .filter((s: any) => s && s.name && s.status !== 'SUSPENDED' && s.status !== 'DELETED')
        .forEach((s: any) => {
          const sId = String(s.id);
          const sCode = String(s.code || '').toUpperCase();
          if (!existingIds.has(sId) && (!sCode || !existingCodes.has(sCode))) {
            list.push({
              id: sId,
              name: String(s.name),
              code: sCode || 'SCH001',
              address: String(s.address || s.city || 'Main Campus')
            });
            existingIds.add(sId);
            if (sCode) existingCodes.add(sCode);
          }
        });
    } catch (err: any) {
      console.warn('[Auth] Failed to fetch schools from Cloud Firestore:', err.message);
    }
  }

  // 3. In-memory demoSchools fallback if list is still completely empty
  if (list.length === 0) {
    list = demoSchools.filter(s => s.status === 'ACTIVE').map(s => ({
      id: String(s.id),
      name: String(s.name),
      code: String(s.code || 'GIS001').toUpperCase(),
      address: String(s.address || 'Bengaluru')
    }));
  }

  return res.json(list);
});

// GET /api/auth/lookup-institute - Auto-detect and resolve associated school/institute by email or identifier
router.get('/lookup-institute', async (req, res) => {
  const email = String(req.query.email || req.query.identifier || '').trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ found: false, message: 'Email or identifier is required' });
  }

  // 1. Primary: PostgreSQL / Supabase
  if (isPostgresConfigured) {
    try {
      const q = await pool.query(
        `SELECT u.school_id, s.name as school_name, s.code as school_code, s.status
         FROM users u
         JOIN schools s ON u.school_id = s.id
         WHERE LOWER(u.email) = LOWER($1) AND s.status = 'ACTIVE'
         LIMIT 1`,
        [email]
      );
      if (q.rowCount && q.rowCount > 0) {
        const row = q.rows[0];
        return res.json({
          found: true,
          instituteId: String(row.school_id),
          instituteName: row.school_name,
          instituteCode: row.school_code
        });
      }

      // Check students table if not found in users
      const sq = await pool.query(
        `SELECT st.school_id, s.name as school_name, s.code as school_code, s.status
         FROM students st
         JOIN schools s ON st.school_id = s.id
         WHERE (LOWER(st.email) = LOWER($1) OR LOWER(st.roll_number) = LOWER($1) OR LOWER(st.admission_number) = LOWER($1))
           AND s.status = 'ACTIVE'
         LIMIT 1`,
        [email]
      );
      if (sq.rowCount && sq.rowCount > 0) {
        const row = sq.rows[0];
        return res.json({
          found: true,
          instituteId: String(row.school_id),
          instituteName: row.school_name,
          instituteCode: row.school_code
        });
      }
    } catch (err: any) {
      console.warn('[Auth] Database lookup error in PostgreSQL:', err.message);
    }
  }

  // 2. Secondary: Firestore
  if (isFirebaseConfigured()) {
    try {
      const fsUser = await findFirestoreUserByEmail(email);
      if (fsUser && fsUser.schoolId) {
        const fsSchool = await getFirestoreSchoolById(fsUser.schoolId);
        if (fsSchool && fsSchool.status !== 'SUSPENDED') {
          return res.json({
            found: true,
            instituteId: String(fsSchool.id),
            instituteName: fsSchool.name,
            instituteCode: fsSchool.code || 'SCH'
          });
        }
      }

      // Check students collection in Firestore using targeted queries instead of full scan
      const studentFields = ['admission_number', 'admissionNumber', 'email', 'student_email', 'roll_number', 'rollNumber'];
      let studentFound = false;
      for (const field of studentFields) {
        if (studentFound) break;
        try {
          const snap = await collections.students().where(field, '==', email).limit(1).get();
          if (!snap.empty) {
            const sd = snap.docs[0].data();
            const docSid = sd.school_id || sd.schoolId;
            if (docSid) {
              const fsSchool = await getFirestoreSchoolById(docSid);
              if (fsSchool && fsSchool.status !== 'SUSPENDED') {
                studentFound = true;
                return res.json({
                  found: true,
                  instituteId: String(fsSchool.id),
                  instituteName: fsSchool.name,
                  instituteCode: fsSchool.code || 'SCH'
                });
              }
            }
          }
        } catch {}
      }
    } catch (err: any) {
      console.warn('[Auth] Firestore user lookup error:', err.message);
    }
  }

  // 3. Fallback: In-memory demo users
  const demoMatch = findDemoUser(email);
  if (demoMatch && demoMatch.schoolId) {
    const demoSchool = demoSchools.find(s => s.id === demoMatch.schoolId || isSameSchool(s.id, demoMatch.schoolId!));
    if (demoSchool) {
      return res.json({
        found: true,
        instituteId: String(demoSchool.id),
        instituteName: demoSchool.name,
        instituteCode: demoSchool.code || 'SCH'
      });
    }
  }

  // 4. Domain & email pattern heuristics
  if (email.includes('tint.edu.in') || email.includes('tint.local') || email.includes('tint')) {
    const tint = demoSchools.find(s => isTintSchool(s.id) || (s.code && s.code.toUpperCase() === 'TINT'));
    if (tint) {
      return res.json({
        found: true,
        instituteId: String(tint.id),
        instituteName: tint.name,
        instituteCode: tint.code || 'TINT'
      });
    }
  }

  if (email.includes('demo-school.local') || email.includes('greenwood')) {
    const gw = demoSchools.find(s => isSameSchool(s.id, '00000000-0000-0000-0000-000000000001'));
    if (gw) {
      return res.json({
        found: true,
        instituteId: String(gw.id),
        instituteName: gw.name,
        instituteCode: gw.code || 'GIS001'
      });
    }
  }

  if (email.includes('abc155') || email.includes('abc')) {
    const abc = demoSchools.find(s => isSameSchool(s.id, '08c4960d-75d6-4a92-989b-48309500632e'));
    if (abc) {
      return res.json({
        found: true,
        instituteId: String(abc.id),
        instituteName: abc.name,
        instituteCode: abc.code || 'SCH'
      });
    }
  }

  return res.json({ found: false });
});

function roleMatches(userRole: string, expectedRole?: string): boolean {
  if (!expectedRole) return true;
  const norm = expectedRole.toUpperCase();
  if (norm === 'ADMIN' || norm === 'ADMINISTRATOR' || norm === 'SUPER_ADMIN') {
    return userRole === 'SUPER_ADMIN';
  }
  return userRole === norm;
}

function createTokenPayload(payload: any): any {
  if (!payload || typeof payload !== 'object') return payload;
  const { photo_url, photoUrl, ...clean } = payload;
  return clean;
}

// POST /api/auth/login - Multi-tenant login supporting Firestore, PostgreSQL, and Demo fallback
router.post('/login', async (req, res) => {
  const { instituteId, email, studentId, admissionNumber, admissionNo, password, role: expectedRole } = req.body ?? {};
  const rawIdentifier = String(admissionNumber || admissionNo || email || studentId || '').trim();

  if (!rawIdentifier || !password || typeof password !== 'string' || !password.trim()) {
    return res.status(400).json({ message: 'Admission No./Email and password are required' });
  }

  const isStudentLogin = expectedRole === 'STUDENT';

  // Student login strictly requires selecting an institution
  if (isStudentLogin && !instituteId) {
    return res.status(400).json({ message: 'Please select your institute before signing in' });
  }

  let resolvedInstituteId = instituteId ? String(instituteId).trim() : '';
  let selectedSchoolName = '';
  let selectedSchoolCode = '';

  if (instituteId) {
    let schCheck: any = { rowCount: 0, rows: [] };
    if (isPostgresConfigured) {
      try {
        schCheck = await pool.query(
          `SELECT id, name, code, status FROM schools WHERE id::text = $1 OR LOWER(code) = LOWER($1) LIMIT 1`,
          [instituteId]
        );
      } catch (err: any) {
        console.warn('[Login] School resolution error in PostgreSQL:', err.message);
      }
    }

    if (schCheck.rowCount && schCheck.rowCount > 0) {
      if (schCheck.rows[0].status !== 'ACTIVE') {
        return res.status(401).json({ message: 'Selected institute is inactive or invalid' });
      }
      resolvedInstituteId = String(schCheck.rows[0].id);
      selectedSchoolName = schCheck.rows[0].name;
      selectedSchoolCode = schCheck.rows[0].code;
    } else {
      let fsSchool: any = null;
      if (isFirebaseConfigured()) {
        try {
          fsSchool = await getFirestoreSchoolById(instituteId);
        } catch {}
      }
      if (fsSchool && fsSchool.status === 'ACTIVE') {
        resolvedInstituteId = String(fsSchool.id);
        selectedSchoolName = fsSchool.name;
        selectedSchoolCode = fsSchool.code;
      } else {
        const demoMatch = demoSchools.find(s => (s.id === instituteId || s.code === instituteId || isSameSchool(s.id, instituteId)) && s.status === 'ACTIVE');
        if (!demoMatch) {
          return res.status(401).json({ message: 'Selected institute is inactive or invalid' });
        } else {
          resolvedInstituteId = String(demoMatch.id);
          selectedSchoolName = demoMatch.name;
          selectedSchoolCode = demoMatch.code;
        }
      }
    }
  }

  // 1. PRIMARY: Try Supabase PostgreSQL Database
  if (isPostgresConfigured) {
    try {
      if (isStudentLogin) {
        // Dedicated student login scoped strictly to the selected school/tenant
        const studentQuery = `
          SELECT u.id, u.school_id, u.name, u.email, u.password_hash, u.role, u.is_active AS user_is_active,
                 st.id AS student_id, st.roll_number, st.admission_number, st.is_active AS student_is_active,
                 c.id AS class_id, c.class_number, sec.id AS section_id, sec.name AS section_name,
                 sch.name AS school_name, sch.code AS school_code
          FROM students st
          JOIN schools sch ON sch.id = st.school_id
          JOIN users u ON (u.id = st.user_id OR (st.email IS NOT NULL AND LOWER(u.email) = LOWER(st.email) AND u.school_id = st.school_id))
          LEFT JOIN classes c ON c.id = st.class_id
          LEFT JOIN sections sec ON sec.id = st.section_id
          WHERE (
            st.school_id::text = $2 
            OR LOWER(sch.code) = LOWER($2)
            OR sch.code = (SELECT code FROM schools WHERE id::text = $2 OR LOWER(code) = LOWER($2) LIMIT 1)
          )
            AND (
              LOWER(TRIM(st.admission_number)) = LOWER(TRIM($1))
              OR LOWER(TRIM(u.email)) = LOWER(TRIM($1))
              OR LOWER(TRIM(st.roll_number)) = LOWER(TRIM($1))
            )
            AND u.role = 'STUDENT'
          ORDER BY (LOWER(TRIM(st.admission_number)) = LOWER(TRIM($1))) DESC, st.is_active DESC, u.is_active DESC
          LIMIT 1
        `;

        const studentRes = await pool.query(studentQuery, [rawIdentifier, resolvedInstituteId || instituteId]);
        const stu = studentRes.rows[0];

        if (stu) {
          // Check active status
          if (!stu.user_is_active || !stu.student_is_active) {
            return res.status(401).json({ message: 'Invalid credentials or account not found' });
          }

          // Verify password securely using bcrypt
          const passwordMatch = await bcrypt.compare(password, stu.password_hash);
          if (!passwordMatch) {
            return res.status(401).json({ message: 'Invalid credentials or account not found' });
          }

          const userPayload: any = {
            id: stu.id,
            schoolId: stu.school_id || resolvedInstituteId,
            schoolName: stu.school_name || selectedSchoolName || 'Institutional Campus',
            schoolCode: stu.school_code || selectedSchoolCode || 'SCH',
            name: stu.name,
            email: stu.email,
            role: 'STUDENT' as Role,
            studentId: stu.student_id,
            admissionNumber: stu.admission_number,
            classId: stu.class_id,
            sectionId: stu.section_id,
            className: stu.class_number !== undefined && stu.class_number !== null
              ? (stu.class_number === -1 ? 'L-KG' : stu.class_number === 0 ? 'U-KG' : `Class ${stu.class_number}`)
              : 'Class 10',
            sectionName: stu.section_name || 'A',
            rollNumber: stu.roll_number || '25'
          };

          const token = jwt.sign(createTokenPayload(userPayload), env.jwtSecret, { expiresIn: '30d' });
          return res.json({ token, user: userPayload, provider: 'supabase' });
        }
      } else {
        // School Admin, Teacher, Super Admin, or unspecified role login
        const facultyQuery = `
          SELECT u.id, u.school_id, u.name, u.email, u.password_hash, u.role, u.is_active, u.photo_url,
                 sch.name AS school_name, sch.code AS school_code, sch.photo_url AS school_photo_url
          FROM users u
          LEFT JOIN schools sch ON sch.id = u.school_id
          WHERE LOWER(TRIM(u.email)) = LOWER(TRIM($1))
          ORDER BY (u.school_id::text = $2) DESC
          LIMIT 1
        `;

        const facultyRes = await pool.query(facultyQuery, [rawIdentifier, resolvedInstituteId || '00000000-0000-0000-0000-000000000000']);
        const u = facultyRes.rows[0];

        if (u && u.is_active && (await bcrypt.compare(password, u.password_hash))) {
          if (expectedRole && !roleMatches(u.role, expectedRole)) {
            return res.status(401).json({ message: 'Account is not authorized for the selected role' });
          }

          // Validate tenant isolation
          if (instituteId && u.role !== 'SUPER_ADMIN' && u.school_id) {
            const userSid = String(u.school_id);
            const matches =
              userSid === resolvedInstituteId ||
              userSid === String(instituteId) ||
              isSameSchool(userSid, resolvedInstituteId) ||
              isSameSchool(userSid, String(instituteId)) ||
              (selectedSchoolCode && isSameSchool(u.school_code, selectedSchoolCode));

            if (!matches) {
              return res.status(401).json({ message: 'Account does not belong to the selected institute' });
            }
          }

          const role = u.role as Role;
          const photoUrl = u.photo_url || u.school_photo_url || undefined;
          const userPayload: any = {
            id: u.id,
            schoolId: u.school_id || resolvedInstituteId,
            schoolName: u.school_name || selectedSchoolName || 'Institutional Campus',
            schoolCode: u.school_code || selectedSchoolCode || 'SCH',
            name: u.name,
            email: u.email,
            role,
            photo_url: photoUrl,
            photoUrl: photoUrl
          };

          const token = jwt.sign(createTokenPayload(userPayload), env.jwtSecret, { expiresIn: '30d' });
          return res.json({ token, user: userPayload, provider: 'supabase' });
        }
      }
    } catch (pgErr: any) {
      console.warn('[Login] PostgreSQL query error (falling back to Firestore/demo):', pgErr.message);
      // Continue to secondary fallback
    }
  }

  // 2. SECONDARY: Try Firebase Cloud Firestore
  if (isFirebaseConfigured()) {
    try {
      if (isStudentLogin) {
        let matchedStudent: any = null;
        let fUser: any = null;

        const studentQueryRef = resolvedInstituteId
          ? collections.students().where('school_id', '==', resolvedInstituteId)
          : collections.students();
        const sSnap = await studentQueryRef.get();
        for (const sDoc of sSnap.docs) {

          const sd = sDoc.data();
          const docSid = sd.school_id || sd.schoolId;
          if (resolvedInstituteId && docSid && !isSameSchool(docSid, resolvedInstituteId)) continue;
          const admMatch = (sd.admission_number && sd.admission_number.toLowerCase() === rawIdentifier.toLowerCase()) ||
                           (sd.admissionNumber && sd.admissionNumber.toLowerCase() === rawIdentifier.toLowerCase());
          const emailMatch = (sd.email && sd.email.toLowerCase() === rawIdentifier.toLowerCase()) ||
                             (sd.student_email && sd.student_email.toLowerCase() === rawIdentifier.toLowerCase());
          if (admMatch || emailMatch) {
            matchedStudent = { id: sDoc.id, ...sd };
            break;
          }
        }

        if (matchedStudent) {
          const targetUserId = matchedStudent.user_id || matchedStudent.userId;
          if (targetUserId) {
            const uDoc = await collections.users().doc(targetUserId).get();
            if (uDoc.exists) fUser = { id: uDoc.id, ...uDoc.data() };
          }
          if (!fUser && (matchedStudent.email || matchedStudent.student_email)) {
            fUser = await findFirestoreUserByEmail(matchedStudent.email || matchedStudent.student_email);
          }
        }

        if (fUser && fUser.status === 'ACTIVE' && (await bcrypt.compare(password, fUser.passwordHash))) {
          const cNum = matchedStudent?.class_number ?? matchedStudent?.classNumber ?? matchedStudent?.className ?? (fUser as any).classNumber ?? 10;
          const sName = matchedStudent?.section_name || matchedStudent?.sectionName || matchedStudent?.section || (fUser as any).sectionName || 'A';
          const cleanSName = String(sName).replace(/section\s*/i, '').trim() || 'A';

          const userPayload: any = {
            id: fUser.id,
            schoolId: canonicalSchoolId(fUser.schoolId) || resolvedInstituteId,
            schoolName: selectedSchoolName || (isTestSchool(fUser.schoolId) ? 'Greenwood International School' : 'Institutional Campus'),
            schoolCode: selectedSchoolCode || (isTestSchool(fUser.schoolId) ? 'GIS001' : 'SCH'),
            name: fUser.name,
            email: fUser.email,
            role: 'STUDENT' as Role,
            studentId: matchedStudent?.id || fUser.id,
            admissionNumber: matchedStudent?.admission_number || matchedStudent?.admissionNumber || rawIdentifier,
            classId: matchedStudent?.class_id || matchedStudent?.classId || (fUser as any).classId || `cls-${cNum}`,
            sectionId: matchedStudent?.section_id || matchedStudent?.sectionId || (fUser as any).sectionId || `sec-${cNum}-${cleanSName.toLowerCase()}`,
            className: `Class ${cNum}`,
            sectionName: `Section ${cleanSName}`,
            rollNumber: String(matchedStudent?.roll_number || matchedStudent?.rollNumber || (fUser as any).rollNumber || '1')
          };

          const token = jwt.sign(createTokenPayload(userPayload), env.jwtSecret, { expiresIn: '30d' });
          return res.json({ token, user: userPayload, provider: 'firestore' });
        }
      } else {
        const fUser = await findFirestoreUserByEmail(rawIdentifier);
        if (fUser && fUser.status === 'ACTIVE' && (await bcrypt.compare(password, fUser.passwordHash))) {
          if (expectedRole && !roleMatches(fUser.role, expectedRole)) {
            return res.status(401).json({ message: 'Account is not authorized for the selected role' });
          }

          if (instituteId && fUser.role !== 'SUPER_ADMIN' && fUser.schoolId) {
            const fsUserSid = String(fUser.schoolId);
            const matches =
              fsUserSid === resolvedInstituteId ||
              fsUserSid === String(instituteId) ||
              isSameSchool(fsUserSid, resolvedInstituteId) ||
              isSameSchool(fsUserSid, String(instituteId)) ||
              (isTintSchool(fsUserSid) && (isTintSchool(resolvedInstituteId) || isTintSchool(String(instituteId)))) ||
              (selectedSchoolCode && String(fUser.schoolCode || '').toUpperCase() === selectedSchoolCode.toUpperCase());

            if (!matches) {
              return res.status(401).json({ message: 'Account does not belong to the selected institute' });
            }
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

          const fsPhoto = (fUser as any).photo_url || (fUser as any).photoUrl || undefined;
          const userPayload: any = {
            id: fUser.id,
            schoolId: canonicalSchoolId(fUser.schoolId) || resolvedInstituteId,
            schoolName: schoolName || selectedSchoolName || (isTintSchool(fUser.schoolId) ? 'TINT School' : (isTestSchool(fUser.schoolId) ? 'Greenwood International School' : 'Institutional Campus')),
            schoolCode: schoolCode || selectedSchoolCode || (isTintSchool(fUser.schoolId) ? 'TINT-187' : (isTestSchool(fUser.schoolId) ? 'GIS001' : 'SCH')),
            name: fUser.name,
            email: fUser.email,
            role,
            photo_url: fsPhoto,
            photoUrl: fsPhoto
          };

          const token = jwt.sign(createTokenPayload(userPayload), env.jwtSecret, { expiresIn: '30d' });
          return res.json({ token, user: userPayload, provider: 'firestore' });
        }
      }
    } catch (fsErr: any) {
      // Continue to demo fallback
    }
  }

  // 3. In-memory demo fallback store
  const demo = findDemoUser(rawIdentifier, resolvedInstituteId || instituteId, expectedRole);
  if (demo && (password === demo.password || (await bcrypt.compare(password, demo.password).catch(() => false)))) {
    // Validate role if expectedRole provided
    if (expectedRole && !roleMatches(demo.role, expectedRole)) {
      return res.status(401).json({ message: 'Account is not authorized for the selected role' });
    }

    if (
      instituteId &&
      demo.role !== 'SUPER_ADMIN' &&
      !isSameSchool(demo.schoolId, resolvedInstituteId) &&
      !isSameSchool(demo.schoolId, instituteId) &&
      demo.schoolId !== resolvedInstituteId &&
      !(isTestSchool(demo.schoolId) && isTestSchool(instituteId)) &&
      !(isTintSchool(demo.schoolId) && (isTintSchool(instituteId) || isTintSchool(resolvedInstituteId)))
    ) {
      return res.status(401).json({ message: 'Account does not belong to the selected institute' });
    }

    const demoSchoolObj = demoSchools.find(s => s.id === demo.schoolId || s.code === demo.schoolId || isSameSchool(s.id, demo.schoolId));
    const resolvedSchoolId = canonicalSchoolId(demo.schoolId) || demo.schoolId || resolvedInstituteId || '00000000-0000-0000-0000-000000000001';
    const resolvedSchoolName = selectedSchoolName || demoSchoolObj?.name || (isTintSchool(resolvedSchoolId) ? 'TINT School' : (isTestSchool(resolvedSchoolId) ? 'Greenwood International School' : 'Institutional Campus'));
    const resolvedSchoolCode = selectedSchoolCode || demoSchoolObj?.code || (isTintSchool(resolvedSchoolId) ? 'TINT-187' : (isTestSchool(resolvedSchoolId) ? 'GIS001' : 'SCH'));

    const demoPhoto = demo.photo_url || demo.photoUrl || undefined;
    const userPayload: any = {
      id: demo.id,
      schoolId: resolvedSchoolId,
      schoolName: resolvedSchoolName,
      schoolCode: resolvedSchoolCode,
      name: demo.name,
      email: demo.email,
      role: demo.role as Role,
      photo_url: demoPhoto,
      photoUrl: demoPhoto
    };

    if (demo.role === 'STUDENT') {
      userPayload.studentId = '00000000-0000-0000-0000-000000000099';
      userPayload.admissionNumber = demo.admissionNumber || 'ADM-2026-001';
      userPayload.classId = 'cls-10';
      userPayload.sectionId = 'sec-10-a';
      userPayload.className = 'Class 10';
      userPayload.sectionName = 'Section A';
      userPayload.rollNumber = '25';
      userPayload.schoolName = resolvedSchoolName;
    }

    const token = jwt.sign(createTokenPayload(userPayload), env.jwtSecret, { expiresIn: '30d' });
    return res.json({ token, user: userPayload, provider: 'demo' });
  }

  return res.status(401).json({ message: 'Invalid credentials or account not found' });
});


router.get('/me', requireAuth, (req: AuthRequest, res) => res.json({ user: req.user }));

router.post('/refresh', requireAuth, (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ message: 'Authentication required' });
  const userPayload: any = { ...req.user };
  delete userPayload.iat;
  delete userPayload.exp;
  const token = jwt.sign(createTokenPayload(userPayload), env.jwtSecret, { expiresIn: '30d' });
  return res.json({ token, user: userPayload });
});

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
  schoolId?: string;
  schoolName?: string;
  req?: any;
}) {
  const { email, name, role, userId, schoolId, schoolName = 'Greenwood International School', req } = params;
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
  let baseUrl = env.appBaseUrl || process.env.FRONTEND_URL || 'http://localhost:5173';
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

  // 4. Dispatch Email with Anti-Spam Headers and Multipart Text+HTML via Notification Queue
  let emailResult: any = null;
  try {
    emailResult = await queueEmailNotification({
      schoolId: schoolId || 'school-default',
      recipientEmail: email.toLowerCase().trim(),
      recipientName: name,
      recipientType: (role.toUpperCase() as any) || 'STUDENT',
      templateKey: 'PASSWORD_RESET',
      templateData: {
        name,
        school_name: schoolName,
        reset_link: resetUrl
      },
      idempotencyKey: `pwd-reset-${email.toLowerCase().trim()}-${token.slice(0, 10)}`
    });
  } catch (err: any) {
    console.warn(`[PasswordReset] Failed to queue email notification:`, err.message);
  }

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

  const pwValidation = validatePasswordStrength(String(newPassword));
  if (!pwValidation.valid) {
    return res.status(400).json({ message: pwValidation.message });
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

// POST /api/auth/request-password-reset - Public forgot password request (Anti-Enumeration Hardened)
router.post('/request-password-reset', async (req, res) => {
  const { email, admissionNumber, instituteId } = req.body || {};
  const rawId = String(admissionNumber || email || '').trim();
  if (!rawId) {
    return res.status(400).json({ message: 'Email address or Admission No. is required' });
  }
  let cleanEmail = rawId.toLowerCase();

  let userFound = false;
  let userName = 'User';
  let userRole = 'STUDENT';
  let userId: string | undefined = undefined;
  let schoolId: string | undefined = undefined;
  let schoolName = 'Greenwood International School';

  // 1. Check PostgreSQL (by email or student admission_number)
  try {
    let q = await pool.query(
      `SELECT u.id, u.name, u.role, u.school_id, u.email, sch.name AS school_name
       FROM users u
       LEFT JOIN schools sch ON sch.id = u.school_id
       WHERE LOWER(u.email) = LOWER($1)
       LIMIT 1`,
      [cleanEmail]
    );

    if ((!q.rowCount || q.rowCount === 0) && isPostgresConfigured) {
      // Try resolving student by admission number
      q = await pool.query(
        `SELECT u.id, u.name, u.role, u.school_id, u.email, sch.name AS school_name
         FROM students st
         JOIN users u ON (u.id = st.user_id OR (st.email IS NOT NULL AND LOWER(u.email) = LOWER(st.email)))
         LEFT JOIN schools sch ON sch.id = st.school_id
         WHERE LOWER(TRIM(st.admission_number)) = LOWER(TRIM($1))
           AND ($2::text IS NULL OR st.school_id::text = $2::text OR sch.code = $2)
         LIMIT 1`,
        [cleanEmail, instituteId || null]
      );
    }

    if (q.rowCount && q.rowCount > 0) {
      userFound = true;
      const u = q.rows[0];
      cleanEmail = u.email;
      userName = u.name;
      userRole = u.role;
      userId = u.id;
      schoolId = u.school_id;
      schoolName = u.school_name || schoolName;
    }
  } catch (err) {}

  // 2. Check Firestore if not found yet
  if (!userFound && isFirebaseConfigured()) {
    try {
      const fUser = await findFirestoreUserByEmail(cleanEmail);
      if (fUser) {
        userFound = true;
        userName = fUser.name || 'User';
        userRole = fUser.role || 'STUDENT';
        userId = fUser.id || undefined;
        schoolId = fUser.schoolId || undefined;
        schoolName = fUser.schoolName || schoolName;
      }
    } catch {}
  }

  // 3. Check demoUsers store if not found
  if (!userFound) {
    const demo = findDemoUser(cleanEmail);
    if (demo) {
      userFound = true;
      userName = demo.name || 'Demo User';
      userRole = demo.role || 'STUDENT';
      userId = demo.id || undefined;
      schoolId = demo.schoolId || undefined;
    }
  }

  let resetUrl: string | undefined;

  // Only dispatch email if the account actually exists (prevents unauthorized spamming)
  if (userFound) {
    const result = await createAndSendPasswordReset({
      email: cleanEmail,
      name: userName,
      role: userRole,
      userId,
      schoolId,
      schoolName,
      req
    });

    if (process.env.NODE_ENV !== 'production') {
      resetUrl = result.resetUrl;
    }
  }

  // Always return the exact same generic message to prevent user enumeration
  return res.json({
    success: true,
    message: 'If an account exists with this email address, a password setup link has been sent.',
    ...(resetUrl ? { resetUrl } : {})
  });
});

export default router;
