import { Response } from 'express';
import { pool } from '../db';
import { normalizeGender } from '../utils/gender';
import { AuthRequest } from '../middleware/auth';

export interface CompletenessFieldConfig {
  key: string;
  label: string;
  category: 'Personal' | 'Contact' | 'Professional' | 'Academic';
  required: boolean;
  formFieldId: string;
  sqlColumn: string;
  sqlMissingCondition: string;
}

export const TEACHER_COMPLETENESS_FIELDS: CompletenessFieldConfig[] = [
  // ── 1. Required Core Fields (Penalize Completeness Score) ──
  {
    key: 'first_name',
    label: 'First Name',
    category: 'Personal',
    required: true,
    formFieldId: 'teacher-form-first-name',
    sqlColumn: 'first_name',
    sqlMissingCondition: "((tp.first_name IS NULL OR TRIM(tp.first_name) = '') AND (u.first_name IS NULL OR TRIM(u.first_name) = '') AND (u.name IS NULL OR TRIM(u.name) = ''))"
  },
  {
    key: 'last_name',
    label: 'Last Name',
    category: 'Personal',
    required: true,
    formFieldId: 'teacher-form-last-name',
    sqlColumn: 'last_name',
    sqlMissingCondition: "((tp.last_name IS NULL OR TRIM(tp.last_name) = '') AND (u.last_name IS NULL OR TRIM(u.last_name) = '') AND (TRIM(COALESCE(u.name, '')) NOT LIKE '% %'))"
  },
  {
    key: 'employee_id',
    label: 'Employee / Savior ID',
    category: 'Professional',
    required: true,
    formFieldId: 'teacher-form-employee-id',
    sqlColumn: 'employee_id',
    sqlMissingCondition: "(tp.employee_id IS NULL OR TRIM(tp.employee_id) = '')"
  },
  {
    key: 'email',
    label: 'Email Address',
    category: 'Contact',
    required: true,
    formFieldId: 'teacher-form-email',
    sqlColumn: 'email',
    sqlMissingCondition: "(u.email IS NULL OR TRIM(u.email) = '' OR u.email NOT LIKE '%@%.%')"
  },
  {
    key: 'mobile',
    label: 'Mobile Number',
    category: 'Contact',
    required: true,
    formFieldId: 'teacher-form-mobile',
    sqlColumn: 'mobile',
    sqlMissingCondition: "(COALESCE(tp.mobile, tp.phone) IS NULL OR TRIM(COALESCE(tp.mobile, tp.phone)) = '' OR LENGTH(regexp_replace(COALESCE(tp.mobile, tp.phone), '[^0-9]', '', 'g')) < 10)"
  },
  {
    key: 'designation',
    label: 'Designation',
    category: 'Professional',
    required: true,
    formFieldId: 'teacher-form-designation',
    sqlColumn: 'designation',
    sqlMissingCondition: "(tp.designation IS NULL OR TRIM(tp.designation) = '')"
  },
  {
    key: 'joining_date',
    label: 'Joining Date',
    category: 'Professional',
    required: true,
    formFieldId: 'teacher-form-joining-date',
    sqlColumn: 'joining_date',
    sqlMissingCondition: "(tp.joining_date IS NULL)"
  },
  {
    key: 'gender',
    label: 'Gender',
    category: 'Personal',
    required: true,
    formFieldId: 'teacher-form-gender',
    sqlColumn: 'gender',
    sqlMissingCondition: "(tp.gender IS NULL OR TRIM(tp.gender) = '' OR LOWER(TRIM(tp.gender)) IN ('—', '-', 'null', 'not specified', 'undefined'))"
  },

  // ── 2. Optional Fields (Tracked & Visible, but do NOT penalize completeness) ──
  {
    key: 'date_of_birth',
    label: 'Date of Birth',
    category: 'Personal',
    required: false,
    formFieldId: 'teacher-form-dob',
    sqlColumn: 'date_of_birth',
    sqlMissingCondition: "(tp.date_of_birth IS NULL)"
  },
  {
    key: 'qualification',
    label: 'Qualification',
    category: 'Academic',
    required: false,
    formFieldId: 'teacher-form-qualification',
    sqlColumn: 'qualification',
    sqlMissingCondition: "(tp.qualification IS NULL OR TRIM(tp.qualification) = '')"
  },
  {
    key: 'address',
    label: 'Address',
    category: 'Personal',
    required: false,
    formFieldId: 'teacher-form-address',
    sqlColumn: 'address',
    sqlMissingCondition: "(tp.address IS NULL OR TRIM(tp.address) = '')"
  },
  {
    key: 'photo_url',
    label: 'Profile Photo',
    category: 'Personal',
    required: false,
    formFieldId: 'teacher-form-photo',
    sqlColumn: 'photo_url',
    sqlMissingCondition: "(tp.photo_url IS NULL OR TRIM(tp.photo_url) = '')"
  },
  {
    key: 'middle_name',
    label: 'Middle Name',
    category: 'Personal',
    required: false,
    formFieldId: 'teacher-form-middle-name',
    sqlColumn: 'middle_name',
    sqlMissingCondition: "((tp.middle_name IS NULL OR TRIM(tp.middle_name) = '') AND (u.middle_name IS NULL OR TRIM(u.middle_name) = ''))"
  },
  {
    key: 'assigned_class',
    label: 'Class Teacher Assignment',
    category: 'Academic',
    required: false,
    formFieldId: 'teacher-form-class',
    sqlColumn: 'class_name',
    sqlMissingCondition: "(cm_alloc.class_mentor_id IS NULL AND (tp.class_name IS NULL OR TRIM(tp.class_name) = ''))"
  }
];

