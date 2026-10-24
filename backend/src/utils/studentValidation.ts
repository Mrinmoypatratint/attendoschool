import { pool } from '../db';

export interface UniquenessValidationResult {
  valid: boolean;
  errors: { field: string; message: string }[];
}

export interface ImportErrorItem {
  row: number;
  field: string;
  message: string;
}

/**
 * Normalizes email: trim whitespace and convert to lowercase.
 */
export function normalizeEmail(email: any): string | null {
  if (email === undefined || email === null) return null;
  const s = String(email).trim().toLowerCase();
  return s.length > 0 ? s : null;
}

/**
 * Normalizes admission number: trim whitespace.
 */
export function normalizeAdmissionNumber(adm: any): string | null {
  if (adm === undefined || adm === null) return null;
  const s = String(adm).trim();
  return s.length > 0 ? s : null;
}

/**
 * Normalizes roll number: trim whitespace.
 */
export function normalizeRollNumber(roll: any): string | null {
  if (roll === undefined || roll === null) return null;
  const s = String(roll).trim();
  return s.length > 0 ? s : null;
}

const isUuid = (val: any): boolean =>
  typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

/**
 * Checks if an admission number is already taken within the school (case-insensitive).
 * Checks both active and inactive student records.
 * Excludes `excludeStudentId` if provided (e.g. on student edit).
 */
export async function checkAdmissionNumberConflict(
  schoolId: string,
  admissionNumber: string,
  excludeStudentId?: string | null,
  client: any = pool
): Promise<{ conflict: boolean; message?: string }> {
  const norm = normalizeAdmissionNumber(admissionNumber);
  if (!norm) return { conflict: false };

  const safeExclude = isUuid(excludeStudentId) ? excludeStudentId : null;
  const q = await client.query(
    `SELECT id, name FROM students
     WHERE school_id = $1
       AND LOWER(TRIM(admission_number)) = LOWER(TRIM($2))
       AND ($3::uuid IS NULL OR id != $3::uuid)
     LIMIT 1`,
    [schoolId, norm, safeExclude]
  );

  if (q.rowCount && q.rowCount > 0) {
    return {
      conflict: true,
      message: `Admission number '${norm}' already exists in this school.`
    };
  }

  return { conflict: false };
}

/**
 * Checks if a roll number is already assigned in the class, section, and academic year.
 * Excludes `excludeStudentId` if provided.
 */
export async function checkRollNumberConflict(
  schoolId: string,
  academicYearId: string | null,
  classId: string,
  sectionId: string,
  rollNumber: string,
  excludeStudentId?: string | null,
  client: any = pool
): Promise<{ conflict: boolean; message?: string }> {
  const norm = normalizeRollNumber(rollNumber);
  if (!norm) return { conflict: false };

  const safeExclude = isUuid(excludeStudentId) ? excludeStudentId : null;
  const safeAyId = isUuid(academicYearId) ? academicYearId : null;
  const safeClassId = isUuid(classId) ? classId : null;
  const safeSecId = isUuid(sectionId) ? sectionId : null;

  if (!safeClassId || !safeSecId) {
    return { conflict: false };
  }

  const q = await client.query(
    `SELECT id, name FROM students
     WHERE school_id = $1
       AND (
         ($2::uuid IS NULL AND academic_year_id IS NULL)
         OR academic_year_id = $2::uuid
       )
       AND class_id = $3::uuid
       AND section_id = $4::uuid
       AND LOWER(TRIM(roll_number)) = LOWER(TRIM($5))
       AND ($6::uuid IS NULL OR id != $6::uuid)
     LIMIT 1`,
    [schoolId, safeAyId, safeClassId, safeSecId, norm, safeExclude]
  );

  if (q.rowCount && q.rowCount > 0) {
    return {
      conflict: true,
      message: `Roll number '${norm}' is already assigned in this section for the selected academic session.`
    };
  }

  return { conflict: false };
}

/**
 * Checks if a student email is already in use (case-insensitive).
 * 1. Checks students table within school.
 * 2. Checks users table globally and ensures no account-linking collision.
 */
