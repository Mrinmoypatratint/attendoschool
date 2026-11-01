import { pool } from '../db';
import { normalizeEmail, normalizePhoneNumber } from './studentValidation';

export interface TeacherUniquenessValidationResult {
  valid: boolean;
  errors: { field: string; message: string }[];
}

export interface TeacherImportErrorItem {
  row: number;
  field: string;
  message: string;
}

/**
 * Normalizes Employee ID / Saviour ID: trim whitespace.
 */
export function normalizeEmployeeId(id: any): string | null {
  if (id === undefined || id === null) return null;
  const s = String(id).trim();
  return s.length > 0 ? s : null;
}

const isUuid = (val: any): boolean =>
  typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

/**
 * Checks if an Employee ID / Saviour ID is already registered in the school.
 */
export async function checkTeacherEmployeeIdConflict(
  schoolId: string,
  employeeId: string,
  excludeUserId?: string | null,
  client: any = pool
): Promise<{ conflict: boolean; message?: string }> {
  const norm = normalizeEmployeeId(employeeId);
  if (!norm) return { conflict: false };

  const safeExclude = isUuid(excludeUserId) ? excludeUserId : null;
  const q = await client.query(
    `SELECT tp.id, tp.employee_id, u.name
     FROM teacher_profiles tp
     JOIN users u ON tp.user_id = u.id
     WHERE u.school_id = $1
       AND LOWER(TRIM(tp.employee_id)) = LOWER(TRIM($2))
       AND ($3::uuid IS NULL OR (tp.user_id != $3::uuid AND tp.id != $3::uuid))
     LIMIT 1`,
    [schoolId, norm, safeExclude]
  );

  if (q.rowCount && q.rowCount > 0) {
    return {
      conflict: true,
      message: "This Employee/Saviour ID is already registered."
    };
  }

  return { conflict: false };
}

/**
 * Checks if a teacher email address is already registered in the school or users table.
 */
export async function checkTeacherEmailConflict(
  schoolId: string,
  email: string,
  excludeUserId?: string | null,
  client: any = pool
): Promise<{ conflict: boolean; message?: string }> {
  const norm = normalizeEmail(email);
  if (!norm) return { conflict: false };

  const safeExclude = isUuid(excludeUserId) ? excludeUserId : null;

  // Check users table (email is used for login)
  const q = await client.query(
    `SELECT id, name, role, school_id
     FROM users
     WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))
       AND ($2::uuid IS NULL OR id != $2::uuid)
     LIMIT 1`,
    [norm, safeExclude]
  );

  if (q.rowCount && q.rowCount > 0) {
    return {
      conflict: true,
      message: "This email address is already registered."
    };
  }

  return { conflict: false };
}

/**
 * Checks if a teacher phone/mobile number is already registered in the school.
 */
export async function checkTeacherPhoneConflict(
  schoolId: string,
  phone: string,
  excludeUserId?: string | null,
  client: any = pool
): Promise<{ conflict: boolean; message?: string }> {
  const norm = normalizePhoneNumber(phone);
  if (!norm) return { conflict: false };

  const safeExclude = isUuid(excludeUserId) ? excludeUserId : null;
  const last10 = norm.slice(-10);

  const q = await client.query(
    `SELECT tp.id, u.name, COALESCE(tp.phone, tp.mobile) as phone
     FROM teacher_profiles tp
     JOIN users u ON tp.user_id = u.id
     WHERE u.school_id = $1
       AND COALESCE(tp.phone, tp.mobile) IS NOT NULL
       AND TRIM(COALESCE(tp.phone, tp.mobile)) != ''
       AND (
         RIGHT(regexp_replace(COALESCE(tp.phone, tp.mobile), '[^0-9]', '', 'g'), 10) = $2
         OR regexp_replace(COALESCE(tp.phone, tp.mobile), '[^0-9]', '', 'g') = $3
       )
       AND ($4::uuid IS NULL OR (tp.user_id != $4::uuid AND tp.id != $4::uuid))
     LIMIT 1`,
    [schoolId, last10, norm, safeExclude]
  );

  if (q.rowCount && q.rowCount > 0) {
    return {
      conflict: true,
      message: "This phone number is already registered."
    };
  }

  return { conflict: false };
}

/**
 * Composite validator for single teacher create or edit operations.
 */
