import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { pool, isPostgresConfigured } from '../db';
import { requireAuth, requireRoles, AuthRequest } from '../middleware/auth';
import { registerDemoUser, updateDemoUserPhoto, getAllDemoUsers } from '../store/demoUsers';
import { createAndSendPasswordReset, isSameSchool, isTestSchool } from './auth';
import { queueEmailNotification } from '../services/notificationService';
import { demoSchools } from './superAdmin';
import { getFirestoreSchoolById } from '../services/firestoreService';
import { collections, isFirebaseConfigured } from '../firebase';
import {
  syncStudentToFirestore,
  syncStudentsBulkToFirestore,
  deleteStudentFromFirestore,
  syncTeacherToFirestore,
  deleteTeacherFromFirestore,
  syncTeacherAssignmentsToFirestore,
  syncClassToFirestore,
  deleteClassFromFirestore,
  syncSectionToFirestore,
  deleteSectionFromFirestore,
  syncSubjectToFirestore,
  deleteSubjectFromFirestore,
  syncSchoolToFirestore,
  rehydrateAllFromFirestore
} from '../services/firestoreSync';
import { validatePasswordStrength } from '../utils/passwordPolicy';
import { fastCache } from '../utils/cache';
import { invalidateSchoolCache } from '../services/tenantDataService';

const isUuid = (val: any): boolean => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

const r=Router();
const admin= [requireAuth,requireRoles('SCHOOL_ADMIN')];
const reader= [requireAuth,requireRoles('SUPER_ADMIN','SCHOOL_ADMIN','TEACHER')];
export const schoolStaff = reader;

// Auto-invalidate school memory cache on any successful mutation (POST, PUT, DELETE)
r.use((req: any, res: any, next: any) => {
  if (req.method !== 'GET') {
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        const sid = req.user?.schoolId || req.body?.schoolId || req.params?.schoolId;
        if (sid) {
          fastCache.invalidatePattern(String(sid));
        }
      }
    });
  }
  next();
});

/**
 * Normalizes academic session strings into a canonical format: "YYYY-YYYY"
 * Examples:
 * - "2026-2027" -> "2026-2027"
 * - "2026-27" -> "2026-2027"
 * - "2026–27 Academic Session" -> "2026-2027"
 * - "2026-2027 Session" -> "2026-2027"
 */
export function toCanonicalSession(s?: string | null): string {
  if (!s) return '';
  const str = String(s).trim();
  const m = str.match(/(\d{4})[^\d]+(\d{2,4})/);
  if (m) {
    const y1 = m[1];
    const y2 = m[2].length === 2 ? y1.slice(0, 2) + m[2] : m[2];
    return `${y1}-${y2}`;
  }
  const single = str.match(/(\d{4})/);
  if (single) return single[1];
  return str.toLowerCase().replace(/[\u2013\u2014]/g, '-').replace(/[^a-z0-9-]/g, '');
}

// Helper function for session matching across formats
export function isSameSession(s1?: string | null, s2?: string | null): boolean {
  if (!s1 || !s2) return false;
  if (s1 === s2) return true;
  const str1 = String(s1).trim();
  const str2 = String(s2).trim();
  if (!str1 || !str2) return false;
  if (/^all(\s+sessions?)?$/i.test(str1) || /^all(\s+sessions?)?$/i.test(str2)) return true;
  if (str1.toLowerCase() === str2.toLowerCase()) return true;

  const c1 = toCanonicalSession(str1);
  const c2 = toCanonicalSession(str2);
  if (c1 && c2 && c1 === c2) return true;
  if (c1 && c2 && (c1.includes(c2) || c2.includes(c1))) return true;
  return str1.toLowerCase().includes(str2.toLowerCase()) || str2.toLowerCase().includes(str1.toLowerCase());
}

// Class grades: Class-L-KG (id: cls-lkg, class_number: -1), U-KG (id: cls-ukg, class_number: 0), Class 1-12
export const CLASS_GRADES = [
  { id: 'cls-lkg', class_number: -1, label: 'Class-L-KG' },
  { id: 'cls-ukg', class_number: 0,  label: 'Class-U-KG' },
  ...([1,2,3,4,5,6,7,8,9,10,11,12].map(n => ({ id: `cls-${n}`, class_number: n, label: `Class ${n}` })))
];

export const demoClasses: any[] = CLASS_GRADES.map(g => ({
  id: g.id,
  class_number: g.class_number,
  label: g.label,
  section_count: 2,
  school_id: '00000000-0000-0000-0000-000000000001'
}));

export const demoSections: any[] = [];
CLASS_GRADES.forEach(g => {
  demoSections.push({ id: `sec-${g.id}-a`, class_id: g.id, class_number: g.class_number, label: g.label, name: 'A', section_name: 'A', school_id: '00000000-0000-0000-0000-000000000001' });
  demoSections.push({ id: `sec-${g.id}-b`, class_id: g.id, class_number: g.class_number, label: g.label, name: 'B', section_name: 'B', school_id: '00000000-0000-0000-0000-000000000001' });
});

const ensuredSchools = new Set<string>();

/**
 * Ensures standard classes (-1 to 12) and standard sections (A, B) exist in PostgreSQL for the school.
 */
export async function ensureSchoolClassesAndSections(schoolId?: string | null): Promise<void> {
  if (!schoolId) return;
  const isSchoolUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(schoolId));
  if (!isSchoolUuid) return;
  if (ensuredSchools.has(schoolId)) return;

  try {
    // Ultra-fast path: If classes already exist in PostgreSQL including kindergarten, return in 1 roundtrip
    const checkExisting = await pool.query(
      'SELECT COUNT(DISTINCT class_number)::int as count FROM classes WHERE school_id = $1 AND class_number IN (-1, 0, 1, 12)',
      [schoolId]
    );
    if ((checkExisting.rows[0]?.count || 0) >= 4) {
      ensuredSchools.add(schoolId);
      return;
    }
    // Ensure classes check constraint allows -1 to 12
    await pool.query(`
      DO $$
      BEGIN
        ALTER TABLE classes DROP CONSTRAINT IF EXISTS classes_class_number_check;
        ALTER TABLE classes ADD CONSTRAINT classes_class_number_check CHECK (class_number >= -1 AND class_number <= 12);
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `).catch(() => {});

    for (const g of CLASS_GRADES) {
      const clsRes = await pool.query(
        `INSERT INTO classes(school_id, class_number)
         VALUES($1, $2)
         ON CONFLICT (school_id, class_number) DO UPDATE SET class_number=EXCLUDED.class_number
         RETURNING id, class_number`,
        [schoolId, g.class_number]
      );
      if (clsRes.rowCount && clsRes.rows.length > 0) {
        const classId = clsRes.rows[0].id;
        for (const secName of ['A', 'B']) {
          await pool.query(
            `INSERT INTO sections(school_id, class_id, name)
             VALUES($1, $2, $3)
             ON CONFLICT (class_id, name) DO UPDATE SET name=EXCLUDED.name`,
            [schoolId, classId, secName]
          );
        }
      }
    }
    ensuredSchools.add(schoolId);
  } catch (err: any) {
    console.warn('[ensureSchoolClassesAndSections] Error:', err.message);
  }
}

r.get('/classes',...reader,async(req:AuthRequest,res)=>{
 const sid = req.user!.schoolId;
 const cacheKey = `classes:${sid}`;
 const cached = fastCache.get<any>(cacheKey);
 if (cached) return res.json(cached);

 await ensureSchoolClassesAndSections(sid);

 // Build standard class list from CLASS_GRADES — always the full L-KG → Class 12 set
 const standardClasses = CLASS_GRADES.map(g => ({
   id: `${sid}-${g.id}`,
   class_number: g.class_number,
   label: g.label,
   section_count: 2,
   school_id: sid
 }));

 try {
  const q=await pool.query(`SELECT c.id,c.class_number,COUNT(s.id)::int section_count
  FROM classes c LEFT JOIN sections s ON s.class_id=c.id
  WHERE c.school_id=$1 GROUP BY c.id ORDER BY c.class_number`,[sid]);
  if (q.rowCount && q.rows.length > 0) {
    const merged = standardClasses.map(sc => {
      const db = q.rows.find((r: any) => Number(r.class_number) === sc.class_number);
      return db ? { ...sc, ...db, label: sc.label } : sc;
    });
    for (const r of q.rows) {
      if (!merged.some(m => Number(m.class_number) === Number(r.class_number))) {
        merged.push({ id: r.id, class_number: Number(r.class_number), label: `Class ${r.class_number}`, section_count: r.section_count, school_id: sid });
      }
    }
    merged.sort((a: any, b: any) => Number(a.class_number) - Number(b.class_number));
    fastCache.set(cacheKey, merged, 30);
    return res.json(merged);
  }
 } catch {}

 // Merge any Firestore classes on top
 if (isFirebaseConfigured()) {
   try {
     let snap = await collections.classes().where('school_id', '==', sid).get();
     if (snap.empty) snap = await collections.classes().get();
     if (!snap.empty) {
       const fsClasses = snap.docs
         .map(d => {
           const data = d.data();
           const cNum = Number(data.class_number ?? data.classNumber ?? 1);
           const lbl = cNum === -1 ? 'L-KG' : cNum === 0 ? 'U-KG' : `Class ${cNum}`;
           return {
             id: d.id,
             class_number: cNum,
             classNumber: cNum,
             label: data.label || lbl,
             name: data.name || lbl,
             section_count: data.section_count ?? data.sectionCount ?? 2,
             school_id: data.school_id || data.schoolId,
             schoolId: data.schoolId || data.school_id,
             ...data
           };
         })
         .filter((c: any) => !c.school_id || isSameSchool(c.school_id, sid) || (c.schoolId && isSameSchool(c.schoolId, sid)));

       const merged = standardClasses.map(sc => {
         const fs = fsClasses.find((f: any) => Number(f.class_number) === sc.class_number);
         return fs ? { ...sc, ...fs, label: sc.label } : sc;
       });
       merged.sort((a: any, b: any) => Number(a.class_number) - Number(b.class_number));
       return res.json(merged);
     }
   } catch {}
 }

 res.json(standardClasses);
});

r.post('/classes',...admin,async(req:AuthRequest,res)=>{
 const n=Number(req.body.classNumber || req.body.class_number);
 const sid=req.user!.schoolId;
 if(!Number.isInteger(n)||n<-1||n>12) return res.status(400).json({message:'Class must be between L-KG (-1) and 12'});
  try {
   const q=await pool.query('INSERT INTO classes(school_id,class_number) VALUES($1,$2) ON CONFLICT (school_id, class_number) DO UPDATE SET class_number=EXCLUDED.class_number RETURNING *',[sid,n]);
   if (q.rowCount) {
     const created = { id: q.rows[0].id, class_number: n, section_count: 0, school_id: sid };
     demoClasses.push(created);
     demoClasses.sort((a,b) => a.class_number - b.class_number);
     syncClassToFirestore(created).catch(() => {});
     return res.status(201).json(created);
   }
  } catch {}
 const existing = demoClasses.find(c => c.class_number === n && c.school_id && isSameSchool(c.school_id, sid));
 if (existing) return res.status(200).json(existing);
 const newClass = { id: `cls-${sid}-${n}`, class_number: n, section_count: 0, school_id: sid };
 demoClasses.push(newClass);
 demoClasses.sort((a,b) => a.class_number - b.class_number);
 syncClassToFirestore(newClass).catch(() => {});
 res.status(201).json(newClass);
});

r.delete('/classes/:id',...admin,async(req:AuthRequest,res)=>{
  const sid = req.user!.schoolId;
  const cid = String(req.params.id);
  if (isPostgresConfigured && isUuid(cid)) {
    try {
      const stCount = await pool.query('SELECT COUNT(*)::int AS cnt FROM students WHERE class_id = $1 AND school_id = $2', [cid, sid]);
      if (stCount.rows[0]?.cnt > 0) {
        return res.status(400).json({ success: false, message: `Cannot delete class: ${stCount.rows[0].cnt} students are enrolled in this class. Please delete or reassign them first.` });
      }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('DELETE FROM class_routines WHERE class_id = $1', [cid]);
        await client.query('UPDATE attendance_sessions SET class_id = NULL WHERE class_id = $1', [cid]);
        await client.query('DELETE FROM student_enrollment_history_v28 WHERE class_id = $1', [cid]);
        await client.query('DELETE FROM sections WHERE class_id = $1 AND school_id = $2', [cid, sid]);
        await client.query('DELETE FROM classes WHERE id = $1 AND school_id = $2', [cid, sid]);
        await client.query('COMMIT');
      } catch (delErr: any) {
        await client.query('ROLLBACK').catch(() => {});
        return res.status(400).json({ success: false, message: `Delete class failed: ${delErr.message}` });
      } finally {
        client.release();
      }
    } catch (checkErr: any) {
      return res.status(400).json({ success: false, message: `Delete class failed: ${checkErr.message}` });
    }
  }
  const idx = demoClasses.findIndex(c => c.id === cid && (!c.school_id || isSameSchool(c.school_id, sid)));
  if (idx >= 0) demoClasses.splice(idx, 1);
  deleteClassFromFirestore(cid).catch(() => {});
  if (sid) invalidateSchoolCache(sid);
  res.json({success:true});
});

r.get('/sections',...reader,async(req:AuthRequest,res)=>{
 const sid = req.user!.schoolId;
 const cacheKey = `sections:${sid}`;
 const cached = fastCache.get<any>(cacheKey);
 if (cached) return res.json(cached);

 await ensureSchoolClassesAndSections(sid);

 // Standard sections: Section A and Section B for each class in CLASS_GRADES
 const standardSections: any[] = [];
 CLASS_GRADES.forEach(g => {
   const classId = `${sid}-${g.id}`;
   standardSections.push({
     id: `${sid}-sec-${g.id}-a`,
     class_id: classId,
     classId: classId,
     class_number: g.class_number,
     label: g.label,
     name: 'A',
     section_name: 'A',
     school_id: sid
   });
   standardSections.push({
     id: `${sid}-sec-${g.id}-b`,
     class_id: classId,
     classId: classId,
     class_number: g.class_number,
     label: g.label,
     name: 'B',
     section_name: 'B',
     school_id: sid
   });
 });

 try {
  const q=await pool.query(`SELECT s.id,s.name,c.id class_id,c.class_number FROM sections s JOIN classes c ON c.id=s.class_id WHERE s.school_id=$1 ORDER BY c.class_number,s.name`,[sid]);
  if (q.rowCount && q.rows.length > 0) {
    const list = q.rows.map((r: any) => ({ ...r, section_name: r.name, school_id: sid }));
    for (const std of standardSections) {
      if (!list.some(r => Number(r.class_number) === std.class_number && r.name === std.name)) {
        list.push(std);
      }
    }
    list.sort((a: any, b: any) => (Number(a.class_number) - Number(b.class_number)) || String(a.name).localeCompare(String(b.name)));
    fastCache.set(cacheKey, list, 30);
    return res.json(list);
  }
 } catch {}

 // Query Cloud Firestore for sections belonging to this school
 if (isFirebaseConfigured()) {
   try {
      let snap = await collections.sections().where('school_id', '==', sid).get();
      if (snap.empty) snap = await collections.sections().get();
      if (!snap.empty) {
        const fsSections = snap.docs
          .map(d => {
            const data = d.data();
            const cNum = Number(data.class_number ?? data.classNumber ?? data.className ?? 10);
            const sName = String(data.name || data.sectionName || data.section || 'A').toUpperCase();
            const cId = data.class_id || data.classId || `${sid}-cls-${cNum}`;
            return {
              id: d.id,
              class_id: cId,
              classId: cId,
              class_number: cNum,
              classNumber: cNum,
              name: sName,
              section_name: sName,
              sectionName: sName,
              school_id: data.school_id || data.schoolId || sid,
              ...data
            };
          })
          .filter((s: any) => !s.school_id || isSameSchool(s.school_id, sid) || (s.schoolId && isSameSchool(s.schoolId, sid)));

        const list = [...fsSections];
        for (const std of standardSections) {
          if (!list.some(r => Number(r.class_number) === std.class_number && r.name === std.name)) {
            list.push(std);
          }
        }
        list.sort((a: any, b: any) => (Number(a.class_number) - Number(b.class_number)) || String(a.name).localeCompare(String(b.name)));
        return res.json(list);
      }
    } catch {}
  }

 const memSchoolSections = demoSections.filter(s => s.school_id && isSameSchool(s.school_id, sid));
 if (memSchoolSections.length > 0) {
   const list = [...memSchoolSections];
   for (const std of standardSections) {
     if (!list.some(r => Number(r.class_number) === std.class_number && r.name === std.name)) {
       list.push(std);
     }
   }
   list.sort((a: any, b: any) => (Number(a.class_number) - Number(b.class_number)) || String(a.name).localeCompare(String(b.name)));
   return res.json(list);
 }

 res.json(standardSections);
});

r.post('/sections',...admin,async(req:AuthRequest,res)=>{
 const sid = req.user!.schoolId;
 const rawClassId = req.body?.classId || req.body?.class_id;
 const name = req.body?.name;
 if(!rawClassId||!name||!String(name).trim()) return res.status(400).json({message:'Class and section name are required'});
 const cleanName = String(name).trim().toUpperCase();

 // Resolve class_number from rawClassId
 let resolvedClassNumber: number | null = null;
 const strClassId = String(rawClassId);
 if (/l.?kg/i.test(strClassId)) {
   resolvedClassNumber = -1;
 } else if (/u.?kg/i.test(strClassId)) {
   resolvedClassNumber = 0;
 } else {
   const m = strClassId.match(/cls-(\d+)/) || strClassId.match(/-(\d+)$/) || strClassId.match(/^(\d+)$/);
   if (m) {
     resolvedClassNumber = Number(m[1]);
   }
 }

 const isClassUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(strClassId);

 try {
   // Try resolving class from PostgreSQL
   const valid = await pool.query(
     `SELECT id, class_number FROM classes 
      WHERE (${isClassUuid ? 'id = $1' : 'FALSE'} OR ($2::int IS NOT NULL AND class_number = $2)) 
        AND school_id = $3 LIMIT 1`,
     [isClassUuid ? strClassId : '00000000-0000-0000-0000-000000000000', resolvedClassNumber, sid]
   );

   let realClassId = isClassUuid ? strClassId : '';
   let classNumber = resolvedClassNumber ?? 1;

   if (valid.rowCount && valid.rows.length > 0) {
     realClassId = valid.rows[0].id;
     classNumber = Number(valid.rows[0].class_number);
   } else if (resolvedClassNumber !== null) {
     const ins = await pool.query(
       `INSERT INTO classes(school_id, class_number) VALUES($1, $2)
        ON CONFLICT (school_id, class_number) DO UPDATE SET class_number=EXCLUDED.class_number
        RETURNING id, class_number`,
       [sid, resolvedClassNumber]
     );
     if (ins.rows.length > 0) {
       realClassId = ins.rows[0].id;
       classNumber = Number(ins.rows[0].class_number);
     }
   }

   if (realClassId) {
     const q = await pool.query(
       `INSERT INTO sections(school_id, class_id, name) VALUES($1, $2, $3)
        ON CONFLICT (class_id, name) DO UPDATE SET name=EXCLUDED.name
        RETURNING id, name, class_id`,
       [sid, realClassId, cleanName]
     );
     const created = {
       id: q.rows[0].id,
       class_id: realClassId,
       classId: realClassId,
       class_number: classNumber,
       classNumber: classNumber,
       name: cleanName,
       section_name: cleanName,
       school_id: sid
     };
     demoSections.push(created);
     demoSections.sort((a,b) => (Number(a.class_number ?? 0) - Number(b.class_number ?? 0)) || String(a.name).localeCompare(String(b.name)));
     fastCache.delete(`classes:${sid}`);
     fastCache.delete(`sections:${sid}`);
     if (sid) invalidateSchoolCache(sid);
     syncSectionToFirestore(created).catch(() => {});
     return res.status(201).json(created);
   }
 } catch (err: any) {
   console.error('[POST /sections] Error:', err.message);
 }

 const fallbackNum = resolvedClassNumber ?? 1;
 const newSection = {
   id: `sec-${sid}-${fallbackNum}-${cleanName.toLowerCase()}-${Date.now().toString().slice(-4)}`,
   class_id: rawClassId,
   classId: rawClassId,
   class_number: fallbackNum,
   classNumber: fallbackNum,
   name: cleanName,
   section_name: cleanName,
   school_id: sid
 };
 demoSections.push(newSection);
 demoSections.sort((a,b) => (Number(a.class_number ?? 0) - Number(b.class_number ?? 0)) || String(a.name).localeCompare(String(b.name)));
 fastCache.delete(`classes:${sid}`);
 fastCache.delete(`sections:${sid}`);
 if (sid) invalidateSchoolCache(sid);
 syncSectionToFirestore(newSection).catch(() => {});
 res.status(201).json(newSection);
});

