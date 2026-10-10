import { pool, isPostgresConfigured } from '../db';
import { demoTeacherAssignments, demoTeachers, demoClasses, demoSections, demoSubjects } from '../routes/schoolData';
import { isSameSchool, isTestSchool } from '../utils/tenant';

export interface ClassMentorRecord {
  id?: string;
  school_id: string;
  class_id: string;
  section_id: string;
  teacher_id: string;
  class_number?: number;
  section_name?: string;
  teacher_name?: string;
  teacher_email?: string;
  employee_id?: string;
  assigned_at?: string;
}

export interface TeacherPermissionRecord {
  id?: string;
  school_id: string;
  class_id: string;
  section_id: string;
  subject_id: string;
  teacher_id: string;
  teacher_name: string;
  subject_name: string;
  is_primary: boolean;
  is_alternate: boolean;
  is_authorized: boolean;
  granted_by?: string | null;
  updated_at?: string;
}

// In-memory fallback stores for test/demo mode when PostgreSQL is absent
export const inMemoryClassMentors: ClassMentorRecord[] = [];
export const inMemoryTeacherPermissions: {
  id: string;
  school_id: string;
  class_id: string;
  section_id: string;
  subject_id: string;
  teacher_id: string;
  is_authorized: boolean;
  granted_by?: string | null;
  updated_at: string;
}[] = [];

/**
 * 1. Admin: Assign or update mentor for a class-section
 */
