import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { pool } from '../db';
import { requireAuth, requireRoles, AuthRequest } from '../middleware/auth';
import { registerDemoUser } from '../store/demoUsers';
import { createAndSendPasswordReset, isSameSchool, isTestSchool } from './auth';
import { queueEmailNotification } from '../services/notificationService';
import { demoSchools } from './superAdmin';
import { getFirestoreSchoolById } from '../services/firestoreService';
import { collections, isFirebaseConfigured } from '../firebase';
import {
  syncStudentToFirestore,
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

const r=Router();
const admin= [requireAuth,requireRoles('SCHOOL_ADMIN')];
const reader= [requireAuth,requireRoles('SUPER_ADMIN','SCHOOL_ADMIN','TEACHER')];

// Helper function for session matching across formats
export function isSameSession(s1?: string | null, s2?: string | null): boolean {
  if (!s1 || !s2) return false;
  if (s1 === s2) return true;
  const clean = (s: string) => String(s).replace(/[\u2013\u2014]/g, '-').replace(/[^0-9-]/g, '').trim();
  const c1 = clean(s1);
  const c2 = clean(s2);
  if (c1 && c2 && (c1 === c2 || c1.includes(c2) || c2.includes(c1))) return true;
  return s1.toLowerCase().includes(s2.toLowerCase()) || s2.toLowerCase().includes(s1.toLowerCase());
}

// Class grades: L-KG (id: cls-lkg, class_number: -1), U-KG (id: cls-ukg, class_number: 0), Class 1-12
export const CLASS_GRADES = [
  { id: 'cls-lkg', class_number: -1, label: 'L-KG' },
  { id: 'cls-ukg', class_number: 0,  label: 'U-KG' },
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

r.get('/classes',...reader,async(req:AuthRequest,res)=>{
 const sid = req.user!.schoolId;
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
    return res.json(merged);
  }
 } catch {}

 // Merge any Firestore classes on top
 if (isFirebaseConfigured()) {
   try {
     const snap = await collections.classes().get();
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
  const q=await pool.query('INSERT INTO classes(school_id,class_number) VALUES($1,$2) RETURNING *',[sid,n]);
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
 const sid=req.user!.schoolId;
 try {
  await pool.query('DELETE FROM classes WHERE id=$1 AND school_id=$2 RETURNING id',[req.params.id,sid]);
 } catch {}
 const idx = demoClasses.findIndex(c => c.id === req.params.id && (!c.school_id || isSameSchool(c.school_id, sid)));
 if (idx >= 0) demoClasses.splice(idx, 1);
 deleteClassFromFirestore(String(req.params.id)).catch(() => {});
 res.json({success:true});
});

r.get('/sections',...reader,async(req:AuthRequest,res)=>{
 const sid = req.user!.schoolId;
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
    return res.json(list);
  }
 } catch {}

 // Query Cloud Firestore for sections belonging to this school
 if (isFirebaseConfigured()) {
   try {
      const snap = await collections.sections().get();
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
 const {classId,name}=req.body || {};
 if(!classId||!name||!String(name).trim()) return res.status(400).json({message:'Class and section name are required'});
 const cleanName = String(name).trim().toUpperCase();

 let classNumber = 8;
 const matchClass = demoClasses.find(c => (c.id === classId || String(c.class_number) === String(classId)) && (!c.school_id || isSameSchool(c.school_id, sid)));
 if (matchClass) {
   classNumber = matchClass.class_number;
 } else if (typeof classId === 'string' && classId.startsWith('cls-')) {
   classNumber = Number(classId.replace(/cls-.*?-?/, '')) || 8;
 }

 try {
  const valid=await pool.query('SELECT id, class_number FROM classes WHERE (id=$1 OR class_number=$2) AND school_id=$3',[classId,classNumber,sid]);
  if(valid.rowCount) {
    const realClassId = valid.rows[0].id;
    classNumber = valid.rows[0].class_number;
    const q=await pool.query('INSERT INTO sections(school_id,class_id,name) VALUES($1,$2,$3) RETURNING *',[sid,realClassId,cleanName]);
    const created = { id: q.rows[0].id, class_id: realClassId, class_number: classNumber, name: cleanName, school_id: sid };
    demoSections.push(created);
    demoSections.sort((a,b) => a.class_number - b.class_number || a.name.localeCompare(b.name));
    const targetCls = demoClasses.find(c => (c.id === classId || c.class_number === classNumber) && (!c.school_id || isSameSchool(c.school_id, sid)));
    if (targetCls) targetCls.section_count = (targetCls.section_count || 0) + 1;
    syncSectionToFirestore(created).catch(() => {});
    return res.status(201).json(created);
  }
 } catch {}

 const newSection = {
   id: `sec-${sid}-${classNumber}-${cleanName.toLowerCase()}-${Date.now().toString().slice(-4)}`,
   class_id: classId,
   class_number: classNumber,
   name: cleanName,
   school_id: sid
 };
 demoSections.push(newSection);
 demoSections.sort((a,b) => a.class_number - b.class_number || a.name.localeCompare(b.name));
 const targetCls = demoClasses.find(c => (c.id === classId || c.class_number === classNumber) && (!c.school_id || isSameSchool(c.school_id, sid)));
 if (targetCls) targetCls.section_count = (targetCls.section_count || 0) + 1;
 syncSectionToFirestore(newSection).catch(() => {});
 res.status(201).json(newSection);
});

r.delete('/sections/:id',...admin,async(req:AuthRequest,res)=>{
 const sid = req.user!.schoolId;
 try {
  await pool.query('DELETE FROM sections WHERE id=$1 AND school_id=$2 RETURNING id',[req.params.id,sid]);
 } catch {}
 const idx = demoSections.findIndex(s => s.id === req.params.id && (!s.school_id || isSameSchool(s.school_id, sid)));
 if (idx >= 0) demoSections.splice(idx, 1);
 deleteSectionFromFirestore(String(req.params.id)).catch(() => {});
 res.json({success:true});
});

export const demoStudents: any[] = [
  { id: 'stud-001', name: 'Rohan Sharma', fullName: 'Rohan Sharma', roll_number: '1', rollNumber: '1', admission_number: 'GW-2025-001', admissionNumber: 'GW-2025-001', school_id: '00000000-0000-0000-0000-000000000001', schoolId: '00000000-0000-0000-0000-000000000001', parent_name: 'Mohan Sharma', parent_sms_number: '9800011001', parent_email: 'mohan.sharma@gmail.com', student_email: 'student@greenwood.local', email: 'student@greenwood.local', class_id: 'cls-10', class_number: 10, section_id: 'sec-10-a', section_name: 'A' },
  { id: 'st-01', name: 'Arjun Kumar', roll_number: '1', admission_number: 'ADM-2025-001', admissionNumber: 'ADM-2025-001', school_id: '00000000-0000-0000-0000-000000000001', schoolId: '00000000-0000-0000-0000-000000000001', parent_name: 'Ramesh Kumar', parent_sms_number: '9876543210', parent_email: 'ramesh.kumar@example.com', class_id: 'cls-8', class_number: 8, section_id: 'sec-8-a', section_name: 'A' },
  { id: 'st-02', name: 'Priya Sharma', roll_number: '2', admission_number: 'ADM-2025-002', admissionNumber: 'ADM-2025-002', school_id: '00000000-0000-0000-0000-000000000001', schoolId: '00000000-0000-0000-0000-000000000001', parent_name: 'Sunil Sharma', parent_sms_number: '9876543211', parent_email: 'sunil.sharma@example.com', class_id: 'cls-8', class_number: 8, section_id: 'sec-8-a', section_name: 'A' },
  { id: 'st-03', name: 'Rahul Das', roll_number: '3', admission_number: 'ADM-2025-003', admissionNumber: 'ADM-2025-003', school_id: '00000000-0000-0000-0000-000000000001', schoolId: '00000000-0000-0000-0000-000000000001', parent_name: 'Bikash Das', parent_sms_number: '9876543212', parent_email: 'bikash.das@example.com', class_id: 'cls-8', class_number: 8, section_id: 'sec-8-a', section_name: 'A' },
  { id: 'st-04', name: 'Ananya Sen', roll_number: '4', admission_number: 'ADM-2025-004', admissionNumber: 'ADM-2025-004', school_id: '00000000-0000-0000-0000-000000000001', schoolId: '00000000-0000-0000-0000-000000000001', parent_name: 'Subhash Sen', parent_sms_number: '9876543213', parent_email: 'subhash.sen@example.com', class_id: 'cls-8', class_number: 8, section_id: 'sec-8-b', section_name: 'B' },
  { id: 'st-05', name: 'Dev Mukherjee', roll_number: '5', admission_number: 'ADM-2025-005', admissionNumber: 'ADM-2025-005', school_id: '00000000-0000-0000-0000-000000000001', schoolId: '00000000-0000-0000-0000-000000000001', parent_name: 'Amit Mukherjee', parent_sms_number: '9876543214', parent_email: 'amit.m@example.com', class_id: 'cls-8', class_number: 8, section_id: 'sec-8-b', section_name: 'B' },
  { id: 'st-06', name: 'Ishita Ghosh', roll_number: '6', admission_number: 'ADM-2025-006', admissionNumber: 'ADM-2025-006', school_id: '00000000-0000-0000-0000-000000000001', schoolId: '00000000-0000-0000-0000-000000000001', parent_name: 'Pranab Ghosh', parent_sms_number: '9876543215', parent_email: 'pranab.g@example.com', class_id: 'cls-9', class_number: 9, section_id: 'sec-9-a', section_name: 'A' },
  { id: 'st-07', name: 'Karan Patel', roll_number: '7', admission_number: 'ADM-2025-007', admissionNumber: 'ADM-2025-007', school_id: '00000000-0000-0000-0000-000000000001', schoolId: '00000000-0000-0000-0000-000000000001', parent_name: 'Vijay Patel', parent_sms_number: '9876543216', parent_email: 'vijay.p@example.com', class_id: 'cls-9', class_number: 9, section_id: 'sec-9-a', section_name: 'A' },
  { id: 'st-08', name: 'Sneha Roy', roll_number: '8', admission_number: 'ADM-2025-008', admissionNumber: 'ADM-2025-008', school_id: '00000000-0000-0000-0000-000000000001', schoolId: '00000000-0000-0000-0000-000000000001', parent_name: 'Debashis Roy', parent_sms_number: '9876543217', parent_email: 'debashis.roy@example.com', class_id: 'cls-10', class_number: 10, section_id: 'sec-10-a', section_name: 'A' },
  { id: 'st-09', name: 'Rohan Gupta', roll_number: '9', admission_number: 'ADM-2025-009', admissionNumber: 'ADM-2025-009', school_id: '00000000-0000-0000-0000-000000000001', schoolId: '00000000-0000-0000-0000-000000000001', parent_name: 'Manoj Gupta', parent_sms_number: '9876543218', parent_email: 'manoj.gupta@example.com', class_id: 'cls-10', class_number: 10, section_id: 'sec-10-b', section_name: 'B' },
  { id: 'st-10', name: 'Tanvi Verma', roll_number: '10', admission_number: 'ADM-2025-010', admissionNumber: 'ADM-2025-010', school_id: '00000000-0000-0000-0000-000000000001', schoolId: '00000000-0000-0000-0000-000000000001', parent_name: 'Sanjay Verma', parent_sms_number: '9876543219', parent_email: 'sanjay.verma@example.com', class_id: 'cls-10', class_number: 10, section_id: 'sec-10-b', section_name: 'B' }
];

export const demoTeachers: any[] = [
  { id: '00000000-0000-0000-0000-000000000022', name: 'Rahul Sharma', email: 'rahul@demo-school.local', employee_id: 'EMP001', mobile: '9000000001', school_id: '00000000-0000-0000-0000-000000000001', is_active: true },
  { id: '00000000-0000-0000-0000-000000000023', name: 'Priya Patel', email: 'priya@demo-school.local', employee_id: 'EMP002', mobile: '9000000002', school_id: '00000000-0000-0000-0000-000000000001', is_active: true }
];

// In-memory teacher teaching allocations (subject × class × section × session × alt-faculty)
export const demoTeacherAssignments: any[] = [
  { id: 'ta-1', teacher_id: '00000000-0000-0000-0000-000000000022', teacher_name: 'Rahul Sharma', subject_id: 'sub-math', subject_name: 'Mathematics', class_id: 'cls-10', class_number: 10, section_id: 'sec-10-a', section_name: 'A', session_id: 'ay-2025-26', session_name: '2025–26 Academic Session', alt_teacher_id: '00000000-0000-0000-0000-000000000023', alt_teacher_name: 'Priya Patel', school_id: '00000000-0000-0000-0000-000000000001' },
  { id: 'ta-2', teacher_id: '00000000-0000-0000-0000-000000000022', teacher_name: 'Rahul Sharma', subject_id: 'sub-phy', subject_name: 'Physics', class_id: 'cls-9', class_number: 9, section_id: 'sec-9-a', section_name: 'A', session_id: 'ay-2025-26', session_name: '2025–26 Academic Session', alt_teacher_id: '00000000-0000-0000-0000-000000000023', alt_teacher_name: 'Priya Patel', school_id: '00000000-0000-0000-0000-000000000001' },
  { id: 'ta-3', teacher_id: '00000000-0000-0000-0000-000000000023', teacher_name: 'Priya Patel', subject_id: 'sub-sci', subject_name: 'Science', class_id: 'cls-10', class_number: 10, section_id: 'sec-10-b', section_name: 'B', session_id: 'ay-2025-26', session_name: '2025–26 Academic Session', alt_teacher_id: '00000000-0000-0000-0000-000000000022', alt_teacher_name: 'Rahul Sharma', school_id: '00000000-0000-0000-0000-000000000001' },
  { id: 'ta-4', teacher_id: '00000000-0000-0000-0000-000000000023', teacher_name: 'Priya Patel', subject_id: 'sub-eng', subject_name: 'English', class_id: 'cls-8', class_number: 8, section_id: 'sec-8-a', section_name: 'A', session_id: 'ay-2025-26', session_name: '2025–26 Academic Session', alt_teacher_id: null, alt_teacher_name: null, school_id: '00000000-0000-0000-0000-000000000001' }
];

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

r.get('/students',...admin,async(req:AuthRequest,res)=>{
 const search=String(req.query.search||'').trim().toLowerCase();
 const sessionFilter=String(req.query.session||req.query.sessionId||req.query.academic_year_id||'').trim();
 const userSchoolId = req.user?.schoolId;

 try {
  const q=await pool.query(`SELECT st.id,st.name,st.roll_number,st.admission_number,st.parent_name,st.parent_sms_number,st.email AS student_email,st.parent_email,st.user_id,st.photo_url,
  st.academic_year_id, ay.name AS session_name,
  c.id class_id,c.class_number,sec.id section_id,sec.name section_name
  FROM students st 
  JOIN classes c ON c.id=st.class_id 
  JOIN sections sec ON sec.id=st.section_id
  LEFT JOIN academic_years ay ON ay.id=st.academic_year_id
  WHERE st.school_id=$1 AND st.is_active=true
  AND ($2='' OR st.name ILIKE '%'||$2||'%' OR st.roll_number ILIKE '%'||$2||'%' OR COALESCE(st.admission_number, '') ILIKE '%'||$2||'%' OR COALESCE(st.email, '') ILIKE '%'||$2||'%' OR COALESCE(st.parent_email, '') ILIKE '%'||$2||'%')
  ORDER BY c.class_number,sec.name,st.roll_number`,[userSchoolId,search]);
  if (q.rowCount && q.rows.length > 0) {
    let rows = q.rows;
    if (sessionFilter) {
      rows = rows.filter((st: any) => isSameSession(st.session_name || st.academic_year_id, sessionFilter));
    }
    return res.json(rows);
  }
 } catch {}

 // If Firestore is configured, load from Cloud Firestore
 if (isFirebaseConfigured()) {
  try {
    const snap = await collections.students().get();
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
          // Robust class and section extraction
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
      }).filter(s => {
        if (s.is_active === false) return false;
        if (!userSchoolId || !s.school_id) return false;
        return isSameSchool(s.school_id, userSchoolId);
      });

      // Merge in-memory demoStudents newly created or updated for this specific school
      for (const ds of demoStudents) {
        if (!list.some(x => x.id === ds.id)) {
          if (ds.school_id && userSchoolId && isSameSchool(ds.school_id, userSchoolId)) {
            list.unshift(ds);
          }
        }
      }

      if (list.length > 0) {
        let filtered = search
          ? list.filter(s =>
              s.name.toLowerCase().includes(search) ||
              String(s.roll_number).includes(search) ||
              (s.admission_number && s.admission_number.toLowerCase().includes(search)) ||
              (s.admissionNumber && s.admissionNumber.toLowerCase().includes(search)) ||
              (s.email && s.email.toLowerCase().includes(search)) ||
              (s.student_email && s.student_email.toLowerCase().includes(search)) ||
              (s.parent_email && s.parent_email.toLowerCase().includes(search))
            )
          : list;
        if (sessionFilter) {
          filtered = filtered.filter(s => isSameSession(s.session_name || s.session || s.academic_year_id || s.session_id, sessionFilter));
        }
        return res.json(filtered);
      }
    }
  } catch (e: any) {
    console.warn('[Firestore] Students lookup fallback error:', e.message);
  }
 }

  // Check in-memory students registered for this specific school
  const memSchoolStudents = demoStudents.filter(s => s.school_id && userSchoolId && isSameSchool(s.school_id, userSchoolId));
  if (memSchoolStudents.length > 0) {
    let filtered = search
      ? memSchoolStudents.filter(s =>
          s.name.toLowerCase().includes(search) ||
          String(s.roll_number).includes(search) ||
          (s.admission_number && s.admission_number.toLowerCase().includes(search)) ||
          (s.admissionNumber && s.admissionNumber.toLowerCase().includes(search)) ||
          (s.email && s.email.toLowerCase().includes(search)) ||
          (s.student_email && s.student_email.toLowerCase().includes(search)) ||
          (s.parent_email && s.parent_email.toLowerCase().includes(search))
        )
      : memSchoolStudents;
    if (sessionFilter) {
      filtered = filtered.filter(s => isSameSession(s.session_name || s.session || s.academic_year_id || s.session_id, sessionFilter));
    }
    return res.json(filtered);
  }

  // Only Greenwood test school may access demoStudents fallback
  if (isTestSchool(userSchoolId)) {
   const schoolStudents = demoStudents.filter(s => isSameSchool(s.school_id, userSchoolId));
   const studentList = schoolStudents.length ? schoolStudents : demoStudents;
   let filtered = search
     ? studentList.filter(s =>
         s.name.toLowerCase().includes(search) ||
         String(s.roll_number).includes(search) ||
         (s.admission_number && s.admission_number.toLowerCase().includes(search)) ||
         (s.admissionNumber && s.admissionNumber.toLowerCase().includes(search)) ||
         (s.email && s.email.toLowerCase().includes(search)) ||
         (s.student_email && s.student_email.toLowerCase().includes(search)) ||
         (s.parent_email && s.parent_email.toLowerCase().includes(search))
       )
     : studentList;
   if (sessionFilter) {
     filtered = filtered.filter(s => isSameSession(s.session_name || s.session || s.academic_year_id || s.session_id, sessionFilter));
   }
   return res.json(filtered);
 }

 // Any other school starts completely clean with 0 students
 res.json([]);
});