r.delete('/sections/:id',...admin,async(req:AuthRequest,res)=>{
  const sid = req.user!.schoolId;
  const secId = String(req.params.id);
  if (isPostgresConfigured && isUuid(secId)) {
    try {
      const stCount = await pool.query('SELECT COUNT(*)::int AS cnt FROM students WHERE section_id = $1 AND school_id = $2', [secId, sid]);
      if (stCount.rows[0]?.cnt > 0) {
        return res.status(400).json({ success: false, message: `Cannot delete section: ${stCount.rows[0].cnt} students belong to this section. Please delete or reassign them first.` });
      }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('DELETE FROM class_routines WHERE section_id = $1', [secId]);
        await client.query('UPDATE attendance_sessions SET section_id = NULL WHERE section_id = $1', [secId]);
        await client.query('DELETE FROM student_enrollment_history_v28 WHERE section_id = $1', [secId]);
        await client.query('DELETE FROM sections WHERE id = $1 AND school_id = $2', [secId, sid]);
        await client.query('COMMIT');
      } catch (delErr: any) {
        await client.query('ROLLBACK').catch(() => {});
        return res.status(400).json({ success: false, message: `Delete section failed: ${delErr.message}` });
      } finally {
        client.release();
      }
    } catch (checkErr: any) {
      return res.status(400).json({ success: false, message: `Delete section failed: ${checkErr.message}` });
    }
  }
  const idx = demoSections.findIndex(s => s.id === secId && (!s.school_id || isSameSchool(s.school_id, sid)));
  if (idx >= 0) demoSections.splice(idx, 1);
  deleteSectionFromFirestore(secId).catch(() => {});
  fastCache.delete(`classes:${sid}`);
  fastCache.delete(`sections:${sid}`);
  if (sid) invalidateSchoolCache(sid);
  res.json({success:true});
});

export const demoStudents: any[] = [];

export const demoTeachers: any[] = [
  { id: '00000000-0000-0000-0000-000000000022', name: 'Rahul Sharma', email: 'rahul@demo-school.local', employee_id: 'EMP001', mobile: '9000000001', gender: 'Male', school_id: '00000000-0000-0000-0000-000000000001', is_active: true },
  { id: '00000000-0000-0000-0000-000000000023', name: 'Priya Patel', email: 'priya@demo-school.local', employee_id: 'EMP002', mobile: '9000000002', gender: 'Female', school_id: '00000000-0000-0000-0000-000000000001', is_active: true }
];

// In-memory teacher teaching allocations (empty - no mock data)
export const demoTeacherAssignments: any[] = [];

// GET /api/teachers/:id/assignments
r.get('/teachers/:id/assignments',...admin,async(req:AuthRequest,res)=>{
  const sid = req.user!.schoolId;
  const tid = req.params.id;
  if (!isTestSchool(sid)) {
    return res.json(demoTeacherAssignments.filter(a => a.teacher_id === tid && a.school_id && isSameSchool(a.school_id, sid)));
  }
  res.json(demoTeacherAssignments.filter(a => a.teacher_id === tid));
});

// GET /api/teacher-assignments (all assignments for current school)
r.get('/teacher-assignments',...admin,async(req:AuthRequest,res)=>{
  const sid = req.user!.schoolId;
  if (!isTestSchool(sid)) {
    return res.json(demoTeacherAssignments.filter(a => a.school_id && isSameSchool(a.school_id, sid)));
  }
  res.json(demoTeacherAssignments);
});

