import { collections, firestore, isFirebaseConfigured } from '../firebase';

/**
 * Firestore Real-Time Persistence & Synchronization Service
 * Ensures all CRUD operations across Students, Teachers, Classes, Sections,
 * Subjects, Teacher Allocations, Timetable, Attendance, and Schools
 * are reliably reflected in Firebase Cloud Firestore.
 */

// ── STUDENTS ──
export async function syncStudentToFirestore(student: any): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;
  try {
    const id = student.id || `st-${Date.now()}`;
    const cleanStudentEmail = (student.student_email || student.studentEmail || student.email || '').toLowerCase().trim();
    const cleanParentEmail = (student.parent_email || student.parentEmail || '').toLowerCase().trim();

    const data: Record<string, any> = {
      id,
      name: student.name || student.fullName || '',
      fullName: student.name || student.fullName || '',
      rollNumber: String(student.roll_number || student.rollNumber || ''),
      roll_number: String(student.roll_number || student.rollNumber || ''),
      admissionNumber: student.admissionNumber || student.admission_number || (student.id ? `ADM-${student.id}` : `ADM-${id}`),
      admission_number: student.admission_number || student.admissionNumber || (student.id ? `ADM-${student.id}` : `ADM-${id}`),
      className: String(student.class_number || student.className || ''),
      class_number: Number(student.class_number || student.className) || null,
      section: String(student.section_name || student.section || 'A'),
      section_name: String(student.section_name || student.section || 'A'),
      classId: student.class_id || student.classId || null,
      class_id: student.class_id || student.classId || null,
      sectionId: student.section_id || student.sectionId || null,
      section_id: student.section_id || student.sectionId || null,
      parentName: student.parent_name || student.parentName || '',
      parent_name: student.parent_name || student.parentName || '',
      parentPhone: student.parent_sms_number || student.parentPhone || '',
      parent_sms_number: student.parent_sms_number || student.parentPhone || '',
      parentEmail: cleanParentEmail,
      parent_email: cleanParentEmail,
      studentEmail: cleanStudentEmail,
      student_email: cleanStudentEmail,
      email: cleanStudentEmail,
      schoolId: student.school_id || student.schoolId || '00000000-0000-0000-0000-000000000001',
      school_id: student.school_id || student.schoolId || '00000000-0000-0000-0000-000000000001',
      status: student.status || (student.is_active === false ? 'ARCHIVED' : 'ACTIVE'),
      is_active: student.is_active !== false,
      updatedAt: new Date().toISOString()
    };
    if (student.createdAt) data.createdAt = student.createdAt;
    else if (!student.updatedAt) data.createdAt = new Date().toISOString();

    await collections.students().doc(id).set(data, { merge: true });
    console.log(`[FirestoreSync] Synced student "${data.name}" (${id}) to Firestore`);
    return true;
  } catch (err: any) {
    console.warn(`[FirestoreSync] Failed to sync student to Firestore:`, err.message);
    return false;
  }
}

export async function deleteStudentFromFirestore(id: string): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;
  try {
    await collections.students().doc(id).delete();
    console.log(`[FirestoreSync] Deleted student (${id}) from Firestore`);
    return true;
  } catch (err: any) {
    console.warn(`[FirestoreSync] Failed to delete student from Firestore:`, err.message);
    return false;
  }
}

