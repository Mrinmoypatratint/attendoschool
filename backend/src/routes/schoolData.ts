import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { pool } from '../db';
import { requireAuth, requireRoles, AuthRequest } from '../middleware/auth';
import { registerDemoUser } from '../store/demoUsers';
import { createAndSendPasswordReset } from './auth';

const r=Router();
const admin= [requireAuth,requireRoles('SCHOOL_ADMIN')];

export const demoClasses: any[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => ({
  id: `cls-${n}`,
  class_number: n,
  section_count: 2
}));

export const demoSections: any[] = [];
[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].forEach(n => {
  demoSections.push({ id: `sec-${n}-a`, class_id: `cls-${n}`, class_number: n, name: 'A' });
  demoSections.push({ id: `sec-${n}-b`, class_id: `cls-${n}`, class_number: n, name: 'B' });
});

r.get('/classes',...admin,async(req:AuthRequest,res)=>{
 try {
  const q=await pool.query(`SELECT c.id,c.class_number,COUNT(s.id)::int section_count
  FROM classes c LEFT JOIN sections s ON s.class_id=c.id
  WHERE c.school_id=$1 GROUP BY c.id ORDER BY c.class_number`,[req.user!.schoolId]);
  if (q.rowCount) return res.json(q.rows);
 } catch {}
 res.json(demoClasses);
});

r.post('/classes',...admin,async(req:AuthRequest,res)=>{
 const n=Number(req.body.classNumber);
 if(!Number.isInteger(n)||n<1||n>12) return res.status(400).json({message:'Class must be between 1 and 12'});
 try {
  const q=await pool.query('INSERT INTO classes(school_id,class_number) VALUES($1,$2) RETURNING *',[req.user!.schoolId,n]);
  if (q.rowCount) {
    const created = { id: q.rows[0].id, class_number: n, section_count: 0 };
    demoClasses.push(created);
    demoClasses.sort((a,b) => a.class_number - b.class_number);
    return res.status(201).json(created);
  }
 } catch {}
 const existing = demoClasses.find(c => c.class_number === n);
 if (existing) return res.status(200).json(existing);
 const newClass = { id: `cls-${n}`, class_number: n, section_count: 0, school_id: req.user!.schoolId };
 demoClasses.push(newClass);
 demoClasses.sort((a,b) => a.class_number - b.class_number);
 res.status(201).json(newClass);
});

r.get('/sections',...admin,async(req:AuthRequest,res)=>{
 try {
  const q=await pool.query(`SELECT s.id,s.name,c.id class_id,c.class_number FROM sections s JOIN classes c ON c.id=s.class_id WHERE s.school_id=$1 ORDER BY c.class_number,s.name`,[req.user!.schoolId]);
  if (q.rowCount) return res.json(q.rows);
 } catch {}
 res.json(demoSections);
});

r.post('/sections',...admin,async(req:AuthRequest,res)=>{
 const {classId,name}=req.body || {};
 if(!classId||!name||!String(name).trim()) return res.status(400).json({message:'Class and section name are required'});
 const cleanName = String(name).trim().toUpperCase();

 let classNumber = 8;
 const matchClass = demoClasses.find(c => c.id === classId || String(c.class_number) === String(classId));
 if (matchClass) {
   classNumber = matchClass.class_number;
 } else if (typeof classId === 'string' && classId.startsWith('cls-')) {
   classNumber = Number(classId.replace('cls-', '')) || 8;
 }

 try {
  const valid=await pool.query('SELECT id, class_number FROM classes WHERE (id=$1 OR class_number=$2) AND school_id=$3',[classId,classNumber,req.user!.schoolId]);
  if(valid.rowCount) {
    const realClassId = valid.rows[0].id;
    classNumber = valid.rows[0].class_number;
    const q=await pool.query('INSERT INTO sections(school_id,class_id,name) VALUES($1,$2,$3) RETURNING *',[req.user!.schoolId,realClassId,cleanName]);
    const created = { id: q.rows[0].id, class_id: realClassId, class_number: classNumber, name: cleanName };
    demoSections.push(created);
    demoSections.sort((a,b) => a.class_number - b.class_number || a.name.localeCompare(b.name));
    const targetCls = demoClasses.find(c => c.id === classId || c.class_number === classNumber);
    if (targetCls) targetCls.section_count = (targetCls.section_count || 0) + 1;
    return res.status(201).json(created);
  }
 } catch {}

 const newSection = {
   id: `sec-${classNumber}-${cleanName.toLowerCase()}-${Date.now().toString().slice(-4)}`,
   class_id: classId,
   class_number: classNumber,
   name: cleanName
 };
 demoSections.push(newSection);
 demoSections.sort((a,b) => a.class_number - b.class_number || a.name.localeCompare(b.name));
 const targetCls = demoClasses.find(c => c.id === classId || c.class_number === classNumber);
 if (targetCls) targetCls.section_count = (targetCls.section_count || 0) + 1;
 res.status(201).json(newSection);
});