// GET /students/template — download standardized Excel import template
r.get('/students/template', ...reader, (_req, res) => {
  const XLSX = require('xlsx');
  const sample = [
    { 'First Name': 'Aarav',  'Last Name': 'Sharma',  'Full Name': 'Aarav Sharma',  'Admission Number': 'ADM-2025-001', 'Roll Number': '101', 'Session': '2025-26', 'Class': 'Class 1', 'Section': 'A', 'Parent Name': 'Rajesh Sharma', 'Parent Phone': '9876543210', 'Parent Email': 'rajesh@example.com', 'Student Email': 'aarav@school.edu' },
    { 'First Name': 'Diya',   'Last Name': 'Patel',   'Full Name': 'Diya Patel',    'Admission Number': 'ADM-2025-002', 'Roll Number': '102', 'Session': '2025-26', 'Class': 'Class 1', 'Section': 'A', 'Parent Name': 'Kirit Patel',   'Parent Phone': '9876543211', 'Parent Email': 'kirit@example.com',  'Student Email': 'diya@school.edu' },
    { 'First Name': 'Rohan',  'Last Name': 'Gupta',   'Full Name': 'Rohan Gupta',   'Admission Number': 'ADM-2025-003', 'Roll Number': '103', 'Session': '2025-26', 'Class': 'Class 2', 'Section': 'B', 'Parent Name': 'Manoj Gupta',   'Parent Phone': '9876543212', 'Parent Email': 'manoj@example.com', 'Student Email': 'rohan@school.edu' },
    { 'First Name': 'L-KG',   'Last Name': 'Example', 'Full Name': 'L-KG Example',  'Admission Number': 'ADM-2025-004', 'Roll Number': '104', 'Session': '2025-26', 'Class': 'L-KG',    'Section': 'A', 'Parent Name': 'Parent Name',   'Parent Phone': '9876543213', 'Parent Email': 'p@example.com',    'Student Email': '' },
    { 'First Name': 'U-KG',   'Last Name': 'Example', 'Full Name': 'U-KG Example',  'Admission Number': 'ADM-2025-005', 'Roll Number': '105', 'Session': '2025-26', 'Class': 'U-KG',    'Section': 'B', 'Parent Name': 'Parent Name',   'Parent Phone': '9876543214', 'Parent Email': 'p2@example.com',   'Student Email': '' },
  ];
  const ws = XLSX.utils.json_to_sheet(sample);
  ws['!cols'] = [14,14,20,18,14,12,12,10,20,16,24,26].map(wch => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Students Import Template');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="students_import_template.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

r.post('/students',...admin,async(req:AuthRequest,res)=>{
 const {
   firstName: rawFirst, lastName: rawLast, name: rawName,
   rollNumber, admissionNumber, admission_number, parentName, parentSmsNumber, classId, sectionId,
   studentEmail, email, parentEmail, loginOption, sendInviteEmail = true,
   sessionId, session
 } = req.body;

 // Name normalization
 const firstName  = String(rawFirst || '').trim();
 const lastName   = String(rawLast  || '').trim();
 const name = firstName && lastName ? `${firstName} ${lastName}` : (firstName || lastName || String(rawName||'').trim());
 if(!name||!rollNumber||!classId||!sectionId) return res.status(400).json({message:'First Name, Last Name (or full name), roll number, class and section are required'});

 // Mandatory session binding — resolve academic_year_id
 const { getInMemoryAcademicYears, getInMemoryActiveAcademicYear } = await import('./academicYears');
 const schoolId = req.user!.schoolId;
 const rawSession = String(sessionId || session || '').trim();
 let resolvedSessionId: string | null = null;
 let resolvedSessionName: string | null = null;
 try {
   const ayQ = await pool.query(`SELECT id, name, code, is_active FROM academic_years WHERE school_id=$1 AND is_archived=false`, [schoolId]);
   if (ayQ.rowCount && ayQ.rows.length > 0) {
     if (rawSession) {
       const found = ayQ.rows.find((r: any) => r.id === rawSession || r.code === rawSession || isSameSession(r.name, rawSession));
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
     ? memYears.find(y => (y.id === rawSession || y.code === rawSession || isSameSession(y.name, rawSession)) && !y.is_archived)
     : (memYears.find(y => y.is_active && !y.is_archived) || memYears[1] || memYears[0]);
   resolvedSessionId = target?.id || (rawSession ? `ay-${rawSession}` : 'ay-2025-26');
   resolvedSessionName = target?.name || rawSession || '2025–26 Academic Session';
 }
 
 const cleanStudentEmail = String(studentEmail || email || '').trim().toLowerCase();
 const cleanParentEmail = String(parentEmail || '').trim().toLowerCase();
 const cleanAdmissionNumber = String(admissionNumber || admission_number || '').trim();
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

 try {
  const valid=await pool.query(`SELECT s.id, s.name section_name, c.class_number FROM sections s JOIN classes c ON c.id=s.class_id WHERE s.id=$1 AND c.id=$2 AND s.school_id=$3`,[sectionId,classId,req.user!.schoolId]);
  if(valid.rowCount) {
    clsNum = valid.rows[0].class_number;
    secName = valid.rows[0].section_name;

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
      const userCheck = await pool.query(`SELECT id FROM users WHERE LOWER(email)=$1 LIMIT 1`, [targetLoginEmail]);
      if (userCheck.rowCount && userCheck.rowCount > 0) {
        linkedUserId = userCheck.rows[0].id;
      } else {
        const tempPass = crypto.randomBytes(8).toString('hex') + 'Aa1!';
        const tempHash = await bcrypt.hash(tempPass, 10);
        const uq = await pool.query(
          `INSERT INTO users(school_id, name, email, password_hash, role) VALUES($1, $2, $3, $4, 'STUDENT') RETURNING id`,
          [req.user!.schoolId, name, targetLoginEmail, tempHash]
        );
        linkedUserId = uq.rows[0].id;
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
              recipientName: isParent ? (parentName || 'Parent/Guardian') : name,
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
        } catch (e: any) {
          console.warn('[StudentEnrollment] Failed to send student reset email:', e.message);
        }
      }
    } else {
      console.log(`[StudentEnrollment] SKIPPED email notification - No email address provided for student "${name}" (Roll: ${rollNumber})`);
    }

    const q=await pool.query(
      `INSERT INTO students(
        school_id, academic_year_id, class_id, section_id, roll_number, 
        admission_number, first_name, last_name, full_name, name, 
        parent_name, parent_sms_number, email, parent_email, user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
      [
        req.user!.schoolId,
        resolvedSessionId,
        classId,
        sectionId,
        rollNumber,
        cleanAdmissionNumber || null,
        firstName || null,
        lastName || null,
        name,
        name,
        parentName || null,
        parentSmsNumber,
        cleanStudentEmail || null,
        cleanParentEmail || null,
        linkedUserId
      ]
    );
    
    const created = {
      ...q.rows[0],
      academic_year_id: resolvedSessionId,
      session_id: resolvedSessionId,
      session_name: resolvedSessionName,
      session: resolvedSessionName || resolvedSessionId,
      full_name: name,
      first_name: firstName || null,
      last_name: lastName || null,
      class_number: clsNum,
      section_name: secName,
      admission_number: cleanAdmissionNumber || q.rows[0].admission_number,
      admissionNumber: cleanAdmissionNumber || q.rows[0].admission_number,
      student_email: cleanStudentEmail,
      parent_email: cleanParentEmail,
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
   console.warn('[StudentEnrollment] Database insert fallback:', err.message);
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
         recipientName: isParent ? (parentName || 'Parent/Guardian') : name,
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

r.post('/students/bulk-import',...admin,async(req:AuthRequest,res)=>{
 const {students=[],sessionId:reqSessionId}=req.body||{};
 if(!Array.isArray(students)||students.length===0) return res.status(400).json({message:'Array of student records is required'});

 const schoolId = req.user!.schoolId;

 // Resolve session for bulk import
 const { getInMemoryAcademicYears } = await import('./academicYears');
 let bulkSessionId: string | null = null;
 let bulkSessionName: string | null = null;
 try {
   const ayQ = reqSessionId
     ? await pool.query(`SELECT id,name FROM academic_years WHERE id=$1 AND school_id=$2 AND is_archived=false LIMIT 1`,[reqSessionId,schoolId])
     : await pool.query(`SELECT id,name FROM academic_years WHERE school_id=$1 AND is_active=true AND is_archived=false LIMIT 1`,[schoolId]);
   if (ayQ.rowCount && ayQ.rows.length>0){ bulkSessionId=ayQ.rows[0].id; bulkSessionName=ayQ.rows[0].name; }
 } catch {}
 if (!bulkSessionId) {
   const memYears = getInMemoryAcademicYears(schoolId);
   const target = reqSessionId ? memYears.find(y=>y.id===reqSessionId&&!y.is_archived) : memYears.find(y=>y.is_active&&!y.is_archived);
   if (reqSessionId && !target) return res.status(400).json({ message: 'Invalid sessionId for bulk import.' });
   bulkSessionId = target?.id || null;
   bulkSessionName = target?.name || null;
 }

 const REQUIRED_HEADERS = ['First Name','Last Name','Admission Number','Roll Number','Parent Name','Parent Phone','Parent Email','Student Email'];

 // Validate rows and collect errors
 const validRows: any[] = [];
 const errors: {row:number;field:string;message:string}[] = [];
 const seenAdmNums = new Set<string>();

 for (let i=0;i<students.length;i++) {
   const st = students[i];
   const rowNum = i+1;
   let firstName  = String(st.firstName||st['First Name']||st.first_name||'').trim();
    let lastName   = String(st.lastName||st['Last Name']||st.last_name||'').trim();
    const rawFullName = String(st.fullName||st['Full Name']||st.full_name||st.name||'').trim();
    if ((!firstName || !lastName) && rawFullName) {
      const parts = rawFullName.split(' ');
      if (!firstName) firstName = parts[0] || '';
      if (!lastName) lastName = parts.slice(1).join(' ') || '';
    }
    const name = rawFullName || (firstName&&lastName ? `${firstName} ${lastName}` : (firstName||lastName||String(st.name||'').trim()));
   const rollNumber = String(st.rollNumber||st['Roll Number']||st.roll_number||'').trim();
   const admissionNumber = String(st.admissionNumber||st['Admission Number']||st.admission_number||'').trim();
   const parentName = String(st.parentName||st['Parent Name']||st.parent_name||'').trim();
   const parentPhone = String(st.parentPhone||st['Parent Phone']||st.parentSmsNumber||st.parent_sms_number||'').trim();
   const parentEmail = String(st.parentEmail||st['Parent Email']||st.parent_email||'').trim();
   const studentEmail = String(st.studentEmail||st['Student Email']||st.email||'').trim();

   // Class/section resolution — support label names like 'L-KG','U-KG','Class 1' etc.
   const rawClass = String(st.classLabel||st['Class']||st.classNumber||st.class_number||'').trim();
   const rawSection = String(st.sectionName||st['Section']||st.section_name||'A').trim().toUpperCase();
   let classId = st.classId || st.class_id || '';
   let classNumber: number;
   let classLabel = rawClass;
   if (!classId) {
     if (/l.?kg/i.test(rawClass)) { classId='cls-lkg'; classNumber=-1; classLabel='L-KG'; }
     else if (/u.?kg/i.test(rawClass)) { classId='cls-ukg'; classNumber=0; classLabel='U-KG'; }
     else { classNumber=Number(rawClass.replace(/[^0-9]/g,''))||1; classId=`cls-${classNumber}`; classLabel=`Class ${classNumber}`; }
   } else {
     classNumber = Number(String(classId).replace(/[^0-9]/g,'')) || 1;
   }
   const sectionName = rawSection || 'A';
    let sectionId = st.sectionId || st.section_id || `sec-${classId}-${sectionName.toLowerCase()}`;
    try {
      const cQ = await pool.query(`SELECT id FROM classes WHERE school_id=$1 AND (class_number=$2 OR LOWER(label)=LOWER($3) OR id=$4) LIMIT 1`, [schoolId, classNumber, classLabel, classId]);
      if (cQ.rowCount && cQ.rows.length > 0) {
        classId = cQ.rows[0].id;
        const sQ = await pool.query(`SELECT id FROM sections WHERE school_id=$1 AND class_id=$2 AND UPPER(name)=$3 LIMIT 1`, [schoolId, classId, sectionName]);
        if (sQ.rowCount && sQ.rows.length > 0) sectionId = sQ.rows[0].id;
      }
    } catch {}

   // Validation
   if (!firstName) errors.push({row:rowNum,field:'First Name',message:'First Name is required'});
   if (!lastName)  errors.push({row:rowNum,field:'Last Name', message:'Last Name is required'});
   if (!rollNumber) errors.push({row:rowNum,field:'Roll Number',message:'Roll Number is required'});
   if (!admissionNumber) errors.push({row:rowNum,field:'Admission Number',message:'Admission Number is required'});
   if (!parentPhone) errors.push({row:rowNum,field:'Parent Phone',message:'Parent Phone is required'});
   if (admissionNumber && seenAdmNums.has(admissionNumber)) errors.push({row:rowNum,field:'Admission Number',message:`Duplicate admission number '${admissionNumber}' in this batch`});
   if (admissionNumber) seenAdmNums.add(admissionNumber);

   if (errors.filter(e=>e.row===rowNum).length===0) {
     validRows.push({ firstName,lastName,name,rollNumber,admissionNumber,parentName,parentPhone,parentEmail,studentEmail,classId,classNumber,classLabel,sectionId,sectionName });
   }
 }

 if (errors.length>0) {
   return res.status(422).json({ success:false, errors, message:`${errors.length} validation error(s) found. Fix and re-import.` });
 }

 // Check existing admission numbers in DB
 const admNums = validRows.map(r=>r.admissionNumber).filter(Boolean);
 if (admNums.length>0) {
   try {
     const dupChk = await pool.query(`SELECT admission_number FROM students WHERE school_id=$1 AND admission_number=ANY($2) AND is_active=true`,[schoolId,admNums]);
     if (dupChk.rows.length>0) {
       const dups = dupChk.rows.map((r:any)=>r.admission_number);
       return res.status(400).json({ success:false, message:`Duplicate admission numbers already exist: ${dups.join(', ')}` });
     }
   } catch {}
 }

 const createdList: any[] = [];

 // Try PostgreSQL transaction
 try {
   const client = await pool.connect();
   try {
     await client.query('BEGIN');
     for (const st of validRows) {
       try {
         const q = await client.query(
           `INSERT INTO students(
              school_id, academic_year_id, class_id, section_id, roll_number, 
              admission_number, first_name, last_name, full_name, name, 
              parent_name, parent_sms_number, email, parent_email, user_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            ON CONFLICT (school_id,admission_number) WHERE is_active=true DO NOTHING
            RETURNING *`,
           [schoolId,bulkSessionId,st.classId,st.sectionId,st.rollNumber,st.admissionNumber||null,st.firstName||null,st.lastName||null,st.name,st.name,st.parentName||null,st.parentPhone,st.studentEmail||null,st.parentEmail||null,null]
         );
         if (q.rowCount && q.rows.length>0) {
           const created = {
              ...q.rows[0],
              academic_year_id: bulkSessionId,
              session_id: bulkSessionId,
              session_name: bulkSessionName,
              session: bulkSessionName || bulkSessionId,
              full_name: st.name,
              class_number: st.classNumber,
              class_label: st.classLabel,
              section_name: st.sectionName,
              is_active: true
            };
           createdList.push(created);
           demoStudents.unshift(created);
           syncStudentToFirestore(created).catch(()=>{});
         }
       } catch { /* skip individual row insert errors inside tx */ }
     }
     if (createdList.length === 0 && validRows.length > 0) {
        await client.query('ROLLBACK');
        client.release();
        throw new Error('Zero DB rows inserted, falling back to memory/Firestore');
      }
      await client.query('COMMIT');
      client.release();
      return res.status(201).json({ success:true, count:createdList.length, items:createdList, session:bulkSessionName });
   } catch (txErr:any) {
     await client.query('ROLLBACK');
     client.release();
     throw txErr;
   }
 } catch {}

 // Fallback: in-memory / Firestore
 for (const st of validRows) {
   const studentObj = {
     id: `st-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
     name: st.name, first_name: st.firstName||null, last_name: st.lastName||null,
     roll_number: st.rollNumber,
     admission_number: st.admissionNumber||`ADM-${Date.now().toString().slice(-4)}`,
     admissionNumber: st.admissionNumber||`ADM-${Date.now().toString().slice(-4)}`,
     parent_name: st.parentName||'—', parent_sms_number: st.parentPhone,
     parent_email: st.parentEmail, email: st.studentEmail,
     class_id: st.classId, class_number: st.classNumber, class_label: st.classLabel,
     section_id: st.sectionId, section_name: st.sectionName,
     school_id: schoolId, schoolId,
     academic_year_id: bulkSessionId, session_id: bulkSessionId, session_name: bulkSessionName, session: bulkSessionName || bulkSessionId, full_name: st.name, is_active: true
   };
   createdList.push(studentObj);
   demoStudents.unshift(studentObj);
   syncStudentToFirestore(studentObj).catch(()=>{});
 }
 res.status(201).json({ success:true, count:createdList.length, items:createdList, session:bulkSessionName });
});

r.post('/students/bulk-delete',...admin,async(req:AuthRequest,res)=>{
 const {ids=[]}=req.body||{};
 if(!Array.isArray(ids)||ids.length===0) return res.status(400).json({message:'Array of IDs required'});
 try {
   await pool.query(`UPDATE students SET is_active=false,updated_at=NOW() WHERE id=ANY($1::uuid[]) AND school_id=$2`,[ids,req.user!.schoolId]);
 } catch {}
 const idSet = new Set(ids);
 for (let i = demoStudents.length - 1; i >= 0; i--) {
   if (idSet.has(demoStudents[i].id)) {
     demoStudents.splice(i, 1);
   }
 }
 for (const id of ids) {
   deleteStudentFromFirestore(id).catch(() => {});
 }
 res.json({ success: true, count: ids.length });
});

r.put('/students/:id',...admin,async(req:AuthRequest,res)=>{
 const {name,rollNumber,admissionNumber,admission_number,parentName,parentSmsNumber,studentEmail,email,parentEmail,classId,sectionId}=req.body;
 const cleanStudentEmail = String(studentEmail || email || '').trim().toLowerCase();
 const cleanParentEmail = String(parentEmail || '').trim().toLowerCase();
 const cleanAdmissionNumber = String(admissionNumber || admission_number || '').trim();
 try {
  const q=await pool.query(`UPDATE students SET name=$1,roll_number=$2,admission_number=$3,parent_name=$4,parent_sms_number=$5,email=$6,parent_email=$7,class_id=$8,section_id=$9,updated_at=NOW()
  WHERE id=$10 AND school_id=$11 RETURNING *`,[name,rollNumber,cleanAdmissionNumber||null,parentName||null,parentSmsNumber,cleanStudentEmail||null,cleanParentEmail||null,classId,sectionId,req.params.id,req.user!.schoolId]);
  if(!q.rowCount)return res.status(404).json({message:'Student not found'});
  const result = {
    ...q.rows[0],
    admission_number: cleanAdmissionNumber || q.rows[0].admission_number,
    admissionNumber: cleanAdmissionNumber || q.rows[0].admission_number,
    student_email: cleanStudentEmail,
    parent_email: cleanParentEmail
  };
  syncStudentToFirestore(result).catch(() => {});
  return res.json(result);
 } catch {
  let putClsNum = 1;
    const strPutClassId = String(classId || '').trim();
    if (/l.?kg/i.test(strPutClassId)) putClsNum = -1;
    else if (/u.?kg/i.test(strPutClassId)) putClsNum = 0;
    else {
      const m = strPutClassId.match(/cls-(\d+)/);
      if (m) putClsNum = Number(m[1]);
      else if (/^\d+$/.test(strPutClassId)) putClsNum = Number(strPutClassId);
    }
    const strPutSecId = String(sectionId || '').trim().toUpperCase();
    const putSecName = (strPutSecId === 'B' || strPutSecId.endsWith('-B') || strPutSecId.endsWith('_B')) ? 'B' : 'A';

    const updated = {
      id: req.params.id,
      name,
      roll_number: rollNumber,
      admission_number: cleanAdmissionNumber,
      admissionNumber: cleanAdmissionNumber,
      parent_name: parentName,
      parent_sms_number: parentSmsNumber,
      email: cleanStudentEmail,
      student_email: cleanStudentEmail,
      parent_email: cleanParentEmail,
      class_id: classId,
      class_number: putClsNum,
      section_id: sectionId,
      section_name: putSecName
    };
  const idx = demoStudents.findIndex(s => s.id === req.params.id);
  if (idx >= 0) demoStudents[idx] = { ...demoStudents[idx], ...updated };
  else demoStudents.unshift(updated);
  syncStudentToFirestore(updated).catch(() => {});
  res.json(updated);
 }
});

r.post('/students/:id/send-reset-email',...admin,async(req:AuthRequest,res)=>{
  const studentId = req.params.id;
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
 try {
  await pool.query(`UPDATE students SET is_active=false,updated_at=NOW() WHERE id=$1 AND school_id=$2 RETURNING id`,[req.params.id,req.user!.schoolId]);
 } catch {}
 const idx = demoStudents.findIndex(s => s.id === req.params.id);
 if (idx >= 0) demoStudents.splice(idx, 1);
 deleteStudentFromFirestore(String(req.params.id)).catch(() => {});
 res.json({success:true});
});

r.get('/teachers',...admin,async(req:AuthRequest,res)=>{
 const userSchoolId = req.user?.schoolId;
 try {
  const q=await pool.query(`SELECT u.id,u.name,u.email,tp.employee_id,tp.mobile,u.is_active
  FROM users u LEFT JOIN teacher_profiles tp ON tp.user_id=u.id
  WHERE u.school_id=$1 AND u.role='TEACHER' ORDER BY u.name`,[userSchoolId]);
  if (q.rowCount && q.rows.length > 0) return res.json(q.rows);
 } catch {}

 if (isFirebaseConfigured()) {
  try {
    const snap = await collections.teachers().get();
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
 const {name,email,password,employeeId,mobile,sendInviteEmail=true}=req.body;
 if(!name||!email||!employeeId) return res.status(400).json({message:'Name, email, and employee ID are required'});
 const cleanEmail = String(email).trim().toLowerCase();
 const rawPassword = password || (crypto.randomBytes(8).toString('hex') + 'Tt1!');
 let resetInfo: any = null;

 try {
  const client=await pool.connect();
  try {
   await client.query('BEGIN');
   const hash=await bcrypt.hash(rawPassword,10);
   const u=await client.query(`INSERT INTO users(school_id,name,email,password_hash,role) VALUES($1,$2,$3,$4,'TEACHER') RETURNING id,name,email`,
    [req.user!.schoolId,name,cleanEmail,hash]);
   await client.query(`INSERT INTO teacher_profiles(user_id,employee_id,mobile) VALUES($1,$2,$3)`,[u.rows[0].id,employeeId,mobile||null]);
   await client.query('COMMIT');
   
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
         queueEmailNotification({
           schoolId: req.user?.schoolId || 'school-default',
           recipientEmail: cleanEmail,
           recipientName: name,
           recipientType: 'TEACHER',
           templateKey: 'TEACHER_CREATED',
           templateData: {
             teacher_name: name,
             school_name: req.user?.schoolName || 'School',
             employee_id: employeeId,
             login_url: resetInfo.resetUrl
           },
           idempotencyKey: `tch-welcome-${req.user?.schoolId || 'default'}-${cleanEmail}`
         }).catch(() => {});
       }
     } catch (err: any) {
       console.warn('[TeacherOnboarding] Email invite failed:', err.message);
     }
   }

   const created = {
     ...u.rows[0],
     employee_id: employeeId,
     mobile: mobile || '—',
     is_active: true,
     reset_url: resetInfo?.resetUrl,
     invite_sent: Boolean(resetInfo)
   };
   demoTeachers.unshift(created);
   syncTeacherToFirestore(created, hash).catch(() => {});
   return res.status(201).json(created);
  } catch(e){await client.query('ROLLBACK');throw e;}
  finally{client.release();}
 } catch (err: any) {
   console.warn('[TeacherOnboarding] Database fallback:', err.message);
 }

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
       queueEmailNotification({
         schoolId: req.user?.schoolId || 'school-default',
         recipientEmail: cleanEmail,
         recipientName: name,
         recipientType: 'TEACHER',
         templateKey: 'TEACHER_CREATED',
         templateData: {
           teacher_name: name,
           school_name: req.user?.schoolName || 'School',
           employee_id: employeeId,
           login_url: resetInfo.resetUrl
         },
         idempotencyKey: `tch-welcome-${req.user?.schoolId || 'default'}-${cleanEmail}`
       }).catch(() => {});
     }
   } catch {}
 }

 const newTeacher = {
   id: `tch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
   school_id: req.user!.schoolId,
   schoolId: req.user!.schoolId,
   name,
   email: cleanEmail,
   employee_id: employeeId,
   mobile: mobile || '—',
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
  const teacherId = req.params.id;
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
 const {teachers=[]}=req.body||{};
 if(!Array.isArray(teachers)||teachers.length===0) return res.status(400).json({message:'Array of teacher records is required'});
 const createdList: any[] = [];
 for (const t of teachers) {
   const name = String(t.name||'').trim();
   const email = String(t.email||'').trim().toLowerCase();
   const employeeId = String(t.employeeId||t.employee_id||`EMP${Date.now().toString().slice(-4)}`).trim();
   const mobile = String(t.mobile||t.phone||'9000000000').trim();
   const password = t.password || 'ChangeMe123!';

   if (!name || !email) continue;

   const teacherObj = {
     id: `tch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
     school_id: req.user!.schoolId,
     schoolId: req.user!.schoolId,
     name,
     email,
     employee_id: employeeId,
     mobile,
     is_active: true
   };

   let client: any;
   try {
     client = await pool.connect();
     await client.query('BEGIN');
     const hash = await bcrypt.hash(password, 10);
     const u = await client.query(
       `INSERT INTO users(school_id,name,email,password_hash,role) VALUES($1,$2,$3,$4,'TEACHER') RETURNING id,name,email`,
       [req.user!.schoolId, name, email, hash]
     );
     await client.query(
       `INSERT INTO teacher_profiles(user_id,employee_id,mobile) VALUES($1,$2,$3)`,
       [u.rows[0].id, employeeId, mobile || null]
     );
     await client.query('COMMIT');
     const created = { ...u.rows[0], school_id: req.user!.schoolId, schoolId: req.user!.schoolId, employee_id: employeeId, mobile, is_active: true };
     createdList.push(created);
     demoTeachers.unshift(created);
     registerDemoUser({
       id: created.id,
       schoolId: req.user!.schoolId,
       name,
       email,
       role: 'TEACHER',
       password
     });
     syncTeacherToFirestore(created, hash).catch(() => {});
     continue;
   } catch {
     if (client) { try { await client.query('ROLLBACK'); } catch {} }
   } finally {
     if (client) { try { client.release(); } catch {} }
   }

   createdList.push(teacherObj);
   demoTeachers.unshift(teacherObj);
   registerDemoUser({
     id: teacherObj.id,
     schoolId: req.user!.schoolId,
     name,
     email,
     role: 'TEACHER',
     password
   });
   syncTeacherToFirestore(teacherObj).catch(() => {});
 }
 res.status(201).json({ success: true, count: createdList.length, items: createdList });
});