// PUT /api/teachers/:id/assignments — Replace all assignments for a teacher
r.put('/teachers/:id/assignments',...admin,async(req:AuthRequest,res)=>{
  const sid = req.user!.schoolId;
  const tid = req.params.id;
  const { assignments } = req.body || {};
  if (!Array.isArray(assignments)) return res.status(400).json({ message: 'assignments array required' });

  // Find teacher name
  const teacher = demoTeachers.find(t => t.id === tid && (!t.school_id || isSameSchool(t.school_id, sid)));
  const tName = teacher?.name || 'Faculty Member';

  // Remove old assignments for this teacher
  for (let i = demoTeacherAssignments.length - 1; i >= 0; i--) {
    if (demoTeacherAssignments[i].teacher_id === tid && (!demoTeacherAssignments[i].school_id || isSameSchool(demoTeacherAssignments[i].school_id, sid))) {
      demoTeacherAssignments.splice(i, 1);
    }
  }

  // Add new ones
  const created: any[] = [];
  for (const a of assignments) {
    const altTeacher = a.alt_teacher_id ? demoTeachers.find(t => t.id === a.alt_teacher_id) : null;
    const entry = {
      id: `ta-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      school_id: sid,
      teacher_id: tid,
      teacher_name: tName,
      subject_id: a.subject_id || null,
      subject_name: a.subject_name || null,
      class_id: a.class_id || null,
      class_number: a.class_number || null,
      section_id: a.section_id || null,
      section_name: a.section_name || null,
      session_id: a.session_id || null,
      session_name: a.session_name || null,
      alt_teacher_id: a.alt_teacher_id || null,
      alt_teacher_name: altTeacher?.name || a.alt_teacher_name || null
    };
    demoTeacherAssignments.push(entry);
    created.push(entry);
  }
  syncTeacherAssignmentsToFirestore(String(tid), created).catch(() => {});
  res.json(created);
});

r.get('/students',...reader,async(req:AuthRequest,res)=>{
 const search=String(req.query.search||'').trim().toLowerCase();
 const sessionFilter=String(req.query.session||req.query.sessionId||req.query.academic_year_id||'').trim();
 const userSchoolId = req.user?.schoolId;

 const cacheKey = !search && !sessionFilter && userSchoolId ? `students:${userSchoolId}` : null;
 if (cacheKey) {
   const cached = fastCache.get<any>(cacheKey);
   if (cached) return res.json(cached);
 }

 try {
  const q=await pool.query(`SELECT st.id,st.name,st.roll_number,st.admission_number,st.parent_name,st.parent_sms_number,st.email AS student_email,st.parent_email,st.user_id,st.photo_url,st.gender,st.date_of_birth,st.address,st.created_at,
  st.academic_year_id, ay.name AS session_name,
  c.id class_id,c.class_number,sec.id section_id,sec.name section_name
  FROM students st 
  LEFT JOIN classes c ON c.id=st.class_id 
  LEFT JOIN sections sec ON sec.id=st.section_id
  LEFT JOIN academic_years ay ON ay.id=st.academic_year_id
  WHERE st.school_id=$1 AND st.is_active=true
  AND ($2='' OR st.name ILIKE '%'||$2||'%' OR st.roll_number ILIKE '%'||$2||'%' OR COALESCE(st.admission_number, '') ILIKE '%'||$2||'%' OR COALESCE(st.gender, '') ILIKE '%'||$2||'%' OR COALESCE(st.email, '') ILIKE '%'||$2||'%' OR COALESCE(st.parent_email, '') ILIKE '%'||$2||'%')
  ORDER BY COALESCE(c.class_number, 99), COALESCE(sec.name, ''), st.roll_number`,[userSchoolId,search]);
  if (q.rows) {
    let rows = q.rows.map((st: any) => {
      const parts = String(st.name || '').trim().split(' ');
      const firstName = parts[0] || '';
      const lastName = parts.slice(1).join(' ') || '';
      return {
        ...st,
        first_name: firstName,
        last_name: lastName,
        full_name: st.name,
        rollNumber: st.roll_number,
        admissionNumber: st.admission_number,
        student_email: st.student_email || st.email,
        email: st.student_email || st.email,
        parent_email: st.parent_email,
        parent_phone: st.parent_sms_number,
        parentPhone: st.parent_sms_number,
        gender: st.gender || 'Not Specified',
        date_of_birth: st.date_of_birth ? new Date(st.date_of_birth).toISOString().slice(0, 10) : '',
        dob: st.date_of_birth ? new Date(st.date_of_birth).toISOString().slice(0, 10) : '',
        address: st.address || '',
        photo_url: st.photo_url || '',
        photoUrl: st.photo_url || '',
        session: st.session_name || st.academic_year_id,
        session_id: st.academic_year_id,
        created_at: st.created_at,
        createdAt: st.created_at
      };
    });
    const isAllSessions = !sessionFilter || /^all(\s+sessions?)?$/i.test(sessionFilter);
    if (!isAllSessions) {
      rows = rows.filter((st: any) => {
        if (st.session_name || st.academic_year_id || st.session) {
          return isSameSession(st.session_name, sessionFilter) ||
                 isSameSession(st.academic_year_id, sessionFilter) ||
                 isSameSession(st.session, sessionFilter);
        }
        return true;
      });
    }
    if (cacheKey) fastCache.set(cacheKey, rows, 15);
    return res.json(rows);
  }
 } catch {}

 // If Firestore is configured, load from Cloud Firestore strictly scoped to userSchoolId
 if (isFirebaseConfigured() && userSchoolId) {
  try {
    const snap = await collections.students().where('school_id', '==', userSchoolId).get();
    if (!snap.empty) {
      let list = snap.docs.map(d => {
        const dt = d.data();
        const docSchoolId = dt.school_id || dt.schoolId;
        return {
          id: d.id,
          name: dt.name || dt.fullName || dt.full_name || '',
          full_name: dt.full_name || dt.name || dt.fullName || '',
          first_name: dt.first_name || dt.firstName || '',
          last_name: dt.last_name || dt.lastName || '',
          roll_number: dt.roll_number || dt.rollNumber || '',
          admission_number: dt.admission_number || dt.admissionNumber || '',
          admissionNumber: dt.admissionNumber || dt.admission_number || '',
          parent_name: dt.parent_name || dt.parentName || '—',
          parent_sms_number: dt.parent_sms_number || dt.parentPhone || '',
          parent_email: dt.parent_email || dt.parentEmail || '',
          student_email: dt.student_email || dt.studentEmail || dt.email || '',
          email: dt.email || dt.student_email || '',
          gender: dt.gender || '',
          class_id: dt.class_id || dt.classId || 'cls-1',
          class_number: (() => {
            const cId = String(dt.class_id || dt.classId || '');
            if (/l.?kg/i.test(cId)) return -1;
            if (/u.?kg/i.test(cId)) return 0;
            const m = cId.match(/cls-(\d+)/);
            if (m) return Number(m[1]);
            if (dt.class_number !== undefined && dt.class_number !== null && !isNaN(Number(dt.class_number))) return Number(dt.class_number);
            if (dt.className !== undefined && dt.className !== null && !isNaN(Number(dt.className))) return Number(dt.className);
            return 1;
          })(),
          section_id: dt.section_id || dt.sectionId || 'sec-a',
          section_name: (() => {
            const sId = String(dt.section_id || dt.sectionId || '').toUpperCase();
            const sName = String(dt.section_name || dt.section || '').toUpperCase();
            if (sName === 'B' || sId.endsWith('-B') || sId.endsWith('_B') || sId === 'B') return 'B';
            return 'A';
          })(),
          academic_year_id: dt.academic_year_id || dt.session_id || dt.sessionId || null,
          session_id: dt.session_id || dt.academic_year_id || null,
          session_name: dt.session_name || dt.session || null,
          session: dt.session || dt.session_name || null,
          school_id: docSchoolId,
          schoolId: docSchoolId,
          is_active: dt.is_active !== false && dt.status !== 'ARCHIVED',
          ...dt
        };
      }).filter(s => s.is_active !== false);

      if (list.length > 0) {
        let filtered = search
          ? list.filter(s =>
              s.name.toLowerCase().includes(search) ||
              String(s.roll_number).includes(search) ||
              (s.admission_number && s.admission_number.toLowerCase().includes(search)) ||
              (s.admissionNumber && s.admissionNumber.toLowerCase().includes(search)) ||
              (s.gender && String(s.gender).toLowerCase().includes(search)) ||
              (s.email && s.email.toLowerCase().includes(search)) ||
              (s.student_email && s.student_email.toLowerCase().includes(search)) ||
              (s.parent_email && s.parent_email.toLowerCase().includes(search))
            )
          : list;
        const isAllSessions = !sessionFilter || /^all(\s+sessions?)?$/i.test(sessionFilter);
        if (!isAllSessions) {
          filtered = filtered.filter(s => isSameSession(s.session_name || s.session || s.academic_year_id || s.session_id, sessionFilter));
        }
        return res.json(filtered);
      }
    }
  } catch (e: any) {
    console.warn('[Firestore] Students lookup fallback error:', e.message);
  }
 }

 // Check in-memory demoStudents as secondary fallback
 const memSchoolStudents = demoStudents.filter(s => 
   s.school_id && isSameSchool(s.school_id, userSchoolId) && s.is_active !== false
 );
 if (memSchoolStudents.length > 0) {
   let list = memSchoolStudents;
   if (search) {
     list = list.filter(s => 
       (s.name && s.name.toLowerCase().includes(search.toLowerCase())) ||
       (s.roll_number && String(s.roll_number).includes(search)) ||
       (s.admission_number && s.admission_number.toLowerCase().includes(search.toLowerCase()))
     );
   }
   const isAllSessions = !sessionFilter || /^all(\s+sessions?)?$/i.test(sessionFilter);
   if (!isAllSessions) {
     list = list.filter(s => isSameSession(s.session_name || s.session || s.academic_year_id, sessionFilter));
   }
   return res.json(list);
 }

 // Return empty array if school has no registered students
 res.json([]);
});

// GET /students/template — download standardized Excel import template
r.get('/students/template', ...reader, (_req, res) => {
  const XLSX = require('xlsx');
  const sample = [
    { 'First Name': 'Aarav',  'Last Name': 'Sharma',  'Full Name': 'Aarav Sharma',  'Admission Number': 'ADM-2025-001', 'Roll Number': '101', 'Session': '2025-26', 'Class': 'Class 1', 'Section': 'A', 'Gender': 'Male', 'Parent Name': 'Rajesh Sharma', 'Parent Phone': '9876543210', 'Parent Email': 'rajesh@example.com', 'Student Email': 'aarav@school.edu' },
    { 'First Name': 'Diya',   'Last Name': 'Patel',   'Full Name': 'Diya Patel',    'Admission Number': 'ADM-2025-002', 'Roll Number': '102', 'Session': '2025-26', 'Class': 'Class 1', 'Section': 'A', 'Gender': 'Female', 'Parent Name': 'Kirit Patel',   'Parent Phone': '9876543211', 'Parent Email': 'kirit@example.com',  'Student Email': 'diya@school.edu' },
    { 'First Name': 'Rohan',  'Last Name': 'Gupta',   'Full Name': 'Rohan Gupta',   'Admission Number': 'ADM-2025-003', 'Roll Number': '103', 'Session': '2025-26', 'Class': 'Class 2', 'Section': 'B', 'Gender': 'Male', 'Parent Name': 'Manoj Gupta',   'Parent Phone': '9876543212', 'Parent Email': 'manoj@example.com', 'Student Email': 'rohan@school.edu' },
    { 'First Name': 'L-KG',   'Last Name': 'Example', 'Full Name': 'L-KG Example',  'Admission Number': 'ADM-2025-004', 'Roll Number': '104', 'Session': '2025-26', 'Class': 'L-KG',    'Section': 'A', 'Gender': 'Female', 'Parent Name': 'Parent Name',   'Parent Phone': '9876543213', 'Parent Email': 'p@example.com',    'Student Email': '' },
    { 'First Name': 'U-KG',   'Last Name': 'Example', 'Full Name': 'U-KG Example',  'Admission Number': 'ADM-2025-005', 'Roll Number': '105', 'Session': '2025-26', 'Class': 'U-KG',    'Section': 'B', 'Gender': 'Male', 'Parent Name': 'Parent Name',   'Parent Phone': '9876543214', 'Parent Email': 'p2@example.com',   'Student Email': '' },
  ];
  const ws = XLSX.utils.json_to_sheet(sample);
  ws['!cols'] = [14,14,20,18,14,12,12,10,12,20,16,24,26].map(wch => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Students Import Template');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="students_import_template.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

r.post('/students',...admin,async(req:AuthRequest,res)=>{
  const b = req.body || {};
  const rawFirst = b.firstName;
  const rawLast = b.lastName;
  const rawName = b.name;
  const rollNumber = b.rollNumber || b.roll_number;
  const admissionNumber = b.admissionNumber || b.admission_number;
  const parentName = b.parentName || b.parent_name || b.guardianName || b.guardian_name || '';
  const parentSmsNumber = b.parentSmsNumber || b.parentPhone || b.parent_phone || b.parent_sms_number || b.phone || '';
  const dob = b.dob || b.dateOfBirth || b.date_of_birth || null;
  const gender = b.gender || null;
  const address = b.address || null;
  const classId = b.classId || b.class_id;
  const sectionId = b.sectionId || b.section_id;
  const studentEmail = b.studentEmail || b.student_email || b.email;
  const parentEmail = b.parentEmail || b.parent_email;
  const loginOption = b.loginOption || b.login_option;
  const sendInviteEmail = b.sendInviteEmail !== undefined ? b.sendInviteEmail : true;
  const sessionId = b.sessionId || b.session_id || b.session;

  // Name normalization
  const firstName  = String(rawFirst || '').trim();
  const lastName   = String(rawLast  || '').trim();
  const name = firstName && lastName ? `${firstName} ${lastName}` : (firstName || lastName || String(rawName||'').trim());
  if(!name||!rollNumber||!classId||!sectionId) return res.status(400).json({message:'First Name, Last Name (or full name), roll number, class and section are required'});

 // Mandatory session binding — resolve academic_year_id
 const { getInMemoryAcademicYears, getInMemoryActiveAcademicYear } = await import('./academicYears');
 const schoolId = req.user!.schoolId;
 await ensureSchoolClassesAndSections(schoolId);

 const rawSession = String(sessionId || '').trim();
 let resolvedSessionId: string | null = null;
 let resolvedSessionName: string | null = null;
 try {
   const ayQ = await pool.query(`SELECT id, name, is_active FROM academic_years WHERE school_id=$1 AND is_archived=false`, [schoolId]);
   if (ayQ.rowCount && ayQ.rows.length > 0) {
     if (rawSession) {
       const found = ayQ.rows.find((r: any) => r.id === rawSession || isSameSession(r.name, rawSession));
       if (found) {
         resolvedSessionId = found.id;
         resolvedSessionName = found.name;
       }
     }
     if (!resolvedSessionId) {
       const active = ayQ.rows.find((r: any) => r.is_active) || ayQ.rows[0];
       resolvedSessionId = active.id;
       resolvedSessionName = active.name;
     }
   }
 } catch {}
 if (!resolvedSessionId) {
   const memYears = getInMemoryAcademicYears(schoolId);
   const target = rawSession
     ? memYears.find(y => (y.id === rawSession || isSameSession(y.name, rawSession)) && !y.is_archived)
     : (memYears.find(y => y.is_active && !y.is_archived) || memYears[1] || memYears[0]);
   resolvedSessionId = target?.id || (rawSession ? `ay-${rawSession}` : 'ay-2025-26');
   resolvedSessionName = target?.name || rawSession || '2025–26 Academic Session';
 }
 
 const cleanStudentEmail = String(studentEmail || '').trim().toLowerCase();
 const cleanParentEmail = String(parentEmail || '').trim().toLowerCase();
 const cleanAdmissionNumber = String(admissionNumber || '').trim();
 const loginOpt = String(loginOption || (cleanStudentEmail ? 'STUDENT' : cleanParentEmail ? 'PARENT' : 'NONE')).toUpperCase();

 // Unique admission number constraint — check at application level
 if (cleanAdmissionNumber) {
   try {
     const admChk = await pool.query(`SELECT id FROM students WHERE school_id=$1 AND admission_number=$2 AND is_active=true LIMIT 1`, [schoolId, cleanAdmissionNumber]);
     if (admChk.rowCount && admChk.rowCount > 0) {
       return res.status(400).json({ message: `Admission number '${cleanAdmissionNumber}' already exists for this school.` });
     }
   } catch {}
   // Also check in-memory
   const dup = demoStudents.find(s => s.school_id === schoolId && s.admission_number === cleanAdmissionNumber);
   if (dup) return res.status(400).json({ message: `Admission number '${cleanAdmissionNumber}' already exists (in-memory).` });
 }

 // Duplicate Roll Number check in same section
 if (rollNumber) {
   try {
     const rollChk = await pool.query(
       `SELECT id FROM students 
        WHERE school_id = $1 
          AND (section_id = $2 OR section_id::text = $2) 
          AND (roll_number = $3 OR roll_number::text = $3) 
          AND is_active = true 
        LIMIT 1`,
       [schoolId, sectionId, String(rollNumber)]
     );
     if (rollChk.rowCount && rollChk.rowCount > 0) {
       return res.status(400).json({ message: `Roll number ${rollNumber} is already assigned in this section.` });
     }
   } catch {}
   const dupRoll = demoStudents.find(s => 
     s.school_id === schoolId && 
     (s.section_id === sectionId || s.sectionId === sectionId) && 
     String(s.roll_number || s.rollNumber) === String(rollNumber) && 
     s.is_active !== false
   );
   if (dupRoll) {
     return res.status(400).json({ message: `Roll number ${rollNumber} is already assigned in this section.` });
   }
 }

 let clsNum = 1;
  const strClassId = String(classId || '').trim();
  const matchedGrade = CLASS_GRADES.find(g => 
    g.id === strClassId || 
    strClassId.endsWith(`-${g.id}`) || 
    strClassId === `cls-${g.class_number}` ||
    String(g.class_number) === strClassId
  );
  if (matchedGrade) {
    clsNum = matchedGrade.class_number;
  } else if (/l.?kg/i.test(strClassId)) {
    clsNum = -1;
  } else if (/u.?kg/i.test(strClassId)) {
    clsNum = 0;
  } else {
    const m = strClassId.match(/cls-(\d+)/);
    if (m) clsNum = Number(m[1]);
    else if (/^\d+$/.test(strClassId)) clsNum = Number(strClassId);
  }

  let secName = 'A';
  const strSecId = String(sectionId || '').trim().toUpperCase();
  if (strSecId === 'B' || strSecId.endsWith('-B') || strSecId.endsWith('_B') || strSecId.endsWith('/B')) {
    secName = 'B';
  } else if (strSecId === 'A' || strSecId.endsWith('-A') || strSecId.endsWith('_A') || strSecId.endsWith('/A')) {
    secName = 'A';
  }
  let resetInfo: any = null;
  let realClassId = classId;
  let realSectionId = sectionId;
  const isClassUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(classId));
  const isSecUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(sectionId));

  try {
    let valid: any = { rowCount: 0, rows: [] };
    if (isSecUuid) {
      valid = await pool.query(
        `SELECT s.id AS section_id, s.name AS section_name, c.id AS class_id, c.class_number 
         FROM sections s 
         JOIN classes c ON c.id = s.class_id 
         WHERE s.school_id = $1 AND s.id = $2 LIMIT 1`,
        [schoolId, sectionId]
      ).catch(() => ({ rowCount: 0, rows: [] }));
    }
    if (!valid.rowCount) {
      valid = await pool.query(
        `SELECT s.id AS section_id, s.name AS section_name, c.id AS class_id, c.class_number 
         FROM sections s 
         JOIN classes c ON c.id = s.class_id 
         WHERE s.school_id = $1 
           AND (${isClassUuid ? 'c.id = $2' : 'FALSE'} OR c.class_number = $3)
           AND UPPER(s.name) = UPPER($4)
         LIMIT 1`,
        [schoolId, isClassUuid ? classId : '00000000-0000-0000-0000-000000000000', clsNum, secName]
      ).catch(() => ({ rowCount: 0, rows: [] }));
    }
    if (!valid.rowCount) {
      valid = await pool.query(
        `SELECT s.id AS section_id, s.name AS section_name, c.id AS class_id, c.class_number 
         FROM sections s 
         JOIN classes c ON c.id = s.class_id 
         WHERE s.school_id = $1 
           AND (${isClassUuid ? 'c.id = $2' : 'FALSE'} OR c.class_number = $3)
         LIMIT 1`,
        [schoolId, isClassUuid ? classId : '00000000-0000-0000-0000-000000000000', clsNum]
      ).catch(() => ({ rowCount: 0, rows: [] }));
    }

    if (valid.rowCount && valid.rows.length > 0) {
      realSectionId = valid.rows[0].section_id;
      realClassId = valid.rows[0].class_id;
      clsNum = valid.rows[0].class_number;
      secName = valid.rows[0].section_name;
    } else {
      // Guarantee class and section exist in Supabase
      let clsQ = await pool.query(`SELECT id, class_number FROM classes WHERE school_id=$1 AND class_number=$2 LIMIT 1`, [schoolId, clsNum]);
      if (!clsQ.rowCount) {
        clsQ = await pool.query(
          `INSERT INTO classes(school_id, class_number, name) VALUES($1, $2, $3)
           ON CONFLICT (school_id, class_number) DO UPDATE SET class_number=EXCLUDED.class_number RETURNING id, class_number`,
          [schoolId, clsNum, clsNum === -1 ? 'L-KG' : clsNum === 0 ? 'U-KG' : `Class ${clsNum}`]
        );
      }
      realClassId = clsQ.rows[0].id;
      clsNum = clsQ.rows[0].class_number;

      let secQ = await pool.query(`SELECT id, name FROM sections WHERE school_id=$1 AND class_id=$2 AND UPPER(name)=UPPER($3) LIMIT 1`, [schoolId, realClassId, secName]);
      if (!secQ.rowCount) {
        secQ = await pool.query(
          `INSERT INTO sections(school_id, class_id, name) VALUES($1, $2, $3)
           ON CONFLICT (class_id, name) DO UPDATE SET name=EXCLUDED.name RETURNING id, name`,
          [schoolId, realClassId, secName]
        );
      }
      realSectionId = secQ.rows[0].id;
      secName = secQ.rows[0].name;
    }

    let linkedUserId: string | null = null;
    let targetLoginEmail = '';
    if (loginOpt === 'STUDENT' && cleanStudentEmail) {
      targetLoginEmail = cleanStudentEmail;
    } else if (loginOpt === 'PARENT' && cleanParentEmail) {
      targetLoginEmail = cleanParentEmail;
    } else if (cleanStudentEmail) {
      targetLoginEmail = cleanStudentEmail;
    } else if (cleanParentEmail) {
      targetLoginEmail = cleanParentEmail;
    }

    // Handle Student Portal Login Account Creation
    if (targetLoginEmail && loginOpt !== 'NONE') {
      try {
        const userCheck = await pool.query(`SELECT id FROM users WHERE LOWER(email)=$1 LIMIT 1`, [targetLoginEmail]);
        if (userCheck.rowCount && userCheck.rowCount > 0) {
          linkedUserId = userCheck.rows[0].id;
        } else {
          const tempPass = crypto.randomBytes(8).toString('hex') + 'Aa1!';
          const tempHash = await bcrypt.hash(tempPass, 10);
          const uq = await pool.query(
            `INSERT INTO users(school_id, name, email, password_hash, role) VALUES($1, $2, $3, $4, 'STUDENT') RETURNING id`,
            [schoolId, name, targetLoginEmail, tempHash]
          );
          linkedUserId = uq.rows[0].id;
        }
      } catch (uErr: any) {
        console.warn('[StudentEnrollment] User creation warning:', uErr.message);
      }

      if (sendInviteEmail) {
        try {
          resetInfo = await createAndSendPasswordReset({
            email: targetLoginEmail,
            name,
            role: loginOpt === 'PARENT' ? 'PARENT' : 'STUDENT',
            userId: linkedUserId || undefined,
            schoolId: req.user?.schoolId || undefined,
            schoolName: req.user?.schoolName || 'School',
            req
          });
          if (resetInfo?.resetUrl) {
            const isParent = loginOpt === 'PARENT';
            queueEmailNotification({
              schoolId: req.user?.schoolId || 'school-default',
              recipientEmail: targetLoginEmail,
              recipientName: isParent ? (parentName || 'Parent') : name,
              recipientType: isParent ? 'PARENT' : 'STUDENT',
              templateKey: isParent ? 'PARENT_CREATED' : 'STUDENT_CREATED',
              templateData: {
                student_name: name,
                school_name: req.user?.schoolName || 'School',
                admission_number: cleanAdmissionNumber || '—',
                class_name: String(clsNum),
                section_name: secName,
                roll_number: String(rollNumber),
                reset_link: resetInfo.resetUrl
              },
              idempotencyKey: `stu-welcome-${req.user?.schoolId || 'default'}-${targetLoginEmail}`
            }).catch(() => {});
          }
        } catch (e: any) {
          console.warn('[StudentEnrollment] Failed to send student reset email:', e.message);
        }
      }
    } else {
      console.log(`[StudentEnrollment] SKIPPED email notification - No email address provided for student "${name}" (Roll: ${rollNumber})`);
    }

    const isRealClassUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(realClassId));
    const isRealSecUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(realSectionId));

    if (isRealClassUuid && isRealSecUuid) {
      let pgAyId: string | null = null;
      if (resolvedSessionId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(resolvedSessionId))) {
        const ayChk = await pool.query('SELECT id, name FROM academic_years WHERE id=$1 AND school_id=$2', [resolvedSessionId, schoolId]);
        if (ayChk.rowCount && ayChk.rows.length > 0) {
          pgAyId = ayChk.rows[0].id;
          if (!resolvedSessionName) resolvedSessionName = ayChk.rows[0].name;
        }
      }
      if (!pgAyId) {
        const ayRow = await pool.query('SELECT id, name FROM academic_years WHERE school_id=$1 AND is_active=true LIMIT 1', [schoolId]);
        if (ayRow.rowCount && ayRow.rows.length > 0) {
          pgAyId = ayRow.rows[0].id;
          if (!resolvedSessionName) resolvedSessionName = ayRow.rows[0].name;
        }
      }

      let pgUserId: string | null = null;
      if (linkedUserId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(linkedUserId))) {
        const uLinkChk = await pool.query('SELECT id FROM students WHERE user_id=$1 LIMIT 1', [linkedUserId]);
        if (!uLinkChk.rowCount) {
          pgUserId = linkedUserId;
        }
      }

      const safeParentSms = parentSmsNumber ? String(parentSmsNumber).trim() : '';
      const q = await pool.query(
        `INSERT INTO students(
          school_id, academic_year_id, class_id, section_id, roll_number, 
          admission_number, name, parent_name, parent_sms_number, email, parent_email, user_id,
          date_of_birth, gender, address
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (class_id, section_id, roll_number) DO UPDATE SET
          name = EXCLUDED.name,
          admission_number = COALESCE(EXCLUDED.admission_number, students.admission_number),
          parent_name = COALESCE(EXCLUDED.parent_name, students.parent_name),
          parent_sms_number = EXCLUDED.parent_sms_number,
          email = COALESCE(EXCLUDED.email, students.email),
          parent_email = COALESCE(EXCLUDED.parent_email, students.parent_email),
          date_of_birth = COALESCE(EXCLUDED.date_of_birth, students.date_of_birth),
          gender = COALESCE(EXCLUDED.gender, students.gender),
          address = COALESCE(EXCLUDED.address, students.address),
          is_active = true,
          updated_at = NOW()
        RETURNING *`,
        [
          schoolId,
          pgAyId,
          realClassId,
          realSectionId,
          String(rollNumber),
          cleanAdmissionNumber || null,
          name,
          parentName || null,
          safeParentSms,
          cleanStudentEmail || null,
          cleanParentEmail || null,
          pgUserId,
          dob || null,
          gender || null,
          address || null
        ]
      );
      
      const created = {
        ...q.rows[0],
        academic_year_id: resolvedSessionId || pgAyId,
        session_id: resolvedSessionId || pgAyId,
        session_name: resolvedSessionName,
        session: resolvedSessionName || resolvedSessionId,
        full_name: name,
        first_name: firstName || null,
        last_name: lastName || null,
        class_id: realClassId,
        section_id: realSectionId,
        class_number: clsNum,
        section_name: secName,
        admission_number: cleanAdmissionNumber || q.rows[0].admission_number,
        admissionNumber: cleanAdmissionNumber || q.rows[0].admission_number,
        student_email: cleanStudentEmail,
        parent_email: cleanParentEmail,
        parent_phone: safeParentSms,
        parentPhone: safeParentSms,
        login_email: targetLoginEmail,
        login_option: loginOpt,
        reset_url: resetInfo?.resetUrl,
        invite_sent: Boolean(resetInfo),
        is_active: true
      };
      demoStudents.unshift(created);
      syncStudentToFirestore(created).catch(() => {});
      return res.status(201).json(created);
    }
  } catch (err: any) {
    console.error('[StudentEnrollment] Supabase student insert error:', err.message);
  }

 // Demo In-Memory Fallback
 const targetLoginEmail = loginOpt === 'PARENT' ? cleanParentEmail : cleanStudentEmail || cleanParentEmail;
 if (targetLoginEmail && loginOpt !== 'NONE' && sendInviteEmail) {
   try {
     resetInfo = await createAndSendPasswordReset({
       email: targetLoginEmail,
       name,
       role: loginOpt === 'PARENT' ? 'PARENT' : 'STUDENT',
       schoolId: req.user?.schoolId || undefined,
       schoolName: req.user?.schoolName || 'School',
       req
     });
     registerDemoUser({
       id: `usr-st-${Date.now()}`,
       schoolId: req.user!.schoolId,
       name,
       email: targetLoginEmail,
       role: 'STUDENT',
       password: 'ChangeMe123!'
     });
     if (resetInfo?.resetUrl) {
       const isParent = loginOpt === 'PARENT';
       queueEmailNotification({
         schoolId: req.user?.schoolId || 'school-default',
         recipientEmail: targetLoginEmail,
         recipientName: isParent ? (parentName || 'Parent') : name,
         recipientType: isParent ? 'PARENT' : 'STUDENT',
         templateKey: isParent ? 'PARENT_CREATED' : 'STUDENT_CREATED',
         templateData: {
           student_name: name,
           school_name: req.user?.schoolName || 'School',
           class_name: String(clsNum),
           section_name: secName,
           reset_link: resetInfo.resetUrl
         },
         idempotencyKey: `stu-welcome-${req.user?.schoolId || 'default'}-${targetLoginEmail}`
       }).catch(() => {});
     }
   } catch {}
 } else if (!targetLoginEmail) {
   console.log(`[StudentEnrollment] SKIPPED email notification - No email address provided for student "${name}" (Roll: ${rollNumber})`);
 }

 const newStudent = {
   id: `st-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
   school_id: req.user!.schoolId,
   schoolId: req.user!.schoolId,
   academic_year_id: resolvedSessionId,
   session_id: resolvedSessionId,
   session_name: resolvedSessionName,
   session: resolvedSessionName || resolvedSessionId,
   name,
   full_name: name,
   first_name: firstName || null,
   last_name: lastName || null,
   roll_number: rollNumber,
   admission_number: cleanAdmissionNumber || `ADM-${Date.now().toString().slice(-4)}`,
   admissionNumber: cleanAdmissionNumber || `ADM-${Date.now().toString().slice(-4)}`,
   parent_name: parentName || '—',
   parent_sms_number: parentSmsNumber,
   email: cleanStudentEmail,
   student_email: cleanStudentEmail,
   parent_email: cleanParentEmail,
   class_number: clsNum,
   section_name: secName,
   class_id: classId,
   section_id: sectionId,
   user_id: null,
   login_option: loginOpt,
   reset_url: resetInfo?.resetUrl,
   invite_sent: Boolean(resetInfo),
   is_active: true
 };
 demoStudents.unshift(newStudent);
 syncStudentToFirestore(newStudent).catch(() => {});
 return res.status(201).json(newStudent);
});

interface ParsedClassResult {
  valid: boolean;
  classNumber: number;
  classId: string;
  classLabel: string;
  error?: string;
}

function parseClassValue(rawVal: any, fallbackClass?: string | number): ParsedClassResult {
  let val = String(rawVal ?? '').trim();

  if (!val && fallbackClass !== undefined && fallbackClass !== null && String(fallbackClass).trim() !== '') {
    val = String(fallbackClass).trim();
  }

  if (!val) {
    return {
      valid: false,
      classNumber: 1,
      classId: 'cls-1',
      classLabel: '',
      error: 'Class is required'
    };
  }

  // Kindergarten string checks
  if (/^l\.?kg$/i.test(val) || /^l-kg$/i.test(val) || /^lower\s*kg$/i.test(val)) {
    return { valid: true, classNumber: -1, classId: 'cls-lkg', classLabel: 'L-KG' };
  }
  if (/^u\.?kg$/i.test(val) || /^u-kg$/i.test(val) || /^upper\s*kg$/i.test(val)) {
    return { valid: true, classNumber: 0, classId: 'cls-ukg', classLabel: 'U-KG' };
  }

  const clean = val.toLowerCase();

  // Roman Numeral lookup (I to XII)
  const ROMAN_MAP: Record<string, number> = {
    i: 1,
    ii: 2,
    iii: 3,
    iv: 4,
    v: 5,
    vi: 6,
    vii: 7,
    viii: 8,
    ix: 9,
    x: 10,
    xi: 11,
    xii: 12,
  };

  if (Object.prototype.hasOwnProperty.call(ROMAN_MAP, clean)) {
    const num = ROMAN_MAP[clean];
    return { valid: true, classNumber: num, classId: `cls-${num}`, classLabel: `Class ${num}` };
  }

  // Numeric string e.g. "10", "Class 10", "Grade 5", "Std 8"
  const cleanNoPrefix = val.replace(/^(class|grade|std|standard)\s*/i, '').trim();
  if (/^\d+$/.test(cleanNoPrefix)) {
    const num = parseInt(cleanNoPrefix, 10);
    if (num >= 1 && num <= 12) {
      return { valid: true, classNumber: num, classId: `cls-${num}`, classLabel: `Class ${num}` };
    }
  }

  // Numeric classNumber passed directly e.g. -1 (LKG) or 0 (UKG) or 1..12
  if (typeof rawVal === 'number') {
    if (rawVal === -1) return { valid: true, classNumber: -1, classId: 'cls-lkg', classLabel: 'L-KG' };
    if (rawVal === 0) return { valid: true, classNumber: 0, classId: 'cls-ukg', classLabel: 'U-KG' };
    if (rawVal >= 1 && rawVal <= 12) {
      return { valid: true, classNumber: rawVal, classId: `cls-${rawVal}`, classLabel: `Class ${rawVal}` };
    }
  }

  // Invalid class value
  return {
    valid: false,
    classNumber: 1,
    classId: 'cls-1',
    classLabel: val,
    error: `Invalid Class '${val}'. Expected 1–12, Roman numerals (I–XII), LKG, or UKG.`
  };
}

r.post('/students/bulk-import',...admin,async(req:AuthRequest,res)=>{
 const {students=[],sessionId:reqSessionId}=req.body||{};
 if(!Array.isArray(students)||students.length===0) return res.status(400).json({message:'Array of student records is required'});

 const schoolId = req.user!.schoolId;
 await ensureSchoolClassesAndSections(schoolId);

 // Resolve session for bulk import
 const { getInMemoryAcademicYears } = await import('./academicYears');
 const rawSession = String(reqSessionId || req.body?.session || students[0]?.session || '').trim();
 let bulkSessionId: string | null = null;
 let bulkSessionName: string | null = null;
 try {
   const ayQ = await pool.query(
     `SELECT id, name, is_active FROM academic_years WHERE school_id=$1 AND is_archived=false`,
     [schoolId]
   );
   if (ayQ.rowCount && ayQ.rows.length > 0) {
     if (rawSession) {
       const found = ayQ.rows.find((r: any) => r.id === rawSession || isSameSession(r.name, rawSession));
       if (found) {
         bulkSessionId = found.id;
         bulkSessionName = found.name;
       }
     }
     if (!bulkSessionId) {
       const active = ayQ.rows.find((r: any) => r.is_active) || ayQ.rows[0];
       bulkSessionId = active.id;
       bulkSessionName = active.name;
     }
   }
 } catch (ayErr) {
   console.warn('[bulk-import] Error resolving academic year from DB:', ayErr);
 }

 // If not found in DB but rawSession provided, insert academic year into DB so it has a valid UUID
 if (!bulkSessionId && rawSession) {
   try {
     const canonical = toCanonicalSession(rawSession);
     const sessionDisplayName = canonical ? `${canonical} Academic Session` : rawSession;
     const newAy = await pool.query(
       `INSERT INTO academic_years(school_id, name, is_active) VALUES($1, $2, false) RETURNING id, name`,
       [schoolId, sessionDisplayName]
     );
     if (newAy.rowCount && newAy.rows.length > 0) {
       bulkSessionId = newAy.rows[0].id;
       bulkSessionName = newAy.rows[0].name;
     }
   } catch {}
 }

 if (!bulkSessionId) {
   const memYears = getInMemoryAcademicYears(schoolId);
   const target = rawSession ? memYears.find(y=>(y.id===rawSession||isSameSession(y.name,rawSession))&&!y.is_archived) : memYears.find(y=>y.is_active&&!y.is_archived);
   bulkSessionId = target?.id || null;
   bulkSessionName = target?.name || null;
 }

 const REQUIRED_HEADERS = ['First Name','Last Name','Admission Number','Roll Number','Parent Name','Parent Phone','Parent Email','Student Email'];

  // Preload existing classes and sections to eliminate duplicate DB queries per row
  const classMap = new Map<number, string>();
  const sectionMap = new Map<string, string>();
  try {
    const clsQ = await pool.query(`SELECT id, class_number FROM classes WHERE school_id=$1`, [schoolId]);
    for (const r of clsQ.rows) classMap.set(Number(r.class_number), r.id);

    const secQ = await pool.query(`SELECT id, class_id, UPPER(name) as name FROM sections WHERE school_id=$1`, [schoolId]);
    for (const r of secQ.rows) sectionMap.set(`${r.class_id}_${r.name}`, r.id);
  } catch (preloadErr) {
    console.warn('[bulk-import] Notice preloading classes/sections:', preloadErr);
  }

  // Pre-resolve all classes & sections needed in this batch in a single pass before the row loop
  const neededClasses = new Set<number>();
  const neededSections = new Set<string>(); // "classNumber:sectionName"
  for (const st of students) {
    const rawClassVal = (st.classNumber !== undefined && st.classNumber !== null && st.classNumber !== '') 
      ? st.classNumber 
      : (st.classLabel || st['Class'] || st.class_number || '');
    const parsed = parseClassValue(rawClassVal);
    if (parsed.valid) {
      neededClasses.add(parsed.classNumber);
    }

    let sn = String(st.sectionName || st['Section'] || st.section_name || 'A').replace(/^section\s*/i, '').trim().toUpperCase() || 'A';
    if (parsed.valid) {
      neededSections.add(`${parsed.classNumber}:${sn}`);
    }
  }

  for (const cn of neededClasses) {
    if (!classMap.has(cn)) {
      try {
        const clsQ = await pool.query(
          `INSERT INTO classes(school_id, class_number) VALUES($1, $2)
           ON CONFLICT (school_id, class_number) DO UPDATE SET class_number=EXCLUDED.class_number RETURNING id`,
          [schoolId, cn]
        );
        if (clsQ.rows.length > 0) {
          classMap.set(cn, clsQ.rows[0].id);
        }
      } catch (csErr) {
        console.warn('[bulk-import] Failed to create class:', csErr);
      }
    }
  }

  for (const item of neededSections) {
    const [cnStr, sn] = item.split(':');
    const cn = Number(cnStr);
    const cId = classMap.get(cn);
    if (cId && !sectionMap.has(`${cId}_${sn}`)) {
      try {
        const secQ = await pool.query(
          `INSERT INTO sections(school_id, class_id, name) VALUES($1, $2, $3)
           ON CONFLICT (class_id, name) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
          [schoolId, cId, sn]
        );
        if (secQ.rows.length > 0) {
          sectionMap.set(`${cId}_${sn}`, secQ.rows[0].id);
        }
      } catch (csErr) {
        console.warn('[bulk-import] Failed to create section:', csErr);
      }
    }
  }

  // Validate rows and collect errors (100% in-memory pre-validation)
  const validRows: any[] = [];
  const errors: { row: number; field: string; message: string }[] = [];
  const seenAdmNums = new Set<string>();
  const seenRollKeys = new Set<string>();
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  for (let i = 0; i < students.length; i++) {
    const st = students[i];
    const rowNum = i + 1;
    let firstName = String(st.firstName || st['First Name'] || st.first_name || '').trim();
    let lastName  = String(st.lastName || st['Last Name'] || st.last_name || '').trim();
    const rawFullName = String(st.fullName || st['Full Name'] || st.full_name || st.name || '').trim();
    if ((!firstName || !lastName) && rawFullName) {
      const parts = rawFullName.split(' ');
      if (!firstName) firstName = parts[0] || '';
      if (!lastName) lastName = parts.slice(1).join(' ') || '';
    }
    const name = rawFullName || (firstName && lastName ? `${firstName} ${lastName}` : (firstName || lastName || String(st.name || '').trim()));
    const rollNumber = String(st.rollNumber || st['Roll Number'] || st.roll_number || '').trim();
    const admissionNumber = String(st.admissionNumber || st['Admission Number'] || st.admission_number || '').trim();
    const parentName = String(st.parentName || st['Parent Name'] || st.parent_name || '').trim();
    const parentPhone = String(st.parentPhone || st['Parent Phone'] || st.parentSmsNumber || st.parent_sms_number || '').trim();
    const parentEmail = String(st.parentEmail || st['Parent Email'] || st.parent_email || '').trim();
    const studentEmail = String(st.studentEmail || st['Student Email'] || st.email || '').trim();
    const gender = String(st.gender || st['Gender'] || st['gender'] || st.sex || st['Sex'] || '').trim() || null;

    // Class/section resolution from in-memory preloaded maps
    const rawClassVal = (st.classNumber !== undefined && st.classNumber !== null && st.classNumber !== '') 
      ? st.classNumber 
      : (st.classLabel || st['Class'] || st.class_number || '');
    const rawSection = String(st.sectionName || st['Section'] || st.section_name || 'A');
    const parsedCls = parseClassValue(rawClassVal);
    const classNumber = parsedCls.classNumber;
    const classLabel = parsedCls.classLabel;

    let sectionName = rawSection.replace(/^section\s*/i, '').trim().toUpperCase() || 'A';

    let classId = classMap.get(classNumber) || `cls-${classNumber}`;
    let sectionId = (classId && sectionMap.get(`${classId}_${sectionName}`)) || `sec-${classId}-${sectionName.toLowerCase()}`;

    if (!firstName) errors.push({ row: rowNum, field: 'First Name', message: 'First Name is required' });
    if (!lastName)  errors.push({ row: rowNum, field: 'Last Name', message: 'Last Name is required' });
    if (!rollNumber) errors.push({ row: rowNum, field: 'Roll Number', message: 'Roll Number is required' });
    if (!admissionNumber) errors.push({ row: rowNum, field: 'Admission Number', message: 'Admission Number is required' });
    if (!parentPhone) errors.push({ row: rowNum, field: 'Parent Phone', message: 'Parent Phone is required' });
    if (!parsedCls.valid) errors.push({ row: rowNum, field: 'Class', message: parsedCls.error || 'Invalid class' });
    if (admissionNumber && seenAdmNums.has(admissionNumber)) errors.push({ row: rowNum, field: 'Admission Number', message: `Duplicate admission number '${admissionNumber}' in this batch` });
    if (admissionNumber) seenAdmNums.add(admissionNumber);

    const rollKey = `${classNumber}_${sectionName}_${rollNumber}`;
    if (seenRollKeys.has(rollKey)) {
      errors.push({ row: rowNum, field: 'Roll Number', message: `Duplicate roll number '${rollNumber}' for ${classLabel} Section ${sectionName} in this file` });
    } else {
      seenRollKeys.add(rollKey);
    }

    if (studentEmail && !EMAIL_REGEX.test(studentEmail)) {
      errors.push({ row: rowNum, field: 'Student Email', message: `Invalid student email format '${studentEmail}'` });
    }
    if (parentEmail && !EMAIL_REGEX.test(parentEmail)) {
      errors.push({ row: rowNum, field: 'Parent Email', message: `Invalid parent email format '${parentEmail}'` });
    }

    if (errors.filter(e => e.row === rowNum).length === 0) {
      validRows.push({ firstName, lastName, name, rollNumber, admissionNumber, gender, parentName, parentPhone, parentEmail, studentEmail, classId, classNumber, classLabel, sectionId, sectionName });
    }
  }

  // Strict All-or-Nothing Pre-Validation Guarantee: If ANY row has errors, abort entire import
  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      errors,
      message: `Validation failed for ${errors.length} record(s). The entire import has been cancelled and no data was stored in the database.`
    });
  }

  const createdList: any[] = [];

  // PostgreSQL Atomic Transaction
  if (isPostgresConfigured) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const isAyUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(bulkSessionId));
      const safeAyId = isAyUuid ? bulkSessionId : null;

      // 1. Pre-fetch existing students ONLY for admission numbers in the current batch
      const existingAdmMap = new Map<string, string>();
      const batchAdmNums = validRows.map(r => r.admissionNumber).filter(Boolean);
      if (batchAdmNums.length > 0) {
        const existStudentsQ = await client.query(
          `SELECT id, admission_number FROM students WHERE school_id = $1 AND admission_number = ANY($2::text[])`,
          [schoolId, batchAdmNums]
        );
        for (const row of existStudentsQ.rows) {
          if (row.admission_number) existingAdmMap.set(row.admission_number, row.id);
        }
      }

      // 2. Partition into updates (existing admission number) and inserts (new records)
      const toUpdate: any[] = [];
      const toInsert: any[] = [];
      for (const st of validRows) {
        if (st.admissionNumber && existingAdmMap.has(st.admissionNumber)) {
          toUpdate.push(st);
        } else {
          toInsert.push(st);
        }
      }

      // 3. Process existing record updates (atomic — any failure aborts entire transaction)
      for (const st of toUpdate) {
        const existId = existingAdmMap.get(st.admissionNumber);
        const upQ = await client.query(
          `UPDATE students SET
             name = $1,
             gender = COALESCE($2, gender),
             class_id = $3,
             section_id = $4,
             roll_number = $5,
             parent_name = COALESCE($6, parent_name),
             parent_sms_number = $7,
             email = COALESCE($8, email),
             parent_email = COALESCE($9, parent_email),
             academic_year_id = COALESCE($10, academic_year_id),
             is_active = true,
             updated_at = NOW()
           WHERE id = $11
           RETURNING *`,
          [st.name, st.gender || null, st.classId, st.sectionId, String(st.rollNumber), st.parentName || null, st.parentPhone, st.studentEmail || null, st.parentEmail || null, safeAyId, existId]
        );
        if (upQ.rowCount && upQ.rows.length > 0) {
          createdList.push({
            ...upQ.rows[0],
            gender: upQ.rows[0].gender || st.gender || null,
            academic_year_id: bulkSessionId,
            session_id: bulkSessionId,
            session_name: bulkSessionName,
            session: bulkSessionName || bulkSessionId,
            full_name: st.name,
            class_number: st.classNumber,
            class_label: st.classLabel,
            section_name: st.sectionName,
            is_active: true
          });
        } else {
          throw new Error(`Failed to update student with admission number ${st.admissionNumber}`);
        }
      }

      // 4. Fast Bulk Multi-Row Insert for new records
      if (toInsert.length > 0) {
        const CHUNK_SIZE = 500;
        for (let c = 0; c < toInsert.length; c += CHUNK_SIZE) {
          const chunk = toInsert.slice(c, c + CHUNK_SIZE);
          const valuesChunks: string[] = [];
          const params: any[] = [schoolId, safeAyId];
          let pIdx = 3;

          for (const st of chunk) {
            valuesChunks.push(`($1, $2, $${pIdx}, $${pIdx+1}, $${pIdx+2}, $${pIdx+3}, $${pIdx+4}, $${pIdx+5}, $${pIdx+6}, $${pIdx+7}, $${pIdx+8}, $${pIdx+9}, null)`);
            params.push(
              st.classId,
              st.sectionId,
              String(st.rollNumber),
              st.admissionNumber || null,
              st.name,
              st.gender || null,
              st.parentName || null,
              st.parentPhone,
              st.studentEmail || null,
              st.parentEmail || null
            );
            pIdx += 10;
          }

          const insertSql = `
            INSERT INTO students(
              school_id, academic_year_id, class_id, section_id, roll_number, 
              admission_number, name, gender, parent_name, parent_sms_number, email, parent_email, user_id
            )
            VALUES ${valuesChunks.join(', ')}
            ON CONFLICT (class_id, section_id, roll_number) DO UPDATE SET
              name = EXCLUDED.name,
              admission_number = COALESCE(EXCLUDED.admission_number, students.admission_number),
              gender = COALESCE(EXCLUDED.gender, students.gender),
              parent_name = COALESCE(EXCLUDED.parent_name, students.parent_name),
              parent_sms_number = EXCLUDED.parent_sms_number,
              email = COALESCE(EXCLUDED.email, students.email),
              parent_email = COALESCE(EXCLUDED.parent_email, students.parent_email),
              academic_year_id = COALESCE(EXCLUDED.academic_year_id, students.academic_year_id),
              is_active = true,
              updated_at = NOW()
            RETURNING *
          `;

          const insQ = await client.query(insertSql, params);
          const metaMap = new Map<string, any>();
          for (const st of chunk) {
            metaMap.set(`${st.classId}_${st.sectionId}_${st.rollNumber}`, st);
          }
          for (const row of insQ.rows) {
            const meta = metaMap.get(`${row.class_id}_${row.section_id}_${row.roll_number}`);
            createdList.push({
              ...row,
              gender: row.gender || meta?.gender || null,
              academic_year_id: bulkSessionId,
              session_id: bulkSessionId,
              session_name: bulkSessionName,
              session: bulkSessionName || bulkSessionId,
              full_name: row.name,
              class_number: meta?.classNumber,
              class_label: meta?.classLabel,
              section_name: meta?.sectionName,
              is_active: true
            });
          }
        }
      }

      // Strict sanity check: createdList length must match validRows length
      if (createdList.length !== validRows.length) {
        throw new Error(`Incomplete batch insert: processed ${createdList.length} of ${validRows.length} records`);
      }

      await client.query('COMMIT');
      client.release();

      // Only now update in-memory store and Firestore
      if (createdList.length > 0) {
        demoStudents.unshift(...createdList.slice(0, 100));
        if (demoStudents.length > 5000) demoStudents.length = 5000;
      }

      // Background Firestore sync (non-blocking bulk batch)
      if (isFirebaseConfigured()) {
        setImmediate(() => {
          syncStudentsBulkToFirestore(createdList.slice(0, 500)).catch(() => {});
        });
      }

      // Student Email Automation on Bulk Import (only executed if explicitly requested)
      const sendInviteEmail = req.body?.sendInviteEmail === true;
      if (sendInviteEmail && createdList.length > 0) {
        setImmediate(async () => {
          for (const st of createdList) {
            const studentEmail = String(st.email || st.student_email || '').trim().toLowerCase();
            const parentEmail = String(st.parent_email || '').trim().toLowerCase();
            const loginOption = st.login_option || st.loginOption || (studentEmail ? 'STUDENT' : (parentEmail ? 'PARENT' : 'NONE'));
            if (loginOption !== 'NONE') {
              const isParent = loginOption === 'PARENT';
              const targetLoginEmail = isParent ? (parentEmail || studentEmail) : (studentEmail || parentEmail);
              if (targetLoginEmail) {
                createAndSendPasswordReset({
                  email: targetLoginEmail,
                  name: st.name || st.full_name,
                  role: isParent ? 'PARENT' : 'STUDENT',
                  schoolId: schoolId || undefined,
                  schoolName: req.user?.schoolName || 'School',
                  req
                }).then(resetInfo => {
                  if (resetInfo?.resetUrl) {
                    queueEmailNotification({
                      schoolId: schoolId || 'school-default',
                      recipientEmail: targetLoginEmail,
                      recipientName: isParent ? (st.parent_name || 'Parent') : (st.name || st.full_name),
                      recipientType: isParent ? 'PARENT' : 'STUDENT',
                      templateKey: isParent ? 'PARENT_CREATED' : 'STUDENT_CREATED',
                      templateData: {
                        student_name: st.name || st.full_name,
                        school_name: req.user?.schoolName || 'School',
                        class_name: String(st.class_number || st.class_name || ''),
                        section_name: String(st.section_name || 'A'),
                        roll_number: String(st.roll_number || ''),
                        reset_link: resetInfo.resetUrl
                      },
                      idempotencyKey: `stu-welcome-${schoolId || 'default'}-${targetLoginEmail}-${st.admission_number || Date.now()}`
                    }).catch(err => {
                      console.warn('[BulkStudentEnrollment] SMTP network/dispatch error:', err.message);
                    });
                  }
                }).catch(err => {
                  console.warn('[BulkStudentEnrollment] Error generating reset link:', err.message);
                });
              }
            }
          }
        });
      }

      return res.status(201).json({ success: true, count: createdList.length, items: createdList, session: bulkSessionName });
    } catch (txErr: any) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({
        success: false,
        message: `Student bulk import failed: ${txErr.message || 'Database transaction error'}. The entire operation was cancelled and no student records were stored in the database.`
      });
    }
  } else {
    // Non-Postgres fallback: Guarantee atomic all-or-nothing
    if (isFirebaseConfigured()) {
      try {
        const batch = collections.students().firestore.batch();
        const stagedList: any[] = [];
        for (const st of validRows) {
          const studentId = `st-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const docRef = collections.students().doc(studentId);
          const studentObj = {
            id: studentId,
            name: st.name,
            first_name: st.firstName || null,
            last_name: st.lastName || null,
            roll_number: st.rollNumber,
            admission_number: st.admissionNumber,
            admissionNumber: st.admissionNumber,
            gender: st.gender || null,
            parent_name: st.parentName || '—',
            parent_sms_number: st.parentPhone,
            parent_email: st.parentEmail,
            email: st.studentEmail,
            class_id: st.classId,
            class_number: st.classNumber,
            class_label: st.classLabel,
            section_id: st.sectionId,
            section_name: st.sectionName,
            school_id: schoolId,
            schoolId,
            academic_year_id: bulkSessionId,
            session_id: bulkSessionId,
            session_name: bulkSessionName,
            session: bulkSessionName || bulkSessionId,
            full_name: st.name,
            is_active: true
          };
          batch.set(docRef, studentObj);
          stagedList.push(studentObj);
        }
        await batch.commit();
        demoStudents.unshift(...stagedList.slice(0, 100));
        return res.status(201).json({ success: true, count: stagedList.length, items: stagedList, session: bulkSessionName });
      } catch (fsErr: any) {
        return res.status(500).json({
          success: false,
          message: `Bulk import failed in Cloud Firestore: ${fsErr.message}. The entire operation was cancelled and no data was saved.`
        });
      }
    } else {
      const stagedList: any[] = [];
      for (const st of validRows) {
        const studentObj = {
          id: `st-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: st.name,
          first_name: st.firstName || null,
          last_name: st.lastName || null,
          roll_number: st.rollNumber,
          admission_number: st.admissionNumber,
          admissionNumber: st.admissionNumber,
          gender: st.gender || null,
          parent_name: st.parentName || '—',
          parent_sms_number: st.parentPhone,
          parent_email: st.parentEmail,
          email: st.studentEmail,
          class_id: st.classId,
          class_number: st.classNumber,
          class_label: st.classLabel,
          section_id: st.sectionId,
          section_name: st.sectionName,
          school_id: schoolId,
          schoolId,
          academic_year_id: bulkSessionId,
          session_id: bulkSessionId,
          session_name: bulkSessionName,
          session: bulkSessionName || bulkSessionId,
          full_name: st.name,
          is_active: true
        };
        stagedList.push(studentObj);
      }
      demoStudents.unshift(...stagedList);
      return res.status(201).json({ success: true, count: stagedList.length, items: stagedList, session: bulkSessionName });
    }
  }
});

r.post('/students/bulk-delete', ...admin, async (req: AuthRequest, res) => {
  const { ids = [] } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: 'Array of IDs required' });
  const sid = req.user!.schoolId;
  const uuidIds = ids.filter(isUuid);

  if (isPostgresConfigured && uuidIds.length > 0) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Clean non-cascading FK references
      await client.query(`DELETE FROM attendance_records WHERE student_id = ANY($1::uuid[])`, [uuidIds]);
      await client.query(`DELETE FROM attendance_sync_items WHERE student_id = ANY($1::uuid[])`, [uuidIds]);
      await client.query(`DELETE FROM sms_logs WHERE student_id = ANY($1::uuid[])`, [uuidIds]);
      await client.query(`DELETE FROM student_promotions WHERE student_id = ANY($1::uuid[])`, [uuidIds]);

      // Collect user_ids if students have linked user accounts
      const userRes = await client.query(`SELECT user_id FROM students WHERE id = ANY($1::uuid[]) AND school_id = $2 AND user_id IS NOT NULL`, [uuidIds, sid]);
      const userIds = userRes.rows.map((r: any) => r.user_id).filter(Boolean);

      // 2. Permanently delete student records from PostgreSQL
      await client.query(`DELETE FROM students WHERE id = ANY($1::uuid[]) AND school_id = $2`, [uuidIds, sid]);

      // 3. Delete linked user login records if any
      if (userIds.length > 0) {
        await client.query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [userIds]);
      }

      await client.query('COMMIT');
    } catch (delErr: any) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[BulkDeleteStudents] Transaction error:', delErr);
      return res.status(400).json({ success: false, message: `Bulk delete failed: ${delErr.message}. No records were modified.` });
    } finally {
      client.release();
    }
  }

  const idSet = new Set(ids);
  for (let i = demoStudents.length - 1; i >= 0; i--) {
    if (idSet.has(demoStudents[i].id)) {
      demoStudents.splice(i, 1);
    }
  }
  for (const id of ids) {
    deleteStudentFromFirestore(String(id)).catch(() => {});
  }
  if (sid) {
    invalidateSchoolCache(sid);
  }
  res.json({ success: true, count: ids.length });
});

r.get('/students/:id', ...admin, async (req: AuthRequest, res) => {
  const studentId = String(req.params.id);
  const schoolId = req.user!.schoolId;

  try {
    const q = await pool.query(
      `SELECT st.id,st.name,st.roll_number,st.admission_number,st.parent_name,st.parent_sms_number,st.email AS student_email,st.parent_email,st.user_id,st.photo_url,
       st.academic_year_id, ay.name AS session_name,
       c.id class_id,c.class_number,sec.id section_id,sec.name section_name
       FROM students st 
       JOIN classes c ON c.id=st.class_id 
       JOIN sections sec ON sec.id=st.section_id
       LEFT JOIN academic_years ay ON ay.id=st.academic_year_id
       WHERE st.id=$1 AND st.school_id=$2 AND st.is_active=true LIMIT 1`,
      [studentId, schoolId]
    );
    if (q.rowCount && q.rows.length > 0) return res.json(q.rows[0]);
  } catch {}

  if (isFirebaseConfigured()) {
    try {
      const doc = await collections.students().doc(studentId).get();
      if (doc.exists) {
        return res.json({ id: doc.id, ...doc.data() });
      }
    } catch {}
  }

  const mem = demoStudents.find(s => s.id === studentId);
  if (mem) return res.json(mem);

  return res.status(404).json({ message: 'Student not found' });
});

r.put('/students/:id', ...admin, async (req: AuthRequest, res) => {
  const {
    name, firstName: rawFirst, lastName: rawLast,
    rollNumber, roll_number,
    admissionNumber, admission_number,
    parentName, parent_name,
    parentSmsNumber, parentPhone, parent_sms_number,
    studentEmail, email, parentEmail, parent_email,
    classId, class_id,
    sectionId, section_id,
    sessionId, session, academic_year_id,
    gender, dob, dateOfBirth, date_of_birth, address
  } = req.body || {};

  const studentId = String(req.params.id);
  const schoolId = req.user!.schoolId;

  const cleanStudentEmail = String(studentEmail || email || '').trim().toLowerCase();
  const cleanParentEmail = String(parentEmail || parent_email || '').trim().toLowerCase();
  const cleanAdmissionNumber = String(admissionNumber || admission_number || '').trim();
  const cleanRollNumber = String(rollNumber !== undefined ? rollNumber : (roll_number !== undefined ? roll_number : '')).trim();
  const cleanParentName = String(parentName !== undefined ? parentName : (parent_name !== undefined ? parent_name : '')).trim();
  const cleanParentPhone = String(parentSmsNumber !== undefined ? parentSmsNumber : (parentPhone !== undefined ? parentPhone : (parent_sms_number !== undefined ? parent_sms_number : ''))).trim();

  const firstName = String(rawFirst || '').trim();
  const lastName = String(rawLast || '').trim();
  const fullName = firstName && lastName ? `${firstName} ${lastName}` : (firstName || lastName || String(name || '').trim());

  const resolvedClassId = String(classId || class_id || '').trim();
  const resolvedSectionId = String(sectionId || section_id || '').trim();

  // Class number and section name resolution
  let putClsNum = 1;
  if (/l.?kg/i.test(resolvedClassId)) putClsNum = -1;
  else if (/u.?kg/i.test(resolvedClassId)) putClsNum = 0;
  else {
    const m = resolvedClassId.match(/cls-(\d+)/);
    if (m) putClsNum = Number(m[1]);
    else if (/^\d+$/.test(resolvedClassId)) putClsNum = Number(resolvedClassId);
  }
  const strPutSecId = resolvedSectionId.toUpperCase();
  const putSecName = (strPutSecId === 'B' || strPutSecId.endsWith('-B') || strPutSecId.endsWith('_B')) ? 'B' : 'A';
  const putClassLabel = putClsNum === -1 ? 'L-KG' : putClsNum === 0 ? 'U-KG' : `Class ${putClsNum}`;

  const resolvedSession = String(session || sessionId || academic_year_id || '').trim();

  // Try PostgreSQL if available
  try {
    let realPutClassId = resolvedClassId;
    let realPutSectionId = resolvedSectionId;
    const isPutClassUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedClassId);
    const isPutSecUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedSectionId);

    if (!isPutClassUuid || !isPutSecUuid) {
      try {
        const v = await pool.query(
          `SELECT s.id AS section_id, c.id AS class_id 
           FROM sections s 
           JOIN classes c ON c.id = s.class_id 
           WHERE s.school_id = $1 
             AND (${isPutClassUuid ? 'c.id = $2' : 'FALSE'} OR c.class_number = $3)
             AND UPPER(s.name) = UPPER($4)
           LIMIT 1`,
          [schoolId, isPutClassUuid ? resolvedClassId : '00000000-0000-0000-0000-000000000000', putClsNum, putSecName]
        );
        if (v.rowCount && v.rows.length > 0) {
          realPutClassId = v.rows[0].class_id;
          realPutSectionId = v.rows[0].section_id;
        }
      } catch {}
    }

    const isStudentUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(studentId);
    const isAyUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedSession);

    const cleanGender = gender !== undefined ? (gender || null) : null;
    const cleanDob = (dob || dateOfBirth || date_of_birth) !== undefined ? (dob || dateOfBirth || date_of_birth || null) : null;
    const cleanAddress = address !== undefined ? (address || null) : null;

    if (isStudentUuid) {
      const q = await pool.query(
        `UPDATE students SET
           name=$1,
           roll_number=$2,
           admission_number=$3,
           parent_name=$4,
           parent_sms_number=$5,
           email=$6,
           parent_email=$7,
           class_id=$8,
           section_id=$9,
           academic_year_id=COALESCE($10, academic_year_id),
           gender=COALESCE($13, gender),
           date_of_birth=COALESCE($14, date_of_birth),
           address=COALESCE($15, address),
           updated_at=NOW()
         WHERE id=$11 AND school_id=$12 RETURNING *`,
        [fullName || name, cleanRollNumber, cleanAdmissionNumber || null, cleanParentName || null, cleanParentPhone || '', cleanStudentEmail || null, cleanParentEmail || null, realPutClassId, realPutSectionId, isAyUuid ? resolvedSession : null, studentId, schoolId, cleanGender, cleanDob, cleanAddress]
      );
      if (q.rowCount && q.rows.length > 0) {
        const result = {
          ...q.rows[0],
          name: fullName || q.rows[0].name,
          first_name: firstName || null,
          last_name: lastName || null,
          full_name: fullName || q.rows[0].name,
          roll_number: cleanRollNumber || q.rows[0].roll_number,
          rollNumber: cleanRollNumber || q.rows[0].roll_number,
          admission_number: cleanAdmissionNumber || q.rows[0].admission_number,
          admissionNumber: cleanAdmissionNumber || q.rows[0].admission_number,
          student_email: cleanStudentEmail || q.rows[0].email,
          email: cleanStudentEmail || q.rows[0].email,
          parent_email: cleanParentEmail || q.rows[0].parent_email,
          parent_name: cleanParentName || q.rows[0].parent_name,
          parentName: cleanParentName || q.rows[0].parent_name,
          parent_sms_number: cleanParentPhone || q.rows[0].parent_sms_number,
          parentPhone: cleanParentPhone || q.rows[0].parent_sms_number,
          gender: cleanGender !== null ? cleanGender : (q.rows[0].gender || null),
          date_of_birth: cleanDob !== null ? cleanDob : (q.rows[0].date_of_birth || null),
          dob: cleanDob !== null ? cleanDob : (q.rows[0].date_of_birth || null),
          address: cleanAddress !== null ? cleanAddress : (q.rows[0].address || null),
          class_id: realPutClassId || q.rows[0].class_id,
          classId: realPutClassId || q.rows[0].class_id,
          class_number: putClsNum,
          class_label: putClassLabel,
          section_id: realPutSectionId || q.rows[0].section_id,
          sectionId: realPutSectionId || q.rows[0].section_id,
          section_name: putSecName,
          session: resolvedSession || q.rows[0].session_name || q.rows[0].academic_year_id,
          session_name: resolvedSession || q.rows[0].session_name || q.rows[0].academic_year_id,
          academic_year_id: resolvedSession || q.rows[0].academic_year_id,
          is_active: true
        };
        const idx = demoStudents.findIndex(s => s.id === studentId);
        if (idx >= 0) demoStudents[idx] = { ...demoStudents[idx], ...result };
        else demoStudents.unshift(result);
        syncStudentToFirestore(result).catch(() => {});
        return res.json(result);
      }
    }
  } catch (err: any) {
    console.warn('[UpdateStudent] Database update warning:', err.message);
  }

  // Pure Cloud Firestore & in-memory update
  let existingFirestoreData: any = {};
  if (isFirebaseConfigured()) {
    try {
      const docSnap = await collections.students().doc(studentId).get();
      if (docSnap.exists) {
        existingFirestoreData = docSnap.data() || {};
      }
    } catch {}
  }

  const idx = demoStudents.findIndex(s => s.id === studentId);
  const existingMem = idx >= 0 ? demoStudents[idx] : {};

  const updated: any = {
    ...existingFirestoreData,
    ...existingMem,
    id: studentId,
    name: fullName || existingFirestoreData.name || existingMem.name || 'Student',
    full_name: fullName || existingFirestoreData.full_name || existingFirestoreData.name || existingMem.full_name || existingMem.name || 'Student',
    first_name: firstName || existingFirestoreData.first_name || existingMem.first_name || '',
    last_name: lastName || existingFirestoreData.last_name || existingMem.last_name || '',
    roll_number: cleanRollNumber || existingFirestoreData.roll_number || existingMem.roll_number || '',
    rollNumber: cleanRollNumber || existingFirestoreData.roll_number || existingMem.roll_number || '',
    admission_number: cleanAdmissionNumber || existingFirestoreData.admission_number || existingMem.admission_number || `ADM-${studentId}`,
    admissionNumber: cleanAdmissionNumber || existingFirestoreData.admission_number || existingMem.admission_number || `ADM-${studentId}`,
    parent_name: cleanParentName || existingFirestoreData.parent_name || existingMem.parent_name || '—',
    parentName: cleanParentName || existingFirestoreData.parent_name || existingMem.parent_name || '—',
    parent_sms_number: cleanParentPhone || existingFirestoreData.parent_sms_number || existingMem.parent_sms_number || '',
    parentPhone: cleanParentPhone || existingFirestoreData.parent_sms_number || existingMem.parent_sms_number || '',
    email: cleanStudentEmail || existingFirestoreData.email || existingMem.email || '',
    student_email: cleanStudentEmail || existingFirestoreData.student_email || existingMem.student_email || '',
    parent_email: cleanParentEmail || existingFirestoreData.parent_email || existingMem.parent_email || '',
    class_id: resolvedClassId || existingFirestoreData.class_id || existingMem.class_id || 'cls-1',
    classId: resolvedClassId || existingFirestoreData.class_id || existingMem.class_id || 'cls-1',
    class_number: putClsNum,
    class_label: putClassLabel,
    section_id: resolvedSectionId || existingFirestoreData.section_id || existingMem.section_id || 'sec-a',
    sectionId: resolvedSectionId || existingFirestoreData.section_id || existingMem.section_id || 'sec-a',
    section_name: putSecName,
    school_id: schoolId || existingFirestoreData.school_id || existingMem.school_id,
    schoolId: schoolId || existingFirestoreData.school_id || existingMem.school_id,
    academic_year_id: resolvedSession || existingFirestoreData.academic_year_id || existingMem.academic_year_id || null,
    session_id: resolvedSession || existingFirestoreData.session_id || existingMem.session_id || null,
    session_name: resolvedSession || existingFirestoreData.session_name || existingMem.session_name || null,
    session: resolvedSession || existingFirestoreData.session || existingMem.session || null,
    is_active: true,
    updated_at: new Date().toISOString()
  };

  if (idx >= 0) {
    demoStudents[idx] = { ...demoStudents[idx], ...updated };
  } else {
    demoStudents.unshift(updated);
  }

  syncStudentToFirestore(updated).catch(() => {});
  return res.json(updated);
});

r.post('/students/:id/send-reset-email',...admin,async(req:AuthRequest,res)=>{
  const studentId = String(req.params.id);
  let targetEmail = '';
  let studentName = 'Student';
  let role = 'STUDENT';
  let userId: string | undefined = undefined;

  try {
    const q = await pool.query(
      `SELECT st.id, st.name, st.email, st.parent_email, st.user_id, st.parent_name
       FROM students st WHERE st.id = $1 AND st.school_id = $2 LIMIT 1`,
      [studentId, req.user!.schoolId]
    );
    if (q.rowCount && q.rowCount > 0) {
      const st = q.rows[0];
      studentName = st.name;
      userId = st.user_id;
      if (st.email) {
        targetEmail = st.email;
      } else if (st.parent_email) {
        targetEmail = st.parent_email;
      }
    }
  } catch {}

  if (!targetEmail && isFirebaseConfigured()) {
    try {
      const doc = await collections.students().doc(studentId).get();
      if (doc.exists) {
        const dt = doc.data() || {};
        studentName = dt.name || dt.fullName || studentName;
        targetEmail = dt.student_email || dt.studentEmail || dt.email || dt.parent_email || dt.parentEmail || '';
        userId = dt.user_id || dt.userId || userId;
      }
    } catch {}
  }

  if (!targetEmail) {
    const demo = demoStudents.find(s => s.id === studentId);
    if (demo) {
      studentName = demo.name;
      targetEmail = demo.email || demo.student_email || demo.parent_email;
    }
  }

  if (!targetEmail) {
    return res.status(400).json({ message: 'No email address found for this student. Please add a student or parent email first.' });
  }

  const resetResult = await createAndSendPasswordReset({
    email: targetEmail,
    name: studentName,
    role: 'STUDENT',
    userId,
    schoolName: req.user?.schoolName,
    req
  });

  return res.json({
    success: true,
    message: `Password setup email dispatched to ${targetEmail} (Student Portal).`,
    email: targetEmail,
    resetUrl: resetResult.resetUrl
  });
});


r.delete('/students/:id',...admin,async(req:AuthRequest,res)=>{
  const sid = req.user!.schoolId;
  const targetId = String(req.params.id);
  if (isPostgresConfigured && isUuid(targetId)) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM attendance_records WHERE student_id = $1`, [targetId]);
      await client.query(`DELETE FROM attendance_sync_items WHERE student_id = $1`, [targetId]);
      await client.query(`DELETE FROM sms_logs WHERE student_id = $1`, [targetId]);
      await client.query(`DELETE FROM student_promotions WHERE student_id = $1`, [targetId]);

      const userRes = await client.query(`SELECT user_id FROM students WHERE id = $1 AND school_id = $2 AND user_id IS NOT NULL`, [targetId, sid]);
      const userId = userRes.rows[0]?.user_id;

      await client.query(`DELETE FROM students WHERE id = $1 AND school_id = $2`, [targetId, sid]);

      if (userId) {
        await client.query(`DELETE FROM users WHERE id = $1`, [userId]);
      }
      await client.query('COMMIT');
    } catch (delErr: any) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[DeleteStudent] Transaction error:', delErr);
      return res.status(400).json({ success: false, message: `Delete failed: ${delErr.message}` });
    } finally {
      client.release();
    }
  }
  const idx = demoStudents.findIndex(s => s.id === targetId);
  if (idx >= 0) demoStudents.splice(idx, 1);
  deleteStudentFromFirestore(targetId).catch(() => {});
  if (sid) {
    invalidateSchoolCache(sid);
  }
  res.json({success:true});
});

export function normalizeToDdMmYyyy(val: any): string | null {
  if (!val) return null;
  // If Excel serial number (e.g. 35000 -> date)
  if (typeof val === 'number' || (/^\d{4,5}$/.test(String(val).trim()) && !String(val).includes('-') && !String(val).includes('/'))) {
    const num = Number(val);
    if (!isNaN(num) && num > 1000 && num < 60000) {
      const date = new Date(Math.round((num - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) {
        const d = String(date.getUTCDate()).padStart(2, '0');
        const m = String(date.getUTCMonth() + 1).padStart(2, '0');
        const y = String(date.getUTCFullYear());
        return `${d}-${m}-${y}`;
      }
    }
  }

  const s = String(val).trim();
  // Check DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return `${d}-${m}-${y}`;
  }

  // Check YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = ymdMatch[2].padStart(2, '0');
    const d = ymdMatch[3].padStart(2, '0');
    return `${d}-${m}-${y}`;
  }

  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    const d = String(parsed.getDate()).padStart(2, '0');
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const y = String(parsed.getFullYear());
    return `${d}-${m}-${y}`;
  }

  return s;
}

// GET /teachers/template — standardized Excel import template
r.get('/teachers/template', ...reader, (_req, res) => {
  const XLSX = require('xlsx');
  const sample = [
    {
      'Savior_No': 'EMP010',
      'Fist Name': 'Sunita',
      'Last Name': 'Verma',
      'Full Name(Automatically generated)': 'Sunita Verma',
      'Email_id': 'sunita.v@school.local',
      'Gender': 'Female',
      'Date_of_Birth': '15-08-1990',
      'Class': 'Class 10',
      'Section': 'A',
      'Status': 'Active',
      'Designation': 'Senior Teacher'
    },
    {
      'Savior_No': 'EMP011',
      'Fist Name': 'Alok',
      'Last Name': 'Mishra',
      'Full Name(Automatically generated)': 'Alok Mishra',
      'Email_id': 'alok.m@school.local',
      'Gender': 'Male',
      'Date_of_Birth': '22-04-1988',
      'Class': 'Class 9',
      'Section': 'B',
      'Status': 'Active',
      'Designation': 'TGT Mathematics'
    },
    {
      'Savior_No': 'EMP012',
      'Fist Name': 'Rekha',
      'Last Name': 'Sengupta',
      'Full Name(Automatically generated)': 'Rekha Sengupta',
      'Email_id': 'rekha.s@school.local',
      'Gender': 'Female',
      'Date_of_Birth': '10-12-1992',
      'Class': 'Class 8',
      'Section': 'A',
      'Status': 'Active',
      'Designation': 'PRT Science'
    }
  ];
  const ws = XLSX.utils.json_to_sheet(sample);
  ws['!cols'] = [16, 14, 14, 24, 26, 12, 16, 12, 10, 12, 20].map(wch => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Teachers Import Template');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="teachers_import_template.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

r.get('/teachers',...reader,async(req:AuthRequest,res)=>{
 const userSchoolId = req.user?.schoolId;
 const cacheKey = userSchoolId ? `teachers:${userSchoolId}` : null;
 if (cacheKey) {
   const cached = fastCache.get<any>(cacheKey);
   if (cached) return res.json(cached);
 }

 try {
  const q=await pool.query(`SELECT u.id,u.name,u.email,tp.employee_id,tp.mobile,tp.gender,tp.designation,tp.class_name,tp.section_name,u.is_active,u.created_at
  FROM users u LEFT JOIN teacher_profiles tp ON tp.user_id=u.id
  WHERE u.school_id=$1 AND u.role='TEACHER' ORDER BY u.name`,[userSchoolId]);
  if (q.rows) {
    if (cacheKey) fastCache.set(cacheKey, q.rows, 30);
    return res.json(q.rows);
  }
 } catch {}

 if (isFirebaseConfigured()) {
  try {
    const snap = userSchoolId
      ? await collections.teachers().where('school_id', '==', userSchoolId).get()
      : await collections.teachers().get();
    if (!snap.empty) {
      let list = snap.docs.map(d => {
        const dt = d.data();
        const docSchoolId = dt.school_id || dt.schoolId;
        return {
          id: d.id,
          name: dt.name || dt.fullName || '',
          email: dt.email || '',
          employee_id: dt.employee_id || dt.employeeId || '',
          mobile: dt.mobile || dt.phone || '',
          gender: dt.gender || '',
          dob: dt.dob || dt.date_of_birth || '',
          date_of_birth: dt.dob || dt.date_of_birth || '',
          school_id: docSchoolId,
          schoolId: docSchoolId,
          is_active: dt.is_active !== false,
          ...dt
        };
      }).filter(t => {
        if (t.is_active === false) return false;
        if (!userSchoolId || !t.school_id) return false;
        return isSameSchool(t.school_id, userSchoolId);
      });

      for (const dt of demoTeachers) {
        if (!list.some(x => x.id === dt.id)) {
          if (dt.school_id && userSchoolId && isSameSchool(dt.school_id, userSchoolId)) {
            list.unshift(dt);
          }
        }
      }
      if (list.length > 0) return res.json(list);
    }
  } catch {}
 }

  // Check in-memory teachers registered for this specific school
  const memSchoolTeachers = demoTeachers.filter(t => t.school_id && userSchoolId && isSameSchool(t.school_id, userSchoolId));
  if (memSchoolTeachers.length > 0) {
    return res.json(memSchoolTeachers);
  }

  // Only Greenwood test school can access demo teachers
  if (isTestSchool(userSchoolId)) {
   const schoolTeachers = demoTeachers.filter(t => isSameSchool(t.school_id, userSchoolId));
   return res.json(schoolTeachers.length ? schoolTeachers : demoTeachers);
 }

 // Other schools start with 0 teachers before manual entry
 res.json([]);
});

r.post('/teachers',...admin,async(req:AuthRequest,res)=>{
  const {
    firstName: rawFirst, lastName: rawLast, fullName: rawFull, name: rawName,
    email, password, employeeId: rawEmp, saviorNo, Savior_No,
    mobile: rawMobile, designation: rawDesig,
    gender: rawGender, qualification: rawQual,
    dob: rawDob, dateOfBirth: rawDateOfBirth, date_of_birth: rawDate_of_birth,
    classId, sectionId, sendInviteEmail=true
  } = req.body;

  const firstName = String(rawFirst || '').trim();
  const lastName = String(rawLast || '').trim();
  const name = firstName && lastName ? `${firstName} ${lastName}` : (firstName || lastName || String(rawFull || rawName || '').trim());
  const employeeId = String(rawEmp || req.body?.employee_id || saviorNo || Savior_No || '').trim();
  const cleanEmail = String(email || '').trim().toLowerCase();
  const mobile = String(rawMobile || '').trim();
  const designation = String(rawDesig || 'Teacher').trim();
  const gender = String(rawGender || req.body?.gender || '').trim() || null;
  const qualification = String(rawQual || req.body?.qualification || '').trim() || null;
  const rawDobInput = rawDob || rawDateOfBirth || rawDate_of_birth || req.body?.dob || req.body?.date_of_birth;
  const dob = rawDobInput ? normalizeToDdMmYyyy(rawDobInput) : null;

  if (!name || !cleanEmail || !employeeId) {
    return res.status(400).json({ message: 'First Name/Name, valid email, and Employee ID/Savior_NO are required' });
  }

  // Email format validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ message: 'Invalid email format. Please provide a valid email address.' });
  }

  // Mobile validation: 10 digits if provided
  if (mobile && !/^\d{10}$/.test(mobile.replace(/[^0-9]/g, ''))) {
    return res.status(400).json({ message: 'Mobile number must be a 10-digit number.' });
  }

  // Check unique Employee ID / Savior_No within school tenant
  const dup = demoTeachers.find(t => t.school_id === req.user!.schoolId && (t.employee_id === employeeId || t.savior_no === employeeId));
  if (dup) {
    return res.status(400).json({ message: `Employee ID / Savior_NO '${employeeId}' already exists for this school.` });
  }

  if (password && String(password).trim()) {
    const pwValidation = validatePasswordStrength(String(password).trim());
    if (!pwValidation.valid) {
      return res.status(400).json({ message: pwValidation.message });
    }
  }

  const rawPassword = password || (crypto.randomBytes(8).toString('hex') + 'Tt1!');
  let resetInfo: any = null;
  let emailDeliveryStatus: 'Sent' | 'Failed' | 'Pending' = 'Pending';

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const hash = await bcrypt.hash(rawPassword, 10);
      const u = await client.query(
        `INSERT INTO users(school_id,name,email,password_hash,role) VALUES($1,$2,$3,$4,'TEACHER') RETURNING id,name,email`,
        [req.user!.schoolId, name, cleanEmail, hash]
      );
      await client.query(
        `INSERT INTO teacher_profiles(user_id,employee_id,mobile,gender,qualification) VALUES($1,$2,$3,$4,$5)`,
        [u.rows[0].id, employeeId, mobile || null, gender || null, qualification || null]
      );
      await client.query('COMMIT');
      
      // Automatic Teacher Welcome Email via SMTP
      if (sendInviteEmail) {
        try {
          resetInfo = await createAndSendPasswordReset({
            email: cleanEmail,
            name,
            role: 'TEACHER',
            userId: u.rows[0].id,
            schoolId: req.user?.schoolId || undefined,
            schoolName: req.user?.schoolName || 'School',
            req
          });
          if (resetInfo?.resetUrl) {
            await queueEmailNotification({
              schoolId: req.user?.schoolId || 'school-default',
              recipientEmail: cleanEmail,
              recipientName: name,
              recipientType: 'TEACHER',
              templateKey: 'TEACHER_CREATED',
              templateData: {
                teacher_name: name,
                school_name: req.user?.schoolName || 'School',
                employee_id: employeeId,
                login_url: resetInfo.resetUrl,
                temporary_password: rawPassword
              },
              idempotencyKey: `tch-welcome-${req.user?.schoolId || 'default'}-${cleanEmail}-${Date.now()}`
            });
            emailDeliveryStatus = 'Sent';
          }
        } catch (err: any) {
          console.warn('[TeacherOnboarding] Email invite failed:', err.message);
          emailDeliveryStatus = 'Failed';
        }
      }

      const created = {
        ...u.rows[0],
        name,
        full_name: name,
        first_name: firstName || null,
        last_name: lastName || null,
        employee_id: employeeId,
        savior_no: employeeId,
        designation,
        gender: gender || null,
        dob: dob || null,
        date_of_birth: dob || null,
        mobile: mobile || '—',
        email_status: emailDeliveryStatus,
        is_active: true,
        reset_url: resetInfo?.resetUrl,
        invite_sent: Boolean(resetInfo)
      };
      demoTeachers.unshift(created);
      syncTeacherToFirestore(created, hash).catch(() => {});
      return res.status(201).json(created);
    } catch(e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.warn('[TeacherOnboarding] Database fallback:', err.message);
  }

  // Automatic Teacher Welcome Email via SMTP in Fallback
  if (sendInviteEmail) {
    try {
      resetInfo = await createAndSendPasswordReset({
        email: cleanEmail,
        name,
        role: 'TEACHER',
        schoolId: req.user?.schoolId || undefined,
        schoolName: req.user?.schoolName || 'School',
        req
      });
      if (resetInfo?.resetUrl) {
        await queueEmailNotification({
          schoolId: req.user?.schoolId || 'school-default',
          recipientEmail: cleanEmail,
          recipientName: name,
          recipientType: 'TEACHER',
          templateKey: 'TEACHER_CREATED',
          templateData: {
            teacher_name: name,
            school_name: req.user?.schoolName || 'School',
            employee_id: employeeId,
            login_url: resetInfo.resetUrl,
            temporary_password: rawPassword
          },
          idempotencyKey: `tch-welcome-${req.user?.schoolId || 'default'}-${cleanEmail}-${Date.now()}`
        });
        emailDeliveryStatus = 'Sent';
      }
    } catch (err: any) {
      console.warn('[TeacherOnboarding] Fallback email invite failed:', err.message);
      emailDeliveryStatus = 'Failed';
    }
  }

  const newTeacher = {
    id: `tch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    school_id: req.user!.schoolId,
    schoolId: req.user!.schoolId,
    name,
    full_name: name,
    first_name: firstName || null,
    last_name: lastName || null,
    email: cleanEmail,
    employee_id: employeeId,
    savior_no: employeeId,
    designation,
    gender: gender || null,
    dob: dob || null,
    date_of_birth: dob || null,
    mobile: mobile || '—',
    email_status: emailDeliveryStatus,
    is_active: true,
    reset_url: resetInfo?.resetUrl,
    invite_sent: Boolean(resetInfo)
  };
  demoTeachers.unshift(newTeacher);
  registerDemoUser({
    id: newTeacher.id,
    schoolId: req.user!.schoolId,
    name,
    email: cleanEmail,
    role: 'TEACHER',
    password: rawPassword
  });
  syncTeacherToFirestore(newTeacher, rawPassword).catch(() => {});
  res.status(201).json(newTeacher);
});

r.post('/teachers/:id/send-reset-email',...admin,async(req:AuthRequest,res)=>{
  const teacherId = String(req.params.id);
  let teacherEmail = '';
  let teacherName = 'Teacher';
  let userId: string | undefined = undefined;

  try {
    const q = await pool.query(
      `SELECT u.id, u.name, u.email FROM users u WHERE u.id = $1 AND u.school_id = $2 AND u.role = 'TEACHER' LIMIT 1`,
      [teacherId, req.user!.schoolId]
    );
    if (q.rowCount && q.rowCount > 0) {
      userId = q.rows[0].id;
      teacherName = q.rows[0].name;
      teacherEmail = q.rows[0].email;
    }
  } catch {}

  if (!teacherEmail && isFirebaseConfigured()) {
    try {
      const doc = await collections.teachers().doc(teacherId).get();
      if (doc.exists) {
        const dt = doc.data() || {};
        teacherName = dt.name || dt.fullName || teacherName;
        teacherEmail = dt.email || '';
        userId = dt.user_id || dt.userId || userId;
      }
    } catch {}
  }

  if (!teacherEmail) {
    const demo = demoTeachers.find(t => t.id === teacherId);
    if (demo) {
      teacherEmail = demo.email;
      teacherName = demo.name;
    }
  }

  if (!teacherEmail) {
    return res.status(404).json({ message: 'Teacher record not found or has no email address.' });
  }

  const resetResult = await createAndSendPasswordReset({
    email: teacherEmail,
    name: teacherName,
    role: 'TEACHER',
    userId,
    schoolName: req.user?.schoolName,
    req
  });

  return res.json({
    success: true,
    message: `Password setup email dispatched to faculty member ${teacherEmail}.`,
    email: teacherEmail,
    resetUrl: resetResult.resetUrl
  });
});

r.post('/teachers/bulk-import',...admin,async(req:AuthRequest,res)=>{
  const { teachers = [] } = req.body || {};
  if (!Array.isArray(teachers) || teachers.length === 0) {
    return res.status(400).json({ message: 'Array of teacher records is required' });
  }

  const schoolId = req.user!.schoolId;
  const errors: { row: number; field: string; message: string }[] = [];
  const seenEmployeeIds = new Set<string>();
  const seenEmails = new Set<string>();
  const validRows: any[] = [];

  for (let i = 0; i < teachers.length; i++) {
    const t = teachers[i];
    const rowNum = t._origRowIndex || (i + 1);

    const getVal = (patterns: string[]): string => {
      for (const p of patterns) {
        if (t[p] !== undefined && t[p] !== null && String(t[p]).trim() !== '') return String(t[p]).trim();
        const cleanP = p.toLowerCase().replace(/[^a-z0-9]/g, '');
        const foundKey = Object.keys(t).find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanP);
        if (foundKey && t[foundKey] !== undefined && t[foundKey] !== null && String(t[foundKey]).trim() !== '') {
          return String(t[foundKey]).trim();
        }
      }
      return '';
    };

    // Skip completely empty rows
    const hasRealContent = Object.entries(t).some(([k, v]) => !k.startsWith('_') && v !== undefined && v !== null && String(v).trim() !== '');
    if (!hasRealContent) {
      continue;
    }

    const saviorNo = getVal(['Savior_No', 'SAVIOR_NO', 'savior_no', 'saviorNo', 'Savior No', 'employeeId', 'employee_id', 'Employee ID', 'Employee Id/Savior_NO', 'Emp ID', 'EMP_ID', 'ID']);
    let firstName = getVal(['Fist Name', 'First Name', 'firstName', 'first_name', 'FIRST NAME']);
    let lastName  = getVal(['Last Name', 'lastName', 'last_name', 'LAST NAME', 'Surname']);
    const explicitFullName = getVal(['Full Name(Automatically generated)', 'Full Name', 'FULL NAME', 'fullName', 'Teacher Name', 'TEACHER NAME', 'Name', 'NAME', 'name', 'Faculty Name', 'Staff Name']);

    if ((!firstName || !lastName) && explicitFullName) {
      const parts = explicitFullName.split(/\s+/).filter(Boolean);
      if (!firstName) firstName = parts[0] || '';
      if (!lastName) lastName = parts.slice(1).join(' ') || '';
    }
    const name = explicitFullName || ((firstName && lastName) ? `${firstName} ${lastName}` : (firstName || lastName || `Faculty ${rowNum}`));
    const email = getVal(['Email_id', 'EMAIL_ID', 'email_id', 'Email ID', 'emailId', 'Email', 'EMAIL', 'email', 'Email Address']).toLowerCase() || `${saviorNo ? `teacher.${saviorNo.toLowerCase()}` : `teacher${rowNum}`}@school.local`;
    const rawClass = getVal(['Class', 'CLASS', 'class', 'Standard', 'Grade']);
    const rawSection = (getVal(['Section', 'SECTION', 'section', 'Sec', 'SEC']) || 'A').toUpperCase();
    const designation = getVal(['Designation', 'DESIGNATION', 'designation', 'Role', 'ROLE', 'role', 'Post', 'POST', 'post', 'Job Title']) || 'Teacher';
    const status = getVal(['Status', 'STATUS', 'status']) || 'Active';
    const rawMobile = getVal(['Mobile', 'MOBILE', 'mobile', 'Phone', 'phone']).replace(/[^0-9]/g, '');
    const gender = getVal(['Gender', 'GENDER', 'gender', 'Sex', 'sex']) || null;
    const rawDob = getVal(['Date_of_Birth', 'DATE_OF_BIRTH', 'Date of Birth', 'date_of_birth', 'DOB', 'dob', 'DateOfBirth']);
    const dob = rawDob ? normalizeToDdMmYyyy(rawDob) : null;

    // Validation engine:
    if (!name) errors.push({ row: rowNum, field: 'First Name', message: 'First Name or Teacher Name is required' });
    if (!email) {
      errors.push({ row: rowNum, field: 'Email_id', message: 'Email address is required' });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ row: rowNum, field: 'Email_id', message: `Invalid email format '${email}'` });
    }
    if (!saviorNo) {
      errors.push({ row: rowNum, field: 'Savior_No', message: 'Savior_No / Employee ID is required' });
    } else if (seenEmployeeIds.has(saviorNo)) {
      errors.push({ row: rowNum, field: 'Savior_No', message: `Duplicate Savior_No '${saviorNo}' in this file` });
    } else {
      seenEmployeeIds.add(saviorNo);
    }
    if (email && seenEmails.has(email)) {
      errors.push({ row: rowNum, field: 'Email_id', message: `Duplicate email address '${email}' in this file` });
    } else if (email) {
      seenEmails.add(email);
    }
    if (rawMobile && rawMobile.length !== 10) {
      errors.push({ row: rowNum, field: 'Mobile', message: `Mobile number must be exactly 10 digits (${rawMobile.length} given)` });
    }

    if (errors.filter(e => e.row === rowNum).length === 0) {
      validRows.push({
        saviorNo,
        firstName,
        lastName,
        name,
        email,
        mobile: rawMobile || '9876500000',
        gender,
        dob,
        date_of_birth: dob,
        designation,
        status,
        class: rawClass,
        section: rawSection
      });
    }
  }

  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      errors,
      message: `Validation failed for ${errors.length} record(s). The entire import has been cancelled and no faculty data was stored in the database.`
    });
  }

  const schoolName = req.user?.schoolName || 'School';

  // PostgreSQL Atomic Transaction
  if (isPostgresConfigured) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const stagedList: any[] = [];

      // Pre-compute password hashes in parallel with rounds 8
      const preparedRows = await Promise.all(
        validRows.map(async (t) => {
          const tempPassword = crypto.randomBytes(8).toString('hex') + 'Tt1!';
          const hash = await bcrypt.hash(tempPassword, 8);
          return { t, tempPassword, hash };
        })
      );

      for (const { t, tempPassword, hash } of preparedRows) {
        const u = await client.query(
          `INSERT INTO users(school_id, name, email, password_hash, role) VALUES($1, $2, $3, $4, 'TEACHER')
           ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name, school_id=EXCLUDED.school_id, password_hash=EXCLUDED.password_hash
           RETURNING id, name, email`,
          [schoolId, t.name, t.email, hash]
        );
        if (!u.rowCount || !u.rows[0]) {
          throw new Error(`Failed to insert or update user record for faculty member ${t.name} (${t.email})`);
        }

        const rawClass = t.class ? String(t.class).trim() : null;
        const rawSection = t.section ? String(t.section).trim().toUpperCase() : null;
        let parsedGender = t.gender ? String(t.gender).trim() : null;
        if (parsedGender) {
          if (/^f/i.test(parsedGender)) parsedGender = 'Female';
          else if (/^m/i.test(parsedGender)) parsedGender = 'Male';
        }

        const existingEp = await client.query('SELECT user_id FROM teacher_profiles WHERE employee_id = $1', [t.saviorNo]);
        if (existingEp.rows.length > 0 && existingEp.rows[0].user_id !== u.rows[0].id) {
          await client.query(
            `UPDATE teacher_profiles SET user_id = $1, mobile = $2, designation = $3, class_name = $4, section_name = $5, gender = COALESCE($6, gender) WHERE employee_id = $7`,
            [u.rows[0].id, t.mobile || null, t.designation || 'Teacher', rawClass, rawSection, parsedGender, t.saviorNo]
          );
        } else {
          await client.query(
            `INSERT INTO teacher_profiles(user_id, employee_id, mobile, designation, class_name, section_name, gender) VALUES($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (user_id) DO UPDATE SET employee_id=EXCLUDED.employee_id, mobile=EXCLUDED.mobile, designation=EXCLUDED.designation, class_name=EXCLUDED.class_name, section_name=EXCLUDED.section_name, gender=COALESCE(EXCLUDED.gender, teacher_profiles.gender)
             RETURNING *`,
            [u.rows[0].id, t.saviorNo, t.mobile || null, t.designation || 'Teacher', rawClass, rawSection, parsedGender]
          );
        }

        if (rawClass) {
          demoTeacherAssignments.push({
            id: `ta-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            school_id: schoolId,
            teacher_id: u.rows[0].id,
            teacher_name: t.name,
            class_number: rawClass,
            section_name: rawSection || 'A',
            subject_name: null
          });
        }

        const created = {
          ...u.rows[0],
          name: t.name,
          full_name: t.name,
          first_name: t.firstName,
          last_name: t.lastName,
          employee_id: t.saviorNo,
          savior_no: t.saviorNo,
          mobile: t.mobile,
          gender: t.gender || null,
          dob: t.dob || null,
          date_of_birth: t.dob || null,
          designation: t.designation,
          class_name: t.class,
          section_name: t.section,
          status: t.status,
          email_status: 'Pending',
          is_active: t.status.toUpperCase() !== 'INACTIVE',
          school_id: schoolId,
          schoolId
        };
        stagedList.push({ created, hash, tempPassword });
      }

      if (stagedList.length !== validRows.length) {
        throw new Error(`Incomplete faculty batch insert: processed ${stagedList.length} of ${validRows.length} records`);
      }

      await client.query('COMMIT');
      client.release();
      fastCache.delete(`teachers:${schoolId}`);

      // After COMMIT: update memory, register demo users, sync to Firestore, dispatch emails
      for (const item of stagedList) {
        demoTeachers.unshift(item.created);
        registerDemoUser({
          id: item.created.id,
          schoolId,
          name: item.created.name,
          email: item.created.email,
          role: 'TEACHER',
          password: item.tempPassword
        });
        syncTeacherToFirestore(item.created, item.hash).catch(() => {});
        setImmediate(async () => {
          try {
            const resetInfo = await createAndSendPasswordReset({
              email: item.created.email,
              name: item.created.name,
              role: 'TEACHER',
              schoolId,
              schoolName,
              req
            }).catch(() => null);

            await queueEmailNotification({
              schoolId,
              recipientEmail: item.created.email,
              recipientName: item.created.name,
              recipientType: 'TEACHER',
              templateKey: 'TEACHER_CREATED',
              templateData: {
                teacher_name: item.created.name,
                school_name: schoolName,
                employee_id: item.created.employee_id,
                login_url: resetInfo?.resetUrl || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`,
                temporary_password: item.tempPassword
              },
              idempotencyKey: `tch-import-${schoolId}-${item.created.email}-${Date.now()}`
            }).catch(err => {
              console.warn(`[TeacherBulkImport] SMTP dispatch warning for ${item.created.email}:`, err.message);
            });
          } catch {}
        });
      }

      return res.status(201).json({
        success: true,
        count: stagedList.length,
        items: stagedList.map(s => s.created),
        message: `Successfully onboarded ${stagedList.length} faculty members. Welcome credentials dispatched via SMTP.`
      });
    } catch (txErr: any) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({
        success: false,
        message: `Teacher bulk import failed: ${txErr.message || 'Database transaction error'}. The entire operation was cancelled and no faculty records were stored in the database.`
      });
    }
  } else {
    // Non-Postgres fallback: atomic batch or staged in-memory
    if (isFirebaseConfigured()) {
      try {
        const batch = collections.teachers().firestore.batch();
        const stagedList: any[] = [];
        for (const t of validRows) {
          const teacherId = `tch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const tempPassword = crypto.randomBytes(8).toString('hex') + 'Tt1!';
          const docRef = collections.teachers().doc(teacherId);
          const teacherObj = {
            id: teacherId,
            school_id: schoolId,
            schoolId,
            name: t.name,
            full_name: t.name,
            first_name: t.firstName,
            last_name: t.lastName,
            email: t.email,
            employee_id: t.saviorNo,
            savior_no: t.saviorNo,
            mobile: t.mobile,
            gender: t.gender || null,
            dob: t.dob || null,
            date_of_birth: t.dob || null,
            designation: t.designation,
            class_name: t.class,
            section_name: t.section,
            status: t.status,
            email_status: 'Pending',
            is_active: t.status.toUpperCase() !== 'INACTIVE'
          };
          batch.set(docRef, teacherObj);
          stagedList.push({ created: teacherObj, tempPassword });
        }
        await batch.commit();

        for (const item of stagedList) {
          demoTeachers.unshift(item.created);
          registerDemoUser({
            id: item.created.id,
            schoolId,
            name: item.created.name,
            email: item.created.email,
            role: 'TEACHER',
            password: item.tempPassword
          });
        }
        return res.status(201).json({
          success: true,
          count: stagedList.length,
          items: stagedList.map(s => s.created),
          message: `Successfully onboarded ${stagedList.length} faculty members.`
        });
      } catch (fsErr: any) {
        return res.status(500).json({
          success: false,
          message: `Faculty bulk import failed in Cloud Firestore: ${fsErr.message}. The entire operation was cancelled and no data was saved.`
        });
      }
    } else {
      const stagedList: any[] = [];
      for (const t of validRows) {
        const teacherId = `tch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const tempPassword = crypto.randomBytes(8).toString('hex') + 'Tt1!';
        const teacherObj = {
          id: teacherId,
          school_id: schoolId,
          schoolId,
          name: t.name,
          full_name: t.name,
          first_name: t.firstName,
          last_name: t.lastName,
          email: t.email,
          employee_id: t.saviorNo,
          savior_no: t.saviorNo,
          mobile: t.mobile,
          gender: t.gender || null,
          dob: t.dob || null,
          date_of_birth: t.dob || null,
          designation: t.designation,
          class_name: t.class,
          section_name: t.section,
          status: t.status,
          email_status: 'Pending',
          is_active: t.status.toUpperCase() !== 'INACTIVE'
        };
        stagedList.push({ created: teacherObj, tempPassword });
      }
      for (const item of stagedList) {
        demoTeachers.unshift(item.created);
        registerDemoUser({
          id: item.created.id,
          schoolId,
          name: item.created.name,
          email: item.created.email,
          role: 'TEACHER',
          password: item.tempPassword
        });
      }
      return res.status(201).json({
        success: true,
        count: stagedList.length,
        items: stagedList.map(s => s.created),
        message: `Successfully onboarded ${stagedList.length} faculty members.`
      });
    }
  }
});

r.post('/teachers/bulk-delete', ...admin, async (req: AuthRequest, res) => {
  const { ids = [] } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: 'Array of IDs required' });
  const sid = req.user!.schoolId;
  const uuidIds = ids.filter(isUuid);

  if (isPostgresConfigured && uuidIds.length > 0) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Clean non-cascading FK references for teachers
      await client.query(`DELETE FROM class_routines WHERE teacher_id = ANY($1::uuid[])`, [uuidIds]);
      await client.query(`UPDATE attendance_sessions SET teacher_id = NULL WHERE teacher_id = ANY($1::uuid[])`, [uuidIds]);
      await client.query(`DELETE FROM attendance_correction_requests WHERE requested_by = ANY($1::uuid[]) OR reviewed_by = ANY($1::uuid[])`, [uuidIds]);
      await client.query(`DELETE FROM attendance_correction_audit WHERE actor_user_id = ANY($1::uuid[])`, [uuidIds]);
      await client.query(`UPDATE student_promotions SET created_by = NULL WHERE created_by = ANY($1::uuid[])`, [uuidIds]);
      await client.query(`DELETE FROM admin_activity_logs WHERE user_id = ANY($1::uuid[])`, [uuidIds]);
      await client.query(`DELETE FROM substitute_assignments WHERE substitute_teacher_id = ANY($1::uuid[]) OR created_by = ANY($1::uuid[])`, [uuidIds]);
      await client.query(`DELETE FROM attendance_sync_batches WHERE user_id = ANY($1::uuid[])`, [uuidIds]);
      await client.query(`UPDATE student_leave_requests SET reviewed_by = NULL WHERE reviewed_by = ANY($1::uuid[])`, [uuidIds]);
      await client.query(`UPDATE payments SET initiated_by_user_id = NULL WHERE initiated_by_user_id = ANY($1::uuid[])`, [uuidIds]);
      await client.query(`DELETE FROM teacher_profiles WHERE user_id = ANY($1::uuid[])`, [uuidIds]);

      // 2. Permanently delete teacher user records from PostgreSQL
      await client.query(`DELETE FROM users WHERE id = ANY($1::uuid[]) AND school_id = $2 AND role = 'TEACHER'`, [uuidIds, sid]);

      await client.query('COMMIT');
    } catch (delErr: any) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[BulkDeleteTeachers] Transaction error:', delErr);
      return res.status(400).json({ success: false, message: `Bulk delete failed: ${delErr.message}. No records were modified.` });
    } finally {
      client.release();
    }
  }

  const idSet = new Set(ids);
  for (let i = demoTeachers.length - 1; i >= 0; i--) {
    if (idSet.has(demoTeachers[i].id)) {
      demoTeachers.splice(i, 1);
    }
  }
  for (const id of ids) {
    deleteTeacherFromFirestore(String(id)).catch(() => {});
  }
  if (sid) {
    invalidateSchoolCache(sid);
  }
  res.json({ success: true, count: ids.length });
});

r.get('/teachers/:id',...admin,async(req:AuthRequest,res)=>{
  const tid = String(req.params.id);
  const userSchoolId = typeof req.user?.schoolId === 'string' ? req.user.schoolId : undefined;

  if (isFirebaseConfigured()) {
    try {
      const tDoc = await collections.teachers().doc(tid).get();
      if (tDoc.exists) {
        const d = tDoc.data()!;
        const docSid = String(d.school_id || d.schoolId || '');
        if (!userSchoolId || isSameSchool(docSid, userSchoolId)) {
          return res.json({ id: tDoc.id, ...d });
        }
      }
      const uDoc = await collections.users().doc(tid).get();
      if (uDoc.exists) {
        const d = uDoc.data()!;
        const docSid = String(d.school_id || d.schoolId || '');
        if (!userSchoolId || isSameSchool(docSid, userSchoolId)) {
          return res.json({ id: uDoc.id, ...d });
        }
      }
    } catch {}
  }

  const mem = demoTeachers.find(t => t.id === tid);
  if (mem) return res.json(mem);

  res.status(404).json({ message: 'Teacher not found' });
});

r.put('/teachers/:id',...admin,async(req:AuthRequest,res)=>{
  const { name, email, employeeId, employee_id, mobile, phone, is_active, status, password } = req.body || {};
  const tid = String(req.params.id);
  const userSchoolId = typeof req.user?.schoolId === 'string' ? req.user.schoolId : undefined;

  let existingDocData: any = {};
  if (isFirebaseConfigured()) {
    try {
      const tDoc = await collections.teachers().doc(tid).get();
      if (tDoc.exists) existingDocData = tDoc.data() || {};
      else {
        const uDoc = await collections.users().doc(tid).get();
        if (uDoc.exists) existingDocData = uDoc.data() || {};
      }
    } catch {}
  }

  const idx = demoTeachers.findIndex(t => t.id === tid);
  const resolvedSchoolId = userSchoolId || existingDocData.school_id || existingDocData.schoolId || demoTeachers[idx]?.school_id || null;
  const resolvedStatus = status || (is_active === false ? 'INACTIVE' : 'ACTIVE');
  const cleanEmail = email ? String(email).trim().toLowerCase() : (existingDocData.email || demoTeachers[idx]?.email || '');
  const rawGender = req.body.gender;
  const resolvedGender = rawGender !== undefined ? (rawGender ? String(rawGender).trim() : null) : (existingDocData.gender || demoTeachers[idx]?.gender || null);
  const rawDob = req.body.dob !== undefined ? req.body.dob : (req.body.date_of_birth !== undefined ? req.body.date_of_birth : req.body.dateOfBirth);
  const resolvedDob = rawDob !== undefined ? (rawDob ? normalizeToDdMmYyyy(rawDob) : null) : (existingDocData.dob || existingDocData.date_of_birth || demoTeachers[idx]?.dob || null);

  try {
    await pool.query(
      `UPDATE users SET name=$1, email=$2, is_active=$3, updated_at=NOW() WHERE id=$4 AND school_id=$5`,
      [name || existingDocData.name || demoTeachers[idx]?.name, cleanEmail, resolvedStatus === 'ACTIVE', tid, userSchoolId]
    );
    await pool.query(
      `UPDATE teacher_profiles SET employee_id=$1, mobile=$2, gender=$3 WHERE user_id=$4`,
      [employeeId || employee_id || existingDocData.employee_id || demoTeachers[idx]?.employee_id, mobile || phone || existingDocData.mobile || demoTeachers[idx]?.mobile, resolvedGender, tid]
    );
  } catch {}

  const updated = {
    id: tid,
    name: name || existingDocData.name || demoTeachers[idx]?.name || '',
    email: cleanEmail,
    employee_id: employeeId || employee_id || existingDocData.employee_id || existingDocData.employeeId || demoTeachers[idx]?.employee_id || '',
    employeeId: employeeId || employee_id || existingDocData.employee_id || existingDocData.employeeId || demoTeachers[idx]?.employee_id || '',
    mobile: mobile || phone || existingDocData.mobile || existingDocData.phone || demoTeachers[idx]?.mobile || '',
    phone: mobile || phone || existingDocData.mobile || existingDocData.phone || demoTeachers[idx]?.mobile || '',
    gender: resolvedGender,
    dob: resolvedDob,
    date_of_birth: resolvedDob,
    school_id: resolvedSchoolId,
    schoolId: resolvedSchoolId,
    status: resolvedStatus,
    is_active: resolvedStatus === 'ACTIVE'
  };

  if (idx >= 0) demoTeachers[idx] = { ...demoTeachers[idx], ...updated };
  else demoTeachers.push(updated);

  if (password && String(password).trim()) {
    const pwValidation = validatePasswordStrength(String(password).trim());
    if (!pwValidation.valid) {
      return res.status(400).json({ message: pwValidation.message });
    }
  }

  let newPasswordHash: string | undefined = undefined;
  if (password && String(password).trim()) {
    newPasswordHash = await bcrypt.hash(String(password).trim(), 10);
    try {
      await pool.query(
        `UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2 AND school_id=$3`,
        [newPasswordHash, tid, userSchoolId]
      );
    } catch {}
  }

  syncTeacherToFirestore(updated, newPasswordHash).catch(() => {});
  res.json(updated);
});

r.delete('/teachers/:id',...admin,async(req:AuthRequest,res)=>{
  const sid = req.user!.schoolId;
  const tid = String(req.params.id);
  if (isPostgresConfigured && isUuid(tid)) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM class_routines WHERE teacher_id = $1`, [tid]);
      await client.query(`UPDATE attendance_sessions SET teacher_id = NULL WHERE teacher_id = $1`, [tid]);
      await client.query(`DELETE FROM attendance_correction_requests WHERE requested_by = $1 OR reviewed_by = $1`, [tid]);
      await client.query(`DELETE FROM attendance_correction_audit WHERE actor_user_id = $1`, [tid]);
      await client.query(`UPDATE student_promotions SET created_by = NULL WHERE created_by = $1`, [tid]);
      await client.query(`DELETE FROM admin_activity_logs WHERE user_id = $1`, [tid]);
      await client.query(`DELETE FROM substitute_assignments WHERE substitute_teacher_id = $1 OR created_by = $1`, [tid]);
      await client.query(`DELETE FROM attendance_sync_batches WHERE user_id = $1`, [tid]);
      await client.query(`UPDATE student_leave_requests SET reviewed_by = NULL WHERE reviewed_by = $1`, [tid]);
      await client.query(`UPDATE payments SET initiated_by_user_id = NULL WHERE initiated_by_user_id = $1`, [tid]);
      await client.query(`DELETE FROM teacher_profiles WHERE user_id = $1`, [tid]);

      await client.query(`DELETE FROM users WHERE id = $1 AND school_id = $2 AND role = 'TEACHER'`, [tid, sid]);
      await client.query('COMMIT');
    } catch (delErr: any) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[DeleteTeacher] Transaction error:', delErr);
      return res.status(400).json({ success: false, message: `Delete failed: ${delErr.message}` });
    } finally {
      client.release();
    }
  }
  const idx = demoTeachers.findIndex(t => t.id === tid);
  if (idx >= 0) demoTeachers.splice(idx, 1);
  deleteTeacherFromFirestore(tid).catch(() => {});
  if (sid) {
    invalidateSchoolCache(sid);
  }
  res.json({success:true});
});

export const demoSubjects: any[] = [
  { id: 'sub-math', name: 'Mathematics', school_id: '00000000-0000-0000-0000-000000000001' },
  { id: 'sub-sci', name: 'Science', school_id: '00000000-0000-0000-0000-000000000001' },
  { id: 'sub-eng', name: 'English', school_id: '00000000-0000-0000-0000-000000000001' },
  { id: 'sub-sst', name: 'Social Studies', school_id: '00000000-0000-0000-0000-000000000001' },
  { id: 'sub-cs', name: 'Computer Science', school_id: '00000000-0000-0000-0000-000000000001' },
  { id: 'sub-phy', name: 'Physics', school_id: '00000000-0000-0000-0000-000000000001' },
  { id: 'sub-chem', name: 'Chemistry', school_id: '00000000-0000-0000-0000-000000000001' },
  { id: 'sub-bio', name: 'Biology', school_id: '00000000-0000-0000-0000-000000000001' },
  { id: 'sub-hindi', name: 'Hindi', school_id: '00000000-0000-0000-0000-000000000001' },
  { id: 'sub-pe', name: 'Physical Education', school_id: '00000000-0000-0000-0000-000000000001' }
];

r.get('/subjects',...reader,async(req:AuthRequest,res)=>{
 const sid = req.user!.schoolId;
 const cacheKey = sid ? `subjects:${sid}` : null;
 if (cacheKey) {
   const cached = fastCache.get<any>(cacheKey);
   if (cached) return res.json(cached);
 }

 try {
  const q=await pool.query('SELECT * FROM subjects WHERE school_id=$1 ORDER BY name',[sid]);
  if (q.rowCount && q.rows.length > 0) {
    if (cacheKey) fastCache.set(cacheKey, q.rows, 30);
    return res.json(q.rows);
  }
 } catch {}

 // Check Cloud Firestore
 if (isFirebaseConfigured()) {
   try {
     const snap = sid
       ? await collections.subjects().where('school_id', '==', sid).get()
       : await collections.subjects().get();
     if (!snap.empty) {
       const list = snap.docs
         .map(d => ({ id: d.id, ...d.data() }))
         .filter((s: any) => s.school_id && isSameSchool(s.school_id, sid));
       if (list.length > 0) {
         list.sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)));
         if (cacheKey) fastCache.set(cacheKey, list, 30);
         return res.json(list);
       }
     }
   } catch {}
 }

 const memSchoolSubjects = demoSubjects.filter(s => s.school_id && isSameSchool(s.school_id, sid));
 if (memSchoolSubjects.length > 0) return res.json(memSchoolSubjects);

 if (isTestSchool(sid)) {
   return res.json(demoSubjects);
 }
 res.json([]);
});