export async function assignClassMentor(
  schoolId: string,
  classId: string,
  sectionId: string,
  teacherId: string
): Promise<ClassMentorRecord> {
  if (!schoolId || !classId || !sectionId || !teacherId) {
    throw new Error('school_id, class_id, section_id, and teacher_id are required');
  }

  if (isPostgresConfigured) {
    try {
      const q = await pool.query(
        `INSERT INTO class_mentors (school_id, class_id, section_id, teacher_id, assigned_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT (school_id, class_id, section_id)
         DO UPDATE SET teacher_id = EXCLUDED.teacher_id, updated_at = NOW()
         RETURNING *`,
        [schoolId, classId, sectionId, teacherId]
      );
      return q.rows[0];
    } catch (err: any) {
      console.error('[MentorService] Error assigning class mentor in DB:', err.message);
      throw err;
    }
  }

  // Fallback in-memory logic
  const idx = inMemoryClassMentors.findIndex(
    m => isSameSchool(m.school_id, schoolId) && m.class_id === classId && m.section_id === sectionId
  );
  const rec: ClassMentorRecord = {
    id: `cm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    school_id: schoolId,
    class_id: classId,
    section_id: sectionId,
    teacher_id: teacherId,
    assigned_at: new Date().toISOString()
  };
  if (idx >= 0) {
    inMemoryClassMentors[idx] = rec;
  } else {
    inMemoryClassMentors.push(rec);
  }
  return rec;
}

/**
 * 2. Admin: Remove mentor from a class-section
 */
export async function removeClassMentor(
  schoolId: string,
  classId: string,
  sectionId: string
): Promise<{ success: boolean }> {
  if (isPostgresConfigured) {
    try {
      await pool.query(
        `DELETE FROM class_mentors WHERE school_id = $1 AND class_id = $2 AND section_id = $3`,
        [schoolId, classId, sectionId]
      );
      return { success: true };
    } catch (err: any) {
      console.error('[MentorService] Error removing class mentor from DB:', err.message);
      throw err;
    }
  }

  for (let i = inMemoryClassMentors.length - 1; i >= 0; i--) {
    const m = inMemoryClassMentors[i];
    if (isSameSchool(m.school_id, schoolId) && m.class_id === classId && m.section_id === sectionId) {
      inMemoryClassMentors.splice(i, 1);
    }
  }
  return { success: true };
}

/**
 * 3. Admin: Get all class-sections with mentor status
 */
export async function getAllClassMentors(schoolId: string): Promise<any[]> {
  if (isPostgresConfigured) {
    try {
      const q = await pool.query(
        `SELECT sec.id AS section_id, sec.name AS section_name, c.id AS class_id, c.class_number,
                cm.id AS mentor_record_id, cm.teacher_id, cm.assigned_at,
                u.name AS teacher_name, u.email AS teacher_email, tp.employee_id
         FROM sections sec
         JOIN classes c ON c.id = sec.class_id
         LEFT JOIN class_mentors cm ON cm.class_id = c.id AND cm.section_id = sec.id AND cm.school_id = sec.school_id
         LEFT JOIN users u ON u.id = cm.teacher_id
         LEFT JOIN teacher_profiles tp ON tp.user_id = u.id
         WHERE sec.school_id = $1
         ORDER BY c.class_number, sec.name`,
        [schoolId]
      );
      if (q.rowCount && q.rowCount > 0) return q.rows;
    } catch (err: any) {
      console.warn('[MentorService] DB query for class mentors failed, using in-memory fallback:', err.message);
    }
  }

  // Fallback combined list from demoClasses & demoSections
  const result: any[] = [];
  const schoolSecs = demoSections.filter(s => isSameSchool(s.school_id || schoolId, schoolId));
  for (const sec of schoolSecs) {
    const cls = demoClasses.find(c => c.id === sec.class_id);
    const cm = inMemoryClassMentors.find(m => isSameSchool(m.school_id, schoolId) && m.class_id === sec.class_id && m.section_id === sec.id);
    const teacher = cm ? demoTeachers.find(t => t.id === cm.teacher_id) : null;

    result.push({
      section_id: sec.id,
      section_name: sec.name,
      class_id: sec.class_id,
      class_number: cls?.class_number || 10,
      mentor_record_id: cm?.id || null,
      teacher_id: cm?.teacher_id || null,
      assigned_at: cm?.assigned_at || null,
      teacher_name: teacher?.name || null,
      teacher_email: teacher?.email || null,
      employee_id: teacher?.employee_id || null
    });
  }
  return result;
}

/**
 * 4. Teacher: Get classes where logged-in teacher is assigned as Class Mentor
 */
export async function getMentoredClasses(schoolId: string, teacherId: string): Promise<any[]> {
  if (isPostgresConfigured) {
    try {
      const q = await pool.query(
        `SELECT cm.id AS mentor_record_id, cm.class_id, cm.section_id, cm.assigned_at,
                c.class_number, sec.name AS section_name
         FROM class_mentors cm
         JOIN classes c ON c.id = cm.class_id
         JOIN sections sec ON sec.id = cm.section_id
         WHERE cm.school_id = $1 AND cm.teacher_id = $2
         ORDER BY c.class_number, sec.name`,
        [schoolId, teacherId]
      );
      if (q.rowCount && q.rowCount > 0) return q.rows;
    } catch (err: any) {
      console.warn('[MentorService] DB query for mentored classes failed:', err.message);
    }
  }

  return inMemoryClassMentors
    .filter(m => isSameSchool(m.school_id, schoolId) && m.teacher_id === teacherId)
    .map(m => {
      const cls = demoClasses.find(c => c.id === m.class_id);
      const sec = demoSections.find(s => s.id === m.section_id);
      return {
        mentor_record_id: m.id,
        class_id: m.class_id,
        section_id: m.section_id,
        class_number: cls?.class_number || 10,
        section_name: sec?.name || 'A',
        assigned_at: m.assigned_at
      };
    });
}

/**
 * 5. Helper: Check if a teacher is the assigned Class Mentor for a section
 */
export async function isClassMentor(schoolId: string, classId: string, sectionId: string, teacherId: string): Promise<boolean> {
  if (isPostgresConfigured) {
    try {
      const q = await pool.query(
        `SELECT 1 FROM class_mentors WHERE school_id = $1 AND class_id = $2 AND section_id = $3 AND teacher_id = $4`,
        [schoolId, classId, sectionId, teacherId]
      );
      return (q.rowCount ?? 0) > 0;
    } catch (_e) {}
  }

  return inMemoryClassMentors.some(
    m => isSameSchool(m.school_id, schoolId) && m.class_id === classId && m.section_id === sectionId && m.teacher_id === teacherId
  );
}

/**
 * 6. Helper: Verify Primary Subject Teacher vs Alternate Teacher eligibility
 */
export async function getSubjectTeacherRole(
  schoolId: string,
  classId: string,
  sectionId: string,
  subjectId: string,
  teacherId: string
): Promise<{ isPrimary: boolean; isAlternate: boolean }> {
  // Query DB class_routines / timetable_entries
  if (isPostgresConfigured) {
    try {
      // Check Primary in class_routines / timetable_entries
      const primQ = await pool.query(
        `SELECT 1 FROM class_routines 
         WHERE school_id = $1 AND class_id = $2 AND section_id = $3 AND subject_id = $4 AND teacher_id = $5
         UNION
         SELECT 1 FROM timetable_entries
         WHERE school_id = $1 AND class_id = $2 AND section_id = $3 AND subject_id = $4 AND teacher_id = $5`,
        [schoolId, classId, sectionId, subjectId, teacherId]
      );
      if ((primQ.rowCount ?? 0) > 0) {
        return { isPrimary: true, isAlternate: false };
      }

      // Check Substitute/Alternate in timetable_entries
      const altQ = await pool.query(
        `SELECT 1 FROM timetable_entries
         WHERE school_id = $1 AND class_id = $2 AND section_id = $3 AND subject_id = $4 AND substitute_teacher_id = $5`,
        [schoolId, classId, sectionId, subjectId, teacherId]
      );
      if ((altQ.rowCount ?? 0) > 0) {
        return { isPrimary: false, isAlternate: true };
      }
    } catch (_e) {}
  }

  // Check demoTeacherAssignments in-memory
  const allocs = demoTeacherAssignments.filter(
    a => isSameSchool(a.school_id || schoolId, schoolId) &&
         (a.class_id === classId || String(a.class_number) === String(classId)) &&
         (a.section_id === sectionId || String(a.section_name).toLowerCase() === String(sectionId).toLowerCase()) &&
         (a.subject_id === subjectId || String(a.subject_name).toLowerCase() === String(subjectId).toLowerCase())
  );

  const isPrim = allocs.some(a => a.teacher_id === teacherId);
  const isAlt = allocs.some(a => a.alt_teacher_id === teacherId);

  return { isPrimary: isPrim, isAlternate: isAlt };
}

/**
 * 7. Teacher Mentor Workspace: Get permissions list for a mentored class-section
 */
export async function getMentorPermissionsList(
  schoolId: string,
  mentorTeacherId: string,
  classId: string,
  sectionId: string
): Promise<TeacherPermissionRecord[]> {
  // Ensure requester is mentor
  const isMentor = await isClassMentor(schoolId, classId, sectionId, mentorTeacherId);
  if (!isMentor) {
    throw new Error('Access denied: User is not the designated Class Mentor for this section');
  }

  // Load existing permissions from DB or in-memory
  let permMap = new Map<string, { is_authorized: boolean; granted_by?: string | null; updated_at?: string }>();
  if (isPostgresConfigured) {
    try {
      const q = await pool.query(
        `SELECT subject_id, teacher_id, is_authorized, granted_by, updated_at FROM teacher_assignment_permissions
         WHERE school_id = $1 AND class_id = $2 AND section_id = $3`,
        [schoolId, classId, sectionId]
      );
      q.rows.forEach(r => {
        permMap.set(`${r.subject_id}:${r.teacher_id}`, {
          is_authorized: Boolean(r.is_authorized),
          granted_by: r.granted_by,
          updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : undefined
        });
      });
    } catch (_e) {}
  } else {
    inMemoryTeacherPermissions.forEach(p => {
      if (isSameSchool(p.school_id, schoolId) && p.class_id === classId && p.section_id === sectionId) {
        permMap.set(`${p.subject_id}:${p.teacher_id}`, {
          is_authorized: Boolean(p.is_authorized),
          granted_by: p.granted_by,
          updated_at: p.updated_at
        });
      }
    });
  }

  // Gather all subject allocations for this class and section
  const result: TeacherPermissionRecord[] = [];

  // 1. From PostgreSQL timetable_entries when configured
  if (isPostgresConfigured) {
    try {
      const qAlloc = await pool.query(
        `SELECT 
           te.subject_id,
           sub.name AS subject_name,
           te.teacher_id,
           u.name AS teacher_name,
           te.substitute_teacher_id,
           su.name AS alt_teacher_name
         FROM timetable_entries te
         LEFT JOIN subjects sub ON sub.id = te.subject_id AND sub.school_id = te.school_id
         LEFT JOIN users u ON u.id = te.teacher_id AND u.school_id = te.school_id
         LEFT JOIN users su ON su.id = te.substitute_teacher_id AND su.school_id = te.school_id
         WHERE te.school_id = $1 AND te.class_id = $2 AND te.section_id = $3
           AND te.subject_id IS NOT NULL
           AND (te.status IS NULL OR te.status != 'CANCELLED')
         ORDER BY sub.name ASC, u.name ASC`,
        [schoolId, classId, sectionId]
      );

      const seenPrimary = new Set<string>();
      const seenAlternate = new Set<string>();

      for (const r of qAlloc.rows) {
        // Primary teacher allocation
        if (r.teacher_id) {
          const pKey = `${r.subject_id}:${r.teacher_id}`;
          if (!seenPrimary.has(pKey)) {
            seenPrimary.add(pKey);
            const perm = permMap.get(pKey);
            const isAuth = perm ? perm.is_authorized : false;
            result.push({
              school_id: schoolId,
              class_id: classId,
              section_id: sectionId,
              subject_id: r.subject_id,
              subject_name: r.subject_name || 'Subject',
              teacher_id: r.teacher_id,
              teacher_name: r.teacher_name || 'Primary Teacher',
              is_primary: true,
              is_alternate: false,
              is_authorized: isAuth,
              granted_by: perm?.granted_by || null,
              updated_at: perm?.updated_at
            });
          }
        }

        // Alternate / substitute teacher allocation
        if (r.substitute_teacher_id && r.substitute_teacher_id !== r.teacher_id) {
          const aKey = `${r.subject_id}:${r.substitute_teacher_id}`;
          if (!seenAlternate.has(aKey)) {
            seenAlternate.add(aKey);
            result.push({
              school_id: schoolId,
              class_id: classId,
              section_id: sectionId,
              subject_id: r.subject_id,
              subject_name: r.subject_name || 'Subject',
              teacher_id: r.substitute_teacher_id,
              teacher_name: r.alt_teacher_name || 'Alternate Teacher',
              is_primary: false,
              is_alternate: true,
              is_authorized: false // Alternate teachers are strictly blocked
            });
          }
        }
      }
    } catch (err: any) {
      console.warn('[MentorService] DB error fetching timetable allocations:', err.message);
    }
  }

  // 2. Fallback to demoTeacherAssignments if no DB records found or Postgres unconfigured
  if (result.length === 0) {
    const allocs = demoTeacherAssignments.filter(
      a => isSameSchool(a.school_id || schoolId, schoolId) &&
           (a.class_id === classId || String(a.class_number) === String(classId)) &&
           (a.section_id === sectionId || String(a.section_name).toLowerCase() === String(sectionId).toLowerCase())
    );

    for (const a of allocs) {
      // Main Teacher
      if (a.teacher_id) {
        const key = `${a.subject_id}:${a.teacher_id}`;
        const perm = permMap.get(key);
        const isAuth = perm ? perm.is_authorized : false;
        result.push({
          school_id: schoolId,
          class_id: classId,
          section_id: sectionId,
          subject_id: a.subject_id,
          subject_name: a.subject_name || 'Subject',
          teacher_id: a.teacher_id,
          teacher_name: a.teacher_name || 'Primary Teacher',
          is_primary: true,
          is_alternate: false,
          is_authorized: isAuth,
          granted_by: perm?.granted_by || null,
          updated_at: perm?.updated_at
        });
      }
      // Alternate Teacher
      if (a.alt_teacher_id) {
        result.push({
          school_id: schoolId,
          class_id: classId,
          section_id: sectionId,
          subject_id: a.subject_id,
          subject_name: a.subject_name || 'Subject',
          teacher_id: a.alt_teacher_id,
          teacher_name: a.alt_teacher_name || 'Alternate Teacher',
          is_primary: false,
          is_alternate: true,
          is_authorized: false // Alternate teachers are strictly blocked
        });
      }
    }
  }

  return result;
}

/**
 * 8. Teacher Mentor Workspace: Update permission for a primary subject teacher
 */
export async function updateSubjectTeacherPermission(
  schoolId: string,
  mentorTeacherId: string,
  classId: string,
  sectionId: string,
  subjectId: string,
  targetTeacherId: string,
  isAuthorized: boolean
): Promise<{ success: boolean; message: string }> {
  // 1. Verify mentor status
  const isMentor = await isClassMentor(schoolId, classId, sectionId, mentorTeacherId);
  if (!isMentor) {
    const err: any = new Error('Access denied: Only the assigned Class Mentor can manage permissions for this section');
    err.status = 403;
    err.code = 'NOT_CLASS_MENTOR';
    throw err;
  }

  // 2. Verify Primary Teacher eligibility (Strict Rule #1 & #2)
  const role = await getSubjectTeacherRole(schoolId, classId, sectionId, subjectId, targetTeacherId);
  if (role.isAlternate || !role.isPrimary) {
    const err: any = new Error('Strict Authorization Error: Alternate or unassigned teachers cannot be granted assignment publishing permission');
    err.status = 403;
    err.code = 'ALTERNATE_TEACHER_PUBLISH_BLOCKED';
    throw err;
  }

  // 3. Update DB or in-memory persistence
  if (isPostgresConfigured) {
    try {
      await pool.query(
        `INSERT INTO teacher_assignment_permissions
           (school_id, class_id, section_id, subject_id, teacher_id, is_authorized, granted_by, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (school_id, class_id, section_id, subject_id, teacher_id)
         DO UPDATE SET is_authorized = EXCLUDED.is_authorized, granted_by = EXCLUDED.granted_by, updated_at = NOW()`,
        [schoolId, classId, sectionId, subjectId, targetTeacherId, isAuthorized, mentorTeacherId]
      );
    } catch (err: any) {
      console.error('[MentorService] DB error updating permissions:', err.message);
      throw err;
    }
  } else {
    const idx = inMemoryTeacherPermissions.findIndex(
      p => isSameSchool(p.school_id, schoolId) && p.class_id === classId && p.section_id === sectionId && p.subject_id === subjectId && p.teacher_id === targetTeacherId
    );
    const entry = {
      id: `tap-${Date.now()}`,
      school_id: schoolId,
      class_id: classId,
      section_id: sectionId,
      subject_id: subjectId,
      teacher_id: targetTeacherId,
      is_authorized: isAuthorized,
      granted_by: mentorTeacherId,
      updated_at: new Date().toISOString()
    };
    if (idx >= 0) inMemoryTeacherPermissions[idx] = entry;
    else inMemoryTeacherPermissions.push(entry);
  }

  return { success: true, message: `Publishing permission for target teacher updated to ${isAuthorized}` };
}

/**
 * 9. Server Engine: Verify Teacher Assignment Publishing Eligibility
 * Enforces BOTH Primary Subject Teacher check AND mentor authorization check.
 */
export async function verifyTeacherPublishingEligibility(
  schoolId: string,
  teacherId: string,
  classId: string,
  sectionId: string,
  subjectId: string
): Promise<{ eligible: boolean; code?: string; message?: string }> {
  // Step A: Primary Subject Teacher Verification
  const role = await getSubjectTeacherRole(schoolId, classId, sectionId, subjectId, teacherId);
  if (role.isAlternate) {
    return {
      eligible: false,
      code: 'ALTERNATE_TEACHER_PUBLISH_BLOCKED',
      message: 'Alternate teachers are strictly prohibited from publishing assignments for this class and subject.'
    };
  }
  if (!role.isPrimary) {
    return {
      eligible: false,
      code: 'NOT_PRIMARY_TEACHER',
      message: 'Teacher is not assigned as the primary subject teacher for this class, section, and subject.'
    };
  }

  // Step B: Mentor Authorization Check
  let isAuth = false;
  if (isPostgresConfigured) {
    try {
      const q = await pool.query(
        `SELECT is_authorized FROM teacher_assignment_permissions
         WHERE school_id = $1 AND class_id = $2 AND section_id = $3 AND subject_id = $4 AND teacher_id = $5`,
        [schoolId, classId, sectionId, subjectId, teacherId]
      );
      if (q.rowCount && q.rowCount > 0) {
        isAuth = Boolean(q.rows[0].is_authorized);
      }
    } catch (_e) {}
  } else {
    const entry = inMemoryTeacherPermissions.find(
      p => isSameSchool(p.school_id, schoolId) && p.class_id === classId && p.section_id === sectionId && p.subject_id === subjectId && p.teacher_id === teacherId
    );
    if (entry) isAuth = Boolean(entry.is_authorized);
  }

  if (!isAuth) {
    return {
      eligible: false,
      code: 'ASSIGNMENT_PUBLISH_UNAUTHORIZED',
      message: 'Assignment publishing permission has not been granted by the Class Mentor for this class and subject.'
    };
  }

  return { eligible: true };
}

export interface EligiblePublishingOption {
  class_id: string;
  class_number: number;
  section_id: string;
  section_name: string;
  subject_id: string;
  subject_name: string;
}

/**
 * 10. Teacher: Get all mentor-authorized class-section-subject combinations where teacher is Primary
 */
export async function getTeacherEligiblePublishingOptions(
  schoolId: string,
  teacherId: string
): Promise<EligiblePublishingOption[]> {
  const result: EligiblePublishingOption[] = [];
  const seenKeys = new Set<string>();

  // 1. Query PostgreSQL if configured
  if (isPostgresConfigured) {
    try {
      const q = await pool.query(
        `SELECT tap.class_id, c.class_number, tap.section_id, sec.name AS section_name,
                tap.subject_id, sub.name AS subject_name
         FROM teacher_assignment_permissions tap
         JOIN classes c ON c.id = tap.class_id
         JOIN sections sec ON sec.id = tap.section_id
         JOIN subjects sub ON sub.id = tap.subject_id
         WHERE tap.school_id = $1 AND tap.teacher_id = $2 AND tap.is_authorized = true
         ORDER BY c.class_number, sec.name, sub.name`,
        [schoolId, teacherId]
      );

      for (const r of q.rows) {
        // Verify primary teacher role
        const role = await getSubjectTeacherRole(schoolId, r.class_id, r.section_id, r.subject_id, teacherId);
        if (role.isPrimary && !role.isAlternate) {
          const key = `${r.class_id}:${r.section_id}:${r.subject_id}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            result.push({
              class_id: r.class_id,
              class_number: Number(r.class_number),
              section_id: r.section_id,
              section_name: r.section_name,
              subject_id: r.subject_id,
              subject_name: r.subject_name
            });
          }
        }
      }

      if (result.length > 0) return result;
    } catch (err: any) {
      console.warn('[MentorService] DB query for eligible options failed:', err.message);
    }
  }

  // 2. Demo & In-memory allocations check
  const allocs = demoTeacherAssignments.filter(
    a => isSameSchool(a.school_id || schoolId, schoolId) && a.teacher_id === teacherId
  );

  for (const a of allocs) {
    const key = `${a.class_id}:${a.section_id}:${a.subject_id}`;
    if (seenKeys.has(key)) continue;

    // Check if mentor authorized
    let isAuth = false;
    if (isPostgresConfigured) {
      try {
        const q = await pool.query(
          `SELECT is_authorized FROM teacher_assignment_permissions
           WHERE school_id = $1 AND class_id = $2 AND section_id = $3 AND subject_id = $4 AND teacher_id = $5`,
          [schoolId, a.class_id, a.section_id, a.subject_id, teacherId]
        );
        if (q.rowCount && q.rowCount > 0) isAuth = Boolean(q.rows[0].is_authorized);
      } catch (_e) {}
    } else {
      const entry = inMemoryTeacherPermissions.find(
        p => isSameSchool(p.school_id, schoolId) && p.class_id === a.class_id && p.section_id === a.section_id && p.subject_id === a.subject_id && p.teacher_id === teacherId
      );
      if (entry) isAuth = Boolean(entry.is_authorized);
    }

    if (isAuth) {
      seenKeys.add(key);
      const cls = demoClasses.find(c => c.id === a.class_id);
      const sec = demoSections.find(s => s.id === a.section_id);
      result.push({
        class_id: a.class_id,
        class_number: a.class_number || cls?.class_number || 10,
        section_id: a.section_id,
        section_name: a.section_name || sec?.name || 'A',
        subject_id: a.subject_id,
        subject_name: a.subject_name || 'Subject'
      });
    }
  }

  return result;
}
