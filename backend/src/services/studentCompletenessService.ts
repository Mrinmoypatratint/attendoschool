import { Response } from 'express';
import { pool } from '../db';
import { normalizeGender } from '../utils/gender';
import { isSameSession, toCanonicalSession } from '../routes/schoolData';
import { AuthRequest } from '../middleware/auth';

export interface CompletenessFieldConfig {
  key: string;
  label: string;
  category: 'Academic' | 'Personal' | 'Parent/Guardian' | 'Contact';
  required: boolean;
  formFieldId: string;
  sqlColumn: string;
  sqlMissingCondition: string;
}

export const COMPLETENESS_FIELDS: CompletenessFieldConfig[] = [
  // ── 1. Required Personal & Academic Fields ──
  {
    key: 'first_name',
    label: 'Student Name',
    category: 'Personal',
    required: true,
    formFieldId: 'student-form-first-name',
    sqlColumn: 'name',
    sqlMissingCondition: "((st.first_name IS NULL OR TRIM(st.first_name) = '') AND (st.name IS NULL OR TRIM(st.name) = ''))"
  },
  {
    key: 'admission_number',
    label: 'Admission Number',
    category: 'Academic',
    required: true,
    formFieldId: 'student-form-admission-number',
    sqlColumn: 'admission_number',
    sqlMissingCondition: "(st.admission_number IS NULL OR TRIM(st.admission_number) = '')"
  },
  {
    key: 'roll_number',
    label: 'Roll Number',
    category: 'Academic',
    required: true,
    formFieldId: 'student-form-roll-number',
    sqlColumn: 'roll_number',
    sqlMissingCondition: "(st.roll_number IS NULL OR TRIM(CAST(st.roll_number AS TEXT)) = '')"
  },
  {
    key: 'date_of_birth',
    label: 'Date of Birth',
    category: 'Personal',
    required: true,
    formFieldId: 'student-form-dob',
    sqlColumn: 'date_of_birth',
    sqlMissingCondition: '(st.date_of_birth IS NULL)'
  },
  {
    key: 'gender',
    label: 'Gender',
    category: 'Personal',
    required: true,
    formFieldId: 'student-form-gender',
    sqlColumn: 'gender',
    sqlMissingCondition: "(st.gender IS NULL OR TRIM(st.gender) = '' OR TRIM(st.gender) = '—' OR TRIM(st.gender) = '-' OR LOWER(TRIM(st.gender)) = 'not specified' OR LOWER(TRIM(st.gender)) = 'null')"
  },
  {
    key: 'admission_date',
    label: 'Admission Date',
    category: 'Academic',
    required: true,
    formFieldId: 'student-form-admission-date',
    sqlColumn: 'admission_date',
    sqlMissingCondition: '(st.admission_date IS NULL)'
  },
  {
    key: 'class_id',
    label: 'Class',
    category: 'Academic',
    required: true,
    formFieldId: 'student-form-class',
    sqlColumn: 'class_id',
    sqlMissingCondition: '(st.class_id IS NULL)'
  },
  {
    key: 'section_id',
    label: 'Section',
    category: 'Academic',
    required: true,
    formFieldId: 'student-form-section',
    sqlColumn: 'section_id',
    sqlMissingCondition: '(st.section_id IS NULL)'
  },
  {
    key: 'student_email',
    label: 'Student Email',
    category: 'Contact',
    required: true,
    formFieldId: 'student-form-student-email',
    sqlColumn: 'email',
    sqlMissingCondition: "(st.email IS NULL OR TRIM(st.email) = '')"
  },
  {
    key: 'parent_sms_number',
    label: 'Parent SMS Number',
    category: 'Contact',
    required: true,
    formFieldId: 'student-form-parent-sms',
    sqlColumn: 'parent_sms_number',
    sqlMissingCondition: "(st.parent_sms_number IS NULL OR TRIM(st.parent_sms_number) = '')"
  },
  // ── 2. Conditional Parent / Guardian Contact ──
  // A student satisfies parent contact if at least one applicable parent/guardian (Father, Mother, or Guardian)
  // has a valid name and contact number.
  {
    key: 'parent_guardian_contact',
    label: 'Parent / Guardian Details',
    category: 'Parent/Guardian',
    required: true,
    formFieldId: 'student-form-father-name',
    sqlColumn: 'parent_name',
    sqlMissingCondition: `NOT (
      (st.father_name IS NOT NULL AND TRIM(st.father_name) != '' AND ((st.father_phone IS NOT NULL AND TRIM(st.father_phone) != '') OR (st.parent_sms_number IS NOT NULL AND TRIM(st.parent_sms_number) != '')))
      OR (st.mother_name IS NOT NULL AND TRIM(st.mother_name) != '' AND ((st.mother_phone IS NOT NULL AND TRIM(st.mother_phone) != '') OR (st.parent_sms_number IS NOT NULL AND TRIM(st.parent_sms_number) != '')))
      OR (st.guardian_name IS NOT NULL AND TRIM(st.guardian_name) != '' AND (st.parent_sms_number IS NOT NULL AND TRIM(st.parent_sms_number) != ''))
      OR (st.parent_name IS NOT NULL AND TRIM(st.parent_name) != '' AND (st.parent_sms_number IS NOT NULL AND TRIM(st.parent_sms_number) != ''))
    )`
  },

  // ── 3. Optional Fields (Visible & Editable, but do NOT penalize completeness) ──
  {
    key: 'father_name',
    label: "Father's Name",
    category: 'Parent/Guardian',
    required: false,
    formFieldId: 'student-form-father-name',
    sqlColumn: 'father_name',
    sqlMissingCondition: "(st.father_name IS NULL OR TRIM(st.father_name) = '')"
  },
  {
    key: 'father_phone',
    label: "Father's Contact Number",
    category: 'Parent/Guardian',
    required: false,
    formFieldId: 'student-form-father-phone',
    sqlColumn: 'father_phone',
    sqlMissingCondition: "(st.father_phone IS NULL OR TRIM(st.father_phone) = '')"
  },
  {
    key: 'father_occupation',
    label: "Father's Occupation",
    category: 'Parent/Guardian',
    required: false,
    formFieldId: 'student-form-father-occupation',
    sqlColumn: 'father_occupation',
    sqlMissingCondition: "(st.father_occupation IS NULL OR TRIM(st.father_occupation) = '')"
  },
  {
    key: 'mother_name',
    label: "Mother's Name",
    category: 'Parent/Guardian',
    required: false,
    formFieldId: 'student-form-mother-name',
    sqlColumn: 'mother_name',
    sqlMissingCondition: "(st.mother_name IS NULL OR TRIM(st.mother_name) = '')"
  },
  {
    key: 'mother_phone',
    label: "Mother's Contact Number",
    category: 'Parent/Guardian',
    required: false,
    formFieldId: 'student-form-mother-phone',
    sqlColumn: 'mother_phone',
    sqlMissingCondition: "(st.mother_phone IS NULL OR TRIM(st.mother_phone) = '')"
  },
  {
    key: 'mother_occupation',
    label: "Mother's Occupation",
    category: 'Parent/Guardian',
    required: false,
    formFieldId: 'student-form-mother-occupation',
    sqlColumn: 'mother_occupation',
    sqlMissingCondition: "(st.mother_occupation IS NULL OR TRIM(st.mother_occupation) = '')"
  },
  {
    key: 'guardian_name',
    label: "Guardian's Name",
    category: 'Parent/Guardian',
    required: false,
    formFieldId: 'student-form-guardian-name',
    sqlColumn: 'guardian_name',
    sqlMissingCondition: "(st.guardian_name IS NULL OR TRIM(st.guardian_name) = '')"
  },
  {
    key: 'parent_whatsapp',
    label: 'Parent WhatsApp No.',
    category: 'Contact',
    required: false,
    formFieldId: 'student-form-parent-whatsapp',
    sqlColumn: 'parent_whatsapp',
    sqlMissingCondition: "(st.parent_whatsapp IS NULL OR TRIM(st.parent_whatsapp) = '')"
  },
  {
    key: 'parent_email',
    label: 'Parent Email Address',
    category: 'Contact',
    required: false,
    formFieldId: 'student-form-parent-email',
    sqlColumn: 'parent_email',
    sqlMissingCondition: "(st.parent_email IS NULL OR TRIM(st.parent_email) = '')"
  },
  {
    key: 'middle_name',
    label: 'Middle Name',
    category: 'Personal',
    required: false,
    formFieldId: 'student-form-middle-name',
    sqlColumn: 'middle_name',
    sqlMissingCondition: "(st.middle_name IS NULL OR TRIM(st.middle_name) = '')"
  },
  {
    key: 'address',
    label: 'Address',
    category: 'Personal',
    required: false,
    formFieldId: 'student-form-address',
    sqlColumn: 'address',
    sqlMissingCondition: "(st.address IS NULL OR TRIM(st.address) = '')"
  },
  {
    key: 'photo_url',
    label: 'Student Photo',
    category: 'Personal',
    required: false,
    formFieldId: 'student-form-photo',
    sqlColumn: 'photo_url',
    sqlMissingCondition: "(st.photo_url IS NULL OR TRIM(st.photo_url) = '')"
  }
];