r.post('/subjects',...admin,async(req:AuthRequest,res)=>{
 const sid = req.user!.schoolId;
 const { name } = req.body || {};
 if (!name || !String(name).trim()) return res.status(400).json({ message: 'Subject name is required' });
 const cleanName = String(name).trim();
 try {
  const q=await pool.query('INSERT INTO subjects(school_id,name) VALUES($1,$2) RETURNING *',[sid,cleanName]);
  if (q.rowCount) {
    const created = { ...q.rows[0], school_id: sid };
    demoSubjects.push(created);
    syncSubjectToFirestore(created).catch(() => {});
    return res.status(201).json(created);
  }
 } catch {}
 const newSub = { id: `sub-${Date.now()}`, name: cleanName, school_id: sid };
 demoSubjects.push(newSub);
 syncSubjectToFirestore(newSub).catch(() => {});
 res.status(201).json(newSub);
});

r.delete('/subjects/:id',...admin,async(req:AuthRequest,res)=>{
  const sid = req.user!.schoolId;
  const subId = String(req.params.id);
  if (isPostgresConfigured && isUuid(subId)) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM class_routines WHERE subject_id = $1', [subId]);
      await client.query('UPDATE attendance_sessions SET subject_id = NULL WHERE subject_id = $1', [subId]);
      await client.query('DELETE FROM subjects WHERE id = $1 AND school_id = $2', [subId, sid]);
      await client.query('COMMIT');
    } catch (delErr: any) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[DeleteSubject] Transaction error:', delErr);
      return res.status(400).json({ success: false, message: `Delete subject failed: ${delErr.message}` });
    } finally {
      client.release();
    }
  }
  const idx = demoSubjects.findIndex(s => s.id === subId && (!s.school_id || isSameSchool(s.school_id, sid)));
  if (idx >= 0) demoSubjects.splice(idx, 1);
  deleteSubjectFromFirestore(subId).catch(() => {});
  if (sid) {
    invalidateSchoolCache(sid);
  }
  res.json({success:true});
});