export const REQUIRED_TEACHER_FIELDS = TEACHER_COMPLETENESS_FIELDS.filter(f => f.required);
export const OPTIONAL_TEACHER_FIELDS = TEACHER_COMPLETENESS_FIELDS.filter(f => !f.required);

export interface TeacherFilterOptions {
  search?: string;
  missingField?: string;
  gender?: string;
  designation?: string;
  includeOptional?: boolean;
  page?: number;
  limit?: number;
}

/**
 * Builds base SQL WHERE clauses for tenant isolation and optional filters.
 */
function buildTeacherScopeWhere(
  schoolId: string,
  options: TeacherFilterOptions,
  params: any[]
): string {
  params.push(schoolId);
  let where = `WHERE u.school_id = $${params.length} AND u.role = 'TEACHER' AND COALESCE(u.is_active, true) = true`;

  if (options.gender && options.gender.trim()) {
    const gNorm = normalizeGender(options.gender.trim()) || options.gender.trim();
    params.push(`${gNorm}%`);
    where += ` AND tp.gender ILIKE $${params.length}`;
  }

  if (options.designation && options.designation.trim() && options.designation.trim().toLowerCase() !== 'all') {
    params.push(options.designation.trim());
    where += ` AND LOWER(TRIM(tp.designation)) = LOWER(TRIM($${params.length}))`;
  }

  return where;
}

/**
 * Calculates dashboard completeness summary cards & breakdown from actual database records.
 */