// ── TEACHERS ──
export async function syncTeacherToFirestore(teacher: any, passwordHash?: string): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;
  try {
    const id = teacher.id || `tea-${Date.now()}`;
    const cleanEmail = (teacher.email || '').toLowerCase().trim();

    const data: Record<string, any> = {
      id,
      name: teacher.name || '',
      email: cleanEmail,
      employeeId: teacher.employee_id || teacher.employeeId || '',
      employee_id: teacher.employee_id || teacher.employeeId || '',
      mobile: teacher.mobile || teacher.phone || '',
      phone: teacher.mobile || teacher.phone || '',
      role: 'TEACHER',
      schoolId: teacher.school_id || teacher.schoolId || '00000000-0000-0000-0000-000000000001',
      school_id: teacher.school_id || teacher.schoolId || '00000000-0000-0000-0000-000000000001',
      status: teacher.status || (teacher.is_active === false ? 'INACTIVE' : 'ACTIVE'),
      is_active: teacher.is_active !== false,
      updatedAt: new Date().toISOString()
    };
    if (passwordHash) data.passwordHash = passwordHash;
    if (teacher.createdAt) data.createdAt = teacher.createdAt;
    else data.createdAt = new Date().toISOString();

    await collections.users().doc(id).set(data, { merge: true });
    await collections.teachers().doc(id).set(data, { merge: true });
    console.log(`[FirestoreSync] Synced teacher "${data.name}" (${id}) to Firestore`);
    return true;
  } catch (err: any) {
    console.warn(`[FirestoreSync] Failed to sync teacher to Firestore:`, err.message);
    return false;
  }
}

export async function deleteTeacherFromFirestore(id: string): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;
  try {
    await collections.users().doc(id).delete().catch(() => {});
    await collections.teachers().doc(id).delete().catch(() => {});
    console.log(`[FirestoreSync] Deleted teacher (${id}) from Firestore`);
    return true;
  } catch (err: any) {
    console.warn(`[FirestoreSync] Failed to delete teacher from Firestore:`, err.message);
    return false;
  }
}

// ── TEACHER ASSIGNMENTS ──
export async function syncTeacherAssignmentsToFirestore(teacherId: string, assignments: any[]): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;
  try {
    await collections.teacherAssignments().doc(teacherId).set({
      teacher_id: teacherId,
      assignments: assignments || [],
      updatedAt: new Date().toISOString()
    });
    console.log(`[FirestoreSync] Synced ${assignments.length} assignments for teacher (${teacherId}) to Firestore`);
    return true;
  } catch (err: any) {
    console.warn(`[FirestoreSync] Failed to sync teacher assignments to Firestore:`, err.message);
    return false;
  }
}

// ── CLASSES ──
export async function syncClassToFirestore(cls: any): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;
  try {
    const id = cls.id || `cls-${cls.class_number}`;
    const data = {
      id,
      class_number: Number(cls.class_number),
      classNumber: Number(cls.class_number),
      section_count: cls.section_count || 0,
      school_id: cls.school_id || 'default',
      updatedAt: new Date().toISOString()
    };
    await collections.classes().doc(id).set(data, { merge: true });
    console.log(`[FirestoreSync] Synced class ${cls.class_number} (${id}) to Firestore`);
    return true;
  } catch (err: any) {
    console.warn(`[FirestoreSync] Failed to sync class to Firestore:`, err.message);
    return false;
  }
}

export async function deleteClassFromFirestore(id: string): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;
  try {
    await collections.classes().doc(id).delete();
    console.log(`[FirestoreSync] Deleted class (${id}) from Firestore`);
    return true;
  } catch (err: any) {
    console.warn(`[FirestoreSync] Failed to delete class from Firestore:`, err.message);
    return false;
  }
}

// ── SECTIONS ──
export async function syncSectionToFirestore(sec: any): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;
  try {
    const id = sec.id || `sec-${sec.class_number}-${sec.name?.toLowerCase()}`;
    const data = {
      id,
      class_id: sec.class_id,
      class_number: Number(sec.class_number),
      name: sec.name,
      school_id: sec.school_id || 'default',
      updatedAt: new Date().toISOString()
    };
    await collections.sections().doc(id).set(data, { merge: true });
    console.log(`[FirestoreSync] Synced section ${sec.name} (${id}) to Firestore`);
    return true;
  } catch (err: any) {
    console.warn(`[FirestoreSync] Failed to sync section to Firestore:`, err.message);
    return false;
  }
}

export async function deleteSectionFromFirestore(id: string): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;
  try {
    await collections.sections().doc(id).delete();
    console.log(`[FirestoreSync] Deleted section (${id}) from Firestore`);
    return true;
  } catch (err: any) {
    console.warn(`[FirestoreSync] Failed to delete section from Firestore:`, err.message);
    return false;
  }
}