r.get('/school-profile',...admin,async(req:AuthRequest,res)=>{
 const sid = req.user!.schoolId!;
 const uid = req.user!.id;
 let adminPhotoUrl = '';
 try {
   const uq = await pool.query('SELECT photo_url FROM users WHERE id = $1', [uid]);
   if (uq.rowCount && uq.rows[0].photo_url) {
     adminPhotoUrl = uq.rows[0].photo_url;
   }
 } catch {}

 if (!adminPhotoUrl) {
   const demoAdmin = getAllDemoUsers().find(u => u.id === uid || u.email.toLowerCase() === (req.user?.email || '').toLowerCase());
   if (demoAdmin?.photo_url) {
     adminPhotoUrl = demoAdmin.photo_url;
   }
 }

 try {
  const q = await pool.query('SELECT id, name, code, status, enquiry_number, address, photo_url, created_at FROM schools WHERE id = $1', [sid]);
  if (q.rowCount) {
    const s = q.rows[0];
    const resolvedPhoto = adminPhotoUrl || s.photo_url || '';
    return res.json({
      ...s,
      photo_url: resolvedPhoto,
      photoUrl: resolvedPhoto,
      schoolName: s.name,
      adminEmail: req.user?.email || '',
      adminName: req.user?.name || ''
    });
  }
 } catch {}

 // Check Firestore
 try {
  const fsSchool = await getFirestoreSchoolById(sid);
  if (fsSchool) {
   const resolvedPhoto = adminPhotoUrl || (fsSchool as any).photo_url || (fsSchool as any).photoUrl || (fsSchool as any).logo_url || '';
   return res.json({
    id: fsSchool.id,
    name: fsSchool.name,
    schoolName: fsSchool.name,
    code: fsSchool.code || 'SCH001',
    status: fsSchool.status || 'ACTIVE',
    enquiry_number: fsSchool.phone || fsSchool.enquiryNumber || '1800123456',
    contact_number: fsSchool.phone || fsSchool.enquiryNumber || '1800123456',
    address: fsSchool.address || 'Main Campus',
    website: fsSchool.website || '',
    photo_url: resolvedPhoto,
    photoUrl: resolvedPhoto,
    adminEmail: req.user?.email || '',
    adminName: req.user?.name || '',
    created_at: fsSchool.createdAt || new Date().toISOString()
   });
  }
 } catch {}

 res.json({
  id: sid,
  name: req.user?.schoolName || 'Institutional Campus',
  schoolName: req.user?.schoolName || 'Institutional Campus',
  code: (req.user as any)?.schoolCode || 'SCH001',
  status: 'ACTIVE',
  enquiry_number: '1800123456',
  address: 'Main Campus',
  photo_url: adminPhotoUrl || '',
  photoUrl: adminPhotoUrl || '',
  adminEmail: req.user?.email || '',
  adminName: req.user?.name || ''
 });
});