export const REQUIRED_FIELDS = COMPLETENESS_FIELDS.filter(f => f.required);
export const OPTIONAL_FIELDS = COMPLETENESS_FIELDS.filter(f => !f.required);

export interface FilterOptions {
  session?: string;
  academicYearId?: string;
  classId?: string;
  sectionId?: string;
  search?: string;
  missingField?: string;
  includeOptional?: boolean;
  page?: number;
  limit?: number;
}

export interface ResolvedAcademicYear {
  isAll: boolean;
  academicYearId: string | null;
  academicYearName: string | null;
  isActive: boolean;
  notFound?: boolean;
}

/**
 * Resolves the academic year for a school based on user session query/id.
 * Reuses identical canonicalization & session matching as All Students directory:
 * - Direct UUID matching
 * - Canonical session comparison (e.g. "2026–27 Academic Session" -> "2026-2027")
 * - isSameSession logic (handles unicode en-dashes, hyphens, and 2 vs 4 digit year variations)
 * - Explicit "all" or empty input resolution
 * - Unassigned student inclusion logic for active sessions
 */
export async function resolveAcademicYearForSchool(
  schoolId: string,
  sessionInput?: string,
  academicYearIdInput?: string
): Promise<ResolvedAcademicYear> {
  const { rows: dbYears } = await pool.query(
    'SELECT id, name, is_active FROM academic_years WHERE school_id = $1 ORDER BY is_active DESC, created_at DESC',
    [schoolId]
  );

  const rawSession = sessionInput ? decodeURIComponent(String(sessionInput)).trim() : '';
  const rawYearId = academicYearIdInput ? String(academicYearIdInput).trim() : '';

  // 1. Explicit All Sessions
  if (/^all(\s+sessions?)?$/i.test(rawSession) || /^all(\s+sessions?)?$/i.test(rawYearId)) {
    return { isAll: true, academicYearId: null, academicYearName: 'All Sessions', isActive: false };
  }

  // 2. Direct academicYearId UUID match
  if (rawYearId) {
    const directYear = dbYears.find(y => y.id.toLowerCase() === rawYearId.toLowerCase());
    if (directYear) {
      return {
        isAll: false,
        academicYearId: directYear.id,
        academicYearName: directYear.name,
        isActive: Boolean(directYear.is_active)
      };
    }
  }

  // 3. Match from sessionInput
  if (rawSession) {
    // If rawSession is a UUID
    const uuidMatch = dbYears.find(y => y.id.toLowerCase() === rawSession.toLowerCase());
    if (uuidMatch) {
      return {
        isAll: false,
        academicYearId: uuidMatch.id,
        academicYearName: uuidMatch.name,
        isActive: Boolean(uuidMatch.is_active)
      };
    }

    // Match via isSameSession (handles 2026–27 Academic Session, 2026-27, etc.)
    const sameMatch = dbYears.find(y => isSameSession(y.name, rawSession));
    if (sameMatch) {
      return {
        isAll: false,
        academicYearId: sameMatch.id,
        academicYearName: sameMatch.name,
        isActive: Boolean(sameMatch.is_active)
      };
    }

    // Match via toCanonicalSession
    const canonInput = toCanonicalSession(rawSession);
    if (canonInput) {
      const canonMatch = dbYears.find(y => toCanonicalSession(y.name) === canonInput);
      if (canonMatch) {
        return {
          isAll: false,
          academicYearId: canonMatch.id,
          academicYearName: canonMatch.name,
          isActive: Boolean(canonMatch.is_active)
        };
      }
      const canonSubMatch = dbYears.find(y => {
        const c = toCanonicalSession(y.name);
        return c && (c.includes(canonInput) || canonInput.includes(c));
      });
      if (canonSubMatch) {
        return {
          isAll: false,
          academicYearId: canonSubMatch.id,
          academicYearName: canonSubMatch.name,
          isActive: Boolean(canonSubMatch.is_active)
        };
      }
    }

    // A specific session was requested, but no academic year matched in DB
    return {
      isAll: false,
      academicYearId: '00000000-0000-0000-0000-000000000000',
      academicYearName: rawSession,
      isActive: false,
      notFound: true
    };
  }

  // 4. Default: If no session specified, return All Sessions (matching All Students directory)
  return { isAll: true, academicYearId: null, academicYearName: 'All Sessions', isActive: false };
}