r.delete('/sections/:id',...admin,async(req:AuthRequest,res)=>{
 try {
  await pool.query('DELETE FROM sections WHERE id=$1 AND school_id=$2 RETURNING id',[req.params.id,req.user!.schoolId]);
 } catch {}
 const idx = demoSections.findIndex(s => s.id === req.params.id);
 if (idx >= 0) demoSections.splice(idx, 1);
 res.json({success:true});
});

export const demoStudents: any[] = [
  { id: 'st-01', name: 'Arjun Kumar', roll_number: '1', parent_name: 'Ramesh Kumar', parent_sms_number: '9876543210', parent_email: 'ramesh.kumar@example.com', class_id: 'cls-8', class_number: 8, section_id: 'sec-8-a', section_name: 'A' },
  { id: 'st-02', name: 'Priya Sharma', roll_number: '2', parent_name: 'Sunil Sharma', parent_sms_number: '9876543211', parent_email: 'sunil.sharma@example.com', class_id: 'cls-8', class_number: 8, section_id: 'sec-8-a', section_name: 'A' },
  { id: 'st-03', name: 'Rahul Das', roll_number: '3', parent_name: 'Bikash Das', parent_sms_number: '9876543212', parent_email: 'bikash.das@example.com', class_id: 'cls-8', class_number: 8, section_id: 'sec-8-a', section_name: 'A' },
  { id: 'st-04', name: 'Ananya Sen', roll_number: '4', parent_name: 'Subhash Sen', parent_sms_number: '9876543213', parent_email: 'subhash.sen@example.com', class_id: 'cls-8', class_number: 8, section_id: 'sec-8-b', section_name: 'B' },
  { id: 'st-05', name: 'Dev Mukherjee', roll_number: '5', parent_name: 'Amit Mukherjee', parent_sms_number: '9876543214', parent_email: 'amit.m@example.com', class_id: 'cls-8', class_number: 8, section_id: 'sec-8-b', section_name: 'B' },
  { id: 'st-06', name: 'Ishita Ghosh', roll_number: '6', parent_name: 'Pranab Ghosh', parent_sms_number: '9876543215', parent_email: 'pranab.g@example.com', class_id: 'cls-9', class_number: 9, section_id: 'sec-9-a', section_name: 'A' },
  { id: 'st-07', name: 'Karan Patel', roll_number: '7', parent_name: 'Vijay Patel', parent_sms_number: '9876543216', parent_email: 'vijay.p@example.com', class_id: 'cls-9', class_number: 9, section_id: 'sec-9-a', section_name: 'A' },
  { id: 'st-08', name: 'Sneha Roy', roll_number: '8', parent_name: 'Debashis Roy', parent_sms_number: '9876543217', parent_email: 'debashis.roy@example.com', class_id: 'cls-10', class_number: 10, section_id: 'sec-10-a', section_name: 'A' },
  { id: 'st-09', name: 'Rohan Gupta', roll_number: '9', parent_name: 'Manoj Gupta', parent_sms_number: '9876543218', parent_email: 'manoj.gupta@example.com', class_id: 'cls-10', class_number: 10, section_id: 'sec-10-b', section_name: 'B' },
  { id: 'st-10', name: 'Tanvi Verma', roll_number: '10', parent_name: 'Sanjay Verma', parent_sms_number: '9876543219', parent_email: 'sanjay.verma@example.com', class_id: 'cls-10', class_number: 10, section_id: 'sec-10-b', section_name: 'B' }
];

