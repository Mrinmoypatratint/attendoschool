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

export interface SiblingFamilyInfo {
  fatherName?: string | null;
  motherName?: string | null;
  parentName?: string | null;
  guardianName?: string | null;
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

/**
 * Normalizes phone number: extracts digits, standardizes to the 10-digit subscriber number.
 * Handles +91, 0, 0091, spaces, hyphens, and brackets.
 * Returns null for empty, null, undefined, or incomplete numbers (< 10 digits).
 * Blank values are never treated as duplicate phone numbers.
 */
export function normalizePhoneNumber(phone: any): string | null {
  if (phone === undefined || phone === null) return null;
  const s = String(phone).trim();
  if (!s) return null;
  const digits = s.replace(/\D/g, '');
  if (!digits || digits.length < 10) return null;

  // Return the standard 10-digit national number
  return digits.slice(-10);
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
      message: "This admission number is already registered."
    };
  }

  return { conflict: false };
}

/**
 * Checks if a roll number is already assigned in the class, section, and academic year.
 * Historical inactive students (is_active = false) do not conflict, allowing their roll numbers to be reused.
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
       AND (is_active IS NULL OR is_active = true)
     LIMIT 1`,
    [schoolId, safeAyId, safeClassId, safeSecId, norm, safeExclude]
  );

  if (q.rowCount && q.rowCount > 0) {
    return {
      conflict: true,
      message: "This roll number is already assigned in this class section for this academic year."
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
      message: "This email address is already registered."
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
        message: "This email address is already registered."
      };
    }
    if (u.role && u.role !== 'STUDENT') {
      return {
        conflict: true,
        message: `This email address is already registered.`
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
        message: "This email address is already registered."
      };
    }
  }

  return { conflict: false };
}

/**
 * Checks if a student phone number is already registered in the school.
 * Sibling Exception: Legitimate siblings sharing a guardian contact (matching father/mother/parent name)
 * are permitted and not flagged as duplicate conflicts.
 */