/**
 * Builds SQL WHERE conditions for tenant isolation and optional filters.
 */
function buildSessionAndScopeWhere(
  schoolId: string,
  options: FilterOptions,
  params: any[],
  resolvedYear: ResolvedAcademicYear
): string {
  params.push(schoolId);
  let where = `WHERE st.school_id = $${params.length} AND COALESCE(st.is_active, true) = true`;

  if (!resolvedYear.isAll && resolvedYear.academicYearId) {
    if (resolvedYear.notFound) {
      where += ` AND 1 = 0`;
    } else if (resolvedYear.isActive) {
      // For active academic year, include students belonging to this year OR unassigned students
      params.push(resolvedYear.academicYearId);
      where += ` AND (st.academic_year_id = $${params.length}::uuid OR st.academic_year_id IS NULL)`;
    } else {
      // For historical / non-active session, strictly match that session ID
      params.push(resolvedYear.academicYearId);
      where += ` AND st.academic_year_id = $${params.length}::uuid`;
    }
  }

  if (options.classId && options.classId.trim()) {
    const isClassUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(options.classId.trim());
    const cNum = parseInt(options.classId.replace(/\D/g, ''), 10);
    if (isClassUuid) {
      params.push(options.classId.trim());
      where += ` AND st.class_id = $${params.length}::uuid`;
    } else if (!isNaN(cNum)) {
      params.push(cNum);
      where += ` AND c.class_number = $${params.length}`;
    }
  }

  if (options.sectionId && options.sectionId.trim()) {
    const isSecUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(options.sectionId.trim());
    if (isSecUuid) {
      params.push(options.sectionId.trim());
      where += ` AND st.section_id = $${params.length}::uuid`;
    } else {
      const cleanSec = options.sectionId.replace(/section\s*/i, '').trim().toUpperCase();
      params.push(cleanSec);
      where += ` AND UPPER(sec.name) = $${params.length}`;
    }
  }

  return where;
}

