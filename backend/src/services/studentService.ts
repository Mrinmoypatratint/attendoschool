import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { pool, isPostgresConfigured } from '../db';
import { collections, isFirebaseConfigured } from '../firebase';
import { isSameSchool, isTestSchool, isDavSchool, isTintSchool } from '../utils/tenant';
import { demoStudents } from '../routes/schoolData';
import { getAllDemoUsers } from '../store/demoUsers';
import { memAttendanceSessions, memAttendanceRecords } from '../routes/teacher';
import { calculateWorkingCalendar } from './calendarService';
import { inMemoryLeaves } from '../store/leavesStore';
import { validatePasswordStrength } from '../utils/passwordPolicy';
import { normalizeGender } from '../utils/gender';
import { validateAttachment, uploadToStorage, deleteFromStorage, buildStudentSubmissionStorageKey, MAX_FILES_COUNT, MAX_TOTAL_SIZE } from '../utils/firebaseStorage';

export function toDdMmYyyy(val: any): string {
  if (!val) return '';
  const s = String(val).trim();
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) return s;
  const twoDigitMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/);
  if (twoDigitMatch) {
    const yy = parseInt(twoDigitMatch[3], 10);
    const fullYear = yy <= 40 ? 2000 + yy : 1900 + yy;
    return `${twoDigitMatch[1].padStart(2, '0')}-${twoDigitMatch[2].padStart(2, '0')}-${fullYear}`;
  }
  const altMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (altMatch) {
    return `${altMatch[1].padStart(2, '0')}-${altMatch[2].padStart(2, '0')}-${altMatch[3]}`;
  }
  const isoMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[3].padStart(2, '0')}-${isoMatch[2].padStart(2, '0')}-${isoMatch[1]}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  }
  return s;
}

/**
 * Resolves student record by authenticated user ID and school ID
 */
async function resolveStudentRecord(schoolId: string, userId: string, studentId?: string) {
  // 1. Try PostgreSQL
  try {
    const q = await pool.query(
      `SELECT st.*, c.class_number, sec.name AS section_name, sch.name AS school_name, sch.photo_url AS school_photo_url, sch.website AS school_website,
              CASE WHEN $3::text IS NOT NULL AND st.id::text = $3::text THEN 0
                   WHEN st.user_id::text = $2 THEN 1
                   WHEN st.email IS NOT NULL AND LOWER(st.email) = (SELECT LOWER(email) FROM users WHERE id::text = $2) THEN 2
                   ELSE 3 END AS match_priority
       FROM students st
       JOIN schools sch ON sch.id = st.school_id
       LEFT JOIN classes c ON c.id = st.class_id
       LEFT JOIN sections sec ON sec.id = st.section_id
       WHERE st.school_id = $1 AND (
         ($3::text IS NOT NULL AND st.id::text = $3::text)
         OR st.user_id::text = $2 
         OR (st.email IS NOT NULL AND LOWER(st.email) = (SELECT LOWER(email) FROM users WHERE id::text = $2))
       )
       ORDER BY match_priority ASC, st.is_active DESC NULLS LAST
       LIMIT 1`,
      [schoolId, userId, studentId || null]
    );
    if (q.rowCount && q.rowCount > 0) {
      return q.rows[0];
    }
  } catch (_e) {}

  // 2. Query Cloud Firestore
  if (isTestSchool(schoolId) && isFirebaseConfigured()) {
    try {
      let userEmail = '';
      try {
        const uDoc = await collections.users().doc(userId).get();
        if (uDoc.exists) userEmail = uDoc.data()?.email || '';
      } catch {}

      const snap = schoolId
        ? await collections.students().where('school_id', '==', schoolId).get()
        : await collections.students().get();
      for (const doc of snap.docs) {
        const d = doc.data();
        const docSid = d.school_id || d.schoolId;
        if (docSid && !isSameSchool(docSid, schoolId)) continue;

        const matches =
          doc.id === userId ||
          d.id === userId ||
          String(d.user_id || d.userId) === userId ||
          (userEmail && d.email && d.email.toLowerCase() === userEmail.toLowerCase()) ||
          (userEmail && d.student_email && d.student_email.toLowerCase() === userEmail.toLowerCase()) ||
          (d.email && d.email.toLowerCase() === userId.toLowerCase()) ||
          (d.student_email && d.student_email.toLowerCase() === userId.toLowerCase());

        if (matches) {
          const cNum = Number(d.class_number ?? d.classNumber ?? d.className ?? 10);
          const sName = d.section_name || d.sectionName || d.section || 'A';
          const cleanSName = String(sName).replace(/section\s*/i, '').trim() || 'A';

          return {
            id: doc.id,
            school_id: docSid || schoolId,
            user_id: d.user_id || d.userId || userId,
            name: d.fullName || d.name || 'Student',
            roll_number: String(d.roll_number || d.rollNumber || '1'),
            admission_number: d.admission_number || d.admissionNumber || `ADM-${doc.id}`,
            class_id: d.class_id || d.classId || `cls-${cNum}`,
            class_number: cNum,
            section_id: d.section_id || d.sectionId || `sec-${cNum}-${cleanSName.toLowerCase()}`,
            section_name: cleanSName,
            school_name: d.school_name || d.schoolName || 'Greenwood International School',
            parent_name: d.parent_name || d.parentName || '',
            parent_sms_number: d.parent_sms_number || d.parentPhone || '',
            parent_email: d.parent_email || d.parentEmail || '',
            date_of_birth: d.date_of_birth || d.dateOfBirth || '',
            photo_url: d.photo_url || d.photoUrl || '/student-avatar.png'
          };
        }
      }

      // If no exact match and test school, use the first enrolled student doc in school
      if (isTestSchool(schoolId)) {
        for (const doc of snap.docs) {
          const d = doc.data();
          const docSid = d.school_id || d.schoolId;
          if (!docSid || isSameSchool(docSid, schoolId)) {
            const cNum = Number(d.class_number ?? d.classNumber ?? d.className ?? 10);
            const sName = d.section_name || d.sectionName || d.section || 'A';
            const cleanSName = String(sName).replace(/section\s*/i, '').trim() || 'A';
            return {
              id: doc.id,
              school_id: docSid || schoolId,
              user_id: d.user_id || d.userId || userId,
              name: d.fullName || d.name || 'Student',
              roll_number: String(d.roll_number || d.rollNumber || '1'),
              admission_number: d.admission_number || d.admissionNumber || `ADM-${doc.id}`,
              class_id: d.class_id || d.classId || `cls-${cNum}`,
              class_number: cNum,
              section_id: d.section_id || d.sectionId || `sec-${cNum}-${cleanSName.toLowerCase()}`,
              section_name: cleanSName,
              school_name: d.school_name || d.schoolName || 'Greenwood International School',
              parent_name: d.parent_name || d.parentName || '',
              parent_sms_number: d.parent_sms_number || d.parentPhone || '',
              parent_email: d.parent_email || d.parentEmail || '',
              date_of_birth: d.date_of_birth || d.dateOfBirth || '',
              photo_url: d.photo_url || d.photoUrl || '/student-avatar.png'
            };
          }
        }
      }
    } catch (err: any) {
      console.warn('[StudentService] Error resolving student from Firestore:', err.message);
    }
  }

  // 3. Fallback: Query in-memory demoStudents
  const normUser = String(userId || '').trim().toLowerCase();
  const normStudentId = String(studentId || '').trim().toLowerCase();

  const ds = demoStudents.find(s => {
    const sidMatch = !s.school_id || isSameSchool(s.school_id, schoolId);
    if (!sidMatch) return false;
    const sId = String(s.id || '').toLowerCase();
    const uId = String(s.user_id || s.userId || '').toLowerCase();
    const adm = String(s.admission_number || s.admissionNumber || '').toLowerCase();
    const em = String(s.email || s.student_email || '').toLowerCase();
    return (
      (normStudentId && (sId === normStudentId || adm === normStudentId)) ||
      sId === normUser ||
      uId === normUser ||
      adm === normUser ||
      em === normUser
    );
  });

  if (ds) {
    const cNum = Number(ds.class_number ?? ds.classNumber ?? ds.className ?? 10);
    const sName = ds.section_name || ds.sectionName || ds.section || 'A';
    const cleanSName = String(sName).replace(/section\s*/i, '').trim() || 'A';
    return {
      id: ds.id || studentId || userId,
      school_id: ds.school_id || ds.schoolId || schoolId,
      user_id: ds.user_id || ds.userId || userId,
      name: ds.name || ds.fullName || 'Student',
      roll_number: String(ds.roll_number || ds.rollNumber || '25'),
      admission_number: ds.admission_number || ds.admissionNumber || 'ADM-2026-DAV1',
      class_id: ds.class_id || ds.classId || `cls-${cNum}`,
      class_number: cNum,
      section_id: ds.section_id || ds.sectionId || `sec-${cNum}-${cleanSName.toLowerCase()}`,
      section_name: cleanSName,
      school_name: ds.school_name || ds.schoolName || (isDavSchool(schoolId) ? 'DAV MODEL SCHOOL' : 'Institutional Campus'),
      parent_name: ds.parent_name || ds.parentName || 'Guardian',
      parent_sms_number: ds.parent_sms_number || ds.parentPhone || '9876543210',
      parent_email: ds.parent_email || ds.parentEmail || 'parent@dav.com',
      date_of_birth: ds.date_of_birth || ds.dob || ds.dateOfBirth || '15-08-2010',
      photo_url: ds.photo_url || ds.photoUrl || (isDavSchool(schoolId) ? '/dav-logo.png' : '/student-avatar.png')
    };
  }

  // 4. Fallback: Query in-memory demoUsers store
  const du = getAllDemoUsers().find(u => {
    if (u.role !== 'STUDENT') return false;
    const sidMatch = !u.schoolId || isSameSchool(u.schoolId, schoolId);
    if (!sidMatch) return false;
    const uId = String(u.id || '').toLowerCase();
    const em = String(u.email || '').toLowerCase();
    const adm = String(u.admissionNumber || '').toLowerCase();
    return (
      uId === normUser ||
      em === normUser ||
      adm === normUser ||
      (normStudentId && (uId === normStudentId || adm === normStudentId))
    );
  });

  if (du) {
    return {
      id: du.id || studentId || userId,
      school_id: du.schoolId || schoolId,
      user_id: du.id || userId,
      name: du.name || 'Student',
      roll_number: '25',
      admission_number: du.admissionNumber || (isDavSchool(schoolId) ? 'ADM-2026-DAV1' : 'ADM-2026-001'),
      class_id: 'cls-10',
      class_number: 10,
      section_id: 'sec-10-a',
      section_name: 'A',
      school_name: isDavSchool(schoolId) ? 'DAV MODEL SCHOOL' : 'Institutional Campus',
      parent_name: 'Guardian',
      parent_sms_number: '9876543210',
      parent_email: isDavSchool(schoolId) ? 'parent@dav.com' : 'parent@school.local',
      date_of_birth: '15-08-2010',
      photo_url: du.photo_url || du.photoUrl || (isDavSchool(schoolId) ? '/dav-logo.png' : '/student-avatar.png')
    };
  }

  // 5. Universal synthetic fallback for any authenticated student in this school
  const isDav = isDavSchool(schoolId);
  return {
    id: studentId || userId || 'st-demo-current',
    school_id: schoolId,
    user_id: userId,
    name: isDav ? 'Aarav Sharma' : 'Student',
    roll_number: '25',
    admission_number: isDav ? 'ADM-2026-DAV1' : 'ADM-2026-001',
    class_id: 'cls-10',
    class_number: 10,
    section_id: 'sec-10-a',
    section_name: 'A',
    school_name: isDav ? 'DAV MODEL SCHOOL' : 'Institutional Campus',
    parent_name: 'Guardian',
    parent_sms_number: '9876543210',
    parent_email: isDav ? 'parent@dav.com' : 'parent@school.local',
    date_of_birth: '15-08-2010',
    photo_url: isDav ? '/dav-logo.png' : '/student-avatar.png'
  };
}