export const demoTeachers: any[] = [
  { id: '00000000-0000-0000-0000-000000000022', name: 'Rahul Sharma', email: 'rahul@demo-school.local', employee_id: 'EMP001', mobile: '9000000001', is_active: true },
  { id: '00000000-0000-0000-0000-000000000023', name: 'Priya Patel', email: 'priya@demo-school.local', employee_id: 'EMP002', mobile: '9000000002', is_active: true }
];

r.get('/students',...admin,async(req:AuthRequest,res)=>{
 const search=String(req.query.search||'').trim().toLowerCase();
 try {
  const q=await pool.query(`SELECT st.id,st.name,st.roll_number,st.parent_name,st.parent_sms_number,st.email AS student_email,st.parent_email,st.user_id,st.photo_url,
  c.id class_id,c.class_number,sec.id section_id,sec.name section_name
  FROM students st JOIN classes c ON c.id=st.class_id JOIN sections sec ON sec.id=st.section_id
  WHERE st.school_id=$1 AND st.is_active=true
  AND ($2='' OR st.name ILIKE '%'||$2||'%' OR st.roll_number ILIKE '%'||$2||'%' OR COALESCE(st.email, '') ILIKE '%'||$2||'%' OR COALESCE(st.parent_email, '') ILIKE '%'||$2||'%')
  ORDER BY c.class_number,sec.name,st.roll_number`,[req.user!.schoolId,search]);
  res.json(q.rows);
 } catch {
  const filtered = search
    ? demoStudents.filter(s => s.name.toLowerCase().includes(search) || String(s.roll_number).includes(search) || (s.email && s.email.toLowerCase().includes(search)) || (s.parent_email && s.parent_email.toLowerCase().includes(search)))
    : demoStudents;
  res.json(filtered);
 }
});

r.post('/students',...admin,async(req:AuthRequest,res)=>{
 const {
   name, rollNumber, parentName, parentSmsNumber, classId, sectionId,
   studentEmail, email, parentEmail, loginOption, sendInviteEmail = true
 } = req.body;
 if(!name||!rollNumber||!parentSmsNumber||!classId||!sectionId) return res.status(400).json({message:'Name, roll, parent SMS, class and section are required'});
 
 const cleanStudentEmail = String(studentEmail || email || '').trim().toLowerCase();
 const cleanParentEmail = String(parentEmail || '').trim().toLowerCase();
 const loginOpt = String(loginOption || (cleanStudentEmail ? 'STUDENT' : cleanParentEmail ? 'PARENT' : 'NONE')).toUpperCase();

 let clsNum = 8;
 let secName = 'A';
 if (typeof classId === 'string' && classId.startsWith('cls-')) {
   clsNum = Number(classId.replace('cls-', '')) || 8;
 }
 if (typeof sectionId === 'string') {
   const parts = sectionId.split('-');
   secName = parts[parts.length - 1].toUpperCase() || 'A';
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
            role: 'STUDENT',
            userId: linkedUserId || undefined,
            schoolName: req.user?.schoolName,
            req
          });
        } catch (e: any) {
          console.warn('[StudentEnrollment] Failed to send student reset email:', e.message);
        }
      }
    }

    const q=await pool.query(`INSERT INTO students(school_id,class_id,section_id,roll_number,name,parent_name,parent_sms_number,email,parent_email,user_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.user!.schoolId,classId,sectionId,rollNumber,name,parentName||null,parentSmsNumber,cleanStudentEmail||null,cleanParentEmail||null,linkedUserId]);
    
    const created = {
      ...q.rows[0],
      class_number: clsNum,
      section_name: secName,
      student_email: cleanStudentEmail,
      parent_email: cleanParentEmail,
      login_email: targetLoginEmail,
      login_option: loginOpt,
      reset_url: resetInfo?.resetUrl,
      invite_sent: Boolean(resetInfo)
    };
    demoStudents.unshift(created);
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
       role: 'STUDENT',
       schoolName: req.user?.schoolName,
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
   } catch {}
 }

 const newStudent = {
   id: `st-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
   name,
   roll_number: rollNumber,
   parent_name: parentName || '—',
   parent_sms_number: parentSmsNumber,
   email: cleanStudentEmail,
   student_email: cleanStudentEmail,
   parent_email: cleanParentEmail,
   class_number: clsNum,
   section_name: secName,
   class_id: classId,
   section_id: sectionId,
   login_option: loginOpt,
   reset_url: resetInfo?.resetUrl,
   invite_sent: Boolean(resetInfo)
 };
 demoStudents.unshift(newStudent);
 res.status(201).json(newStudent);
});

