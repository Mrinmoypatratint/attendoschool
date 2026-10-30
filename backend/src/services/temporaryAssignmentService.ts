// Temporary Assignment Service
// Provides CRUD operations for temporary class-teacher assignments.
// Mirrors patterns from mentorService.ts: uses PostgreSQL when configured,
// otherwise falls back to an in-memory store for demo / test mode.

import { pool, isPostgresConfigured } from "../db";
import { demoClasses, demoSections, demoTeachers } from "../routes/schoolData";
import { demoSchools } from "../routes/superAdmin";
import { isSameSchool } from "../utils/tenant";

export interface TemporaryAssignmentRecord {
  id: string;
  school_id: string;
  class_id: string;
  section_id: string;
  teacher_id: string;
  start_at: string; // ISO timestamp
  end_at: string;   // ISO timestamp
  created_at: string;
  updated_at: string;
  status?: 'active' | 'future' | 'past';
  teacher_name?: string;
  teacher_email?: string;
  class_number?: number;
  section_name?: string;
}

// In-memory fallback (used when PostgreSQL is not configured)
export const inMemoryTemporaryAssignments: TemporaryAssignmentRecord[] = [];

/** Helper: validate that end > start */
function validatePeriod(start: Date, end: Date) {
  if (end <= start) {
    throw new Error("end_at must be later than start_at");
  }
}

/** Helper: calculate status from dates */
function calculateStatus(startAt: Date | string, endAt: Date | string): 'active' | 'future' | 'past' {
  const now = new Date();
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (start <= now && end > now) return 'active';
  if (start > now) return 'future';
  return 'past';
}

/**
 * Create a temporary assignment.
 * Throws a clear error if the exclusion constraint (overlap) is violated.
 */
