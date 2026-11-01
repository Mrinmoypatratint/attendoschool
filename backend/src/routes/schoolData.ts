import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { pool, isPostgresConfigured } from "../db";
import { requireAuth, requireRoles, AuthRequest } from "../middleware/auth";
import {
  registerDemoUser,
  updateDemoUserPhoto,
  getAllDemoUsers,
} from "../store/demoUsers";
import { createAndSendPasswordReset, isSameSchool, isTestSchool } from "./auth";
import { queueEmailNotification } from "../services/notificationService";
import { demoSchools } from "./superAdmin";
import { getFirestoreSchoolById } from "../services/firestoreService";
import { collections, isFirebaseConfigured } from "../firebase";
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
  rehydrateAllFromFirestore,
} from "../services/firestoreSync";
import { validatePasswordStrength } from "../utils/passwordPolicy";
import { fastCache } from "../utils/cache";
import { invalidateSchoolCache } from "../services/tenantDataService";
import {
  validateStudentUniqueness,
  preValidateBulkImport,
  normalizeAdmissionNumber,
  normalizeRollNumber,
  normalizeEmail,
  normalizePhoneNumber,
} from "../utils/studentValidation";
import {
  validateTeacherUniqueness,
  preValidateTeacherBulkImport,
  normalizeEmployeeId,
} from "../utils/teacherValidation";
import { normalizeGender } from "../utils/gender";
import { invalidateDashboardCache } from "./dashboard";
import { clearStudentDashboardCache } from "../services/studentService";
import {
  convertRomanClassToDigital,
  parseImportClassAndSection,
} from "../utils/roman";
import { assignClassMentor } from "../services/mentorService";

const isUuid = (val: any): boolean =>
  typeof val === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

const r = Router();
const admin = [requireAuth, requireRoles("SCHOOL_ADMIN")];
const reader = [
  requireAuth,
  requireRoles("SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER"),
];
export const schoolStaff = reader;

// Auto-invalidate school memory cache on any successful mutation (POST, PUT, DELETE)
r.use((req: any, res: any, next: any) => {
  if (req.method !== "GET") {
    res.on("finish", () => {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        const sid =
          req.user?.schoolId || req.body?.schoolId || req.params?.schoolId;
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
  if (!s) return "";
  const str = String(s).trim();
  const m = str.match(/(\d{4})[^\d]+(\d{2,4})/);
  if (m) {
    const y1 = m[1];
    const y2 = m[2].length === 2 ? y1.slice(0, 2) + m[2] : m[2];
    return `${y1}-${y2}`;
  }
  const single = str.match(/(\d{4})/);
  if (single) return single[1];
  return str
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

// Helper function for session matching across formats
export function isSameSession(s1?: string | null, s2?: string | null): boolean {
  if (!s1 || !s2) return false;
  if (s1 === s2) return true;
  const str1 = String(s1).trim();
  const str2 = String(s2).trim();
  if (!str1 || !str2) return false;
  if (/^all(\s+sessions?)?$/i.test(str1) || /^all(\s+sessions?)?$/i.test(str2))
    return true;
  if (str1.toLowerCase() === str2.toLowerCase()) return true;

  const c1 = toCanonicalSession(str1);
  const c2 = toCanonicalSession(str2);
  if (c1 && c2 && c1 === c2) return true;
  if (c1 && c2 && (c1.includes(c2) || c2.includes(c1))) return true;
  return (
    str1.toLowerCase().includes(str2.toLowerCase()) ||
    str2.toLowerCase().includes(str1.toLowerCase())
  );
}

// Class grades: Class-L-KG (id: cls-lkg, class_number: -1), U-KG (id: cls-ukg, class_number: 0), Class 1-12
export const CLASS_GRADES = [
  { id: "cls-lkg", class_number: -1, label: "Class L KG" },
  { id: "cls-ukg", class_number: 0, label: "Class U KG" },
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => ({
    id: `cls-${n}`,
    class_number: n,
    label: `Class ${n}`,
  })),
];

export const demoClasses: any[] = CLASS_GRADES.map((g) => ({
  id: g.id,
  class_number: g.class_number,
  label: g.label,
  section_count: 2,
  school_id: "00000000-0000-0000-0000-000000000001",
}));

export const demoSections: any[] = [];
CLASS_GRADES.forEach((g) => {
  demoSections.push({
    id: `sec-${g.id}-a`,
    class_id: g.id,
    class_number: g.class_number,
    label: g.label,
    name: "A",
    section_name: "A",
    school_id: "00000000-0000-0000-0000-000000000001",
  });
  demoSections.push({
    id: `sec-${g.id}-b`,
    class_id: g.id,
    class_number: g.class_number,
    label: g.label,
    name: "B",
    section_name: "B",
    school_id: "00000000-0000-0000-0000-000000000001",
  });
});

const ensuredSchools = new Set<string>();

/**
 * Ensures standard classes (-1 to 12) and standard sections (A, B) exist in PostgreSQL for the school.
 */
export async function ensureSchoolClassesAndSections(
  schoolId?: string | null,
): Promise<void> {
  if (!schoolId) return;
  const isSchoolUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      String(schoolId),
    );
  if (!isSchoolUuid) return;
  if (ensuredSchools.has(schoolId)) return;

  try {
    // 1. Verify school actually exists in PostgreSQL schools table to avoid foreign key errors
    const schoolExists = await pool.query(
      "SELECT id FROM schools WHERE id = $1 LIMIT 1",
      [schoolId],
    );
    if (!schoolExists.rowCount) {
      ensuredSchools.add(schoolId);
      return;
    }

    try {
      await pool.query(`
        ALTER TABLE students ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
        ALTER TABLE students ADD COLUMN IF NOT EXISTS middle_name VARCHAR(100);
        ALTER TABLE students ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);
        ALTER TABLE teacher_profiles ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
        ALTER TABLE teacher_profiles ADD COLUMN IF NOT EXISTS middle_name VARCHAR(100);
        ALTER TABLE teacher_profiles ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);
      `);
    } catch {}

    // 2. Ultra-fast path: If classes already exist in PostgreSQL including kindergarten, return immediately
    const checkExisting = await pool.query(
      "SELECT COUNT(DISTINCT class_number)::int as count FROM classes WHERE school_id = $1 AND class_number IN (-1, 0, 1, 12)",
      [schoolId],
    );
    if ((checkExisting.rows[0]?.count || 0) >= 4) {
      ensuredSchools.add(schoolId);
      return;
    }

    for (const g of CLASS_GRADES) {
      const clsRes = await pool.query(
        `INSERT INTO classes(school_id, class_number)
         VALUES($1, $2)
         ON CONFLICT (school_id, class_number) DO UPDATE SET class_number=EXCLUDED.class_number
         RETURNING id, class_number`,
        [schoolId, g.class_number],
      );
      if (clsRes.rowCount && clsRes.rows.length > 0) {
        const classId = clsRes.rows[0].id;
        for (const secName of ["A", "B"]) {
          await pool.query(
            `INSERT INTO sections(school_id, class_id, name)
             VALUES($1, $2, $3)
             ON CONFLICT (class_id, name) DO UPDATE SET name=EXCLUDED.name`,
            [schoolId, classId, secName],
          );
        }
      }
    }
  } catch (err: any) {
    console.warn("[ensureSchoolClassesAndSections] Error:", err.message);
  } finally {
    // Always mark school as checked to prevent hammering PostgreSQL or acquiring concurrent locks
    ensuredSchools.add(schoolId);
  }
}

r.get("/classes", ...reader, async (req: AuthRequest, res) => {
  const sid = req.user!.schoolId;
  const requestedYearId = String(req.query.academic_year_id || req.query.academicYearId || req.query.sessionId || "").trim();
  const requestedSession = String(req.query.session || req.query.sessionName || "").trim();

  let targetYearId: string | null = null;
  if (requestedYearId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestedYearId)) {
    targetYearId = requestedYearId;
  } else if (requestedYearId || requestedSession) {
    const term = requestedYearId || requestedSession;
    try {
      const ayRes = await pool.query(
        "SELECT id FROM academic_years WHERE school_id = $1 AND (name = $2 OR name ILIKE $3 OR code = $2) LIMIT 1",
        [sid, term, `%${term}%`]
      );
      if (ayRes.rows.length > 0) {
        targetYearId = ayRes.rows[0].id;
      }
    } catch {}
  }

  const cacheKey = targetYearId ? `classes:${sid}:${targetYearId}` : `classes:${sid}`;
  const cached = fastCache.get<any>(cacheKey);
  if (cached) return res.json(cached);

  await ensureSchoolClassesAndSections(sid);

  if (targetYearId) {
    try {
      const q = await pool.query(
        `SELECT c.id, c.class_number, COUNT(s.id)::int as section_count
         FROM classes c
         LEFT JOIN sections s ON s.class_id = c.id AND (
           (s.academic_year_id = $2)
           OR (c.academic_year_id = $2)
           OR EXISTS (SELECT 1 FROM students st WHERE st.school_id = $1 AND st.academic_year_id = $2 AND st.section_id = s.id)
           OR EXISTS (SELECT 1 FROM student_promotions sp WHERE sp.school_id = $1 AND sp.to_academic_year_id = $2 AND sp.to_section_id = s.id AND sp.status = 'CONFIRMED')
           OR EXISTS (SELECT 1 FROM student_enrollment_history_v28 seh WHERE seh.academic_year_id = $2 AND seh.section_id = s.id)
         )
         WHERE c.school_id = $1
           AND (
             (c.academic_year_id = $2)
             OR EXISTS (SELECT 1 FROM students st WHERE st.school_id = $1 AND st.academic_year_id = $2 AND st.class_id = c.id)
             OR EXISTS (SELECT 1 FROM student_promotions sp WHERE sp.school_id = $1 AND sp.to_academic_year_id = $2 AND sp.to_class_id = c.id AND sp.status = 'CONFIRMED')
             OR EXISTS (SELECT 1 FROM student_enrollment_history_v28 seh WHERE seh.academic_year_id = $2 AND seh.class_id = c.id)
           )
         GROUP BY c.id, c.class_number
         ORDER BY c.class_number`,
        [sid, targetYearId]
      );
      const list = q.rows.map((r: any) => {
        const cNum = Number(r.class_number);
        const matchGrade = CLASS_GRADES.find((g) => g.class_number === cNum);
        const lbl = matchGrade?.label || (cNum === -1 ? "Class L KG" : cNum === 0 ? "Class U KG" : `Class ${cNum}`);
        return {
          id: r.id,
          class_number: cNum,
          label: lbl,
          name: lbl,
          section_count: r.section_count,
          school_id: sid,
          academic_year_id: targetYearId,
        };
      });
      fastCache.set(cacheKey, list, 30);
      return res.json(list);
    } catch (err: any) {
      console.warn('[Classes] Scoped query error:', err.message);
    }
  }

  // Build standard class list from CLASS_GRADES — always the full L-KG → Class 12 set
  const standardClasses = CLASS_GRADES.map((g) => ({
    id: `${sid}-${g.id}`,
    class_number: g.class_number,
    label: g.label,
    section_count: 2,
    school_id: sid,
  }));

  try {
    const q = await pool.query(
      `SELECT c.id,c.class_number,COUNT(s.id)::int section_count
  FROM classes c LEFT JOIN sections s ON s.class_id=c.id
  WHERE c.school_id=$1 GROUP BY c.id ORDER BY c.class_number`,
      [sid],
    );
    if (q.rowCount && q.rows.length > 0) {
      const merged = standardClasses.map((sc) => {
        const db = q.rows.find(
          (r: any) => Number(r.class_number) === sc.class_number,
        );
        return db ? { ...sc, ...db, label: sc.label } : sc;
      });
      for (const r of q.rows) {
        if (
          !merged.some((m) => Number(m.class_number) === Number(r.class_number))
        ) {
          merged.push({
            id: r.id,
            class_number: Number(r.class_number),
            label: `Class ${r.class_number}`,
            section_count: r.section_count,
            school_id: sid,
          });
        }
      }
      merged.sort(
        (a: any, b: any) => Number(a.class_number) - Number(b.class_number),
      );
      fastCache.set(cacheKey, merged, 30);
      return res.json(merged);
    }
  } catch {}

  // Merge any Firestore classes on top
  if (isFirebaseConfigured()) {
    try {
      let snap = await collections
        .classes()
        .where("school_id", "==", sid)
        .get();
      if (snap.empty) snap = await collections.classes().get();
      if (!snap.empty) {
        const fsClasses = snap.docs
          .map((d) => {
            const data = d.data();
            const cNum = Number(data.class_number ?? data.classNumber ?? 1);
            const lbl =
              cNum === -1 ? "L-KG" : cNum === 0 ? "U-KG" : `Class ${cNum}`;
            return {
              id: d.id,
              class_number: cNum,
              classNumber: cNum,
              label: data.label || lbl,
              name: data.name || lbl,
              section_count: data.section_count ?? data.sectionCount ?? 2,
              school_id: data.school_id || data.schoolId,
              schoolId: data.schoolId || data.school_id,
              ...data,
            };
          })
          .filter(
            (c: any) =>
              !c.school_id ||
              isSameSchool(c.school_id, sid) ||
              (c.schoolId && isSameSchool(c.schoolId, sid)),
          );

        const merged = standardClasses.map((sc) => {
          const fs = fsClasses.find(
            (f: any) => Number(f.class_number) === sc.class_number,
          );
          return fs ? { ...sc, ...fs, label: sc.label } : sc;
        });
        merged.sort(
          (a: any, b: any) => Number(a.class_number) - Number(b.class_number),
        );
        return res.json(merged);
      }
    } catch {}
  }

  res.json(standardClasses);
});

r.post("/classes", ...admin, async (req: AuthRequest, res) => {
  const n = Number(req.body.classNumber || req.body.class_number);
  const sid = req.user!.schoolId;
  if (!Number.isInteger(n) || n < -1 || n > 12)
    return res
      .status(400)
      .json({ message: "Class must be between L-KG (-1) and 12" });
  try {
    const q = await pool.query(
      "INSERT INTO classes(school_id,class_number) VALUES($1,$2) ON CONFLICT (school_id, class_number) DO UPDATE SET class_number=EXCLUDED.class_number RETURNING *",
      [sid, n],
    );
    if (q.rowCount) {
      const created = {
        id: q.rows[0].id,
        class_number: n,
        section_count: 0,
        school_id: sid,
      };
      demoClasses.push(created);
      demoClasses.sort((a, b) => a.class_number - b.class_number);
      syncClassToFirestore(created).catch(() => {});
      return res.status(201).json(created);
    }
  } catch {}
  const existing = demoClasses.find(
    (c) =>
      c.class_number === n && c.school_id && isSameSchool(c.school_id, sid),
  );
  if (existing) return res.status(200).json(existing);
  const newClass = {
    id: `cls-${sid}-${n}`,
    class_number: n,
    section_count: 0,
    school_id: sid,
  };
  demoClasses.push(newClass);
  demoClasses.sort((a, b) => a.class_number - b.class_number);
  syncClassToFirestore(newClass).catch(() => {});
  res.status(201).json(newClass);
});

r.delete("/classes/:id", ...admin, async (req: AuthRequest, res) => {
  const sid = req.user!.schoolId;
  const cid = String(req.params.id);
  if (isPostgresConfigured && isUuid(cid)) {
    try {
      const stCount = await pool.query(
        "SELECT COUNT(*)::int AS cnt FROM students WHERE class_id = $1 AND school_id = $2",
        [cid, sid],
      );
      if (stCount.rows[0]?.cnt > 0) {
        return res
          .status(400)
          .json({
            success: false,
            message: `Cannot delete class: ${stCount.rows[0].cnt} students are enrolled in this class. Please delete or reassign them first.`,
          });
      }
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("DELETE FROM class_routines WHERE class_id = $1", [
          cid,
        ]);
        await client.query(
          "UPDATE attendance_sessions SET class_id = NULL WHERE class_id = $1",
          [cid],
        );
        await client.query(
          "DELETE FROM student_enrollment_history_v28 WHERE class_id = $1",
          [cid],
        );
        await client.query(
          "DELETE FROM sections WHERE class_id = $1 AND school_id = $2",
          [cid, sid],
        );
        await client.query(
          "DELETE FROM classes WHERE id = $1 AND school_id = $2",
          [cid, sid],
        );
        await client.query("COMMIT");
      } catch (delErr: any) {
        await client.query("ROLLBACK").catch(() => {});
        return res
          .status(400)
          .json({
            success: false,
            message: `Delete class failed: ${delErr.message}`,
          });
      } finally {
        client.release();
      }
    } catch (checkErr: any) {
      return res
        .status(400)
        .json({
          success: false,
          message: `Delete class failed: ${checkErr.message}`,
        });
    }
  }
  const idx = demoClasses.findIndex(
    (c) => c.id === cid && (!c.school_id || isSameSchool(c.school_id, sid)),
  );
  if (idx >= 0) demoClasses.splice(idx, 1);
  deleteClassFromFirestore(cid).catch(() => {});
  if (sid) invalidateSchoolCache(sid);
  res.json({ success: true });
});

r.get("/sections", ...reader, async (req: AuthRequest, res) => {
  const sid = req.user!.schoolId;
  const requestedYearId = String(req.query.academic_year_id || req.query.academicYearId || req.query.sessionId || "").trim();
  const requestedSession = String(req.query.session || req.query.sessionName || "").trim();

  let targetYearId: string | null = null;
  if (requestedYearId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestedYearId)) {
    targetYearId = requestedYearId;
  } else if (requestedYearId || requestedSession) {
    const term = requestedYearId || requestedSession;
    try {
      const ayRes = await pool.query(
        "SELECT id FROM academic_years WHERE school_id = $1 AND (name = $2 OR name ILIKE $3 OR code = $2) LIMIT 1",
        [sid, term, `%${term}%`]
      );
      if (ayRes.rows.length > 0) {
        targetYearId = ayRes.rows[0].id;
      }
    } catch {}
  }

  const cacheKey = targetYearId ? `sections:${sid}:${targetYearId}` : `sections:${sid}`;
  const cached = fastCache.get<any>(cacheKey);
  if (cached) return res.json(cached);

  await ensureSchoolClassesAndSections(sid);

  if (targetYearId) {
    try {
      const q = await pool.query(
        `SELECT s.id, s.name, c.id AS class_id, c.class_number
         FROM sections s
         JOIN classes c ON c.id = s.class_id
         WHERE s.school_id = $1
           AND (
             (s.academic_year_id = $2)
             OR (c.academic_year_id = $2)
             OR EXISTS (SELECT 1 FROM students st WHERE st.school_id = $1 AND st.academic_year_id = $2 AND st.section_id = s.id)
             OR EXISTS (SELECT 1 FROM student_promotions sp WHERE sp.school_id = $1 AND sp.to_academic_year_id = $2 AND sp.to_section_id = s.id AND sp.status = 'CONFIRMED')
             OR EXISTS (SELECT 1 FROM student_enrollment_history_v28 seh WHERE seh.academic_year_id = $2 AND seh.section_id = s.id)
           )
         ORDER BY c.class_number, s.name`,
        [sid, targetYearId]
      );
      const list = q.rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        section_name: r.name,
        class_id: r.class_id,
        class_number: Number(r.class_number),
        school_id: sid,
        academic_year_id: targetYearId,
      }));
      fastCache.set(cacheKey, list, 30);
      return res.json(list);
    } catch (err: any) {
      console.warn('[Sections] Scoped query error:', err.message);
    }
  }

  // Standard sections: Section A and Section B for each class in CLASS_GRADES
  const standardSections: any[] = [];
  CLASS_GRADES.forEach((g) => {
    const classId = `${sid}-${g.id}`;
    standardSections.push({
      id: `${sid}-sec-${g.id}-a`,
      class_id: classId,
      classId: classId,
      class_number: g.class_number,
      label: g.label,
      name: "A",
      section_name: "A",
      school_id: sid,
    });
    standardSections.push({
      id: `${sid}-sec-${g.id}-b`,
      class_id: classId,
      classId: classId,
      class_number: g.class_number,
      label: g.label,
      name: "B",
      section_name: "B",
      school_id: sid,
    });
  });

  try {
    const q = await pool.query(
      `SELECT s.id,s.name,c.id class_id,c.class_number FROM sections s JOIN classes c ON c.id=s.class_id WHERE s.school_id=$1 ORDER BY c.class_number,s.name`,
      [sid],
    );
    if (q.rowCount && q.rows.length > 0) {
      const list = q.rows.map((r: any) => ({
        ...r,
        section_name: r.name,
        school_id: sid,
      }));
      for (const std of standardSections) {
        if (!list.some((r) => Number(r.class_number) === std.class_number)) {
          list.push(std);
        }
      }
      list.sort(
        (a: any, b: any) =>
          Number(a.class_number) - Number(b.class_number) ||
          String(a.name).localeCompare(String(b.name)),
      );
      fastCache.set(cacheKey, list, 30);
      return res.json(list);
    }
  } catch {}

  // Query Cloud Firestore for sections belonging to this school
  if (isFirebaseConfigured()) {
    try {
      let snap = await collections
        .sections()
        .where("school_id", "==", sid)
        .get();
      if (snap.empty) snap = await collections.sections().get();
      if (!snap.empty) {
        const fsSections = snap.docs
          .map((d) => {
            const data = d.data();
            const cNum = Number(
              data.class_number ?? data.classNumber ?? data.className ?? 10,
            );
            const sName = String(
              data.name || data.sectionName || data.section || "A",
            ).toUpperCase();
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
              ...data,
            };
          })
          .filter(
            (s: any) =>
              !s.school_id ||
              isSameSchool(s.school_id, sid) ||
              (s.schoolId && isSameSchool(s.schoolId, sid)),
          );

        const list = [...fsSections];
        for (const std of standardSections) {
          if (!list.some((r) => Number(r.class_number) === std.class_number)) {
            list.push(std);
          }
        }
        list.sort(
          (a: any, b: any) =>
            Number(a.class_number) - Number(b.class_number) ||
            String(a.name).localeCompare(String(b.name)),
        );
        return res.json(list);
      }
    } catch {}
  }

  const memSchoolSections = demoSections.filter(
    (s) => s.school_id && isSameSchool(s.school_id, sid),
  );
  if (memSchoolSections.length > 0) {
    const list = [...memSchoolSections];
    for (const std of standardSections) {
      if (!list.some((r) => Number(r.class_number) === std.class_number)) {
        list.push(std);
      }
    }
    list.sort(
      (a: any, b: any) =>
        Number(a.class_number) - Number(b.class_number) ||
        String(a.name).localeCompare(String(b.name)),
    );
    return res.json(list);
  }

  res.json(standardSections);
});

r.post("/sections", ...admin, async (req: AuthRequest, res) => {
  const sid = req.user!.schoolId;
  const rawClassId = req.body?.classId || req.body?.class_id;
  const name = req.body?.name;
  if (!rawClassId || !name || !String(name).trim())
    return res
      .status(400)
      .json({ message: "Class and section name are required" });
  const cleanName = String(name).trim().toUpperCase();

  // Resolve class_number from rawClassId
  let resolvedClassNumber: number | null = null;
  const strClassId = String(rawClassId);
  if (/l.?kg/i.test(strClassId)) {
    resolvedClassNumber = -1;
  } else if (/u.?kg/i.test(strClassId)) {
    resolvedClassNumber = 0;
  } else {
    const m =
      strClassId.match(/cls-(\d+)/) ||
      strClassId.match(/-(\d+)$/) ||
      strClassId.match(/^(\d+)$/);
    if (m) {
      resolvedClassNumber = Number(m[1]);
    }
  }

  const isClassUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      strClassId,
    );

  try {
    // Try resolving class from PostgreSQL
    const valid = await pool.query(
      `SELECT id, class_number FROM classes 
      WHERE (id = $1::uuid OR ($2::int IS NOT NULL AND class_number = $2))
        AND school_id = $3::uuid LIMIT 1`,
      [
        isClassUuid ? strClassId : "00000000-0000-0000-0000-000000000000",
        resolvedClassNumber,
        sid,
      ],
    );

    let realClassId = isClassUuid ? strClassId : "";
    let classNumber = resolvedClassNumber ?? 1;

    if (valid.rowCount && valid.rows.length > 0) {
      realClassId = valid.rows[0].id;
      classNumber = Number(valid.rows[0].class_number);
    } else if (resolvedClassNumber !== null) {
      const ins = await pool.query(
        `INSERT INTO classes(school_id, class_number) VALUES($1, $2)
        ON CONFLICT (school_id, class_number) DO UPDATE SET class_number=EXCLUDED.class_number
        RETURNING id, class_number`,
        [sid, resolvedClassNumber],
      );
      if (ins.rows.length > 0) {
        realClassId = ins.rows[0].id;
        classNumber = Number(ins.rows[0].class_number);
      }
    }

    if (realClassId) {
      const requestedAyId = req.body?.academic_year_id || req.body?.academicYearId || null;
      const q = await pool.query(
        `INSERT INTO sections(school_id, class_id, name, academic_year_id) VALUES($1, $2, $3, $4)
        ON CONFLICT (class_id, name) DO UPDATE SET name=EXCLUDED.name, academic_year_id=COALESCE(EXCLUDED.academic_year_id, sections.academic_year_id)
        RETURNING id, name, class_id, academic_year_id`,
        [sid, realClassId, cleanName, requestedAyId],
      );
      const created = {
        id: q.rows[0].id,
        class_id: realClassId,
        classId: realClassId,
        class_number: classNumber,
        classNumber: classNumber,
        name: cleanName,
        section_name: cleanName,
        school_id: sid,
      };
      demoSections.push(created);
      demoSections.sort(
        (a, b) =>
          Number(a.class_number ?? 0) - Number(b.class_number ?? 0) ||
          String(a.name).localeCompare(String(b.name)),
      );
      fastCache.deletePattern(`classes:${sid}*`);
      fastCache.deletePattern(`sections:${sid}*`);
      if (sid) invalidateSchoolCache(sid);
      syncSectionToFirestore(created).catch(() => {});
      return res.status(201).json(created);
    }
  } catch (err: any) {
    console.error("[POST /sections] Error:", err.message);
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
    school_id: sid,
  };
  demoSections.push(newSection);
  demoSections.sort(
    (a, b) =>
      Number(a.class_number ?? 0) - Number(b.class_number ?? 0) ||
      String(a.name).localeCompare(String(b.name)),
  );
  fastCache.deletePattern(`classes:${sid}*`);
  fastCache.deletePattern(`sections:${sid}*`);
  if (sid) invalidateSchoolCache(sid);
  syncSectionToFirestore(newSection).catch(() => {});
  res.status(201).json(newSection);
});

r.delete("/sections/:id", ...admin, async (req: AuthRequest, res) => {
  const sid = req.user!.schoolId;
  const secId = String(req.params.id);
  if (isPostgresConfigured && isUuid(secId)) {
    try {
      const stCount = await pool.query(
        "SELECT COUNT(*)::int AS cnt FROM students WHERE section_id = $1 AND school_id = $2",
        [secId, sid],
      );
      if (stCount.rows[0]?.cnt > 0) {
        return res
          .status(400)
          .json({
            success: false,
            message: `Cannot delete section: ${stCount.rows[0].cnt} students belong to this section. Please delete or reassign them first.`,
          });
      }
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("DELETE FROM class_routines WHERE section_id = $1", [
          secId,
        ]);
        await client.query(
          "UPDATE attendance_sessions SET section_id = NULL WHERE section_id = $1",
          [secId],
        );
        await client.query(
          "DELETE FROM student_enrollment_history_v28 WHERE section_id = $1",
          [secId],
        );
        await client.query(
          "DELETE FROM sections WHERE id = $1 AND school_id = $2",
          [secId, sid],
        );
        await client.query("COMMIT");
      } catch (delErr: any) {
        await client.query("ROLLBACK").catch(() => {});
        return res
          .status(400)
          .json({
            success: false,
            message: `Delete section failed: ${delErr.message}`,
          });
      } finally {
        client.release();
      }
    } catch (checkErr: any) {
      return res
        .status(400)
        .json({
          success: false,
          message: `Delete section failed: ${checkErr.message}`,
        });
    }
  }
  const idx = demoSections.findIndex(
    (s) => s.id === secId && (!s.school_id || isSameSchool(s.school_id, sid)),
  );
  if (idx >= 0) demoSections.splice(idx, 1);
  deleteSectionFromFirestore(secId).catch(() => {});
  fastCache.deletePattern(`classes:${sid}*`);
  fastCache.deletePattern(`sections:${sid}*`);
  if (sid) invalidateSchoolCache(sid);
  res.json({ success: true });
});

export const demoStudents: any[] = [
  {
    id: "e58319f2-2b63-4c91-a189-9e8c4e531fa1",
    school_id: "5c96ee99-88e6-44f1-bbb2-1cf8bc651ca3",
    schoolId: "5c96ee99-88e6-44f1-bbb2-1cf8bc651ca3",
    user_id: "e58319f2-2b63-4c91-a189-9e8c4e531fa1",
    name: "Aarav Sharma",
    full_name: "Aarav Sharma",
    first_name: "Aarav",
    last_name: "Sharma",
    roll_number: "25",
    rollNumber: "25",
    admission_number: "ADM-2026-DAV1",
    admissionNumber: "ADM-2026-DAV1",
    email: "student@dav.com",
    student_email: "student@dav.com",
    class_id: "cls-10",
    class_number: 10,
    class_name: "Class 10",
    section_id: "sec-10-a",
    section_name: "A",
    gender: "Male",
    parent_name: "Vikram Sharma",
    parent_sms_number: "9876543210",
    parent_email: "parent@dav.com",
    is_active: true,
    photo_url: "/dav-logo.png",
  },
  {
    id: "f69420a3-3c74-4d02-b290-0f9d5f642ab2",
    school_id: "5c96ee99-88e6-44f1-bbb2-1cf8bc651ca3",
    schoolId: "5c96ee99-88e6-44f1-bbb2-1cf8bc651ca3",
    user_id: "f69420a3-3c74-4d02-b290-0f9d5f642ab2",
    name: "Ananya Verma",
    full_name: "Ananya Verma",
    first_name: "Ananya",
    last_name: "Verma",
    roll_number: "26",
    rollNumber: "26",
    admission_number: "ADM-2026-DAV2",
    admissionNumber: "ADM-2026-DAV2",
    email: "student2@dav.com",
    student_email: "student2@dav.com",
    class_id: "cls-10",
    class_number: 10,
    class_name: "Class 10",
    section_id: "sec-10-a",
    section_name: "A",
    gender: "Female",
    parent_name: "Ramesh Verma",
    parent_sms_number: "9876543211",
    parent_email: "parent2@dav.com",
    is_active: true,
    photo_url: "/dav-logo.png",
  },
  {
    id: "00000000-0000-0000-0000-000000000025",
    school_id: "00000000-0000-0000-0000-000000000001",
    schoolId: "00000000-0000-0000-0000-000000000001",
    user_id: "00000000-0000-0000-0000-000000000025",
    name: "Rohan Sharma",
    full_name: "Rohan Sharma",
    first_name: "Rohan",
    last_name: "Sharma",
    roll_number: "1",
    rollNumber: "1",
    admission_number: "ADM-2026-001",
    admissionNumber: "ADM-2026-001",
    email: "student@greenwood.local",
    student_email: "student@greenwood.local",
    class_id: "cls-10",
    class_number: 10,
    class_name: "Grade 10",
    section_id: "sec-10-a",
    section_name: "A",
    gender: "Male",
    parent_name: "Vikram Patel",
    parent_sms_number: "9876500001",
    parent_email: "parent@greenwood.local",
    is_active: true,
  },
];