// ── SUBJECTS ──
export async function syncSubjectToFirestore(sub: any): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;
  try {
    const id = sub.id || `sub-${Date.now()}`;
    const data = {
      id,
      name: sub.name,
      school_id: sub.school_id || 'default',
      updatedAt: new Date().toISOString()
    };
    await collections.subjects().doc(id).set(data, { merge: true });
    console.log(`[FirestoreSync] Synced subject "${sub.name}" (${id}) to Firestore`);
    return true;
  } catch (err: any) {
    console.warn(`[FirestoreSync] Failed to sync subject to Firestore:`, err.message);
    return false;
  }
}

export async function deleteSubjectFromFirestore(id: string): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;
  try {
    await collections.subjects().doc(id).delete();
    console.log(`[FirestoreSync] Deleted subject (${id}) from Firestore`);
    return true;
  } catch (err: any) {
    console.warn(`[FirestoreSync] Failed to delete subject from Firestore:`, err.message);
    return false;
  }
}

// ── TIMETABLE PERIODS ──
export async function syncTimetablePeriodToFirestore(period: any): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;
  try {
    const id = period.id || `prd-${Date.now()}`;
    const data = {
      id,
      name: period.name,
      period_number: Number(period.period_number || period.periodNumber),
      periodNumber: Number(period.period_number || period.periodNumber),
      start_time: period.start_time || period.startTime,
      end_time: period.end_time || period.endTime,
      startTime: period.start_time || period.startTime,
      endTime: period.end_time || period.endTime,
      is_break: Boolean(period.is_break || period.isBreak),
      isBreak: Boolean(period.is_break || period.isBreak),
      school_id: period.school_id || 'default',
      updatedAt: new Date().toISOString()
    };
    await collections.timetablePeriods().doc(id).set(data, { merge: true });
    console.log(`[FirestoreSync] Synced timetable period "${period.name}" (${id}) to Firestore`);
    return true;
  } catch (err: any) {
    console.warn(`[FirestoreSync] Failed to sync timetable period to Firestore:`, err.message);
    return false;
  }
}

export async function deleteTimetablePeriodFromFirestore(id: string): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;
  try {
    await collections.timetablePeriods().doc(id).delete();
    console.log(`[FirestoreSync] Deleted timetable period (${id}) from Firestore`);
    return true;
  } catch (err: any) {
    console.warn(`[FirestoreSync] Failed to delete timetable period from Firestore:`, err.message);
    return false;
  }
}

export async function clearTimetablePeriodsFromFirestore(_schoolId?: string): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;
  try {
    const snap = await collections.timetablePeriods().get();
    const batch = firestore.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    console.log(`[FirestoreSync] Cleared ${snap.docs.length} timetable periods from Firestore`);
    return true;
  } catch (err: any) {
    console.warn(`[FirestoreSync] Failed to clear timetable periods from Firestore:`, err.message);
    return false;
  }
}

// ── TIMETABLE ENTRIES ──
export async function syncTimetableEntryToFirestore(entry: any): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;
  try {
    const id = entry.id || `ent-${Date.now()}`;
    const data = {
      id,
      day_of_week: Number(entry.day_of_week || entry.dayOfWeek),
      dayOfWeek: Number(entry.day_of_week || entry.dayOfWeek),
      period_id: entry.period_id || entry.periodId,
      periodId: entry.period_id || entry.periodId,
      period_name: entry.period_name || entry.periodName || '',
      period_number: Number(entry.period_number || entry.periodNumber || 0),
      start_time: entry.start_time || entry.startTime || '',
      end_time: entry.end_time || entry.endTime || '',
      class_id: entry.class_id || entry.classId || null,
      class_number: Number(entry.class_number || entry.classNumber || 0),
      section_id: entry.section_id || entry.sectionId || null,
      section_name: entry.section_name || entry.sectionName || null,
      subject_id: entry.subject_id || entry.subjectId || null,
      subject_name: entry.subject_name || entry.subjectName || null,
      teacher_id: entry.teacher_id || entry.teacherId || null,
      teacher_name: entry.teacher_name || entry.teacherName || null,
      substitute_teacher_id: entry.substitute_teacher_id || entry.altTeacherId || null,
      substitute_teacher_name: entry.substitute_teacher_name || entry.altTeacherName || null,
      room_name: entry.room_name || entry.roomName || null,
      status: entry.status || 'PUBLISHED',
      school_id: entry.school_id || 'default',
      updatedAt: new Date().toISOString()
    };
    await collections.timetableEntries().doc(id).set(data, { merge: true });
    console.log(`[FirestoreSync] Synced timetable entry for ${data.subject_name} (${id}) to Firestore`);
    return true;
  } catch (err: any) {
    console.warn(`[FirestoreSync] Failed to sync timetable entry to Firestore:`, err.message);
    return false;
  }
}