r.post('/teachers/bulk-delete',...admin,async(req:AuthRequest,res)=>{
 const {ids=[]}=req.body||{};
 if(!Array.isArray(ids)||ids.length===0) return res.status(400).json({message:'Array of IDs required'});
 try {
   await pool.query(`UPDATE users SET is_active=false,updated_at=NOW() WHERE id=ANY($1::uuid[]) AND school_id=$2 AND role='TEACHER'`,[ids,req.user!.schoolId]);
 } catch {}
 const idSet = new Set(ids);
 for (let i = demoTeachers.length - 1; i >= 0; i--) {
   if (idSet.has(demoTeachers[i].id)) {
     demoTeachers.splice(i, 1);
   }
 }
 for (const id of ids) {
   deleteTeacherFromFirestore(id).catch(() => {});
 }
 res.json({ success: true, count: ids.length });
});

r.put('/teachers/:id',...admin,async(req:AuthRequest,res)=>{
  const {name,email,employeeId,mobile}=req.body||{};
  const tid = req.params.id;
  try {
    await pool.query(`UPDATE users SET name=$1,email=$2,updated_at=NOW() WHERE id=$3 AND school_id=$4`,[name,email,tid,req.user!.schoolId]);
    await pool.query(`UPDATE teacher_profiles SET employee_id=$1,mobile=$2 WHERE user_id=$3`,[employeeId,mobile,tid]);
  } catch {}
  const idx = demoTeachers.findIndex(t => t.id === tid);
  const updated = {
    id: tid,
    name: name || demoTeachers[idx]?.name || '',
    email: email || demoTeachers[idx]?.email || '',
    employee_id: employeeId || demoTeachers[idx]?.employee_id || '',
    mobile: mobile || demoTeachers[idx]?.mobile || '',
    is_active: true
  };
  if (idx >= 0) demoTeachers[idx] = { ...demoTeachers[idx], ...updated };
  else demoTeachers.push(updated);
  syncTeacherToFirestore(updated).catch(() => {});
  res.json(updated);
});