export const demoTeachers: any[] = [
  {
    id: "00000000-0000-0000-0000-000000000022",
    name: "Rahul Sharma",
    email: "rahul@demo-school.local",
    employee_id: "EMP001",
    savior_no: "EMP001",
    mobile: "9000000001",
    gender: "Male",
    school_id: "00000000-0000-0000-0000-000000000001",
    is_active: true,
    designation: "PRT",
  },
  {
    id: "00000000-0000-0000-0000-000000000023",
    name: "Priya Patel",
    email: "priya@demo-school.local",
    employee_id: "EMP002",
    savior_no: "EMP002",
    mobile: "9000000002",
    gender: "Female",
    school_id: "00000000-0000-0000-0000-000000000001",
    is_active: true,
    designation: "TGT",
  },
  {
    id: "c3737d42-6f11-4f08-9001-8e052722cc54",
    name: "Debashis Das",
    email: "teacher1@dav.com",
    employee_id: "50359",
    savior_no: "50359",
    mobile: "9876543210",
    gender: "Male",
    school_id: "5c96ee99-88e6-44f1-bbb2-1cf8bc651ca3",
    is_active: true,
    photo_url: "/dav-logo.png",
    designation: "PRT",
  },
  {
    id: "d7a18f43-8e22-4a09-9112-9e163722dd65",
    name: "Sunita Rao",
    email: "sunita.rao@school.local",
    employee_id: "50360",
    savior_no: "50360",
    mobile: "9876543211",
    gender: "Female",
    school_id: "5c96ee99-88e6-44f1-bbb2-1cf8bc651ca3",
    is_active: true,
    photo_url: "/dav-logo.png",
    designation: "TGT",
  },
  {
    id: "b149cd21-7f33-4c12-8854-8e354911aa78",
    name: "Rajesh Sen",
    email: "teacher@dav.com",
    employee_id: "50361",
    savior_no: "50361",
    mobile: "9876543212",
    gender: "Male",
    school_id: "5c96ee99-88e6-44f1-bbb2-1cf8bc651ca3",
    is_active: true,
    photo_url: "/dav-logo.png",
    designation: "PRT",
  },
];

// In-memory teacher teaching allocations (empty - no mock data)
export const demoTeacherAssignments: any[] = [];

// GET /api/teachers/:id/assignments
r.get("/teachers/:id/assignments", ...admin, async (req: AuthRequest, res) => {
  const sid = req.user!.schoolId;
  const tid = req.params.id;
  if (!isTestSchool(sid)) {
    return res.json(
      demoTeacherAssignments.filter(
        (a) =>
          a.teacher_id === tid && a.school_id && isSameSchool(a.school_id, sid),
      ),
    );
  }
  res.json(demoTeacherAssignments.filter((a) => a.teacher_id === tid));
});

// GET /api/teacher-assignments (all assignments for current school)
r.get("/teacher-assignments", ...admin, async (req: AuthRequest, res) => {
  const sid = req.user!.schoolId;
  const rawList = !isTestSchool(sid)
    ? demoTeacherAssignments.filter(
        (a) => a.school_id && isSameSchool(a.school_id, sid),
      )
    : demoTeacherAssignments;
  const list = rawList.map((a) => ({
    ...a,
    class_number: a.class_number
      ? convertRomanClassToDigital(
          String(a.class_number).toLowerCase().startsWith("class")
            ? a.class_number
            : `Class ${a.class_number}`,
        ).replace(/^Class\s*/i, "")
      : a.class_number,
  }));
  res.json(list);
});

// PUT /api/teachers/:id/assignments — Replace all assignments for a teacher
r.put("/teachers/:id/assignments", ...admin, async (req: AuthRequest, res) => {
  const sid = req.user!.schoolId;
  const tid = req.params.id;
  const { assignments } = req.body || {};
  if (!Array.isArray(assignments))
    return res.status(400).json({ message: "assignments array required" });

  // Find teacher name
  const teacher = demoTeachers.find(
    (t) => t.id === tid && (!t.school_id || isSameSchool(t.school_id, sid)),
  );
  const tName = teacher?.name || "Faculty Member";

  // Remove old assignments for this teacher
  for (let i = demoTeacherAssignments.length - 1; i >= 0; i--) {
    if (
      demoTeacherAssignments[i].teacher_id === tid &&
      (!demoTeacherAssignments[i].school_id ||
        isSameSchool(demoTeacherAssignments[i].school_id, sid))
    ) {
      demoTeacherAssignments.splice(i, 1);
    }
  }

  // Add new ones
  const created: any[] = [];
  for (const a of assignments) {
    const altTeacher = a.alt_teacher_id
      ? demoTeachers.find((t) => t.id === a.alt_teacher_id)
      : null;
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
      alt_teacher_name: altTeacher?.name || a.alt_teacher_name || null,
    };
    demoTeacherAssignments.push(entry);
    created.push(entry);
  }
  syncTeacherAssignmentsToFirestore(String(tid), created).catch(() => {});
  res.json(created);
});

r.get("/students", ...reader, async (req: AuthRequest, res) => {
  const search = String(req.query.search || "")
    .trim()
    .toLowerCase();
  const sessionFilter = String(
    req.query.session ||
      req.query.sessionId ||
      req.query.academic_year_id ||
      "",
  ).trim();
  const userSchoolId = req.user?.schoolId;
  const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
  const rawLimit = req.query.limit
    ? parseInt(String(req.query.limit), 10)
    : null;
  const isExplicitPagination = Boolean(
    req.query.page || req.query.limit || req.query.paginated === "true",
  );

  const sendPaginatedStudents = (allRows: any[]) => {
    const total = allRows.length;
    const limit =
      rawLimit && rawLimit > 0
        ? Math.min(rawLimit, 1000)
        : isExplicitPagination
          ? 50
          : total || 50;
    const totalPages = Math.ceil(total / (limit || 1)) || 1;
    const pagedRows = isExplicitPagination
      ? allRows.slice((page - 1) * limit, page * limit)
      : allRows;

    res.setHeader("X-Total-Count", String(total));
    res.setHeader("X-Page", String(page));
    res.setHeader("X-Per-Page", String(limit));
    res.setHeader("X-Total-Pages", String(totalPages));

    if (req.query.paginated === "true" || req.query.format === "object") {
      return res.json({
        data: pagedRows,
        pagination: {
          total,
          page,
          limit,
          totalPages,
        },
      });
    }
    return res.json(pagedRows);
  };

  const cacheKey =
    !search && !sessionFilter && userSchoolId
      ? `students:${userSchoolId}`
      : null;
  if (cacheKey) {
    const cached = fastCache.get<any>(cacheKey);
    if (cached) return sendPaginatedStudents(cached);
  }

  try {
    const q = await pool.query(
      `SELECT st.id,st.name,st.roll_number,st.admission_number,st.parent_name,st.parent_sms_number,st.email AS student_email,st.parent_email,st.user_id,st.photo_url,st.gender,st.date_of_birth,st.address,st.created_at,
  st.academic_year_id, ay.name AS session_name,
  COALESCE(st.is_active, true) AS is_active,
  st.father_name, st.father_phone, st.father_occupation,
  st.mother_name, st.mother_phone, st.mother_occupation,
  st.guardian_name,
  st.parent_whatsapp, st.admission_date,
  c.id class_id,c.class_number,sec.id section_id,sec.name section_name
  FROM students st 
  LEFT JOIN classes c ON c.id=st.class_id 
  LEFT JOIN sections sec ON sec.id=st.section_id
  LEFT JOIN academic_years ay ON ay.id=st.academic_year_id
  WHERE st.school_id=$1
  AND ($2='' OR st.name ILIKE '%'||$2||'%' OR st.roll_number ILIKE '%'||$2||'%' OR COALESCE(st.admission_number, '') ILIKE '%'||$2||'%' OR COALESCE(st.gender, '') ILIKE '%'||$2||'%' OR COALESCE(st.email, '') ILIKE '%'||$2||'%' OR COALESCE(st.parent_email, '') ILIKE '%'||$2||'%')
  ORDER BY COALESCE(c.class_number, 99), COALESCE(sec.name, ''), st.roll_number`,
      [userSchoolId, search],
    );
    if (q.rows) {
      let rows = q.rows.map((st: any) => {
        const parts = String(st.name || "")
          .trim()
          .split(/\s+/);
        let firstName = "";
        let middleName = "";
        let lastName = "";
        if (parts.length === 1) {
          firstName = parts[0] || "";
        } else if (parts.length === 2) {
          firstName = parts[0] || "";
          lastName = parts[1] || "";
        } else if (parts.length >= 3) {
          firstName = parts[0] || "";
          middleName = parts.slice(1, -1).join(" ");
          lastName = parts[parts.length - 1] || "";
        }
        return {
          ...st,
          first_name: st.first_name || firstName,
          firstName: st.first_name || firstName,
          middle_name: st.middle_name || middleName,
          middleName: st.middle_name || middleName,
          last_name: st.last_name || lastName,
          lastName: st.last_name || lastName,
          full_name: st.name,
          rollNumber: st.roll_number,
          admissionNumber: st.admission_number,
          admission_date: st.admission_date
            ? new Date(st.admission_date).toISOString().slice(0, 10)
            : "",
          admissionDate: st.admission_date
            ? new Date(st.admission_date).toISOString().slice(0, 10)
            : "",
          father_name: st.father_name || "",
          fatherName: st.father_name || "",
          father_phone: st.father_phone || "",
          fatherPhone: st.father_phone || "",
          father_occupation: st.father_occupation || "",
          fatherOccupation: st.father_occupation || "",
          mother_name: st.mother_name || "",
          motherName: st.mother_name || "",
          mother_phone: st.mother_phone || "",
          motherPhone: st.mother_phone || "",
          mother_occupation: st.mother_occupation || "",
          motherOccupation: st.mother_occupation || "",
          guardian_name: st.guardian_name || "",
          guardianName: st.guardian_name || "",
          parent_whatsapp: st.parent_whatsapp || "",
          parentWhatsapp: st.parent_whatsapp || "",
          student_email: st.student_email || st.email,
          email: st.student_email || st.email,
          parent_email: st.parent_email,
          parent_phone: st.parent_sms_number,
          parentPhone: st.parent_sms_number,
          gender: normalizeGender(st.gender) || "Not Specified",
          date_of_birth: st.date_of_birth
            ? new Date(st.date_of_birth).toISOString().slice(0, 10)
            : "",
          dob: st.date_of_birth
            ? new Date(st.date_of_birth).toISOString().slice(0, 10)
            : "",
          address: st.address || "",
          photo_url: st.photo_url || "",
          photoUrl: st.photo_url || "",
          session: st.session_name || st.academic_year_id,
          session_id: st.academic_year_id,
          created_at: st.created_at,
          createdAt: st.created_at,
          is_active: st.is_active !== false,
          status: st.is_active !== false ? "ACTIVE" : "INACTIVE",
        };
      });
      const isAllSessions =
        !sessionFilter || /^all(\s+sessions?)?$/i.test(sessionFilter);
      if (!isAllSessions) {
        rows = rows.filter((st: any) => {
          if (st.session_name || st.academic_year_id || st.session) {
            return (
              isSameSession(st.session_name, sessionFilter) ||
              isSameSession(st.academic_year_id, sessionFilter) ||
              isSameSession(st.session, sessionFilter)
            );
          }
          return true;
        });
      }
      if (cacheKey) fastCache.set(cacheKey, rows, 15);
      return sendPaginatedStudents(rows);
    }
  } catch {}

  // If Firestore is configured, load from Cloud Firestore strictly scoped to userSchoolId
  if (isFirebaseConfigured() && userSchoolId) {
    try {
      const snap = await collections
        .students()
        .where("school_id", "==", userSchoolId)
        .get();
      if (!snap.empty) {
        let list = snap.docs
          .map((d) => {
            const dt = d.data();
            const docSchoolId = dt.school_id || dt.schoolId;
            return {
              id: d.id,
              name: dt.name || dt.fullName || dt.full_name || "",
              full_name: dt.full_name || dt.name || dt.fullName || "",
              first_name: dt.first_name || dt.firstName || "",
              last_name: dt.last_name || dt.lastName || "",
              roll_number: dt.roll_number || dt.rollNumber || "",
              admission_number: dt.admission_number || dt.admissionNumber || "",
              admissionNumber: dt.admissionNumber || dt.admission_number || "",
              parent_name: dt.parent_name || dt.parentName || "—",
              parent_sms_number: dt.parent_sms_number || dt.parentPhone || "",
              parent_email: dt.parent_email || dt.parentEmail || "",
              student_email:
                dt.student_email || dt.studentEmail || dt.email || "",
              email: dt.email || dt.student_email || "",
              gender: normalizeGender(dt.gender) || "",
              class_id: dt.class_id || dt.classId || "cls-1",
              class_number: (() => {
                const cId = String(dt.class_id || dt.classId || "");
                if (/l.?kg/i.test(cId)) return -1;
                if (/u.?kg/i.test(cId)) return 0;
                const m = cId.match(/cls-(\d+)/);
                if (m) return Number(m[1]);
                if (
                  dt.class_number !== undefined &&
                  dt.class_number !== null &&
                  !isNaN(Number(dt.class_number))
                )
                  return Number(dt.class_number);
                if (
                  dt.className !== undefined &&
                  dt.className !== null &&
                  !isNaN(Number(dt.className))
                )
                  return Number(dt.className);
                return 1;
              })(),
              section_id: dt.section_id || dt.sectionId || "sec-a",
              section_name: (() => {
                const sId = String(
                  dt.section_id || dt.sectionId || "",
                ).toUpperCase();
                const sName = String(
                  dt.section_name || dt.section || "",
                ).toUpperCase();
                if (
                  sName === "B" ||
                  sId.endsWith("-B") ||
                  sId.endsWith("_B") ||
                  sId === "B"
                )
                  return "B";
                return "A";
              })(),
              academic_year_id:
                dt.academic_year_id || dt.session_id || dt.sessionId || null,
              session_id: dt.session_id || dt.academic_year_id || null,
              session_name: dt.session_name || dt.session || null,
              session: dt.session || dt.session_name || null,
              school_id: docSchoolId,
              schoolId: docSchoolId,
              is_active: dt.is_active !== false && dt.status !== "ARCHIVED",
              ...dt,
            };
          })
          .filter((s) => s.is_active !== false);

        if (list.length > 0) {
          let filtered = search
            ? list.filter(
                (s) =>
                  s.name.toLowerCase().includes(search) ||
                  String(s.roll_number).includes(search) ||
                  (s.admission_number &&
                    s.admission_number.toLowerCase().includes(search)) ||
                  (s.admissionNumber &&
                    s.admissionNumber.toLowerCase().includes(search)) ||
                  (s.gender &&
                    String(s.gender).toLowerCase().includes(search)) ||
                  (s.email && s.email.toLowerCase().includes(search)) ||
                  (s.student_email &&
                    s.student_email.toLowerCase().includes(search)) ||
                  (s.parent_email &&
                    s.parent_email.toLowerCase().includes(search)),
              )
            : list;
          const isAllSessions =
            !sessionFilter || /^all(\s+sessions?)?$/i.test(sessionFilter);
          if (!isAllSessions) {
            filtered = filtered.filter((s) =>
              isSameSession(
                s.session_name ||
                  s.session ||
                  s.academic_year_id ||
                  s.session_id,
                sessionFilter,
              ),
            );
          }
          return sendPaginatedStudents(filtered);
        }
      }
    } catch (e: any) {
      console.warn("[Firestore] Students lookup fallback error:", e.message);
    }
  }

  // Check in-memory demoStudents as secondary fallback
  const memSchoolStudents = demoStudents.filter(
    (s) =>
      s.school_id &&
      isSameSchool(s.school_id, userSchoolId) &&
      s.is_active !== false,
  );
  if (memSchoolStudents.length > 0) {
    let list = memSchoolStudents;
    if (search) {
      list = list.filter(
        (s) =>
          (s.name && s.name.toLowerCase().includes(search.toLowerCase())) ||
          (s.roll_number && String(s.roll_number).includes(search)) ||
          (s.admission_number &&
            s.admission_number.toLowerCase().includes(search.toLowerCase())),
      );
    }
    const isAllSessions =
      !sessionFilter || /^all(\s+sessions?)?$/i.test(sessionFilter);
    if (!isAllSessions) {
      list = list.filter((s) =>
        isSameSession(
          s.session_name || s.session || s.academic_year_id,
          sessionFilter,
        ),
      );
    }
    return sendPaginatedStudents(list);
  }

  // Return empty array if school has no registered students
  return sendPaginatedStudents([]);
});

// GET /students/template — download standardized Excel import template
r.get("/students/template", ...reader, (_req, res) => {
  const XLSX = require("xlsx");
  const sample = [
    {
      "First Name": "Aarav",
      "Last Name": "Sharma",
      "Full Name": "Aarav Sharma",
      "Admission Number": "ADM-2025-001",
      "Admission Date": "2025-04-01",
      "Roll Number": "101",
      Session: "2025-26",
      Class: "Class 1",
      Section: "A",
      "Date of Birth": "2019-05-15",
      Gender: "Male",
      "Father Name": "Rajesh Sharma",
      "Father Contact No": "9876543210",
      "Father Occupation": "Business",
      "Mother Name": "Sunita Sharma",
      "Mother Contact No": "9876543219",
      "Mother Occupation": "Teacher",
      "Parent WhatsApp No": "9876543210",
      "Parent Email": "rajesh@example.com",
      "Student Email": "aarav@school.edu",
    },
    {
      "First Name": "Diya",
      "Last Name": "Patel",
      "Full Name": "Diya Patel",
      "Admission Number": "ADM-2025-002",
      "Admission Date": "2025-04-01",
      "Roll Number": "102",
      Session: "2025-26",
      Class: "Class 1",
      Section: "A",
      "Date of Birth": "2019-08-20",
      Gender: "Female",
      "Father Name": "Kirit Patel",
      "Father Contact No": "9876543211",
      "Father Occupation": "Engineer",
      "Mother Name": "Bhavna Patel",
      "Mother Contact No": "9876543218",
      "Mother Occupation": "Doctor",
      "Parent WhatsApp No": "9876543211",
      "Parent Email": "kirit@example.com",
      "Student Email": "diya@school.edu",
    },
    {
      "First Name": "Rohan",
      "Last Name": "Gupta",
      "Full Name": "Rohan Gupta",
      "Admission Number": "ADM-2025-003",
      "Admission Date": "2025-04-02",
      "Roll Number": "103",
      Session: "2025-26",
      Class: "Class 2",
      Section: "B",
      "Date of Birth": "2018-11-10",
      Gender: "Male",
      "Father Name": "Manoj Gupta",
      "Father Contact No": "9876543212",
      "Father Occupation": "Civil Servant",
      "Mother Name": "Rekha Gupta",
      "Mother Contact No": "9876543217",
      "Mother Occupation": "Home Maker",
      "Parent WhatsApp No": "9876543212",
      "Parent Email": "manoj@example.com",
      "Student Email": "rohan@school.edu",
    },
    {
      "First Name": "L-KG",
      "Last Name": "Example",
      "Full Name": "L-KG Example",
      "Admission Number": "ADM-2025-004",
      "Admission Date": "2025-04-05",
      "Roll Number": "104",
      Session: "2025-26",
      Class: "L-KG",
      Section: "A",
      "Date of Birth": "2021-02-14",
      Gender: "Female",
      "Father Name": "Amit Verma",
      "Father Contact No": "9876543213",
      "Father Occupation": "Banker",
      "Mother Name": "Pooja Verma",
      "Mother Contact No": "9876543216",
      "Mother Occupation": "Architect",
      "Parent WhatsApp No": "9876543213",
      "Parent Email": "p@example.com",
      "Student Email": "",
    },
    {
      "First Name": "U-KG",
      "Last Name": "Example",
      "Full Name": "U-KG Example",
      "Admission Number": "ADM-2025-005",
      "Admission Date": "2025-04-05",
      "Roll Number": "105",
      Session: "2025-26",
      Class: "U-KG",
      Section: "B",
      "Date of Birth": "2020-06-30",
      Gender: "Male",
      "Father Name": "Sanjay Singh",
      "Father Contact No": "9876543214",
      "Father Occupation": "Professor",
      "Mother Name": "Meena Singh",
      "Mother Contact No": "9876543215",
      "Mother Occupation": "Scientist",
      "Parent WhatsApp No": "9876543214",
      "Parent Email": "p2@example.com",
      "Student Email": "",
    },
  ];
  const ws = XLSX.utils.json_to_sheet(sample);
  ws["!cols"] = [
    14, 14, 20, 18, 14, 12, 12, 10, 10, 14, 10, 20, 18, 18, 20, 18, 18, 18, 24,
    26,
  ].map((wch) => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Students Import Template");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="students_import_template.xlsx"',
  );
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.send(buf);
});