export async function deleteTimetableEntryFromFirestore(id: string): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;
  try {
    await collections.timetableEntries().doc(id).delete();
    console.log(`[FirestoreSync] Deleted timetable entry (${id}) from Firestore`);
    return true;
  } catch (err: any) {
    console.warn(`[FirestoreSync] Failed to delete timetable entry from Firestore:`, err.message);
    return false;
  }
}

export async function clearTimetableEntriesFromFirestore(_schoolId?: string): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;
  try {
    const snap = await collections.timetableEntries().get();
    const batch = firestore.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    console.log(`[FirestoreSync] Cleared ${snap.docs.length} timetable entries from Firestore`);
    return true;
  } catch (err: any) {
    console.warn(`[FirestoreSync] Failed to clear timetable entries from Firestore:`, err.message);
    return false;
  }
}

// ── ATTENDANCE ──
export async function syncAttendanceToFirestore(session: any, records: any[]): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;
  try {
    const sessionId = session.id || `att-sess-${Date.now()}`;
    const batch = firestore.batch();

    batch.set(collections.attendanceSessions().doc(sessionId), {
      id: sessionId,
      schoolId: session.schoolId || session.school_id || 'default',
      classId: session.classId || session.class_id || null,
      sectionId: session.sectionId || session.section_id || null,
      subjectId: session.subjectId || session.subject_id || null,
      attendanceDate: session.attendanceDate || session.attendance_date || new Date().toISOString().slice(0, 10),
      startTime: session.startTime || session.start_time || '09:00:00',
      endTime: session.endTime || session.end_time || '09:45:00',
      takenBy: session.takenBy || session.teacher_id || null,
      createdAt: new Date().toISOString()
    }, { merge: true });

    if (Array.isArray(records)) {
      for (const r of records) {
        const studentId = r.studentId || r.student_id;
        const recId = `att-rec-${sessionId}-${studentId}`;
        batch.set(collections.attendanceRecords().doc(recId), {
          id: recId,
          sessionId,
          studentId,
          schoolId: session.schoolId || session.school_id || 'default',
          status: r.status || (r.is_present || r.isPresent ? 'PRESENT' : 'ABSENT'),
          remarks: r.remarks || '',
          createdAt: new Date().toISOString()
        }, { merge: true });
      }
    }

    await batch.commit();
    console.log(`[FirestoreSync] Synced attendance session (${sessionId}) with ${records?.length || 0} records to Firestore`);
    return true;
  } catch (err: any) {
    console.warn(`[FirestoreSync] Failed to sync attendance to Firestore:`, err.message);
    return false;
  }
}

// ── SCHOOLS ──
export async function syncSchoolToFirestore(school: any): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;
  try {
    const id = school.id || `sch-${Date.now()}`;
    await collections.schools().doc(id).set({
      id,
      name: school.name,
      code: school.code,
      status: school.status || 'ACTIVE',
      enquiry_number: school.enquiry_number || school.phone || '',
      phone: school.phone || school.enquiry_number || '',
      email: school.email || '',
      address: school.address || '',
      plan_name: school.plan_name || school.planName || 'Standard',
      planName: school.plan_name || school.planName || 'Standard',
      max_students: school.max_students || school.maxStudents || 1000,
      maxStudents: school.max_students || school.maxStudents || 1000,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    console.log(`[FirestoreSync] Synced school "${school.name}" (${id}) to Firestore`);
    return true;
  } catch (err: any) {
    console.warn(`[FirestoreSync] Failed to sync school to Firestore:`, err.message);
    return false;
  }
}

export async function deleteSchoolFromFirestore(id: string): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;
  try {
    await collections.schools().doc(id).delete();
    console.log(`[FirestoreSync] Deleted school (${id}) from Firestore`);
    return true;
  } catch (err: any) {
    console.warn(`[FirestoreSync] Failed to delete school from Firestore:`, err.message);
    return false;
  }
}