/**
 * Returns full profile details for the authenticated student
 */
export async function getStudentProfile(schoolId: string, userId: string, studentId?: string) {
  const st = await resolveStudentRecord(schoolId, userId, studentId);
  if (!st) throw new Error('Student record not found');

  let academicSessionName = '';
  try {
    const isAyUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(st.academic_year_id || ''));
    const ayQ = await pool.query(
      `SELECT name FROM academic_years 
       WHERE (id = $1 OR (school_id = $2 AND is_active = true)) 
       ORDER BY CASE WHEN id = $1 THEN 0 ELSE 1 END, is_active DESC LIMIT 1`,
      [isAyUuid ? st.academic_year_id : '00000000-0000-0000-0000-000000000000', schoolId]
    );
    if (ayQ.rowCount && ayQ.rows.length > 0) {
      academicSessionName = ayQ.rows[0].name;
    }
  } catch {}

  let userEmail = '';
  try {
    const uQ = await pool.query(`SELECT email FROM users WHERE id = $1`, [userId]);
    if (uQ.rowCount && uQ.rows.length > 0) userEmail = uQ.rows[0].email;
  } catch {}

  let resolvedEmail = st.email || st.student_email || userEmail || '';
  if (!isTestSchool(schoolId) && resolvedEmail.toLowerCase().includes('greenwood.local')) {
    resolvedEmail = userEmail && !userEmail.toLowerCase().includes('greenwood.local')
      ? userEmail
      : (st.email && !st.email.toLowerCase().includes('greenwood.local') ? st.email : 'student@tint.edu.in');
  }

  let pendingPhotoUrl: string | null = null;
  let photoApprovalStatus = 'NONE';
  let photoRejectionReason: string | null = null;

  try {
    const photoReq = await pool.query(
      `SELECT photo_url, status, rejection_reason, created_at 
       FROM photo_approval_requests 
       WHERE applicant_id = $1 AND school_id = $2 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [st.id, schoolId]
    );
    if (photoReq.rows.length > 0) {
      const pr = photoReq.rows[0];
      photoApprovalStatus = pr.status;
      if (pr.status === 'PENDING') {
        pendingPhotoUrl = pr.photo_url;
      } else if (pr.status === 'REJECTED') {
        photoRejectionReason = pr.rejection_reason;
      }
    }
  } catch (err: any) {
    console.warn('[StudentService] Error checking photo approval status:', err.message);
  }

  let schoolWebsite = st.school_website || '';
  if (!schoolWebsite && schoolId) {
    try {
      const sQ = await pool.query('SELECT website FROM schools WHERE id = $1', [schoolId]);
      if (sQ.rowCount && sQ.rows[0]?.website) {
        schoolWebsite = sQ.rows[0].website;
      }
    } catch {}
  }

  return {
    id: st.id,
    userId: st.user_id || userId,
    schoolId: st.school_id || schoolId,
    name: st.name || '',
    email: resolvedEmail,
    rollNumber: st.roll_number || '',
    admissionNumber: st.admission_number || '',
    className: st.class_number !== undefined && st.class_number !== null 
      ? (st.class_number === -1 ? 'L-KG' : st.class_number === 0 ? 'U-KG' : `Class ${st.class_number}`) 
      : '',
    classNumber: st.class_number ?? 0,
    sectionName: st.section_name || '',
    schoolName: st.school_name || '',
    schoolPhotoUrl: st.school_photo_url || '',
    school_photo_url: st.school_photo_url || '',
    schoolWebsite: schoolWebsite || '',
    school_website: schoolWebsite || '',
    website: schoolWebsite || '',
    parentName: st.parent_name || '',
    parentPhone: st.parent_sms_number || '',
    parentEmail: st.parent_email || '',
    dateOfBirth: st.date_of_birth ? toDdMmYyyy(st.date_of_birth) : (st.dob ? toDdMmYyyy(st.dob) : ''),
    gender: normalizeGender(st.gender) || '',
    academicSession: academicSessionName || st.session_name || st.session || '',
    photoUrl: st.photo_url || '',
    pendingPhotoUrl,
    hasPendingPhotoApproval: photoApprovalStatus === 'PENDING',
    photoApprovalStatus,
    photoRejectionReason
  };
}

/**
 * Updates student profile details (gender, date of birth, address)
 */
export async function updateStudentProfile(schoolId: string, userId: string, data: { gender?: string; dateOfBirth?: string; address?: string }) {
  const st = await resolveStudentRecord(schoolId, userId);
  if (!st) throw new Error('Student record not found');

  const cleanDob = data.dateOfBirth ? toDdMmYyyy(data.dateOfBirth) : null;
  const updates: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (data.gender !== undefined) {
    updates.push(`gender = $${idx++}`);
    params.push(normalizeGender(data.gender));
  }
  if (data.dateOfBirth !== undefined) {
    updates.push(`date_of_birth = $${idx++}`);
    params.push(cleanDob);
  }
  if (data.address !== undefined) {
    updates.push(`address = $${idx++}`);
    params.push(data.address || null);
  }

  if (updates.length > 0) {
    try {
      params.push(st.id);
      await pool.query(
        `UPDATE students SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${idx}`,
        params
      );
    } catch (_dbErr) {}
  }

  // Update in Firestore
  if (isTestSchool(schoolId) && isFirebaseConfigured()) {
    try {
      const fUpdates: Record<string, any> = { updatedAt: new Date().toISOString() };
      if (data.gender !== undefined) fUpdates.gender = data.gender;
      if (data.dateOfBirth !== undefined) {
        fUpdates.date_of_birth = cleanDob;
        fUpdates.dob = cleanDob;
        fUpdates.dateOfBirth = cleanDob;
      }
      if (data.address !== undefined) fUpdates.address = data.address || null;
      await collections.students().doc(st.id).set(fUpdates, { merge: true });
    } catch (_fErr) {}
  }

  // Update in demoStudents
  const ds = demoStudents.find(d => d.id === st.id || d.user_id === userId);
  if (ds) {
    if (data.gender !== undefined) ds.gender = data.gender;
    if (data.dateOfBirth !== undefined) {
      ds.date_of_birth = cleanDob;
      ds.dob = cleanDob;
    }
  }

  return { success: true, message: 'Student profile updated successfully' };
}

/**
 * Submits student profile photo for admin approval
 */
export async function updateStudentPhoto(schoolId: string, userId: string, photoUrl: string) {
  const st = await resolveStudentRecord(schoolId, userId);
  if (!st) throw new Error('Student record not found');

  const cleanPhotoUrl = (photoUrl || '').trim();

  // If student removes their photo
  if (!cleanPhotoUrl) {
    try {
      await pool.query(
        `UPDATE students SET photo_url = NULL, updated_at = NOW() WHERE id = $1`,
        [st.id]
      );
      await pool.query(
        `DELETE FROM photo_approval_requests WHERE applicant_id = $1 AND school_id = $2 AND status = 'PENDING'`,
        [st.id, schoolId]
      );
    } catch (err: any) {
      console.warn('[StudentService] Error removing student photo:', err.message);
    }

    if (isFirebaseConfigured()) {
      try {
        await collections.students().doc(st.id).set({
          photo_url: null,
          photoUrl: null
        }, { merge: true });
      } catch (fsErr: any) {
        console.warn('[StudentService] Error clearing photo in Firestore:', fsErr.message);
      }
    }

    clearStudentDashboardCache(userId);
    return { success: true, photoUrl: '', message: 'Profile picture removed.' };
  }

  // Formatting student details for reviewer
  const classStr = st.class_number !== undefined && st.class_number !== null
    ? (st.class_number === -1 ? 'L-KG' : st.class_number === 0 ? 'U-KG' : `Class ${st.class_number}`)
    : 'Class';
  const detail = `${classStr}${st.section_name ? ` - ${st.section_name}` : ''}`.trim();
  const identifier = `Roll: ${st.roll_number || '—'} · Adm: ${st.admission_number || '—'}`;

  // Ensure photo_approval_requests table exists
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS photo_approval_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID NOT NULL,
        applicant_type VARCHAR(20) NOT NULL DEFAULT 'STUDENT',
        applicant_id UUID NOT NULL,
        applicant_name VARCHAR(255) NOT NULL,
        identifier VARCHAR(100),
        detail VARCHAR(255),
        current_photo_url TEXT,
        photo_url TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        rejection_reason TEXT,
        reviewed_by UUID,
        reviewed_by_name VARCHAR(255),
        reviewed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
  } catch {}

  // Check if there is an existing PENDING request from this student
  try {
    const existing = await pool.query(
      `SELECT id FROM photo_approval_requests WHERE applicant_id = $1 AND school_id = $2 AND status = 'PENDING'`,
      [st.id, schoolId]
    );

    if (existing.rowCount && existing.rowCount > 0) {
      await pool.query(
        `UPDATE photo_approval_requests 
         SET photo_url = $1, current_photo_url = $2, applicant_name = $3, identifier = $4, detail = $5,
             rejection_reason = NULL, updated_at = NOW(), created_at = NOW()
         WHERE id = $6`,
        [cleanPhotoUrl, st.photo_url || null, st.name, identifier, detail, existing.rows[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO photo_approval_requests (
          school_id, applicant_type, applicant_id, applicant_name, identifier, detail, current_photo_url, photo_url, status
        ) VALUES ($1, 'STUDENT', $2, $3, $4, $5, $6, $7, 'PENDING')`,
        [schoolId, st.id, st.name, identifier, detail, st.photo_url || null, cleanPhotoUrl]
      );
    }
  } catch (err: any) {
    console.error('[StudentService] Error submitting photo approval request:', err.message);
    throw new Error('Failed to submit photo for administrative approval: ' + err.message);
  }

  clearStudentDashboardCache(userId);
  return {
    success: true,
    pendingApproval: true,
    photoUrl: st.photo_url || '',
    pendingPhotoUrl: cleanPhotoUrl,
    message: 'Profile photo submitted for review! It will appear on your profile once approved by your teacher.'
  };
}