r.post("/students", ...admin, async (req: AuthRequest, res) => {
  const b = req.body || {};
  const rawFirst = b.firstName;
  const rawLast = b.lastName;
  const rawName = b.name;
  const rollNumber = b.rollNumber || b.roll_number;
  const admissionNumber = b.admissionNumber || b.admission_number;

  // Father details
  const fatherName = String(b.fatherName || b.father_name || "").trim();
  const fatherPhone = String(
    b.fatherPhone ||
      b.father_phone ||
      b.fatherContact ||
      b.father_contact ||
      b.fatherContactNo ||
      b["Father Contact No"] ||
      "",
  ).trim();
  const fatherOccupation = String(
    b.fatherOccupation || b.father_occupation || "",
  ).trim();

  // Mother details
  const motherName = String(b.motherName || b.mother_name || "").trim();
  const motherPhone = String(
    b.motherPhone ||
      b.mother_phone ||
      b.motherContact ||
      b.mother_contact ||
      b.motherContactNo ||
      b["Mother Contact No"] ||
      "",
  ).trim();
  const motherOccupation = String(
    b.motherOccupation || b.mother_occupation || "",
  ).trim();

  // Guardian details
  const guardianName = String(
    b.guardianName ||
      b.guardian_name ||
      b["Guardian Name"] ||
      b["Guardian's Name"] ||
      "",
  ).trim();

  // Additional parent & admission details
  const parentWhatsapp = String(
    b.parentWhatsapp ||
      b.parent_whatsapp ||
      b.parentWhatsappNo ||
      b.parent_whatsapp_no ||
      b["Parent WhatsApp No"] ||
      "",
  ).trim();
  const rawAdmissionDate = b.admissionDate || b.admission_date || null;
  const rawDob = b.dob || b.dateOfBirth || b.date_of_birth || null;
  const admissionDate = rawAdmissionDate
    ? toDbDate(rawAdmissionDate) || rawAdmissionDate
    : null;
  const dob = rawDob ? toDbDate(rawDob) || rawDob : null;

  // Composite / fallback parentName and parentSmsNumber for backwards compatibility
  const parentName =
    fatherName && motherName
      ? `${fatherName} / ${motherName}`
      : fatherName ||
        motherName ||
        b.parentName ||
        b.parent_name ||
        b.guardianName ||
        b.guardian_name ||
        "";
  const parentSmsNumber =
    fatherPhone ||
    motherPhone ||
    parentWhatsapp ||
    b.parentSmsNumber ||
    b.parentPhone ||
    b.parent_phone ||
    b.parent_sms_number ||
    b.phone ||
    "";

  const gender = normalizeGender(b.gender);
  const address = b.address || null;
  const classId = b.classId || b.class_id;
  const sectionId = b.sectionId || b.section_id;
  const studentEmail = b.studentEmail || b.student_email || b.email;
  const parentEmail = b.parentEmail || b.parent_email;
  const loginOption = b.loginOption || b.login_option;
  const sendInviteEmail =
    b.sendInviteEmail !== undefined ? b.sendInviteEmail : true;
  const sessionId = b.sessionId || b.session_id || b.session;

  // Validation: Date of birth is strictly required as requested
  if (!dob) {
    return res
      .status(400)
      .json({ message: "Date of Birth is a required field." });
  }

  // Year validation for Date of Birth & Admission Date: cannot exceed 4 digits
  const validate4DigitYear = (dateStr: any, label: string) => {
    if (!dateStr) return null;
    const yr = String(dateStr).trim().split("-")[0];
    if (
      yr &&
      (yr.length > 4 || parseInt(yr, 10) > 9999 || parseInt(yr, 10) < 1000)
    ) {
      return `${label} year must be a 4-digit number (e.g. 2026).`;
    }
    return null;
  };
  const dobYrErr = validate4DigitYear(rawDob, "Date of Birth");
  if (dobYrErr) return res.status(400).json({ message: dobYrErr });
  const admYrErr = validate4DigitYear(rawAdmissionDate, "Admission Date");
  if (admYrErr) return res.status(400).json({ message: admYrErr });

  // Name normalization and validation
  const rawMiddle = b.middleName || b.middle_name;
  const firstName = String(
    rawFirst !== undefined
      ? rawFirst
      : rawName
        ? String(rawName).split(" ")[0]
        : "",
  ).trim().toUpperCase();
  const middleName = String(rawMiddle || "").trim().toUpperCase();
  const lastName = String(
    rawLast !== undefined
      ? rawLast
      : rawName
        ? String(rawName).split(" ").slice(1).join(" ")
        : "",
  ).trim().toUpperCase();

  if (!firstName) {
    return res.status(400).json({ message: "First Name is a required field." });
  }
  if (firstName.length < 3 || firstName.length > 15) {
    return res
      .status(400)
      .json({ message: "First Name must be between 3 and 15 characters." });
  }
  if (/\s/.test(firstName)) {
    return res
      .status(400)
      .json({ message: "Spaces are not allowed in First Name." });
  }
  if (/\d/.test(firstName)) {
    return res
      .status(400)
      .json({
        message:
          "First Name must contain only letters, numbers are not allowed.",
      });
  }
  if (middleName && /\d/.test(middleName)) {
    return res
      .status(400)
      .json({
        message:
          "Middle Name must contain only letters, numbers are not allowed.",
      });
  }
  if (lastName && /\d/.test(lastName)) {
    return res
      .status(400)
      .json({
        message:
          "Last Name must contain only letters, numbers are not allowed.",
      });
  }

  const name = (
    [firstName, middleName, lastName].filter(Boolean).join(" ") ||
    String(rawName || "").trim()
  ).toUpperCase();
  if (!name || !rollNumber || !classId || !sectionId) {
    return res
      .status(400)
      .json({
        message: "First Name, Roll Number, Class and Section are required.",
      });
  }

  // Roll Number & Admission Number numeric check
  const cleanRollNumber = String(rollNumber || "").trim();
  if (!cleanRollNumber) {
    return res
      .status(400)
      .json({ message: "Roll Number is a required field." });
  }
  if (!/^\d+$/.test(cleanRollNumber)) {
    return res
      .status(400)
      .json({ message: "Roll Number must contain only numbers." });
  }
  const cleanAdmissionNumber = String(admissionNumber || "").trim();
  if (cleanAdmissionNumber && !/^\d+$/.test(cleanAdmissionNumber)) {
    return res
      .status(400)
      .json({ message: "Admission Number must contain only numbers." });
  }

  // Email format validation
  const EMAIL_FORMAT_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const cleanStudentEmail = String(studentEmail || "")
    .trim()
    .toLowerCase();
  const cleanParentEmail = String(parentEmail || "")
    .trim()
    .toLowerCase();
  if (cleanStudentEmail && !EMAIL_FORMAT_REGEX.test(cleanStudentEmail)) {
    return res
      .status(400)
      .json({ message: "Please provide a valid student email address." });
  }
  if (cleanParentEmail && !EMAIL_FORMAT_REGEX.test(cleanParentEmail)) {
    return res
      .status(400)
      .json({ message: "Please provide a valid parent email address." });
  }
  if (
    String(loginOption || "").toUpperCase() === "PARENT" &&
    !cleanParentEmail
  ) {
    return res
      .status(400)
      .json({
        message:
          "Parent email is required when parent login option is selected.",
      });
  }

  // Mandatory session binding — resolve academic_year_id
  const { getInMemoryAcademicYears, getInMemoryActiveAcademicYear } =
    await import("./academicYears");
  const schoolId = req.user!.schoolId;
  await ensureSchoolClassesAndSections(schoolId);

  const rawSession = String(sessionId || "").trim();
  let resolvedSessionId: string | null = null;
  let resolvedSessionName: string | null = null;
  try {
    const ayQ = await pool.query(
      `SELECT id, name, is_active FROM academic_years WHERE school_id=$1 AND is_archived=false`,
      [schoolId],
    );
    if (ayQ.rowCount && ayQ.rows.length > 0) {
      if (rawSession) {
        const found = ayQ.rows.find(
          (r: any) => r.id === rawSession || isSameSession(r.name, rawSession),
        );
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
      ? memYears.find(
          (y) =>
            (y.id === rawSession || isSameSession(y.name, rawSession)) &&
            !y.is_archived,
        )
      : memYears.find((y) => y.is_active && !y.is_archived) ||
        memYears[1] ||
        memYears[0];
    resolvedSessionId =
      target?.id || (rawSession ? `ay-${rawSession}` : "ay-2025-26");
    resolvedSessionName =
      target?.name || rawSession || "2025–26 Academic Session";
  }

  const loginOpt = String(
    loginOption ||
      (cleanStudentEmail ? "STUDENT" : cleanParentEmail ? "PARENT" : "NONE"),
  ).toUpperCase();

  // In-memory demo store uniqueness validation (used when running purely in-memory)
  if (!isPostgresConfigured) {
    if (cleanAdmissionNumber) {
      const dup = demoStudents.find(
        (s) =>
          s.school_id === schoolId &&
          s.admission_number?.toLowerCase() ===
            cleanAdmissionNumber.toLowerCase(),
      );
      if (dup)
        return res
          .status(409)
          .json({
            message: `Admission number '${cleanAdmissionNumber}' already exists for this school.`,
          });
    }
    if (cleanStudentEmail) {
      const dupEmail = demoStudents.find(
        (s) =>
          s.school_id === schoolId &&
          (s.email?.toLowerCase() === cleanStudentEmail ||
            s.student_email?.toLowerCase() === cleanStudentEmail),
      );
      if (dupEmail)
        return res
          .status(409)
          .json({
            message: `Student email '${cleanStudentEmail}' is already registered in this school.`,
          });
    }
    if (parentSmsNumber) {
      const normP = normalizePhoneNumber(parentSmsNumber);
      if (normP) {
        const last10 = normP.slice(-10);
        const dupPhone = demoStudents.find(
          (s) =>
            s.school_id === schoolId &&
            s.parent_sms_number &&
            normalizePhoneNumber(s.parent_sms_number)?.slice(-10) === last10,
        );
        if (dupPhone) {
          return res.status(409).json({
            message: "This phone number is already registered.",
          });
        }
      }
    }
    if (rollNumber) {
      const dupRoll = demoStudents.find(
        (s) =>
          s.school_id === schoolId &&
          (s.section_id === sectionId || s.sectionId === sectionId) &&
          String(s.roll_number || s.rollNumber)
            .trim()
            .toLowerCase() === String(rollNumber).trim().toLowerCase() &&
          s.is_active !== false,
      );
      if (dupRoll)
        return res
          .status(409)
          .json({
            message: `Roll number '${rollNumber}' is already assigned in this section.`,
          });
    }
  }

  let clsNum = 1;
  const strClassId = String(classId || "").trim();
  const matchedGrade = CLASS_GRADES.find(
    (g) =>
      g.id === strClassId ||
      strClassId.endsWith(`-${g.id}`) ||
      strClassId === `cls-${g.class_number}` ||
      String(g.class_number) === strClassId,
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

  let secName = "A";
  const strSecId = String(sectionId || "")
    .trim()
    .toUpperCase();
  if (
    strSecId === "B" ||
    strSecId.endsWith("-B") ||
    strSecId.endsWith("_B") ||
    strSecId.endsWith("/B")
  ) {
    secName = "B";
  } else if (
    strSecId === "A" ||
    strSecId.endsWith("-A") ||
    strSecId.endsWith("_A") ||
    strSecId.endsWith("/A")
  ) {
    secName = "A";
  }
  let resetInfo: any = null;
  let welcomeEmailSent = false;
  let realClassId = classId;
  let realSectionId = sectionId;
  const isClassUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      String(classId),
    );
  const isSecUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      String(sectionId),
    );

  try {
    let valid: any = { rowCount: 0, rows: [] };
    if (isSecUuid) {
      valid = await pool
        .query(
          `SELECT s.id AS section_id, s.name AS section_name, c.id AS class_id, c.class_number 
         FROM sections s 
         JOIN classes c ON c.id = s.class_id 
         WHERE s.school_id = $1 AND s.id = $2 LIMIT 1`,
          [schoolId, sectionId],
        )
        .catch(() => ({ rowCount: 0, rows: [] }));
    }
    if (!valid.rowCount) {
      valid = await pool
        .query(
          `SELECT s.id AS section_id, s.name AS section_name, c.id AS class_id, c.class_number 
         FROM sections s 
         JOIN classes c ON c.id = s.class_id 
         WHERE s.school_id = $1::uuid 
           AND (c.id = $2::uuid OR c.class_number = $3)
           AND UPPER(s.name) = UPPER($4)
         LIMIT 1`,
          [
            schoolId,
            isClassUuid ? classId : "00000000-0000-0000-0000-000000000000",
            clsNum,
            secName,
          ],
        )
        .catch(() => ({ rowCount: 0, rows: [] }));
    }
    if (!valid.rowCount) {
      valid = await pool
        .query(
          `SELECT s.id AS section_id, s.name AS section_name, c.id AS class_id, c.class_number 
         FROM sections s 
         JOIN classes c ON c.id = s.class_id 
         WHERE s.school_id = $1::uuid 
           AND (c.id = $2::uuid OR c.class_number = $3)
         LIMIT 1`,
          [
            schoolId,
            isClassUuid ? classId : "00000000-0000-0000-0000-000000000000",
            clsNum,
          ],
        )
        .catch(() => ({ rowCount: 0, rows: [] }));
    }

    if (valid.rowCount && valid.rows.length > 0) {
      realSectionId = valid.rows[0].section_id;
      realClassId = valid.rows[0].class_id;
      clsNum = valid.rows[0].class_number;
      secName = valid.rows[0].section_name;
    } else {
      // Guarantee class and section exist in Supabase
      let clsQ = await pool.query(
        `SELECT id, class_number FROM classes WHERE school_id=$1 AND class_number=$2 LIMIT 1`,
        [schoolId, clsNum],
      );
      if (!clsQ.rowCount) {
        clsQ = await pool.query(
          `INSERT INTO classes(school_id, class_number, name) VALUES($1, $2, $3)
           ON CONFLICT (school_id, class_number) DO UPDATE SET class_number=EXCLUDED.class_number RETURNING id, class_number`,
          [
            schoolId,
            clsNum,
            clsNum === -1 ? "L-KG" : clsNum === 0 ? "U-KG" : `Class ${clsNum}`,
          ],
        );
      }
      realClassId = clsQ.rows[0].id;
      clsNum = clsQ.rows[0].class_number;

      let secQ = await pool.query(
        `SELECT id, name FROM sections WHERE school_id=$1 AND class_id=$2 AND UPPER(name)=UPPER($3) LIMIT 1`,
        [schoolId, realClassId, secName],
      );
      if (!secQ.rowCount) {
        secQ = await pool.query(
          `INSERT INTO sections(school_id, class_id, name) VALUES($1, $2, $3)
           ON CONFLICT (class_id, name) DO UPDATE SET name=EXCLUDED.name RETURNING id, name`,
          [schoolId, realClassId, secName],
        );
      }
      realSectionId = secQ.rows[0].id;
      secName = secQ.rows[0].name;
    }

    let linkedUserId: string | null = null;
    let targetLoginEmail = "";
    if (loginOpt === "STUDENT" && cleanStudentEmail) {
      targetLoginEmail = cleanStudentEmail;
    } else if (loginOpt === "PARENT" && cleanParentEmail) {
      targetLoginEmail = cleanParentEmail;
    } else if (cleanStudentEmail) {
      targetLoginEmail = cleanStudentEmail;
    } else if (cleanParentEmail) {
      targetLoginEmail = cleanParentEmail;
    }

    // Handle Student Portal Login Account Creation
    if (targetLoginEmail && loginOpt !== "NONE") {
      try {
        const userCheck = await pool.query(
          `SELECT id FROM users WHERE LOWER(email)=$1 LIMIT 1`,
          [targetLoginEmail],
        );
        if (userCheck.rowCount && userCheck.rowCount > 0) {
          linkedUserId = userCheck.rows[0].id;
        } else {
          const tempPass = crypto.randomBytes(8).toString("hex") + "Aa1!";
          const tempHash = await bcrypt.hash(tempPass, 10);
          const uq = await pool.query(
            `INSERT INTO users(school_id, name, email, password_hash, role) VALUES($1, $2, $3, $4, 'STUDENT') RETURNING id`,
            [schoolId, name, targetLoginEmail, tempHash],
          );
          linkedUserId = uq.rows[0].id;
        }
      } catch (uErr: any) {
        console.warn(
          "[StudentEnrollment] User creation warning:",
          uErr.message,
        );
      }

      if (sendInviteEmail) {
        try {
          resetInfo = await createAndSendPasswordReset({
            email: targetLoginEmail,
            name,
            role: loginOpt === "PARENT" ? "PARENT" : "STUDENT",
            userId: linkedUserId || undefined,
            schoolId: req.user?.schoolId || undefined,
            schoolName: req.user?.schoolName || "School",
            req,
            sendEmail: false,
          });
          if (resetInfo?.resetUrl) {
            const isParent = loginOpt === "PARENT";
            queueEmailNotification({
              schoolId: req.user?.schoolId || "school-default",
              recipientEmail: targetLoginEmail,
              recipientName: isParent ? parentName || "Parent" : name,
              recipientType: isParent ? "PARENT" : "STUDENT",
              templateKey: isParent ? "PARENT_CREATED" : "STUDENT_CREATED",
              templateData: {
                student_name: name,
                school_name: req.user?.schoolName || "School",
                admission_number: cleanAdmissionNumber || "—",
                class_name: String(clsNum),
                section_name: secName,
                roll_number: String(rollNumber),
                login_email: targetLoginEmail,
                reset_link: resetInfo.resetUrl,
                login_url: resetInfo.resetUrl,
              },
              idempotencyKey: `stu-welcome-${req.user?.schoolId || "default"}-${targetLoginEmail}`,
            }).catch(() => {});
            welcomeEmailSent = true;
          }
        } catch (e: any) {
          console.warn(
            "[StudentEnrollment] Failed to send student reset email:",
            e.message,
          );
        }
      }
    } else {
      console.log(
        `[StudentEnrollment] SKIPPED email notification - No email address provided for student "${name}" (Roll: ${rollNumber})`,
      );
    }

    const isRealClassUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        String(realClassId),
      );
    const isRealSecUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        String(realSectionId),
      );

    if (isRealClassUuid && isRealSecUuid) {
      let pgAyId: string | null = null;
      if (
        resolvedSessionId &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          String(resolvedSessionId),
        )
      ) {
        const ayChk = await pool.query(
          "SELECT id, name FROM academic_years WHERE id=$1 AND school_id=$2",
          [resolvedSessionId, schoolId],
        );
        if (ayChk.rowCount && ayChk.rows.length > 0) {
          pgAyId = ayChk.rows[0].id;
          if (!resolvedSessionName) resolvedSessionName = ayChk.rows[0].name;
        }
      }
      if (!pgAyId) {
        const ayRow = await pool.query(
          "SELECT id, name FROM academic_years WHERE school_id=$1 AND is_active=true LIMIT 1",
          [schoolId],
        );
        if (ayRow.rowCount && ayRow.rows.length > 0) {
          pgAyId = ayRow.rows[0].id;
          if (!resolvedSessionName) resolvedSessionName = ayRow.rows[0].name;
        }
      }

      let pgUserId: string | null = null;
      if (
        linkedUserId &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          String(linkedUserId),
        )
      ) {
        const uLinkChk = await pool.query(
          "SELECT id FROM students WHERE user_id=$1 LIMIT 1",
          [linkedUserId],
        );
        if (!uLinkChk.rowCount) {
          pgUserId = linkedUserId;
        }
      }

      if (isPostgresConfigured) {
        const uniquenessResult = await validateStudentUniqueness({
          schoolId,
          academicYearId: pgAyId || resolvedSessionId,
          classId: realClassId,
          sectionId: realSectionId,
          admissionNumber: cleanAdmissionNumber || null,
          rollNumber: rollNumber ? String(rollNumber) : null,
          studentEmail: cleanStudentEmail || null,
          studentPhone: parentSmsNumber || null,
          familyInfo: {
            fatherName: fatherName || null,
            motherName: motherName || null,
            parentName: parentName || null,
            guardianName: guardianName || null,
          },
        });
        if (!uniquenessResult.valid) {
          return res.status(409).json({
            message:
              uniquenessResult.errors[0]?.message ||
              "Student validation failed.",
            errors: uniquenessResult.errors,
          });
        }
      }

      const safeParentSms = parentSmsNumber
        ? String(parentSmsNumber).trim()
        : "";
      const q = await pool.query(
        `INSERT INTO students(
          school_id, academic_year_id, class_id, section_id, roll_number, 
          admission_number, name, parent_name, parent_sms_number, email, parent_email, user_id,
          date_of_birth, gender, address,
          father_name, father_phone, father_occupation,
          mother_name, mother_phone, mother_occupation,
          parent_whatsapp, admission_date,
          first_name, middle_name, last_name, guardian_name
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
        )
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
          address || null,
          fatherName || null,
          fatherPhone || null,
          fatherOccupation || null,
          motherName || null,
          motherPhone || null,
          motherOccupation || null,
          parentWhatsapp || null,
          admissionDate || null,
          firstName || null,
          middleName || null,
          lastName || null,
          guardianName || null,
        ],
      );

      const created = {
        ...q.rows[0],
        academic_year_id: resolvedSessionId || pgAyId,
        session_id: resolvedSessionId || pgAyId,
        session_name: resolvedSessionName,
        session: resolvedSessionName || resolvedSessionId,
        full_name: name,
        first_name: firstName || null,
        firstName: firstName || null,
        middle_name: middleName || null,
        middleName: middleName || null,
        last_name: lastName || null,
        lastName: lastName || null,
        class_id: realClassId,
        section_id: realSectionId,
        class_number: clsNum,
        section_name: secName,
        admission_number: cleanAdmissionNumber || q.rows[0].admission_number,
        admissionNumber: cleanAdmissionNumber || q.rows[0].admission_number,
        admission_date: admissionDate || q.rows[0].admission_date,
        admissionDate: admissionDate || q.rows[0].admission_date,
        date_of_birth: dob || q.rows[0].date_of_birth,
        dob: dob || q.rows[0].date_of_birth,
        father_name: fatherName || q.rows[0].father_name,
        fatherName: fatherName || q.rows[0].father_name,
        father_phone: fatherPhone || q.rows[0].father_phone,
        fatherPhone: fatherPhone || q.rows[0].father_phone,
        father_occupation: fatherOccupation || q.rows[0].father_occupation,
        fatherOccupation: fatherOccupation || q.rows[0].father_occupation,
        mother_name: motherName || q.rows[0].mother_name,
        motherName: motherName || q.rows[0].mother_name,
        mother_phone: motherPhone || q.rows[0].mother_phone,
        motherPhone: motherPhone || q.rows[0].mother_phone,
        mother_occupation: motherOccupation || q.rows[0].mother_occupation,
        motherOccupation: motherOccupation || q.rows[0].mother_occupation,
        guardian_name: guardianName || q.rows[0].guardian_name || null,
        guardianName: guardianName || q.rows[0].guardian_name || null,
        parent_whatsapp: parentWhatsapp || q.rows[0].parent_whatsapp,
        parentWhatsapp: parentWhatsapp || q.rows[0].parent_whatsapp,
        student_email: cleanStudentEmail,
        parent_email: cleanParentEmail,
        parent_phone: safeParentSms,
        parentPhone: safeParentSms,
        login_email: targetLoginEmail,
        login_option: loginOpt,
        reset_url: resetInfo?.resetUrl,
        invite_sent: Boolean(resetInfo),
        is_active: true,
      };
      demoStudents.unshift(created);
      syncStudentToFirestore(created).catch(() => {});
      return res.status(201).json(created);
    }
  } catch (err: any) {
    console.error(
      "[StudentEnrollment] Supabase student insert error:",
      err.message,
    );
    if (isPostgresConfigured) {
      if (err.code === "23505") {
        const constraint = err.constraint || "";
        let msg = "Duplicate record conflict.";
        if (
          constraint.includes("admission") ||
          err.detail?.includes("admission_number")
        ) {
          msg = `Admission number '${cleanAdmissionNumber}' already exists for this school.`;
        } else if (
          constraint.includes("roll") ||
          err.detail?.includes("roll_number")
        ) {
          msg = `Roll number '${rollNumber}' is already assigned in this section for the selected academic session.`;
        } else if (
          constraint.includes("email") ||
          err.detail?.includes("email")
        ) {
          msg = `Student email '${cleanStudentEmail}' is already registered in this school.`;
        } else if (
          constraint.includes("user_id") ||
          err.detail?.includes("user_id")
        ) {
          msg = `This user account is already linked to another student.`;
        }
        return res.status(409).json({ message: msg });
      }
      return res
        .status(400)
        .json({ message: `Failed to enroll student: ${err.message}` });
    }
  }

  // Demo In-Memory Fallback
  const targetLoginEmail =
    loginOpt === "PARENT"
      ? cleanParentEmail
      : cleanStudentEmail ||
        cleanParentEmail ||
        (cleanAdmissionNumber
          ? `student.${cleanAdmissionNumber.toLowerCase()}@portal.local`
          : "");
  if (targetLoginEmail && loginOpt !== "NONE") {
    registerDemoUser({
      id: `usr-st-${Date.now()}`,
      schoolId: req.user!.schoolId,
      name,
      email: targetLoginEmail,
      role: "STUDENT",
      password: "ChangeMe123!",
      admissionNumber: cleanAdmissionNumber,
    });
    if (!welcomeEmailSent && sendInviteEmail) {
      try {
        if (!resetInfo) {
          resetInfo = await createAndSendPasswordReset({
            email: targetLoginEmail,
            name,
            role: loginOpt === "PARENT" ? "PARENT" : "STUDENT",
            schoolId: req.user?.schoolId || undefined,
            schoolName: req.user?.schoolName || "School",
            req,
            sendEmail: false,
          });
        }
        if (resetInfo?.resetUrl) {
          const isParent = loginOpt === "PARENT";
          queueEmailNotification({
            schoolId: req.user?.schoolId || "school-default",
            recipientEmail: targetLoginEmail,
            recipientName: isParent ? parentName || "Parent" : name,
            recipientType: isParent ? "PARENT" : "STUDENT",
            templateKey: isParent ? "PARENT_CREATED" : "STUDENT_CREATED",
            templateData: {
              student_name: name,
              school_name: req.user?.schoolName || "School",
              admission_number: cleanAdmissionNumber || "—",
              class_name: String(clsNum),
              section_name: secName,
              roll_number: String(rollNumber || "—"),
              login_email: targetLoginEmail,
              reset_link: resetInfo.resetUrl,
              login_url: resetInfo.resetUrl,
            },
            idempotencyKey: `stu-welcome-${req.user?.schoolId || "default"}-${targetLoginEmail}`,
          }).catch(() => {});
          welcomeEmailSent = true;
        }
      } catch {}
    }
  } else if (!targetLoginEmail) {
    console.log(
      `[StudentEnrollment] SKIPPED email notification - No email address provided for student "${name}" (Roll: ${rollNumber})`,
    );
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
    admission_number:
      cleanAdmissionNumber || `ADM-${Date.now().toString().slice(-4)}`,
    admissionNumber:
      cleanAdmissionNumber || `ADM-${Date.now().toString().slice(-4)}`,
    parent_name: parentName || "—",
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
    is_active: true,
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

function parseClassValue(
  rawVal: any,
  fallbackClass?: string | number,
): ParsedClassResult {
  let val = String(rawVal ?? "").trim();

  if (
    !val &&
    fallbackClass !== undefined &&
    fallbackClass !== null &&
    String(fallbackClass).trim() !== ""
  ) {
    val = String(fallbackClass).trim();
  }

  if (!val) {
    return {
      valid: false,
      classNumber: 1,
      classId: "cls-1",
      classLabel: "",
      error: "Class is required",
    };
  }

  // Kindergarten string checks
  if (
    /^l\.?kg$/i.test(val) ||
    /^l-kg$/i.test(val) ||
    /^lower\s*kg$/i.test(val)
  ) {
    return {
      valid: true,
      classNumber: -1,
      classId: "cls-lkg",
      classLabel: "L-KG",
    };
  }
  if (
    /^u\.?kg$/i.test(val) ||
    /^u-kg$/i.test(val) ||
    /^upper\s*kg$/i.test(val)
  ) {
    return {
      valid: true,
      classNumber: 0,
      classId: "cls-ukg",
      classLabel: "U-KG",
    };
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
    return {
      valid: true,
      classNumber: num,
      classId: `cls-${num}`,
      classLabel: `Class ${num}`,
    };
  }

  // Numeric string e.g. "10", "Class 10", "Grade 5", "Std 8"
  const cleanNoPrefix = val
    .replace(/^(class|grade|std|standard)\s*/i, "")
    .trim();
  if (/^\d+$/.test(cleanNoPrefix)) {
    const num = parseInt(cleanNoPrefix, 10);
    if (num >= 1 && num <= 12) {
      return {
        valid: true,
        classNumber: num,
        classId: `cls-${num}`,
        classLabel: `Class ${num}`,
      };
    }
  }

  // Numeric classNumber passed directly e.g. -1 (LKG) or 0 (UKG) or 1..12
  if (typeof rawVal === "number") {
    if (rawVal === -1)
      return {
        valid: true,
        classNumber: -1,
        classId: "cls-lkg",
        classLabel: "L-KG",
      };
    if (rawVal === 0)
      return {
        valid: true,
        classNumber: 0,
        classId: "cls-ukg",
        classLabel: "U-KG",
      };
    if (rawVal >= 1 && rawVal <= 12) {
      return {
        valid: true,
        classNumber: rawVal,
        classId: `cls-${rawVal}`,
        classLabel: `Class ${rawVal}`,
      };
    }
  }

  // Invalid class value
  return {
    valid: false,
    classNumber: 1,
    classId: "cls-1",
    classLabel: val,
    error: `Invalid Class '${val}'. Expected 1–12, Roman numerals (I–XII), LKG, or UKG.`,
  };
}

r.post("/students/bulk-import", ...admin, async (req: AuthRequest, res) => {
  const { students = [], sessionId: reqSessionId } = req.body || {};
  if (!Array.isArray(students) || students.length === 0)
    return res
      .status(400)
      .json({ message: "Array of student records is required" });

  const schoolId = req.user!.schoolId;
  await ensureSchoolClassesAndSections(schoolId);

  // Resolve session for bulk import
  const { getInMemoryAcademicYears } = await import("./academicYears");
  const rawSession = String(
    reqSessionId || req.body?.session || students[0]?.session || "",
  ).trim();
  let bulkSessionId: string | null = null;
  let bulkSessionName: string | null = null;
  try {
    const ayQ = await pool.query(
      `SELECT id, name, is_active FROM academic_years WHERE school_id=$1 AND is_archived=false`,
      [schoolId],
    );
    if (ayQ.rowCount && ayQ.rows.length > 0) {
      if (rawSession) {
        const found = ayQ.rows.find(
          (r: any) => r.id === rawSession || isSameSession(r.name, rawSession),
        );
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
    console.warn("[bulk-import] Error resolving academic year from DB:", ayErr);
  }

  // If not found in DB but rawSession provided, insert academic year into DB so it has a valid UUID
  if (!bulkSessionId && rawSession) {
    try {
      const canonical = toCanonicalSession(rawSession);
      const sessionDisplayName = canonical
        ? `${canonical} Academic Session`
        : rawSession;
      const newAy = await pool.query(
        `INSERT INTO academic_years(school_id, name, is_active) VALUES($1, $2, false) RETURNING id, name`,
        [schoolId, sessionDisplayName],
      );
      if (newAy.rowCount && newAy.rows.length > 0) {
        bulkSessionId = newAy.rows[0].id;
        bulkSessionName = newAy.rows[0].name;
      }
    } catch {}
  }

  if (!bulkSessionId) {
    const memYears = getInMemoryAcademicYears(schoolId);
    const target = rawSession
      ? memYears.find(
          (y) =>
            (y.id === rawSession || isSameSession(y.name, rawSession)) &&
            !y.is_archived,
        )
      : memYears.find((y) => y.is_active && !y.is_archived);
    bulkSessionId = target?.id || null;
    bulkSessionName = target?.name || null;
  }

  const REQUIRED_HEADERS = [
    "First Name",
    "Last Name",
    "Admission Number",
    "Roll Number",
    "Parent Name",
    "Parent Phone",
    "Parent Email",
    "Student Email",
  ];

  // Preload existing classes and sections to eliminate duplicate DB queries per row
  const classMap = new Map<number, string>();
  const sectionMap = new Map<string, string>();
  let isSchoolInPostgres = false;
  try {
    const schCheck = await pool.query(
      "SELECT id FROM schools WHERE id = $1 LIMIT 1",
      [schoolId],
    );
    isSchoolInPostgres = Boolean(schCheck.rowCount && schCheck.rowCount > 0);
    if (isSchoolInPostgres) {
      const clsQ = await pool.query(
        `SELECT id, class_number FROM classes WHERE school_id=$1`,
        [schoolId],
      );
      for (const r of clsQ.rows) classMap.set(Number(r.class_number), r.id);

      const secQ = await pool.query(
        `SELECT id, class_id, UPPER(name) as name FROM sections WHERE school_id=$1`,
        [schoolId],
      );
      for (const r of secQ.rows)
        sectionMap.set(`${r.class_id}_${r.name}`, r.id);
    }
  } catch (preloadErr: any) {
    console.warn(
      "[bulk-import] Notice preloading classes/sections:",
      preloadErr.message,
    );
  }

  const extractClassRaw = (rec: any) => {
    if (rec.classNumber !== undefined && rec.classNumber !== null && rec.classNumber !== "") return rec.classNumber;
    if (rec.class_number !== undefined && rec.class_number !== null && rec.class_number !== "") return rec.class_number;
    if (rec.classLabel !== undefined && rec.classLabel !== null && rec.classLabel !== "") return rec.classLabel;
    if (rec.className !== undefined && rec.className !== null && rec.className !== "") return rec.className;
    if (rec["Class"] !== undefined && rec["Class"] !== null && rec["Class"] !== "") return rec["Class"];
    if (rec["class"] !== undefined && rec["class"] !== null && rec["class"] !== "") return rec["class"];
    if (rec["CLASS"] !== undefined && rec["CLASS"] !== null && rec["CLASS"] !== "") return rec["CLASS"];
    if (rec["Grade"] !== undefined && rec["Grade"] !== null && rec["Grade"] !== "") return rec["Grade"];
    if (rec["grade"] !== undefined && rec["grade"] !== null && rec["grade"] !== "") return rec["grade"];
    if (rec["Standard"] !== undefined && rec["Standard"] !== null && rec["Standard"] !== "") return rec["Standard"];
    if (rec["std"] !== undefined && rec["std"] !== null && rec["std"] !== "") return rec["std"];
    for (const k of Object.keys(rec || {})) {
      const lk = k.trim().toLowerCase();
      if (["class", "grade", "standard", "std", "class name", "class / grade", "class/grade"].includes(lk)) {
        if (rec[k] !== undefined && rec[k] !== null && String(rec[k]).trim() !== "") return rec[k];
      }
    }
    return "";
  };

  const extractSectionRaw = (rec: any) => {
    if (rec.sectionName !== undefined && rec.sectionName !== null && rec.sectionName !== "") return rec.sectionName;
    if (rec.section_name !== undefined && rec.section_name !== null && rec.section_name !== "") return rec.section_name;
    if (rec["Section"] !== undefined && rec["Section"] !== null && rec["Section"] !== "") return rec["Section"];
    if (rec["section"] !== undefined && rec["section"] !== null && rec["section"] !== "") return rec["section"];
    if (rec["SECTION"] !== undefined && rec["SECTION"] !== null && rec["SECTION"] !== "") return rec["SECTION"];
    for (const k of Object.keys(rec || {})) {
      const lk = k.trim().toLowerCase();
      if (["section", "sec", "section name", "sec name"].includes(lk)) {
        if (rec[k] !== undefined && rec[k] !== null && String(rec[k]).trim() !== "") return rec[k];
      }
    }
    return "A";
  };

  // Dynamic helper: Auto-create class if not exists; if already created (e.g. from previous student in sheet), reuse it!
  const ensureClassInDb = async (cn: number): Promise<string> => {
    let cid = classMap.get(cn);
    if (cid && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cid)) {
      return cid;
    }
    if (isSchoolInPostgres) {
      try {
        const clsQ = await pool.query(
          `INSERT INTO classes(school_id, class_number, academic_year_id)
           VALUES($1, $2, $3)
           ON CONFLICT (school_id, class_number)
           DO UPDATE SET class_number=EXCLUDED.class_number,
                         academic_year_id=COALESCE(classes.academic_year_id, EXCLUDED.academic_year_id)
           RETURNING id`,
          [schoolId, cn, bulkSessionId || null],
        );
        if (clsQ.rows.length > 0) {
          cid = clsQ.rows[0].id;
          classMap.set(cn, cid);
          return cid;
        }
      } catch (csErr: any) {
        console.warn("[bulk-import] Failed to create class:", csErr.message);
      }
    }
    return cid || `cls-${cn}`;
  };

  // Dynamic helper: Auto-create section if not exists; if already created, reuse it!
  const ensureSectionInDb = async (cId: string, sn: string): Promise<string> => {
    const cleanSec = (sn || "A").trim().toUpperCase();
    const secKey = `${cId}_${cleanSec}`;
    let sid = sectionMap.get(secKey);
    if (sid && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sid)) {
      return sid;
    }
    if (isSchoolInPostgres && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cId)) {
      try {
        const secQ = await pool.query(
          `INSERT INTO sections(school_id, class_id, name, academic_year_id)
           VALUES($1, $2, $3, $4)
           ON CONFLICT (class_id, name)
           DO UPDATE SET name=EXCLUDED.name,
                         academic_year_id=COALESCE(sections.academic_year_id, EXCLUDED.academic_year_id)
           RETURNING id`,
          [schoolId, cId, cleanSec, bulkSessionId || null],
        );
        if (secQ.rows.length > 0) {
          sid = secQ.rows[0].id;
          sectionMap.set(secKey, sid);
          return sid;
        }
      } catch (secErr: any) {
        console.warn("[bulk-import] Failed to create section:", secErr.message);
      }
    }
    return sid || `sec-${cId}-${cleanSec.toLowerCase()}`;
  };

  // Pre-resolve all classes & sections needed in this batch in a single pass before the row loop
  const neededClasses = new Set<number>();
  const neededSections = new Set<string>(); // "classNumber:sectionName"
  for (const st of students) {
    const rawClassVal = extractClassRaw(st);
    const parsed = parseClassValue(rawClassVal);
    if (parsed.valid) {
      neededClasses.add(parsed.classNumber);
      const sn = String(extractSectionRaw(st)).replace(/^section\s*/i, "").trim().toUpperCase() || "A";
      neededSections.add(`${parsed.classNumber}:${sn}`);
    }
  }

  if (isSchoolInPostgres) {
    for (const cn of neededClasses) {
      await ensureClassInDb(cn);
    }
    for (const item of neededSections) {
      const [cnStr, sn] = item.split(":");
      const cn = Number(cnStr);
      const cId = classMap.get(cn);
      if (cId) {
        await ensureSectionInDb(cId, sn);
      }
    }
  }

  // Validate rows and collect errors (100% in-memory pre-validation)
  const validRows: any[] = [];
  const errors: { row: number; field: string; message: string }[] = [];
  const seenAdmNums = new Map<string, number>();
  const seenRollKeys = new Map<string, number>();
  const seenStudentEmails = new Map<string, number>();
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  for (let i = 0; i < students.length; i++) {
    const st = students[i];
    const rowNum = i + 1;
    let firstName = String(
      st.firstName ||
        st["First Name"] ||
        st.first_name ||
        st["first_name"] ||
        "",
    ).trim().toUpperCase();
    let middleName = String(
      st.middleName ||
        st["Middle Name"] ||
        st.middle_name ||
        st["middle_name"] ||
        st.MiddleName ||
        "",
    ).trim().toUpperCase();
    let lastName = String(
      st.lastName || st["Last Name"] || st.last_name || st["last_name"] || "",
    ).trim().toUpperCase();
    const rawFullName = String(
      st.fullName || st["Full Name"] || st.full_name || st.name || "",
    ).trim().toUpperCase();
    if ((!firstName || !lastName) && rawFullName) {
      const parts = rawFullName.split(/\s+/).filter(Boolean);
      if (parts.length === 1) {
        if (!firstName) firstName = (parts[0] || "").toUpperCase();
      } else if (parts.length === 2) {
        if (!firstName) firstName = (parts[0] || "").toUpperCase();
        if (!lastName) lastName = (parts[1] || "").toUpperCase();
      } else if (parts.length >= 3) {
        if (!firstName) firstName = (parts[0] || "").toUpperCase();
        if (!middleName) middleName = (parts.slice(1, -1).join(" ") || "").toUpperCase();
        if (!lastName) lastName = (parts[parts.length - 1] || "").toUpperCase();
      }
    }
    const name = (
      rawFullName ||
      [firstName, middleName, lastName].filter(Boolean).join(" ") ||
      (firstName && lastName
        ? `${firstName} ${lastName}`
        : firstName || lastName || String(st.name || "").trim())
    ).toUpperCase();
    const rollNumber = String(
      st.rollNumber || st["Roll Number"] || st.roll_number || "",
    ).trim();
    const admissionNumber = String(
      st.admissionNumber || st["Admission Number"] || st.admission_number || "",
    ).trim();

    // Father details
    const fatherName = String(
      st.fatherName ||
        st["Father Name"] ||
        st["Father's Name"] ||
        st.father_name ||
        "",
    ).trim();
    const fatherPhone = String(
      st.fatherPhone ||
        st.fatherContactNo ||
        st["Father Contact No"] ||
        st["Father Contact"] ||
        st["Father Phone"] ||
        st.father_phone ||
        "",
    ).trim();
    const fatherOccupation = String(
      st.fatherOccupation ||
        st["Father Occupation"] ||
        st["Father's Occupation"] ||
        st.father_occupation ||
        "",
    ).trim();

    // Mother details
    const motherName = String(
      st.motherName ||
        st["Mother Name"] ||
        st["Mother's Name"] ||
        st.mother_name ||
        "",
    ).trim();
    const motherPhone = String(
      st.motherPhone ||
        st.motherContactNo ||
        st["Mother Contact No"] ||
        st["Mother Contact"] ||
        st["Mother Phone"] ||
        st.mother_phone ||
        "",
    ).trim();
    const motherOccupation = String(
      st.motherOccupation ||
        st["Mother Occupation"] ||
        st["Mother's Occupation"] ||
        st.mother_occupation ||
        "",
    ).trim();

    // Guardian details
    const guardianName = String(
      st.guardianName ||
        st["Guardian Name"] ||
        st["Guardian's Name"] ||
        st.guardian_name ||
        "",
    ).trim();

    // Parent WhatsApp, DOB, Admission Date
    const parentWhatsapp = String(
      st.parentWhatsapp ||
        st["Parent WhatsApp No"] ||
        st["WhatsApp No"] ||
        st.parent_whatsapp ||
        "",
    ).trim();
    const rawDob =
      st.dob ||
      st.dateOfBirth ||
      st["Date of Birth"] ||
      st["DOB"] ||
      st.date_of_birth ||
      null;
    const rawAdmissionDate =
      st.admissionDate || st.admission_date || st["Admission Date"] || null;
    const dob = rawDob ? toDbDate(rawDob) || rawDob : null;
    const admissionDate = rawAdmissionDate
      ? toDbDate(rawAdmissionDate) || rawAdmissionDate
      : null;

    let parentName = String(
      st.parentName || st["Parent Name"] || st.parent_name || "",
    ).trim();
    if (!parentName && (fatherName || motherName || guardianName)) {
      parentName =
        fatherName && motherName
          ? `${fatherName} / ${motherName}`
          : fatherName || motherName || guardianName || "";
    }
    let parentPhone = String(
      st.parentPhone ||
        st["Parent Phone"] ||
        st.parentSmsNumber ||
        st.parent_sms_number ||
        "",
    ).trim();
    if (!parentPhone && (fatherPhone || motherPhone || parentWhatsapp)) {
      parentPhone = fatherPhone || motherPhone || parentWhatsapp || "";
    }

    const parentEmail = String(
      st.parentEmail || st["Parent Email"] || st.parent_email || "",
    ).trim();
    const studentEmail = String(
      st.studentEmail || st["Student Email"] || st.email || "",
    ).trim();
    const gender = normalizeGender(
      st.gender || st["Gender"] || st["gender"] || st.sex || st["Sex"] || "",
    );

    // Class/section resolution: auto-creates on the fly and reuses for subsequent students in the same sheet
    const rawClassVal = extractClassRaw(st);
    const rawSection = extractSectionRaw(st);
    const parsedCls = parseClassValue(rawClassVal);
    const classNumber = parsedCls.classNumber;
    const classLabel = parsedCls.classLabel;

    let sectionName =
      String(rawSection)
        .replace(/^section\s*/i, "")
        .trim()
        .toUpperCase() || "A";

    const classId = await ensureClassInDb(classNumber);
    const sectionId = await ensureSectionInDb(classId, sectionName);

    if (!firstName)
      errors.push({
        row: rowNum,
        field: "First Name",
        message: "First Name is required",
      });
    if (!lastName)
      errors.push({
        row: rowNum,
        field: "Last Name",
        message: "Last Name is required",
      });
    if (!dob)
      errors.push({
        row: rowNum,
        field: "Date of Birth",
        message: "Date of Birth is required",
      });
    if (!parentPhone && !fatherPhone && !motherPhone) {
      errors.push({
        row: rowNum,
        field: "Father Contact No",
        message: "Father Contact No (or Parent Phone) is required",
      });
    }
    if (!parsedCls.valid)
      errors.push({
        row: rowNum,
        field: "Class",
        message: parsedCls.error || "Invalid class",
      });

    const normAdm = normalizeAdmissionNumber(admissionNumber)?.toLowerCase();
    if (!admissionNumber) {
      errors.push({
        row: rowNum,
        field: "Admission Number",
        message: "Admission Number is required",
      });
    } else if (normAdm && seenAdmNums.has(normAdm)) {
      errors.push({
        row: rowNum,
        field: "Admission Number",
        message: `Duplicate admission number '${admissionNumber}' in this batch (already used in row ${seenAdmNums.get(normAdm)})`,
      });
    } else if (normAdm) {
      seenAdmNums.set(normAdm, rowNum);
    }

    const normRoll = normalizeRollNumber(rollNumber)?.toLowerCase();
    if (!rollNumber) {
      errors.push({
        row: rowNum,
        field: "Roll Number",
        message: "Roll Number is required",
      });
    } else if (normRoll && parsedCls.valid) {
      const rollKey = `${classNumber}_${sectionName}_${normRoll}`;
      if (seenRollKeys.has(rollKey)) {
        errors.push({
          row: rowNum,
          field: "Roll Number",
          message: `Duplicate roll number '${rollNumber}' for ${classLabel} Section ${sectionName} in this file (already used in row ${seenRollKeys.get(rollKey)})`,
        });
      } else {
        seenRollKeys.set(rollKey, rowNum);
      }
    }

    const normEmail = normalizeEmail(studentEmail);
    if (studentEmail) {
      if (!EMAIL_REGEX.test(studentEmail)) {
        errors.push({
          row: rowNum,
          field: "Student Email",
          message: `Invalid student email format '${studentEmail}'`,
        });
      } else if (normEmail && seenStudentEmails.has(normEmail)) {
        errors.push({
          row: rowNum,
          field: "Student Email",
          message: `Duplicate student email '${studentEmail}' in this batch (already used in row ${seenStudentEmails.get(normEmail)})`,
        });
      } else if (normEmail) {
        seenStudentEmails.set(normEmail, rowNum);
      }
    }

    if (parentEmail && !EMAIL_REGEX.test(parentEmail)) {
      errors.push({
        row: rowNum,
        field: "Parent Email",
        message: `Invalid parent email format '${parentEmail}'`,
      });
    }

    if (errors.filter((e) => e.row === rowNum).length === 0) {
      validRows.push({
        rowNum,
        firstName,
        middleName,
        lastName,
        name,
        rollNumber,
        admissionNumber,
        gender,
        dob,
        admissionDate,
        parentName,
        parentPhone,
        parentEmail,
        studentEmail,
        fatherName,
        fatherPhone,
        fatherOccupation,
        motherName,
        motherPhone,
        motherOccupation,
        guardianName,
        parentWhatsapp,
        classId,
        classNumber,
        classLabel,
        sectionId,
        sectionName,
      });
    }
  }

  // Strict All-or-Nothing Pre-Validation Guarantee: If ANY row has errors, abort entire import
  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      errors,
      message: `Validation failed for ${errors.length} record(s). The entire import has been cancelled and no data was stored in the database.`,
    });
  }

  // Pre-validate all rows against database records (admission numbers, student emails, roll numbers)
  if (isPostgresConfigured) {
    const dbConflictErrors = await preValidateBulkImport({
      schoolId,
      academicYearId: bulkSessionId,
      rows: validRows,
    });
    if (dbConflictErrors.length > 0) {
      return res.status(422).json({
        success: false,
        errors: dbConflictErrors,
        message: `Validation failed against existing database records for ${dbConflictErrors.length} record(s). The entire import has been cancelled and no data was stored in the database.`,
      });
    }
  }

  const createdList: any[] = [];

  // PostgreSQL Atomic Transaction
  if (isPostgresConfigured) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const isAyUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          String(bulkSessionId),
        );
      const safeAyId = isAyUuid ? bulkSessionId : null;

      // Fast Bulk Multi-Row Direct Insert for all validated records (all-or-nothing)
      if (validRows.length > 0) {
        const CHUNK_SIZE = 500;
        for (let c = 0; c < validRows.length; c += CHUNK_SIZE) {
          const chunk = validRows.slice(c, c + CHUNK_SIZE);
          const valuesChunks: string[] = [];
          const params: any[] = [schoolId, safeAyId];
          let pIdx = 3;

          for (const st of chunk) {
            valuesChunks.push(
              `($1, $2, ${pIdx}, ${pIdx + 1}, ${pIdx + 2}, ${pIdx + 3}, ${pIdx + 4}, ${pIdx + 5}, ${pIdx + 6}, ${pIdx + 7}, ${pIdx + 8}, ${pIdx + 9}, ${pIdx + 10}, ${pIdx + 11}, ${pIdx + 12}, ${pIdx + 13}, ${pIdx + 14}, ${pIdx + 15}, ${pIdx + 16}, ${pIdx + 17}, ${pIdx + 18}, ${pIdx + 19}, ${pIdx + 20}, ${pIdx + 21}, ${pIdx + 22}, null)`,
            );
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
              st.parentEmail || null,
              st.fatherName || null,
              st.fatherPhone || null,
              st.fatherOccupation || null,
              st.motherName || null,
              st.motherPhone || null,
              st.motherOccupation || null,
              st.parentWhatsapp || null,
              st.dob || null,
              st.admissionDate || null,
              st.firstName || null,
              st.middleName || null,
              st.lastName || null,
              st.guardianName || null,
            );
            pIdx += 23;
          }

          const insertSql = `
            INSERT INTO students(
              school_id, academic_year_id, class_id, section_id, roll_number, 
              admission_number, name, gender, parent_name, parent_sms_number, email, parent_email,
              father_name, father_phone, father_occupation,
              mother_name, mother_phone, mother_occupation,
              parent_whatsapp, date_of_birth, admission_date,
              first_name, middle_name, last_name, guardian_name,
              user_id
            )
            VALUES ${valuesChunks.join(", ")}

            RETURNING *
          `;

          const insQ = await client.query(insertSql, params);
          const metaMap = new Map<string, any>();
          for (const st of chunk) {
            metaMap.set(`${st.classId}_${st.sectionId}_${st.rollNumber}`, st);
          }
          for (const row of insQ.rows) {
            const meta = metaMap.get(
              `${row.class_id}_${row.section_id}_${row.roll_number}`,
            );
            createdList.push({
              ...row,
              first_name: row.first_name || meta?.firstName || null,
              firstName: row.first_name || meta?.firstName || null,
              middle_name: row.middle_name || meta?.middleName || null,
              middleName: row.middle_name || meta?.middleName || null,
              last_name: row.last_name || meta?.lastName || null,
              lastName: row.last_name || meta?.lastName || null,
              gender: row.gender || meta?.gender || null,
              date_of_birth: row.date_of_birth || meta?.dob || null,
              dob: row.date_of_birth || meta?.dob || null,
              admission_date: row.admission_date || meta?.admissionDate || null,
              admissionDate: row.admission_date || meta?.admissionDate || null,
              father_name: row.father_name || meta?.fatherName || null,
              fatherName: row.father_name || meta?.fatherName || null,
              father_phone: row.father_phone || meta?.fatherPhone || null,
              fatherPhone: row.father_phone || meta?.fatherPhone || null,
              father_occupation:
                row.father_occupation || meta?.fatherOccupation || null,
              fatherOccupation:
                row.father_occupation || meta?.fatherOccupation || null,
              mother_name: row.mother_name || meta?.motherName || null,
              motherName: row.mother_name || meta?.motherName || null,
              mother_phone: row.mother_phone || meta?.motherPhone || null,
              motherPhone: row.mother_phone || meta?.motherPhone || null,
              mother_occupation:
                row.mother_occupation || meta?.motherOccupation || null,
              motherOccupation:
                row.mother_occupation || meta?.motherOccupation || null,
              guardian_name: row.guardian_name || meta?.guardianName || null,
              guardianName: row.guardian_name || meta?.guardianName || null,
              parent_whatsapp:
                row.parent_whatsapp || meta?.parentWhatsapp || null,
              parentWhatsapp:
                row.parent_whatsapp || meta?.parentWhatsapp || null,
              academic_year_id: bulkSessionId,
              session_id: bulkSessionId,
              session_name: bulkSessionName,
              session: bulkSessionName || bulkSessionId,
              full_name: row.name,
              class_number: meta?.classNumber,
              class_label: meta?.classLabel,
              section_name: meta?.sectionName,
              is_active: true,
            });
          }
        }
      }

      // Strict sanity check: createdList length must match validRows length
      if (createdList.length !== validRows.length) {
        throw new Error(
          `Incomplete batch insert: processed ${createdList.length} of ${validRows.length} records`,
        );
      }

      await client.query("COMMIT");
      client.release();

      // Only now update in-memory store and Firestore
      if (createdList.length > 0) {
        demoStudents.unshift(...createdList.slice(0, 100));
        if (demoStudents.length > 5000) demoStudents.length = 5000;
      }

      // Background Firestore sync (non-blocking bulk batch)
      if (isFirebaseConfigured()) {
        setImmediate(() => {
          syncStudentsBulkToFirestore(createdList.slice(0, 500)).catch(
            () => {},
          );
        });
      }

      // Student Email Automation on Bulk Import (only executed if explicitly requested)
      const sendInviteEmail = req.body?.sendInviteEmail === true;
      if (sendInviteEmail && createdList.length > 0) {
        setImmediate(async () => {
          for (const st of createdList) {
            const studentEmail = String(st.email || st.student_email || "")
              .trim()
              .toLowerCase();
            const parentEmail = String(st.parent_email || "")
              .trim()
              .toLowerCase();
            const loginOption =
              st.login_option ||
              st.loginOption ||
              (studentEmail ? "STUDENT" : parentEmail ? "PARENT" : "NONE");
            if (loginOption !== "NONE") {
              const isParent = loginOption === "PARENT";
              const targetLoginEmail = isParent
                ? parentEmail || studentEmail
                : studentEmail || parentEmail;
              if (targetLoginEmail) {
                createAndSendPasswordReset({
                  email: targetLoginEmail,
                  name: st.name || st.full_name,
                  role: isParent ? "PARENT" : "STUDENT",
                  schoolId: schoolId || undefined,
                  schoolName: req.user?.schoolName || "School",
                  req,
                  sendEmail: false,
                })
                  .then((resetInfo) => {
                    if (resetInfo?.resetUrl) {
                      queueEmailNotification({
                        schoolId: schoolId || "school-default",
                        recipientEmail: targetLoginEmail,
                        recipientName: isParent
                          ? st.parent_name || "Parent"
                          : st.name || st.full_name,
                        recipientType: isParent ? "PARENT" : "STUDENT",
                        templateKey: isParent
                          ? "PARENT_CREATED"
                          : "STUDENT_CREATED",
                        templateData: {
                          student_name: st.name || st.full_name,
                          school_name: req.user?.schoolName || "School",
                          admission_number: String(
                            st.admission_number || st.admissionNumber || "—",
                          ),
                          class_name: String(
                            st.class_number || st.class_name || "",
                          ),
                          section_name: String(st.section_name || "A"),
                          roll_number: String(st.roll_number || ""),
                          login_email: targetLoginEmail,
                          reset_link: resetInfo.resetUrl,
                          login_url: resetInfo.resetUrl,
                        },
                        idempotencyKey: `stu-welcome-${schoolId || "default"}-${targetLoginEmail}-${st.admission_number || Date.now()}`,
                      }).catch((err) => {
                        console.warn(
                          "[BulkStudentEnrollment] SMTP network/dispatch error:",
                          err.message,
                        );
                      });
                    }
                  })
                  .catch((err) => {
                    console.warn(
                      "[BulkStudentEnrollment] Error generating reset link:",
                      err.message,
                    );
                  });
              }
            }
          }
        });
      }

      return res
        .status(201)
        .json({
          success: true,
          count: createdList.length,
          items: createdList,
          session: bulkSessionName,
        });
    } catch (txErr: any) {
      await client.query("ROLLBACK");
      client.release();
      const isUniqueErr = txErr.code === "23505";
      const status = isUniqueErr ? 409 : 400;
      let msg = txErr.message || "Database transaction error";
      if (isUniqueErr) {
        const constraint = txErr.constraint || "";
        if (
          constraint.includes("admission") ||
          txErr.detail?.includes("admission_number")
        ) {
          msg =
            "An admission number in this import already exists in the school database.";
        } else if (
          constraint.includes("roll") ||
          txErr.detail?.includes("roll_number")
        ) {
          msg =
            "A roll number in this import is already assigned in the class and section for this session.";
        } else if (
          constraint.includes("email") ||
          txErr.detail?.includes("email")
        ) {
          msg =
            "A student email in this import already exists in the database.";
        }
      }
      return res.status(status).json({
        success: false,
        message: `Student bulk import failed: ${msg}. The entire operation was cancelled and no student records were stored in the database.`,
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
            middle_name: st.middleName || null,
            last_name: st.lastName || null,
            firstName: st.firstName || null,
            middleName: st.middleName || null,
            lastName: st.lastName || null,
            roll_number: st.rollNumber,
            admission_number: st.admissionNumber,
            admissionNumber: st.admissionNumber,
            gender: st.gender || null,
            parent_name: st.parentName || "—",
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
            is_active: true,
          };
          batch.set(docRef, studentObj);
          stagedList.push(studentObj);
        }
        await batch.commit();
        demoStudents.unshift(...stagedList.slice(0, 100));
        return res
          .status(201)
          .json({
            success: true,
            count: stagedList.length,
            items: stagedList,
            session: bulkSessionName,
          });
      } catch (fsErr: any) {
        return res.status(500).json({
          success: false,
          message: `Bulk import failed in Cloud Firestore: ${fsErr.message}. The entire operation was cancelled and no data was saved.`,
        });
      }
    } else {
      const stagedList: any[] = [];
      for (const st of validRows) {
        const studentObj = {
          id: `st-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: st.name,
          first_name: st.firstName || null,
          middle_name: st.middleName || null,
          last_name: st.lastName || null,
          firstName: st.firstName || null,
          middleName: st.middleName || null,
          lastName: st.lastName || null,
          roll_number: st.rollNumber,
          admission_number: st.admissionNumber,
          admissionNumber: st.admissionNumber,
          gender: st.gender || null,
          parent_name: st.parentName || "—",
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
          is_active: true,
        };
        stagedList.push(studentObj);
        registerDemoUser({
          id: studentObj.id,
          schoolId,
          name: studentObj.name,
          email:
            studentObj.email ||
            `student.${String(studentObj.admission_number || studentObj.id).toLowerCase()}@portal.local`,
          role: "STUDENT",
          password: "ChangeMe123!",
          admissionNumber: studentObj.admission_number,
        });
      }
      demoStudents.unshift(...stagedList);
      return res
        .status(201)
        .json({
          success: true,
          count: stagedList.length,
          items: stagedList,
          session: bulkSessionName,
        });
    }
  }
});

