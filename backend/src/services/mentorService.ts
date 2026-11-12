import { pool, isPostgresConfigured } from "../db";
import {
  demoTeacherAssignments,
  demoTeachers,
  demoClasses,
  demoSections,
  demoSubjects,
  demoStudents, isSameSession, toCanonicalSession,
} from "../routes/schoolData";
import { isSameSchool, isTestSchool } from "../utils/tenant";
import { inMemoryAssignments, checkHasAssignedDate } from "../routes/teacherAssignments";

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

export interface InMemoryExam {
  id: string;
  school_id: string;
  class_id: string;
  section_id?: string;
  subject_id?: string;
  subject_name?: string;
  title: string;
  exam_date: string;
  start_time: string;
  end_time: string;
  room?: string;
  total_marks: number;
  passing_marks: number;
  created_at: string;
}

export interface InMemoryExamResult {
  id: string;
  school_id: string;
  exam_id: string;
  student_id: string;
  marks_obtained: number;
  grade?: string;
  remarks?: string;
  created_at: string;
}

export const inMemoryStudentExams: InMemoryExam[] = [];
export const inMemoryExamResults: InMemoryExamResult[] = [];
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
 * 1. Admin: Assign or update class teacher for a class-section
 */
export async function assignClassMentor(
  schoolId: string,
  classId: string,
  sectionId: string,
  teacherId: string,
): Promise<ClassMentorRecord> {
  if (!schoolId || !classId || !sectionId || !teacherId) {
    throw new Error(
      "school_id, class_id, section_id, and teacher_id are required",
    );
  }

  if (isPostgresConfigured) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const upsertRes = await client.query(
        `INSERT INTO class_mentors
          (school_id, class_id, section_id, teacher_id, assigned_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        ON CONFLICT (school_id, class_id, section_id)
        DO UPDATE SET
          teacher_id = EXCLUDED.teacher_id,
          updated_at = NOW()
        RETURNING *`,
        [schoolId, classId, sectionId, teacherId],
      );

      // Sync teacher_profiles: resolve class_number and section_name
      try {
        const cRes = await client.query('SELECT class_number FROM classes WHERE id = $1', [classId]);
        const sRes = await client.query('SELECT name FROM sections WHERE id = $1', [sectionId]);
        const classNum = cRes.rows[0]?.class_number;
        const secName = sRes.rows[0]?.name;
        if (classNum !== undefined && secName) {
          const formattedCls = classNum === -1 ? 'Class L-KG' : classNum === 0 ? 'Class U-KG' : `Class ${classNum}`;
          // Clear this class-section from any previous teacher's profile
          await client.query(
            `UPDATE teacher_profiles
             SET class_name = NULL, section_name = NULL
             WHERE (class_name = $1 OR class_name = $2)
               AND section_name = $3
               AND user_id != $4 AND id != $4`,
            [formattedCls, `Class ${classNum}`, secName, teacherId]
          );
          // Set on new mentor profile
          await client.query(
            `UPDATE teacher_profiles
             SET class_name = $1, section_name = $2
             WHERE user_id = $3 OR id = $3`,
            [formattedCls, secName, teacherId]
          );
        }
      } catch (e: any) {
        console.warn('[MentorService] Profile sync error:', e.message);
      }

      await client.query("COMMIT");
      return upsertRes.rows[0];
    } catch (err: any) {
      try {
        await client.query("ROLLBACK");
      } catch {}
      console.error(
        "[MentorService] Error assigning class teacher in DB:",
        err.message,
      );
      throw err;
    } finally {
      client.release();
    }
  }

  // In‑memory fallback (demo / test mode)
  const idx = inMemoryClassMentors.findIndex(
    (m) =>
      isSameSchool(m.school_id, schoolId) &&
      m.class_id === classId &&
      m.section_id === sectionId,
  );
  if (idx >= 0) {
    const existing = inMemoryClassMentors[idx];
    if (existing.teacher_id === teacherId) {
      // Idempotent – same teacher already assigned
      return existing;
    }
    // Conflict – another teacher already assigned
    throw new Error(
      "Class‑section is already assigned to another teacher (in‑memory)",
    );
  }
  // No existing assignment – create new record
  const rec: ClassMentorRecord = {
    id: `cm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    school_id: schoolId,
    class_id: classId,
    section_id: sectionId,
    teacher_id: teacherId,
    assigned_at: new Date().toISOString(),
  };
  inMemoryClassMentors.push(rec);
  return rec;
}

/**
 * 2. Admin: Remove class teacher from a class-section
 */
export async function removeClassMentor(
  schoolId: string,
  classId: string,
  sectionId: string,
): Promise<{ success: boolean }> {
  if (isPostgresConfigured) {
    try {
      await pool.query(
        `DELETE FROM class_mentors WHERE school_id = $1 AND class_id = $2 AND section_id = $3`,
        [schoolId, classId, sectionId],
      );
      try {
        const cRes = await pool.query('SELECT class_number FROM classes WHERE id = $1', [classId]);
        const sRes = await pool.query('SELECT name FROM sections WHERE id = $1', [sectionId]);
        const classNum = cRes.rows[0]?.class_number;
        const secName = sRes.rows[0]?.name;
        if (classNum !== undefined && secName) {
          const formattedCls = classNum === -1 ? 'Class L-KG' : classNum === 0 ? 'Class U-KG' : `Class ${classNum}`;
          await pool.query(
            `UPDATE teacher_profiles
             SET class_name = NULL, section_name = NULL
             WHERE (class_name = $1 OR class_name = $2) AND section_name = $3`,
            [formattedCls, `Class ${classNum}`, secName]
          );
        }
      } catch (e: any) {
        console.warn('[MentorService] Profile clear error:', e.message);
      }
      return { success: true };
    } catch (err: any) {
      console.error(
        "[MentorService] Error removing class teacher from DB:",
        err.message,
      );
      throw err;
    }
  }

  for (let i = inMemoryClassMentors.length - 1; i >= 0; i--) {
    const m = inMemoryClassMentors[i];
    if (
      isSameSchool(m.school_id, schoolId) &&
      m.class_id === classId &&
      m.section_id === sectionId
    ) {
      inMemoryClassMentors.splice(i, 1);
    }
  }
  return { success: true };
}

/**
 * 3. Admin: Get all class-sections with mentor status
 */
export async function getAllClassMentors(schoolId: string, options?: any): Promise<any[]> {
  const requestedYearId = String(options?.academic_year_id || options?.academicYearId || options?.sessionId || '').trim();
  const requestedSession = String(options?.session || options?.sessionName || '').trim();

  let targetYearId: string | null = null;
  if (requestedYearId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestedYearId)) {
    targetYearId = requestedYearId;
  } else if (requestedYearId || requestedSession) {
    const term = requestedYearId || requestedSession;
    try {
      const ayRes = await pool.query(
        "SELECT id FROM academic_years WHERE school_id = $1 AND (name = $2 OR name ILIKE $3 OR code = $2) LIMIT 1",
        [schoolId, term, `%${term}%`]
      );
      if (ayRes.rows.length > 0) {
        targetYearId = ayRes.rows[0].id;
      }
    } catch {}
  }

  if (isPostgresConfigured) {
    try {
      let q;
      if (targetYearId) {
        q = await pool.query(
          `SELECT sec.id AS section_id, sec.name AS section_name, c.id AS class_id, c.class_number,
                  cm.id AS mentor_record_id, cm.teacher_id, cm.assigned_at,
                  u.name AS teacher_name, u.email AS teacher_email, tp.employee_id
           FROM sections sec
           JOIN classes c ON c.id = sec.class_id
           LEFT JOIN class_mentors cm ON cm.class_id = c.id AND cm.section_id = sec.id AND cm.school_id = sec.school_id
           LEFT JOIN users u ON u.id = cm.teacher_id
           LEFT JOIN teacher_profiles tp ON tp.user_id = u.id
           WHERE sec.school_id = $1
             AND (
               (sec.academic_year_id = $2)
               OR (c.academic_year_id = $2)
               OR EXISTS (SELECT 1 FROM students st WHERE st.school_id = $1 AND st.academic_year_id = $2 AND st.section_id = sec.id)
               OR EXISTS (SELECT 1 FROM student_promotions sp WHERE sp.school_id = $1 AND sp.to_academic_year_id = $2 AND sp.to_section_id = sec.id AND sp.status = 'CONFIRMED')
               OR EXISTS (SELECT 1 FROM student_enrollment_history_v28 seh WHERE seh.academic_year_id = $2 AND seh.section_id = sec.id)
             )
           ORDER BY c.class_number, sec.name`,
          [schoolId, targetYearId],
        );
      } else {
        q = await pool.query(
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
          [schoolId],
        );
      }
      if (q.rows) return q.rows;
    } catch (err: any) {
      console.warn(
        "[MentorService] DB query for class teachers failed, using in-memory fallback:",
        err.message,
      );
    }
  }

  // Fallback combined list from demoClasses & demoSections
  const result: any[] = [];
  const schoolSecs = demoSections.filter((s) =>
    isSameSchool(s.school_id || schoolId, schoolId),
  );
  for (const sec of schoolSecs) {
    const cls = demoClasses.find((c) => c.id === sec.class_id);
    const cm = inMemoryClassMentors.find(
      (m) =>
        isSameSchool(m.school_id, schoolId) &&
        m.class_id === sec.class_id &&
        m.section_id === sec.id,
    );
    const teacher = cm
      ? demoTeachers.find((t) => t.id === cm.teacher_id)
      : null;

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
      employee_id: teacher?.employee_id || null,
    });
  }
  return result;
}

/**
 * 4. Teacher: Get classes where logged-in teacher is assigned as Class Teacher
 */
export async function getMentoredClasses(
  schoolId: string,
  teacherId: string,
): Promise<any[]> {
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
        [schoolId, teacherId],
      );
      if (q.rowCount && q.rowCount > 0) return q.rows;
    } catch (err: any) {
      console.warn(
        "[MentorService] DB query for mentored classes failed:",
        err.message,
      );
    }
  }

  return inMemoryClassMentors
    .filter(
      (m) => isSameSchool(m.school_id, schoolId) && m.teacher_id === teacherId,
    )
    .map((m) => {
      const cls = demoClasses.find((c) => c.id === m.class_id);
      const sec = demoSections.find((s) => s.id === m.section_id);
      return {
        mentor_record_id: m.id,
        class_id: m.class_id,
        section_id: m.section_id,
        class_number: cls?.class_number || 10,
        section_name: sec?.name || "A",
        assigned_at: m.assigned_at,
      };
    });
}

/**
 * 5. Helper: Check if a teacher is the assigned Class Teacher for a section
 */
export async function isClassMentor(
  schoolId: string,
  classId: string,
  sectionId: string,
  teacherId: string,
): Promise<boolean> {
  if (isPostgresConfigured) {
    try {
      const isClassUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(classId);
      const rawClassNum = isClassUuid ? null : parseInt(String(classId).replace(/\D/g, ''), 10);
      const classNum = (rawClassNum !== null && !isNaN(rawClassNum)) ? rawClassNum : null;
      const isSecUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sectionId);
      const cleanSec = String(sectionId || '').replace(/section\s*/i, '').trim().toUpperCase();

      const q = await pool.query(
        `SELECT 1 FROM class_mentors cm
         JOIN classes c ON c.id = cm.class_id
         JOIN sections s ON s.id = cm.section_id
         WHERE cm.school_id = $1
           AND (
             cm.teacher_id = $2 
             OR cm.teacher_id IN (SELECT id FROM teacher_profiles WHERE user_id = $2)
             OR cm.teacher_id IN (SELECT user_id FROM teacher_profiles WHERE id = $2)
           )
           AND (
             cm.class_id = $3::uuid 
             OR ($4::smallint IS NOT NULL AND c.class_number = $4::smallint)
           )
           AND (
             cm.section_id = $5::uuid 
             OR UPPER(s.name) = UPPER($6)
           )
         LIMIT 1`,
        [
          schoolId,
          teacherId,
          isClassUuid ? classId : '00000000-0000-0000-0000-000000000000',
          classNum,
          isSecUuid ? sectionId : '00000000-0000-0000-0000-000000000000',
          cleanSec
        ]
      );
      if ((q.rowCount ?? 0) > 0) return true;
    } catch (_e) {}
  }

  return inMemoryClassMentors.some(
    (m) =>
      isSameSchool(m.school_id, schoolId) &&
      (m.class_id === classId || String(m.class_id).includes(String(classId))) &&
      (m.section_id === sectionId || String(m.section_id).toLowerCase().includes(String(sectionId).toLowerCase())) &&
      (m.teacher_id === teacherId || !m.teacher_id),
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
  teacherId: string,
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
        [schoolId, classId, sectionId, subjectId, teacherId],
      );
      if ((primQ.rowCount ?? 0) > 0) {
        return { isPrimary: true, isAlternate: false };
      }

      // Check Substitute/Alternate in timetable_entries
      const altQ = await pool.query(
        `SELECT 1 FROM timetable_entries
         WHERE school_id = $1 AND class_id = $2 AND section_id = $3 AND subject_id = $4 AND substitute_teacher_id = $5`,
        [schoolId, classId, sectionId, subjectId, teacherId],
      );
      if ((altQ.rowCount ?? 0) > 0) {
        return { isPrimary: false, isAlternate: true };
      }
    } catch (_e) {}
  }

  // Check demoTeacherAssignments in-memory
  const allocs = demoTeacherAssignments.filter(
    (a) =>
      isSameSchool(a.school_id || schoolId, schoolId) &&
      (a.class_id === classId || String(a.class_number) === String(classId)) &&
      (a.section_id === sectionId ||
        String(a.section_name).toLowerCase() ===
          String(sectionId).toLowerCase()) &&
      (a.subject_id === subjectId ||
        String(a.subject_name).toLowerCase() ===
          String(subjectId).toLowerCase()),
  );

  const isPrim = allocs.some((a) => a.teacher_id === teacherId);
  const isAlt = allocs.some((a) => a.alt_teacher_id === teacherId);

  return { isPrimary: isPrim, isAlternate: isAlt };
}

/**
 * 7. Teacher Mentor Workspace: Get permissions list for a mentored class-section
 */
export async function getMentorPermissionsList(
  schoolId: string,
  mentorTeacherId: string,
  classId: string,
  sectionId: string,
): Promise<TeacherPermissionRecord[]> {
  // Ensure requester is mentor
  const isMentor = await isClassMentor(
    schoolId,
    classId,
    sectionId,
    mentorTeacherId,
  );
  if (!isMentor) {
    throw new Error(
      "Access denied: User is not the designated Class Teacher for this section",
    );
  }

  // Load existing permissions from DB or in-memory
  let permMap = new Map<
    string,
    { is_authorized: boolean; granted_by?: string | null; updated_at?: string }
  >();
  if (isPostgresConfigured) {
    try {
      const q = await pool.query(
        `SELECT subject_id, teacher_id, is_authorized, granted_by, updated_at FROM teacher_assignment_permissions
         WHERE school_id = $1 AND class_id = $2 AND section_id = $3`,
        [schoolId, classId, sectionId],
      );
      q.rows.forEach((r) => {
        permMap.set(`${r.subject_id}:${r.teacher_id}`, {
          is_authorized: Boolean(r.is_authorized),
          granted_by: r.granted_by,
          updated_at: r.updated_at
            ? new Date(r.updated_at).toISOString()
            : undefined,
        });
      });
    } catch (_e) {}
  } else {
    inMemoryTeacherPermissions.forEach((p) => {
      if (
        isSameSchool(p.school_id, schoolId) &&
        p.class_id === classId &&
        p.section_id === sectionId
      ) {
        permMap.set(`${p.subject_id}:${p.teacher_id}`, {
          is_authorized: Boolean(p.is_authorized),
          granted_by: p.granted_by,
          updated_at: p.updated_at,
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
        [schoolId, classId, sectionId],
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
              subject_name: r.subject_name || "Subject",
              teacher_id: r.teacher_id,
              teacher_name: r.teacher_name || "Primary Teacher",
              is_primary: true,
              is_alternate: false,
              is_authorized: isAuth,
              granted_by: perm?.granted_by || null,
              updated_at: perm?.updated_at,
            });
          }
        }

        // Alternate / substitute teacher allocation
        if (
          r.substitute_teacher_id &&
          r.substitute_teacher_id !== r.teacher_id
        ) {
          const aKey = `${r.subject_id}:${r.substitute_teacher_id}`;
          if (!seenAlternate.has(aKey)) {
            seenAlternate.add(aKey);
            result.push({
              school_id: schoolId,
              class_id: classId,
              section_id: sectionId,
              subject_id: r.subject_id,
              subject_name: r.subject_name || "Subject",
              teacher_id: r.substitute_teacher_id,
              teacher_name: r.alt_teacher_name || "Alternate Teacher",
              is_primary: false,
              is_alternate: true,
              is_authorized: false, // Alternate teachers are strictly blocked
            });
          }
        }
      }
    } catch (err: any) {
      console.warn(
        "[MentorService] DB error fetching timetable allocations:",
        err.message,
      );
    }
  }

  // 2. Fallback to demoTeacherAssignments if no DB records found or Postgres unconfigured
  if (result.length === 0) {
    const allocs = demoTeacherAssignments.filter(
      (a) =>
        isSameSchool(a.school_id || schoolId, schoolId) &&
        (a.class_id === classId ||
          String(a.class_number) === String(classId)) &&
        (a.section_id === sectionId ||
          String(a.section_name).toLowerCase() ===
            String(sectionId).toLowerCase()),
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
          subject_name: a.subject_name || "Subject",
          teacher_id: a.teacher_id,
          teacher_name: a.teacher_name || "Primary Teacher",
          is_primary: true,
          is_alternate: false,
          is_authorized: isAuth,
          granted_by: perm?.granted_by || null,
          updated_at: perm?.updated_at,
        });
      }
      // Alternate Teacher
      if (a.alt_teacher_id) {
        result.push({
          school_id: schoolId,
          class_id: classId,
          section_id: sectionId,
          subject_id: a.subject_id,
          subject_name: a.subject_name || "Subject",
          teacher_id: a.alt_teacher_id,
          teacher_name: a.alt_teacher_name || "Alternate Teacher",
          is_primary: false,
          is_alternate: true,
          is_authorized: false, // Alternate teachers are strictly blocked
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
  isAuthorized: boolean,
): Promise<{ success: boolean; message: string }> {
  // 1. Verify mentor status
  const isMentor = await isClassMentor(
    schoolId,
    classId,
    sectionId,
    mentorTeacherId,
  );
  if (!isMentor) {
    const err: any = new Error(
      "Access denied: Only the assigned Class Teacher can manage permissions for this section",
    );
    err.status = 403;
    err.code = "NOT_CLASS_MENTOR";
    throw err;
  }

  // 2. Verify Primary Teacher eligibility (Strict Rule #1 & #2)
  const role = await getSubjectTeacherRole(
    schoolId,
    classId,
    sectionId,
    subjectId,
    targetTeacherId,
  );
  if (role.isAlternate || !role.isPrimary) {
    const err: any = new Error(
      "Strict Authorization Error: Alternate or unassigned teachers cannot be granted assignment publishing permission",
    );
    err.status = 403;
    err.code = "ALTERNATE_TEACHER_PUBLISH_BLOCKED";
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
        [
          schoolId,
          classId,
          sectionId,
          subjectId,
          targetTeacherId,
          isAuthorized,
          mentorTeacherId,
        ],
      );
    } catch (err: any) {
      console.error(
        "[MentorService] DB error updating permissions:",
        err.message,
      );
      throw err;
    }
  } else {
    const idx = inMemoryTeacherPermissions.findIndex(
      (p) =>
        isSameSchool(p.school_id, schoolId) &&
        p.class_id === classId &&
        p.section_id === sectionId &&
        p.subject_id === subjectId &&
        p.teacher_id === targetTeacherId,
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
      updated_at: new Date().toISOString(),
    };
    if (idx >= 0) inMemoryTeacherPermissions[idx] = entry;
    else inMemoryTeacherPermissions.push(entry);
  }

  return {
    success: true,
    message: `Publishing permission for target teacher updated to ${isAuthorized}`,
  };
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
  subjectId: string,
): Promise<{ eligible: boolean; code?: string; message?: string }> {
  // Step A: Primary Subject Teacher Verification
  const role = await getSubjectTeacherRole(
    schoolId,
    classId,
    sectionId,
    subjectId,
    teacherId,
  );
  if (role.isAlternate) {
    return {
      eligible: false,
      code: "ALTERNATE_TEACHER_PUBLISH_BLOCKED",
      message:
        "Alternate teachers are strictly prohibited from publishing assignments for this class and subject.",
    };
  }
  if (!role.isPrimary) {
    return {
      eligible: false,
      code: "NOT_PRIMARY_TEACHER",
      message:
        "Teacher is not assigned as the primary subject teacher for this class, section, and subject.",
    };
  }

  // Step B: Mentor Authorization Check
  let isAuth = false;
  if (isPostgresConfigured) {
    try {
      const q = await pool.query(
        `SELECT is_authorized FROM teacher_assignment_permissions
         WHERE school_id = $1 AND class_id = $2 AND section_id = $3 AND subject_id = $4 AND teacher_id = $5`,
        [schoolId, classId, sectionId, subjectId, teacherId],
      );
      if (q.rowCount && q.rowCount > 0) {
        isAuth = Boolean(q.rows[0].is_authorized);
      }
    } catch (_e) {}
  } else {
    const entry = inMemoryTeacherPermissions.find(
      (p) =>
        isSameSchool(p.school_id, schoolId) &&
        p.class_id === classId &&
        p.section_id === sectionId &&
        p.subject_id === subjectId &&
        p.teacher_id === teacherId,
    );
    if (entry) isAuth = Boolean(entry.is_authorized);
  }

  if (!isAuth) {
    return {
      eligible: false,
      code: "ASSIGNMENT_PUBLISH_UNAUTHORIZED",
      message:
        "Assignment publishing permission has not been granted by the Class Teacher for this class and subject.",
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
  teacherId: string,
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
        [schoolId, teacherId],
      );

      for (const r of q.rows) {
        // Verify primary teacher role
        const role = await getSubjectTeacherRole(
          schoolId,
          r.class_id,
          r.section_id,
          r.subject_id,
          teacherId,
        );
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
              subject_name: r.subject_name,
            });
          }
        }
      }

      if (result.length > 0) return result;
    } catch (err: any) {
      console.warn(
        "[MentorService] DB query for eligible options failed:",
        err.message,
      );
    }
  }

  // 2. Demo & In-memory allocations check
  const allocs = demoTeacherAssignments.filter(
    (a) =>
      isSameSchool(a.school_id || schoolId, schoolId) &&
      a.teacher_id === teacherId,
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
          [schoolId, a.class_id, a.section_id, a.subject_id, teacherId],
        );
        if (q.rowCount && q.rowCount > 0)
          isAuth = Boolean(q.rows[0].is_authorized);
      } catch (_e) {}
    } else {
      const entry = inMemoryTeacherPermissions.find(
        (p) =>
          isSameSchool(p.school_id, schoolId) &&
          p.class_id === a.class_id &&
          p.section_id === a.section_id &&
          p.subject_id === a.subject_id &&
          p.teacher_id === teacherId,
      );
      if (entry) isAuth = Boolean(entry.is_authorized);
    }

    if (isAuth) {
      seenKeys.add(key);
      const cls = demoClasses.find((c) => c.id === a.class_id);
      const sec = demoSections.find((s) => s.id === a.section_id);
      result.push({
        class_id: a.class_id,
        class_number: a.class_number || cls?.class_number || 10,
        section_id: a.section_id,
        section_name: a.section_name || sec?.name || "A",
        subject_id: a.subject_id,
        subject_name: a.subject_name || "Subject",
      });
    }
  }

  return result;
}


export interface TeacherAssignmentItem {
  id: string;
  title: string;
  assigned_date: string;
  due_date?: string;
  created_at?: string;
}

export interface TeacherAssignmentOverview {
  school_id: string;
  class_id: string;
  section_id: string;
  subject_id: string;
  subject_name: string;
  teacher_id: string;
  teacher_name: string;
  role_type: 'Primary Teacher' | 'Alternate Teacher' | 'Subject Teacher';
  is_primary: boolean;
  is_alternate: boolean;
  assignment_count: number;
  assignments: TeacherAssignmentItem[];
}

/**
 * 10. Teacher Mentor Workspace: Get overview of teachers taking classes in section & assignments given
 */
export async function getMentorTeacherAssignmentsOverview(
  schoolId: string,
  mentorTeacherId: string,
  classId: string,
  sectionId: string,
  fromDate?: string,
  toDate?: string,
  bypassMentorCheck: boolean = false
): Promise<TeacherAssignmentOverview[]> {
  if (!bypassMentorCheck) {
    const isMentor = await isClassMentor(schoolId, classId, sectionId, mentorTeacherId);
    if (!isMentor) {
      const err: any = new Error("Access denied: User is not the designated Class Teacher for this section");
      err.status = 403;
      err.code = "NOT_CLASS_MENTOR";
      throw err;
    }
  }

  const result: TeacherAssignmentOverview[] = [];
  const seenTeacherSubject = new Map<string, TeacherAssignmentOverview>();

  // 1. Gather teachers allocated in timetable
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

      for (const r of qAlloc.rows) {
        if (r.teacher_id) {
          const key = `${r.teacher_id}:${r.subject_id}`;
          if (!seenTeacherSubject.has(key)) {
            const entry: TeacherAssignmentOverview = {
              school_id: schoolId,
              class_id: classId,
              section_id: sectionId,
              subject_id: r.subject_id,
              subject_name: r.subject_name || 'Subject',
              teacher_id: r.teacher_id,
              teacher_name: r.teacher_name || 'Primary Teacher',
              role_type: 'Primary Teacher',
              is_primary: true,
              is_alternate: false,
              assignment_count: 0,
              assignments: []
            };
            seenTeacherSubject.set(key, entry);
            result.push(entry);
          }
        }
        if (r.substitute_teacher_id && r.substitute_teacher_id !== r.teacher_id) {
          const aKey = `${r.substitute_teacher_id}:${r.subject_id}`;
          if (!seenTeacherSubject.has(aKey)) {
            const entry: TeacherAssignmentOverview = {
              school_id: schoolId,
              class_id: classId,
              section_id: sectionId,
              subject_id: r.subject_id,
              subject_name: r.subject_name || 'Subject',
              teacher_id: r.substitute_teacher_id,
              teacher_name: r.alt_teacher_name || 'Alternate Teacher',
              role_type: 'Alternate Teacher',
              is_primary: false,
              is_alternate: true,
              assignment_count: 0,
              assignments: []
            };
            seenTeacherSubject.set(aKey, entry);
            result.push(entry);
          }
        }
      }
    } catch (err: any) {
      console.warn('[MentorService] DB error fetching timetable allocations:', err.message);
    }
  }

  // 2. Demo fallback if no records found or Postgres unconfigured
  if (result.length === 0) {
    const allocs = demoTeacherAssignments.filter(
      (a) =>
        isSameSchool(a.school_id || schoolId, schoolId) &&
        (a.class_id === classId || String(a.class_number) === String(classId)) &&
        (a.section_id === sectionId || String(a.section_name).toLowerCase() === String(sectionId).toLowerCase())
    );

    for (const a of allocs) {
      if (a.teacher_id) {
        const key = `${a.teacher_id}:${a.subject_id}`;
        if (!seenTeacherSubject.has(key)) {
          const entry: TeacherAssignmentOverview = {
            school_id: schoolId,
            class_id: classId,
            section_id: sectionId,
            subject_id: a.subject_id,
            subject_name: a.subject_name || 'Subject',
            teacher_id: a.teacher_id,
            teacher_name: a.teacher_name || 'Primary Teacher',
            role_type: 'Primary Teacher',
            is_primary: true,
            is_alternate: false,
            assignment_count: 0,
            assignments: []
          };
          seenTeacherSubject.set(key, entry);
          result.push(entry);
        }
      }
      if (a.alt_teacher_id) {
        const aKey = `${a.alt_teacher_id}:${a.subject_id}`;
        if (!seenTeacherSubject.has(aKey)) {
          const entry: TeacherAssignmentOverview = {
            school_id: schoolId,
            class_id: classId,
            section_id: sectionId,
            subject_id: a.subject_id,
            subject_name: a.subject_name || 'Subject',
            teacher_id: a.alt_teacher_id,
            teacher_name: a.alt_teacher_name || 'Alternate Teacher',
            role_type: 'Alternate Teacher',
            is_primary: false,
            is_alternate: true,
            assignment_count: 0,
            assignments: []
          };
          seenTeacherSubject.set(aKey, entry);
          result.push(entry);
        }
      }
    }
  }

  // 3. Query all assignments created for this class & section in the date range
  const fetchedAssignments: {
    id: string;
    teacher_id: string;
    teacher_name?: string;
    subject_id?: string;
    subject_name?: string;
    title: string;
    assigned_date: string;
    due_date?: string;
    created_at?: string;
  }[] = [];

  if (isPostgresConfigured) {
    try {
      const hasAssigned = await checkHasAssignedDate();
      const dateCol = hasAssigned ? 'COALESCE(sa.assigned_date, sa.created_at::date)' : 'sa.created_at::date';

      const qAssignments = await pool.query(
        `SELECT 
           sa.id,
           sa.teacher_id,
           sa.subject_id,
           sa.title,
           ${dateCol}::text AS assigned_date,
           sa.due_date,
           sa.created_at,
           COALESCE(u.name, 'Teacher') AS teacher_name,
           COALESCE(sub.name, 'General') AS subject_name
         FROM student_assignments sa
         LEFT JOIN users u ON u.id = sa.teacher_id AND u.school_id = sa.school_id
         LEFT JOIN subjects sub ON sub.id = sa.subject_id AND sub.school_id = sa.school_id
         WHERE sa.school_id = $1
           AND (sa.class_id = $2 OR sa.class_id::text = $2)
           AND (sa.section_id = $3 OR sa.section_id::text = $3 OR sa.section_id IS NULL)
           AND ($4::date IS NULL OR ${dateCol} >= $4::date)
           AND ($5::date IS NULL OR ${dateCol} <= $5::date)
         ORDER BY ${dateCol} DESC, sa.created_at DESC`,
        [schoolId, classId, sectionId, fromDate || null, toDate || null]
      );

      for (const row of qAssignments.rows) {
        fetchedAssignments.push({
          id: row.id,
          teacher_id: row.teacher_id,
          teacher_name: row.teacher_name,
          subject_id: row.subject_id,
          subject_name: row.subject_name,
          title: row.title,
          assigned_date: row.assigned_date ? String(row.assigned_date).slice(0, 10) : '',
          due_date: row.due_date ? String(row.due_date).slice(0, 10) : undefined,
          created_at: row.created_at
        });
      }
    } catch (err: any) {
      console.warn('[MentorService] DB error fetching student assignments:', err.message);
    }
  }

  // 4. In-memory assignments check
  for (const a of inMemoryAssignments) {
    if (!isSameSchool(a.school_id || schoolId, schoolId)) continue;
    const matchClass = a.class_id === classId || String(a.class_number) === String(classId);
    const matchSec = !a.section_id || a.section_id === sectionId || String(a.section_name).toLowerCase() === String(sectionId).toLowerCase();
    if (!matchClass || !matchSec) continue;

    const aDate = a.assigned_date || (a.created_at ? a.created_at.slice(0, 10) : '');
    if (fromDate && aDate && aDate < fromDate) continue;
    if (toDate && aDate && aDate > toDate) continue;

    if (!fetchedAssignments.some(f => f.id === a.id)) {
      fetchedAssignments.push({
        id: a.id,
        teacher_id: a.teacher_id,
        teacher_name: a.teacher_name,
        subject_id: a.subject_id || undefined,
        subject_name: a.subject_name,
        title: a.title,
        assigned_date: aDate,
        due_date: a.due_date,
        created_at: a.created_at
      });
    }
  }

  // 5. Match fetched assignments to teachers
  for (const fa of fetchedAssignments) {
    const key = `${fa.teacher_id}:${fa.subject_id || ''}`;
    let match = seenTeacherSubject.get(key);
    if (!match) {
      match = Array.from(seenTeacherSubject.values()).find(e => e.teacher_id === fa.teacher_id);
    }

    if (match) {
      match.assignments.push({
        id: fa.id,
        title: fa.title,
        assigned_date: fa.assigned_date,
        due_date: fa.due_date,
        created_at: fa.created_at
      });
      match.assignment_count = match.assignments.length;
    } else {
      const newEntry: TeacherAssignmentOverview = {
        school_id: schoolId,
        class_id: classId,
        section_id: sectionId,
        subject_id: fa.subject_id || 'general',
        subject_name: fa.subject_name || 'General',
        teacher_id: fa.teacher_id,
        teacher_name: fa.teacher_name || 'Subject Teacher',
        role_type: 'Subject Teacher',
        is_primary: true,
        is_alternate: false,
        assignment_count: 1,
        assignments: [{
          id: fa.id,
          title: fa.title,
          assigned_date: fa.assigned_date,
          due_date: fa.due_date,
          created_at: fa.created_at
        }]
      };
      seenTeacherSubject.set(`${fa.teacher_id}:${fa.subject_id || 'general'}`, newEntry);
      result.push(newEntry);
    }
  }

  return result.sort((a, b) => {
    const sCmp = a.subject_name.localeCompare(b.subject_name);
    if (sCmp !== 0) return sCmp;
    return a.teacher_name.localeCompare(b.teacher_name);
  });
}

// ─────────────────────────────────────────────────────────────
// CLASS MENTOR: RESULT PUBLISH & EXAM MARKS MANAGEMENT
// ─────────────────────────────────────────────────────────────

let schemaEnsured = false;
export async function ensureStudentExamsSchema() {
  if (schemaEnsured || !isPostgresConfigured) return;
  try {
    await pool.query(`
      ALTER TABLE student_exams ADD COLUMN IF NOT EXISTS section_id UUID;
      ALTER TABLE student_exams ADD COLUMN IF NOT EXISTS created_by UUID;
      ALTER TABLE student_exams ADD COLUMN IF NOT EXISTS term VARCHAR(50);
      ALTER TABLE student_exams ADD COLUMN IF NOT EXISTS academic_year_id UUID;
      ALTER TABLE student_exams ADD COLUMN IF NOT EXISTS grading_system VARCHAR(20) DEFAULT 'MARKS';
    `);
    schemaEnsured = true;
  } catch (_e) {}
}

/**
 * Resolve an academic session string (e.g. '2026-2027' or UUID) to an academic_years.id UUID.
 * Returns null when 'all'/'all sessions' is explicitly requested or no active year exists.
 */
export async function resolveAcademicYearId(schoolId: string, rawSession?: string): Promise<string | null> {
  if (!isPostgresConfigured || !schoolId) return null;
  const trimmed = String(rawSession || '').trim();
  if (trimmed && /^all(\s+sessions?)?$/i.test(trimmed)) {
    return null;
  }
  try {
    if (trimmed) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
      if (isUuid) return trimmed;
      const ayList = await pool.query(
        `SELECT id, name FROM academic_years WHERE school_id = $1::uuid`,
        [schoolId]
      );
      if (ayList.rowCount && ayList.rowCount > 0) {
        const cleanSessionName = trimmed.replace(/\b(academic\s+)?sessions?\b/gi, '').trim();
        const matched = ayList.rows.find((r: any) =>
          String(r.id) === trimmed ||
          isSameSession(r.name, trimmed) ||
          isSameSession(r.name, cleanSessionName) ||
          toCanonicalSession(r.name) === toCanonicalSession(trimmed) ||
          toCanonicalSession(r.name) === toCanonicalSession(cleanSessionName)
        );
        if (matched) {
          return matched.id;
        }
      }
      return '00000000-0000-0000-0000-000000000000';
    }

    const activeAy = await pool.query(
      `SELECT id FROM academic_years WHERE school_id = $1::uuid AND is_active = true LIMIT 1`,
      [schoolId]
    );
    if (activeAy.rowCount && activeAy.rowCount > 0) {
      return activeAy.rows[0].id;
    }
  } catch (err: any) {
    console.warn('[resolveAcademicYearId] DB Error:', err.message);
  }
  return null;
}

/**
 * 5. Class Mentor: Get all exams and assessments published for this class/section
 */
export async function getMentoredExams(schoolId: string, classId: string, sectionId?: string, session?: string) {
  await ensureStudentExamsSchema();

  const isClassUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(classId);
  const rawClassNum = isClassUuid ? null : parseInt(String(classId).replace(/\D/g, ''), 10);
  const classNum = (rawClassNum !== null && !isNaN(rawClassNum) && rawClassNum >= -1 && rawClassNum <= 30) ? rawClassNum : null;
  const isSecUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(sectionId || ''));
  const targetYearId = await resolveAcademicYearId(schoolId, session);

  if (isPostgresConfigured) {
    try {
      const q = await pool.query(
        `SELECT e.id, e.title, e.exam_date, e.start_time, e.end_time, e.room,
                e.total_marks, e.passing_marks, e.section_id, e.class_id, e.subject_id,
                e.academic_year_id,
                COALESCE(e.grading_system, 'MARKS') AS grading_system,
                e.term,
                COALESCE(sub.name, 'General') AS subject_name,
                COUNT(r.id)::int AS graded_count,
                ROUND(AVG(r.marks_obtained), 1) AS avg_marks,
                MAX(r.marks_obtained) AS max_marks,
                MIN(r.marks_obtained) AS min_marks,
                COUNT(CASE WHEN r.marks_obtained >= e.passing_marks THEN 1 END)::int AS pass_count
         FROM student_exams e
         LEFT JOIN subjects sub ON sub.id = e.subject_id
         LEFT JOIN student_exam_results r ON r.exam_id = e.id
         WHERE e.school_id = $1
           AND (
             ($2::boolean = true AND e.class_id = $3::uuid)
             OR ($4::smallint IS NOT NULL AND e.class_id IN (SELECT id FROM classes WHERE school_id = $1 AND class_number = $4::smallint))
           )
           AND (
             $5::uuid IS NULL 
             OR e.section_id IS NULL 
             OR e.section_id = $5::uuid
             OR ($6::text IS NOT NULL AND e.section_id IN (SELECT id FROM sections WHERE school_id = $1 AND UPPER(name) = UPPER($6::text)))
           )
           AND (
             $7::uuid IS NULL
             OR e.academic_year_id = $7::uuid
             OR (
               e.academic_year_id IS NULL
               AND EXISTS (
                 SELECT 1 FROM student_exam_results r2
                 JOIN students st2 ON st2.id = r2.student_id
                 WHERE r2.exam_id = e.id AND st2.academic_year_id = $7::uuid
               )
             )
           )
         GROUP BY e.id, e.academic_year_id, e.grading_system, e.term, sub.name
         ORDER BY e.exam_date DESC, e.created_at DESC`,
        [
          schoolId,
          isClassUuid,
          isClassUuid ? classId : null,
          classNum,
          isSecUuid ? sectionId : null,
          sectionId || null,
          targetYearId
        ]
      );
      if (q.rows) return q.rows;
    } catch (err: any) {
      console.error('[getMentoredExams] DB Error:', err.message);
    }
  }

  // Fallback to inMemory store
  return inMemoryStudentExams
    .filter((e) => (e.school_id === schoolId || !schoolId) && (e.class_id === classId || !classId))
    .map((e) => {
      const results = inMemoryExamResults.filter((r) => r.exam_id === e.id);
      const gradedCount = results.length;
      const avg = gradedCount > 0 ? Number((results.reduce((s, r) => s + r.marks_obtained, 0) / gradedCount).toFixed(1)) : 0;
      const passCount = results.filter((r) => r.marks_obtained >= e.passing_marks).length;
      return {
        ...e,
        graded_count: gradedCount,
        avg_marks: avg,
        pass_count: passCount
      };
    });
}

/**
 * 6. Class Mentor: Get all students in mentored section along with their existing marks for this exam
 */
export async function getMentoredSectionStudentsWithMarks(
  schoolId: string,
  classId: string,
  sectionId: string,
  examId?: string,
  session?: string
) {
  await ensureStudentExamsSchema();

  const isClassUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(classId);
  const rawClassNum = isClassUuid ? null : parseInt(String(classId).replace(/\D/g, ''), 10);
  const classNum = (rawClassNum !== null && !isNaN(rawClassNum) && rawClassNum >= -1 && rawClassNum <= 30) ? rawClassNum : null;
  const isSecUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sectionId);
  const isExamUuid = examId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(examId);
  const targetYearId = await resolveAcademicYearId(schoolId, session);

  let examDetails: any = null;
  let students: any[] = [];
  let dbQuerySucceeded = false;

  if (isPostgresConfigured) {
    try {
      // 1. If examId provided, fetch exam details
      if (isExamUuid) {
        const exQ = await pool.query(
          `SELECT e.*, COALESCE(sub.name, 'General') AS subject_name
           FROM student_exams e
           LEFT JOIN subjects sub ON sub.id = e.subject_id
           WHERE e.id = $1 AND e.school_id = $2`,
          [examId, schoolId]
        );
        if (exQ.rowCount && exQ.rows.length > 0) {
          examDetails = exQ.rows[0];
        }
      }

      const effectiveYearId = examDetails?.academic_year_id || targetYearId;

      let resolvedClassNum: number | null = classNum;
      let resolvedSecName: string = String(sectionId || '').replace(/section\s*/i, '').trim().toUpperCase();

      if (isClassUuid && resolvedClassNum === null) {
        try {
          const cRow = await pool.query(
            `SELECT class_number FROM classes WHERE id = $1 AND school_id = $2 LIMIT 1`,
            [classId, schoolId]
          );
          if (cRow.rowCount && cRow.rows.length > 0) {
            resolvedClassNum = Number(cRow.rows[0].class_number);
          }
        } catch (_e) {}
      }

      if (isSecUuid) {
        try {
          const sRow = await pool.query(
            `SELECT name FROM sections WHERE id = $1 AND school_id = $2 LIMIT 1`,
            [sectionId, schoolId]
          );
          if (sRow.rowCount && sRow.rows.length > 0) {
            resolvedSecName = String(sRow.rows[0].name || '').trim().toUpperCase();
          }
        } catch (_e) {}
      }

      // 2. Fetch all students for this class, section, and academic session with their existing marks
      const classUuidVal = isClassUuid ? classId : '00000000-0000-0000-0000-000000000000';
      const secUuidVal = isSecUuid ? sectionId : '00000000-0000-0000-0000-000000000000';
      const examUuidVal = isExamUuid ? examId : null;

      const stQ = await pool.query(
        `SELECT st.id AS student_id, st.name, st.roll_number, st.admission_number, st.photo_url, st.email,
                st.academic_year_id,
                r.id AS result_id, r.marks_obtained, r.grade, r.remarks, r.created_at AS published_at
         FROM students st
         LEFT JOIN student_exam_results r ON r.student_id = st.id AND ($4::uuid IS NOT NULL AND r.exam_id = $4::uuid)
         WHERE st.school_id = $1::uuid
           AND (
             st.class_id = $2::uuid
             OR ($3::smallint IS NOT NULL AND st.class_id IN (SELECT id FROM classes WHERE school_id = $1::uuid AND class_number = $3::smallint))
           )
           AND (
             st.section_id = $5::uuid
             OR ($6::text IS NOT NULL AND st.section_id IN (SELECT id FROM sections WHERE school_id = $1::uuid AND (UPPER(name) = UPPER($6::text) OR LOWER(name) = LOWER($6::text))))
           )
           AND ($7::uuid IS NULL OR st.academic_year_id = $7::uuid)
           AND (st.is_active IS NULL OR st.is_active = true)
         ORDER BY LPAD(COALESCE(st.roll_number, '0'), 5, '0') ASC, st.name ASC`,
        [
          schoolId,
          classUuidVal,
          resolvedClassNum,
          examUuidVal,
          secUuidVal,
          resolvedSecName,
          effectiveYearId
        ]
      );
      dbQuerySucceeded = true;
      if (stQ.rows && stQ.rows.length > 0) {
        const uniqueMap = new Map<string, any>();
        for (const s of stQ.rows) {
          const roll = String(s.roll_number || '').trim();
          const key = roll ? `roll:${roll}` : `id:${s.student_id}`;
          if (!uniqueMap.has(key)) uniqueMap.set(key, s);
        }
        students = Array.from(uniqueMap.values());
        students.sort((a, b) => String(a.roll_number || '').localeCompare(String(b.roll_number || ''), undefined, { numeric: true }));
      }
    } catch (err: any) {
      console.error('[getMentoredSectionStudentsWithMarks] DB Error:', err.message);
    }
  }

  // Fallback to demoStudents only if DB query did not run/succeed
  if (!dbQuerySucceeded && students.length === 0) {
    const demo = demoStudents.filter((s: any) => {
      const matchSchool = (s.school_id && isSameSchool(s.school_id, schoolId)) || (s.schoolId && isSameSchool(s.schoolId, schoolId));
      const sCls = String(s.class_id || s.classId || s.class_number || s.className || '');
      const sSec = String(s.section_id || s.sectionId || s.section_name || s.section || '');
      return matchSchool && (sCls === classId || sCls.includes(String(classNum))) && (!sectionId || sSec.toLowerCase().includes(sectionId.toLowerCase()));
    });

    students = demo.map((s: any) => {
      const res = inMemoryExamResults.find((r) => r.student_id === s.id && r.exam_id === examId);
      return {
        student_id: s.id,
        name: s.name || s.fullName,
        roll_number: s.roll_number || s.rollNumber || '1',
        admission_number: s.admission_number || s.admissionNumber || `ADM-${s.id}`,
        photo_url: s.photo_url || s.photoUrl || null,
        marks_obtained: res ? res.marks_obtained : null,
        grade: res ? res.grade : null,
        remarks: res ? res.remarks : null
      };
    });
  }

  return {
    exam: examDetails,
    students
  };
}

/**
 * 7. Class Mentor: Save assessment and publish marks to student portal
 */
export async function publishExamResults(
  schoolId: string,
  teacherId: string,
  payload: {
    examId?: string;
    classId: string;
    sectionId?: string;
    subjectId?: string;
    title: string;
    examDate: string;
    totalMarks: number;
    passingMarks: number;
    room?: string;
    gradingSystem?: string;
    session?: string;
    academicYearId?: string;
    results: Array<{
      studentId: string;
      marksObtained: number | null | undefined;
      grade?: string;
      remarks?: string;
    }>;
  }
) {
  await ensureStudentExamsSchema();

  const {
    examId,
    classId,
    sectionId,
    subjectId,
    title,
    examDate,
    totalMarks,
    passingMarks,
    room,
    gradingSystem,
    session,
    academicYearId,
    results
  } = payload;
  const rawResults = results || (payload as any).marks || [];
  const system = gradingSystem || (payload as any).grading_system || 'MARKS';
  const rawYearId = await resolveAcademicYearId(schoolId, academicYearId || session);
  const resolvedAcademicYearId = (rawYearId && rawYearId !== '00000000-0000-0000-0000-000000000000') ? rawYearId : null;

  if (!title) {
    throw new Error('Title is required');
  }
  const resolvedExamDate = examDate || new Date().toISOString().slice(0, 10);

  let resolvedExamId = examId;

  // Resolve classId UUID if numeric passed
  let resolvedClassId = classId;
  const isClassUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(classId);
  if (!isClassUuid && isPostgresConfigured) {
    const classNum = parseInt(String(classId).replace(/\D/g, ''), 10);
    if (!isNaN(classNum)) {
      const cQ = await pool.query(`SELECT id FROM classes WHERE school_id = $1 AND class_number = $2 LIMIT 1`, [schoolId, classNum]);
      if (cQ.rowCount && cQ.rows.length > 0) {
        resolvedClassId = cQ.rows[0].id;
      }
    }
  }

  // Resolve sectionId UUID if section name passed
  let resolvedSectionId = sectionId || null;
  const isSecUuid = sectionId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sectionId);
  if (sectionId && !isSecUuid && isPostgresConfigured) {
    const sQ = await pool.query(`SELECT id FROM sections WHERE school_id = $1 AND UPPER(name) = UPPER($2) LIMIT 1`, [schoolId, sectionId]);
    if (sQ.rowCount && sQ.rows.length > 0) {
      resolvedSectionId = sQ.rows[0].id;
    }
  }

  // Helper function to calculate letter grade if not manually set
  const calculateGrade = (obtained: number, total: number) => {
    const pct = total > 0 ? (obtained / total) * 100 : 0;
    if (pct >= 90) return 'A+';
    if (pct >= 75) return 'A';
    if (pct >= 60) return 'B';
    if (pct >= 40) return 'C';
    return 'F';
  };

  if (isPostgresConfigured) {
    // 1. Create or Update Exam in student_exams
    if (resolvedExamId) {
      const upQ = await pool.query(
        `UPDATE student_exams 
         SET title = $1, subject_id = $2, exam_date = $3, total_marks = $4, passing_marks = $5, room = $6, section_id = $7, grading_system = $8,
             academic_year_id = COALESCE($11, academic_year_id)
         WHERE id = $9 AND school_id = $10
         RETURNING *`,
        [title, subjectId || null, resolvedExamDate, totalMarks || 100, passingMarks || 40, room || 'Main Hall', resolvedSectionId, system, resolvedExamId, schoolId, resolvedAcademicYearId]
      );
      if (upQ.rowCount && upQ.rows.length > 0) {
        resolvedExamId = upQ.rows[0].id;
      }
    } else {
      const inQ = await pool.query(
        `INSERT INTO student_exams (school_id, class_id, section_id, subject_id, title, exam_date, start_time, end_time, room, total_marks, passing_marks, created_by, grading_system, academic_year_id)
         VALUES ($1, $2, $3, $4, $5, $6, '09:00', '12:00', $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [schoolId, resolvedClassId, resolvedSectionId, subjectId || null, title, resolvedExamDate, room || 'Main Hall', totalMarks || 100, passingMarks || 40, teacherId, system, resolvedAcademicYearId]
      );
      if (inQ.rowCount && inQ.rows.length > 0) {
        resolvedExamId = inQ.rows[0].id;
      }
    }

    // 2. Insert or update student marks
    let publishedCount = 0;
    if (Array.isArray(rawResults) && resolvedExamId) {
      for (const item of rawResults) {
        const hasMarks = item.marksObtained !== null && item.marksObtained !== undefined && String(item.marksObtained).trim() !== '' && !isNaN(Number(item.marksObtained));
        const hasGrade = item.grade && String(item.grade).trim() !== '';
        if (hasMarks || hasGrade) {
          const marks = hasMarks ? Number(item.marksObtained) : null;
          const grade = hasGrade ? item.grade : calculateGrade(marks || 0, totalMarks || 100);
          const remarks = item.remarks || (hasMarks && (marks || 0) >= (passingMarks || 40) ? 'Good performance' : (item.remarks || 'Evaluated'));

          await pool.query(
            `INSERT INTO student_exam_results (school_id, exam_id, student_id, marks_obtained, grade, remarks)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (exam_id, student_id)
             DO UPDATE SET marks_obtained = EXCLUDED.marks_obtained, grade = EXCLUDED.grade, remarks = EXCLUDED.remarks, created_at = NOW()`,
            [schoolId, resolvedExamId, item.studentId, marks, grade, remarks]
          );
          publishedCount++;
        }
      }
    }

    // Mirror to in-memory cache for immediate multi-store sync
    if (resolvedExamId) {
      const existingExamIdx = inMemoryStudentExams.findIndex(e => e.id === resolvedExamId);
      const examObj = {
        id: resolvedExamId,
        school_id: schoolId,
        class_id: resolvedClassId,
        section_id: resolvedSectionId || undefined,
        subject_id: subjectId,
        subject_name: (payload as any).subjectName || 'General',
        title,
        exam_date: examDate,
        start_time: '09:00',
        end_time: '12:00',
        room: room || 'Main Hall',
        total_marks: totalMarks || 100,
        passing_marks: passingMarks || 40,
        grading_system: system,
        created_at: new Date().toISOString()
      };
      if (existingExamIdx >= 0) {
        inMemoryStudentExams[existingExamIdx] = examObj;
      } else {
        inMemoryStudentExams.push(examObj);
      }

      for (const item of rawResults) {
        const hasMarks = item.marksObtained !== null && item.marksObtained !== undefined && String(item.marksObtained).trim() !== '' && !isNaN(Number(item.marksObtained));
        const hasGrade = item.grade && String(item.grade).trim() !== '';
        if (hasMarks || hasGrade) {
          const marks = hasMarks ? Number(item.marksObtained) : null;
          const grade = hasGrade ? item.grade : calculateGrade(marks || 0, totalMarks || 100);
          const remarks = item.remarks || (hasMarks && (marks || 0) >= (passingMarks || 40) ? 'Good performance' : 'Evaluated');
          const exResIdx = inMemoryExamResults.findIndex(r => r.exam_id === resolvedExamId && r.student_id === item.studentId);
          const resObj = {
            id: `res-${resolvedExamId}-${item.studentId}`,
            school_id: schoolId,
            exam_id: resolvedExamId,
            student_id: item.studentId,
            marks_obtained: marks,
            grade,
            remarks,
            created_at: new Date().toISOString()
          };
          if (exResIdx >= 0) inMemoryExamResults[exResIdx] = resObj;
          else inMemoryExamResults.push(resObj);
        }
      }
    }

    return {
      success: true,
      examId: resolvedExamId,
      publishedCount,
      message: `Published results for ${publishedCount} students successfully`
    };
  }

  // In-memory fallback
  let resolvedSubName = (payload as any).subjectName || '';
  if (!resolvedSubName && subjectId) {
    const sFound = demoSubjects.find((s) => s.id === subjectId);
    if (sFound) resolvedSubName = sFound.name;
  }

  const newExam: InMemoryExam = {
    id: resolvedExamId || `ex-${Date.now()}`,
    school_id: schoolId,
    class_id: classId,
    section_id: sectionId,
    subject_id: subjectId,
    subject_name: resolvedSubName || 'General',
    title,
    exam_date: examDate,
    start_time: '09:00',
    end_time: '12:00',
    room: room || 'Main Hall',
    total_marks: totalMarks,
    passing_marks: passingMarks || 40,
    created_at: new Date().toISOString()
  };
  const exIdx = inMemoryStudentExams.findIndex((e) => e.id === newExam.id);
  if (exIdx >= 0) inMemoryStudentExams[exIdx] = newExam;
  else inMemoryStudentExams.push(newExam);

  let memPublished = 0;
  for (const item of rawResults) {
    if (item.marksObtained !== null && item.marksObtained !== undefined && String(item.marksObtained).trim() !== '') {
      const marks = Number(item.marksObtained);
      const grade = item.grade || calculateGrade(marks, totalMarks);
      const rIdx = inMemoryExamResults.findIndex((r) => r.exam_id === newExam.id && r.student_id === item.studentId);
      const resEntry: InMemoryExamResult = {
        id: `res-${Date.now()}-${item.studentId}`,
        school_id: schoolId,
        exam_id: newExam.id,
        student_id: item.studentId,
        marks_obtained: marks,
        grade,
        remarks: item.remarks || 'Verified by Class Mentor',
        created_at: new Date().toISOString()
      };
      if (rIdx >= 0) inMemoryExamResults[rIdx] = resEntry;
      else inMemoryExamResults.push(resEntry);
      memPublished++;
    }
  }

  return {
    success: true,
    examId: newExam.id,
    publishedCount: memPublished,
    message: `Published results for ${memPublished} students successfully`
  };
}

/**
 * 8. Class Mentor: Delete an examination and all associated student marks
 */
export async function deleteMentoredExam(schoolId: string, examId: string) {
  if (isPostgresConfigured) {
    await pool.query(`DELETE FROM student_exams WHERE id = $1 AND school_id = $2`, [examId, schoolId]);
  }
  const idx = inMemoryStudentExams.findIndex((e) => e.id === examId && (e.school_id === schoolId || !schoolId));
  if (idx >= 0) inMemoryStudentExams.splice(idx, 1);
  const rIdxs = inMemoryExamResults.filter((r) => r.exam_id === examId);
  rIdxs.forEach((r) => {
    const i = inMemoryExamResults.indexOf(r);
    if (i >= 0) inMemoryExamResults.splice(i, 1);
  });
  return { success: true };
}