export async function checkStudentEmailConflict(
  schoolId: string,
  email: string,
  excludeStudentId?: string | null,
  client: any = pool
): Promise<{ conflict: boolean; message?: string }> {
  const norm = normalizeEmail(email);
  if (!norm) return { conflict: false };

  const safeExclude = isUuid(excludeStudentId) ? excludeStudentId : null;

  // 1. Check students table in this school
  const stuQ = await client.query(
    `SELECT id, name, user_id FROM students
     WHERE school_id = $1
       AND LOWER(TRIM(email)) = LOWER(TRIM($2))
       AND ($3::uuid IS NULL OR id != $3::uuid)
     LIMIT 1`,
    [schoolId, norm, safeExclude]
  );

  if (stuQ.rowCount && stuQ.rowCount > 0) {
    return {
      conflict: true,
      message: `Student email '${norm}' is already in use by another student in this school.`
    };
  }

  // 2. Check users table
  const userQ = await client.query(
    `SELECT id, school_id, role FROM users
     WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))
     LIMIT 1`,
    [norm]
  );

  if (userQ.rowCount && userQ.rowCount > 0) {
    const u = userQ.rows[0];
    if (u.school_id && u.school_id !== schoolId) {
      return {
        conflict: true,
        message: `Email '${norm}' is already registered with another institution.`
      };
    }
    if (u.role && u.role !== 'STUDENT') {
      return {
        conflict: true,
        message: `Email '${norm}' is already registered as an administrative or staff account (${u.role}).`
      };
    }

    // Check if this user is already linked to another student
    const linkQ = await client.query(
      `SELECT id, name FROM students
       WHERE user_id = $1
         AND ($2::uuid IS NULL OR id != $2::uuid)
       LIMIT 1`,
      [u.id, safeExclude]
    );

    if (linkQ.rowCount && linkQ.rowCount > 0) {
      return {
        conflict: true,
        message: `Email '${norm}' is already linked to another student account.`
      };
    }
  }

  return { conflict: false };
}

/**
 * Composite validator for single student create or edit operations.
 */