r.post("/students/bulk-delete", ...admin, async (req: AuthRequest, res) => {
  const { ids = [] } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0)
    return res.status(400).json({ message: "Array of IDs required" });
  const sid = req.user!.schoolId;
  const uuidIds = ids.filter(isUuid);

  if (isPostgresConfigured && uuidIds.length > 0) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 1. Clean non-cascading FK references
      await client.query(
        `DELETE FROM attendance_records WHERE student_id = ANY($1::uuid[])`,
        [uuidIds],
      );
      await client.query(
        `DELETE FROM attendance_sync_items WHERE student_id = ANY($1::uuid[])`,
        [uuidIds],
      );
      await client.query(
        `DELETE FROM sms_logs WHERE student_id = ANY($1::uuid[])`,
        [uuidIds],
      );
      await client.query(
        `DELETE FROM student_promotions WHERE student_id = ANY($1::uuid[])`,
        [uuidIds],
      );

      // Collect user_ids if students have linked user accounts
      const userRes = await client.query(
        `SELECT user_id FROM students WHERE id = ANY($1::uuid[]) AND school_id = $2 AND user_id IS NOT NULL`,
        [uuidIds, sid],
      );
      const userIds = userRes.rows.map((r: any) => r.user_id).filter(Boolean);

      // 2. Permanently delete student records from PostgreSQL
      await client.query(
        `DELETE FROM students WHERE id = ANY($1::uuid[]) AND school_id = $2`,
        [uuidIds, sid],
      );

      // 3. Delete linked user login records if any
      if (userIds.length > 0) {
        await client.query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [
          userIds,
        ]);
      }

      await client.query("COMMIT");
    } catch (delErr: any) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("[BulkDeleteStudents] Transaction error:", delErr);
      return res
        .status(400)
        .json({
          success: false,
          message: `Bulk delete failed: ${delErr.message}. No records were modified.`,
        });
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

r.get("/students/:id", ...admin, async (req: AuthRequest, res) => {
  const studentId = String(req.params.id);
  const schoolId = req.user!.schoolId;

  try {
    const q = await pool.query(
      `SELECT st.*, st.email AS student_email,
       c.id AS class_id, c.class_number, sec.id AS section_id, sec.name AS section_name,
       ay.name AS session_name,
       CASE WHEN c.class_number = -1 THEN 'L-KG' 
            WHEN c.class_number = 0 THEN 'U-KG' 
            WHEN c.class_number IS NOT NULL THEN 'Class ' || c.class_number 
            ELSE '' END AS class_name
       FROM students st 
       LEFT JOIN classes c ON c.id=st.class_id 
       LEFT JOIN sections sec ON sec.id=st.section_id
       LEFT JOIN academic_years ay ON ay.id=st.academic_year_id
       WHERE (st.id::text=$1 OR st.user_id::text=$1) AND st.school_id=$2 LIMIT 1`,
      [studentId, schoolId],
    );
    if (q.rowCount && q.rows.length > 0) {
      const row = q.rows[0];
      return res.json({
        ...row,
        gender: normalizeGender(row.gender) || "",
        date_of_birth: row.date_of_birth instanceof Date ? row.date_of_birth.toISOString().slice(0, 10) : (row.date_of_birth ? String(row.date_of_birth).split('T')[0].split(' ')[0] : null),
        guardian_name: row.guardian_name || "",
        guardianName: row.guardian_name || "",
        is_active: row.is_active !== false,
        status: row.is_active !== false ? "ACTIVE" : "INACTIVE",
      });
    }
  } catch {}

  if (isFirebaseConfigured()) {
    try {
      const doc = await collections.students().doc(studentId).get();
      if (doc.exists) {
        return res.json({ id: doc.id, ...doc.data() });
      }
    } catch {}
  }

  const mem = demoStudents.find((s) => s.id === studentId);
  if (mem) return res.json(mem);

  return res.status(404).json({ message: "Student not found" });
});