/**
 * Calculates dashboard completeness summary cards & breakdown from actual database records.
 */
export async function getStudentCompletenessSummary(
  schoolId: string,
  options: FilterOptions = {}
) {
  const resolvedYear = await resolveAcademicYearForSchool(schoolId, options.session, options.academicYearId);
  const params: any[] = [];
  const baseWhere = buildSessionAndScopeWhere(schoolId, options, params, resolvedYear);

  // Condition for at least one required field missing
  const anyRequiredMissingSql = REQUIRED_FIELDS.map(f => f.sqlMissingCondition).join(' OR ');

  // Condition for all required fields present (complete profile)
  const allRequiredPresentSql = REQUIRED_FIELDS.map(f => `NOT (${f.sqlMissingCondition})`).join(' AND ');

  // Individual field missing aggregations
  const fieldSelects = COMPLETENESS_FIELDS.map(
    f => `COUNT(*) FILTER (WHERE ${f.sqlMissingCondition})::int AS "missing_${f.key}"`
  ).join(',\n    ');

  const query = `
    SELECT
      COUNT(*)::int AS total_students,
      COUNT(*) FILTER (WHERE ${allRequiredPresentSql})::int AS complete_profiles,
      COUNT(*) FILTER (WHERE ${anyRequiredMissingSql})::int AS incomplete_profiles,
      ${fieldSelects}
    FROM students st
    LEFT JOIN classes c ON c.id = st.class_id
    LEFT JOIN sections sec ON sec.id = st.section_id
    LEFT JOIN academic_years ay ON ay.id = st.academic_year_id
    ${baseWhere}
  `;

  const { rows } = await pool.query(query, params);
  const raw = rows[0] || {};

  const totalStudents = Number(raw.total_students || 0);
  const completeProfiles = Number(raw.complete_profiles || 0);
  const incompleteProfiles = Number(raw.incomplete_profiles || 0);

  let totalMissingFields = 0;
  const fieldBreakdown = COMPLETENESS_FIELDS.map(f => {
    const missingCount = Number(raw[`missing_${f.key}`] || 0);
    if (f.required) {
      totalMissingFields += missingCount;
    }
    const completedCount = Math.max(0, totalStudents - missingCount);
    const completionPercentage = totalStudents > 0
      ? Math.round((completedCount / totalStudents) * 1000) / 10
      : 100;

    return {
      key: f.key,
      label: f.label,
      category: f.category,
      required: f.required,
      formFieldId: f.formFieldId,
      missingCount,
      completedCount,
      completionPercentage
    };
  });

  const completenessScore = totalStudents > 0
    ? Math.round((completeProfiles / totalStudents) * 1000) / 10
    : 100;

  return {
    summary: {
      totalStudents,
      completeProfiles,
      incompleteProfiles,
      totalMissingFields,
      completenessScore
    },
    fieldBreakdown,
    requiredFields: REQUIRED_FIELDS.map(f => ({ key: f.key, label: f.label, category: f.category })),
    optionalFields: OPTIONAL_FIELDS.map(f => ({ key: f.key, label: f.label, category: f.category })),
    activeSession: resolvedYear.academicYearName || options.session || 'All Sessions'
  };
}