r.put('/school-profile',...admin,async(req:AuthRequest,res)=>{
 const sid = req.user!.schoolId!;
 const uid = req.user!.id;
 const { enquiryNumber, contact_number, address, website, photo_url, photoUrl, photo } = req.body || {};
 const phone = contact_number || enquiryNumber;
 const incomingPhoto = photo_url !== undefined ? photo_url : (photoUrl !== undefined ? photoUrl : photo);

 if (incomingPhoto !== undefined) {
   updateDemoUserPhoto(uid, incomingPhoto || null);
   try {
     await pool.query('UPDATE users SET photo_url = $1, updated_at = NOW() WHERE id = $2 AND school_id = $3', [incomingPhoto || null, uid, sid]);
     await pool.query('UPDATE schools SET photo_url = $1, updated_at = NOW() WHERE id = $2', [incomingPhoto || null, sid]);
   } catch {}
 }

 try {
  const q = await pool.query(
    'UPDATE schools SET enquiry_number = COALESCE($1, enquiry_number), address = COALESCE($2, address), photo_url = COALESCE($3, photo_url) WHERE id = $4 RETURNING id, name, code, status, enquiry_number, address, photo_url',
    [phone, address, incomingPhoto !== undefined ? (incomingPhoto || null) : null, sid]
  );
  if (q.rowCount) {
    syncSchoolToFirestore(q.rows[0]).catch(() => {});
    return res.json({
      ...q.rows[0],
      photo_url: incomingPhoto !== undefined ? incomingPhoto : q.rows[0].photo_url,
      photoUrl: incomingPhoto !== undefined ? incomingPhoto : q.rows[0].photo_url
    });
  }
 } catch {}

 try {
  if (isFirebaseConfigured()) {
    const updatePayload: any = {
      phone,
      enquiryNumber: phone,
      address,
      website: website || '',
      updatedAt: new Date().toISOString()
    };
    if (incomingPhoto !== undefined) {
      updatePayload.photo_url = incomingPhoto;
      updatePayload.photoUrl = incomingPhoto;
    }
    await collections.schools().doc(sid).set(updatePayload, { merge: true });
    if (incomingPhoto !== undefined && uid) {
      await collections.users().doc(uid).set({ photo_url: incomingPhoto, photoUrl: incomingPhoto }, { merge: true }).catch(() => {});
    }
    const updated = await getFirestoreSchoolById(sid);
    if (updated) return res.json({ ...updated, photo_url: incomingPhoto, photoUrl: incomingPhoto });
  }
 } catch {}

 const updatedSchool = { id: sid, enquiry_number: phone, address, website, photo_url: incomingPhoto, photoUrl: incomingPhoto };
 syncSchoolToFirestore(updatedSchool).catch(() => {});
 res.json(updatedSchool);
});