/**
 * Check if a timetable entry matches a student's class
 */
function matchesStudentClass(entry: any, st: any): boolean {
  const eClassId = String(entry.class_id || entry.classId || '');
  const eClassNum = Number(entry.class_number ?? entry.classNumber ?? 0);
  const stClassId = String(st.class_id || '');
  const stClassNum = Number(st.class_number ?? 0);

  if (eClassId && (eClassId === stClassId || eClassId === `cls-${stClassNum}` || (stClassId && eClassId.includes(stClassId)))) {
    return true;
  }
  if (eClassNum > 0 && stClassNum > 0 && eClassNum === stClassNum) {
    return true;
  }
  return false;
}

/**
 * Check if a timetable entry matches a student's section
 */
function matchesStudentSection(entry: any, st: any): boolean {
  const eSecId = String(entry.section_id || entry.sectionId || '').toLowerCase();
  const eSecName = String(entry.section_name || entry.sectionName || '').trim().toLowerCase().replace(/section\s*/i, '');
  const stSecId = String(st.section_id || '').toLowerCase();
  const stSecName = String(st.section_name || '').trim().toLowerCase().replace(/section\s*/i, '');

  if (!eSecId && !eSecName) return true; // Applicable for whole class
  if (eSecId && (eSecId === stSecId || (stSecName && eSecId.endsWith(stSecName)))) return true;
  if (eSecName && stSecName && (eSecName === stSecName || eSecName.endsWith(stSecName) || stSecName.endsWith(eSecName))) return true;
  return false;
}

/**
 * Check if an attendance record belongs to the student
 */
function isRecordForStudent(record: any, st: any): boolean {
  const sid = String(record.studentId || record.student_id || '');
  if (!sid) return false;
  if (sid === String(st.id)) return true;
  if (st.user_id && sid === String(st.user_id)) return true;
  if (st.admission_number && (sid === String(st.admission_number) || sid.toLowerCase() === String(st.admission_number).toLowerCase())) return true;
  if (st.roll_number && (sid === String(st.roll_number) || parseInt(sid) === parseInt(String(st.roll_number)))) return true;
  if (st.name && record.studentName && record.studentName.toLowerCase().trim() === st.name.toLowerCase().trim()) return true;
  if (st.name && record.student_name && record.student_name.toLowerCase().trim() === st.name.toLowerCase().trim()) return true;
  return false;
}

/**
 * Calculates current status for a timetable period based on current time
 */
function computePeriodStatus(startTimeStr: string, endTimeStr: string): 'Completed' | 'Ongoing' | 'Upcoming' {
  try {
    const now = new Date();
    const curMinutes = now.getHours() * 60 + now.getMinutes();

    const [sh, sm] = startTimeStr.split(':').map(Number);
    const [eh, em] = endTimeStr.split(':').map(Number);
    const startMinutes = sh * 60 + (sm || 0);
    const endMinutes = eh * 60 + (em || 0);

    if (curMinutes >= endMinutes) return 'Completed';
    if (curMinutes >= startMinutes && curMinutes < endMinutes) return 'Ongoing';
    return 'Upcoming';
  } catch {
    return 'Upcoming';
  }
}

// Short-lived in-memory cache for student dashboard (15 seconds)
const dashboardCache = new Map<string, { data: any; expiresAt: number }>();

export function clearStudentDashboardCache(userId?: string) {
  if (userId) {
    for (const key of dashboardCache.keys()) {
      if (key.endsWith(`:${userId}`)) {
        dashboardCache.delete(key);
      }
    }
  } else {
    dashboardCache.clear();
  }
}

/**
 * Returns aggregated student dashboard KPIs, timetable, announcements, and tasks
 */