/**
 * Returns list of incomplete students with their specific missing information.
 */
export async function getIncompleteStudents(
  schoolId: string,
  options: FilterOptions = {}
) {
  const resolvedYear = await resolveAcademicYearForSchool(schoolId, options.session, options.academicYearId);
  const params: any[] = [];
  let where = buildSessionAndScopeWhere(schoolId, options, params, resolvedYear);

  // Missing field filtering
  const targetFieldKey = options.missingField && options.missingField !== 'all'
    ? options.missingField.trim()
    : null;

  if (targetFieldKey) {
    const targetField = COMPLETENESS_FIELDS.find(f => f.key === targetFieldKey);
    if (targetField) {
      where += ` AND (${targetField.sqlMissingCondition})`;
    } else {
      // Default to any required field missing
      const anyReq = REQUIRED_FIELDS.map(f => f.sqlMissingCondition).join(' OR ');
      where += ` AND (${anyReq})`;
    }
  } else {
    // Show all students with at least 1 missing required field
    const anyReq = REQUIRED_FIELDS.map(f => f.sqlMissingCondition).join(' OR ');
    where += ` AND (${anyReq})`;
  }

  // Student search filter (name, admission_number, roll_number)
  if (options.search && options.search.trim()) {
    params.push(`%${options.search.trim()}%`);
    const sIdx = params.length;
    where += ` AND (
      st.name ILIKE $${sIdx} OR
      COALESCE(st.admission_number, '') ILIKE $${sIdx} OR
      CAST(st.roll_number AS TEXT) ILIKE $${sIdx} OR
      COALESCE(st.first_name, '') ILIKE $${sIdx} OR
      COALESCE(st.last_name, '') ILIKE $${sIdx} OR
      COALESCE(st.email, '') ILIKE $${sIdx}
    )`;
  }

  // Count total matching incomplete students
  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM students st
    LEFT JOIN classes c ON c.id = st.class_id
    LEFT JOIN sections sec ON sec.id = st.section_id
    LEFT JOIN academic_years ay ON ay.id = st.academic_year_id
    ${where}
  `;
  const countRes = await pool.query(countQuery, params);
  const total = Number(countRes.rows[0]?.total || 0);

  // Pagination
  const page = Math.max(1, Number(options.page || 1));
  const limit = Math.max(1, Math.min(Number(options.limit || 25), 5000));
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const offset = (page - 1) * limit;

  params.push(limit);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  const dataQuery = `
    SELECT
      st.id,
      st.name,
      st.first_name,
      st.middle_name,
      st.last_name,
      st.roll_number,
      st.admission_number,
      st.admission_date,
      st.date_of_birth,
      st.gender,
      st.email AS student_email,
      st.parent_name,
      st.parent_sms_number,
      st.parent_whatsapp,
      st.parent_email,
      st.father_name,
      st.father_phone,
      st.father_occupation,
      st.mother_name,
      st.mother_phone,
      st.mother_occupation,
      st.guardian_name,
      st.address,
      st.photo_url,
      COALESCE(st.is_active, true) AS is_active,
      st.created_at,
      st.updated_at,
      c.id AS class_id,
      c.class_number,
      CASE
        WHEN c.class_number = -1 THEN 'Class LKG'
        WHEN c.class_number = 0 THEN 'Class UKG'
        WHEN c.class_number IS NOT NULL THEN 'Class ' || c.class_number
        ELSE ''
      END AS class_name,
      sec.id AS section_id,
      sec.name AS section_name,
      st.academic_year_id,
      ay.name AS session_name
    FROM students st
    LEFT JOIN classes c ON c.id = st.class_id
    LEFT JOIN sections sec ON sec.id = st.section_id
    LEFT JOIN academic_years ay ON ay.id = st.academic_year_id
    ${where}
    ORDER BY COALESCE(c.class_number, 99), COALESCE(sec.name, ''), st.roll_number NULLS LAST, st.name
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const { rows } = await pool.query(dataQuery, params);

  const students = rows.map((st: any) => {
    // Compute missing fields for this individual student record
    const missingFields: { key: string; label: string; category: string; formFieldId: string; required: boolean }[] = [];

    const pSms = st.parent_sms_number && String(st.parent_sms_number).trim();
    const fName = st.father_name && String(st.father_name).trim();
    const fPhone = st.father_phone && String(st.father_phone).trim();
    const mName = st.mother_name && String(st.mother_name).trim();
    const mPhone = st.mother_phone && String(st.mother_phone).trim();
    const gName = st.guardian_name && String(st.guardian_name).trim();
    const pName = st.parent_name && String(st.parent_name).trim();

    for (const f of COMPLETENESS_FIELDS) {
      if (!f.required && !options.includeOptional) {
        continue;
      }
      let isMissing = false;

      if (f.key === 'parent_guardian_contact') {
        const hasFather = Boolean(fName && (fPhone || pSms));
        const hasMother = Boolean(mName && (mPhone || pSms));
        const hasGuardian = Boolean(gName && pSms);
        const hasGenericParent = Boolean(pName && pSms);
        isMissing = !(hasFather || hasMother || hasGuardian || hasGenericParent);
      } else if (f.key === 'first_name') {
        const hasFirst = Boolean(st.first_name && String(st.first_name).trim());
        const hasFull = Boolean(st.name && String(st.name).trim());
        isMissing = !(hasFirst || hasFull);
      } else if (f.key === 'date_of_birth' || f.key === 'admission_date') {
        isMissing = !st[f.sqlColumn];
      } else if (f.key === 'class_id' || f.key === 'section_id') {
        isMissing = !st[f.sqlColumn];
      } else if (f.key === 'gender') {
        const norm = normalizeGender(st.gender);
        isMissing = !norm;
      } else {
        // String fields: empty or whitespace-only is missing; '0' is valid
        const val = st[f.key === 'student_email' ? 'student_email' : f.sqlColumn];
        isMissing = val === null || val === undefined || String(val).trim() === '';
      }

      if (isMissing) {
        missingFields.push({
          key: f.key,
          label: f.label,
          category: f.category,
          formFieldId: f.formFieldId,
          required: f.required
        });
      }
    }

    const cleanDob = st.date_of_birth
      ? (st.date_of_birth instanceof Date ? st.date_of_birth.toISOString().slice(0, 10) : String(st.date_of_birth).slice(0, 10))
      : '';
    const cleanAdmissionDate = st.admission_date
      ? (st.admission_date instanceof Date ? st.admission_date.toISOString().slice(0, 10) : String(st.admission_date).slice(0, 10))
      : '';

    return {
      ...st,
      date_of_birth: cleanDob,
      dob: cleanDob,
      admission_date: cleanAdmissionDate,
      admissionDate: cleanAdmissionDate,
      gender: normalizeGender(st.gender) || '',
      missingFields,
      missingCount: missingFields.filter(mf => mf.required).length,
      isComplete: missingFields.filter(mf => mf.required).length === 0
    };
  });

  return {
    students,
    pagination: {
      total,
      page,
      limit,
      totalPages
    }
  };
}