// ── POST /api/school-profile/photo - Upload picture (School Admin only) ──
r.post('/school-profile/photo', ...admin, async (req: AuthRequest, res) => {
  const sid = req.user!.schoolId!;
  const uid = req.user!.id;
  const { photo_url, photoUrl, photo } = req.body || {};
  const newPhoto = photo_url || photoUrl || photo;

  if (!newPhoto || typeof newPhoto !== 'string') {
    return res.status(400).json({ message: 'Valid photo data or URL is required' });
  }

  // Basic payload size check (max 10MB data string)
  if (newPhoto.length > 10 * 1024 * 1024) {
    return res.status(400).json({ message: 'Image size exceeds maximum allowed limit of 10MB' });
  }

  // Sync to in-memory demo store
  updateDemoUserPhoto(uid, newPhoto);

  try {
    await pool.query(
      'UPDATE users SET photo_url = $1, updated_at = NOW() WHERE id = $2 AND school_id = $3',
      [newPhoto, uid, sid]
    );
    await pool.query(
      'UPDATE schools SET photo_url = $1, updated_at = NOW() WHERE id = $2',
      [newPhoto, sid]
    );
  } catch (err: any) {
    console.warn('[SchoolProfile] DB update photo warning:', err.message);
  }

  if (isFirebaseConfigured()) {
    try {
      await collections.users().doc(uid).set({ photo_url: newPhoto, photoUrl: newPhoto }, { merge: true });
      await collections.schools().doc(sid).set({ photo_url: newPhoto, photoUrl: newPhoto, logo_url: newPhoto }, { merge: true });
    } catch {}
  }

  res.json({
    success: true,
    message: 'Profile picture uploaded successfully',
    photo_url: newPhoto,
    photoUrl: newPhoto
  });
});