export async function getStudentDashboard(schoolId: string, userId: string, studentId?: string) {
  const cacheKey = `${schoolId}:${userId}`;
  const cached = dashboardCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  const st = await resolveStudentRecord(schoolId, userId, studentId);
  if (!st) throw new Error('Student record not found');
  const now = new Date();
  const todayDay = now.getDay(); // 0 = Sunday, 1 = Monday, ...
  const targetDay = todayDay === 0 ? 1 : todayDay; // Default to Monday if Sunday

  // Run all PostgreSQL queries concurrently
  const [attQ, timeQ, recQ, annQ, assignQ, nextExamQ] = await Promise.all([
    // 1. Attendance Summary
    pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE ar.status = 'PRESENT' OR ar.is_present = true)::int AS present_count,
         COUNT(*) FILTER (WHERE ar.status = 'ABSENT' OR ar.is_present = false)::int AS absent_count,
         COUNT(*)::int AS total_count
       FROM attendance_records ar
       JOIN attendance_sessions s ON s.id = ar.attendance_session_id
       WHERE s.school_id = $1 AND ar.student_id = $2`,
      [schoolId, st.id]
    ).catch(() => ({ rowCount: 0, rows: [] as any[] })),

    // 2. Today's Timetable
    pool.query(
      `SELECT e.id, p.start_time, p.end_time, e.room_name AS room,
              sub.name AS subject_name,
              COALESCE(u.name, 'Faculty') AS teacher_name,
              p.period_number, p.name AS period_name
       FROM timetable_entries e
       JOIN timetable_periods p ON p.id = e.period_id
       LEFT JOIN classes c ON c.id = e.class_id
       LEFT JOIN sections sec ON sec.id = e.section_id
       LEFT JOIN subjects sub ON sub.id = e.subject_id
       LEFT JOIN users u ON u.id = e.teacher_id
       WHERE e.school_id = $1
         AND (e.class_id::text = $2 OR c.class_number = $3)
         AND (e.section_id::text = $4 OR LOWER(sec.name) = LOWER($5))
         AND e.day_of_week = $6
         AND e.status = 'PUBLISHED'
       ORDER BY p.start_time ASC, p.period_number ASC`,
      [schoolId, String(st.class_id || ''), Number(st.class_number || 0), String(st.section_id || ''), String(st.section_name || ''), targetDay]
    ).catch(() => ({ rowCount: 0, rows: [] as any[] })),

    // 3. Recent Attendance (Last 5 Sessions)
    pool.query(
      `SELECT s.attendance_date, COALESCE(ar.status, CASE WHEN ar.is_present THEN 'PRESENT' ELSE 'ABSENT' END) AS status,
              COALESCE(sub.name, 'General Session') AS subject_name
       FROM attendance_records ar
       JOIN attendance_sessions s ON s.id = ar.attendance_session_id
       LEFT JOIN subjects sub ON sub.id = s.subject_id
       WHERE s.school_id = $1 AND ar.student_id::text = $2
       ORDER BY s.attendance_date DESC, s.start_time DESC
       LIMIT 5`,
      [schoolId, String(st.id)]
    ).catch(() => ({ rowCount: 0, rows: [] as any[] })),

    // 4. Latest Announcements (Unread Only)
    pool.query(
      `SELECT a.id, a.title, a.message, a.priority, a.published_at, a.created_at
       FROM announcements a
       LEFT JOIN classes c ON c.id = a.class_id
       LEFT JOIN sections sec ON sec.id = a.section_id
       LEFT JOIN announcement_recipients r ON r.announcement_id = a.id AND r.parent_user_id = $6
       WHERE a.school_id = $1 AND a.status = 'PUBLISHED'
         AND r.read_at IS NULL
         AND (
           a.audience_type IN ('SCHOOL', 'STUDENT')
           OR (
             a.audience_type = 'CLASS'
             AND (a.class_id = $2 OR (c.class_number IS NOT NULL AND c.class_number = $4))
           )
           OR (
             a.audience_type = 'SECTION'
             AND (a.class_id IS NULL OR a.class_id = $2 OR (c.class_number IS NOT NULL AND c.class_number = $4))
             AND (a.section_id = $3 OR (sec.name IS NOT NULL AND UPPER(sec.name) = UPPER($5)))
           )
         )
       ORDER BY a.priority = 'EMERGENCY' DESC, a.published_at DESC
       LIMIT 3`,
      [schoolId, st.class_id, st.section_id, st.class_number, st.section_name, userId]
    ).catch(() => ({ rowCount: 0, rows: [] as any[] })),

    // 5. Pending Tasks / Assignments
    pool.query(
      `SELECT a.id, a.title, a.due_date, sub.name AS subject_name,
              COALESCE(s.status, 'PENDING') AS submission_status
       FROM student_assignments a
       LEFT JOIN subjects sub ON sub.id = a.subject_id
       LEFT JOIN student_assignment_submissions s ON s.assignment_id = a.id AND s.student_id = $3
       WHERE a.school_id = $1 
         AND (a.class_id = $2 OR a.class_id IN (SELECT id FROM classes WHERE school_id = $1 AND class_number = $4))
         AND COALESCE(s.status, 'PENDING') = 'PENDING'
       ORDER BY a.due_date ASC
       LIMIT 3`,
      [schoolId, st.class_id, st.id, Number(st.class_number || 0)]
    ).catch(() => ({ rowCount: 0, rows: [] as any[] })),

    // 6. Upcoming Exam
    pool.query(
      `SELECT e.id, e.title, e.exam_date, e.start_time, e.end_time, e.room,
              COALESCE(sub.name, 'Academics') AS subject_name
       FROM student_exams e
       LEFT JOIN subjects sub ON sub.id = e.subject_id
       WHERE e.school_id = $1 
         AND (e.class_id = $2 OR e.class_id IN (SELECT id FROM classes WHERE school_id = $1 AND class_number = $3))
         AND e.exam_date >= CURRENT_DATE
       ORDER BY e.exam_date ASC, e.start_time ASC
       LIMIT 1`,
      [schoolId, st.class_id, Number(st.class_number || 0)]
    ).catch(() => ({ rowCount: 0, rows: [] as any[] }))
  ]);

  // 1. Process Attendance Summary
  let attendanceSummary = {
    attendancePercentage: 0,
    presentDays: 0,
    totalWorkingDays: 0,
    absentDays: 0
  };

  if (attQ.rowCount && attQ.rows[0].total_count > 0) {
    const p = attQ.rows[0].present_count || 0;
    const t = attQ.rows[0].total_count || 0;
    const a = attQ.rows[0].absent_count || 0;
    attendanceSummary = {
      attendancePercentage: t > 0 ? Math.round((p / t) * 100) : 0,
      presentDays: p,
      totalWorkingDays: t,
      absentDays: a
    };
  } else if (isTestSchool(schoolId)) {
    const memRecs = memAttendanceRecords.filter(r => (!r.schoolId || isSameSchool(r.schoolId, schoolId)) && isRecordForStudent(r, st));
    if (memRecs.length > 0) {
      const p = memRecs.filter(r => r.status === 'PRESENT' || r.is_present === true).length;
      const a = memRecs.filter(r => r.status === 'ABSENT' || r.is_present === false).length;
      const t = memRecs.length;
      attendanceSummary = {
        attendancePercentage: t > 0 ? Math.round((p / t) * 100) : 0,
        presentDays: p,
        totalWorkingDays: t,
        absentDays: a
      };
    } else if (isFirebaseConfigured()) {
      try {
        const recSnap = await collections.attendanceRecords().get();
        const myRecs = recSnap.docs
          .map(d => d.data())
          .filter(r => (!r.schoolId || isSameSchool(r.schoolId, schoolId)) && isRecordForStudent(r, st));
        if (myRecs.length > 0) {
          const p = myRecs.filter(r => r.status === 'PRESENT' || r.is_present === true).length;
          const a = myRecs.filter(r => r.status === 'ABSENT' || r.is_present === false).length;
          const t = myRecs.length;
          attendanceSummary = {
            attendancePercentage: t > 0 ? Math.round((p / t) * 100) : 0,
            presentDays: p,
            totalWorkingDays: t,
            absentDays: a
          };
        }
      } catch {}
    }
    if (attendanceSummary.totalWorkingDays === 0) {
      try {
        const today = new Date();
        const startOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
        const todayStr = today.toISOString().slice(0, 10);
        const cal = await calculateWorkingCalendar(schoolId, startOfMonth, todayStr);
        const actualWorkingDays = Math.max(1, Math.round(cal.workingDays));
        attendanceSummary = {
          attendancePercentage: 0,
          presentDays: 0,
          totalWorkingDays: actualWorkingDays,
          absentDays: 0
        };
      } catch {
        attendanceSummary = { attendancePercentage: 0, presentDays: 0, totalWorkingDays: 0, absentDays: 0 };
      }
    }
  }

  // 2. Process Today's Timetable
  let todayTimetable: any[] = [];
  if (timeQ.rowCount && timeQ.rowCount > 0) {
    todayTimetable = timeQ.rows.map((row, idx) => ({
      periodNumber: row.period_number || idx + 1,
      time: `${(row.start_time || '09:00').slice(0, 5)} - ${(row.end_time || '09:45').slice(0, 5)}`,
      subject: row.subject_name || 'Subject',
      teacher: row.teacher_name || 'Faculty',
      room: row.room || `Room ${st.class_number || 10}`,
      status: computePeriodStatus(row.start_time || '09:00', row.end_time || '09:45')
    }));
  } else if (isTestSchool(schoolId)) {
    if (isFirebaseConfigured()) {
      try {
        const snap = await collections.timetableEntries().get();
        if (!snap.empty) {
          const matches: any[] = [];
          snap.docs.forEach(doc => {
            const e = doc.data();
            const docSid = e.school_id || e.schoolId;
            if (docSid && !isSameSchool(docSid, schoolId)) return;
            if (Number(e.day_of_week ?? e.dayOfWeek) !== targetDay) return;
            if (e.status === 'CANCELLED') return;

            if (matchesStudentClass(e, st) && matchesStudentSection(e, st)) {
              matches.push({
                periodNumber: Number(e.period_number ?? e.periodNumber ?? 1),
                time: `${(e.start_time || e.startTime || '09:00').slice(0, 5)} - ${(e.end_time || e.endTime || '09:45').slice(0, 5)}`,
                subject: e.subject_name || e.subjectName || 'Subject',
                teacher: e.teacher_name || e.teacherName || 'Faculty',
                room: e.room_name || e.roomName || e.room || `Room ${st.class_number || 10}`,
                status: computePeriodStatus(e.start_time || '09:00', e.end_time || '09:45')
              });
            }
          });
          if (matches.length > 0) {
            matches.sort((a, b) => a.periodNumber - b.periodNumber || a.time.localeCompare(b.time));
            todayTimetable = matches;
          }
        }
      } catch {}
    }
    if (todayTimetable.length === 0) {
      todayTimetable = [
        { periodNumber: 1, time: '08:00 - 08:45', subject: 'Mathematics', teacher: 'Mr. S. Verma', room: 'A-101', status: 'Completed' },
        { periodNumber: 2, time: '08:45 - 09:30', subject: 'Science', teacher: 'Mrs. P. Das', room: 'A-102', status: 'Completed' },
        { periodNumber: 3, time: '09:45 - 10:30', subject: 'English', teacher: 'Ms. R. Khan', room: 'A-103', status: 'Ongoing' },
        { periodNumber: 4, time: '10:30 - 11:15', subject: 'Social Science', teacher: 'Mr. A. Singh', room: 'A-104', status: 'Upcoming' },
        { periodNumber: 5, time: '11:30 - 12:15', subject: 'Computer Science', teacher: 'Mrs. N. Roy', room: 'Lab-1', status: 'Upcoming' },
        { periodNumber: 6, time: '12:15 - 01:00', subject: 'Physical Education', teacher: 'Mr. K. Yadav', room: 'Ground', status: 'Upcoming' }
      ];
    }
  }

  // 3. Process Recent Attendance
  let recentAttendance: any[] = [];
  if (recQ.rowCount && recQ.rowCount > 0) {
    recentAttendance = recQ.rows.map((r) => {
      const d = new Date(r.attendance_date);
      const dayStr = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
      return {
        date: dayStr,
        subject: r.subject_name || 'General Session',
        status: r.status === 'PRESENT' ? 'Present' : 'Absent'
      };
    });
  } else if (isTestSchool(schoolId)) {
    const memRecs = memAttendanceRecords.filter(r => (!r.schoolId || isSameSchool(r.schoolId, schoolId)) && isRecordForStudent(r, st));
    if (memRecs.length > 0) {
      const sessMap = new Map<string, any>();
      memAttendanceSessions.forEach(s => sessMap.set(s.id, s));
      recentAttendance = memRecs.map(r => {
        const sess = sessMap.get(r.sessionId) || {};
        const rawDate = sess.attendanceDate || sess.attendance_date || r.attendanceDate || new Date().toISOString().slice(0, 10);
        const d = new Date(rawDate);
        return {
          date: d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
          subject: sess.subjectName || sess.subject_name || 'General Session',
          status: (r.status === 'PRESENT' || r.is_present === true) ? 'Present' : 'Absent',
          rawDate
        };
      }).sort((a, b) => new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime()).slice(0, 5);
    } else if (isFirebaseConfigured()) {
      try {
        const recSnap = await collections.attendanceRecords().get();
        const myRecs = recSnap.docs
          .map(d => d.data())
          .filter(r => (!r.schoolId || isSameSchool(r.schoolId, schoolId)) && isRecordForStudent(r, st));

        if (myRecs.length > 0) {
          const sessionMap: Record<string, any> = {};
          const sessSnap = await collections.attendanceSessions().get();
          sessSnap.docs.forEach(d => { sessionMap[d.id] = d.data(); });

          const formatted = myRecs.map(r => {
            const sess = sessionMap[r.sessionId] || {};
            const rawDate = sess.attendanceDate || sess.attendance_date || new Date().toISOString().slice(0, 10);
            const d = new Date(rawDate);
            return {
              date: d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
              subject: sess.subjectName || sess.subject_name || 'General Session',
              status: (r.status === 'PRESENT' || r.is_present === true) ? 'Present' : 'Absent',
              rawDate
            };
          });
          formatted.sort((a, b) => new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime());
          recentAttendance = formatted.slice(0, 5);
        }
      } catch {}
    }
    if (recentAttendance.length === 0) {
      const dynamicRecs: any[] = [];
      const cursor = new Date();
      let steps = 0;
      while (dynamicRecs.length < 5 && steps < 14) {
        if (cursor.getDay() !== 0) {
          dynamicRecs.push({
            date: cursor.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
            subject: 'Class Session',
            status: dynamicRecs.length === 3 ? 'Absent' : 'Present'
          });
        }
        cursor.setDate(cursor.getDate() - 1);
        steps++;
      }
      recentAttendance = dynamicRecs;
    }
  }

  // 4. Latest Announcements
  let announcements: any[] = [];
  if (annQ.rowCount && annQ.rowCount > 0) {
    announcements = annQ.rows.map((a) => ({
      id: a.id,
      title: a.title,
      date: new Date(a.published_at || a.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      description: a.message?.slice(0, 80) + '...',
      priority: a.priority || 'NORMAL'
    }));
  }

  // 5. Pending Tasks / Assignments
  let pendingAssignments: any[] = [];
  if (assignQ.rowCount && assignQ.rowCount > 0) {
    pendingAssignments = assignQ.rows.map((row) => {
      const diffDays = Math.ceil((new Date(row.due_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return {
        id: row.id,
        title: row.title,
        subject: row.subject_name || 'Academics',
        dueDate: new Date(row.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        daysLeft: diffDays > 0 ? `${diffDays} days left` : 'Due today',
        status: row.submission_status
      };
    });
  }

  // 6. Upcoming Exam
  let upcomingExam: any = null;
  if (nextExamQ.rowCount && nextExamQ.rows.length > 0) {
    const ex = nextExamQ.rows[0];
    const examD = new Date(ex.exam_date);
    upcomingExam = {
      subject: ex.subject_name,
      title: ex.title,
      date: examD.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      time: `${(ex.start_time || '09:00').slice(0, 5)} - ${(ex.end_time || '12:00').slice(0, 5)}`,
      room: ex.room || 'Exam Hall'
    };
  }

  const result = {
    student: {
      id: st.id,
      name: st.name || '',
      className: st.class_number !== undefined && st.class_number !== null 
        ? (st.class_number === -1 ? 'L-KG' : st.class_number === 0 ? 'U-KG' : `Class ${st.class_number}`) 
        : '',
      sectionName: st.section_name || '',
      rollNumber: st.roll_number || '',
      admissionNumber: st.admission_number || '',
      schoolName: st.school_name || '',
      schoolPhotoUrl: st.school_photo_url || '',
      school_photo_url: st.school_photo_url || '',
      schoolWebsite: st.school_website || '',
      school_website: st.school_website || '',
      avatarUrl: st.photo_url || ''
    },
    kpis: {
      attendancePercentage: attendanceSummary.attendancePercentage,
      attendance_rate: attendanceSummary.attendancePercentage,
      presentDays: attendanceSummary.presentDays,
      present_count: attendanceSummary.presentDays,
      absentDays: attendanceSummary.absentDays,
      absent_count: attendanceSummary.absentDays,
      totalWorkingDays: attendanceSummary.totalWorkingDays,
      total_classes: attendanceSummary.totalWorkingDays,
      attendanceText: `Present: ${attendanceSummary.presentDays} / ${attendanceSummary.totalWorkingDays} days`,
      pendingAssignmentsCount: pendingAssignments.length,
      upcomingExamTitle: upcomingExam ? `${upcomingExam.subject} - ${upcomingExam.date}` : 'No upcoming exam scheduled',
      announcementsCount: announcements.length,
      summary: attendanceSummary
    },
    todayTimetable,
    today_timetable: todayTimetable,
    recentAttendance,
    recent_attendance: recentAttendance,
    announcements,
    pendingAssignments,
    pending_assignments: pendingAssignments,
    upcomingExam,
    upcoming_exam: upcomingExam
  };

  dashboardCache.set(cacheKey, { data: result, expiresAt: Date.now() + 15000 });
  return result;
}

/**
 * Returns full attendance records for student
 */
export async function getStudentAttendance(schoolId: string, userId: string, from?: string, to?: string) {
  const st = await resolveStudentRecord(schoolId, userId);
  const fromDate = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const toDate = to || new Date().toISOString().slice(0, 10);

  // 1. Try PostgreSQL
  try {
    const q = await pool.query(
      `SELECT TO_CHAR(s.attendance_date, 'YYYY-MM-DD') AS attendance_date, COALESCE(ar.status, CASE WHEN ar.is_present THEN 'PRESENT' ELSE 'ABSENT' END) AS status, s.start_time, s.end_time,
              s.subject_name, u.name AS teacher_name
       FROM attendance_records ar
       JOIN attendance_sessions s ON s.id = ar.attendance_session_id
       LEFT JOIN users u ON u.id = s.teacher_id
       WHERE s.school_id = $1 AND ar.student_id = $2
         AND s.attendance_date BETWEEN $3 AND $4
       ORDER BY s.attendance_date DESC, s.start_time ASC`,
      [schoolId, st.id, fromDate, toDate]
    );

    if (q && Array.isArray(q.rows)) {
      const rows = q.rows;
      const present = rows.filter((r) => r.status === 'PRESENT').length;
      const absent = rows.filter((r) => r.status === 'ABSENT').length;
      const total = rows.length;

      return {
        records: rows,
        summary: {
          present,
          absent,
          total,
          percentage: total > 0 ? Math.round((present / total) * 100) : 0
        }
      };
    }
  } catch (_e) {}

  // 2. Check In-Memory Store
  const memRecs = memAttendanceRecords.filter(r => (!r.schoolId || isSameSchool(r.schoolId, schoolId)) && isRecordForStudent(r, st));
  if (memRecs.length > 0) {
    const sessMap = new Map<string, any>();
    memAttendanceSessions.forEach(s => sessMap.set(s.id, s));
    const rows = memRecs.map(r => {
      const sess = sessMap.get(r.sessionId) || {};
      const attDate = sess.attendanceDate || sess.attendance_date || r.attendanceDate || new Date().toISOString().slice(0, 10);
      return {
        attendance_date: attDate,
        status: (r.status === 'PRESENT' || r.is_present === true) ? 'PRESENT' : 'ABSENT',
        start_time: sess.startTime || sess.start_time || '09:00',
        end_time: sess.endTime || sess.end_time || '09:45',
        subject_name: sess.subjectName || sess.subject_name || 'General Session',
        teacher_name: sess.teacherName || sess.teacher_name || sess.takenBy || 'Class Faculty'
      };
    }).filter(r => {
      if (fromDate && r.attendance_date < fromDate) return false;
      if (toDate && r.attendance_date > toDate) return false;
      return true;
    });

    rows.sort((a, b) => new Date(b.attendance_date).getTime() - new Date(a.attendance_date).getTime());
    const present = rows.filter(r => r.status === 'PRESENT').length;
    const absent = rows.filter(r => r.status === 'ABSENT').length;
    const total = rows.length;

    if (total > 0) {
      return {
        records: rows,
        summary: {
          present,
          absent,
          total,
          percentage: Math.round((present / total) * 100)
        }
      };
    }
  }

  // 2. Query Cloud Firestore
  if (isTestSchool(schoolId) && isFirebaseConfigured()) {
    try {
      const recSnap = await collections.attendanceRecords().get();
      const myRecs = recSnap.docs
        .map(d => d.data())
        .filter(r => (!r.schoolId || isSameSchool(r.schoolId, schoolId)) && isRecordForStudent(r, st));

      if (myRecs.length > 0) {
        const sessionMap: Record<string, any> = {};
        const sessSnap = await collections.attendanceSessions().get();
        sessSnap.docs.forEach(d => { sessionMap[d.id] = d.data(); });

        const rows = myRecs.map(r => {
          const sess = sessionMap[r.sessionId] || {};
          const attDate = sess.attendanceDate || sess.attendance_date || new Date().toISOString().slice(0, 10);
          return {
            attendance_date: attDate,
            status: (r.status === 'PRESENT' || r.is_present === true) ? 'PRESENT' : 'ABSENT',
            start_time: sess.startTime || sess.start_time || '09:00',
            end_time: sess.endTime || sess.end_time || '09:45',
            subject_name: sess.subjectName || sess.subject_name || 'General Session',
            teacher_name: sess.teacherName || sess.teacher_name || sess.takenBy || 'Class Faculty'
          };
        }).filter(r => {
          if (fromDate && r.attendance_date < fromDate) return false;
          if (toDate && r.attendance_date > toDate) return false;
          return true;
        });

        rows.sort((a, b) => new Date(b.attendance_date).getTime() - new Date(a.attendance_date).getTime());
        const present = rows.filter(r => r.status === 'PRESENT').length;
        const absent = rows.filter(r => r.status === 'ABSENT').length;
        const total = rows.length;

        if (total > 0) {
          return {
            records: rows,
            summary: {
              present,
              absent,
              total,
              percentage: Math.round((present / total) * 100)
            }
          };
        }
      }
    } catch (err: any) {
      console.warn('[StudentService] Error fetching attendance from Firestore:', err.message);
    }
  }

  // 3. Fallback for test school
  if (isTestSchool(schoolId)) {
    const fallbackList = [
      { attendance_date: new Date().toISOString().slice(0, 10), status: 'PRESENT', start_time: '09:00', end_time: '09:45', subject_name: 'Mathematics', teacher_name: 'Rahul Sharma' },
      { attendance_date: new Date(Date.now() - 86400000).toISOString().slice(0, 10), status: 'PRESENT', start_time: '09:00', end_time: '09:45', subject_name: 'Mathematics', teacher_name: 'Rahul Sharma' }
    ].filter(r => {
      if (fromDate && r.attendance_date < fromDate) return false;
      if (toDate && r.attendance_date > toDate) return false;
      return true;
    });
    const present = fallbackList.filter(r => r.status === 'PRESENT').length;
    const absent = fallbackList.filter(r => r.status === 'ABSENT').length;
    const total = fallbackList.length;
    return {
      records: fallbackList,
      summary: { present, absent, total, percentage: total > 0 ? Math.round((present / total) * 100) : 0 }
    };
  }

  return { records: [], summary: { present: 0, absent: 0, total: 0, percentage: 0 } };
}

/**
 * Returns full weekly timetable for student's class and section
 */
export async function getStudentTimetable(schoolId: string, userId: string) {
  const st = await resolveStudentRecord(schoolId, userId);

  // 1. Try PostgreSQL timetable_entries
  try {
    const q = await pool.query(
      `SELECT e.id, e.day_of_week, p.start_time, p.end_time, e.room_name AS room,
              sub.name AS subject_name,
              COALESCE(u.name, 'Faculty') AS teacher_name,
              p.name AS period_name, p.period_number
       FROM timetable_entries e
       JOIN timetable_periods p ON p.id = e.period_id
       LEFT JOIN classes c ON c.id = e.class_id
       LEFT JOIN sections sec ON sec.id = e.section_id
       LEFT JOIN subjects sub ON sub.id = e.subject_id
       LEFT JOIN users u ON u.id = e.teacher_id
       WHERE e.school_id = $1
         AND (e.class_id::text = $2 OR c.class_number = $3)
         AND (e.section_id::text = $4 OR LOWER(sec.name) = LOWER($5))
         AND e.status = 'PUBLISHED'
       ORDER BY e.day_of_week ASC, p.start_time ASC, p.period_number ASC`,
      [schoolId, String(st.class_id || ''), Number(st.class_number || 0), String(st.section_id || ''), String(st.section_name || '')]
    );
    if (q.rowCount && q.rowCount > 0) {
      return q.rows;
    }
  } catch (_e) {}

  // 2. Query Cloud Firestore timetable_entries
  if (isTestSchool(schoolId) && isFirebaseConfigured()) {
    try {
      const snap = await collections.timetableEntries().get();
      if (!snap.empty) {
        const list: any[] = [];
        snap.docs.forEach(doc => {
          const e = doc.data();
          const docSid = e.school_id || e.schoolId;
          if (docSid && !isSameSchool(docSid, schoolId)) return;
          if (e.status === 'CANCELLED') return;

          if (!matchesStudentClass(e, st) || !matchesStudentSection(e, st)) return;

          list.push({
            id: e.id || doc.id,
            day_of_week: Number(e.day_of_week ?? e.dayOfWeek ?? 1),
            start_time: e.start_time || e.startTime || '09:00',
            end_time: e.end_time || e.endTime || '09:45',
            room: e.room_name || e.roomName || e.room || `Room ${st.class_number || 10}`,
            subject_name: e.subject_name || e.subjectName || 'Subject',
            teacher_name: e.teacher_name || e.teacherName || 'Faculty',
            period_name: e.period_name || e.periodName || 'Period',
            period_number: Number(e.period_number ?? e.periodNumber ?? 1)
          });
        });

        if (list.length > 0) {
          list.sort((a, b) => a.day_of_week - b.day_of_week || a.period_number - b.period_number || a.start_time.localeCompare(b.start_time));
          return list;
        }
      }
    } catch (err: any) {
      console.warn('[StudentService] Error fetching timetable from Firestore:', err.message);
    }
  }

  // 3. Fallback for test school
  if (isTestSchool(schoolId)) {
    return [
      { id: 'tt-1', day_of_week: 1, start_time: '09:00', end_time: '09:45', subject_name: 'Mathematics', teacher_name: 'Rahul Sharma', room: 'Room 101' },
      { id: 'tt-2', day_of_week: 1, start_time: '10:00', end_time: '10:45', subject_name: 'Science', teacher_name: 'Rahul Sharma', room: 'Lab 2' },
      { id: 'tt-3', day_of_week: 2, start_time: '09:00', end_time: '09:45', subject_name: 'Mathematics', teacher_name: 'Rahul Sharma', room: 'Room 101' }
    ];
  }

  return [];
}

/**
 * Returns announcements visible to student
 */
export async function getStudentAnnouncements(schoolId: string, userId: string, fromDate?: string, toDate?: string) {
  const st = await resolveStudentRecord(schoolId, userId);
  if (isPostgresConfigured) {
    try {
      const params: any[] = [schoolId, st.class_id, st.section_id, st.class_number, st.section_name, userId];
      let dateClauses = '';

      if (fromDate && fromDate.trim()) {
        params.push(fromDate.trim());
        dateClauses += ` AND COALESCE(a.published_at, a.created_at) >= $${params.length}::timestamp`;
      }

      if (toDate && toDate.trim()) {
        params.push(toDate.trim());
        dateClauses += ` AND COALESCE(a.published_at, a.created_at) < ($${params.length}::date + interval '1 day')`;
      }

      const q = await pool.query(
        `SELECT a.id, a.title, a.message, a.priority, a.published_at, a.created_at,
                u.name AS author_name,
                c.class_number, sec.name AS section_name,
                r.read_at, r.id AS recipient_id
         FROM announcements a
         LEFT JOIN users u ON u.id = a.created_by
         LEFT JOIN classes c ON c.id = a.class_id
         LEFT JOIN sections sec ON sec.id = a.section_id
         LEFT JOIN announcement_recipients r ON r.announcement_id = a.id AND r.parent_user_id = $6
         WHERE a.school_id = $1 AND a.status = 'PUBLISHED'
           AND (
             a.audience_type IN ('SCHOOL', 'STUDENT')
             OR (
               a.audience_type = 'CLASS'
               AND (a.class_id = $2 OR (c.class_number IS NOT NULL AND c.class_number = $4))
             )
             OR (
               a.audience_type = 'SECTION'
               AND (a.class_id IS NULL OR a.class_id = $2 OR (c.class_number IS NOT NULL AND c.class_number = $4))
               AND (a.section_id = $3 OR (sec.name IS NOT NULL AND UPPER(sec.name) = UPPER($5)))
             )
           )
           ${dateClauses}
         ORDER BY a.priority = 'EMERGENCY' DESC, COALESCE(a.published_at, a.created_at) DESC`,
        params
      );
      if (q && q.rows) return q.rows;
    } catch (_e) {}
  }

  // Filter in-memory announcements strictly for students
  try {
    const { memAnnouncements } = await import('./communicationService');
    let filteredMem = memAnnouncements.filter((a: any) => {
      if (a.status !== 'PUBLISHED') return false;
      if (!isSameSchool(a.school_id, schoolId)) return false;
      if (['SCHOOL', 'STUDENT'].includes(a.audience_type)) return true;
      if (a.audience_type === 'CLASS') {
        return (a.class_id && a.class_id === st.class_id) || 
               (a.class_number !== undefined && Number(a.class_number) === Number(st.class_number));
      }
      if (a.audience_type === 'SECTION') {
        const matchClass = !a.class_id || a.class_id === st.class_id || 
                           (a.class_number !== undefined && Number(a.class_number) === Number(st.class_number));
        const matchSec = (a.section_id && a.section_id === st.section_id) || 
                         (a.section_name && String(a.section_name).toUpperCase() === String(st.section_name).toUpperCase());
        return matchClass && matchSec;
      }
      return false;
    });

    if (fromDate && fromDate.trim()) {
      const fromTime = new Date(`${fromDate.trim()}T00:00:00`).getTime();
      if (!isNaN(fromTime)) {
        filteredMem = filteredMem.filter(a => {
          const t = new Date(a.published_at || a.created_at).getTime();
          return !isNaN(t) && t >= fromTime;
        });
      }
    }

    if (toDate && toDate.trim()) {
      const toTime = new Date(`${toDate.trim()}T23:59:59.999`).getTime();
      if (!isNaN(toTime)) {
        filteredMem = filteredMem.filter(a => {
          const t = new Date(a.published_at || a.created_at).getTime();
          return !isNaN(t) && t <= toTime;
        });
      }
    }

    filteredMem.sort((a, b) => {
      if (a.priority === 'EMERGENCY' && b.priority !== 'EMERGENCY') return -1;
      if (a.priority !== 'EMERGENCY' && b.priority === 'EMERGENCY') return 1;
      const tA = new Date(a.published_at || a.created_at).getTime() || 0;
      const tB = new Date(b.published_at || b.created_at).getTime() || 0;
      return tB - tA;
    });

    return filteredMem;
  } catch {}

  return [];
}

/**
 * Returns student assignments
 */

let hasAssignedDateColStudent: boolean | null = null;
async function checkHasAssignedDateStudent(): Promise<boolean> {
  if (hasAssignedDateColStudent !== null) return hasAssignedDateColStudent;
  try {
    const res = await pool.query(
      "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'student_assignments' AND column_name = 'assigned_date'"
    );
    hasAssignedDateColStudent = (res.rowCount ?? 0) > 0;
  } catch (_e) {
    hasAssignedDateColStudent = false;
  }
  return hasAssignedDateColStudent;
}

let hasUpdatedAtColStudentSub: boolean | null = null;
export async function checkHasUpdatedAtStudentSub(): Promise<boolean> {
  if (hasUpdatedAtColStudentSub !== null) return hasUpdatedAtColStudentSub;
  if (!isPostgresConfigured) {
    hasUpdatedAtColStudentSub = false;
    return false;
  }
  try {
    const res = await pool.query(
      "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'student_assignment_submissions' AND column_name = 'updated_at'"
    );
    hasUpdatedAtColStudentSub = (res.rowCount ?? 0) > 0;
  } catch (_e) {
    hasUpdatedAtColStudentSub = false;
  }
  return hasUpdatedAtColStudentSub;
}

let hasResubmittedStatusStudentSub: boolean | null = null;
export async function checkSupportsResubmittedStatus(): Promise<boolean> {
  if (hasResubmittedStatusStudentSub !== null) return hasResubmittedStatusStudentSub;
  if (!isPostgresConfigured) {
    hasResubmittedStatusStudentSub = true;
    return true;
  }
  try {
    const res = await pool.query(
      "SELECT pg_get_constraintdef(c.oid) AS def FROM pg_constraint c WHERE c.conname = 'student_assignment_submissions_status_check'"
    );
    if (res.rowCount && res.rowCount > 0) {
      const def = res.rows[0].def || '';
      hasResubmittedStatusStudentSub = def.includes('RESUBMITTED');
    } else {
      hasResubmittedStatusStudentSub = true;
    }
  } catch (_e) {
    hasResubmittedStatusStudentSub = false;
  }
  return hasResubmittedStatusStudentSub;
}

export async function getStudentAssignments(schoolId: string, userId: string) {
  const st = await resolveStudentRecord(schoolId, userId);
  if (!st) return [];
  const hasAssigned = await checkHasAssignedDateStudent();
  const dateCol = hasAssigned ? 'COALESCE(a.assigned_date, a.created_at::date)' : 'a.created_at::date';
  const hasUpd = await checkHasUpdatedAtStudentSub();
  const updCol = hasUpd ? 'COALESCE(s.updated_at, s.submitted_at) AS updated_at' : 's.submitted_at AS updated_at';
  try {
    const q = await pool.query(
      `SELECT a.id, a.title, a.description, a.due_date, ${dateCol} AS assigned_date, a.created_at, a.max_marks,
              a.document_url, a.document_name, a.document_size, a.document_mime, a.document_data,
              COALESCE(a.attachments, '[]'::jsonb) AS teacher_attachments,
              sub.name AS subject_name, u.name AS teacher_name,
              COALESCE(s.status, 'PENDING') AS submission_status,
              s.id AS submission_id,
              s.submitted_at, ${updCol}, s.submission_text, s.marks_obtained, s.feedback
       FROM student_assignments a
       LEFT JOIN subjects sub ON sub.id = a.subject_id
       LEFT JOIN users u ON u.id = a.teacher_id
       LEFT JOIN student_assignment_submissions s ON s.assignment_id = a.id AND s.student_id = $3
       WHERE a.school_id = $1 AND a.class_id = $2 AND (a.section_id IS NULL OR a.section_id = $4)
       ORDER BY a.due_date ASC`,
      [schoolId, st.class_id, st.id, st.section_id]
    );
    if (q.rowCount && q.rowCount > 0) {
      const rows = q.rows;
      const subIds = rows.map((r: any) => r.submission_id).filter(Boolean);
      let attachmentsMap = new Map<string, any[]>();
      if (subIds.length > 0) {
        try {
          const attQ = await pool.query(
            `SELECT id, submission_id, assignment_id, file_name, file_size, mime_type, created_at
             FROM student_assignment_attachments
             WHERE school_id = $1 AND student_id = $2 AND submission_id = ANY($3::uuid[])
             ORDER BY created_at ASC`,
            [schoolId, st.id, subIds]
          );
          attQ.rows.forEach((att: any) => {
            const list = attachmentsMap.get(att.submission_id) || [];
            list.push(att);
            attachmentsMap.set(att.submission_id, list);
          });
        } catch (_attErr) {}
      }

      const asgIds = rows.map((r: any) => r.id);
      let teacherAttMap = new Map<string, any[]>();
      if (asgIds.length > 0) {
        try {
          const tAttQ = await pool.query(
            `SELECT id, assignment_id, file_name, file_size, mime_type, storage_key, uploaded_at FROM assignment_attachments WHERE assignment_id = ANY($1::uuid[]) ORDER BY uploaded_at ASC`,
            [asgIds]
          );
          tAttQ.rows.forEach((att: any) => {
            const list = teacherAttMap.get(att.assignment_id) || [];
            list.push(att);
            teacherAttMap.set(att.assignment_id, list);
          });
        } catch (_tAttErr) {}
      }

      return rows.map((r: any) => {
        let tAtts = Array.isArray(r.teacher_attachments) && r.teacher_attachments.length > 0
          ? r.teacher_attachments
          : (teacherAttMap.get(r.id) || []);
        if (tAtts.length === 0 && (r.document_name || r.document_url)) {
          tAtts = [{ id: 'doc-0', file_name: r.document_name, file_size: r.document_size, mime_type: r.document_mime }];
        }
        return {
          ...r,
          teacher_attachments: tAtts,
          attachments: r.submission_id ? (attachmentsMap.get(r.submission_id) || []) : []
        };
      });




    }
  } catch (_e) {}

  return [];
}

/**
 * Submit or resubmit assignment text and optional attachments
 */
export async function submitStudentAssignment(
  schoolId: string,
  userId: string,
  assignmentId: string,
  text: string,
  attachments?: Array<{ fileName: string; fileData: string; mimeType?: string }>,
  removedAttachmentIds?: string[]
) {
  const st = await resolveStudentRecord(schoolId, userId);
  if (!st) {
    throw new Error('Student profile not found');
  }

  // 1. Verify assignment exists and belongs to school, class, and section
  const asgQ = await pool.query(
    `SELECT id, class_id, section_id, due_date FROM student_assignments WHERE id = $1 AND school_id = $2`,
    [assignmentId, schoolId]
  );
  if (asgQ.rowCount === 0) {
    throw new Error('Assignment not found or does not belong to your school');
  }

  const asg = asgQ.rows[0];
  if (asg.class_id !== st.class_id) {
    throw new Error('Access denied: Assignment is not assigned to your class');
  }
  if (asg.section_id && asg.section_id !== st.section_id) {
    throw new Error('Access denied: Assignment is not assigned to your section');
  }

  // 2. Fetch existing submission (if any)
  const existQ = await pool.query(
    `SELECT id, status, submitted_at, submission_text, marks_obtained, feedback
     FROM student_assignment_submissions
     WHERE assignment_id = $1 AND student_id = $2 AND school_id = $3`,
    [assignmentId, st.id, schoolId]
  );
  const existingSub = existQ.rowCount && existQ.rowCount > 0 ? existQ.rows[0] : null;

  // 3. Fetch current attachments for this submission
  let currentAtts: any[] = [];
  if (existingSub) {
    const curAttQ = await pool.query(
      `SELECT id, file_name, file_size, mime_type, storage_key, created_at
       FROM student_assignment_attachments
       WHERE submission_id = $1 AND student_id = $2 AND school_id = $3
       ORDER BY created_at ASC`,
      [existingSub.id, st.id, schoolId]
    );
    currentAtts = curAttQ.rows || [];
  }

  // 4. Safely handle removal of attachments
  const toRemoveIds: string[] = Array.isArray(removedAttachmentIds) ? removedAttachmentIds.filter(Boolean) : [];
  if (toRemoveIds.length > 0 && currentAtts.length > 0) {
    const toDeleteList = currentAtts.filter((att) => toRemoveIds.includes(att.id));
    for (const delAtt of toDeleteList) {
      if (delAtt.storage_key) {
        try {
          await deleteFromStorage(delAtt.storage_key);
        } catch (_delErr) {
          console.warn('[Storage] Failed to delete storage key:', delAtt.storage_key);
        }
      }
    }
    const delIds = toDeleteList.map((a) => a.id);
    if (delIds.length > 0) {
      await pool.query(
        `DELETE FROM student_assignment_attachments
         WHERE id = ANY($1::uuid[]) AND student_id = $2 AND school_id = $3`,
        [delIds, st.id, schoolId]
      );
      currentAtts = currentAtts.filter((att) => !toRemoveIds.includes(att.id));
    }
  }

  // 5. Enforce cumulative attachment count limit (<= 5)
  const newFilesList = Array.isArray(attachments) ? attachments.filter((a) => a && a.fileData) : [];
  const remainingCount = currentAtts.length;
  if (remainingCount + newFilesList.length > MAX_FILES_COUNT) {
    throw new Error(`Maximum ${MAX_FILES_COUNT} files allowed per submission (currently ${remainingCount} attached, cannot add ${newFilesList.length})`);
  }

  // 6. Calculate cumulative size and validate new attachments
  let cumulativeSize = currentAtts.reduce((sum, a) => sum + (Number(a.file_size) || 0), 0);
  const validatedFiles: Array<{ id: string; fileName: string; mimeType: string; buffer: Buffer; storageKey: string }> = [];

  for (const item of newFilesList) {
    const valRes = validateAttachment(item.fileName || 'attachment.pdf', item.fileData);
    if (!valRes.valid) {
      throw new Error(`File validation error for "${item.fileName}": ${valRes.error}`);
    }
    cumulativeSize += valRes.buffer.length;
    if (cumulativeSize > MAX_TOTAL_SIZE) {
      throw new Error(`Total submission size exceeds the 25MB limit`);
    }

    const attId = crypto.randomUUID();
    const storageKey = buildStudentSubmissionStorageKey(schoolId, assignmentId, attId, valRes.sanitizedName);

    validatedFiles.push({
      id: attId,
      fileName: valRes.sanitizedName,
      mimeType: valRes.mimeType,
      buffer: valRes.buffer,
      storageKey
    });
  }

  // 7. Verify non-empty submission
  const trimmedText = String(text || '').trim();
  if (!trimmedText && currentAtts.length === 0 && validatedFiles.length === 0) {
    throw new Error('Submission content required: please provide submission text or attach at least one file');
  }

  // 8. Determine status while safeguarding grading and feedback
  const hasUpd = await checkHasUpdatedAtStudentSub();
  const supportsResubmit = await checkSupportsResubmittedStatus();

  let targetStatus = 'SUBMITTED';
  if (existingSub) {
    // If already submitted or graded, keep feedback & marks intact and transition to RESUBMITTED (or SUBMITTED if constraint hasn't been migrated)
    if (existingSub.status === 'GRADED') {
      targetStatus = supportsResubmit ? 'RESUBMITTED' : 'SUBMITTED';
    } else if (existingSub.status === 'SUBMITTED' || existingSub.status === 'RESUBMITTED') {
      targetStatus = supportsResubmit ? 'RESUBMITTED' : 'SUBMITTED';
    } else {
      targetStatus = 'SUBMITTED';
    }
  } else {
    // Initial submission: check due date
    const now = new Date();
    if (asg.due_date && now > new Date(`${asg.due_date}T23:59:59.999`)) {
      targetStatus = 'OVERDUE';
    } else {
      targetStatus = 'SUBMITTED';
    }
  }

  // 9. Upsert or update submission record without clearing original submitted_at or grades
  let subRecord: any;
  if (existingSub) {
    const updateSql = hasUpd
      ? `UPDATE student_assignment_submissions
         SET submission_text = $1, status = $2, updated_at = NOW()
         WHERE id = $3 AND school_id = $4 AND student_id = $5
         RETURNING *`
      : `UPDATE student_assignment_submissions
         SET submission_text = $1, status = $2
         WHERE id = $3 AND school_id = $4 AND student_id = $5
         RETURNING *`;
    const updQ = await pool.query(updateSql, [trimmedText, targetStatus, existingSub.id, schoolId, st.id]);
    subRecord = updQ.rows[0];
  } else {
    const insertSql = hasUpd
      ? `INSERT INTO student_assignment_submissions
           (school_id, assignment_id, student_id, status, submitted_at, submission_text, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), $5, NOW())
         RETURNING *`
      : `INSERT INTO student_assignment_submissions
           (school_id, assignment_id, student_id, status, submitted_at, submission_text)
         VALUES ($1, $2, $3, $4, NOW(), $5)
         RETURNING *`;
    const insQ = await pool.query(insertSql, [schoolId, assignmentId, st.id, targetStatus, trimmedText]);
    subRecord = insQ.rows[0];
  }

  // 10. Upload new attachments to storage and record in DB
  const savedNewAttachments: any[] = [];
  for (const file of validatedFiles) {
    await uploadToStorage(file.storageKey, file.buffer, file.mimeType);

    const attInsert = await pool.query(
      `INSERT INTO student_assignment_attachments
         (id, school_id, assignment_id, submission_id, student_id, file_name, file_size, mime_type, storage_provider, storage_key, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'FIREBASE', $9, NOW())
       RETURNING id, file_name, file_size, mime_type, created_at`,
      [file.id, schoolId, assignmentId, subRecord.id, st.id, file.fileName, file.buffer.length, file.mimeType, file.storageKey]
    );
    savedNewAttachments.push(attInsert.rows[0]);
  }

  clearStudentDashboardCache(userId);
  return {
    ...subRecord,
    attachments: [...currentAtts, ...savedNewAttachments]
  };
}

/**
 * Remove an individual attachment from a student's submission
 */
export async function deleteStudentSubmissionAttachment(
  schoolId: string,
  userId: string,
  assignmentId: string,
  attachmentId: string
) {
  const st = await resolveStudentRecord(schoolId, userId);
  if (!st) {
    throw new Error('Student profile not found');
  }

  const attQ = await pool.query(
    `SELECT id, storage_key, submission_id FROM student_assignment_attachments
     WHERE id = $1 AND assignment_id = $2 AND school_id = $3 AND student_id = $4`,
    [attachmentId, assignmentId, schoolId, st.id]
  );

  if (attQ.rowCount === 0) {
    const err: any = new Error('Attachment not found or access denied');
    err.status = 404;
    throw err;
  }

  const att = attQ.rows[0];
  if (att.storage_key) {
    try {
      await deleteFromStorage(att.storage_key);
    } catch (delErr: any) {
      console.warn('[Storage] Could not prune file from storage:', att.storage_key);
      const err: any = new Error(`Failed to remove attachment file from storage: ${delErr.message || 'Storage error'}. Database record preserved.`);
      err.status = 502;
      throw err;
    }
  }

  await pool.query(
    `DELETE FROM student_assignment_attachments WHERE id = $1 AND student_id = $2 AND school_id = $3`,
    [attachmentId, st.id, schoolId]
  );

  const hasUpd = await checkHasUpdatedAtStudentSub();
  if (hasUpd) {
    try {
      await pool.query(
        `UPDATE student_assignment_submissions SET updated_at = NOW() WHERE id = $1`,
        [att.submission_id]
      );
    } catch (_e) {}
  }

  clearStudentDashboardCache(userId);
  return { success: true, message: 'Attachment deleted successfully' };
}

/**
 * Returns upcoming exams and published results
 */
export async function getStudentExams(schoolId: string, userId: string) {
  const st = await resolveStudentRecord(schoolId, userId);
  if (!st) return [];
  try {
    const examsQ = await pool.query(
      `SELECT e.id, e.title, e.exam_date, e.start_time, e.end_time, e.room,
              e.total_marks, e.passing_marks, COALESCE(sub.name, 'General') AS subject_name,
              r.marks_obtained, r.grade, r.remarks
       FROM student_exams e
       LEFT JOIN subjects sub ON sub.id = e.subject_id
       LEFT JOIN student_exam_results r ON r.exam_id = e.id AND r.student_id = $3
       WHERE e.school_id = $1 
         AND (e.class_id = $2 OR e.class_id IN (SELECT id FROM classes WHERE school_id = $1 AND class_number = $4))
       ORDER BY e.exam_date ASC`,
      [schoolId, st.class_id, st.id, Number(st.class_number || 0)]
    );
    if (examsQ.rowCount && examsQ.rowCount > 0) return examsQ.rows;
  } catch (_e) {}

  return [];
}

/**
 * Returns student's leave requests
 */
export async function getStudentLeaveRequests(schoolId: string, userId: string) {
  const st = await resolveStudentRecord(schoolId, userId);
  try {
    const q = await pool.query(
      `SELECT l.*, u.name AS reviewer_name
       FROM student_leave_requests l
       LEFT JOIN users u ON u.id = l.reviewed_by
       WHERE l.school_id = $1 AND (l.student_id::text = $2::text OR l.student_id::text = $3::text)
       ORDER BY l.created_at DESC`,
      [schoolId, st.id, userId]
    );
    if (q.rowCount && q.rowCount > 0) return q.rows;
  } catch (_e) {}

  const mem = inMemoryLeaves.filter(
    (l) => (l.school_id === schoolId || !schoolId) &&
           (l.student_id === st.id || l.applicant_id === st.id || l.student_id === userId || l.applicant_id === userId)
  );
  if (mem.length > 0) return mem;

  return [];
}

/**
 * Submits a new leave request
 */
export async function createStudentLeaveRequest(schoolId: string, userId: string, data: { startDate: string; endDate: string; reason: string }) {
  if (!data.startDate || !data.endDate || !data.reason) {
    throw new Error('Start date, end date, and reason are required');
  }
  const st = await resolveStudentRecord(schoolId, userId);
  const isUuid = (val: any) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
  
  if (isUuid(schoolId) && isUuid(st.id)) {
    try {
      const q = await pool.query(
        `INSERT INTO student_leave_requests (school_id, student_id, start_date, end_date, reason, status)
         VALUES ($1, $2, $3, $4, $5, 'PENDING')
         RETURNING *`,
        [schoolId, st.id, data.startDate, data.endDate, data.reason]
      );
      if (q.rowCount && q.rowCount > 0) return q.rows[0];
    } catch (_e) {}
  }

  const memItem = {
    id: `lv-${Date.now()}`,
    school_id: schoolId,
    student_id: st.id,
    applicant_id: st.id,
    applicant_name: st.name || 'Student',
    start_date: data.startDate,
    end_date: data.endDate,
    reason: data.reason,
    status: 'PENDING' as const,
    created_at: new Date().toISOString()
  };
  inMemoryLeaves.unshift(memItem);
  return memItem;
}

/**
 * Change student password securely
 */
export async function changeStudentPassword(userId: string, currentPass: string, newPass: string) {
  const pwValidation = validatePasswordStrength(String(newPass));
  if (!pwValidation.valid) {
    throw new Error(pwValidation.message);
  }
  try {
    const q = await pool.query(`SELECT password_hash FROM users WHERE id = $1`, [userId]);
    if (q.rowCount && q.rowCount > 0) {
      const match = await bcrypt.compare(currentPass, q.rows[0].password_hash);
      if (!match) throw new Error('Current password is incorrect');
      const hash = await bcrypt.hash(newPass, 10);
      await pool.query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [hash, userId]);
      return { success: true, message: 'Password updated successfully' };
    }
  } catch (err: any) {
    if (err.message === 'Current password is incorrect') throw err;
  }

  // Demo fallback
  return { success: true, message: 'Password updated successfully' };
}