r.put("/students/:id", ...admin, async (req: AuthRequest, res) => {
  const {
    name,
    firstName: rawFirst,
    lastName: rawLast,
    rollNumber,
    roll_number,
    admissionNumber,
    admission_number,
    parentName,
    parent_name,
    parentSmsNumber,
    parentPhone,
    parent_sms_number,
    fatherName,
    father_name,
    fatherPhone,
    father_phone,
    fatherContact,
    father_contact,
    fatherContactNo,
    fatherOccupation,
    father_occupation,
    motherName,
    mother_name,
    motherPhone,
    mother_phone,
    motherContact,
    mother_contact,
    motherContactNo,
    motherOccupation,
    mother_occupation,
    guardianName,
    guardian_name,
    parentWhatsapp,
    parent_whatsapp,
    parentWhatsappNo,
    parent_whatsapp_no,
    admissionDate,
    admission_date,
    studentEmail,
    email,
    parentEmail,
    parent_email,
    classId,
    class_id,
    sectionId,
    section_id,
    sessionId,
    session,
    academic_year_id,
    gender,
    dob,
    dateOfBirth,
    date_of_birth,
    address,
    is_active,
    status,
    password,
  } = req.body || {};

  const studentId = String(req.params.id);
  const schoolId = req.user!.schoolId;

  // Active / Deactive resolution
  let resolvedIsActive = true;
  if (is_active !== undefined) {
    resolvedIsActive =
      is_active === true ||
      is_active === "true" ||
      is_active === "ACTIVE" ||
      is_active === "active";
  } else if (status !== undefined) {
    resolvedIsActive = String(status).toUpperCase() === "ACTIVE";
  }
  const resolvedStatus = resolvedIsActive ? "ACTIVE" : "INACTIVE";

  // Password validation if specified
  if (password && String(password).trim()) {
    const pwValidation = validatePasswordStrength(String(password).trim());
    if (!pwValidation.valid) {
      return res.status(400).json({ message: pwValidation.message });
    }
  }

  let newPasswordHash: string | undefined = undefined;
  if (password && String(password).trim()) {
    newPasswordHash = await bcrypt.hash(String(password).trim(), 10);
  }

  const EMAIL_FORMAT_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const cleanStudentEmail = String(studentEmail || email || "")
    .trim()
    .toLowerCase();
  const cleanParentEmail = String(parentEmail || parent_email || "")
    .trim()
    .toLowerCase();
  if (cleanStudentEmail && !EMAIL_FORMAT_REGEX.test(cleanStudentEmail)) {
    return res
      .status(400)
      .json({ message: "Please provide a valid student email address." });
  }
  if (cleanParentEmail && !EMAIL_FORMAT_REGEX.test(cleanParentEmail)) {
    return res
      .status(400)
      .json({ message: "Please provide a valid parent email address." });
  }

  const cleanAdmissionNumber = String(
    admissionNumber || admission_number || "",
  ).trim();
  if (cleanAdmissionNumber && !/^\d+$/.test(cleanAdmissionNumber)) {
    return res
      .status(400)
      .json({ message: "Admission Number must contain only numbers." });
  }

  const cleanRollNumber = String(
    rollNumber !== undefined
      ? rollNumber
      : roll_number !== undefined
        ? roll_number
        : "",
  ).trim();
  if (cleanRollNumber && !/^\d+$/.test(cleanRollNumber)) {
    return res
      .status(400)
      .json({ message: "Roll Number must contain only numbers." });
  }

  // Father, Mother, WhatsApp, Admission Date extraction
  const cleanFatherName =
    fatherName !== undefined || father_name !== undefined
      ? String(fatherName || father_name || "").trim()
      : undefined;
  const cleanFatherPhone =
    fatherPhone !== undefined ||
    father_phone !== undefined ||
    fatherContact !== undefined ||
    father_contact !== undefined ||
    fatherContactNo !== undefined
      ? String(
          fatherPhone ||
            father_phone ||
            fatherContact ||
            father_contact ||
            fatherContactNo ||
            "",
        ).trim()
      : undefined;
  const cleanFatherOccupation =
    fatherOccupation !== undefined || father_occupation !== undefined
      ? String(fatherOccupation || father_occupation || "").trim()
      : undefined;
  const cleanMotherName =
    motherName !== undefined || mother_name !== undefined
      ? String(motherName || mother_name || "").trim()
      : undefined;
  const cleanMotherPhone =
    motherPhone !== undefined ||
    mother_phone !== undefined ||
    motherContact !== undefined ||
    mother_contact !== undefined ||
    motherContactNo !== undefined
      ? String(
          motherPhone ||
            mother_phone ||
            motherContact ||
            mother_contact ||
            motherContactNo ||
            "",
        ).trim()
      : undefined;
  const cleanMotherOccupation =
    motherOccupation !== undefined || mother_occupation !== undefined
      ? String(motherOccupation || mother_occupation || "").trim()
      : undefined;
  const cleanGuardianName =
    guardianName !== undefined || guardian_name !== undefined
      ? String(guardianName || guardian_name || "").trim()
      : undefined;
  const cleanParentWhatsapp =
    parentWhatsapp !== undefined ||
    parent_whatsapp !== undefined ||
    parentWhatsappNo !== undefined ||
    parent_whatsapp_no !== undefined
      ? String(
          parentWhatsapp ||
            parent_whatsapp ||
            parentWhatsappNo ||
            parent_whatsapp_no ||
            "",
        ).trim()
      : undefined;
  const rawAdmissionDate =
    (admissionDate || admission_date) !== undefined
      ? admissionDate || admission_date || null
      : undefined;
  const cleanAdmissionDate =
    rawAdmissionDate !== undefined
      ? rawAdmissionDate
        ? toDbDate(rawAdmissionDate) || rawAdmissionDate
        : null
      : undefined;

  // Year validation for Date of Birth & Admission Date: cannot exceed 4 digits
  const validate4DigitYear = (dateStr: any, label: string) => {
    if (!dateStr) return null;
    const yr = String(dateStr).trim().split("-")[0];
    if (
      yr &&
      (yr.length > 4 || parseInt(yr, 10) > 9999 || parseInt(yr, 10) < 1000)
    ) {
      return `${label} year must be a 4-digit number (e.g. 2026).`;
    }
    return null;
  };
  const rawDob = dob || dateOfBirth || date_of_birth;
  if (rawDob) {
    const dobYrErr = validate4DigitYear(rawDob, "Date of Birth");
    if (dobYrErr) return res.status(400).json({ message: dobYrErr });
  }
  if (rawAdmissionDate) {
    const admYrErr = validate4DigitYear(rawAdmissionDate, "Admission Date");
    if (admYrErr) return res.status(400).json({ message: admYrErr });
  }

  let cleanParentName = String(
    parentName !== undefined
      ? parentName
      : parent_name !== undefined
        ? parent_name
        : "",
  ).trim();
  if (!cleanParentName && (cleanFatherName || cleanMotherName)) {
    cleanParentName =
      cleanFatherName && cleanMotherName
        ? `${cleanFatherName} / ${cleanMotherName}`
        : cleanFatherName || cleanMotherName || "";
  }
  let cleanParentPhone = String(
    parentSmsNumber !== undefined
      ? parentSmsNumber
      : parentPhone !== undefined
        ? parentPhone
        : parent_sms_number !== undefined
          ? parent_sms_number
          : "",
  ).trim();
  if (
    !cleanParentPhone &&
    (cleanFatherPhone || cleanMotherPhone || cleanParentWhatsapp)
  ) {
    cleanParentPhone =
      cleanFatherPhone || cleanMotherPhone || cleanParentWhatsapp || "";
  }

  const rawMiddle = req.body.middleName || req.body.middle_name;
  const firstName = String(rawFirst !== undefined ? rawFirst : "").trim().toUpperCase();
  const middleName = String(rawMiddle !== undefined ? rawMiddle : "").trim().toUpperCase();
  const lastName = String(rawLast !== undefined ? rawLast : "").trim().toUpperCase();

  if (rawFirst !== undefined) {
    if (!firstName) {
      return res
        .status(400)
        .json({ message: "First Name is a required field." });
    }
    if (firstName.length < 3 || firstName.length > 15) {
      return res
        .status(400)
        .json({ message: "First Name must be between 3 and 15 characters." });
    }
    if (/\s/.test(firstName)) {
      return res
        .status(400)
        .json({ message: "Spaces are not allowed in First Name." });
    }
    if (/\d/.test(firstName)) {
      return res
        .status(400)
        .json({
          message:
            "First Name must contain only letters, numbers are not allowed.",
        });
    }
  }
  if (middleName && /\d/.test(middleName)) {
    return res
      .status(400)
      .json({
        message:
          "Middle Name must contain only letters, numbers are not allowed.",
      });
  }
  if (lastName && /\d/.test(lastName)) {
    return res
      .status(400)
      .json({
        message:
          "Last Name must contain only letters, numbers are not allowed.",
      });
  }

  const fullName = (
    [firstName, middleName, lastName].filter(Boolean).join(" ") ||
    (firstName && lastName
      ? `${firstName} ${lastName}`
      : firstName || lastName || String(name || "").trim())
  ).toUpperCase();

  const resolvedClassId = String(classId || class_id || "").trim();
  const resolvedSectionId = String(sectionId || section_id || "").trim();

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
  const putSecName =
    strPutSecId === "B" ||
    strPutSecId.endsWith("-B") ||
    strPutSecId.endsWith("_B")
      ? "B"
      : "A";
  const putClassLabel =
    putClsNum === -1 ? "L-KG" : putClsNum === 0 ? "U-KG" : `Class ${putClsNum}`;

  const resolvedSession = String(
    session || sessionId || academic_year_id || "",
  ).trim();

  // Try PostgreSQL if available
  try {
    await ensureSchoolClassesAndSections(schoolId);
    const isStudentUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        studentId,
      );
    const isAyUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        resolvedSession,
      );

    let existStu: any = null;
    if (isStudentUuid) {
      const existQ = await pool.query(
        "SELECT * FROM students WHERE id=$1 AND school_id=$2",
        [studentId, schoolId],
      );
      if (existQ.rowCount && existQ.rows.length > 0) {
        existStu = existQ.rows[0];
      }
    }

    let realPutClassId = resolvedClassId || existStu?.class_id || "";
    let realPutSectionId = resolvedSectionId || existStu?.section_id || "";
    const isPutClassUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        realPutClassId,
      );
    const isPutSecUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        realPutSectionId,
      );

    if (
      (resolvedClassId && !isPutClassUuid) ||
      (resolvedSectionId && !isPutSecUuid)
    ) {
      try {
        const v = await pool.query(
          `SELECT s.id AS section_id, c.id AS class_id 
           FROM sections s 
           JOIN classes c ON c.id = s.class_id 
           WHERE s.school_id = $1::uuid 
             AND (c.id = $2::uuid OR c.class_number = $3)
             AND UPPER(s.name) = UPPER($4)
           LIMIT 1`,
          [
            schoolId,
            isPutClassUuid
              ? realPutClassId
              : "00000000-0000-0000-0000-000000000000",
            putClsNum,
            putSecName,
          ],
        );
        if (v.rowCount && v.rows.length > 0) {
          if (!isPutClassUuid) realPutClassId = v.rows[0].class_id;
          if (!isPutSecUuid) realPutSectionId = v.rows[0].section_id;
        }
      } catch {}
    }

    const effectiveClassId =
      (isPutClassUuid ? realPutClassId : null) || existStu?.class_id || null;
    const effectiveSectionId =
      (isPutSecUuid ? realPutSectionId : null) || existStu?.section_id || null;
    const effectiveAyId = isAyUuid
      ? resolvedSession
      : existStu?.academic_year_id || null;
    const effectiveAdmNum =
      cleanAdmissionNumber || existStu?.admission_number || null;
    const effectiveRollNum = cleanRollNumber || existStu?.roll_number || null;
    const effectiveEmail = cleanStudentEmail || existStu?.email || null;

    const cleanParentSms = String(parentSmsNumber || parentPhone || parent_sms_number || "").trim();
    const effectivePhone = cleanParentSms || existStu?.parent_sms_number || null;
    if (isPostgresConfigured) {
      const uniquenessResult = await validateStudentUniqueness({
        schoolId,
        academicYearId: effectiveAyId,
        classId: effectiveClassId,
        sectionId: effectiveSectionId,
        admissionNumber: effectiveAdmNum,
        rollNumber: effectiveRollNum,
        studentEmail: effectiveEmail,
        studentPhone: effectivePhone,
        familyInfo: {
          fatherName: cleanFatherName !== undefined ? cleanFatherName : (existStu?.father_name || null),
          motherName: cleanMotherName !== undefined ? cleanMotherName : (existStu?.mother_name || null),
          parentName: cleanParentName !== undefined ? cleanParentName : (existStu?.parent_name || null),
          guardianName: cleanGuardianName !== undefined ? cleanGuardianName : (existStu?.guardian_name || null),
        },
        excludeStudentId: studentId,
      });
      if (!uniquenessResult.valid) {
        return res.status(409).json({
          message:
            uniquenessResult.errors[0]?.message ||
            "Student validation conflict.",
          errors: uniquenessResult.errors,
        });
      }
    }

    const cleanGender = gender !== undefined ? normalizeGender(gender) : null;
    const rawDob =
      (dob || dateOfBirth || date_of_birth) !== undefined
        ? dob || dateOfBirth || date_of_birth || null
        : null;
    const cleanDob = rawDob !== null ? toDbDate(rawDob) || rawDob : null;
    const cleanAddress = address !== undefined ? address || null : null;

    if (isStudentUuid) {
      const q = await pool.query(
        `UPDATE students SET
           name=COALESCE(NULLIF($1, ''), name),
           roll_number=COALESCE(NULLIF($2, ''), roll_number),
           admission_number=COALESCE(NULLIF($3, ''), admission_number),
           parent_name=COALESCE(NULLIF($4, ''), parent_name),
           parent_sms_number=COALESCE(NULLIF($5, ''), parent_sms_number),
           email=COALESCE(NULLIF($6, ''), email),
           parent_email=COALESCE(NULLIF($7, ''), parent_email),
           class_id=COALESCE($8, class_id),
           section_id=COALESCE($9, section_id),
           academic_year_id=COALESCE($10, academic_year_id),
           gender=COALESCE($13, gender),
           date_of_birth=COALESCE($14, date_of_birth),
           address=COALESCE($15, address),
           is_active=$16,
           father_name=COALESCE($17, father_name),
           father_phone=COALESCE($18, father_phone),
           father_occupation=COALESCE($19, father_occupation),
           mother_name=COALESCE($20, mother_name),
           mother_phone=COALESCE($21, mother_phone),
           mother_occupation=COALESCE($22, mother_occupation),
           parent_whatsapp=COALESCE($23, parent_whatsapp),
           admission_date=COALESCE($24, admission_date),
           first_name=COALESCE(NULLIF($25, ''), first_name),
           middle_name=COALESCE(NULLIF($26, ''), middle_name),
           last_name=COALESCE(NULLIF($27, ''), last_name),
           guardian_name=COALESCE($28, guardian_name),
           updated_at=NOW()
         WHERE id=$11 AND school_id=$12 RETURNING *`,
        [
          fullName || name || null,
          cleanRollNumber || null,
          cleanAdmissionNumber || null,
          cleanParentName || null,
          cleanParentPhone || null,
          cleanStudentEmail || null,
          cleanParentEmail || null,
          isPutClassUuid ? realPutClassId : null,
          isPutSecUuid ? realPutSectionId : null,
          isAyUuid ? resolvedSession : null,
          studentId,
          schoolId,
          cleanGender,
          cleanDob,
          cleanAddress,
          resolvedIsActive,
          cleanFatherName !== undefined ? cleanFatherName || null : null,
          cleanFatherPhone !== undefined ? cleanFatherPhone || null : null,
          cleanFatherOccupation !== undefined
            ? cleanFatherOccupation || null
            : null,
          cleanMotherName !== undefined ? cleanMotherName || null : null,
          cleanMotherPhone !== undefined ? cleanMotherPhone || null : null,
          cleanMotherOccupation !== undefined
            ? cleanMotherOccupation || null
            : null,
          cleanParentWhatsapp !== undefined
            ? cleanParentWhatsapp || null
            : null,
          cleanAdmissionDate !== undefined ? cleanAdmissionDate || null : null,
          firstName || null,
          middleName || null,
          lastName || null,
          cleanGuardianName !== undefined ? cleanGuardianName || null : null,
        ],
      );
      if (q.rowCount && q.rows.length > 0) {
        let studentUserId = q.rows[0].user_id;

        // Try to locate user row by email if user_id is unlinked
        if (!studentUserId && cleanStudentEmail) {
          const uLookup = await pool.query(
            `SELECT id FROM users WHERE LOWER(email)=$1 LIMIT 1`,
            [cleanStudentEmail],
          );
          if (uLookup.rowCount && uLookup.rows.length > 0) {
            studentUserId = uLookup.rows[0].id;
          }
        }

        // If user row exists, sync credentials and status
        if (studentUserId) {
          if (newPasswordHash) {
            await pool.query(
              `UPDATE users SET
                 name = COALESCE($1, name),
                 email = COALESCE($2, email),
                 is_active = $3,
                 password_hash = $4,
                 updated_at = NOW()
               WHERE id = $5`,
              [
                fullName || name || null,
                cleanStudentEmail || null,
                resolvedIsActive,
                newPasswordHash,
                studentUserId,
              ],
            );
          } else {
            await pool.query(
              `UPDATE users SET
                 name = COALESCE($1, name),
                 email = COALESCE($2, email),
                 is_active = $3,
                 updated_at = NOW()
               WHERE id = $4`,
              [
                fullName || name || null,
                cleanStudentEmail || null,
                resolvedIsActive,
                studentUserId,
              ],
            );
          }

          if (!q.rows[0].user_id) {
            await pool.query(`UPDATE students SET user_id=$1 WHERE id=$2`, [
              studentUserId,
              studentId,
            ]);
          }
        } else if (
          newPasswordHash ||
          cleanStudentEmail ||
          cleanAdmissionNumber
        ) {
          // Provision linked portal user account so student can log in
          const studentLoginEmail =
            cleanStudentEmail ||
            (cleanAdmissionNumber
              ? `student.${cleanAdmissionNumber.toLowerCase().replace(/[^a-z0-9]/g, "")}@${schoolId}.portal`
              : `student.${studentId}@portal.local`);
          const hashToUse =
            newPasswordHash || (await bcrypt.hash("ChangeMe123!", 10));
          try {
            const insUser = await pool.query(
              `INSERT INTO users (school_id, name, email, password_hash, role, is_active, created_at, updated_at)
               VALUES ($1, $2, $3, $4, 'STUDENT', $5, NOW(), NOW())
               ON CONFLICT (email) DO UPDATE SET
                 name = EXCLUDED.name,
                 password_hash = EXCLUDED.password_hash,
                 is_active = EXCLUDED.is_active,
                 updated_at = NOW()
               RETURNING id`,
              [
                schoolId,
                fullName || name,
                studentLoginEmail,
                hashToUse,
                resolvedIsActive,
              ],
            );
            if (insUser.rowCount && insUser.rows.length > 0) {
              studentUserId = insUser.rows[0].id;
              await pool.query(`UPDATE students SET user_id=$1 WHERE id=$2`, [
                studentUserId,
                studentId,
              ]);
            }
          } catch (uErr: any) {
            console.warn(
              "[UpdateStudent] User link creation notice:",
              uErr.message,
            );
          }
        }

        if (schoolId) {
          fastCache.deletePattern(`classes:${schoolId}*`);
      fastCache.deletePattern(`sections:${schoolId}*`);
      fastCache.deletePattern(`reports:${schoolId}*`);
      fastCache.deletePattern(`dashboard:${schoolId}*`);
      fastCache.deletePattern(`students:${schoolId}*`);
          fastCache.deletePattern(`student:`);
        }

        const result = {
          ...q.rows[0],
          name: fullName || q.rows[0].name,
          first_name: firstName || q.rows[0].first_name || null,
          firstName: firstName || q.rows[0].first_name || null,
          middle_name: middleName || q.rows[0].middle_name || null,
          middleName: middleName || q.rows[0].middle_name || null,
          last_name: lastName || q.rows[0].last_name || null,
          lastName: lastName || q.rows[0].last_name || null,
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
          gender: cleanGender !== null ? cleanGender : q.rows[0].gender || null,
          date_of_birth:
            cleanDob !== null ? cleanDob : q.rows[0].date_of_birth || null,
          dob: cleanDob !== null ? cleanDob : q.rows[0].date_of_birth || null,
          address:
            cleanAddress !== null ? cleanAddress : q.rows[0].address || null,
          class_id: realPutClassId || q.rows[0].class_id,
          classId: realPutClassId || q.rows[0].class_id,
          class_number: putClsNum,
          class_label: putClassLabel,
          section_id: realPutSectionId || q.rows[0].section_id,
          sectionId: realPutSectionId || q.rows[0].section_id,
          section_name: putSecName,
          guardian_name:
            cleanGuardianName !== undefined
              ? cleanGuardianName || null
              : q.rows[0].guardian_name || null,
          guardianName:
            cleanGuardianName !== undefined
              ? cleanGuardianName || null
              : q.rows[0].guardian_name || null,
          session:
            resolvedSession ||
            q.rows[0].session_name ||
            q.rows[0].academic_year_id,
          session_name:
            resolvedSession ||
            q.rows[0].session_name ||
            q.rows[0].academic_year_id,
          academic_year_id: resolvedSession || q.rows[0].academic_year_id,
          is_active: resolvedIsActive,
          status: resolvedStatus,
          user_id: studentUserId || q.rows[0].user_id,
        };
        const idx = demoStudents.findIndex((s) => s.id === studentId);
        if (idx >= 0) demoStudents[idx] = { ...demoStudents[idx], ...result };
        else demoStudents.unshift(result);
        syncStudentToFirestore(result).catch(() => {});
        return res.json(result);
      }
    }
  } catch (err: any) {
    console.warn("[UpdateStudent] Database update error:", err.message);
    if (isPostgresConfigured) {
      if (err.code === "23505") {
        const constraint = err.constraint || "";
        let msg = "Duplicate record conflict during student update.";
        if (
          constraint.includes("admission") ||
          err.detail?.includes("admission_number")
        ) {
          msg = `Admission number '${cleanAdmissionNumber}' already exists for this school.`;
        } else if (
          constraint.includes("roll") ||
          err.detail?.includes("roll_number")
        ) {
          msg = `Roll number '${cleanRollNumber}' is already assigned in this section for the selected academic session.`;
        } else if (
          constraint.includes("email") ||
          err.detail?.includes("email")
        ) {
          msg = `Student email '${cleanStudentEmail}' is already registered in this school.`;
        }
        return res.status(409).json({ message: msg });
      }
      return res
        .status(400)
        .json({ message: `Student update failed: ${err.message}` });
    }
  }

  // Pure in-memory fallback uniqueness validation
  if (!isPostgresConfigured) {
    if (cleanAdmissionNumber) {
      const dup = demoStudents.find(
        (s) =>
          s.id !== studentId &&
          s.school_id === schoolId &&
          s.admission_number?.toLowerCase() ===
            cleanAdmissionNumber.toLowerCase(),
      );
      if (dup)
        return res
          .status(409)
          .json({
            message: `Admission number '${cleanAdmissionNumber}' already exists for this school.`,
          });
    }
    if (cleanStudentEmail) {
      const dupEmail = demoStudents.find(
        (s) =>
          s.id !== studentId &&
          s.school_id === schoolId &&
          (s.email?.toLowerCase() === cleanStudentEmail ||
            s.student_email?.toLowerCase() === cleanStudentEmail),
      );
      if (dupEmail)
        return res
          .status(409)
          .json({
            message: `Student email '${cleanStudentEmail}' is already registered in this school.`,
          });
    }
    if (cleanRollNumber) {
      const dupRoll = demoStudents.find(
        (s) =>
          s.id !== studentId &&
          s.school_id === schoolId &&
          (s.section_id === resolvedSectionId ||
            s.sectionId === resolvedSectionId) &&
          String(s.roll_number || s.rollNumber)
            .trim()
            .toLowerCase() === cleanRollNumber.toLowerCase() &&
          s.is_active !== false,
      );
      if (dupRoll)
        return res
          .status(409)
          .json({
            message: `Roll number '${cleanRollNumber}' is already assigned in this section.`,
          });
    }
  }

  // Pure in-memory fallback
  const idx = demoStudents.findIndex((s) => s.id === studentId);
  const existingMem = idx >= 0 ? demoStudents[idx] : {};

  const updated: any = {
    ...existingMem,
    id: studentId,
    name: fullName || existingMem.name || "Student",
    full_name:
      fullName || existingMem.full_name || existingMem.name || "Student",
    first_name: firstName || existingMem.first_name || "",
    last_name: lastName || existingMem.last_name || "",
    roll_number: cleanRollNumber || existingMem.roll_number || "",
    rollNumber: cleanRollNumber || existingMem.roll_number || "",
    admission_number:
      cleanAdmissionNumber ||
      existingMem.admission_number ||
      `ADM-${studentId}`,
    admissionNumber:
      cleanAdmissionNumber ||
      existingMem.admission_number ||
      `ADM-${studentId}`,
    parent_name: cleanParentName || existingMem.parent_name || "—",
    parentName: cleanParentName || existingMem.parent_name || "—",
    parent_sms_number: cleanParentPhone || existingMem.parent_sms_number || "",
    parentPhone: cleanParentPhone || existingMem.parent_sms_number || "",
    email: cleanStudentEmail || existingMem.email || "",
    student_email: cleanStudentEmail || existingMem.student_email || "",
    parent_email: cleanParentEmail || existingMem.parent_email || "",
    class_id: resolvedClassId || existingMem.class_id || "cls-1",
    classId: resolvedClassId || existingMem.class_id || "cls-1",
    class_number: putClsNum,
    class_label: putClassLabel,
    section_id: resolvedSectionId || existingMem.section_id || "sec-a",
    sectionId: resolvedSectionId || existingMem.section_id || "sec-a",
    section_name: putSecName,
    school_id: schoolId || existingMem.school_id,
    schoolId: schoolId || existingMem.school_id,
    academic_year_id: resolvedSession || existingMem.academic_year_id || null,
    session_id: resolvedSession || existingMem.session_id || null,
    session_name: resolvedSession || existingMem.session_name || null,
    session: resolvedSession || existingMem.session || null,
    is_active: resolvedIsActive,
    status: resolvedStatus,
    updated_at: new Date().toISOString(),
  };

  if (password && String(password).trim()) {
    registerDemoUser({
      id: studentId,
      schoolId: schoolId || "00000000-0000-0000-0000-000000000001",
      name: fullName || name || "Student",
      email:
        cleanStudentEmail ||
        `student.${cleanAdmissionNumber || studentId}@portal.local`,
      role: "STUDENT",
      password: String(password).trim(),
    });
  }

  if (idx >= 0) {
    demoStudents[idx] = { ...demoStudents[idx], ...updated };
  } else {
    demoStudents.unshift(updated);
  }

  syncStudentToFirestore(updated).catch(() => {});
  return res.json(updated);
});

r.post(
  "/students/:id/send-reset-email",
  ...admin,
  async (req: AuthRequest, res) => {
    const studentId = String(req.params.id);
    let targetEmail = "";
    let studentName = "Student";
    let role = "STUDENT";
    let userId: string | undefined = undefined;
    let admissionNumber = "";
    let rollNumber = "";
    let className = "";
    let sectionName = "";

    try {
      const q = await pool.query(
        `SELECT st.id, st.name, st.email, st.parent_email, st.user_id, st.parent_name,
              st.admission_number, st.roll_number,
              c.class_number, sec.name as section_name
       FROM students st 
       LEFT JOIN classes c ON c.id = st.class_id
       LEFT JOIN sections sec ON sec.id = st.section_id
       WHERE st.id = $1 AND st.school_id = $2 LIMIT 1`,
        [studentId, req.user!.schoolId],
      );
      if (q.rowCount && q.rowCount > 0) {
        const st = q.rows[0];
        studentName = st.name;
        userId = st.user_id;
        admissionNumber = st.admission_number || "";
        rollNumber = st.roll_number ? String(st.roll_number) : "";
        className = st.class_number ? String(st.class_number) : "";
        sectionName = st.section_name || "";
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
          targetEmail =
            dt.student_email ||
            dt.studentEmail ||
            dt.email ||
            dt.parent_email ||
            dt.parentEmail ||
            "";
          userId = dt.user_id || dt.userId || userId;
          admissionNumber =
            dt.admission_number || dt.admissionNumber || admissionNumber;
          rollNumber = dt.roll_number || dt.rollNumber || rollNumber;
          className = dt.class_name || dt.className || className;
          sectionName = dt.section_name || dt.section || sectionName;
        }
      } catch {}
    }

    if (!targetEmail) {
      const demo = demoStudents.find((s) => s.id === studentId);
      if (demo) {
        studentName = demo.name;
        targetEmail = demo.email || demo.student_email || demo.parent_email;
        admissionNumber = demo.admission_number || admissionNumber;
        rollNumber = demo.roll_number || rollNumber;
        className = demo.class_name || className;
        sectionName = demo.section_name || sectionName;
      }
    }

    if (!targetEmail) {
      return res
        .status(400)
        .json({
          message:
            "No email address found for this student. Please add a student or parent email first.",
        });
    }

    const resetResult = await createAndSendPasswordReset({
      email: targetEmail,
      name: studentName,
      role: "STUDENT",
      userId,
      schoolId: req.user?.schoolId,
      schoolName: req.user?.schoolName,
      req,
      sendEmail: false,
    });

    if (resetResult?.resetUrl) {
      await queueEmailNotification({
        schoolId: req.user?.schoolId || "school-default",
        recipientEmail: targetEmail,
        recipientName: studentName,
        recipientType: "STUDENT",
        templateKey: "STUDENT_CREATED",
        templateData: {
          student_name: studentName,
          school_name: req.user?.schoolName || "School",
          admission_number: admissionNumber || "—",
          class_name: className || "8",
          section_name: sectionName || "A",
          roll_number: rollNumber || "—",
          login_email: targetEmail,
          reset_link: resetResult.resetUrl,
          login_url: resetResult.resetUrl,
        },
        idempotencyKey: `stu-invite-${req.user?.schoolId || "default"}-${targetEmail}-${Date.now()}`,
      });
    }

    return res.json({
      success: true,
      message: `Password setup email dispatched to ${targetEmail} (Student Portal).`,
      email: targetEmail,
      resetUrl: resetResult.resetUrl,
    });
  },
);

r.delete("/students/:id", ...admin, async (req: AuthRequest, res) => {
  const sid = req.user!.schoolId;
  const targetId = String(req.params.id);
  if (isPostgresConfigured && isUuid(targetId)) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `DELETE FROM attendance_records WHERE student_id = $1`,
        [targetId],
      );
      await client.query(
        `DELETE FROM attendance_sync_items WHERE student_id = $1`,
        [targetId],
      );
      await client.query(`DELETE FROM sms_logs WHERE student_id = $1`, [
        targetId,
      ]);
      await client.query(
        `DELETE FROM student_promotions WHERE student_id = $1`,
        [targetId],
      );

      const userRes = await client.query(
        `SELECT user_id FROM students WHERE id = $1 AND school_id = $2 AND user_id IS NOT NULL`,
        [targetId, sid],
      );
      const userId = userRes.rows[0]?.user_id;

      await client.query(
        `DELETE FROM students WHERE id = $1 AND school_id = $2`,
        [targetId, sid],
      );

      if (userId) {
        await client.query(`DELETE FROM users WHERE id = $1`, [userId]);
      }
      await client.query("COMMIT");
    } catch (delErr: any) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("[DeleteStudent] Transaction error:", delErr);
      return res
        .status(400)
        .json({ success: false, message: `Delete failed: ${delErr.message}` });
    } finally {
      client.release();
    }
  }
  const idx = demoStudents.findIndex((s) => s.id === targetId);
  if (idx >= 0) demoStudents.splice(idx, 1);
  deleteStudentFromFirestore(targetId).catch(() => {});
  if (sid) {
    invalidateSchoolCache(sid);
  }
  res.json({ success: true });
});

export function normalizeToDdMmYyyy(val: any): string | null {
  if (!val) return null;
  // If Excel serial number (e.g. 35000 -> date)
  if (
    typeof val === "number" ||
    (/^\d{4,5}$/.test(String(val).trim()) &&
      !String(val).includes("-") &&
      !String(val).includes("/"))
  ) {
    const num = Number(val);
    if (!isNaN(num) && num > 1000 && num < 60000) {
      const date = new Date(Math.round((num - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) {
        const d = String(date.getUTCDate()).padStart(2, "0");
        const m = String(date.getUTCMonth() + 1).padStart(2, "0");
        const y = String(date.getUTCFullYear());
        return `${d}-${m}-${y}`;
      }
    }
  }

  const s = String(val).trim();
  // Check DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, "0");
    const m = dmyMatch[2].padStart(2, "0");
    const y = dmyMatch[3];
    return `${d}-${m}-${y}`;
  }

  // Check YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = ymdMatch[2].padStart(2, "0");
    const d = ymdMatch[3].padStart(2, "0");
    return `${d}-${m}-${y}`;
  }

  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    const d = String(parsed.getDate()).padStart(2, "0");
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const y = String(parsed.getFullYear());
    return `${d}-${m}-${y}`;
  }

  return s;
}

export function toDbDate(val: any): string | null {
  if (!val) return null;
  const normalized = normalizeToDdMmYyyy(val);
  if (!normalized) return null;
  const parts = normalized.split("-");
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return null;
}