export async function createTemporaryAssignment(params: {
  schoolId: string;
  classId: string;
  sectionId: string;
  teacherId: string;
  startAt: Date | string;
  endAt: Date | string;
}): Promise<TemporaryAssignmentRecord> {
  const { schoolId, classId, sectionId, teacherId, startAt, endAt } = params;
  if (!schoolId || !classId || !sectionId || !teacherId || !startAt || !endAt) {
    throw new Error(
      "schoolId, classId, sectionId, teacherId, startAt and endAt are required",
    );
  }
  const start = new Date(startAt);
  const end = new Date(endAt);
  validatePeriod(start, end);

  // When using PostgreSQL
  if (isPostgresConfigured) {
    const client = await pool.connect();
    try {
      // 1. Verify school exists
      const schoolRes = await client.query(
        `SELECT 1 FROM schools WHERE id = $1`,
        [schoolId],
      );
      if (schoolRes.rowCount === 0) {
        throw new Error(`School ${schoolId} does not exist`);
      }

      // 2. Verify class exists and belongs to school
      const classRes = await client.query(
        `SELECT id, class_number FROM classes WHERE id = $1 AND school_id = $2`,
        [classId, schoolId],
      );
      if (classRes.rowCount === 0) {
        throw new Error(`Class ${classId} does not exist in school ${schoolId}`);
      }

      // 3. Verify section exists and belongs to class
      const sectionRes = await client.query(
        `SELECT id, name FROM sections WHERE id = $1 AND class_id = $2`,
        [sectionId, classId],
      );
      if (sectionRes.rowCount === 0) {
        throw new Error(`Section ${sectionId} does not belong to class ${classId}`);
      }

      // 4. Verify teacher exists and belongs to school
      const teacherRes = await client.query(
        `SELECT id, name, email FROM users WHERE id = $1 AND (school_id = $2 OR role = 'SUPER_ADMIN')`,
        [teacherId, schoolId],
      );
      if (teacherRes.rowCount === 0) {
        throw new Error(`Teacher ${teacherId} does not exist or does not belong to school`);
      }

      await client.query("BEGIN");
      const res = await client.query(
        `INSERT INTO temporary_class_assignments
          (school_id, class_id, section_id, teacher_id, start_at, end_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING *`,
        [
          schoolId,
          classId,
          sectionId,
          teacherId,
          start.toISOString(),
          end.toISOString(),
        ],
      );
      await client.query("COMMIT");

      const row = res.rows[0];
      const status = calculateStatus(row.start_at, row.end_at);
      const teacherRow = teacherRes.rows[0];
      const classRow = classRes.rows[0];
      const sectionRow = sectionRes.rows[0];

      return {
        ...row,
        status,
        teacher_name: teacherRow?.name,
        teacher_email: teacherRow?.email,
        class_number: classRow?.class_number,
        section_name: sectionRow?.name,
      } as TemporaryAssignmentRecord;
    } catch (err: any) {
      try {
        await client.query("ROLLBACK");
      } catch {}
      if (err.code === "23P01") {
        throw new Error(
          "Overlapping temporary assignment exists for this school/class/section",
        );
      }
      console.error(
        "[TemporaryAssignmentService] DB error on create:",
        err.message,
      );
      throw err;
    } finally {
      client.release();
    }
  }

  // In-memory fallback against demo data
  const school = demoSchools.find((s) => s.id === schoolId);
  if (!school) throw new Error(`School ${schoolId} does not exist (in-memory)`);
  const cls = demoClasses.find((c) => c.id === classId && c.school_id === schoolId);
  if (!cls) throw new Error(`Class ${classId} does not exist in school ${schoolId} (in-memory)`);
  const sec = demoSections.find((s) => s.id === sectionId && s.class_id === classId);
  if (!sec) throw new Error(`Section ${sectionId} does not belong to class ${classId} (in-memory)`);
  const teacher = demoTeachers.find((t) => t.id === teacherId);
  if (!teacher) throw new Error(`Teacher ${teacherId} does not exist (in-memory)`);

  const overlaps = inMemoryTemporaryAssignments.some((a) => {
    return (
      isSameSchool(a.school_id, schoolId) &&
      a.class_id === classId &&
      a.section_id === sectionId &&
      !(end <= new Date(a.start_at) || start >= new Date(a.end_at))
    );
  });
  if (overlaps) {
    throw new Error(
      "Overlapping temporary assignment exists for this school/class/section (in-memory)",
    );
  }
  const status = calculateStatus(start, end);
  const rec: TemporaryAssignmentRecord = {
    id: `ta-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    school_id: schoolId,
    class_id: classId,
    section_id: sectionId,
    teacher_id: teacherId,
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status,
    teacher_name: teacher.name,
    teacher_email: teacher.email,
    class_number: cls.class_number,
    section_name: sec.name,
  };
  inMemoryTemporaryAssignments.push(rec);
  return rec;
}

/** List temporary assignments scoped to a school with optional filters */
export async function listTemporaryAssignments(
  schoolId: string,
  filters?: {
    classId?: string;
    sectionId?: string;
    teacherId?: string;
    status?: "active" | "future" | "past";
  },
): Promise<TemporaryAssignmentRecord[]> {
  if (!schoolId) {
    throw new Error("schoolId is required");
  }

  const where: string[] = ["tca.school_id = $1"];
  const params: any[] = [schoolId];
  let idx = 2;
  if (filters?.classId) {
    where.push(`tca.class_id = $${idx++}`);
    params.push(filters.classId);
  }
  if (filters?.sectionId) {
    where.push(`tca.section_id = $${idx++}`);
    params.push(filters.sectionId);
  }
  if (filters?.teacherId) {
    where.push(`tca.teacher_id = $${idx++}`);
    params.push(filters.teacherId);
  }
  if (filters?.status) {
    const now = "NOW()";
    if (filters.status === "active") {
      where.push(`tca.start_at <= ${now} AND tca.end_at > ${now}`);
    } else if (filters.status === "future") {
      where.push(`tca.start_at > ${now}`);
    } else if (filters.status === "past") {
      where.push(`tca.end_at <= ${now}`);
    }
  }

  const sql = `SELECT tca.*,
    CASE
      WHEN tca.start_at <= NOW() AND tca.end_at > NOW() THEN 'active'
      WHEN tca.start_at > NOW() THEN 'future'
      ELSE 'past'
    END AS status,
    u.name AS teacher_name,
    u.email AS teacher_email,
    c.class_number,
    sec.name AS section_name
  FROM temporary_class_assignments tca
  LEFT JOIN users u ON u.id = tca.teacher_id
  LEFT JOIN classes c ON c.id = tca.class_id
  LEFT JOIN sections sec ON sec.id = tca.section_id
  WHERE ${where.join(" AND ")}
  ORDER BY tca.start_at DESC`;

  if (isPostgresConfigured) {
    const q = await pool.query(sql, params);
    return q.rows as TemporaryAssignmentRecord[];
  }

  // In-memory fallback - filter the array
  const now = new Date();
  return inMemoryTemporaryAssignments
    .filter((a) => {
      if (!isSameSchool(a.school_id, schoolId)) return false;
      if (filters?.classId && a.class_id !== filters.classId) return false;
      if (filters?.sectionId && a.section_id !== filters.sectionId) return false;
      if (filters?.teacherId && a.teacher_id !== filters.teacherId) return false;
      const start = new Date(a.start_at);
      const end = new Date(a.end_at);
      if (filters?.status === "active" && !(start <= now && end > now))
        return false;
      if (filters?.status === "future" && !(start > now)) return false;
      if (filters?.status === "past" && !(end <= now)) return false;
      return true;
    })
    .map((a) => {
      const status = calculateStatus(a.start_at, a.end_at);
      const teacher = demoTeachers.find((t) => t.id === a.teacher_id);
      const cls = demoClasses.find((c) => c.id === a.class_id);
      const sec = demoSections.find((s) => s.id === a.section_id);
      return {
        ...a,
        status,
        teacher_name: teacher?.name,
        teacher_email: teacher?.email,
        class_number: cls?.class_number,
        section_name: sec?.name,
      } as TemporaryAssignmentRecord;
    });
}

/** Update permitted fields of a temporary assignment */
export async function updateTemporaryAssignment(
  assignmentId: string,
  schoolId: string,
  updates: {
    startAt?: Date | string;
    endAt?: Date | string;
    teacherId?: string;
  },
): Promise<TemporaryAssignmentRecord> {
  if (!assignmentId || !schoolId) {
    throw new Error("assignmentId and schoolId are required");
  }
  const setClauses: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (updates.startAt) {
    const start = new Date(updates.startAt);
    setClauses.push(`start_at = $${idx++}`);
    params.push(start.toISOString());
  }
  if (updates.endAt) {
    const end = new Date(updates.endAt);
    setClauses.push(`end_at = $${idx++}`);
    params.push(end.toISOString());
  }
  if (updates.teacherId) {
    setClauses.push(`teacher_id = $${idx++}`);
    params.push(updates.teacherId);
  }
  if (setClauses.length === 0) {
    throw new Error("At least one updatable field must be provided");
  }
  setClauses.push(`updated_at = NOW()`);

  if (updates.startAt && updates.endAt) {
    const start = new Date(updates.startAt);
    const end = new Date(updates.endAt);
    validatePeriod(start, end);
  }

  const sql = `UPDATE temporary_class_assignments
    SET ${setClauses.join(", ")}
    WHERE id = $${idx++} AND school_id = $${idx++}
    RETURNING *`;
  params.push(assignmentId, schoolId);

  if (isPostgresConfigured) {
    try {
      const q = await pool.query(sql, params);
      if (q.rowCount === 0) {
        throw new Error("Temporary assignment not found or school mismatch");
      }
      const row = q.rows[0];
      const status = calculateStatus(row.start_at, row.end_at);
      return { ...row, status } as TemporaryAssignmentRecord;
    } catch (err: any) {
      if (err.code === "23P01") {
        throw new Error(
          "Overlapping temporary assignment would result from this update",
        );
      }
      console.error(
        "[TemporaryAssignmentService] DB error on update:",
        err.message,
      );
      throw err;
    }
  }

  // In-memory fallback
  const idxInMem = inMemoryTemporaryAssignments.findIndex(
    (a) => a.id === assignmentId && isSameSchool(a.school_id, schoolId),
  );
  if (idxInMem === -1) {
    throw new Error("Temporary assignment not found or school mismatch (in-memory)");
  }
  const existing = { ...inMemoryTemporaryAssignments[idxInMem] };
  const newStart = updates.startAt
    ? new Date(updates.startAt).toISOString()
    : existing.start_at;
  const newEnd = updates.endAt
    ? new Date(updates.endAt).toISOString()
    : existing.end_at;
  const overlap = inMemoryTemporaryAssignments.some((a) => {
    if (a.id === assignmentId) return false;
    return (
      isSameSchool(a.school_id, schoolId) &&
      a.class_id === existing.class_id &&
      a.section_id === existing.section_id &&
      !(new Date(newEnd) <= new Date(a.start_at) || new Date(newStart) >= new Date(a.end_at))
    );
  });
  if (overlap) {
    throw new Error(
      "Overlapping temporary assignment would result from this update (in-memory)",
    );
  }
  const updated = {
    ...existing,
    start_at: newStart,
    end_at: newEnd,
    teacher_id: updates.teacherId ?? existing.teacher_id,
    updated_at: new Date().toISOString(),
    status: calculateStatus(newStart, newEnd),
  };
  inMemoryTemporaryAssignments[idxInMem] = updated;
  return updated;
}

/** End an assignment early - sets end_at to NOW */
export async function endTemporaryAssignment(
  assignmentId: string,
  schoolId: string,
): Promise<TemporaryAssignmentRecord> {
  if (!assignmentId || !schoolId) {
    throw new Error("assignmentId and schoolId are required");
  }
  if (isPostgresConfigured) {
    const q = await pool.query(
      `UPDATE temporary_class_assignments
         SET end_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND school_id = $2
         RETURNING *`,
      [assignmentId, schoolId],
    );
    if (q.rowCount === 0) {
      throw new Error("Temporary assignment not found or school mismatch");
    }
    const row = q.rows[0];
    return { ...row, status: 'past' } as TemporaryAssignmentRecord;
  }
  const idx = inMemoryTemporaryAssignments.findIndex(
    (a) => a.id === assignmentId && isSameSchool(a.school_id, schoolId),
  );
  if (idx === -1) {
    throw new Error("Temporary assignment not found or school mismatch (in-memory)");
  }
  const now = new Date().toISOString();
  inMemoryTemporaryAssignments[idx] = {
    ...inMemoryTemporaryAssignments[idx],
    end_at: now,
    updated_at: now,
    status: 'past',
  };
  return inMemoryTemporaryAssignments[idx];
}

/** Get the active temporary assignment for a given combo */
export async function getActiveTemporaryAssignment(params: {
  schoolId: string;
  classId: string;
  sectionId: string;
  teacherId: string;
}): Promise<TemporaryAssignmentRecord | null> {
  const { schoolId, classId, sectionId, teacherId } = params;
  if (!schoolId || !classId || !sectionId || !teacherId) {
    throw new Error(
      "schoolId, classId, sectionId and teacherId are required",
    );
  }
  if (isPostgresConfigured) {
    const q = await pool.query(
      `SELECT * FROM temporary_class_assignments
         WHERE school_id = $1 AND class_id = $2 AND section_id = $3 AND teacher_id = $4
           AND start_at <= NOW() AND end_at > NOW()
         LIMIT 1`,
      [schoolId, classId, sectionId, teacherId],
    );
    if (!q.rowCount) return null;
    const row = q.rows[0];
    return { ...row, status: 'active' } as TemporaryAssignmentRecord;
  }
  // In-memory fallback
  const now = new Date();
  const rec = inMemoryTemporaryAssignments.find((a) => {
    return (
      isSameSchool(a.school_id, schoolId) &&
      a.class_id === classId &&
      a.section_id === sectionId &&
      a.teacher_id === teacherId &&
      new Date(a.start_at) <= now &&
      new Date(a.end_at) > now
    );
  });
  return rec ? { ...rec, status: 'active' } : null;
}
