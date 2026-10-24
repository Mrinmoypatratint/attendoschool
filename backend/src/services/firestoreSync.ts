import { collections, firestore, isFirebaseConfigured } from '../firebase';
import { isSameSchool } from '../utils/tenant';

/**
 * Firestore Real-Time Persistence & Synchronization Service
 * Ensures all CRUD operations across Students, Teachers, Classes, Sections,
 * Subjects, Teacher Allocations, Timetable, Attendance, and Schools
 * are reliably reflected in Firebase Cloud Firestore.
 * 
 * PERFORMANCE: All sync operations are fire-and-forget — they run in the
 * background and never block API responses. Errors are logged silently.
 */

/** Fire-and-forget wrapper: executes a promise without awaiting or blocking the caller */
function fireAndForget(fn: () => Promise<any>, label: string): void {
  fn().catch(err => {
    console.warn(`[FirestoreSync] Background ${label} failed:`, err.message);
  });
}

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
      className: (() => {
        const cId = String(student.class_id || student.classId || '');
        if (/l.?kg/i.test(cId)) return 'L-KG';
        if (/u.?kg/i.test(cId)) return 'U-KG';
        const m = cId.match(/cls-(\d+)/);
        if (m) return `Class ${m[1]}`;
        if (student.class_number !== undefined && student.class_number !== null) {
          return student.class_number === -1 ? 'L-KG' : student.class_number === 0 ? 'U-KG' : `Class ${student.class_number}`;
        }
        return String(student.className || '');
      })(),
      class_number: (() => {
        const cId = String(student.class_id || student.classId || '');
        if (/l.?kg/i.test(cId)) return -1;
        if (/u.?kg/i.test(cId)) return 0;
        const m = cId.match(/cls-(\d+)/);
        if (m) return Number(m[1]);
        if (student.class_number !== undefined && student.class_number !== null && !isNaN(Number(student.class_number))) {
          return Number(student.class_number);
        }
        return 1;
      })(),
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
      schoolId: student.school_id || student.schoolId || null,
      school_id: student.school_id || student.schoolId || null,
      academic_year_id: student.academic_year_id || student.session_id || student.sessionId || null,
      academicYearId: student.academic_year_id || student.session_id || student.sessionId || null,
      session_id: student.session_id || student.academic_year_id || student.sessionId || null,
      sessionId: student.session_id || student.academic_year_id || student.sessionId || null,
      session_name: student.session_name || student.session || null,
      sessionName: student.session_name || student.session || null,
      session: student.session || student.session_name || null,
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