// GET /teachers/template — standardized Excel import template
r.get("/teachers/template", ...reader, (_req, res) => {
  const XLSX = require("xlsx");
  const sample = [
    {
      Savior_No: "EMP010",
      "First Name": "Sunita",
      "Last Name": "Verma",
      "Full Name(Automatically generated)": "Sunita Verma",
      Email_id: "sunita.v@school.local",
      Gender: "Female",
      Date_of_Birth: "15-08-1990",
      Joining_Date: "01-07-2020",
      Class: "Class 10",
      Section: "A",
      Status: "Active",
      Designation: "Senior Teacher",
    },
    {
      Savior_No: "EMP011",
      "First Name": "Alok",
      "Last Name": "Mishra",
      "Full Name(Automatically generated)": "Alok Mishra",
      Email_id: "alok.m@school.local",
      Gender: "Male",
      Date_of_Birth: "22-04-1988",
      Joining_Date: "15-01-2019",
      Class: "Class 9",
      Section: "B",
      Status: "Active",
      Designation: "TGT Mathematics",
    },
    {
      Savior_No: "EMP012",
      "First Name": "Rekha",
      "Last Name": "Sengupta",
      "Full Name(Automatically generated)": "Rekha Sengupta",
      Email_id: "rekha.s@school.local",
      Gender: "Female",
      Date_of_Birth: "10-12-1992",
      Joining_Date: "10-08-2021",
      Class: "Class 8",
      Section: "A",
      Status: "Active",
      Designation: "PRT Science",
    },
  ];
  const ws = XLSX.utils.json_to_sheet(sample);
  ws["!cols"] = [16, 14, 14, 24, 26, 12, 16, 16, 12, 10, 12, 20].map((wch) => ({
    wch,
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Teachers Import Template");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="teachers_import_template.xlsx"',
  );
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.send(buf);
});

r.get("/teachers", ...reader, async (req: AuthRequest, res) => {
  const userSchoolId = req.user?.schoolId;
  const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
  const rawLimit = req.query.limit
    ? parseInt(String(req.query.limit), 10)
    : null;
  const isExplicitPagination = Boolean(
    req.query.page || req.query.limit || req.query.paginated === "true",
  );

  const sendPaginatedTeachers = (allRows: any[]) => {
    const total = allRows.length;
    const limit =
      rawLimit && rawLimit > 0
        ? Math.min(rawLimit, 500)
        : isExplicitPagination
          ? 50
          : total || 50;
    const totalPages = Math.ceil(total / (limit || 1)) || 1;
    const pagedRows = isExplicitPagination
      ? allRows.slice((page - 1) * limit, page * limit)
      : allRows;

    res.setHeader("X-Total-Count", String(total));
    res.setHeader("X-Page", String(page));
    res.setHeader("X-Per-Page", String(limit));
    res.setHeader("X-Total-Pages", String(totalPages));

    if (req.query.paginated === "true" || req.query.format === "object") {
      return res.json({
        data: pagedRows,
        pagination: {
          total,
          page,
          limit,
          totalPages,
        },
      });
    }
    return res.json(pagedRows);
  };

  const cacheKey = userSchoolId ? `teachers:${userSchoolId}` : null;
  if (cacheKey) {
    const cached = fastCache.get<any>(cacheKey);
    if (cached) return sendPaginatedTeachers(cached);
  }

  try {
    // Return authoritative class-teacher assignments alongside legacy fields.
    const q = await pool.query(
      `
    SELECT
      u.id,
      u.name,
      u.email,
      tp.first_name,
      tp.middle_name,
      tp.last_name,
      tp.employee_id,
      tp.mobile,
      tp.gender,
      tp.joining_date,
      tp.designation,
      tp.class_name,
      tp.section_name,
      u.is_active,
      u.created_at,
      cm.id AS class_mentor_id,
      c.id AS assigned_class_id,
      c.class_number AS assigned_class_number,
      sec.id AS assigned_section_id,
      sec.name AS assigned_section_name_rel
    FROM users u
    LEFT JOIN teacher_profiles tp ON tp.user_id = u.id
    LEFT JOIN class_mentors cm
      ON cm.teacher_id = u.id
      AND cm.school_id = u.school_id
    LEFT JOIN classes c ON c.id = cm.class_id
    LEFT JOIN sections sec ON sec.id = cm.section_id
    WHERE u.school_id = $1
      AND u.role = 'TEACHER'
    ORDER BY u.name
  `,
      [userSchoolId],
    );

    if (q.rows && q.rows.length > 0) {
      let rows = q.rows;
      // Deduplicate by teacher ID unless full list requested
      if (req.query.full !== "true") {
        const seen = new Set<string>();
        rows = rows.filter((r) => {
          if (seen.has(r.id)) return false;
          seen.add(r.id);
          return true;
        });
      }

      const formatted = rows.map((r) => {
        const nameParts = String(r.name || "")
          .trim()
          .split(/\s+/);
        let fn = r.first_name || "";
        let mn = r.middle_name || "";
        let ln = r.last_name || "";
        if (!fn && nameParts.length > 0) {
          if (nameParts.length === 1) {
            fn = nameParts[0];
          } else if (nameParts.length === 2) {
            fn = nameParts[0];
            ln = nameParts[1];
          } else {
            fn = nameParts[0];
            mn = nameParts.slice(1, -1).join(" ");
            ln = nameParts[nameParts.length - 1];
          }
        }
        const upperName = String(r.name || "").toUpperCase();
        const upperFn = String(fn || "").toUpperCase();
        const upperMn = String(mn || "").toUpperCase();
        const upperLn = String(ln || "").toUpperCase();
        return {
          ...r,
          name: upperName,
          first_name: upperFn,
          firstName: upperFn,
          middle_name: upperMn,
          middleName: upperMn,
          last_name: upperLn,
          lastName: upperLn,
          full_name: upperName,
          class_name: convertRomanClassToDigital(r.class_name),
          class: convertRomanClassToDigital(r.class_name),
          section_name: r.section_name || null,
          section: r.section_name || null,
          joining_date: r.joining_date
            ? normalizeToDdMmYyyy(r.joining_date)
            : "",
          joiningDate: r.joining_date
            ? normalizeToDdMmYyyy(r.joining_date)
            : "",
        };
      });

      if (cacheKey) fastCache.set(cacheKey, formatted, 30);
      return sendPaginatedTeachers(formatted);
    }
  } catch (err: any) {
    console.error("Error in GET /teachers pool.query:", err?.message);
  }

  if (isFirebaseConfigured()) {
    try {
      const snap = userSchoolId
        ? await collections
            .teachers()
            .where("school_id", "==", userSchoolId)
            .get()
        : await collections.teachers().get();
      if (!snap.empty) {
        let list = snap.docs
          .map((d) => {
            const dt = d.data();
            const docSchoolId = dt.school_id || dt.schoolId;
            return {
              id: d.id,
              name: dt.name || dt.fullName || "",
              email: dt.email || "",
              employee_id: dt.employee_id || dt.employeeId || "",
              mobile: dt.mobile || dt.phone || "",
              gender: dt.gender || "",
              dob: dt.dob || dt.date_of_birth || "",
              date_of_birth: dt.dob || dt.date_of_birth || "",
              joining_date: dt.joining_date || dt.joiningDate || "",
              joiningDate: dt.joining_date || dt.joiningDate || "",
              school_id: docSchoolId,
              schoolId: docSchoolId,
              is_active: dt.is_active !== false,
              ...dt,
            };
          })
          .filter((t) => {
            if (t.is_active === false) return false;
            if (!userSchoolId || !t.school_id) return false;
            return isSameSchool(t.school_id, userSchoolId);
          });

        for (const dt of demoTeachers) {
          if (!list.some((x) => x.id === dt.id)) {
            if (
              dt.school_id &&
              userSchoolId &&
              isSameSchool(dt.school_id, userSchoolId)
            ) {
              list.unshift(dt);
            }
          }
        }
        if (list.length > 0) {
          if (req.query.full !== "true") {
            const seen = new Set<string>();
            list = list.filter((t) => {
              if (seen.has(t.id)) return false;
              seen.add(t.id);
              return true;
            });
          }
          return sendPaginatedTeachers(list);
        }
      }
    } catch {}
  }

  // Check in-memory teachers registered for this specific school
  const memSchoolTeachers = demoTeachers.filter(
    (t) =>
      t.school_id && userSchoolId && isSameSchool(t.school_id, userSchoolId),
  );
  if (memSchoolTeachers.length > 0) {
    return sendPaginatedTeachers(memSchoolTeachers);
  }

  // Only Greenwood test school can access demo teachers
  if (isTestSchool(userSchoolId)) {
    const schoolTeachers = demoTeachers.filter((t) =>
      isSameSchool(t.school_id, userSchoolId),
    );
    return sendPaginatedTeachers(
      schoolTeachers.length ? schoolTeachers : demoTeachers,
    );
  }

  // Other schools start with 0 teachers before manual entry
  return sendPaginatedTeachers([]);
});

r.post("/teachers", ...admin, async (req: AuthRequest, res) => {
  const {
    firstName: rawFirst,
    middleName: rawMiddle,
    middle_name: rawMiddleName,
    lastName: rawLast,
    fullName: rawFull,
    name: rawName,
    email,
    password,
    employeeId: rawEmp,
    saviorNo,
    Savior_No,
    mobile: rawMobile,
    designation: rawDesig,
    gender: rawGender,
    qualification: rawQual,
    dob: rawDob,
    dateOfBirth: rawDateOfBirth,
    date_of_birth: rawDate_of_birth,
    joiningDate: rawJoiningDate,
    joining_date: rawJoining_date,
    classId,
    sectionId,
    sendInviteEmail = true,
  } = req.body;

  const firstName = String(
    rawFirst !== undefined
      ? rawFirst
      : rawName
        ? String(rawName).split(" ")[0]
        : "",
  ).trim().toUpperCase();
  const middleName = String(
    rawMiddle !== undefined ? rawMiddle : rawMiddleName || "",
  ).trim().toUpperCase();
  const lastName = String(
    rawLast !== undefined
      ? rawLast
      : rawName
        ? String(rawName).split(" ").slice(1).join(" ")
        : "",
  ).trim().toUpperCase();

  // First Name validation: 3 to 15 characters, no spaces, letters only
  if (!firstName) {
    return res.status(400).json({ message: "First Name is a required field." });
  }
  if (firstName.length < 3 || firstName.length > 15) {
    return res
      .status(400)
      .json({ message: "First Name must be between 3 and 15 characters." });
  }
  if (/\s/.test(firstName)) {
    return res
      .status(400)
      .json({ message: "Spaces are not allowed in First Name." });
  }
  if (/\d/.test(firstName)) {
    return res
      .status(400)
      .json({
        message:
          "First Name must contain only letters, numbers are not allowed.",
      });
  }

  // Middle Name validation: Optional, letters only
  if (middleName && /\d/.test(middleName)) {
    return res
      .status(400)
      .json({
        message:
          "Middle Name must contain only letters, numbers are not allowed.",
      });
  }

  // Last Name validation: Optional, letters only
  if (lastName && /\d/.test(lastName)) {
    return res
      .status(400)
      .json({
        message:
          "Last Name must contain only letters, numbers are not allowed.",
      });
  }

  const name = (
    [firstName, middleName, lastName].filter(Boolean).join(" ") ||
    String(rawFull || rawName || "").trim()
  ).toUpperCase();
  const employeeId = String(
    rawEmp || req.body?.employee_id || saviorNo || Savior_No || "",
  ).trim();
  const cleanEmail = String(email || "")
    .trim()
    .toLowerCase();
  const mobile = String(rawMobile || "").trim();
  const designation = String(rawDesig || "Teacher").trim();
  const gender = String(rawGender || req.body?.gender || "").trim() || null;
  const qualification =
    String(rawQual || req.body?.qualification || "").trim() || null;
  const rawDobInput =
    rawDob ||
    rawDateOfBirth ||
    rawDate_of_birth ||
    req.body?.dob ||
    req.body?.date_of_birth;
  const dob = rawDobInput ? normalizeToDdMmYyyy(rawDobInput) : null;
  const rawJoiningInput =
    rawJoiningDate ||
    rawJoining_date ||
    req.body?.joiningDate ||
    req.body?.joining_date;
  const joiningDate = rawJoiningInput
    ? normalizeToDdMmYyyy(rawJoiningInput)
    : null;

  if (!name || !cleanEmail || !employeeId) {
    return res
      .status(400)
      .json({
        message:
          "First Name, valid email, and Employee ID/Savior_NO are required",
      });
  }

  // Email format validation
  const EMAIL_FORMAT_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!EMAIL_FORMAT_REGEX.test(cleanEmail)) {
    return res
      .status(400)
      .json({
        message: "Invalid email format. Please provide a valid email address.",
      });
  }

  // Mobile validation: 10 digits if provided (normalized)
  const normTeacherMobile = mobile ? normalizePhoneNumber(mobile) : null;
  if (mobile && (!normTeacherMobile || normTeacherMobile.length !== 10)) {
    return res
      .status(400)
      .json({ message: "Mobile number must be a 10-digit number." });
  }

  // Demo store teacher uniqueness check
  if (!isPostgresConfigured) {
    if (employeeId) {
      const dupEmp = demoTeachers.find(
        (t) =>
          t.school_id === req.user!.schoolId &&
          (String(t.employee_id || t.savior_no || t.employeeId || "").trim().toLowerCase() === employeeId.toLowerCase()),
      );
      if (dupEmp) {
        return res.status(409).json({
          message: "This Employee/Saviour ID is already registered.",
        });
      }
    }
    if (cleanEmail) {
      const dupEmail = demoTeachers.find(
        (t) => (t.email || "").trim().toLowerCase() === cleanEmail,
      );
      if (dupEmail) {
        return res.status(409).json({
          message: "This email address is already registered.",
        });
      }
    }
    if (mobile) {
      const normMob = normalizePhoneNumber(mobile);
      if (normMob) {
        const last10 = normMob.slice(-10);
        const dupMobile = demoTeachers.find(
          (t) =>
            t.school_id === req.user!.schoolId &&
            normalizePhoneNumber(t.mobile || t.phone)?.slice(-10) === last10,
        );
        if (dupMobile) {
          return res.status(409).json({
            message: "This phone number is already registered.",
          });
        }
      }
    }
  }

  // PostgreSQL teacher uniqueness check
  if (isPostgresConfigured) {
    const uniquenessResult = await validateTeacherUniqueness({
      schoolId: req.user!.schoolId,
      employeeId,
      email: cleanEmail,
      mobile: mobile || null,
      phone: mobile || null,
    });
    if (!uniquenessResult.valid) {
      return res.status(409).json({
        message:
          uniquenessResult.errors[0]?.message ||
          "Teacher validation failed.",
        errors: uniquenessResult.errors,
      });
    }
  }

  if (password && String(password).trim()) {
    const pwValidation = validatePasswordStrength(String(password).trim());
    if (!pwValidation.valid) {
      return res.status(400).json({ message: pwValidation.message });
    }
  }

  const rawPassword =
    password || crypto.randomBytes(8).toString("hex") + "Tt1!";
  let resetInfo: any = null;
  let emailDeliveryStatus: "Sent" | "Failed" | "Pending" = "Pending";

  const rawClass = req.body.class_name || req.body.className || req.body.class;
  const rawSection =
    req.body.section_name || req.body.sectionName || req.body.section;
  const className = rawClass ? String(rawClass).trim() : null;
  const sectionName = rawSection ? String(rawSection).trim() : null;

  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const hash = await bcrypt.hash(rawPassword, 10);
      const u = await client.query(
        `INSERT INTO users(school_id,name,email,password_hash,role) VALUES($1,$2,$3,$4,'TEACHER') RETURNING id,name,email`,
        [req.user!.schoolId, name, cleanEmail, hash],
      );
      await client.query(
        `INSERT INTO teacher_profiles(user_id,employee_id,mobile,gender,qualification,joining_date,designation,class_name,section_name,first_name,middle_name,last_name) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          u.rows[0].id,
          employeeId,
          mobile || null,
          gender || null,
          qualification || null,
          toDbDate(joiningDate),
          designation || "Teacher",
          className,
          sectionName,
          firstName || null,
          middleName || null,
          lastName || null,
        ],
      );

      // Class Teacher assignment: validate and assign if classId + sectionId provided
      let assignedClass: {
        class_id: string;
        class_number: number;
        section_id: string;
        section_name: string;
      } | null = null;
      let assignmentWarning: string | null = null;
      const rawClassId = String(classId || "").trim();
      const rawSectionId = String(sectionId || "").trim();
      if (rawClassId && rawSectionId) {
        // Verify section belongs to class and both belong to this school
        const secCheck = await client.query(
          `SELECT s.id AS section_id, s.name AS section_name, c.id AS class_id, c.class_number
           FROM sections s
           JOIN classes c ON c.id = s.class_id
           WHERE s.school_id = $1 AND c.school_id = $1
             AND c.id = $2 AND s.id = $3
           LIMIT 1`,
          [req.user!.schoolId, rawClassId, rawSectionId],
        );
        if (!secCheck.rowCount) {
          assignmentWarning = `Class/Section not found in this school — teacher created without assignment. Please assign manually.`;
        } else {
          // Check for an existing assignment conflict
          const conflict = await client.query(
            `SELECT cm.teacher_id, u.name AS existing_teacher_name
             FROM class_mentors cm
             JOIN users u ON u.id = cm.teacher_id
             WHERE cm.school_id = $1 AND cm.class_id = $2 AND cm.section_id = $3
             LIMIT 1`,
            [req.user!.schoolId, rawClassId, rawSectionId],
          );
          if (
            conflict.rowCount &&
            conflict.rows[0].teacher_id !== u.rows[0].id
          ) {
            assignmentWarning = `Class/Section is already assigned to ${conflict.rows[0].existing_teacher_name}. Teacher created without assignment — use the mentor management page to reassign.`;
          } else {
            const rec = secCheck.rows[0];
            assignedClass = rec;
          }
        }
      }

      await client.query("COMMIT");

      // Assign class mentor AFTER commit so teacher record exists with FK integrity
      if (assignedClass) {
        try {
          await assignClassMentor(
            req.user!.schoolId!,
            assignedClass.class_id,
            assignedClass.section_id,
            u.rows[0].id,
          );
        } catch (assignErr: any) {
          assignmentWarning = `Teacher created successfully but class assignment failed: ${assignErr.message}`;
          assignedClass = null;
        }
      }

      if (className) {
        demoTeacherAssignments.push({
          id: `ta-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          school_id: req.user!.schoolId,
          teacher_id: u.rows[0].id,
          teacher_name: name,
          class_number: className.replace(/^Class\s*/i, ""),
          section_name: sectionName || "A",
          subject_name: null,
        });
      }

      // Automatic Teacher Welcome Email via SMTP
      if (sendInviteEmail) {
        try {
          resetInfo = await createAndSendPasswordReset({
            email: cleanEmail,
            name,
            role: "TEACHER",
            userId: u.rows[0].id,
            schoolId: req.user?.schoolId || undefined,
            schoolName: req.user?.schoolName || "School",
            req,
            sendEmail: false,
          });
          if (resetInfo?.resetUrl) {
            await queueEmailNotification({
              schoolId: req.user?.schoolId || "school-default",
              recipientEmail: cleanEmail,
              recipientName: name,
              recipientType: "TEACHER",
              templateKey: "TEACHER_CREATED",
              templateData: {
                teacher_name: name,
                school_name: req.user?.schoolName || "School",
                employee_id: employeeId,
                login_email: cleanEmail,
                reset_link: resetInfo.resetUrl,
                login_url: resetInfo.resetUrl,
                temporary_password: rawPassword,
              },
              idempotencyKey: `tch-welcome-${req.user?.schoolId || "default"}-${cleanEmail}`,
            });
            emailDeliveryStatus = "Sent";
          }
        } catch (err: any) {
          console.warn("[TeacherOnboarding] Email invite failed:", err.message);
          emailDeliveryStatus = "Failed";
        }
      }

      const created = {
        ...u.rows[0],
        name,
        full_name: name,
        first_name: firstName || null,
        firstName: firstName || null,
        middle_name: middleName || null,
        middleName: middleName || null,
        last_name: lastName || null,
        lastName: lastName || null,
        employee_id: employeeId,
        savior_no: employeeId,
        designation,
        class_name: className,
        section_name: sectionName,
        class: className,
        section: sectionName,
        gender: gender || null,
        dob: dob || null,
        date_of_birth: dob || null,
        joining_date: joiningDate || null,
        joiningDate: joiningDate || null,
        mobile: mobile || "—",
        email_status: emailDeliveryStatus,
        is_active: true,
        reset_url: resetInfo?.resetUrl,
        invite_sent: Boolean(resetInfo),
        assigned_class_id: assignedClass?.class_id || null,
        assigned_class_number: assignedClass?.class_number ?? null,
        assigned_section_id: assignedClass?.section_id || null,
        assigned_section_name_rel: assignedClass?.section_name || null,
        class_mentor_id: assignedClass ? "assigned" : null,
        assignment_warning: assignmentWarning || undefined,
      };
      demoTeachers.unshift(created);
      if (req.user?.schoolId) fastCache.delete(`teachers:${req.user.schoolId}`);
      syncTeacherToFirestore(created, hash).catch(() => {});
      return res.status(201).json(created);
    } catch (e: any) {
      await client.query("ROLLBACK");
      if (e?.code === '23505') {
        const detail = String(e?.detail || '').toLowerCase();
        let message = 'Validation Error: A conflicting record already exists.';
        if (detail.includes('employee_id')) {
          message = 'Validation Error: This Employee/Saviour ID is already registered.';
        } else if (detail.includes('email')) {
          message = 'Validation Error: This email address is already registered.';
        } else if (detail.includes('mobile') || detail.includes('phone')) {
          message = 'Validation Error: This phone number is already registered.';
        }
        return res.status(409).json({ message, code: 'DUPLICATE_TEACHER', field: 'employeeId' });
      }
      throw e;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.warn("[TeacherOnboarding] Database error:", err.message);
    if (isPostgresConfigured) {
      return res.status(500).json({ message: "Database operation failed: " + err.message });
    }
  }

  // Automatic Teacher Welcome Email via SMTP in Fallback
  if (sendInviteEmail) {
    try {
      resetInfo = await createAndSendPasswordReset({
        email: cleanEmail,
        name,
        role: "TEACHER",
        schoolId: req.user?.schoolId || undefined,
        schoolName: req.user?.schoolName || "School",
        req,
        sendEmail: false,
      });
      if (resetInfo?.resetUrl) {
        await queueEmailNotification({
          schoolId: req.user?.schoolId || "school-default",
          recipientEmail: cleanEmail,
          recipientName: name,
          recipientType: "TEACHER",
          templateKey: "TEACHER_CREATED",
          templateData: {
            teacher_name: name,
            school_name: req.user?.schoolName || "School",
            employee_id: employeeId,
            login_email: cleanEmail,
            reset_link: resetInfo.resetUrl,
            login_url: resetInfo.resetUrl,
            temporary_password: rawPassword,
          },
          idempotencyKey: `tch-welcome-${req.user?.schoolId || "default"}-${cleanEmail}`,
        });
        emailDeliveryStatus = "Sent";
      }
    } catch (err: any) {
      console.warn(
        "[TeacherOnboarding] Fallback email invite failed:",
        err.message,
      );
      emailDeliveryStatus = "Failed";
    }
  }

  const newTeacher = {
    id: `tch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    school_id: req.user!.schoolId,
    schoolId: req.user!.schoolId,
    name,
    full_name: name,
    first_name: firstName || null,
    firstName: firstName || null,
    middle_name: middleName || null,
    middleName: middleName || null,
    last_name: lastName || null,
    lastName: lastName || null,
    email: cleanEmail,
    employee_id: employeeId,
    savior_no: employeeId,
    designation,
    class_name: className,
    section_name: sectionName,
    class: className,
    section: sectionName,
    gender: gender || null,
    dob: dob || null,
    date_of_birth: dob || null,
    joining_date: joiningDate || null,
    joiningDate: joiningDate || null,
    mobile: mobile || "—",
    email_status: emailDeliveryStatus,
    is_active: true,
    reset_url: resetInfo?.resetUrl,
    invite_sent: Boolean(resetInfo),
  };
  demoTeachers.unshift(newTeacher);
  if (className) {
    demoTeacherAssignments.push({
      id: `ta-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      school_id: req.user!.schoolId,
      teacher_id: newTeacher.id,
      teacher_name: name,
      class_number: className.replace(/^Class\s*/i, ""),
      section_name: sectionName || "A",
      subject_name: null,
    });
  }
  if (req.user?.schoolId) fastCache.delete(`teachers:${req.user.schoolId}`);
  registerDemoUser({
    id: newTeacher.id,
    schoolId: req.user!.schoolId,
    name,
    email: cleanEmail,
    role: "TEACHER",
    password: rawPassword,
    employeeId: employeeId,
  });
  syncTeacherToFirestore(newTeacher, rawPassword).catch(() => {});
  res.status(201).json(newTeacher);
});

r.post(
  "/teachers/:id/send-reset-email",
  ...admin,
  async (req: AuthRequest, res) => {
    const teacherId = String(req.params.id);
    let teacherEmail = "";
    let teacherName = "Teacher";
    let userId: string | undefined = undefined;
    let employeeId = "";

    try {
      const q = await pool.query(
        `SELECT u.id, u.name, u.email, tp.employee_id 
       FROM users u 
       LEFT JOIN teacher_profiles tp ON tp.user_id = u.id
       WHERE (u.id = $1 OR tp.id = $1) AND u.school_id = $2 AND u.role = 'TEACHER' LIMIT 1`,
        [teacherId, req.user!.schoolId],
      );
      if (q.rowCount && q.rowCount > 0) {
        userId = q.rows[0].id;
        teacherName = q.rows[0].name;
        teacherEmail = q.rows[0].email;
        employeeId = q.rows[0].employee_id || "";
      }
    } catch {}

    if (!teacherEmail && isFirebaseConfigured()) {
      try {
        const doc = await collections.teachers().doc(teacherId).get();
        if (doc.exists) {
          const dt = doc.data() || {};
          teacherName = dt.name || dt.fullName || teacherName;
          teacherEmail = dt.email || "";
          userId = dt.user_id || dt.userId || userId;
          employeeId = dt.employee_id || dt.employeeId || employeeId;
        }
      } catch {}
    }

    if (!teacherEmail) {
      const demo = demoTeachers.find((t) => t.id === teacherId);
      if (demo) {
        teacherEmail = demo.email;
        teacherName = demo.name;
        employeeId = demo.employee_id || "";
      }
    }

    if (!teacherEmail) {
      return res
        .status(404)
        .json({ message: "Teacher record not found or has no email address." });
    }

    const resetResult = await createAndSendPasswordReset({
      email: teacherEmail,
      name: teacherName,
      role: "TEACHER",
      userId,
      schoolId: req.user?.schoolId,
      schoolName: req.user?.schoolName,
      req,
      sendEmail: false,
    });

    if (resetResult?.resetUrl) {
      await queueEmailNotification({
        schoolId: req.user?.schoolId || "school-default",
        recipientEmail: teacherEmail,
        recipientName: teacherName,
        recipientType: "TEACHER",
        templateKey: "TEACHER_CREATED",
        templateData: {
          teacher_name: teacherName,
          school_name: req.user?.schoolName || "School",
          employee_id: employeeId || "",
          login_email: teacherEmail,
          reset_link: resetResult.resetUrl,
          login_url: resetResult.resetUrl,
        },
        idempotencyKey: `tch-invite-${req.user?.schoolId || "default"}-${teacherEmail}-${Date.now()}`,
      });
    }

    return res.json({
      success: true,
      message: `Password setup email dispatched to faculty member ${teacherEmail}.`,
      email: teacherEmail,
      resetUrl: resetResult.resetUrl,
    });
  },
);