r.post('/students/bulk-import',...admin,async(req:AuthRequest,res)=>{
 const {students=[]}=req.body||{};
 if(!Array.isArray(students)||students.length===0) return res.status(400).json({message:'Array of student records is required'});
 const createdList: any[] = [];
 for (const st of students) {
   const name = String(st.name||'').trim();
   const rollNumber = String(st.rollNumber||st.roll_number||'').trim();
   const parentSmsNumber = String(st.parentSmsNumber||st.parent_sms_number||st.mobile||'9000000000').trim();
   const parentName = String(st.parentName||st.parent_name||'').trim();
   const parentEmail = String(st.parentEmail||st.parent_email||'').trim();
   let classId = st.classId || st.class_id;
   let sectionId = st.sectionId || st.section_id;
   let classNumber = Number(st.classNumber || st.class_number) || 8;
   let sectionName = String(st.sectionName || st.section_name || 'A').toUpperCase();

   if (!classId) classId = `cls-${classNumber}`;
   if (!sectionId) sectionId = `sec-${classNumber}-${sectionName.toLowerCase()}`;

   if (!name || !rollNumber) continue;

   const studentObj = {
     id: `st-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
     name,
     roll_number: rollNumber,
     parent_name: parentName || '—',
     parent_sms_number: parentSmsNumber,
     parent_email: parentEmail,
     class_id: classId,
     class_number: classNumber,
     section_id: sectionId,
     section_name: sectionName
   };

   try {
     const q = await pool.query(
       `INSERT INTO students(school_id,class_id,section_id,roll_number,name,parent_name,parent_sms_number,parent_email)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
       [req.user!.schoolId, classId, sectionId, rollNumber, name, parentName || null, parentSmsNumber, parentEmail || null]
     );
     if (q.rowCount) {
       createdList.push({ ...q.rows[0], class_number: classNumber, section_name: sectionName });
       demoStudents.unshift(createdList[createdList.length - 1]);
       continue;
     }
   } catch {}

   createdList.push(studentObj);
   demoStudents.unshift(studentObj);
 }
 res.status(201).json({ success: true, count: createdList.length, items: createdList });
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
 res.json({ success: true, count: ids.length });
});