export async function checkStudentPhoneConflict(
  schoolId: string,
  phone: string,
  excludeStudentId?: string | null,
  familyInfo?: SiblingFamilyInfo | null,
  client: any = pool
): Promise<{ conflict: boolean; isSibling?: boolean; message?: string }> {
  const norm = normalizePhoneNumber(phone);
  if (!norm) return { conflict: false }; // Blank or invalid numbers are not treated as conflicts

  const safeExclude = isUuid(excludeStudentId) ? excludeStudentId : null;

  const q = await client.query(
    `SELECT id, name, father_name, mother_name, parent_name, guardian_name, parent_sms_number
     FROM students
     WHERE school_id = $1
       AND parent_sms_number IS NOT NULL
       AND TRIM(parent_sms_number) != ''
       AND RIGHT(regexp_replace(parent_sms_number, '[^0-9]', '', 'g'), 10) = $2
       AND ($3::uuid IS NULL OR id != $3::uuid)`,
    [schoolId, norm, safeExclude]
  );

  if (q.rowCount && q.rowCount > 0) {
    // Sibling Exception Model: If any student sharing this phone has a matching guardian/parent name, allow it
    if (familyInfo) {
      const normCurFather = (familyInfo.fatherName || '').trim().toLowerCase();
      const normCurMother = (familyInfo.motherName || '').trim().toLowerCase();
      const normCurParent = (familyInfo.parentName || '').trim().toLowerCase();

      const isSiblingMatch = q.rows.some((row: any) => {
        const rFather = (row.father_name || '').trim().toLowerCase();
        const rMother = (row.mother_name || '').trim().toLowerCase();
        const rParent = (row.parent_name || '').trim().toLowerCase();

        if (normCurFather && rFather && (normCurFather === rFather || normCurFather.includes(rFather) || rFather.includes(normCurFather))) return true;
        if (normCurMother && rMother && (normCurMother === rMother || normCurMother.includes(rMother) || rMother.includes(normCurMother))) return true;
        if (normCurParent && rParent && (normCurParent === rParent || normCurParent.includes(rParent) || rParent.includes(normCurParent))) return true;
        return false;
      });

      if (isSiblingMatch) {
        return { conflict: false, isSibling: true };
      }
    }

    return {
      conflict: true,
      message: "This phone number is already registered."
    };
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
  studentPhone?: string | null;
  phone?: string | null;
  familyInfo?: SiblingFamilyInfo | null;
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
    studentPhone,
    phone,
    familyInfo,
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

  const phoneToCheck = studentPhone || phone;
  if (phoneToCheck) {
    const phoneRes = await checkStudentPhoneConflict(schoolId, String(phoneToCheck), excludeStudentId, familyInfo, client);
    if (phoneRes.conflict && phoneRes.message) {
      errors.push({ field: 'studentPhone', message: phoneRes.message });
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Pre-validates a batch of student records for bulk import against:
 * 1. Intra-file duplicates (admission number, student email, roll number in section, phone).
 * 2. Database conflicts (admission number in school, student email in school/users, roll number in section & session, phone in school).
 * Sibling Exception: Multiple rows sharing a phone with matching father/mother/parent name are treated as legitimate siblings.
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
    parentPhone?: string;
    phone?: string;
    fatherName?: string;
    motherName?: string;
    parentName?: string;
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
  const seenPhones = new Map<string, { rowNum: number; fatherName?: string; motherName?: string; parentName?: string }>();

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

    const rawPhone = r.parentPhone || r.phone;
    const normPhone = normalizePhoneNumber(rawPhone);
    if (normPhone) {
      if (seenPhones.has(normPhone)) {
        const prev = seenPhones.get(normPhone)!;
        // Check if sibling match in file
        const rFather = (r.fatherName || '').trim().toLowerCase();
        const pFather = (prev.fatherName || '').trim().toLowerCase();
        const rMother = (r.motherName || '').trim().toLowerCase();
        const pMother = (prev.motherName || '').trim().toLowerCase();
        const rParent = (r.parentName || '').trim().toLowerCase();
        const pParent = (prev.parentName || '').trim().toLowerCase();

        const isSiblingInFile =
          (rFather && pFather && (rFather === pFather || rFather.includes(pFather) || pFather.includes(rFather))) ||
          (rMother && pMother && (rMother === pMother || rMother.includes(pMother) || pMother.includes(rMother))) ||
          (rParent && pParent && (rParent === pParent || rParent.includes(pParent) || pParent.includes(rParent)));

        if (!isSiblingInFile) {
          errors.push({
            row: r.rowNum,
            field: 'Phone Number',
            message: `Duplicate phone number '${rawPhone}' in this file (already used in row ${prev.rowNum})`
          });
        }
      } else {
        seenPhones.set(normPhone, {
          rowNum: r.rowNum,
          fatherName: r.fatherName,
          motherName: r.motherName,
          parentName: r.parentName
        });
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
    const existEmailQ = await client.query(
      `SELECT email FROM students
       WHERE school_id = $1
         AND LOWER(TRIM(email)) = ANY($2::text[])`,
      [schoolId, batchEmails]
    );

    const existEmailSet = new Set(existEmailQ.rows.map((row: any) => String(row.email).trim().toLowerCase()));

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

  // Check roll numbers in database for the given class/sections and academic year (only active students)
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
         AND section_id = ANY($3::uuid[])
         AND (is_active IS NULL OR is_active = true)`,
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

  // Check phone numbers in database with Sibling Exception
  const batchPhones = rows.map(r => normalizePhoneNumber(r.parentPhone || r.phone)).filter(Boolean) as string[];
  if (batchPhones.length > 0) {
    const existPhoneQ = await client.query(
      `SELECT RIGHT(regexp_replace(parent_sms_number, '[^0-9]', '', 'g'), 10) as phone,
              father_name, mother_name, parent_name
       FROM students
       WHERE school_id = $1
         AND parent_sms_number IS NOT NULL
         AND TRIM(parent_sms_number) != ''
         AND RIGHT(regexp_replace(parent_sms_number, '[^0-9]', '', 'g'), 10) = ANY($2::text[])`,
      [schoolId, batchPhones]
    );

    if (existPhoneQ.rowCount > 0) {
      for (const r of rows) {
        const norm = normalizePhoneNumber(r.parentPhone || r.phone);
        if (norm) {
          const matchingDbStudents = existPhoneQ.rows.filter((row: any) => String(row.phone).trim() === norm);
          if (matchingDbStudents.length > 0) {
            // Check if sibling match in database
            const rFather = (r.fatherName || '').trim().toLowerCase();
            const rMother = (r.motherName || '').trim().toLowerCase();
            const rParent = (r.parentName || '').trim().toLowerCase();

            const isDbSibling = matchingDbStudents.some((dbS: any) => {
              const dbFather = (dbS.father_name || '').trim().toLowerCase();
              const dbMother = (dbS.mother_name || '').trim().toLowerCase();
              const dbParent = (dbS.parent_name || '').trim().toLowerCase();

              if (rFather && dbFather && (rFather === dbFather || rFather.includes(dbFather) || dbFather.includes(rFather))) return true;
              if (rMother && dbMother && (rMother === dbMother || rMother.includes(dbMother) || dbMother.includes(rMother))) return true;
              if (rParent && dbParent && (rParent === dbParent || rParent.includes(dbParent) || dbParent.includes(rParent))) return true;
              return false;
            });

            if (!isDbSibling) {
              errors.push({
                row: r.rowNum,
                field: 'Phone Number',
                message: `Phone number '${r.parentPhone || r.phone}' already exists in the school database`
              });
            }
          }
        }
      }
    }
  }

  return errors;
}