// ── DELETE /api/school-profile/photo - Remove picture (School Admin only) ──
r.delete('/school-profile/photo', ...admin, async (req: AuthRequest, res) => {
  const sid = req.user!.schoolId!;
  const uid = req.user!.id;

  // Sync to in-memory demo store
  updateDemoUserPhoto(uid, null);

  try {
    await pool.query(
      'UPDATE users SET photo_url = NULL, updated_at = NOW() WHERE id = $1 AND school_id = $2',
      [uid, sid]
    );
    await pool.query(
      'UPDATE schools SET photo_url = NULL, updated_at = NOW() WHERE id = $1',
      [sid]
    );
  } catch (err: any) {
    console.warn('[SchoolProfile] DB remove photo warning:', err.message);
  }

  if (isFirebaseConfigured()) {
    try {
      await collections.users().doc(uid).set({ photo_url: null, photoUrl: null }, { merge: true });
      await collections.schools().doc(sid).set({ photo_url: null, photoUrl: null, logo_url: null }, { merge: true });
    } catch {}
  }

  res.json({
    success: true,
    message: 'Profile picture removed successfully',
    photo_url: null,
    photoUrl: null
  });
});

r.put('/school-profile/change-password', ...admin, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { currentPassword, newPassword } = req.body || {};

  const pwValidation = validatePasswordStrength(String(newPassword));
  if (!pwValidation.valid) {
    return res.status(400).json({ message: pwValidation.message });
  }

  try {
    const q = await pool.query(`SELECT id, password_hash FROM users WHERE id = $1`, [userId]);
    if (q.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userRow = q.rows[0];
    const bcryptModule = await import('bcryptjs');
    const valid = await bcryptModule.compare(currentPassword, userRow.password_hash);
    if (!valid) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    const hashed = await bcryptModule.hash(newPassword, 10);
    await pool.query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [hashed, userId]);

    res.json({ success: true, message: 'Administrator password updated successfully!' });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to change administrator password' });
  }
});

/* ── Global Search ── */
r.get('/search', ...admin, async (req: AuthRequest, res) => {
  const q = String(req.query.q || '').trim();
  if (!q || q.length < 2) return res.json({ students: [], teachers: [], classes: [] });
  const sid = req.user!.schoolId;
  const pattern = `%${q}%`;
  const results: any = { students: [], teachers: [], classes: [] };

  try {
    // Students
    const stRes = await pool.query(
      `SELECT st.id, st.roll_number, st.name, st.gender, st.parent_email AS email, c.class_number, sec.name AS section_name
       FROM students st
       JOIN classes c ON c.id = st.class_id
       JOIN sections sec ON sec.id = st.section_id
       WHERE st.school_id = $1 AND st.is_active = true
         AND (st.name ILIKE $2 OR st.roll_number ILIKE $2 OR COALESCE(st.parent_email,'') ILIKE $2 OR COALESCE(st.gender,'') ILIKE $2)
       ORDER BY st.name ASC LIMIT 8`,
      [sid, pattern]
    );
    results.students = stRes.rows.map((r: any) => ({
      id: r.id, name: r.name, email: r.email, roll: r.roll_number, gender: r.gender,
      class: r.class_number ? `Class ${r.class_number}` : null,
      section: r.section_name, type: 'student'
    }));

    // Teachers
    const tRes = await pool.query(
      `SELECT u.id, u.name, u.email, tp.gender, tp.employee_id
       FROM users u
       LEFT JOIN teacher_profiles tp ON tp.user_id = u.id
       WHERE u.school_id = $1 AND u.role = 'TEACHER' AND u.is_active = true
         AND (LOWER(u.name) LIKE LOWER($2) OR LOWER(u.email) LIKE LOWER($2) OR LOWER(COALESCE(tp.employee_id,'')) LIKE LOWER($2) OR LOWER(COALESCE(tp.gender,'')) LIKE LOWER($2))
       ORDER BY u.name ASC LIMIT 8`,
      [sid, pattern]
    );
    results.teachers = tRes.rows.map((r: any) => ({
      id: r.id, name: r.name, email: r.email, employee_id: r.employee_id, gender: r.gender, type: 'teacher'
    }));

    // Classes
    const cRes = await pool.query(
      `SELECT c.id, c.class_number, COUNT(s.id)::int AS section_count
       FROM classes c LEFT JOIN sections s ON s.class_id = c.id
       WHERE c.school_id = $1 AND CAST(c.class_number AS TEXT) LIKE $2
       GROUP BY c.id ORDER BY c.class_number LIMIT 8`,
      [sid, pattern]
    );
    results.classes = cRes.rows.map((r: any) => ({
      id: r.id, name: `Class ${r.class_number}`, sections: r.section_count, type: 'class'
    }));
  } catch (_e) {
    // DB unavailable — fallback to in-memory/demo search
  }

  // Fallback to in-memory datasets if DB returns empty
  if (results.students.length === 0) {
    results.students = demoStudents.filter(s => {
      if (s.school_id && !isSameSchool(s.school_id, sid)) return false;
      return (
        (s.name && s.name.toLowerCase().includes(q.toLowerCase())) ||
        (s.roll_number && String(s.roll_number).toLowerCase().includes(q.toLowerCase())) ||
        (s.gender && s.gender.toLowerCase().includes(q.toLowerCase())) ||
        (s.email && s.email.toLowerCase().includes(q.toLowerCase()))
      );
    }).slice(0, 8).map(s => ({
      id: s.id, name: s.name, email: s.email, roll: s.roll_number, gender: s.gender,
      class: s.class_name || (s.class_number ? `Class ${s.class_number}` : null),
      section: s.section_name, type: 'student'
    }));
  }
  if (results.teachers.length === 0) {
    results.teachers = demoTeachers.filter(t => {
      if (t.school_id && !isSameSchool(t.school_id, sid) && !isTestSchool(sid)) return false;
      return (
        (t.name && t.name.toLowerCase().includes(q.toLowerCase())) ||
        (t.email && t.email.toLowerCase().includes(q.toLowerCase())) ||
        (t.employee_id && t.employee_id.toLowerCase().includes(q.toLowerCase())) ||
        (t.gender && t.gender.toLowerCase().includes(q.toLowerCase()))
      );
    }).slice(0, 8).map(t => ({
      id: t.id, name: t.name, email: t.email, employee_id: t.employee_id, gender: t.gender, type: 'teacher'
    }));
  }

  res.json(results);
});

export default r;