export async function validateTeacherUniqueness(params: {
  schoolId: string;
  employeeId?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  excludeUserId?: string | null;
  client?: any;
}): Promise<TeacherUniquenessValidationResult> {
  const {
    schoolId,
    employeeId,
    email,
    phone,
    mobile,
    excludeUserId,
    client = pool
  } = params;

  const errors: { field: string; message: string }[] = [];

  if (employeeId) {
    const empRes = await checkTeacherEmployeeIdConflict(schoolId, String(employeeId), excludeUserId, client);
    if (empRes.conflict && empRes.message) {
      errors.push({ field: 'employeeId', message: empRes.message });
    }
  }

  if (email) {
    const emailRes = await checkTeacherEmailConflict(schoolId, String(email), excludeUserId, client);
    if (emailRes.conflict && emailRes.message) {
      errors.push({ field: 'email', message: emailRes.message });
    }
  }

  const phoneToCheck = mobile || phone;
  if (phoneToCheck) {
    const phoneRes = await checkTeacherPhoneConflict(schoolId, String(phoneToCheck), excludeUserId, client);
    if (phoneRes.conflict && phoneRes.message) {
      errors.push({ field: 'phone', message: phoneRes.message });
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Pre-validates a batch of teacher records for bulk import against:
 * 1. Intra-file duplicates (Employee ID, email, mobile).
 * 2. Database conflicts (Employee ID in school, email in users, mobile in school).
 */
export async function preValidateTeacherBulkImport(params: {
  schoolId: string;
  rows: {
    rowNum: number;
    saviorNo: string;
    email: string;
    mobile?: string;
    phone?: string;
    name?: string;
  }[];
  client?: any;
}): Promise<TeacherImportErrorItem[]> {
  const { schoolId, rows, client = pool } = params;
  const errors: TeacherImportErrorItem[] = [];

  // 1. INTRA-FILE DUPLICATES
  const seenEmpIds = new Map<string, number>();
  const seenEmails = new Map<string, number>();
  const seenPhones = new Map<string, number>();

  for (const r of rows) {
    const normEmp = normalizeEmployeeId(r.saviorNo)?.toLowerCase();
    if (normEmp) {
      if (seenEmpIds.has(normEmp)) {
        errors.push({
          row: r.rowNum,
          field: 'Savior_No',
          message: `Duplicate Savior_No / Employee ID '${r.saviorNo}' in this file (already used in row ${seenEmpIds.get(normEmp)})`
        });
      } else {
        seenEmpIds.set(normEmp, r.rowNum);
      }
    }

    const normEmail = normalizeEmail(r.email);
    if (normEmail) {
      if (seenEmails.has(normEmail)) {
        errors.push({
          row: r.rowNum,
          field: 'Email_id',
          message: `Duplicate email address '${r.email}' in this file (already used in row ${seenEmails.get(normEmail)})`
        });
      } else {
        seenEmails.set(normEmail, r.rowNum);
      }
    }

    const rawPhone = r.mobile || r.phone;
    const normPhone = normalizePhoneNumber(rawPhone);
    if (normPhone) {
      const phoneKey = normPhone.slice(-10);
      if (seenPhones.has(phoneKey)) {
        errors.push({
          row: r.rowNum,
          field: 'Mobile',
          message: `Duplicate phone number '${rawPhone}' in this file (already used in row ${seenPhones.get(phoneKey)})`
        });
      } else {
        seenPhones.set(phoneKey, r.rowNum);
      }
    }
  }

  // 2. DATABASE CONFLICTS
  const batchEmpIds = rows.map(r => normalizeEmployeeId(r.saviorNo)?.toLowerCase()).filter(Boolean) as string[];
  if (batchEmpIds.length > 0) {
    const existEmpQ = await client.query(
      `SELECT tp.employee_id
       FROM teacher_profiles tp
       JOIN users u ON tp.user_id = u.id
       WHERE u.school_id = $1
         AND LOWER(TRIM(tp.employee_id)) = ANY($2::text[])`,
      [schoolId, batchEmpIds]
    );

    if (existEmpQ.rowCount > 0) {
      const dbEmpSet = new Set(existEmpQ.rows.map((row: any) => String(row.employee_id).trim().toLowerCase()));
      for (const r of rows) {
        const norm = normalizeEmployeeId(r.saviorNo)?.toLowerCase();
        if (norm && dbEmpSet.has(norm)) {
          errors.push({
            row: r.rowNum,
            field: 'Savior_No',
            message: `Employee ID / Savior_No '${r.saviorNo}' already exists in the school database`
          });
        }
      }
    }
  }

  const batchEmails = rows.map(r => normalizeEmail(r.email)).filter(Boolean) as string[];
  if (batchEmails.length > 0) {
    const existEmailQ = await client.query(
      `SELECT email FROM users
       WHERE LOWER(TRIM(email)) = ANY($1::text[])`,
      [batchEmails]
    );

    if (existEmailQ.rowCount > 0) {
      const dbEmailSet = new Set(existEmailQ.rows.map((row: any) => String(row.email).trim().toLowerCase()));
      for (const r of rows) {
        const norm = normalizeEmail(r.email);
        if (norm && dbEmailSet.has(norm)) {
          errors.push({
            row: r.rowNum,
            field: 'Email_id',
            message: `Email address '${r.email}' is already registered in the database`
          });
        }
      }
    }
  }

  const batchPhones = rows.map(r => normalizePhoneNumber(r.mobile || r.phone)?.slice(-10)).filter(Boolean) as string[];
  if (batchPhones.length > 0) {
    const existPhoneQ = await client.query(
      `SELECT RIGHT(regexp_replace(COALESCE(tp.phone, tp.mobile), '[^0-9]', '', 'g'), 10) as phone
       FROM teacher_profiles tp
       JOIN users u ON tp.user_id = u.id
       WHERE u.school_id = $1
         AND COALESCE(tp.phone, tp.mobile) IS NOT NULL
         AND TRIM(COALESCE(tp.phone, tp.mobile)) != ''
         AND RIGHT(regexp_replace(COALESCE(tp.phone, tp.mobile), '[^0-9]', '', 'g'), 10) = ANY($2::text[])`,
      [schoolId, batchPhones]
    );

    if (existPhoneQ.rowCount > 0) {
      const dbPhoneSet = new Set(existPhoneQ.rows.map((row: any) => String(row.phone).trim()));
      for (const r of rows) {
        const norm = normalizePhoneNumber(r.mobile || r.phone)?.slice(-10);
        if (norm && dbPhoneSet.has(norm)) {
          errors.push({
            row: r.rowNum,
            field: 'Mobile',
            message: `Phone number '${r.mobile || r.phone}' already exists in the school database`
          });
        }
      }
    }
  }

  return errors;
}