r.put('/students/:id',...admin,async(req:AuthRequest,res)=>{
 const {name,rollNumber,parentName,parentSmsNumber,studentEmail,email,parentEmail,classId,sectionId}=req.body;
 const cleanStudentEmail = String(studentEmail || email || '').trim().toLowerCase();
 const cleanParentEmail = String(parentEmail || '').trim().toLowerCase();
 try {
  const q=await pool.query(`UPDATE students SET name=$1,roll_number=$2,parent_name=$3,parent_sms_number=$4,email=$5,parent_email=$6,class_id=$7,section_id=$8,updated_at=NOW()
  WHERE id=$9 AND school_id=$10 RETURNING *`,[name,rollNumber,parentName||null,parentSmsNumber,cleanStudentEmail||null,cleanParentEmail||null,classId,sectionId,req.params.id,req.user!.schoolId]);
  if(!q.rowCount)return res.status(404).json({message:'Student not found'});
  res.json({ ...q.rows[0], student_email: cleanStudentEmail, parent_email: cleanParentEmail });
 } catch {
  const updated = {
    id: req.params.id,
    name,
    roll_number: rollNumber,
    parent_name: parentName,
    parent_sms_number: parentSmsNumber,
    email: cleanStudentEmail,
    student_email: cleanStudentEmail,
    parent_email: cleanParentEmail,
    class_id: classId,
    section_id: sectionId
  };
  const idx = demoStudents.findIndex(s => s.id === req.params.id);
  if (idx >= 0) demoStudents[idx] = { ...demoStudents[idx], ...updated };
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
 res.json({success:true});
});

r.get('/teachers',...admin,async(req:AuthRequest,res)=>{
 try {
  const q=await pool.query(`SELECT u.id,u.name,u.email,tp.employee_id,tp.mobile,u.is_active
  FROM users u LEFT JOIN teacher_profiles tp ON tp.user_id=u.id
  WHERE u.school_id=$1 AND u.role='TEACHER' ORDER BY u.name`,[req.user!.schoolId]);
  res.json(q.rows);
 } catch {
  res.json(demoTeachers);
 }
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
         schoolName: req.user?.schoolName,
         req
       });
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
       schoolName: req.user?.schoolName,
       req
     });
   } catch {}
 }

 const newTeacher = {
   id: `tch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
     const created = { ...u.rows[0], employee_id: employeeId, mobile, is_active: true };
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
 res.json({ success: true, count: ids.length });
});

r.delete('/teachers/:id',...admin,async(req:AuthRequest,res)=>{
 try {
  await pool.query(`UPDATE users SET is_active=false,updated_at=NOW() WHERE id=$1 AND school_id=$2 AND role='TEACHER' RETURNING id`,[req.params.id,req.user!.schoolId]);
 } catch {}
 const idx = demoTeachers.findIndex(t => t.id === req.params.id);
 if (idx >= 0) demoTeachers.splice(idx, 1);
 res.json({success:true});
});

export const demoSubjects: any[] = [];

r.get('/subjects',...admin,async(req:AuthRequest,res)=>{
 try {
  const q=await pool.query('SELECT * FROM subjects WHERE school_id=$1 ORDER BY name',[req.user!.schoolId]);
  if (q.rowCount) return res.json(q.rows);
 } catch {}
 res.json(demoSubjects);
});

r.post('/subjects',...admin,async(req:AuthRequest,res)=>{
 const { name } = req.body || {};
 if (!name || !String(name).trim()) return res.status(400).json({ message: 'Subject name is required' });
 const cleanName = String(name).trim();
 try {
  const q=await pool.query('INSERT INTO subjects(school_id,name) VALUES($1,$2) RETURNING *',[req.user!.schoolId,cleanName]);
  if (q.rowCount) {
    demoSubjects.push(q.rows[0]);
    return res.status(201).json(q.rows[0]);
  }
 } catch {}
 const newSub = { id: `sub-${Date.now()}`, name: cleanName, school_id: req.user!.schoolId };
 demoSubjects.push(newSub);
 res.status(201).json(newSub);
});

r.delete('/subjects/:id',...admin,async(req:AuthRequest,res)=>{
 try {
  await pool.query('DELETE FROM subjects WHERE id=$1 AND school_id=$2 RETURNING id',[req.params.id,req.user!.schoolId]);
 } catch {}
 const idx = demoSubjects.findIndex(s => s.id === req.params.id);
 if (idx >= 0) demoSubjects.splice(idx, 1);
 res.json({success:true});
});

r.get('/school-profile',...admin,async(req:AuthRequest,res)=>{
 const sid = req.user!.schoolId!;
 try {
  const q = await pool.query('SELECT id, name, code, status, enquiry_number, address, created_at FROM schools WHERE id = $1', [sid]);
  if (q.rowCount) return res.json(q.rows[0]);
 } catch {}
 res.json({
  id: sid,
  name: 'Greenwood International School',
  code: 'GIS001',
  status: 'ACTIVE',
  enquiry_number: '1800123456',
  address: 'Campus 4, Tech Park Boulevard, Bengaluru, Karnataka'
 });
});

r.put('/school-profile',...admin,async(req:AuthRequest,res)=>{
 const sid = req.user!.schoolId!;
 const { enquiryNumber, address } = req.body || {};
 try {
  const q = await pool.query(
    'UPDATE schools SET enquiry_number = COALESCE($1, enquiry_number), address = COALESCE($2, address) WHERE id = $3 RETURNING id, name, code, status, enquiry_number, address',
    [enquiryNumber, address, sid]
  );
  if (q.rowCount) return res.json(q.rows[0]);
 } catch {}
 res.json({ id: sid, enquiry_number: enquiryNumber, address });
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