// ── REHYDRATE FROM FIRESTORE ──
/**
 * Loads existing documents from Firestore into in-memory arrays on startup
 * so that any changes made previously in Firestore or other sessions are immediately active.
 */
export async function rehydrateAllFromFirestore(stores: {
  demoStudents?: any[];
  demoTeachers?: any[];
  demoClasses?: any[];
  demoSections?: any[];
  demoSubjects?: any[];
  demoTeacherAssignments?: any[];
  memPeriods?: any[];
  memEntries?: any[];
  demoSchools?: any[];
}): Promise<{ loaded: Record<string, number> }> {
  const result: Record<string, number> = {};
  if (!isFirebaseConfigured()) return { loaded: result };

  console.log('[FirestoreSync] Rehydrating data from Cloud Firestore collections...');

  // 1. Students
  if (stores.demoStudents) {
    try {
      const snap = await collections.students().get();
      if (!snap.empty) {
        const list = snap.docs.map(d => {
          const dt = d.data();
          return {
            id: d.id,
            name: dt.name || dt.fullName || '',
            roll_number: dt.roll_number || dt.rollNumber || '',
            admission_number: dt.admission_number || dt.admissionNumber || '',
            admissionNumber: dt.admissionNumber || dt.admission_number || '',
            parent_name: dt.parent_name || dt.parentName || '—',
            parent_sms_number: dt.parent_sms_number || dt.parentPhone || '',
            parent_email: dt.parent_email || dt.parentEmail || '',
            student_email: dt.student_email || dt.studentEmail || dt.email || '',
            email: dt.email || dt.student_email || '',
            class_id: dt.class_id || dt.classId || `cls-${dt.class_number || dt.className || 8}`,
            class_number: Number(dt.class_number || dt.className) || 8,
            section_id: dt.section_id || dt.sectionId || `sec-${dt.class_number || 8}-${(dt.section_name || dt.section || 'A').toLowerCase()}`,
            section_name: dt.section_name || dt.section || 'A',
            is_active: dt.is_active !== false && dt.status !== 'ARCHIVED',
            ...dt
          };
        }).filter(s => s.is_active !== false);

        stores.demoStudents.length = 0;
        stores.demoStudents.push(...list);
        result.students = list.length;
        console.log(`[FirestoreSync] Loaded ${list.length} students from Firestore`);
      }
    } catch (e: any) {
      console.warn('[FirestoreSync] Students load skipped:', e.message);
    }
  }

  // 2. Teachers
  if (stores.demoTeachers) {
    try {
      const snap = await collections.teachers().get();
      if (!snap.empty) {
        const list = snap.docs.map(d => {
          const dt = d.data();
          return {
            id: d.id,
            name: dt.name || '',
            email: dt.email || '',
            employee_id: dt.employee_id || dt.employeeId || 'EMP',
            mobile: dt.mobile || dt.phone || '',
            is_active: dt.is_active !== false && dt.status !== 'INACTIVE',
            ...dt
          };
        }).filter(t => t.is_active !== false);

        // Merge into demoTeachers avoiding duplicates
        for (const t of list) {
          const idx = stores.demoTeachers.findIndex(x => x.id === t.id || x.email === t.email);
          if (idx >= 0) stores.demoTeachers[idx] = { ...stores.demoTeachers[idx], ...t };
          else stores.demoTeachers.push(t);
        }
        result.teachers = stores.demoTeachers.length;
        console.log(`[FirestoreSync] Loaded ${list.length} teachers from Firestore`);
      }
    } catch (e: any) {
      console.warn('[FirestoreSync] Teachers load skipped:', e.message);
    }
  }

  // 3. Teacher Assignments
  if (stores.demoTeacherAssignments) {
    try {
      const snap = await collections.teacherAssignments().get();
      if (!snap.empty) {
        const allAssignments: any[] = [];
        snap.docs.forEach(d => {
          const dt = d.data();
          if (Array.isArray(dt.assignments)) {
            allAssignments.push(...dt.assignments);
          }
        });
        if (allAssignments.length > 0) {
          stores.demoTeacherAssignments.length = 0;
          stores.demoTeacherAssignments.push(...allAssignments);
          result.teacherAssignments = allAssignments.length;
          console.log(`[FirestoreSync] Loaded ${allAssignments.length} teacher allocations from Firestore`);
        }
      }
    } catch (e: any) {
      console.warn('[FirestoreSync] Teacher assignments load skipped:', e.message);
    }
  }

  // 4. Classes
  if (stores.demoClasses) {
    try {
      const snap = await collections.classes().get();
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        stores.demoClasses.length = 0;
        stores.demoClasses.push(...list);
        result.classes = list.length;
        console.log(`[FirestoreSync] Loaded ${list.length} classes from Firestore`);
      }
    } catch (e: any) {
      console.warn('[FirestoreSync] Classes load skipped:', e.message);
    }
  }

  // 5. Sections
  if (stores.demoSections) {
    try {
      const snap = await collections.sections().get();
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        stores.demoSections.length = 0;
        stores.demoSections.push(...list);
        result.sections = list.length;
        console.log(`[FirestoreSync] Loaded ${list.length} sections from Firestore`);
      }
    } catch (e: any) {
      console.warn('[FirestoreSync] Sections load skipped:', e.message);
    }
  }

  // 6. Subjects
  if (stores.demoSubjects) {
    try {
      const snap = await collections.subjects().get();
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        stores.demoSubjects.length = 0;
        stores.demoSubjects.push(...list);
        result.subjects = list.length;
        console.log(`[FirestoreSync] Loaded ${list.length} subjects from Firestore`);
      }
    } catch (e: any) {
      console.warn('[FirestoreSync] Subjects load skipped:', e.message);
    }
  }

  // 7. Timetable Periods
  if (stores.memPeriods) {
    try {
      const snap = await collections.timetablePeriods().get();
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) => (a.period_number || 0) - (b.period_number || 0));
        stores.memPeriods.length = 0;
        stores.memPeriods.push(...list);
        result.timetablePeriods = list.length;
        console.log(`[FirestoreSync] Loaded ${list.length} timetable periods from Firestore`);
      }
    } catch (e: any) {
      console.warn('[FirestoreSync] Timetable periods load skipped:', e.message);
    }
  }

  // 8. Timetable Entries
  if (stores.memEntries) {
    try {
      const snap = await collections.timetableEntries().get();
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        stores.memEntries.length = 0;
        stores.memEntries.push(...list);
        result.timetableEntries = list.length;
        console.log(`[FirestoreSync] Loaded ${list.length} timetable entries from Firestore`);
      }
    } catch (e: any) {
      console.warn('[FirestoreSync] Timetable entries load skipped:', e.message);
    }
  }

  // 9. Schools
  if (stores.demoSchools) {
    try {
      const snap = await collections.schools().get();
      if (!snap.empty) {
        const list: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        for (const sch of list) {
          const idx = stores.demoSchools.findIndex((x: any) => x.id === sch.id || x.code === sch.code);
          if (idx >= 0) stores.demoSchools[idx] = { ...stores.demoSchools[idx], ...sch };
          else stores.demoSchools.push(sch);
        }
        result.schools = stores.demoSchools.length;
        console.log(`[FirestoreSync] Loaded ${list.length} schools from Firestore`);
      }
    } catch (e: any) {
      console.warn('[FirestoreSync] Schools load skipped:', e.message);
    }
  }

  return { loaded: result };
}