export async function validateStudentUniqueness(params: {
  schoolId: string;
  admissionNumber?: string | null;
  rollNumber?: string | number | null;
  classId?: string | null;
  sectionId?: string | null;
  academicYearId?: string | null;
  studentEmail?: string | null;
  excludeStudentId?: string | null;
  client?: any;
}): Promise<UniquenessValidationResult> {
  const {
    schoolId,
    admissionNumber,
    rollNumber,
    classId,
    sectionId,
    academicYearId,
    studentEmail,
    excludeStudentId,
    client = pool
  } = params;

  const errors: { field: string; message: string }[] = [];

  if (admissionNumber) {
    const admRes = await checkAdmissionNumberConflict(schoolId, String(admissionNumber), excludeStudentId, client);
    if (admRes.conflict && admRes.message) {
      errors.push({ field: 'admissionNumber', message: admRes.message });
    }
  }

  if (rollNumber && classId && sectionId) {
    const rollRes = await checkRollNumberConflict(
      schoolId,
      academicYearId || null,
      String(classId),
      String(sectionId),
      String(rollNumber),
      excludeStudentId,
      client
    );
    if (rollRes.conflict && rollRes.message) {
      errors.push({ field: 'rollNumber', message: rollRes.message });
    }
  }

  if (studentEmail) {
    const emailRes = await checkStudentEmailConflict(schoolId, String(studentEmail), excludeStudentId, client);
    if (emailRes.conflict && emailRes.message) {
      errors.push({ field: 'studentEmail', message: emailRes.message });
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Pre-validates a batch of student records for bulk import against:
 * 1. Intra-file duplicates (admission number, student email, roll number in section).
 * 2. Database conflicts (admission number in school, student email in school/users, roll number in section & session).
 */
export async function preValidateBulkImport(params: {
  schoolId: string;
  academicYearId: string | null;
  rows: {
    rowNum: number;
    firstName: string;
    lastName: string;
    admissionNumber: string;
    rollNumber: string;
    studentEmail?: string;
    classId: string;
    classNumber: number;
    classLabel: string;
    sectionId: string;
    sectionName: string;
  }[];
  client?: any;
}): Promise<ImportErrorItem[]> {
  const { schoolId, academicYearId, rows, client = pool } = params;
  const errors: ImportErrorItem[] = [];

  // 1. INTRA-FILE DUPLICATE TRACKING
  const seenAdmNums = new Map<string, number>();
  const seenStudentEmails = new Map<string, number>();
  const seenRollKeys = new Map<string, number>();

  for (const r of rows) {
    const normAdm = normalizeAdmissionNumber(r.admissionNumber)?.toLowerCase();
    if (normAdm) {
      if (seenAdmNums.has(normAdm)) {
        errors.push({
          row: r.rowNum,
          field: 'Admission Number',
          message: `Duplicate admission number '${r.admissionNumber}' in this file (already used in row ${seenAdmNums.get(normAdm)})`
        });
      } else {
        seenAdmNums.set(normAdm, r.rowNum);
      }
    }

    const normEmail = normalizeEmail(r.studentEmail);
    if (normEmail) {
      if (seenStudentEmails.has(normEmail)) {
        errors.push({
          row: r.rowNum,
          field: 'Student Email',
          message: `Duplicate student email '${r.studentEmail}' in this file (already used in row ${seenStudentEmails.get(normEmail)})`
        });
      } else {
        seenStudentEmails.set(normEmail, r.rowNum);
      }
    }

    const normRoll = normalizeRollNumber(r.rollNumber)?.toLowerCase();
    if (normRoll && r.classNumber !== undefined && r.sectionName) {
      const rollKey = `${r.classNumber}_${r.sectionName.toUpperCase()}_${normRoll}`;
      if (seenRollKeys.has(rollKey)) {
        errors.push({
          row: r.rowNum,
          field: 'Roll Number',
          message: `Duplicate roll number '${r.rollNumber}' for ${r.classLabel} Section ${r.sectionName} in this file (already used in row ${seenRollKeys.get(rollKey)})`
        });
      } else {
        seenRollKeys.set(rollKey, r.rowNum);
      }
    }
  }

  // 2. DATABASE CONFLICTS
  const batchAdms = rows.map(r => normalizeAdmissionNumber(r.admissionNumber)?.toLowerCase()).filter(Boolean) as string[];
  if (batchAdms.length > 0) {
    const existAdmQ = await client.query(
      `SELECT admission_number FROM students
       WHERE school_id = $1
         AND LOWER(TRIM(admission_number)) = ANY($2::text[])`,
      [schoolId, batchAdms]
    );

    if (existAdmQ.rowCount > 0) {
      const existSet = new Set(existAdmQ.rows.map((row: any) => String(row.admission_number).trim().toLowerCase()));
      for (const r of rows) {
        const norm = normalizeAdmissionNumber(r.admissionNumber)?.toLowerCase();
        if (norm && existSet.has(norm)) {
          errors.push({
            row: r.rowNum,
            field: 'Admission Number',
            message: `Admission number '${r.admissionNumber}' already exists in the school database`
          });
        }
      }
    }
  }

  const batchEmails = rows.map(r => normalizeEmail(r.studentEmail)).filter(Boolean) as string[];
  if (batchEmails.length > 0) {
    // Check students table
    const existEmailQ = await client.query(
      `SELECT email FROM students
       WHERE school_id = $1
         AND LOWER(TRIM(email)) = ANY($2::text[])`,
      [schoolId, batchEmails]
    );

    const existEmailSet = new Set(existEmailQ.rows.map((row: any) => String(row.email).trim().toLowerCase()));

    // Check users table
    const existUserQ = await client.query(
      `SELECT email FROM users
       WHERE LOWER(TRIM(email)) = ANY($1::text[])`,
      [batchEmails]
    );

    const existUserSet = new Set(existUserQ.rows.map((row: any) => String(row.email).trim().toLowerCase()));

    for (const r of rows) {
      const norm = normalizeEmail(r.studentEmail);
      if (norm) {
        if (existEmailSet.has(norm)) {
          errors.push({
            row: r.rowNum,
            field: 'Student Email',
            message: `Student email '${r.studentEmail}' is already in use by an existing student in this school`
          });
        } else if (existUserSet.has(norm)) {
          errors.push({
            row: r.rowNum,
            field: 'Student Email',
            message: `Email '${r.studentEmail}' is already registered with another user account`
          });
        }
      }
    }
  }

  // Check roll numbers in database for the given class/sections and academic year
  const safeAyId = isUuid(academicYearId) ? academicYearId : null;
  const sectionIds = Array.from(new Set(rows.map(r => r.sectionId).filter(isUuid)));

  if (sectionIds.length > 0) {
    const existRollQ = await client.query(
      `SELECT class_id, section_id, roll_number FROM students
       WHERE school_id = $1
         AND (
           ($2::uuid IS NULL AND academic_year_id IS NULL)
           OR academic_year_id = $2::uuid
         )
         AND section_id = ANY($3::uuid[])`,
      [schoolId, safeAyId, sectionIds]
    );

    if (existRollQ.rowCount > 0) {
      const dbRollSet = new Set(
        existRollQ.rows.map((row: any) => `${row.section_id}_${String(row.roll_number).trim().toLowerCase()}`)
      );

      for (const r of rows) {
        const normRoll = normalizeRollNumber(r.rollNumber)?.toLowerCase();
        if (normRoll && isUuid(r.sectionId)) {
          const key = `${r.sectionId}_${normRoll}`;
          if (dbRollSet.has(key)) {
            errors.push({
              row: r.rowNum,
              field: 'Roll Number',
              message: `Roll number '${r.rollNumber}' is already assigned in ${r.classLabel} Section ${r.sectionName} for this academic session`
            });
          }
        }
      }
    }
  }

  return errors;
}