r.post("/teachers/bulk-import", ...admin, async (req: AuthRequest, res) => {
  const { teachers = [] } = req.body || {};
  if (!Array.isArray(teachers) || teachers.length === 0) {
    return res
      .status(400)
      .json({ message: "Array of teacher records is required" });
  }

  const schoolId = req.user!.schoolId;
  const errors: { row: number; field: string; message: string }[] = [];
  const seenEmployeeIds = new Set<string>();
  const seenEmails = new Set<string>();
  const validRows: any[] = [];

  for (let i = 0; i < teachers.length; i++) {
    const t = teachers[i];
    const rowNum = t._origRowIndex || i + 1;

    const getVal = (patterns: string[]): string => {
      for (const p of patterns) {
        if (t[p] !== undefined && t[p] !== null && String(t[p]).trim() !== "")
          return String(t[p]).trim();
        const cleanP = p.toLowerCase().replace(/[^a-z0-9]/g, "");
        const foundKey = Object.keys(t).find(
          (k) => k.toLowerCase().replace(/[^a-z0-9]/g, "") === cleanP,
        );
        if (
          foundKey &&
          t[foundKey] !== undefined &&
          t[foundKey] !== null &&
          String(t[foundKey]).trim() !== ""
        ) {
          return String(t[foundKey]).trim();
        }
      }
      return "";
    };

    // Skip completely empty rows
    const hasRealContent = Object.entries(t).some(
      ([k, v]) =>
        !k.startsWith("_") &&
        v !== undefined &&
        v !== null &&
        String(v).trim() !== "",
    );
    if (!hasRealContent) {
      continue;
    }

    const saviorNo = getVal([
      "Savior_No",
      "SAVIOR_NO",
      "savior_no",
      "saviorNo",
      "Savior No",
      "employeeId",
      "employee_id",
      "Employee ID",
      "Employee Id/Savior_NO",
      "Emp ID",
      "EMP_ID",
      "ID",
    ]);
    let firstName = getVal([
      "Fist Name",
      "First Name",
      "firstName",
      "first_name",
      "FIRST NAME",
    ]).toUpperCase();
    let middleName = getVal([
      "Middle Name",
      "middleName",
      "middle_name",
      "MIDDLE NAME",
      "MiddleName",
    ]).toUpperCase();
    let lastName = getVal([
      "Last Name",
      "lastName",
      "last_name",
      "LAST NAME",
      "Surname",
    ]).toUpperCase();
    const explicitFullName = getVal([
      "Full Name(Automatically generated)",
      "Full Name",
      "FULL NAME",
      "fullName",
      "Teacher Name",
      "TEACHER NAME",
      "Name",
      "NAME",
      "name",
      "Faculty Name",
      "Staff Name",
    ]).toUpperCase();

    if ((!firstName || !lastName) && explicitFullName) {
      const parts = explicitFullName.split(/\s+/).filter(Boolean);
      if (parts.length === 1) {
        if (!firstName) firstName = parts[0] || "";
      } else if (parts.length === 2) {
        if (!firstName) firstName = parts[0] || "";
        if (!lastName) lastName = parts[1] || "";
      } else if (parts.length >= 3) {
        if (!firstName) firstName = parts[0] || "";
        if (!middleName) middleName = parts.slice(1, -1).join(" ") || "";
        if (!lastName) lastName = parts[parts.length - 1] || "";
      }
    }
    if (firstName) firstName = firstName.toUpperCase();
    if (middleName) middleName = middleName.toUpperCase();
    if (lastName) lastName = lastName.toUpperCase();
    const name = (
      explicitFullName ||
      [firstName, middleName, lastName].filter(Boolean).join(" ") ||
      `Faculty ${rowNum}`
    ).toUpperCase();
    const email =
      getVal([
        "Email_id",
        "EMAIL_ID",
        "email_id",
        "Email ID",
        "emailId",
        "Email",
        "EMAIL",
        "email",
        "Email Address",
      ]).toLowerCase() ||
      `${saviorNo ? `teacher.${saviorNo.toLowerCase()}` : `teacher${rowNum}`}@school.local`;
    const combinedColRaw = getVal([
      "Class Teacher For (Class & Section)",
      "Class Teacher For",
      "ClassTeacherFor",
      "class_teacher_for",
    ]);
    const hasCombinedCol = teachers.some((t: any) =>
      getVal.call({ _t: t }, [
        "Class Teacher For (Class & Section)",
        "Class Teacher For",
        "ClassTeacherFor",
        "class_teacher_for",
      ]),
    );
    const rawClass = combinedColRaw
      ? ""
      : getVal(["Class", "CLASS", "class", "Standard", "Grade"]);
    const rawSection = combinedColRaw
      ? ""
      : (
          getVal(["Section", "SECTION", "section", "Sec", "SEC"]) || "A"
        ).toUpperCase();
    // Parse combined column e.g. "Class 3 Section A" or "3A" or "3 - A"
    let combinedClass = "";
    let combinedSection = "";
    let combinedInvalid = false;
    if (combinedColRaw) {
      const m = combinedColRaw.match(
        /(?:class\s*)?([\dI]{1,2}(?:V?I{0,3}|X?I{0,3}|LKG|UKG))\s*[-\u2013\s]*(?:section\s*|sec\s*|sec\.\s*)?([A-Za-z])$/i,
      );
      if (m) {
        combinedClass = m[1].trim();
        combinedSection = m[2].trim().toUpperCase();
      } else {
        combinedInvalid = true;
      }
    }
    const designation =
      getVal([
        "Designation",
        "DESIGNATION",
        "designation",
        "Role",
        "ROLE",
        "role",
        "Post",
        "POST",
        "post",
        "Job Title",
      ]) || "Teacher";
    const status = getVal(["Status", "STATUS", "status"]) || "Active";
    const rawMobile = getVal([
      "Mobile",
      "MOBILE",
      "mobile",
      "Phone",
      "phone",
    ]).replace(/[^0-9]/g, "");
    const gender = getVal(["Gender", "GENDER", "gender", "Sex", "sex"]) || null;
    const rawDob = getVal([
      "Date_of_Birth",
      "DATE_OF_BIRTH",
      "Date of Birth",
      "date_of_birth",
      "DOB",
      "dob",
      "DateOfBirth",
    ]);
    const dob = rawDob ? normalizeToDdMmYyyy(rawDob) : null;
    const rawJoiningDate = getVal([
      "Joining_Date",
      "JOINING_DATE",
      "Joining Date",
      "joining_date",
      "DOJ",
      "doj",
      "Date of Joining",
      "Date_of_Joining",
      "JoiningDate",
      "joiningDate",
    ]);
    const joiningDate = rawJoiningDate
      ? normalizeToDdMmYyyy(rawJoiningDate)
      : null;

    // Validation engine:
    if (!name)
      errors.push({
        row: rowNum,
        field: "First Name",
        message: "First Name or Teacher Name is required",
      });
    if (!email) {
      errors.push({
        row: rowNum,
        field: "Email_id",
        message: "Email address is required",
      });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({
        row: rowNum,
        field: "Email_id",
        message: `Invalid email format '${email}'`,
      });
    }
    if (!saviorNo) {
      errors.push({
        row: rowNum,
        field: "Savior_No",
        message: "Savior_No / Employee ID is required",
      });
    } else if (seenEmployeeIds.has(saviorNo)) {
      errors.push({
        row: rowNum,
        field: "Savior_No",
        message: `Duplicate Savior_No '${saviorNo}' in this file`,
      });
    } else {
      seenEmployeeIds.add(saviorNo);
    }
    if (email && seenEmails.has(email)) {
      errors.push({
        row: rowNum,
        field: "Email_id",
        message: `Duplicate email address '${email}' in this file`,
      });
    } else if (email) {
      seenEmails.add(email);
    }
    if (rawMobile && rawMobile.length !== 10) {
      errors.push({
        row: rowNum,
        field: "Mobile",
        message: `Mobile number must be exactly 10 digits (${rawMobile.length} given)`,
      });
    }

    // Reject unparseable combined column immediately — do not fall back silently
    if (combinedInvalid) {
      errors.push({
        row: rowNum,
        field: "Class Teacher For (Class & Section)",
        message: `Cannot parse combined value '${combinedColRaw}'. Expected format: 'Class 3 Section A'. Teacher will not be imported.`,
      });
    }

    if (errors.filter((e) => e.row === rowNum).length === 0) {
      validRows.push({
        saviorNo,
        firstName,
        middleName,
        middle_name: middleName,
        lastName,
        name,
        email,
        mobile: rawMobile || null,
        gender,
        joiningDate,
        joining_date: joiningDate,
        designation,
        status,
        class: combinedColRaw ? combinedClass : rawClass,
        section: combinedColRaw ? combinedSection : rawSection,
        combinedColRaw: combinedColRaw || null, // non-null means combined column was present
        combinedColProvided: Boolean(combinedColRaw), // true = combined col was populated
        _origRowIndex: rowNum,
      });
    }
  } // end for-loop over teachers

  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      errors,
      message: `Validation failed for ${errors.length} record(s). The entire import has been cancelled and no faculty data was stored in the database.`,
    });
  }

  // Pre-validate against intra-file duplicates and existing database records
  if (isPostgresConfigured) {
    const importDbErrors = await preValidateTeacherBulkImport({
      schoolId,
      rows: validRows.map((r) => ({
        rowNum: r._origRowIndex,
        saviorNo: r.saviorNo,
        email: r.email,
        mobile: r.mobile,
        phone: r.mobile,
        name: r.name,
      })),
    });

    if (importDbErrors.length > 0) {
      return res.status(422).json({
        success: false,
        errors: importDbErrors,
        message: `Import validation failed: ${importDbErrors.length} conflict(s) detected against existing database records or duplicate rows.`,
      });
    }
  }

  const schoolName = req.user?.schoolName || "School";

  // PostgreSQL Atomic Transaction
  if (isPostgresConfigured) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const stagedList: any[] = [];

      // ── Pre-load class/section UUID maps for this school ──────────────
      const classRows = await client.query(
        `SELECT id, class_number FROM classes WHERE school_id = $1`,
        [schoolId],
      );
      // Map: normalised class label → UUID
      const classMap = new Map<string, { id: string; class_number: number }>();
      for (const cr of classRows.rows) {
        const label =
          cr.class_number === -1
            ? "lkg"
            : cr.class_number === 0
              ? "ukg"
              : String(cr.class_number);
        classMap.set(label, { id: cr.id, class_number: cr.class_number });
      }

      const secRows = await client.query(
        `SELECT id, name, class_id FROM sections WHERE school_id = $1`,
        [schoolId],
      );
      // Map: `${class_id}_${section_name_upper}` → section UUID
      const sectionMap = new Map<string, string>();
      for (const sr of secRows.rows) {
        sectionMap.set(`${sr.class_id}_${sr.name.toUpperCase()}`, sr.id);
      }

      // Helper: normalise class string to a simple key
      function normaliseClassKey(raw: string): string {
        const s = raw
          .trim()
          .replace(/^(class|grade|std|standard)\s*/i, "")
          .toLowerCase();
        if (/^l.?kg$/i.test(s) || /^l-kg$/i.test(s)) return "lkg";
        if (/^u.?kg$/i.test(s) || /^u-kg$/i.test(s)) return "ukg";
        const num = parseInt(s, 10);
        if (!isNaN(num) && num >= 1 && num <= 12) return String(num);
        return s;
      }
      // ─────────────────────────────────────────────────────────────────

      // Pre-compute password hashes in parallel with rounds 8
      const preparedRows = await Promise.all(
        validRows.map(async (t) => {
          const tempPassword = crypto.randomBytes(8).toString("hex") + "Tt1!";
          const hash = await bcrypt.hash(tempPassword, 8);
          return { t, tempPassword, hash };
        }),
      );

      for (const { t, tempPassword, hash } of preparedRows) {
        const u = await client.query(
          `INSERT INTO users(school_id, name, email, password_hash, role) VALUES($1, $2, $3, $4, 'TEACHER')
           RETURNING id, name, email`,
          [schoolId, t.name, t.email, hash],
        );
        if (!u.rowCount || !u.rows[0]) {
          throw new Error(
            `Failed to insert user record for faculty member ${t.name} (${t.email})`,
          );
        }

        const { className: parsedClass, sectionName: parsedSection } =
          parseImportClassAndSection(t.class, t.section);
        const rawClass = parsedClass
          ? convertRomanClassToDigital(parsedClass)
          : null;
        const rawSection = parsedSection
          ? String(parsedSection).trim().toUpperCase()
          : "A";
        let parsedGender = t.gender ? String(t.gender).trim() : null;
        if (parsedGender) {
          if (/^f/i.test(parsedGender)) parsedGender = "Female";
          else if (/^m/i.test(parsedGender)) parsedGender = "Male";
        }

        await client.query(
          `INSERT INTO teacher_profiles(user_id, employee_id, mobile, designation, class_name, section_name, gender, joining_date, first_name, middle_name, last_name)
           VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            u.rows[0].id,
            t.saviorNo,
            t.mobile || null,
            t.designation || "Teacher",
            rawClass,
            rawSection,
            parsedGender,
            toDbDate(t.joiningDate),
            t.firstName || null,
            t.middleName || null,
            t.lastName || null,
          ],
        );

        // Resolve class/section to UUIDs for class_mentors
        let resolvedClassId: string | null = null;
        let resolvedSectionId: string | null = null;
        let importAssignmentWarning: string | null = null;
        let needsManualAssignment = false;

        if (rawClass) {
          const classKey = normaliseClassKey(rawClass);
          const classEntry = classMap.get(classKey);
          if (!classEntry) {
            importAssignmentWarning = `Class '${rawClass}' not found in this school's class list. Teacher created without assignment.`;
          } else {
            const secKey = `${classEntry.id}_${rawSection || "A"}`;
            const secId = sectionMap.get(secKey);
            if (!secId) {
              importAssignmentWarning = `Section '${rawSection || "A"}' not found in Class '${rawClass}'. Teacher created without assignment.`;
            } else {
              resolvedClassId = classEntry.id;
              resolvedSectionId = secId;
            }
          }
        } else {
          // No class info provided — needs manual batch assignment
          needsManualAssignment = true;
        }

        const created = {
          ...u.rows[0],
          name: t.name,
          full_name: t.name,
          first_name: t.firstName,
          middle_name: t.middleName || null,
          middleName: t.middleName || null,
          last_name: t.lastName,
          lastName: t.lastName,
          employee_id: t.saviorNo,
          savior_no: t.saviorNo,
          mobile: t.mobile,
          gender: t.gender || null,
          dob: t.dob || null,
          date_of_birth: t.dob || null,
          joining_date: t.joining_date || null,
          joiningDate: t.joining_date || null,
          designation: t.designation,
          class_name: t.class,
          section_name: t.section,
          status: t.status,
          email_status: "Pending",
          is_active: t.status.toUpperCase() !== "INACTIVE",
          school_id: schoolId,
          schoolId,
          needs_assignment: needsManualAssignment,
          import_assignment_warning: importAssignmentWarning || undefined,
          resolved_class_id: resolvedClassId,
          resolved_section_id: resolvedSectionId,
        };
        stagedList.push({
          created,
          hash,
          tempPassword,
          resolvedClassId,
          resolvedSectionId,
          importAssignmentWarning,
          needsManualAssignment,
        });
      }

      if (stagedList.length !== validRows.length) {
        throw new Error(
          `Incomplete faculty batch insert: processed ${stagedList.length} of ${validRows.length} records`,
        );
      }

      await client.query("COMMIT");
      client.release();
      fastCache.delete(`teachers:${schoolId}`);

      // After COMMIT: assign class_mentors, update memory, register demo users, sync, dispatch emails
      const needsAssignment: any[] = [];
      const assignmentWarnings: {
        teacherId: string;
        name: string;
        warning: string;
      }[] = [];

      for (const item of stagedList) {
        // Attempt class mentor assignment post-commit
        if (item.resolvedClassId && item.resolvedSectionId) {
          try {
            await assignClassMentor(
              schoolId,
              item.resolvedClassId,
              item.resolvedSectionId,
              item.created.id,
            );
          } catch (assignErr: any) {
            assignmentWarnings.push({
              teacherId: item.created.id,
              name: item.created.name,
              warning: `Created but assignment failed: ${assignErr.message}`,
            });
            needsAssignment.push({
              id: item.created.id,
              name: item.created.name,
              email: item.created.email,
              employee_id: item.created.employee_id,
            });
          }
        } else if (item.needsManualAssignment) {
          needsAssignment.push({
            id: item.created.id,
            name: item.created.name,
            email: item.created.email,
            employee_id: item.created.employee_id,
          });
        } else if (item.importAssignmentWarning) {
          assignmentWarnings.push({
            teacherId: item.created.id,
            name: item.created.name,
            warning: item.importAssignmentWarning,
          });
          needsAssignment.push({
            id: item.created.id,
            name: item.created.name,
            email: item.created.email,
            employee_id: item.created.employee_id,
          });
        }

        demoTeachers.unshift(item.created);
        registerDemoUser({
          id: item.created.id,
          schoolId,
          name: item.created.name,
          email: item.created.email,
          role: "TEACHER",
          password: item.tempPassword,
        });
        syncTeacherToFirestore(item.created, item.hash).catch(() => {});
        setImmediate(async () => {
          try {
            const resetInfo = await createAndSendPasswordReset({
              email: item.created.email,
              name: item.created.name,
              role: "TEACHER",
              schoolId,
              schoolName,
              req,
              sendEmail: false,
            }).catch(() => null);

            await queueEmailNotification({
              schoolId,
              recipientEmail: item.created.email,
              recipientName: item.created.name,
              recipientType: "TEACHER",
              templateKey: "TEACHER_CREATED",
              templateData: {
                teacher_name: item.created.name,
                school_name: schoolName,
                employee_id: item.created.employee_id,
                login_email: item.created.email,
                reset_link: resetInfo?.resetUrl,
                login_url:
                  resetInfo?.resetUrl ||
                  `${process.env.FRONTEND_URL || "http://localhost:5173"}/#/reset-password`,
                temporary_password: item.tempPassword,
              },
              idempotencyKey: `tch-import-${schoolId}-${item.created.email}`,
            }).catch((err) => {
              console.warn(
                `[TeacherBulkImport] SMTP dispatch warning for ${item.created.email}:`,
                err.message,
              );
            });
          } catch {}
        });
      }

      return res.status(201).json({
        success: true,
        count: stagedList.length,
        items: stagedList.map((s) => s.created),
        needsAssignment,
        warnings: assignmentWarnings,
        message:
          needsAssignment.length > 0
            ? `Successfully onboarded ${stagedList.length} faculty members. ${needsAssignment.length} teacher(s) need class assignment. Welcome credentials dispatched via SMTP.`
            : `Successfully onboarded ${stagedList.length} faculty members. Welcome credentials dispatched via SMTP.`,
      });
    } catch (txErr: any) {
      await client.query("ROLLBACK");
      client.release();
      return res.status(400).json({
        success: false,
        message: `Teacher bulk import failed: ${txErr.message || "Database transaction error"}. The entire operation was cancelled and no faculty records were stored in the database.`,
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
          const tempPassword = crypto.randomBytes(8).toString("hex") + "Tt1!";
          const docRef = collections.teachers().doc(teacherId);
          const teacherObj = {
            id: teacherId,
            school_id: schoolId,
            schoolId,
            name: t.name,
            full_name: t.name,
            first_name: t.firstName,
            middle_name: t.middleName || null,
            middleName: t.middleName || null,
            last_name: t.lastName,
            lastName: t.lastName,
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
            email_status: "Pending",
            is_active: t.status.toUpperCase() !== "INACTIVE",
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
            role: "TEACHER",
            password: item.tempPassword,
          });
        }
        return res.status(201).json({
          success: true,
          count: stagedList.length,
          items: stagedList.map((s) => s.created),
          message: `Successfully onboarded ${stagedList.length} faculty members.`,
        });
      } catch (fsErr: any) {
        return res.status(500).json({
          success: false,
          message: `Faculty bulk import failed in Cloud Firestore: ${fsErr.message}. The entire operation was cancelled and no data was saved.`,
        });
      }
    } else {
      const stagedList: any[] = [];
      for (const t of validRows) {
        const teacherId = `tch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const tempPassword = crypto.randomBytes(8).toString("hex") + "Tt1!";
        const { className: parsedClass, sectionName: parsedSection } =
          parseImportClassAndSection(t.class, t.section);
        const normClass = parsedClass
          ? convertRomanClassToDigital(parsedClass)
          : null;
        const normSec = parsedSection
          ? String(parsedSection).trim().toUpperCase()
          : "A";
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
          class_name: normClass,
          section_name: normSec,
          class: normClass,
          section: normSec,
          status: t.status,
          email_status: "Pending",
          is_active: t.status.toUpperCase() !== "INACTIVE",
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
          role: "TEACHER",
          password: item.tempPassword,
        });
      }
      return res.status(201).json({
        success: true,
        count: stagedList.length,
        items: stagedList.map((s) => s.created),
        message: `Successfully onboarded ${stagedList.length} faculty members.`,
      });
    }
  }
});

r.post("/teachers/bulk-delete", ...admin, async (req: AuthRequest, res) => {
  const { ids = [] } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0)
    return res.status(400).json({ message: "Array of IDs required" });
  const sid = req.user!.schoolId;
  const uuidIds = ids.filter(isUuid);

  if (isPostgresConfigured && uuidIds.length > 0) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 1. Clean non-cascading FK references for teachers
      await client.query(
        `DELETE FROM class_routines WHERE teacher_id = ANY($1::uuid[])`,
        [uuidIds],
      );
      await client.query(
        `UPDATE attendance_sessions SET teacher_id = NULL WHERE teacher_id = ANY($1::uuid[])`,
        [uuidIds],
      );
      await client.query(
        `DELETE FROM attendance_correction_requests WHERE requested_by = ANY($1::uuid[]) OR reviewed_by = ANY($1::uuid[])`,
        [uuidIds],
      );
      await client.query(
        `DELETE FROM attendance_correction_audit WHERE actor_user_id = ANY($1::uuid[])`,
        [uuidIds],
      );
      await client.query(
        `UPDATE student_promotions SET created_by = NULL WHERE created_by = ANY($1::uuid[])`,
        [uuidIds],
      );
      await client.query(
        `DELETE FROM admin_activity_logs WHERE user_id = ANY($1::uuid[])`,
        [uuidIds],
      );
      await client.query(
        `DELETE FROM substitute_assignments WHERE substitute_teacher_id = ANY($1::uuid[]) OR created_by = ANY($1::uuid[])`,
        [uuidIds],
      );
      await client.query(
        `DELETE FROM attendance_sync_batches WHERE user_id = ANY($1::uuid[])`,
        [uuidIds],
      );
      await client.query(
        `UPDATE student_leave_requests SET reviewed_by = NULL WHERE reviewed_by = ANY($1::uuid[])`,
        [uuidIds],
      );
      await client.query(
        `UPDATE payments SET initiated_by_user_id = NULL WHERE initiated_by_user_id = ANY($1::uuid[])`,
        [uuidIds],
      );
      await client.query(
        `DELETE FROM teacher_profiles WHERE user_id = ANY($1::uuid[])`,
        [uuidIds],
      );

      // 2. Permanently delete teacher user records from PostgreSQL
      await client.query(
        `DELETE FROM users WHERE id = ANY($1::uuid[]) AND school_id = $2 AND role = 'TEACHER'`,
        [uuidIds, sid],
      );

      await client.query("COMMIT");
    } catch (delErr: any) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("[BulkDeleteTeachers] Transaction error:", delErr);
      return res
        .status(400)
        .json({
          success: false,
          message: `Bulk delete failed: ${delErr.message}. No records were modified.`,
        });
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

r.get("/teachers/:id", ...admin, async (req: AuthRequest, res) => {
  const tid = String(req.params.id);
  const userSchoolId =
    typeof req.user?.schoolId === "string" ? req.user.schoolId : undefined;

  if (isFirebaseConfigured()) {
    try {
      const tDoc = await collections.teachers().doc(tid).get();
      if (tDoc.exists) {
        const d = tDoc.data()!;
        const docSid = String(d.school_id || d.schoolId || "");
        if (!userSchoolId || isSameSchool(docSid, userSchoolId)) {
          return res.json({ id: tDoc.id, ...d });
        }
      }
      const uDoc = await collections.users().doc(tid).get();
      if (uDoc.exists) {
        const d = uDoc.data()!;
        const docSid = String(d.school_id || d.schoolId || "");
        if (!userSchoolId || isSameSchool(docSid, userSchoolId)) {
          return res.json({ id: uDoc.id, ...d });
        }
      }
    } catch {}
  }

  const mem = demoTeachers.find((t) => t.id === tid);
  if (mem) return res.json(mem);

  res.status(404).json({ message: "Teacher not found" });
});

r.put("/teachers/:id", ...admin, async (req: AuthRequest, res) => {
  const {
    name,
    email,
    employeeId,
    employee_id,
    mobile,
    phone,
    is_active,
    status,
    password,
    classId,
    sectionId,
  } = req.body || {};
  const tid = String(req.params.id);
  const userSchoolId =
    typeof req.user?.schoolId === "string" ? req.user.schoolId : undefined;

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

  const idx = demoTeachers.findIndex((t) => t.id === tid);
  const resolvedSchoolId =
    userSchoolId ||
    existingDocData.school_id ||
    existingDocData.schoolId ||
    demoTeachers[idx]?.school_id ||
    null;
  const resolvedStatus =
    status || (is_active === false ? "INACTIVE" : "ACTIVE");
  const cleanEmail = email
    ? String(email).trim().toLowerCase()
    : existingDocData.email || demoTeachers[idx]?.email || "";

  const rawFirst =
    req.body.firstName !== undefined ? req.body.firstName : req.body.first_name;
  const rawMiddle =
    req.body.middleName !== undefined
      ? req.body.middleName
      : req.body.middle_name;
  const rawLast =
    req.body.lastName !== undefined ? req.body.lastName : req.body.last_name;

  const computedFirst =
    rawFirst !== undefined ? String(rawFirst).trim().toUpperCase() : undefined;
  const computedMiddle =
    rawMiddle !== undefined ? String(rawMiddle).trim().toUpperCase() : undefined;
  const computedLast =
    rawLast !== undefined ? String(rawLast).trim().toUpperCase() : undefined;

  if (computedFirst !== undefined) {
    if (!computedFirst) {
      return res
        .status(400)
        .json({ message: "First Name is a required field." });
    }
    if (computedFirst.length < 3 || computedFirst.length > 15) {
      return res
        .status(400)
        .json({ message: "First Name must be between 3 and 15 characters." });
    }
    if (/\s/.test(computedFirst)) {
      return res
        .status(400)
        .json({ message: "Spaces are not allowed in First Name." });
    }
    if (/\d/.test(computedFirst)) {
      return res
        .status(400)
        .json({
          message:
            "First Name must contain only letters, numbers are not allowed.",
        });
    }
  }
  if (computedMiddle && /\d/.test(computedMiddle)) {
    return res
      .status(400)
      .json({
        message:
          "Middle Name must contain only letters, numbers are not allowed.",
      });
  }
  if (computedLast && /\d/.test(computedLast)) {
    return res
      .status(400)
      .json({
        message:
          "Last Name must contain only letters, numbers are not allowed.",
      });
  }

  const resolvedName = (
    computedFirst !== undefined ||
    computedMiddle !== undefined ||
    computedLast !== undefined
      ? [computedFirst, computedMiddle, computedLast].filter(Boolean).join(" ")
      : name || existingDocData.name || demoTeachers[idx]?.name || ""
  ).toUpperCase();

  // Email format & uniqueness on edit
  if (email) {
    const EMAIL_FORMAT_REGEX =
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!EMAIL_FORMAT_REGEX.test(cleanEmail)) {
      return res
        .status(400)
        .json({
          message:
            "Invalid email format. Please provide a valid email address.",
        });
    }
    const dupEmail = demoTeachers.find(
      (t) =>
        t.id !== tid && (t.email || "").trim().toLowerCase() === cleanEmail,
    );
    if (dupEmail) {
      return res
        .status(409)
        .json({ message: "This email address is already registered." });
    }
  }

  // Demo store check for Employee ID and Phone on edit
  const targetPutEmp = String(employeeId || employee_id || existingDocData.employee_id || demoTeachers[idx]?.employee_id || "").trim();
  const targetPutMobile = String(mobile || phone || existingDocData.mobile || demoTeachers[idx]?.mobile || "").trim();
  if (!isPostgresConfigured) {
    if (targetPutEmp) {
      const dupEmp = demoTeachers.find(
        (t) =>
          t.id !== tid &&
          t.school_id === (userSchoolId || resolvedSchoolId) &&
          String(t.employee_id || t.savior_no || t.employeeId || "").trim().toLowerCase() === targetPutEmp.toLowerCase(),
      );
      if (dupEmp) {
        return res.status(409).json({
          message: "This Employee/Saviour ID is already registered.",
        });
      }
    }
    if (targetPutMobile) {
      const normMob = normalizePhoneNumber(targetPutMobile);
      if (normMob) {
        const last10 = normMob.slice(-10);
        const dupMob = demoTeachers.find(
          (t) =>
            t.id !== tid &&
            t.school_id === (userSchoolId || resolvedSchoolId) &&
            normalizePhoneNumber(t.mobile || t.phone)?.slice(-10) === last10,
        );
        if (dupMob) {
          return res.status(409).json({
            message: "This phone number is already registered.",
          });
        }
      }
    }
  }

  // PostgreSQL teacher uniqueness check on edit
  if (isPostgresConfigured) {
    const uniquenessResult = await validateTeacherUniqueness({
      schoolId: userSchoolId || resolvedSchoolId,
      employeeId: targetPutEmp || null,
      email: cleanEmail || null,
      mobile: targetPutMobile || null,
      phone: targetPutMobile || null,
      excludeUserId: tid,
    });
    if (!uniquenessResult.valid) {
      return res.status(409).json({
        message:
          uniquenessResult.errors[0]?.message ||
          "Teacher validation conflict.",
        errors: uniquenessResult.errors,
      });
    }
  }

  const rawGender = req.body.gender;
  const resolvedGender =
    rawGender !== undefined
      ? rawGender
        ? String(rawGender).trim()
        : null
      : existingDocData.gender || demoTeachers[idx]?.gender || null;
  const rawDob =
    req.body.dob !== undefined
      ? req.body.dob
      : req.body.date_of_birth !== undefined
        ? req.body.date_of_birth
        : req.body.dateOfBirth;
  const resolvedDob =
    rawDob !== undefined
      ? rawDob
        ? normalizeToDdMmYyyy(rawDob)
        : null
      : existingDocData.dob ||
        existingDocData.date_of_birth ||
        demoTeachers[idx]?.dob ||
        null;
  const rawJoining =
    req.body.joining_date !== undefined
      ? req.body.joining_date
      : req.body.joiningDate;
  const resolvedJoining =
    rawJoining !== undefined
      ? rawJoining
        ? normalizeToDdMmYyyy(rawJoining)
        : null
      : existingDocData.joining_date ||
        existingDocData.joiningDate ||
        demoTeachers[idx]?.joining_date ||
        null;
  const rawClass =
    req.body.class_name !== undefined
      ? req.body.class_name
      : req.body.className !== undefined
        ? req.body.className
        : req.body.class;
  const resolvedClass =
    rawClass !== undefined
      ? rawClass
        ? String(rawClass).trim()
        : null
      : existingDocData.class_name || demoTeachers[idx]?.class_name || null;
  const rawSection =
    req.body.section_name !== undefined
      ? req.body.section_name
      : req.body.sectionName !== undefined
        ? req.body.sectionName
        : req.body.section;
  const resolvedSection =
    rawSection !== undefined
      ? rawSection
        ? String(rawSection).trim()
        : null
      : existingDocData.section_name || demoTeachers[idx]?.section_name || null;
  const rawDesig = req.body.designation;
  const resolvedDesig =
    rawDesig !== undefined
      ? rawDesig
        ? String(rawDesig).trim()
        : "Teacher"
      : existingDocData.designation ||
        demoTeachers[idx]?.designation ||
        "Teacher";

  // Capture existing teacher details and designation BEFORE updating
  let prevDesig = (
    req.body.previous_designation ||
    req.body.previousDesignation ||
    ""
  ).trim();
  let prevEmployeeId = employeeId || employee_id || "";
  let teacherNameForLog = name || "";
  let effectiveSchoolId = resolvedSchoolId || userSchoolId;

  if (isPostgresConfigured) {
    try {
      const prevQ = await pool.query(
        `SELECT u.name, u.school_id, tp.designation, tp.employee_id, u.email 
         FROM users u 
         LEFT JOIN teacher_profiles tp ON tp.user_id = u.id 
         WHERE u.id = $1`,
        [tid],
      );
      if (prevQ.rows.length > 0) {
        if (!prevDesig && prevQ.rows[0].designation) {
          prevDesig = String(prevQ.rows[0].designation).trim();
        }
        if (!prevEmployeeId && prevQ.rows[0].employee_id) {
          prevEmployeeId = prevQ.rows[0].employee_id;
        }
        if (!teacherNameForLog && prevQ.rows[0].name) {
          teacherNameForLog = prevQ.rows[0].name;
        }
        if (!effectiveSchoolId && prevQ.rows[0].school_id) {
          effectiveSchoolId = prevQ.rows[0].school_id;
        }
      }
    } catch (e) {
      console.warn(
        "[Teacher Edit] Error querying previous designation from DB:",
        e,
      );
    }
  }

  if (!prevDesig) {
    prevDesig =
      existingDocData.designation ||
      (demoTeachers[idx] && demoTeachers[idx].designation) ||
      "";
  }
  if (!teacherNameForLog) {
    teacherNameForLog =
      existingDocData.name || demoTeachers[idx]?.name || "Teacher";
  }

  let assignmentWarning: string | undefined;
  try {
    await pool.query(
      `UPDATE users SET name=$1, email=$2, is_active=$3, updated_at=NOW() WHERE id=$4 AND school_id=$5`,
      [
        resolvedName,
        cleanEmail,
        resolvedStatus === "ACTIVE",
        tid,
        userSchoolId,
      ],
    );
    await pool.query(
      `UPDATE teacher_profiles SET employee_id=$1, mobile=$2, gender=$3, joining_date=$4, designation=$5, class_name=$6, section_name=$7, first_name=COALESCE(NULLIF($9, ''), first_name), middle_name=COALESCE(NULLIF($10, ''), middle_name), last_name=COALESCE(NULLIF($11, ''), last_name) WHERE user_id=$8`,
      [
        employeeId ||
          employee_id ||
          existingDocData.employee_id ||
          demoTeachers[idx]?.employee_id,
        mobile || phone || existingDocData.mobile || demoTeachers[idx]?.mobile,
        resolvedGender,
        toDbDate(resolvedJoining),
        resolvedDesig,
        resolvedClass,
        resolvedSection,
        tid,
        computedFirst || null,
        computedMiddle || null,
        computedLast || null,
      ],
    );

    const cleanOldPos = (prevDesig || "Teacher").trim();
    const cleanNewPos = (resolvedDesig || "Teacher").trim();

    if (
      cleanOldPos &&
      cleanNewPos &&
      cleanOldPos.toLowerCase() !== cleanNewPos.toLowerCase()
    ) {
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS teacher_promotions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            school_id UUID NOT NULL,
            teacher_id UUID NOT NULL,
            teacher_name VARCHAR(255) NOT NULL,
            employee_id VARCHAR(100),
            email VARCHAR(255),
            previous_position VARCHAR(255) NOT NULL,
            current_position VARCHAR(255) NOT NULL,
            promotion_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            notes TEXT,
            promoted_by VARCHAR(255),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_teacher_promotions_school ON teacher_promotions(school_id);
          CREATE INDEX IF NOT EXISTS idx_teacher_promotions_teacher ON teacher_promotions(teacher_id);
        `);

        const promoSid =
          effectiveSchoolId ||
          userSchoolId ||
          "00000000-0000-0000-0000-000000000001";
        await pool.query(
          `INSERT INTO teacher_promotions 
             (school_id, teacher_id, teacher_name, employee_id, email, previous_position, current_position, promotion_date, notes, promoted_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9)`,
          [
            promoSid,
            tid,
            teacherNameForLog,
            prevEmployeeId || employeeId || existingDocData.employee_id || "",
            cleanEmail,
            cleanOldPos,
            cleanNewPos,
            `Promoted from ${cleanOldPos} to ${cleanNewPos} via Faculty Directory edit`,
            req.user?.email || "School Administration",
          ],
        );
        fastCache.delete(`designations:${promoSid}`);
      } catch (pErr) {
        console.warn(
          "[Teacher Promotion] Could not auto-log promotion in schoolData:",
          pErr,
        );
      }
    }

    // Class Teacher assignment update
    const rawClassId = String(classId || "").trim();
    const rawSectionId = String(sectionId || "").trim();
    if (rawClassId && rawSectionId && userSchoolId) {
      // Verify ownership
      const secCheck = await pool.query(
        `SELECT s.id AS section_id, s.name AS section_name, c.id AS class_id, c.class_number
         FROM sections s JOIN classes c ON c.id = s.class_id
         WHERE s.school_id = $1 AND c.school_id = $1 AND c.id = $2 AND s.id = $3 LIMIT 1`,
        [userSchoolId, rawClassId, rawSectionId],
      );
      if (!secCheck.rowCount) {
        assignmentWarning =
          "Class/Section not found in this school — assignment not updated.";
      } else {
        // Check conflict: is this class/section assigned to a DIFFERENT teacher?
        const conflict = await pool.query(
          `SELECT cm.teacher_id FROM class_mentors cm
           WHERE cm.school_id = $1 AND cm.class_id = $2 AND cm.section_id = $3 LIMIT 1`,
          [userSchoolId, rawClassId, rawSectionId],
        );
        if (conflict.rowCount && conflict.rows[0].teacher_id !== tid) {
          assignmentWarning =
            "That class/section is already assigned to another teacher. Assignment not changed.";
        } else {
          await assignClassMentor(userSchoolId, rawClassId, rawSectionId, tid);
          fastCache.delete(`teachers:${userSchoolId}`);
        }
      }
    } else if (
      rawClassId === "" &&
      rawSectionId === "" &&
      classId !== undefined &&
      sectionId !== undefined
    ) {
      // Explicit clear: remove this teacher's current assignment if any
      const existing = await pool.query(
        `SELECT class_id, section_id FROM class_mentors WHERE school_id = $1 AND teacher_id = $2 LIMIT 1`,
        [userSchoolId, tid],
      );
      if (existing.rowCount) {
        await pool.query(
          `DELETE FROM class_mentors WHERE school_id = $1 AND teacher_id = $2`,
          [userSchoolId, tid],
        );
        fastCache.delete(`teachers:${userSchoolId}`);
      }
    }
  } catch (updateErr: any) {
    if (updateErr.code === "23505") {
      let msg = "A unique constraint violation occurred.";
      if (updateErr.detail?.includes("employee_id") || updateErr.constraint?.includes("employee")) {
        msg = "This Employee/Saviour ID is already registered.";
      } else if (updateErr.detail?.includes("email") || updateErr.constraint?.includes("email")) {
        msg = "This email address is already registered.";
      } else if (updateErr.detail?.includes("phone") || updateErr.detail?.includes("mobile") || updateErr.constraint?.includes("phone")) {
        msg = "This phone number is already registered.";
      }
      return res.status(409).json({ message: msg });
    }
    return res.status(500).json({ message: updateErr.message || "Failed to update teacher" });
  }

  const updated = {
    id: tid,
    name: resolvedName,
    full_name: resolvedName,
    first_name: computedFirst || demoTeachers[idx]?.first_name || null,
    firstName: computedFirst || demoTeachers[idx]?.first_name || null,
    middle_name: computedMiddle || demoTeachers[idx]?.middle_name || null,
    middleName: computedMiddle || demoTeachers[idx]?.middle_name || null,
    last_name: computedLast || demoTeachers[idx]?.last_name || null,
    lastName: computedLast || demoTeachers[idx]?.last_name || null,
    email: cleanEmail,
    employee_id:
      employeeId ||
      employee_id ||
      existingDocData.employee_id ||
      existingDocData.employeeId ||
      demoTeachers[idx]?.employee_id ||
      "",
    employeeId:
      employeeId ||
      employee_id ||
      existingDocData.employee_id ||
      existingDocData.employeeId ||
      demoTeachers[idx]?.employee_id ||
      "",
    mobile:
      mobile ||
      phone ||
      existingDocData.mobile ||
      existingDocData.phone ||
      demoTeachers[idx]?.mobile ||
      "",
    phone:
      mobile ||
      phone ||
      existingDocData.mobile ||
      existingDocData.phone ||
      demoTeachers[idx]?.mobile ||
      "",
    designation: resolvedDesig,
    class_name: resolvedClass,
    section_name: resolvedSection,
    class: resolvedClass,
    section: resolvedSection,
    gender: resolvedGender,
    dob: resolvedDob,
    date_of_birth: resolvedDob,
    joining_date: resolvedJoining,
    joiningDate: resolvedJoining,
    school_id: resolvedSchoolId,
    schoolId: resolvedSchoolId,
    status: resolvedStatus,
    is_active: resolvedStatus === "ACTIVE",
  };

  if (idx >= 0) demoTeachers[idx] = { ...demoTeachers[idx], ...updated };
  else demoTeachers.push(updated);

  const existingAssignIdx = demoTeacherAssignments.findIndex(
    (a) => a.teacher_id === tid,
  );
  if (resolvedClass) {
    if (existingAssignIdx >= 0) {
      demoTeacherAssignments[existingAssignIdx] = {
        ...demoTeacherAssignments[existingAssignIdx],
        class_number: resolvedClass.replace(/^Class\s*/i, ""),
        section_name: resolvedSection || "A",
      };
    } else {
      demoTeacherAssignments.push({
        id: `ta-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        school_id: resolvedSchoolId,
        teacher_id: tid,
        teacher_name: name || demoTeachers[idx]?.name,
        class_number: resolvedClass.replace(/^Class\s*/i, ""),
        section_name: resolvedSection || "A",
        subject_name: null,
      });
    }
  } else if (resolvedClass === null && existingAssignIdx >= 0) {
    demoTeacherAssignments.splice(existingAssignIdx, 1);
  }
  if (userSchoolId) fastCache.delete(`teachers:${userSchoolId}`);

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
        [newPasswordHash, tid, userSchoolId],
      );
    } catch {}
  }

  syncTeacherToFirestore(updated, newPasswordHash).catch(() => {});
  res.json(updated);
});

r.delete("/teachers/:id", ...admin, async (req: AuthRequest, res) => {
  const sid = req.user!.schoolId;
  const tid = String(req.params.id);
  if (isPostgresConfigured && isUuid(tid)) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM class_routines WHERE teacher_id = $1`, [
        tid,
      ]);
      await client.query(
        `UPDATE attendance_sessions SET teacher_id = NULL WHERE teacher_id = $1`,
        [tid],
      );
      await client.query(
        `DELETE FROM attendance_correction_requests WHERE requested_by = $1 OR reviewed_by = $1`,
        [tid],
      );
      await client.query(
        `DELETE FROM attendance_correction_audit WHERE actor_user_id = $1`,
        [tid],
      );
      await client.query(
        `UPDATE student_promotions SET created_by = NULL WHERE created_by = $1`,
        [tid],
      );
      await client.query(`DELETE FROM admin_activity_logs WHERE user_id = $1`, [
        tid,
      ]);
      await client.query(
        `DELETE FROM substitute_assignments WHERE substitute_teacher_id = $1 OR created_by = $1`,
        [tid],
      );
      await client.query(
        `DELETE FROM attendance_sync_batches WHERE user_id = $1`,
        [tid],
      );
      await client.query(
        `UPDATE student_leave_requests SET reviewed_by = NULL WHERE reviewed_by = $1`,
        [tid],
      );
      await client.query(
        `UPDATE payments SET initiated_by_user_id = NULL WHERE initiated_by_user_id = $1`,
        [tid],
      );
      await client.query(`DELETE FROM teacher_profiles WHERE user_id = $1`, [
        tid,
      ]);

      await client.query(
        `DELETE FROM users WHERE id = $1 AND school_id = $2 AND role = 'TEACHER'`,
        [tid, sid],
      );
      await client.query("COMMIT");
    } catch (delErr: any) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("[DeleteTeacher] Transaction error:", delErr);
      return res
        .status(400)
        .json({ success: false, message: `Delete failed: ${delErr.message}` });
    } finally {
      client.release();
    }
  }
  const idx = demoTeachers.findIndex((t) => t.id === tid);
  if (idx >= 0) demoTeachers.splice(idx, 1);
  deleteTeacherFromFirestore(tid).catch(() => {});
  if (sid) {
    invalidateSchoolCache(sid);
  }
  res.json({ success: true });
});