export async function getTeacherCompletenessSummary(
  schoolId: string,
  options: TeacherFilterOptions = {}
) {
  const params: any[] = [];
  const baseWhere = buildTeacherScopeWhere(schoolId, options, params);

  // Condition for at least one required field missing
  const anyRequiredMissingSql = REQUIRED_TEACHER_FIELDS.map(f => f.sqlMissingCondition).join(' OR ');

  // Condition for all required fields present (complete profile)
  const allRequiredPresentSql = REQUIRED_TEACHER_FIELDS.map(f => `NOT (${f.sqlMissingCondition})`).join(' AND ');

  // Individual field missing aggregations
  const fieldSelects = TEACHER_COMPLETENESS_FIELDS.map(
    f => `COUNT(*) FILTER (WHERE ${f.sqlMissingCondition})::int AS "missing_${f.key}"`
  ).join(',\n    ');

  const query = `
    SELECT
      COUNT(*)::int AS total_teachers,
      COUNT(*) FILTER (WHERE ${allRequiredPresentSql})::int AS complete_profiles,
      COUNT(*) FILTER (WHERE ${anyRequiredMissingSql})::int AS incomplete_profiles,
      ${fieldSelects}
    FROM users u
    LEFT JOIN teacher_profiles tp ON tp.user_id = u.id
    LEFT JOIN LATERAL (
      SELECT cm.id AS class_mentor_id
      FROM class_mentors cm
      WHERE cm.teacher_id = u.id AND cm.school_id = u.school_id
      LIMIT 1
    ) cm_alloc ON true
    ${baseWhere}
  `;

  const { rows } = await pool.query(query, params);
  const raw = rows[0] || {};

  const totalTeachers = Number(raw.total_teachers || 0);
  const completeProfiles = Number(raw.complete_profiles || 0);
  const incompleteProfiles = Number(raw.incomplete_profiles || 0);

  let totalMissingFields = 0;
  const fieldBreakdown = TEACHER_COMPLETENESS_FIELDS.map(f => {
    const missingCount = Number(raw[`missing_${f.key}`] || 0);
    if (f.required) {
      totalMissingFields += missingCount;
    }
    const completedCount = Math.max(0, totalTeachers - missingCount);
    const completionPercentage = totalTeachers > 0
      ? Math.round((completedCount / totalTeachers) * 1000) / 10
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

  const completenessScore = totalTeachers > 0
    ? Math.round((completeProfiles / totalTeachers) * 1000) / 10
    : 100;

  return {
    summary: {
      totalTeachers,
      completeProfiles,
      incompleteProfiles,
      totalMissingFields,
      completenessScore
    },
    fieldBreakdown,
    requiredFields: REQUIRED_TEACHER_FIELDS.map(f => ({ key: f.key, label: f.label, category: f.category })),
    optionalFields: OPTIONAL_TEACHER_FIELDS.map(f => ({ key: f.key, label: f.label, category: f.category }))
  };
}

/**
 * Returns list of incomplete teachers with their specific missing information.
 */
export async function getIncompleteTeachers(
  schoolId: string,
  options: TeacherFilterOptions = {}
) {
  const params: any[] = [];
  let where = buildTeacherScopeWhere(schoolId, options, params);

  // Missing field filtering
  const targetFieldKey = options.missingField && options.missingField !== 'all'
    ? options.missingField.trim()
    : null;

  if (targetFieldKey) {
    const targetField = TEACHER_COMPLETENESS_FIELDS.find(f => f.key === targetFieldKey);
    if (targetField) {
      where += ` AND (${targetField.sqlMissingCondition})`;
    } else {
      // Default to any required field missing
      const anyReq = REQUIRED_TEACHER_FIELDS.map(f => f.sqlMissingCondition).join(' OR ');
      where += ` AND (${anyReq})`;
    }
  } else {
    // Show all teachers with at least 1 missing required field
    const anyReq = REQUIRED_TEACHER_FIELDS.map(f => f.sqlMissingCondition).join(' OR ');
    where += ` AND (${anyReq})`;
  }

  // Teacher search filter (name, employee_id, email, phone, designation)
  if (options.search && options.search.trim()) {
    params.push(`%${options.search.trim()}%`);
    const sIdx = params.length;
    where += ` AND (
      u.name ILIKE $${sIdx} OR
      COALESCE(tp.employee_id, '') ILIKE $${sIdx} OR
      u.email ILIKE $${sIdx} OR
      COALESCE(tp.mobile, tp.phone, '') ILIKE $${sIdx} OR
      COALESCE(tp.first_name, '') ILIKE $${sIdx} OR
      COALESCE(tp.last_name, '') ILIKE $${sIdx} OR
      COALESCE(tp.designation, '') ILIKE $${sIdx}
    )`;
  }

  // Count total matching incomplete teachers
  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM users u
    LEFT JOIN teacher_profiles tp ON tp.user_id = u.id
    LEFT JOIN LATERAL (
      SELECT cm.id AS class_mentor_id
      FROM class_mentors cm
      WHERE cm.teacher_id = u.id AND cm.school_id = u.school_id
      LIMIT 1
    ) cm_alloc ON true
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
      u.id,
      u.name,
      COALESCE(tp.first_name, u.first_name) AS first_name,
      COALESCE(tp.middle_name, u.middle_name) AS middle_name,
      COALESCE(tp.last_name, u.last_name) AS last_name,
      u.email,
      tp.id AS profile_id,
      tp.employee_id,
      COALESCE(tp.mobile, tp.phone) AS mobile,
      COALESCE(tp.phone, tp.mobile) AS phone,
      tp.gender,
      tp.designation,
      tp.qualification,
      tp.date_of_birth,
      tp.joining_date,
      tp.address,
      tp.photo_url,
      COALESCE(u.is_active, true) AS is_active,
      u.created_at,
      u.updated_at,
      cm_alloc.class_mentor_id,
      cm_alloc.class_id AS assigned_class_id,
      cm_alloc.class_number AS assigned_class_number,
      cm_alloc.section_id AS assigned_section_id,
      cm_alloc.section_name AS assigned_section_name,
      CASE
        WHEN cm_alloc.class_number = -1 THEN 'Class L-KG'
        WHEN cm_alloc.class_number = 0 THEN 'Class U-KG'
        WHEN cm_alloc.class_number IS NOT NULL THEN 'Class ' || cm_alloc.class_number
        ELSE tp.class_name
      END AS assigned_class_label
    FROM users u
    LEFT JOIN teacher_profiles tp ON tp.user_id = u.id
    LEFT JOIN LATERAL (
      SELECT
        cm.id AS class_mentor_id,
        cm.class_id,
        cm.section_id,
        c.class_number,
        sec.name AS section_name
      FROM class_mentors cm
      LEFT JOIN classes c ON c.id = cm.class_id
      LEFT JOIN sections sec ON sec.id = cm.section_id
      WHERE cm.teacher_id = u.id AND cm.school_id = u.school_id
      LIMIT 1
    ) cm_alloc ON true
    ${where}
    ORDER BY u.name ASC, tp.employee_id ASC NULLS LAST
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const { rows } = await pool.query(dataQuery, params);

  const teachers = rows.map((t: any) => {
    // Derive name parts if not explicitly stored
    let fName = t.first_name && String(t.first_name).trim();
    let lName = t.last_name && String(t.last_name).trim();
    if ((!fName || !lName) && t.name) {
      const parts = String(t.name).trim().split(/\s+/);
      if (parts.length === 1 && !fName) {
        fName = parts[0];
      } else if (parts.length >= 2) {
        if (!fName) fName = parts[0];
        if (!lName) lName = parts[parts.length - 1];
      }
    }

    const missingFields: { key: string; label: string; category: string; formFieldId: string; required: boolean }[] = [];

    for (const f of TEACHER_COMPLETENESS_FIELDS) {
      if (!f.required && !options.includeOptional) {
        continue;
      }
      let isMissing = false;

      if (f.key === 'first_name') {
        isMissing = !fName && !(t.name && String(t.name).trim());
      } else if (f.key === 'last_name') {
        isMissing = !lName;
      } else if (f.key === 'email') {
        const emailStr = t.email && String(t.email).trim().toLowerCase();
        isMissing = !emailStr || !emailStr.includes('@') || !emailStr.includes('.');
      } else if (f.key === 'mobile') {
        const rawMob = (t.mobile || t.phone) ? String(t.mobile || t.phone).replace(/\D/g, '') : '';
        isMissing = rawMob.length < 10;
      } else if (f.key === 'gender') {
        const norm = normalizeGender(t.gender);
        isMissing = !norm;
      } else if (f.key === 'joining_date' || f.key === 'date_of_birth') {
        isMissing = !t[f.sqlColumn];
      } else if (f.key === 'assigned_class') {
        isMissing = !t.class_mentor_id && !(t.assigned_class_label && String(t.assigned_class_label).trim());
      } else {
        const val = t[f.sqlColumn];
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

    const cleanDob = t.date_of_birth
      ? (t.date_of_birth instanceof Date ? t.date_of_birth.toISOString().slice(0, 10) : String(t.date_of_birth).slice(0, 10))
      : '';
    const cleanJoining = t.joining_date
      ? (t.joining_date instanceof Date ? t.joining_date.toISOString().slice(0, 10) : String(t.joining_date).slice(0, 10))
      : '';

    return {
      ...t,
      first_name: fName || '',
      last_name: lName || '',
      date_of_birth: cleanDob,
      dob: cleanDob,
      joining_date: cleanJoining,
      joiningDate: cleanJoining,
      gender: normalizeGender(t.gender) || '',
      missingFields,
      missingCount: missingFields.filter(mf => mf.required).length,
      isComplete: missingFields.filter(mf => mf.required).length === 0
    };
  });

  return {
    teachers,
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
 */
export function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Streams unpaginated incomplete teachers directly over HTTP response as CSV.
 * Batches from PostgreSQL without loading all records into memory.
 */
export async function streamIncompleteTeachersCsv(
  schoolId: string,
  options: TeacherFilterOptions,
  req: AuthRequest,
  res: Response
) {
  const filename = `Missing_Teacher_Information_${options.missingField || 'All'}_${new Date().toISOString().slice(0, 10)}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Transfer-Encoding', 'chunked');

  // UTF-8 BOM for Microsoft Excel compatibility
  res.write('\uFEFF');

  const headers = [
    'Teacher Name',
    'Employee / Savior ID',
    'Email Address',
    'Mobile Number',
    'Designation',
    'Joining Date',
    'Gender',
    'Missing Fields Count',
    'Missing Information',
    'Date of Birth',
    'Qualification',
    'Assigned Class & Section',
    'Address'
  ];

  res.write(headers.map(escapeCsvCell).join(',') + '\r\n');

  let clientDisconnected = false;
  req.on('close', () => {
    clientDisconnected = true;
  });

  const batchSize = 500;
  let page = 1;

  while (!clientDisconnected) {
    const result = await getIncompleteTeachers(schoolId, {
      ...options,
      page,
      limit: batchSize
    });

    if (!result.teachers || result.teachers.length === 0) {
      break;
    }

    for (const t of result.teachers) {
      if (clientDisconnected) break;
      const allocText = t.assigned_class_label
        ? `${t.assigned_class_label}${t.assigned_section_name ? ` - Sec ${t.assigned_section_name}` : ''}`
        : '—';

      const row = [
        t.name || `${t.first_name || ''} ${t.last_name || ''}`.trim(),
        t.employee_id || '—',
        t.email || '—',
        t.mobile || t.phone || '—',
        t.designation || 'Teacher',
        t.joining_date || '—',
        t.gender || '—',
        String(t.missingCount),
        t.missingFields.map((f: any) => f.label).join('; '),
        t.date_of_birth || '—',
        t.qualification || '—',
        allocText,
        t.address || '—'
      ];
      res.write(row.map(escapeCsvCell).join(',') + '\r\n');
    }

    if (result.teachers.length < batchSize || page >= result.pagination.totalPages) {
      break;
    }

    page++;
  }

  res.end();
}