export async function syncStudentsBulkToFirestore(students: any[]): Promise<number> {
  if (!isFirebaseConfigured() || !Array.isArray(students) || students.length === 0) return 0;
  try {
    const CHUNK_SIZE = 400;
    let totalSynced = 0;
    for (let c = 0; c < students.length; c += CHUNK_SIZE) {
      const chunk = students.slice(c, c + CHUNK_SIZE);
      const batch = firestore.batch();
      for (const student of chunk) {
        const id = student.id || `st-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
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
          className: student.className || `Class ${student.class_number || 10}`,
          class_number: Number(student.class_number ?? 10),
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
          schoolId: student.school_id || student.schoolId || null,
          school_id: student.school_id || student.schoolId || null,
          academic_year_id: student.academic_year_id || student.session_id || student.sessionId || null,
          academicYearId: student.academic_year_id || student.session_id || student.sessionId || null,
          session_id: student.session_id || student.academic_year_id || student.sessionId || null,
          sessionId: student.session_id || student.academic_year_id || student.sessionId || null,
          session_name: student.session_name || student.session || null,
          sessionName: student.session_name || student.session || null,
          session: student.session || student.session_name || null,
          status: student.status || (student.is_active === false ? 'ARCHIVED' : 'ACTIVE'),
          is_active: student.is_active !== false,
          updatedAt: new Date().toISOString()
        };
        batch.set(collections.students().doc(id), data, { merge: true });
        totalSynced++;
      }
      await batch.commit();
    }
    console.log(`[FirestoreSync] Bulk synced ${totalSynced} students to Firestore`);
    return totalSynced;
  } catch (err: any) {
    console.warn('[FirestoreSync] Failed to bulk sync students to Firestore:', err.message);
    return 0;
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
      name: teacher.name || teacher.fullName || '',
      fullName: teacher.name || teacher.fullName || '',
      firstName: teacher.first_name || teacher.firstName || '',
      first_name: teacher.first_name || teacher.firstName || '',
      lastName: teacher.last_name || teacher.lastName || '',
      last_name: teacher.last_name || teacher.lastName || '',
      email: cleanEmail,
      employeeId: teacher.savior_no || teacher.saviorNo || teacher.Savior_No || teacher.employee_id || teacher.employeeId || '',
      employee_id: teacher.savior_no || teacher.saviorNo || teacher.Savior_No || teacher.employee_id || teacher.employeeId || '',
      savior_no: teacher.savior_no || teacher.saviorNo || teacher.Savior_No || teacher.employee_id || teacher.employeeId || '',
      saviorNo: teacher.savior_no || teacher.saviorNo || teacher.Savior_No || teacher.employee_id || teacher.employeeId || '',
      designation: teacher.designation || 'Teacher',
      email_status: teacher.email_status || teacher.emailStatus || 'Sent',
      emailStatus: teacher.email_status || teacher.emailStatus || 'Sent',
      mobile: teacher.mobile || teacher.phone || '',
      phone: teacher.mobile || teacher.phone || '',
      gender: teacher.gender || null,
      dob: teacher.dob || teacher.date_of_birth || null,
      date_of_birth: teacher.dob || teacher.date_of_birth || null,
      role: 'TEACHER',
      schoolId: teacher.school_id || teacher.schoolId || null,
      school_id: teacher.school_id || teacher.schoolId || null,
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
      school_id: cls.school_id || null,
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
      school_id: sec.school_id || null,
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
      school_id: sub.school_id || null,
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
      school_id: period.school_id || period.schoolId || null,
      schoolId: period.school_id || period.schoolId || null,
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

export async function clearTimetablePeriodsFromFirestore(schoolId?: string): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;
  try {
    const snap = await collections.timetablePeriods().get();
    const batch = firestore.batch();
    let count = 0;
    snap.docs.forEach(d => {
      const data = d.data();
      if (!schoolId || (data.school_id && isSameSchool(data.school_id, schoolId)) || (data.schoolId && isSameSchool(data.schoolId, schoolId))) {
        batch.delete(d.ref);
        count++;
      }
    });
    if (count > 0) await batch.commit();
    console.log(`[FirestoreSync] Cleared ${count} timetable periods from Firestore`);
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
      school_id: entry.school_id || entry.schoolId || null,
      schoolId: entry.school_id || entry.schoolId || null,
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

export async function clearTimetableEntriesFromFirestore(schoolId?: string): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;
  try {
    const snap = await collections.timetableEntries().get();
    const batch = firestore.batch();
    let count = 0;
    snap.docs.forEach(d => {
      const data = d.data();
      if (!schoolId || (data.school_id && isSameSchool(data.school_id, schoolId)) || (data.schoolId && isSameSchool(data.schoolId, schoolId))) {
        batch.delete(d.ref);
        count++;
      }
    });
    if (count > 0) await batch.commit();
    console.log(`[FirestoreSync] Cleared ${count} timetable entries from Firestore`);
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
    const schoolId = session.schoolId || session.school_id || null;
    const classId = session.classId || session.class_id || null;
    const classNum = session.classNumber ?? session.class_number ?? null;
    const sectionId = session.sectionId || session.section_id || null;
    const sectionName = session.sectionName || session.section_name || '';
    const subjectId = session.subjectId || session.subject_id || null;
    const subjectName = session.subjectName || session.subject_name || '';
    const attDate = session.attendanceDate || session.attendance_date || new Date().toISOString().slice(0, 10);
    const startTime = session.startTime || session.start_time || '09:00:00';
    const endTime = session.endTime || session.end_time || '09:45:00';
    const teacherId = session.teacherId || session.teacher_id || session.takenBy || null;
    const teacherName = session.teacherName || session.teacher_name || session.takenByName || 'Class Faculty';

    const safeRecords = Array.isArray(records) ? records : [];
    const presentCount = safeRecords.filter((r: any) => r.status === 'PRESENT' || (r.status !== 'ABSENT' && r.status !== 'LEFT_EARLY' && (r.is_present === true || r.isPresent === true))).length;
    const leftEarlyCount = safeRecords.filter((r: any) => r.status === 'LEFT_EARLY').length;
    const lateCount = safeRecords.filter((r: any) => r.status === 'LATE').length;
    const absentCount = safeRecords.filter((r: any) => r.status === 'ABSENT' || (!r.is_present && !r.isPresent && r.status !== 'LEFT_EARLY' && r.status !== 'LATE')).length;

    const batch = firestore.batch();

    batch.set(collections.attendanceSessions().doc(sessionId), {
      id: sessionId,
      schoolId,
      school_id: schoolId,
      classId,
      class_id: classId,
      classNumber: classNum,
      class_number: classNum,
      className: classNum ? String(classNum) : '10',
      sectionId,
      section_id: sectionId,
      sectionName,
      section_name: sectionName,
      subjectId,
      subject_id: subjectId,
      subjectName,
      subject_name: subjectName,
      attendanceDate: attDate,
      attendance_date: attDate,
      startTime,
      start_time: startTime,
      endTime,
      end_time: endTime,
      takenBy: teacherId,
      teacherId,
      teacher_id: teacherId,
      teacherName,
      teacher_name: teacherName,
      totalCount: safeRecords.length,
      presentCount,
      absentCount,
      leftEarlyCount: session.leftEarlyCount ?? session.left_early_count ?? leftEarlyCount,
      lateCount: session.lateCount ?? session.late_count ?? lateCount,
      isReattendance: Boolean(session.isReattendance ?? session.is_reattendance ?? false),
      reattendanceCount: session.reattendanceCount ?? session.reattendance_count ?? 0,
      lastModifiedBy: session.lastModifiedBy ?? session.last_modified_by ?? null,
      lastModifiedName: session.lastModifiedName ?? session.last_modified_name ?? null,
      lastModifiedAt: session.lastModifiedAt ?? session.last_modified_at ?? null,
      createdAt: session.createdAt || session.created_at || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, { merge: true });

    for (const r of safeRecords) {
      const studentId = String(r.studentId || r.student_id || '');
      if (!studentId) continue;
      const recId = `att-rec-${sessionId}-${studentId}`;
      const status = r.status || (r.is_present || r.isPresent ? 'PRESENT' : 'ABSENT');
      const isPresent = status === 'PRESENT' || status === 'LATE';

      batch.set(collections.attendanceRecords().doc(recId), {
        id: recId,
        sessionId,
        attendance_session_id: sessionId,
        attendanceSessionId: sessionId,
        studentId,
        student_id: studentId,
        studentName: r.studentName || r.student_name || r.name || '',
        rollNumber: r.rollNumber || r.roll_number || '',
        schoolId,
        school_id: schoolId,
        classId,
        class_id: classId,
        sectionId,
        section_id: sectionId,
        attendanceDate: attDate,
        attendance_date: attDate,
        status,
        is_present: isPresent,
        isPresent,
        departurePeriod: r.departurePeriod || r.departure_period || null,
        departureTime: r.departureTime || r.departure_time || null,
        arrivalPeriod: r.arrivalPeriod || r.arrival_period || null,
        arrivalTime: r.arrivalTime || r.arrival_time || null,
        updatedByName: r.updatedByName || r.updated_by_name || null,
        updatedAt: r.updatedAt || r.updated_at || null,
        remarks: r.remarks || '',
        markedAt: r.markedAt || r.marked_at || new Date().toISOString(),
        createdAt: r.createdAt || r.created_at || new Date().toISOString()
      }, { merge: true });
    }

    await batch.commit();
    console.log(`[FirestoreSync] Synced attendance session (${sessionId}) with ${safeRecords.length} records (present: ${presentCount}, absent: ${absentCount}, leftEarly: ${leftEarlyCount}) to Firestore`);
    return true;
  } catch (err: any) {
    console.warn(`[FirestoreSync] Failed to sync attendance to Firestore:`, err.message);
    return false;
  }
}

export async function syncAttendanceAuditLogToFirestore(log: any): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;
  try {
    const id = log.id || `audit-${Date.now()}`;
    await collections.auditLogs().doc(id).set({
      id,
      entity_type: 'ATTENDANCE',
      action: log.action || 'REATTENDANCE',
      school_id: log.schoolId || log.school_id,
      schoolId: log.schoolId || log.school_id,
      entity_id: log.sessionId,
      sessionId: log.sessionId,
      studentId: log.studentId || null,
      studentName: log.studentName || null,
      rollNumber: log.rollNumber || null,
      previousStatus: log.previousStatus || null,
      newStatus: log.newStatus || null,
      departurePeriod: log.departurePeriod || null,
      departureTime: log.departureTime || null,
      reason: log.reason || null,
      changedBy: log.changedBy || null,
      changedByName: log.changedByName || null,
      metadata: log,
      createdAt: log.createdAt || new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (err: any) {
    console.warn('[FirestoreSync] Failed to sync attendance audit log to Firestore:', err.message);
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

export async function deleteSchoolFromFirestore(id: string, code?: string): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;
  try {
    // 1. Delete main school doc
    await collections.schools().doc(id).delete();

    // Also delete any doc matching the school code or id if there are alternate entries
    if (code) {
      try {
        const codeSnaps = await collections.schools().where('code', '==', code).get();
        for (const d of codeSnaps.docs) {
          await d.ref.delete();
        }
      } catch {}
    }

    // Helper to batch delete a collection by schoolId
    const cascadeDelete = async (colRef: any, field = 'schoolId') => {
      try {
        const snap = await colRef.where(field, '==', id).get();
        if (!snap.empty) {
          const batch = firestore.batch();
          snap.docs.forEach((doc: any) => batch.delete(doc.ref));
          await batch.commit();
        }
      } catch {}
    };

    await Promise.allSettled([
      cascadeDelete(collections.users(), 'schoolId'),
      cascadeDelete(collections.users(), 'school_id'),
      cascadeDelete(collections.students(), 'schoolId'),
      cascadeDelete(collections.teachers(), 'schoolId'),
      cascadeDelete(collections.classes(), 'schoolId'),
      cascadeDelete(collections.sections(), 'schoolId'),
      cascadeDelete(collections.subjects(), 'schoolId'),
      cascadeDelete(collections.timetables(), 'schoolId'),
      cascadeDelete(collections.timetableEntries(), 'schoolId'),
      cascadeDelete(collections.timetablePeriods(), 'schoolId'),
      cascadeDelete(collections.teacherAssignments(), 'schoolId'),
      cascadeDelete(collections.attendanceSessions(), 'schoolId'),
      cascadeDelete(collections.attendanceRecords(), 'schoolId'),
      cascadeDelete(collections.payments(), 'schoolId'),
      cascadeDelete(collections.schoolSubscriptions(), 'schoolId')
    ]);

    console.log(`[FirestoreSync] Deleted school (${id}) and cascaded child records from Firestore`);
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

  console.log('[FirestoreSync] Rehydrating data from Cloud Firestore collections in parallel...');

  // Fetch all collections concurrently
  const [
    studentsSnap,
    teachersSnap,
    assignmentsSnap,
    classesSnap,
    sectionsSnap,
    subjectsSnap,
    periodsSnap,
    entriesSnap,
    schoolsSnap
  ] = await Promise.all([
    stores.demoStudents ? collections.students().get().catch(e => { console.warn('[FirestoreSync] Students load skipped:', e.message); return null; }) : null,
    stores.demoTeachers ? collections.teachers().get().catch(e => { console.warn('[FirestoreSync] Teachers load skipped:', e.message); return null; }) : null,
    stores.demoTeacherAssignments ? collections.teacherAssignments().get().catch(e => { console.warn('[FirestoreSync] Teacher assignments load skipped:', e.message); return null; }) : null,
    stores.demoClasses ? collections.classes().get().catch(e => { console.warn('[FirestoreSync] Classes load skipped:', e.message); return null; }) : null,
    stores.demoSections ? collections.sections().get().catch(e => { console.warn('[FirestoreSync] Sections load skipped:', e.message); return null; }) : null,
    stores.demoSubjects ? collections.subjects().get().catch(e => { console.warn('[FirestoreSync] Subjects load skipped:', e.message); return null; }) : null,
    stores.memPeriods ? collections.timetablePeriods().get().catch(e => { console.warn('[FirestoreSync] Timetable periods load skipped:', e.message); return null; }) : null,
    stores.memEntries ? collections.timetableEntries().get().catch(e => { console.warn('[FirestoreSync] Timetable entries load skipped:', e.message); return null; }) : null,
    stores.demoSchools ? collections.schools().get().catch(e => { console.warn('[FirestoreSync] Schools load skipped:', e.message); return null; }) : null
  ]);

  // 1. Students
  if (stores.demoStudents && studentsSnap && !studentsSnap.empty) {
    const list = studentsSnap.docs.map(d => {
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
        academic_year_id: dt.academic_year_id || dt.academicYearId || dt.session_id || dt.sessionId || null,
        session_id: dt.session_id || dt.sessionId || dt.academic_year_id || null,
        session_name: dt.session_name || dt.sessionName || dt.session || null,
        session: dt.session || dt.session_name || dt.sessionName || null,
        is_active: dt.is_active !== false && dt.status !== 'ARCHIVED',
        ...dt
      };
    }).filter(s => s.is_active !== false);

    for (const st of list) {
      const idx = stores.demoStudents.findIndex(x => x.id === st.id);
      if (idx >= 0) stores.demoStudents[idx] = { ...stores.demoStudents[idx], ...st };
      else stores.demoStudents.push(st);
    }
    result.students = list.length;
    console.log(`[FirestoreSync] Loaded ${list.length} students from Firestore`);
  }

  // 2. Teachers
  if (stores.demoTeachers && teachersSnap && !teachersSnap.empty) {
    const list = teachersSnap.docs.map(d => {
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

    for (const t of list) {
      const idx = stores.demoTeachers.findIndex(x => x.id === t.id || x.email === t.email);
      if (idx >= 0) stores.demoTeachers[idx] = { ...stores.demoTeachers[idx], ...t };
      else stores.demoTeachers.push(t);
    }
    result.teachers = stores.demoTeachers.length;
    console.log(`[FirestoreSync] Loaded ${list.length} teachers from Firestore`);
  }

  // 3. Teacher Assignments
  if (stores.demoTeacherAssignments && assignmentsSnap && !assignmentsSnap.empty) {
    const allAssignments: any[] = [];
    assignmentsSnap.docs.forEach(d => {
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

  // 4. Classes
  if (stores.demoClasses && classesSnap && !classesSnap.empty) {
    const list = classesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    for (const c of list) {
      const idx = stores.demoClasses.findIndex(x => x.id === c.id);
      if (idx >= 0) stores.demoClasses[idx] = { ...stores.demoClasses[idx], ...c };
      else stores.demoClasses.push(c);
    }
    result.classes = list.length;
    console.log(`[FirestoreSync] Loaded ${list.length} classes from Firestore`);
  }

  // 5. Sections
  if (stores.demoSections && sectionsSnap && !sectionsSnap.empty) {
    const list = sectionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    for (const s of list) {
      const idx = stores.demoSections.findIndex(x => x.id === s.id);
      if (idx >= 0) stores.demoSections[idx] = { ...stores.demoSections[idx], ...s };
      else stores.demoSections.push(s);
    }
    result.sections = list.length;
    console.log(`[FirestoreSync] Loaded ${list.length} sections from Firestore`);
  }

  // 6. Subjects
  if (stores.demoSubjects && subjectsSnap && !subjectsSnap.empty) {
    const list = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    for (const sub of list) {
      const idx = stores.demoSubjects.findIndex(x => x.id === sub.id);
      if (idx >= 0) stores.demoSubjects[idx] = { ...stores.demoSubjects[idx], ...sub };
      else stores.demoSubjects.push(sub);
    }
    result.subjects = list.length;
    console.log(`[FirestoreSync] Loaded ${list.length} subjects from Firestore`);
  }

  // 7. Timetable Periods
  if (stores.memPeriods && periodsSnap && !periodsSnap.empty) {
    const list = periodsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => (a.period_number || 0) - (b.period_number || 0));
    for (const p of list) {
      const idx = stores.memPeriods.findIndex(x => x.id === p.id);
      if (idx >= 0) stores.memPeriods[idx] = { ...stores.memPeriods[idx], ...p };
      else stores.memPeriods.push(p);
    }
    result.timetablePeriods = list.length;
    console.log(`[FirestoreSync] Loaded ${list.length} timetable periods from Firestore`);
  }

  // 8. Timetable Entries
  if (stores.memEntries && entriesSnap && !entriesSnap.empty) {
    const list = entriesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    for (const ent of list) {
      const idx = stores.memEntries.findIndex(x => x.id === ent.id);
      if (idx >= 0) stores.memEntries[idx] = { ...stores.memEntries[idx], ...ent };
      else stores.memEntries.push(ent);
    }
    result.timetableEntries = list.length;
    console.log(`[FirestoreSync] Loaded ${list.length} timetable entries from Firestore`);
  }

  // 9. Schools
  if (stores.demoSchools && schoolsSnap && !schoolsSnap.empty) {
    const list: any[] = schoolsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    for (const sch of list) {
      const idx = stores.demoSchools.findIndex((x: any) => x.id === sch.id || x.code === sch.code);
      if (idx >= 0) stores.demoSchools[idx] = { ...stores.demoSchools[idx], ...sch };
      else stores.demoSchools.push(sch);
    }
    result.schools = stores.demoSchools.length;
    console.log(`[FirestoreSync] Loaded ${list.length} schools from Firestore`);
  }

  return { loaded: result };
}