r.delete('/teachers/:id',...admin,async(req:AuthRequest,res)=>{
 try {
  await pool.query(`UPDATE users SET is_active=false,updated_at=NOW() WHERE id=$1 AND school_id=$2 AND role='TEACHER' RETURNING id`,[req.params.id,req.user!.schoolId]);
 } catch {}
 const idx = demoTeachers.findIndex(t => t.id === req.params.id);
 if (idx >= 0) demoTeachers.splice(idx, 1);
 deleteTeacherFromFirestore(String(req.params.id)).catch(() => {});
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
 try {
  const q=await pool.query('SELECT * FROM subjects WHERE school_id=$1 ORDER BY name',[sid]);
  if (q.rowCount && q.rows.length > 0) return res.json(q.rows);
 } catch {}

 // Check Cloud Firestore
 if (isFirebaseConfigured()) {
   try {
     const snap = await collections.subjects().get();
     if (!snap.empty) {
       const list = snap.docs
         .map(d => ({ id: d.id, ...d.data() }))
         .filter((s: any) => s.school_id && isSameSchool(s.school_id, sid));
       if (list.length > 0) {
         list.sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)));
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
 try {
  await pool.query('DELETE FROM subjects WHERE id=$1 AND school_id=$2 RETURNING id',[req.params.id,sid]);
 } catch {}
 const idx = demoSubjects.findIndex(s => s.id === req.params.id && (!s.school_id || isSameSchool(s.school_id, sid)));
 if (idx >= 0) demoSubjects.splice(idx, 1);
 deleteSubjectFromFirestore(String(req.params.id)).catch(() => {});
 res.json({success:true});
});

r.get('/school-profile',...admin,async(req:AuthRequest,res)=>{
 const sid = req.user!.schoolId!;
 try {
  const q = await pool.query('SELECT id, name, code, status, enquiry_number, address, created_at FROM schools WHERE id = $1', [sid]);
  if (q.rowCount) return res.json(q.rows[0]);
 } catch {}

 // Check Firestore
 try {
  const fsSchool = await getFirestoreSchoolById(sid);
  if (fsSchool) {
   return res.json({
    id: fsSchool.id,
    name: fsSchool.name,
    code: fsSchool.code || 'SCH001',
    status: fsSchool.status || 'ACTIVE',
    enquiry_number: fsSchool.phone || fsSchool.enquiryNumber || '1800123456',
    contact_number: fsSchool.phone || fsSchool.enquiryNumber || '1800123456',
    address: fsSchool.address || 'Main Campus',
    website: fsSchool.website || '',
    created_at: fsSchool.createdAt || new Date().toISOString()
   });
  }
 } catch {}

 res.json({
  id: sid,
  name: req.user?.schoolName || 'Institutional Campus',
  code: (req.user as any)?.schoolCode || 'SCH001',
  status: 'ACTIVE',
  enquiry_number: '1800123456',
  address: 'Main Campus'
 });
});

r.put('/school-profile',...admin,async(req:AuthRequest,res)=>{
 const sid = req.user!.schoolId!;
 const { enquiryNumber, contact_number, address, website } = req.body || {};
 const phone = contact_number || enquiryNumber;
 try {
  const q = await pool.query(
    'UPDATE schools SET enquiry_number = COALESCE($1, enquiry_number), address = COALESCE($2, address) WHERE id = $3 RETURNING id, name, code, status, enquiry_number, address',
    [phone, address, sid]
  );
  if (q.rowCount) {
    syncSchoolToFirestore(q.rows[0]).catch(() => {});
    return res.json(q.rows[0]);
  }
 } catch {}

 try {
  if (isFirebaseConfigured()) {
    await collections.schools().doc(sid).set({
      phone,
      enquiryNumber: phone,
      address,
      website: website || '',
      updatedAt: new Date().toISOString()
    }, { merge: true });
    const updated = await getFirestoreSchoolById(sid);
    if (updated) return res.json(updated);
  }
 } catch {}

 const updatedSchool = { id: sid, enquiry_number: phone, address, website };
 syncSchoolToFirestore(updatedSchool).catch(() => {});
 res.json(updatedSchool);
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
      `SELECT st.id, st.roll_number, st.name, st.parent_email AS email, c.class_number, sec.name AS section_name
       FROM students st
       JOIN classes c ON c.id = st.class_id
       JOIN sections sec ON sec.id = st.section_id
       WHERE st.school_id = $1 AND st.is_active = true
         AND (st.name ILIKE $2 OR st.roll_number ILIKE $2 OR COALESCE(st.parent_email,'') ILIKE $2)
       ORDER BY st.name ASC LIMIT 8`,
      [sid, pattern]
    );
    results.students = stRes.rows.map((r: any) => ({
      id: r.id, name: r.name, email: r.email, roll: r.roll_number,
      class: r.class_number ? `Class ${r.class_number}` : null,
      section: r.section_name, type: 'student'
    }));

    // Teachers
    const tRes = await pool.query(
      `SELECT id, name, email
       FROM users
       WHERE school_id = $1 AND role = 'TEACHER' AND is_active = true
         AND (LOWER(name) LIKE LOWER($2) OR LOWER(email) LIKE LOWER($2))
       ORDER BY name ASC LIMIT 8`,
      [sid, pattern]
    );
    results.teachers = tRes.rows.map((r: any) => ({
      id: r.id, name: r.name, email: r.email, type: 'teacher'
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
    // DB unavailable — return empty
  }

  res.json(results);
});

export default r;