/**
 * Escapes a cell value according to RFC 4180 CSV specifications.
 * Handles commas, double-quotes, carriage returns, and newlines.
 */
export function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Streams unpaginated incomplete students directly over HTTP response as CSV.
 * Fetches in manageable batches from PostgreSQL without loading all records into memory.
 */
export async function streamIncompleteStudentsCsv(
  schoolId: string,
  options: FilterOptions,
  req: AuthRequest,
  res: Response
) {
  const resolvedYear = await resolveAcademicYearForSchool(schoolId, options.session, options.academicYearId);
  const sessionLabel = resolvedYear.academicYearName
    ? String(resolvedYear.academicYearName).replace(/[^a-zA-Z0-9_-]/g, '_')
    : options.session
      ? String(options.session).replace(/[^a-zA-Z0-9_-]/g, '_')
      : 'All_Sessions';
  const filename = `Missing_Student_Information_${options.missingField || 'All'}_${sessionLabel}_${new Date().toISOString().slice(0, 10)}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Transfer-Encoding', 'chunked');

  // UTF-8 BOM for Microsoft Excel compatibility
  res.write('\uFEFF');

  const headers = [
    'Student Name',
    'Admission No',
    'Roll No',
    'Class',
    'Section',
    'Session',
    'Missing Fields Count',
    'Missing Information',
    'Parent SMS Number',
    'Parent WhatsApp',
    'Parent Email',
    'Father Name',
    'Father Contact',
    'Father Occupation',
    'Mother Name',
    'Mother Contact',
    'Mother Occupation',
    'Guardian Name'
  ];

  res.write(headers.map(escapeCsvCell).join(',') + '\r\n');

  let clientDisconnected = false;
  req.on('close', () => {
    clientDisconnected = true;
  });

  const batchSize = 500;
  let page = 1;

  while (!clientDisconnected) {
    const result = await getIncompleteStudents(schoolId, {
      ...options,
      page,
      limit: batchSize
    });

    if (!result.students || result.students.length === 0) {
      break;
    }

    for (const st of result.students) {
      if (clientDisconnected) break;
      const row = [
        st.name || `${st.first_name || ''} ${st.last_name || ''}`.trim(),
        st.admission_number || '—',
        st.roll_number || '—',
        st.class_name || (st.class_number !== undefined && st.class_number !== null ? `Class ${st.class_number}` : '—'),
        st.section_name || '—',
        st.session_name || '—',
        String(st.missingCount),
        st.missingFields.map((f: any) => f.label).join('; '),
        st.parent_sms_number || '—',
        st.parent_whatsapp || '—',
        st.parent_email || '—',
        st.father_name || '—',
        st.father_phone || '—',
        st.father_occupation || '—',
        st.mother_name || '—',
        st.mother_phone || '—',
        st.mother_occupation || '—',
        st.guardian_name || '—'
      ];
      res.write(row.map(escapeCsvCell).join(',') + '\r\n');
    }

    if (result.students.length < batchSize || page >= result.pagination.totalPages) {
      break;
    }

    page++;
  }

  res.end();
}