export const demoSubjects: any[] = [
  {
    id: "sub-math",
    name: "Mathematics",
    school_id: "00000000-0000-0000-0000-000000000001",
  },
  {
    id: "sub-sci",
    name: "Science",
    school_id: "00000000-0000-0000-0000-000000000001",
  },
  {
    id: "sub-eng",
    name: "English",
    school_id: "00000000-0000-0000-0000-000000000001",
  },
  {
    id: "sub-sst",
    name: "Social Studies",
    school_id: "00000000-0000-0000-0000-000000000001",
  },
  {
    id: "sub-cs",
    name: "Computer Science",
    school_id: "00000000-0000-0000-0000-000000000001",
  },
  {
    id: "sub-phy",
    name: "Physics",
    school_id: "00000000-0000-0000-0000-000000000001",
  },
  {
    id: "sub-chem",
    name: "Chemistry",
    school_id: "00000000-0000-0000-0000-000000000001",
  },
  {
    id: "sub-bio",
    name: "Biology",
    school_id: "00000000-0000-0000-0000-000000000001",
  },
  {
    id: "sub-hindi",
    name: "Hindi",
    school_id: "00000000-0000-0000-0000-000000000001",
  },
  {
    id: "sub-pe",
    name: "Physical Education",
    school_id: "00000000-0000-0000-0000-000000000001",
  },
];

r.get("/subjects", ...reader, async (req: AuthRequest, res) => {
  const sid = req.user!.schoolId;
  const cacheKey = sid ? `subjects:${sid}` : null;
  if (cacheKey) {
    const cached = fastCache.get<any>(cacheKey);
    if (cached) return res.json(cached);
  }

  try {
    const q = await pool.query(
      "SELECT * FROM subjects WHERE school_id=$1 ORDER BY name",
      [sid],
    );
    if (q.rowCount && q.rows.length > 0) {
      if (cacheKey) fastCache.set(cacheKey, q.rows, 30);
      return res.json(q.rows);
    }
  } catch {}

  // Check Cloud Firestore
  if (isFirebaseConfigured()) {
    try {
      const snap = sid
        ? await collections.subjects().where("school_id", "==", sid).get()
        : await collections.subjects().get();
      if (!snap.empty) {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((s: any) => s.school_id && isSameSchool(s.school_id, sid));
        if (list.length > 0) {
          list.sort((a: any, b: any) =>
            String(a.name).localeCompare(String(b.name)),
          );
          if (cacheKey) fastCache.set(cacheKey, list, 30);
          return res.json(list);
        }
      }
    } catch {}
  }

  const memSchoolSubjects = demoSubjects.filter(
    (s) => s.school_id && isSameSchool(s.school_id, sid),
  );
  if (memSchoolSubjects.length > 0) return res.json(memSchoolSubjects);

  if (isTestSchool(sid)) {
    return res.json(demoSubjects);
  }
  res.json([]);
});

r.post("/subjects", ...admin, async (req: AuthRequest, res) => {
  const sid = req.user!.schoolId;
  const { name } = req.body || {};
  if (!name || !String(name).trim())
    return res.status(400).json({ message: "Subject name is required" });
  const cleanName = String(name).trim();
  try {
    const q = await pool.query(
      "INSERT INTO subjects(school_id,name) VALUES($1,$2) RETURNING *",
      [sid, cleanName],
    );
    if (q.rowCount) {
      const created = { ...q.rows[0], school_id: sid };
      demoSubjects.push(created);
      if (sid) fastCache.delete(`subjects:${sid}`);
      return res.status(201).json(created);
    }
  } catch {}
  const newSub = { id: `sub-${Date.now()}`, name: cleanName, school_id: sid };
  demoSubjects.push(newSub);
  syncSubjectToFirestore(newSub).catch(() => {});
  if (sid) fastCache.delete(`subjects:${sid}`);
  res.status(201).json(newSub);
});

r.put("/subjects/:id", ...admin, async (req: AuthRequest, res) => {
  const sid = req.user!.schoolId;
  const subId = String(req.params.id);
  const { name } = req.body || {};
  if (!name || !String(name).trim())
    return res.status(400).json({ message: "Subject name is required" });
  const cleanName = String(name).trim();

  try {
    if (isPostgresConfigured && isUuid(subId)) {
      const q = await pool.query(
        "UPDATE subjects SET name = $1 WHERE id = $2 AND school_id = $3 RETURNING *",
        [cleanName, subId, sid],
      );
      if (q.rowCount) {
        const updated = { ...q.rows[0], school_id: sid };
        const demoIdx = demoSubjects.findIndex((s) => s.id === subId);
        if (demoIdx >= 0)
          demoSubjects[demoIdx] = { ...demoSubjects[demoIdx], name: cleanName };
        syncSubjectToFirestore(updated).catch(() => {});
        if (sid) {
          fastCache.delete(`subjects:${sid}`);
          invalidateSchoolCache(sid);
        }
        return res.json(updated);
      }
    }
  } catch (err: any) {
    console.error("[UpdateSubject] SQL error:", err);
    return res
      .status(400)
      .json({ message: err?.message || "Could not update subject" });
  }

  const idx = demoSubjects.findIndex(
    (s) => s.id === subId && (!s.school_id || isSameSchool(s.school_id, sid)),
  );
  if (idx >= 0) {
    demoSubjects[idx] = { ...demoSubjects[idx], name: cleanName };
    syncSubjectToFirestore(demoSubjects[idx]).catch(() => {});
    if (sid) {
      fastCache.delete(`subjects:${sid}`);
      invalidateSchoolCache(sid);
    }
    return res.json(demoSubjects[idx]);
  }
  const fallbackUpdated = { id: subId, name: cleanName, school_id: sid };
  syncSubjectToFirestore(fallbackUpdated).catch(() => {});
  if (sid) {
    fastCache.delete(`subjects:${sid}`);
    invalidateSchoolCache(sid);
  }
  res.json(fallbackUpdated);
});

r.delete("/subjects/:id", ...admin, async (req: AuthRequest, res) => {
  const sid = req.user!.schoolId;
  const subId = String(req.params.id);
  if (isPostgresConfigured && isUuid(subId)) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM class_routines WHERE subject_id = $1", [
        subId,
      ]);
      await client.query(
        "UPDATE attendance_sessions SET subject_id = NULL WHERE subject_id = $1",
        [subId],
      );
      await client.query(
        "DELETE FROM timetable_entries WHERE subject_id = $1",
        [subId],
      );
      await client.query(
        "DELETE FROM subjects WHERE id = $1 AND school_id = $2",
        [subId, sid],
      );
      await client.query("COMMIT");
    } catch (delErr: any) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("[DeleteSubject] Transaction error:", delErr);
      return res
        .status(400)
        .json({
          success: false,
          message: `Delete subject failed: ${delErr.message}`,
        });
    } finally {
      client.release();
    }
  }
  const idx = demoSubjects.findIndex(
    (s) => s.id === subId && (!s.school_id || isSameSchool(s.school_id, sid)),
  );
  if (idx >= 0) demoSubjects.splice(idx, 1);
  deleteSubjectFromFirestore(subId).catch(() => {});
  if (sid) {
    fastCache.delete(`subjects:${sid}`);
    invalidateSchoolCache(sid);
  }
  res.json({ success: true });
});

r.get("/school-profile", ...admin, async (req: AuthRequest, res) => {
  const sid = req.user!.schoolId!;
  const uid = req.user!.id;
  let adminPhotoUrl = "";
  try {
    const uq = await pool.query("SELECT photo_url FROM users WHERE id = $1", [
      uid,
    ]);
    if (uq.rowCount && uq.rows[0].photo_url) {
      adminPhotoUrl = uq.rows[0].photo_url;
    }
  } catch {}

  if (!adminPhotoUrl) {
    const demoAdmin = getAllDemoUsers().find(
      (u) =>
        u.id === uid ||
        u.email.toLowerCase() === (req.user?.email || "").toLowerCase(),
    );
    if (demoAdmin?.photo_url) {
      adminPhotoUrl = demoAdmin.photo_url;
    }
  }

  try {
    const q = await pool.query(
      "SELECT id, name, code, status, enquiry_number, address, photo_url, website, created_at FROM schools WHERE id = $1",
      [sid],
    );
    if (q.rowCount) {
      const s = q.rows[0];
      const resolvedPhoto = adminPhotoUrl || s.photo_url || "";
      return res.json({
        ...s,
        website: s.website || "",
        photo_url: resolvedPhoto,
        photoUrl: resolvedPhoto,
        schoolName: s.name,
        adminEmail: req.user?.email || "",
        adminName: req.user?.name || "",
      });
    }
  } catch {}

  // Check Firestore
  try {
    const fsSchool = await getFirestoreSchoolById(sid);
    if (fsSchool) {
      const resolvedPhoto =
        adminPhotoUrl ||
        (fsSchool as any).photo_url ||
        (fsSchool as any).photoUrl ||
        (fsSchool as any).logo_url ||
        "";
      return res.json({
        id: fsSchool.id,
        name: fsSchool.name,
        schoolName: fsSchool.name,
        code: fsSchool.code || "SCH001",
        status: fsSchool.status || "ACTIVE",
        enquiry_number:
          fsSchool.phone || fsSchool.enquiryNumber || "1800123456",
        contact_number:
          fsSchool.phone || fsSchool.enquiryNumber || "1800123456",
        address: fsSchool.address || "Main Campus",
        website: fsSchool.website || "",
        photo_url: resolvedPhoto,
        photoUrl: resolvedPhoto,
        adminEmail: req.user?.email || "",
        adminName: req.user?.name || "",
        created_at: fsSchool.createdAt || new Date().toISOString(),
      });
    }
  } catch {}

  res.json({
    id: sid,
    name: req.user?.schoolName || "Institutional Campus",
    schoolName: req.user?.schoolName || "Institutional Campus",
    code: (req.user as any)?.schoolCode || "SCH001",
    status: "ACTIVE",
    enquiry_number: "1800123456",
    address: "Main Campus",
    photo_url: adminPhotoUrl || "",
    photoUrl: adminPhotoUrl || "",
    adminEmail: req.user?.email || "",
    adminName: req.user?.name || "",
  });
});

r.put("/school-profile", ...admin, async (req: AuthRequest, res) => {
  const sid = req.user!.schoolId!;
  const uid = req.user!.id;
  const {
    enquiryNumber,
    contact_number,
    address,
    website,
    photo_url,
    photoUrl,
    photo,
  } = req.body || {};
  const rawPhone =
    contact_number !== undefined ? contact_number : enquiryNumber;
  const incomingPhoto =
    photo_url !== undefined
      ? photo_url
      : photoUrl !== undefined
        ? photoUrl
        : photo;

  let normalizedPhone: string | null | undefined = undefined;
  if (rawPhone !== undefined) {
    const trimmedPhone = String(rawPhone || "").trim();
    if (trimmedPhone !== "") {
      // Validate contact number: strictly numbers and standard phone formatting only (no words or alphabets)
      const digitsOnly = trimmedPhone.replace(/\D/g, "");
      const validPhoneFormat = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{4,18}$/.test(
        trimmedPhone,
      );
      if (
        !validPhoneFormat ||
        digitsOnly.length < 6 ||
        digitsOnly.length > 15
      ) {
        return res.status(400).json({
          message:
            "Invalid contact number. Must contain only numeric digits (e.g. +91 98765 43210 or 0343-2563500). Alphabets and words are not allowed.",
        });
      }
      normalizedPhone = trimmedPhone;
    } else {
      normalizedPhone = null;
    }
  }

  let normalizedWebsite: string | null | undefined = undefined;
  if (website !== undefined) {
    const trimmedWebsite = String(website || "").trim();
    if (trimmedWebsite !== "") {
      // Validate URL - strictly disallow plain arbitrary words (e.g. 'dav', 'school', 'test')
      // Must be a valid domain or web URL with a recognized domain dot format
      const urlPattern =
        /^(https?:\/\/)?([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(:\d+)?(\/.*)?$/i;
      let isValid = urlPattern.test(trimmedWebsite);
      if (isValid) {
        try {
          const withProto =
            trimmedWebsite.startsWith("http://") ||
            trimmedWebsite.startsWith("https://")
              ? trimmedWebsite
              : `https://${trimmedWebsite}`;
          const parsed = new URL(withProto);
          isValid = !!parsed.hostname && parsed.hostname.includes(".");
          normalizedWebsite = withProto;
        } catch {
          isValid = false;
        }
      }
      if (!isValid) {
        return res.status(400).json({
          message:
            "Invalid website link. Please enter a valid URL (e.g. https://davmodeldurgapur.org or davmodeldurgapur.org). Plain words are not allowed.",
        });
      }
    } else {
      normalizedWebsite = null;
    }
  }

  let normalizedAddress: string | null | undefined = undefined;
  if (address !== undefined) {
    const trimmedAddress = String(address || "").trim();
    if (trimmedAddress !== "") {
      if (trimmedAddress.length < 50 || trimmedAddress.length > 1000) {
        return res.status(400).json({
          message: `Campus physical address word limit must be between 50 to 1000 (currently: ${trimmedAddress.length}).`,
        });
      }
      normalizedAddress = trimmedAddress;
    } else {
      normalizedAddress = null;
    }
  }

  if (incomingPhoto !== undefined) {
    updateDemoUserPhoto(uid, incomingPhoto || null);
    try {
      await pool.query(
        "UPDATE users SET photo_url = $1, updated_at = NOW() WHERE id = $2 AND school_id = $3",
        [incomingPhoto || null, uid, sid],
      );
      await pool.query(
        "UPDATE schools SET photo_url = $1, updated_at = NOW() WHERE id = $2",
        [incomingPhoto || null, sid],
      );
    } catch {}
  }

  const hasPhoneUpdate = rawPhone !== undefined;
  const hasWebsiteUpdate = website !== undefined;
  const hasAddressUpdate = address !== undefined;

  try {
    const q = await pool.query(
      `UPDATE schools 
     SET enquiry_number = CASE WHEN $1::boolean THEN $2::text ELSE enquiry_number END, 
         address = CASE WHEN $3::boolean THEN $4::text ELSE address END, 
         photo_url = COALESCE($5, photo_url),
         website = CASE WHEN $6::boolean THEN $7::text ELSE website END,
         updated_at = NOW() 
     WHERE id = $8 
     RETURNING id, name, code, status, enquiry_number, address, photo_url, website`,
      [
        hasPhoneUpdate,
        normalizedPhone,
        hasAddressUpdate,
        normalizedAddress,
        incomingPhoto !== undefined ? incomingPhoto || null : null,
        hasWebsiteUpdate,
        normalizedWebsite,
        sid,
      ],
    );
    if (q.rowCount) {
      const row = q.rows[0];
      syncSchoolToFirestore(row).catch(() => {});
      invalidateDashboardCache(sid);
      clearStudentDashboardCache();
      fastCache.deletePattern(`student:`);
      fastCache.deletePattern(`teacher:`);
      return res.json({
        ...row,
        website: row.website || "",
        photo_url: incomingPhoto !== undefined ? incomingPhoto : row.photo_url,
        photoUrl: incomingPhoto !== undefined ? incomingPhoto : row.photo_url,
      });
    }
  } catch (err: any) {
    console.error("[SchoolProfile] Update error:", err);
  }

  try {
    if (isFirebaseConfigured()) {
      const updatePayload: any = {
        phone: normalizedPhone,
        enquiryNumber: normalizedPhone,
        address: normalizedAddress,
        website: normalizedWebsite || "",
        updatedAt: new Date().toISOString(),
      };
      if (incomingPhoto !== undefined) {
        updatePayload.photo_url = incomingPhoto;
        updatePayload.photoUrl = incomingPhoto;
      }
      await collections.schools().doc(sid).set(updatePayload, { merge: true });
      if (incomingPhoto !== undefined && uid) {
        await collections
          .users()
          .doc(uid)
          .set(
            { photo_url: incomingPhoto, photoUrl: incomingPhoto },
            { merge: true },
          )
          .catch(() => {});
      }
      invalidateDashboardCache(sid);
      clearStudentDashboardCache();
      fastCache.deletePattern(`student:`);
      fastCache.deletePattern(`teacher:`);
      const updated = await getFirestoreSchoolById(sid);
      if (updated)
        return res.json({
          ...updated,
          photo_url: incomingPhoto,
          photoUrl: incomingPhoto,
          website: (updated as any).website || "",
        });
    }
  } catch {}

  const updatedSchool = {
    id: sid,
    enquiry_number: normalizedPhone,
    address: normalizedAddress,
    website: normalizedWebsite || "",
    photo_url: incomingPhoto,
    photoUrl: incomingPhoto,
  };
  syncSchoolToFirestore(updatedSchool).catch(() => {});
  invalidateDashboardCache(sid);
  clearStudentDashboardCache();
  fastCache.deletePattern(`student:`);
  fastCache.deletePattern(`teacher:`);
  res.json(updatedSchool);
});

// ── POST /api/school-profile/photo - Upload picture (School Admin only) ──
r.post("/school-profile/photo", ...admin, async (req: AuthRequest, res) => {
  const sid = req.user!.schoolId!;
  const uid = req.user!.id;
  const { photo_url, photoUrl, photo } = req.body || {};
  const newPhoto = photo_url || photoUrl || photo;

  if (!newPhoto || typeof newPhoto !== "string") {
    return res
      .status(400)
      .json({ message: "Valid photo data or URL is required" });
  }

  // Basic payload size check (max 10MB data string)
  if (newPhoto.length > 10 * 1024 * 1024) {
    return res
      .status(400)
      .json({ message: "Image size exceeds maximum allowed limit of 10MB" });
  }

  // Sync to in-memory demo store
  updateDemoUserPhoto(uid, newPhoto);

  try {
    await pool.query(
      "UPDATE users SET photo_url = $1, updated_at = NOW() WHERE id = $2 AND school_id = $3",
      [newPhoto, uid, sid],
    );
    await pool.query(
      "UPDATE schools SET photo_url = $1, updated_at = NOW() WHERE id = $2",
      [newPhoto, sid],
    );
  } catch (err: any) {
    console.warn("[SchoolProfile] DB update photo warning:", err.message);
  }

  if (isFirebaseConfigured()) {
    try {
      await collections
        .users()
        .doc(uid)
        .set({ photo_url: newPhoto, photoUrl: newPhoto }, { merge: true });
      await collections
        .schools()
        .doc(sid)
        .set(
          { photo_url: newPhoto, photoUrl: newPhoto, logo_url: newPhoto },
          { merge: true },
        );
    } catch {}
  }

  res.json({
    success: true,
    message: "Profile picture uploaded successfully",
    photo_url: newPhoto,
    photoUrl: newPhoto,
  });
});

// ── DELETE /api/school-profile/photo - Remove picture (School Admin only) ──
r.delete("/school-profile/photo", ...admin, async (req: AuthRequest, res) => {
  const sid = req.user!.schoolId!;
  const uid = req.user!.id;

  // Sync to in-memory demo store
  updateDemoUserPhoto(uid, null);

  try {
    await pool.query(
      "UPDATE users SET photo_url = NULL, updated_at = NOW() WHERE id = $1 AND school_id = $2",
      [uid, sid],
    );
    await pool.query(
      "UPDATE schools SET photo_url = NULL, updated_at = NOW() WHERE id = $1",
      [sid],
    );
  } catch (err: any) {
    console.warn("[SchoolProfile] DB remove photo warning:", err.message);
  }

  if (isFirebaseConfigured()) {
    try {
      await collections
        .users()
        .doc(uid)
        .set({ photo_url: null, photoUrl: null }, { merge: true });
      await collections
        .schools()
        .doc(sid)
        .set(
          { photo_url: null, photoUrl: null, logo_url: null },
          { merge: true },
        );
    } catch {}
  }

  res.json({
    success: true,
    message: "Profile picture removed successfully",
    photo_url: null,
    photoUrl: null,
  });
});

r.put(
  "/school-profile/change-password",
  ...admin,
  async (req: AuthRequest, res) => {
    const userId = req.user!.id;
    const { currentPassword, newPassword } = req.body || {};

    const pwValidation = validatePasswordStrength(String(newPassword));
    if (!pwValidation.valid) {
      return res.status(400).json({ message: pwValidation.message });
    }

    try {
      const q = await pool.query(
        `SELECT id, password_hash FROM users WHERE id = $1`,
        [userId],
      );
      if (q.rows.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      const userRow = q.rows[0];
      const bcryptModule = await import("bcryptjs");
      const valid = await bcryptModule.compare(
        currentPassword,
        userRow.password_hash,
      );
      if (!valid) {
        return res
          .status(400)
          .json({ message: "Current password is incorrect" });
      }

      const hashed = await bcryptModule.hash(newPassword, 10);
      await pool.query(
        `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
        [hashed, userId],
      );

      res.json({
        success: true,
        message: "Administrator password updated successfully!",
      });
    } catch (err: any) {
      res
        .status(500)
        .json({
          message: err.message || "Failed to change administrator password",
        });
    }
  },
);

/* ── Global Search ── */
r.get("/search", ...admin, async (req: AuthRequest, res) => {
  const q = String(req.query.q || "").trim();
  if (!q || q.length < 2)
    return res.json({ students: [], teachers: [], classes: [] });
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
      [sid, pattern],
    );
    results.students = stRes.rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      roll: r.roll_number,
      gender: r.gender,
      class: r.class_number ? `Class ${r.class_number}` : null,
      section: r.section_name,
      type: "student",
    }));

    // Teachers
    const tRes = await pool.query(
      `SELECT u.id, u.name, u.email, tp.gender, tp.employee_id
       FROM users u
       LEFT JOIN teacher_profiles tp ON tp.user_id = u.id
       WHERE u.school_id = $1 AND u.role = 'TEACHER' AND u.is_active = true
         AND (LOWER(u.name) LIKE LOWER($2) OR LOWER(u.email) LIKE LOWER($2) OR LOWER(COALESCE(tp.employee_id,'')) LIKE LOWER($2) OR LOWER(COALESCE(tp.gender,'')) LIKE LOWER($2))
       ORDER BY u.name ASC LIMIT 8`,
      [sid, pattern],
    );
    results.teachers = tRes.rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      employee_id: r.employee_id,
      gender: r.gender,
      type: "teacher",
    }));

    // Classes
    const cRes = await pool.query(
      `SELECT c.id, c.class_number, COUNT(s.id)::int AS section_count
       FROM classes c LEFT JOIN sections s ON s.class_id = c.id
       WHERE c.school_id = $1 AND CAST(c.class_number AS TEXT) LIKE $2
       GROUP BY c.id ORDER BY c.class_number LIMIT 8`,
      [sid, pattern],
    );
    results.classes = cRes.rows.map((r: any) => ({
      id: r.id,
      name: `Class ${r.class_number}`,
      sections: r.section_count,
      type: "class",
    }));
  } catch (_e) {
    // DB unavailable — fallback to in-memory/demo search
  }

  // Fallback to in-memory datasets if DB returns empty
  if (results.students.length === 0) {
    results.students = demoStudents
      .filter((s) => {
        if (s.school_id && !isSameSchool(s.school_id, sid)) return false;
        return (
          (s.name && s.name.toLowerCase().includes(q.toLowerCase())) ||
          (s.roll_number &&
            String(s.roll_number).toLowerCase().includes(q.toLowerCase())) ||
          (s.gender && s.gender.toLowerCase().includes(q.toLowerCase())) ||
          (s.email && s.email.toLowerCase().includes(q.toLowerCase()))
        );
      })
      .slice(0, 8)
      .map((s) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        roll: s.roll_number,
        gender: s.gender,
        class:
          s.class_name || (s.class_number ? `Class ${s.class_number}` : null),
        section: s.section_name,
        type: "student",
      }));
  }
  if (results.teachers.length === 0) {
    results.teachers = demoTeachers
      .filter((t) => {
        if (
          t.school_id &&
          !isSameSchool(t.school_id, sid) &&
          !isTestSchool(sid)
        )
          return false;
        return (
          (t.name && t.name.toLowerCase().includes(q.toLowerCase())) ||
          (t.email && t.email.toLowerCase().includes(q.toLowerCase())) ||
          (t.employee_id &&
            t.employee_id.toLowerCase().includes(q.toLowerCase())) ||
          (t.gender && t.gender.toLowerCase().includes(q.toLowerCase()))
        );
      })
      .slice(0, 8)
      .map((t) => ({
        id: t.id,
        name: t.name,
        email: t.email,
        employee_id: t.employee_id,
        gender: t.gender,
        type: "teacher",
      }));
  }

  res.json(results);
});

export default r;
