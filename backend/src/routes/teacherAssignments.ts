import { Router, Response } from 'express';
import { requireAuth, requireRoles, AuthRequest } from '../middleware/auth';
import { pool, isPostgresConfigured } from '../db';
import { isSameSchool } from '../utils/tenant';
import {
  downloadFromStorage,
  uploadToStorage,
  deleteFromStorage,
  validateAttachment,
  buildTeacherAssignmentStorageKey,
  isInlinePreviewMime,
  getStorageHealth,
  StorageConfigurationError
} from '../utils/firebaseStorage';
import { CLASS_GRADES } from '../routes/schoolData';

const router = Router();

let assignmentTablesChecked = false;
async function ensureAssignmentTables() {
  if (assignmentTablesChecked || !isPostgresConfigured) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS assignment_attachments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        assignment_id UUID NOT NULL REFERENCES student_assignments(id) ON DELETE CASCADE,
        school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
        file_name VARCHAR(255) NOT NULL,
        storage_key TEXT,
        file_url TEXT,
        mime_type VARCHAR(100) NOT NULL,
        file_size INTEGER NOT NULL DEFAULT 0,
        uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_assignment_attachments_assignment_id
        ON assignment_attachments (assignment_id);
    `);
    assignmentTablesChecked = true;
  } catch (err: any) {
    console.warn('[ensureAssignmentTables] warning:', err.message);
    assignmentTablesChecked = true;
  }
}

router.use(async (_req, _res, next) => {
  await ensureAssignmentTables();
  next();
});

export let hasAssignedDateCol: boolean | null = null;
export async function checkHasAssignedDate(): Promise<boolean> {
  if (hasAssignedDateCol !== null) return hasAssignedDateCol;
  if (!isPostgresConfigured) {
    hasAssignedDateCol = false;
    return false;
  }
  try {
    const res = await pool.query(
      "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'student_assignments' AND column_name = 'assigned_date'"
    );
    hasAssignedDateCol = (res.rowCount ?? 0) > 0;
  } catch (_e) {
    hasAssignedDateCol = false;
  }
  return hasAssignedDateCol;
}

export let hasUpdatedAtColSubmissions: boolean | null = null;
export async function checkHasUpdatedAtSubmissions(): Promise<boolean> {
  if (hasUpdatedAtColSubmissions !== null) return hasUpdatedAtColSubmissions;
  if (!isPostgresConfigured) {
    hasUpdatedAtColSubmissions = false;
    return false;
  }
  try {
    const res = await pool.query(
      "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'student_assignment_submissions' AND column_name = 'updated_at'"
    );
    hasUpdatedAtColSubmissions = (res.rowCount ?? 0) > 0;
  } catch (_e) {
    hasUpdatedAtColSubmissions = false;
  }
  return hasUpdatedAtColSubmissions;
}


export interface InMemoryAssignment {
  id: string;
  school_id: string;
  class_id: string;
  section_id: string | null;
  subject_id?: string | null;
  teacher_id: string;
  title: string;
  description: string;
  assigned_date: string;
  due_date: string;
  max_marks: number;
  created_at: string;
  updated_at?: string;
  subject_name?: string;
  class_number?: number;
  section_name?: string;
  teacher_name?: string;
  document_url?: string | null;
  document_name?: string | null;
  document_size?: number | null;
  document_mime?: string | null;
  document_data?: string | null;
  storage_key?: string | null;
  attachments?: any[];
}

export interface InMemorySubmission {
  id: string;
  school_id: string;
  assignment_id: string;
  student_id: string;
  student_name?: string;
  roll_number?: string;
  admission_number?: string;
  status: string;
  submitted_at: string;
  submission_text: string;
  marks_obtained?: number | null;
  feedback?: string | null;
  attachments?: any[];
}

export const inMemoryAssignments: InMemoryAssignment[] = [];
export const inMemorySubmissions: InMemorySubmission[] = [];

// Require authenticated user with active school
router.use(requireAuth, requireRoles('TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN'), (req: AuthRequest, res: Response, next) => {
  if (!req.user?.schoolId) {
    return res.status(403).json({ message: 'Institutional school context required' });
  }
  next();
});

/**
 * 0. GET /api/teacher/assignments/eligible-options
 * Returns all valid class and section options within the teacher's school.
 * Any teacher can publish assignments to ANY class and section in their school.
 */
router.get('/eligible-options', async (req: AuthRequest, res: Response) => {
  try {
    const sid = req.user!.schoolId!;
    if (isPostgresConfigured) {
      const q = await pool.query(
        `SELECT c.id AS class_id, c.class_number,
                COALESCE(c.label, CASE WHEN c.class_number = -1 THEN 'L-KG' WHEN c.class_number = 0 THEN 'U-KG' ELSE 'Class ' || c.class_number END) AS class_label,
                sec.id AS section_id, sec.name AS section_name,
                NULL::uuid AS subject_id, 'General' AS subject_name
         FROM classes c
         JOIN sections sec ON sec.class_id = c.id
         WHERE c.school_id = $1
         ORDER BY c.class_number ASC, sec.name ASC`,
        [sid]
      );
      if (q.rowCount && q.rowCount > 0) {
        return res.json(q.rows);
      }
    }

    // Fallback: build options from CLASS_GRADES
    const fallbackOptions: any[] = [];
    CLASS_GRADES.forEach((g) => {
      const classId = `${sid}-${g.id}`;
      fallbackOptions.push({
        class_id: classId,
        class_number: g.class_number,
        class_label: g.label,
        section_id: `${sid}-sec-${g.id}-a`,
        section_name: 'A',
        subject_id: null,
        subject_name: 'General'
      });
      fallbackOptions.push({
        class_id: classId,
        class_number: g.class_number,
        class_label: g.label,
        section_id: `${sid}-sec-${g.id}-b`,
        section_name: 'B',
        subject_id: null,
        subject_name: 'General'
      });
    });

    res.json(fallbackOptions);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Unable to fetch assignment options' });
  }
});

/**
 * Helper to validate class and section within the authenticated school
 */
async function validateClassAndSection(schoolId: string, classId: string, sectionId?: string | null) {
  if (isPostgresConfigured) {
    const classQ = await pool.query(
      `SELECT id, class_number FROM classes WHERE id = $1 AND school_id = $2`,
      [classId, schoolId]
    );
    if (classQ.rowCount === 0) {
      return { valid: false, error: 'Target class does not belong to your school' };
    }

    if (sectionId) {
      const secQ = await pool.query(
        `SELECT id, name FROM sections WHERE id = $1 AND class_id = $2 AND school_id = $3`,
        [sectionId, classId, schoolId]
      );
      if (secQ.rowCount === 0) {
        return { valid: false, error: 'Target section does not belong to the selected class in your school' };
      }
    }
  } else {
    // In-memory or fallback format check
    if (classId.startsWith('other-school') || (classId.includes('-') && !classId.startsWith(schoolId) && !classId.includes(schoolId.slice(0, 8)))) {
      return { valid: false, error: 'Target class does not belong to your school' };
    }
  }

  return { valid: true };
}

/**
 * 0b. GET /api/teacher/assignments/storage/status - Preflight storage availability check
 */
router.get(['/storage/status', '/storage-status'], async (_req: AuthRequest, res: Response) => {
  try {
    const health = await getStorageHealth();
    if (health.status === 'MISSING_CONFIGURATION') {
      return res.status(503).json(health);
    }
    if (health.status === 'ERROR') {
      return res.status(502).json(health);
    }
    return res.json(health);
  } catch (err: any) {
    return res.status(500).json({
      configured: false,
      status: 'ERROR',
      message: err.message || 'Failed to inspect storage health'
    });
  }
});

/**
 * 1. POST /api/teacher/assignments - Create and publish assignment
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const {
      class_id, classId,
      section_id, sectionId,
      subject_id, subjectId,
      title,
      description,
      assigned_date, assignedDate,
      due_date, dueDate,
      max_marks, maxMarks
    } = req.body || {};

    const cId = String(class_id || classId || '').trim();
    const sIdRaw = section_id !== undefined ? section_id : sectionId;
    const sId = sIdRaw ? String(sIdRaw).trim() : null;
    const subIdRaw = subject_id !== undefined ? subject_id : subjectId;
    const subId = subIdRaw ? String(subIdRaw).trim() : null;
    const tTitle = String(title || '').trim();
    const tDesc = String(description || '').trim();
    const todayStr = new Date().toISOString().slice(0, 10);
    const aDate = String(assigned_date || assignedDate || todayStr).trim();
    const dDate = String(due_date || dueDate || '').trim();
    const marks = Number(max_marks ?? maxMarks ?? 100);

    if (!cId || !tTitle || !dDate) {
      return res.status(400).json({ message: 'Target class, title, and due date are required' });
    }

    // STRICT MULTI-TENANT VERIFICATION
    const classVal = await validateClassAndSection(req.user!.schoolId!, cId, sId);
    if (!classVal.valid) {
      return res.status(400).json({ message: classVal.error });
    }

    // Process attachments
    const processedAttachments: any[] = [];
    const rawAttachments = Array.isArray(req.body?.attachments)
      ? req.body.attachments
      : (req.body?.document_data || req.body?.fileData)
      ? [{
          fileName: req.body.document_name || req.body.fileName || 'assignment-document.pdf',
          fileData: req.body.document_data || req.body.fileData,
          size: req.body.document_size || req.body.fileSize,
          mimeType: req.body.document_mime || req.body.mimeType
        }]
      : [];

    for (const item of rawAttachments) {
      if (!item || !item.fileData) continue;
      const v = validateAttachment(item.fileName || 'document.pdf', item.fileData);
      if (!v.valid) {
        return res.status(400).json({ message: v.error || 'Invalid attachment file' });
      }

      const fileId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const storageKey = buildTeacherAssignmentStorageKey(req.user!.schoolId!, cId, fileId, v.sanitizedName);

      try {
        await uploadToStorage(storageKey, v.buffer, v.mimeType);
      } catch (upErr: any) {
        if (upErr instanceof StorageConfigurationError || upErr?.code === 'STORAGE_CONFIGURATION_MISSING') {
          return res.status(503).json({
            error: 'STORAGE_CONFIGURATION_MISSING',
            message: 'File attachment storage is currently unconfigured or unavailable.'
          });
        }
        return res.status(500).json({
          message: `Failed to upload attachment ${item.fileName}: ${upErr.message || 'Storage error'}`
        });
      }

      const formattedData = typeof item.fileData === 'string' && item.fileData.startsWith('data:')
        ? item.fileData
        : `data:${v.mimeType};base64,${typeof item.fileData === 'string' ? item.fileData.replace(/^data:[^;]+;base64,/, '') : ''}`;

      processedAttachments.push({
        id: fileId,
        file_name: v.sanitizedName,
        file_size: v.buffer.length,
        mime_type: v.mimeType,
        storage_key: storageKey,
        file_data: formattedData,
        uploaded_at: new Date().toISOString()
      });
    }

    const firstDoc = processedAttachments[0] || null;

    const hasAssigned = await checkHasAssignedDate();
    if (isPostgresConfigured) {
      let q;
      if (hasAssigned) {
        q = await pool.query(
          `INSERT INTO student_assignments (
             school_id, class_id, section_id, subject_id, teacher_id,
             title, description, assigned_date, due_date, max_marks,
             document_url, document_name, document_size, document_mime, document_data, storage_key, attachments,
             created_at, updated_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())
           RETURNING *`,
          [
            req.user!.schoolId!, cId, sId, subId, req.user!.id,
            tTitle, tDesc, aDate, dDate, marks,
            firstDoc ? null : (req.body?.document_url || null),
            firstDoc ? firstDoc.file_name : null,
            firstDoc ? firstDoc.file_size : null,
            firstDoc ? firstDoc.mime_type : null,
            firstDoc ? firstDoc.file_data : null,
            firstDoc ? firstDoc.storage_key : null,
            JSON.stringify(processedAttachments)
          ]
        );
      } else {
        q = await pool.query(
          `INSERT INTO student_assignments (
             school_id, class_id, section_id, subject_id, teacher_id,
             title, description, due_date, max_marks,
             document_url, document_name, document_size, document_mime, document_data, storage_key, attachments,
             created_at, updated_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
           RETURNING *`,
          [
            req.user!.schoolId!, cId, sId, subId, req.user!.id,
            tTitle, tDesc, dDate, marks,
            firstDoc ? null : (req.body?.document_url || null),
            firstDoc ? firstDoc.file_name : null,
            firstDoc ? firstDoc.file_size : null,
            firstDoc ? firstDoc.mime_type : null,
            firstDoc ? firstDoc.file_data : null,
            firstDoc ? firstDoc.storage_key : null,
            JSON.stringify(processedAttachments)
          ]
        );
      }

      const rec = q.rows[0];

      // Insert attachment rows into assignment_attachments table
      for (const att of processedAttachments) {
        try {
          await pool.query(
            `INSERT INTO assignment_attachments (id, assignment_id, school_id, file_name, storage_key, mime_type, file_size, uploaded_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
             ON CONFLICT (id) DO NOTHING`,
            [att.id, rec.id, req.user!.schoolId!, att.file_name, att.storage_key, att.mime_type, att.file_size]
          );
        } catch (_attErr) {}
      }

      const responsePayload = {
        ...rec,
        attachments: processedAttachments,
        attachment_count: processedAttachments.length
      };

      inMemoryAssignments.push({
        id: rec.id,
        school_id: rec.school_id,
        class_id: rec.class_id,
        section_id: rec.section_id,
        subject_id: rec.subject_id,
        teacher_id: rec.teacher_id,
        title: rec.title,
        description: rec.description,
        assigned_date: rec.assigned_date,
        due_date: rec.due_date,
        max_marks: Number(rec.max_marks),
        document_url: rec.document_url,
        document_name: rec.document_name,
        document_size: rec.document_size ? Number(rec.document_size) : null,
        document_mime: rec.document_mime,
        document_data: rec.document_data,
        storage_key: rec.storage_key,
        attachments: processedAttachments,
        created_at: rec.created_at,
        updated_at: rec.updated_at
      });

      return res.status(201).json({ success: true, message: 'Assignment published successfully', data: responsePayload });
    }

    // In-memory fallback
    const mockAssignment: InMemoryAssignment = {
      id: `asg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      school_id: req.user!.schoolId!,
      class_id: cId,
      section_id: sId,
      subject_id: subId,
      teacher_id: req.user!.id,
      title: tTitle,
      description: tDesc,
      assigned_date: aDate,
      due_date: dDate,
      max_marks: marks,
      document_url: firstDoc ? null : (req.body?.document_url || null),
      document_name: firstDoc?.file_name || null,
      document_size: firstDoc?.file_size || null,
      document_mime: firstDoc?.mime_type || null,
      document_data: firstDoc?.file_data || null,
      storage_key: firstDoc?.storage_key || null,
      attachments: processedAttachments,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    inMemoryAssignments.push(mockAssignment);

    res.status(201).json({
      success: true,
      message: 'Assignment published successfully',
      data: { ...mockAssignment, attachment_count: processedAttachments.length }
    });
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'Failed to publish assignment' });
  }
});

/**
 * 2. GET /api/teacher/assignments - List published assignments
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const classId = String(req.query.class_id || req.query.classId || '').trim();
    const sectionId = String(req.query.section_id || req.query.sectionId || '').trim();
    const scope = String(req.query.scope || '').trim();

    if (isPostgresConfigured) {
      let query = `
        SELECT a.id, a.school_id, a.class_id, a.section_id, a.subject_id, a.teacher_id,
               a.title, a.description,
               a.created_at::date AS assigned_date,
               a.due_date, a.max_marks,
               a.document_url, a.document_name, a.document_size, a.document_mime, a.document_data,
               a.storage_key,
               COALESCE(a.attachments, '[]'::jsonb) AS attachments,
               a.created_at, a.updated_at,
               c.class_number, sec.name AS section_name, sub.name AS subject_name, u.name AS teacher_name,
               (SELECT COUNT(*)::int FROM student_assignment_submissions s WHERE s.assignment_id = a.id) AS submission_count,
               (
                 SELECT COUNT(*)::int FROM assignment_attachments aa WHERE aa.assignment_id = a.id
               ) AS attachment_table_count
        FROM student_assignments a
        LEFT JOIN subjects sub ON sub.id = a.subject_id
        LEFT JOIN classes c ON c.id = a.class_id
        LEFT JOIN sections sec ON sec.id = a.section_id
        LEFT JOIN users u ON u.id = a.teacher_id
        WHERE a.school_id = $1
      `;
      const params: any[] = [req.user!.schoolId!];

      // By default, filter to current teacher unless scope=all or user is admin
      if (scope !== 'all' && req.user!.role === 'TEACHER') {
        params.push(req.user!.id);
        query += ` AND a.teacher_id = $${params.length}`;
      }

      if (classId) {
        params.push(classId);
        query += ` AND a.class_id = $${params.length}`;
      }
      if (sectionId) {
        params.push(sectionId);
        query += ` AND (a.section_id IS NULL OR a.section_id = $${params.length})`;
      }

      query += ` ORDER BY a.created_at DESC`;

      const q = await pool.query(query, params);
      const rows = (q.rows || []).map((row: any) => {
        let attCount = Number(row.attachment_table_count || 0);
        if (attCount === 0 && Array.isArray(row.attachments)) {
          attCount = row.attachments.length;
        } else if (attCount === 0 && (row.document_name || row.storage_key)) {
          attCount = 1;
        }
        return {
          ...row,
          attachment_count: attCount
        };
      });

      return res.json(rows);
    }

    // In-memory fallback
    const filtered = inMemoryAssignments
      .filter((a) => {
        if (!isSameSchool(a.school_id, req.user!.schoolId!)) return false;
        if (scope !== 'all' && req.user!.role === 'TEACHER' && a.teacher_id !== req.user!.id) return false;
        if (classId && a.class_id !== classId) return false;
        if (sectionId && a.section_id !== null && a.section_id !== sectionId) return false;
        return true;
      })
      .map((a) => {
        const subs = inMemorySubmissions.filter((s) => s.assignment_id === a.id);
        const attCount = Array.isArray(a.attachments) ? a.attachments.length : (a.document_name ? 1 : 0);
        return {
          ...a,
          submission_count: subs.length,
          attachment_count: attCount
        };
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    res.json(filtered);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Unable to fetch assignments' });
  }
});

/**
 * 3. GET /api/teacher/assignments/:id - View single assignment details & attachments
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const assignmentId = String(req.params.id);

    if (isPostgresConfigured) {
      const q = await pool.query(
        `SELECT a.id, a.school_id, a.class_id, a.section_id, a.subject_id, a.teacher_id,
                a.title, a.description,
                a.created_at::date AS assigned_date,
                a.due_date, a.max_marks,
                a.document_url, a.document_name, a.document_size, a.document_mime, a.document_data,
                a.storage_key,
                COALESCE(a.attachments, '[]'::jsonb) AS attachments,
                a.created_at, a.updated_at,
                c.class_number, sec.name AS section_name, sub.name AS subject_name, u.name AS teacher_name,
                (SELECT COUNT(*)::int FROM student_assignment_submissions s WHERE s.assignment_id = a.id) AS submission_count
         FROM student_assignments a
         LEFT JOIN subjects sub ON sub.id = a.subject_id
         LEFT JOIN classes c ON c.id = a.class_id
         LEFT JOIN sections sec ON sec.id = a.section_id
         LEFT JOIN users u ON u.id = a.teacher_id
         WHERE a.id = $1 AND a.school_id = $2`,
        [assignmentId, req.user!.schoolId!]
      );

      if (q.rowCount === 0) {
        return res.status(404).json({ message: 'Assignment not found or does not belong to your school' });
      }

      const asg = q.rows[0];

      // Query attachment table for attachments
      let atts = Array.isArray(asg.attachments) ? asg.attachments : [];
      try {
        const attQ = await pool.query(
          `SELECT id, file_name, file_size, mime_type, storage_key, file_url, uploaded_at
           FROM assignment_attachments
           WHERE assignment_id = $1
           ORDER BY uploaded_at ASC`,
          [assignmentId]
        );
        if (attQ.rowCount && attQ.rowCount > 0) {
          atts = attQ.rows;
        }
      } catch (_attErr) {}

      return res.json({
        ...asg,
        attachments: atts,
        attachment_count: atts.length
      });
    }

    // In-memory fallback
    const asg = inMemoryAssignments.find(
      (a) => a.id === assignmentId && isSameSchool(a.school_id, req.user!.schoolId!)
    );

    if (!asg) {
      return res.status(404).json({ message: 'Assignment not found or does not belong to your school' });
    }

    const atts = Array.isArray(asg.attachments) ? asg.attachments : [];
    res.json({
      ...asg,
      attachments: atts,
      attachment_count: atts.length
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to fetch assignment details' });
  }
});

/**
 * 4. PUT /api/teacher/assignments/:id - Edit existing published assignment
 */
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const assignmentId = String(req.params.id);
    const {
      title,
      description,
      class_id, classId,
      section_id, sectionId,
      assigned_date, assignedDate,
      due_date, dueDate,
      newAttachments,
      removedAttachmentIds
    } = req.body || {};

    let existingAsg: any = null;

    if (isPostgresConfigured) {
      const checkQ = await pool.query(
        `SELECT * FROM student_assignments WHERE id = $1 AND school_id = $2`,
        [assignmentId, req.user!.schoolId!]
      );
      if (checkQ.rowCount === 0) {
        return res.status(404).json({ message: 'Assignment not found or does not belong to your school' });
      }
      existingAsg = checkQ.rows[0];
    } else {
      existingAsg = inMemoryAssignments.find(
        (a) => a.id === assignmentId && isSameSchool(a.school_id, req.user!.schoolId!)
      );
      if (!existingAsg) {
        return res.status(404).json({ message: 'Assignment not found or does not belong to your school' });
      }
    }

    // Validate target class and section if being updated
    const targetClassId = String(class_id || classId || existingAsg.class_id).trim();
    const rawSec = section_id !== undefined ? section_id : (sectionId !== undefined ? sectionId : existingAsg.section_id);
    const targetSectionId = rawSec ? String(rawSec).trim() : null;

    if (targetClassId) {
      const classVal = await validateClassAndSection(req.user!.schoolId!, targetClassId, targetSectionId);
      if (!classVal.valid) {
        return res.status(400).json({ message: classVal.error });
      }
    }

    // Handle existing attachments list
    let currentAttachments: any[] = Array.isArray(existingAsg.attachments) ? [...existingAsg.attachments] : [];

    // Remove deleted attachments
    if (Array.isArray(removedAttachmentIds) && removedAttachmentIds.length > 0) {
      const toRemove = currentAttachments.filter((att) => removedAttachmentIds.includes(att.id));
      for (const att of toRemove) {
        if (att.storage_key) {
          try {
            await deleteFromStorage(att.storage_key);
          } catch (_e) {}
        }
      }

      currentAttachments = currentAttachments.filter((att) => !removedAttachmentIds.includes(att.id));

      if (isPostgresConfigured) {
        try {
          await pool.query(
            `DELETE FROM assignment_attachments WHERE assignment_id = $1 AND id = ANY($2::text[])`,
            [assignmentId, removedAttachmentIds]
          );
        } catch (_e) {}
      }
    }

    // Add new attachments
    if (Array.isArray(newAttachments) && newAttachments.length > 0) {
      for (const item of newAttachments) {
        if (!item || !item.fileData) continue;
        const v = validateAttachment(item.fileName || 'document.pdf', item.fileData);
        if (!v.valid) {
          return res.status(400).json({ message: v.error || 'Invalid attachment file' });
        }

        const fileId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const storageKey = buildTeacherAssignmentStorageKey(req.user!.schoolId!, targetClassId, fileId, v.sanitizedName);

        try {
          await uploadToStorage(storageKey, v.buffer, v.mimeType);
        } catch (upErr: any) {
          if (upErr instanceof StorageConfigurationError || upErr?.code === 'STORAGE_CONFIGURATION_MISSING') {
            return res.status(503).json({
              error: 'STORAGE_CONFIGURATION_MISSING',
              message: 'File attachment storage is currently unconfigured or unavailable.'
            });
          }
          return res.status(500).json({
            message: `Failed to upload attachment ${item.fileName}: ${upErr.message || 'Storage error'}`
          });
        }

        const formattedData = typeof item.fileData === 'string' && item.fileData.startsWith('data:')
          ? item.fileData
          : `data:${v.mimeType};base64,${typeof item.fileData === 'string' ? item.fileData.replace(/^data:[^;]+;base64,/, '') : ''}`;

        const newEntry = {
          id: fileId,
          file_name: v.sanitizedName,
          file_size: v.buffer.length,
          mime_type: v.mimeType,
          storage_key: storageKey,
          file_data: formattedData,
          uploaded_at: new Date().toISOString()
        };

        currentAttachments.push(newEntry);

        if (isPostgresConfigured) {
          try {
            await pool.query(
              `INSERT INTO assignment_attachments (id, assignment_id, school_id, file_name, storage_key, mime_type, file_size, uploaded_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
               ON CONFLICT (id) DO NOTHING`,
              [newEntry.id, assignmentId, req.user!.schoolId!, newEntry.file_name, newEntry.storage_key, newEntry.mime_type, newEntry.file_size]
            );
          } catch (_e) {}
        }
      }
    }

    const updatedTitle = title !== undefined ? String(title).trim() : existingAsg.title;
    const updatedDesc = description !== undefined ? String(description).trim() : existingAsg.description;
    const updatedADate = assigned_date || assignedDate || existingAsg.assigned_date;
    const updatedDDate = due_date || dueDate || existingAsg.due_date;
    const firstDoc = currentAttachments[0] || null;

    if (isPostgresConfigured) {
      const hasAssigned = await checkHasAssignedDate();
      let updQ;
      if (hasAssigned) {
        updQ = await pool.query(
          `UPDATE student_assignments
           SET title = $1,
               description = $2,
               class_id = $3,
               section_id = $4,
               assigned_date = $5,
               due_date = $6,
               attachments = $7,
               document_name = $8,
               document_size = $9,
               document_mime = $10,
               document_data = $11,
               storage_key = $12,
               updated_at = NOW()
           WHERE id = $13 AND school_id = $14
           RETURNING *`,
          [
            updatedTitle, updatedDesc, targetClassId, targetSectionId,
            updatedADate, updatedDDate, JSON.stringify(currentAttachments),
            firstDoc ? firstDoc.file_name : null, firstDoc ? firstDoc.file_size : null,
            firstDoc ? firstDoc.mime_type : null, firstDoc ? firstDoc.file_data : null,
            firstDoc ? firstDoc.storage_key : null, assignmentId, req.user!.schoolId!
          ]
        );
      } else {
        updQ = await pool.query(
          `UPDATE student_assignments
           SET title = $1,
               description = $2,
               class_id = $3,
               section_id = $4,
               due_date = $5,
               attachments = $6,
               document_name = $7,
               document_size = $8,
               document_mime = $9,
               document_data = $10,
               storage_key = $11,
               updated_at = NOW()
           WHERE id = $12 AND school_id = $13
           RETURNING *`,
          [
            updatedTitle, updatedDesc, targetClassId, targetSectionId,
            updatedDDate, JSON.stringify(currentAttachments),
            firstDoc ? firstDoc.file_name : null, firstDoc ? firstDoc.file_size : null,
            firstDoc ? firstDoc.mime_type : null, firstDoc ? firstDoc.file_data : null,
            firstDoc ? firstDoc.storage_key : null, assignmentId, req.user!.schoolId!
          ]
        );
      }

      const updatedRow = updQ.rows[0];

      // Update in-memory fallback too
      const memIdx = inMemoryAssignments.findIndex((a) => a.id === assignmentId);
      if (memIdx !== -1) {
        inMemoryAssignments[memIdx] = {
          ...inMemoryAssignments[memIdx],
          ...updatedRow,
          attachments: currentAttachments
        };
      }

      return res.json({
        success: true,
        message: 'Assignment updated successfully',
        data: {
          ...updatedRow,
          attachments: currentAttachments,
          attachment_count: currentAttachments.length
        }
      });
    }

    // In-memory update
    const memIdx = inMemoryAssignments.findIndex((a) => a.id === assignmentId);
    if (memIdx !== -1) {
      inMemoryAssignments[memIdx] = {
        ...inMemoryAssignments[memIdx],
        title: updatedTitle,
        description: updatedDesc,
        class_id: targetClassId,
        section_id: targetSectionId,
        assigned_date: updatedADate,
        due_date: updatedDDate,
        attachments: currentAttachments,
        document_name: firstDoc?.file_name || null,
        document_size: firstDoc?.file_size || null,
        document_mime: firstDoc?.mime_type || null,
        document_data: firstDoc?.file_data || null,
        storage_key: firstDoc?.storage_key || null,
        updated_at: new Date().toISOString()
      };
    }

    res.json({
      success: true,
      message: 'Assignment updated successfully',
      data: inMemoryAssignments[memIdx]
    });
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'Failed to update assignment' });
  }
});

/**
 * 5. DELETE /api/teacher/assignments/:id - Delete assignment with safe file cleanup
 */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const assignmentId = String(req.params.id);

    let storageKeysToDelete: string[] = [];
    const failedPurges: string[] = [];

    if (isPostgresConfigured) {
      const asgQ = await pool.query(
        `SELECT * FROM student_assignments WHERE id = $1 AND school_id = $2`,
        [assignmentId, req.user!.schoolId!]
      );

      if (asgQ.rowCount === 0) {
        return res.status(404).json({ message: 'Assignment not found or does not belong to your school' });
      }

      const asg = asgQ.rows[0];

      // Collect storage keys from JSON attachments
      if (Array.isArray(asg.attachments)) {
        for (const att of asg.attachments) {
          if (att?.storage_key) storageKeysToDelete.push(att.storage_key);
        }
      }
      if (asg.storage_key) storageKeysToDelete.push(asg.storage_key);

      // Collect storage keys from assignment_attachments table
      try {
        const attQ = await pool.query(
          `SELECT storage_key FROM assignment_attachments WHERE assignment_id = $1`,
          [assignmentId]
        );
        for (const row of attQ.rows) {
          if (row.storage_key) storageKeysToDelete.push(row.storage_key);
        }
      } catch (_e) {}

      // Collect student submission attachment keys
      try {
        const subAttQ = await pool.query(
          `SELECT storage_key FROM student_assignment_attachments WHERE assignment_id = $1`,
          [assignmentId]
        );
        for (const row of subAttQ.rows) {
          if (row.storage_key) storageKeysToDelete.push(row.storage_key);
        }
      } catch (_e) {}

      // Safe storage cleanup
      for (const key of Array.from(new Set(storageKeysToDelete))) {
        try {
          await deleteFromStorage(key);
        } catch (_delErr) {
          failedPurges.push(key);
        }
      }

      // Delete database records (cascades submissions and attachments)
      try {
        await pool.query(`DELETE FROM assignment_attachments WHERE assignment_id = $1`, [assignmentId]);
      } catch (_e) {}
      try {
        await pool.query(`DELETE FROM student_assignment_attachments WHERE assignment_id = $1`, [assignmentId]);
      } catch (_e) {}
      try {
        await pool.query(`DELETE FROM student_assignment_submissions WHERE assignment_id = $1`, [assignmentId]);
      } catch (_e) {}

      await pool.query(`DELETE FROM student_assignments WHERE id = $1 AND school_id = $2`, [assignmentId, req.user!.schoolId!]);
    } else {
      const idx = inMemoryAssignments.findIndex(
        (a) => a.id === assignmentId && isSameSchool(a.school_id, req.user!.schoolId!)
      );
      if (idx === -1) {
        return res.status(404).json({ message: 'Assignment not found or does not belong to your school' });
      }

      const asg = inMemoryAssignments[idx];
      if (Array.isArray(asg.attachments)) {
        for (const att of asg.attachments) {
          if (att?.storage_key) await deleteFromStorage(att.storage_key).catch(() => {});
        }
      }
      inMemoryAssignments.splice(idx, 1);
    }

    // Clean up from memory store in case of hybrid runs
    const memIdx = inMemoryAssignments.findIndex((a) => a.id === assignmentId);
    if (memIdx !== -1) {
      inMemoryAssignments.splice(memIdx, 1);
    }

    if (failedPurges.length > 0) {
      return res.json({
        success: true,
        message: 'Assignment deleted from database, but some storage files could not be purged.',
        unpurgedFilesCount: failedPurges.length
      });
    }

    res.json({ success: true, message: 'Assignment and associated attachments deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to delete assignment' });
  }
});

/**
 * 6. POST /api/teacher/assignments/:id/attachments - Add individual attachment after publishing
 */
router.post('/:id/attachments', async (req: AuthRequest, res: Response) => {
  try {
    const assignmentId = String(req.params.id);
    const { fileName, fileData } = req.body || {};

    if (!fileData) {
      return res.status(400).json({ message: 'fileData is required' });
    }

    const v = validateAttachment(fileName || 'document.pdf', fileData);
    if (!v.valid) {
      return res.status(400).json({ message: v.error || 'Invalid attachment' });
    }

    let asg: any = null;
    if (isPostgresConfigured) {
      const q = await pool.query(
        `SELECT * FROM student_assignments WHERE id = $1 AND school_id = $2`,
        [assignmentId, req.user!.schoolId!]
      );
      if (q.rowCount === 0) return res.status(404).json({ message: 'Assignment not found' });
      asg = q.rows[0];
    } else {
      asg = inMemoryAssignments.find((a) => a.id === assignmentId && isSameSchool(a.school_id, req.user!.schoolId!));
      if (!asg) return res.status(404).json({ message: 'Assignment not found' });
    }

    const fileId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const storageKey = buildTeacherAssignmentStorageKey(req.user!.schoolId!, asg.class_id, fileId, v.sanitizedName);

    await uploadToStorage(storageKey, v.buffer, v.mimeType);

    const formattedData = typeof fileData === 'string' && fileData.startsWith('data:')
      ? fileData
      : `data:${v.mimeType};base64,${typeof fileData === 'string' ? fileData.replace(/^data:[^;]+;base64,/, '') : ''}`;

    const newAttachment = {
      id: fileId,
      file_name: v.sanitizedName,
      file_size: v.buffer.length,
      mime_type: v.mimeType,
      storage_key: storageKey,
      file_data: formattedData,
      uploaded_at: new Date().toISOString()
    };

    const currentAttachments = Array.isArray(asg.attachments) ? [...asg.attachments, newAttachment] : [newAttachment];

    if (isPostgresConfigured) {
      await pool.query(
        `UPDATE student_assignments SET attachments = $1, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(currentAttachments), assignmentId]
      );
      try {
        await pool.query(
          `INSERT INTO assignment_attachments (id, assignment_id, school_id, file_name, storage_key, mime_type, file_size, uploaded_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
          [newAttachment.id, assignmentId, req.user!.schoolId!, newAttachment.file_name, storageKey, newAttachment.mime_type, newAttachment.file_size]
        );
      } catch (_e) {}
    } else {
      asg.attachments = currentAttachments;
    }

    res.status(201).json({ success: true, message: 'Attachment added successfully', data: newAttachment });
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'Failed to add attachment' });
  }
});

/**
 * 7. DELETE /api/teacher/assignments/:id/attachments/:attachmentId - Remove individual attachment
 */
router.delete('/:id/attachments/:attachmentId', async (req: AuthRequest, res: Response) => {
  try {
    const { id: assignmentId, attachmentId } = req.params;

    let asg: any = null;
    if (isPostgresConfigured) {
      const q = await pool.query(
        `SELECT * FROM student_assignments WHERE id = $1 AND school_id = $2`,
        [assignmentId, req.user!.schoolId!]
      );
      if (q.rowCount === 0) return res.status(404).json({ message: 'Assignment not found' });
      asg = q.rows[0];
    } else {
      asg = inMemoryAssignments.find((a) => a.id === assignmentId && isSameSchool(a.school_id, req.user!.schoolId!));
      if (!asg) return res.status(404).json({ message: 'Assignment not found' });
    }

    const currentAttachments: any[] = Array.isArray(asg.attachments) ? asg.attachments : [];
    const targetAtt = currentAttachments.find((a) => a.id === attachmentId);

    if (targetAtt?.storage_key) {
      try {
        await deleteFromStorage(targetAtt.storage_key);
      } catch (delErr: any) {
        return res.status(502).json({
          message: `Failed to remove attachment from storage: ${delErr.message || 'Storage error'}. Database record preserved.`
        });
      }
    }

    const updatedAttachments = currentAttachments.filter((a) => a.id !== attachmentId);

    if (isPostgresConfigured) {
      await pool.query(
        `UPDATE student_assignments SET attachments = $1, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(updatedAttachments), assignmentId]
      );
      try {
        await pool.query(
          `DELETE FROM assignment_attachments WHERE assignment_id = $1 AND id = $2`,
          [assignmentId, attachmentId]
        );
      } catch (_e) {}
    } else {
      asg.attachments = updatedAttachments;
    }

    res.json({ success: true, message: 'Attachment removed successfully' });
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'Failed to remove attachment' });
  }
});

/**
 * 8. GET /api/teacher/assignments/:id/submissions - List student submissions
 */
router.get('/:id/submissions', async (req: AuthRequest, res: Response) => {
  try {
    const assignmentId = String(req.params.id);

    if (isPostgresConfigured) {
      const asgQ = await pool.query(
        `SELECT * FROM student_assignments WHERE id = $1 AND school_id = $2`,
        [assignmentId, req.user!.schoolId!]
      );

      if (asgQ.rowCount === 0) {
        return res.status(404).json({ message: 'Assignment not found or does not belong to your school' });
      }

      const q = await pool.query(
        `SELECT sub.*, st.name AS student_name, st.roll_number, st.admission_number
         FROM student_assignment_submissions sub
         JOIN students st ON st.id = sub.student_id
         WHERE sub.school_id = $1 AND sub.assignment_id = $2
         ORDER BY st.roll_number, st.name`,
        [req.user!.schoolId!, assignmentId]
      );

      const attQ = await pool.query(
        `SELECT id, submission_id, file_name, file_size, mime_type, created_at
         FROM student_assignment_attachments
         WHERE school_id = $1 AND assignment_id = $2
         ORDER BY created_at ASC`,
        [req.user!.schoolId!, assignmentId]
      );
      const attMap = new Map<string, any[]>();
      attQ.rows.forEach((att) => {
        const list = attMap.get(att.submission_id) || [];
        list.push(att);
        attMap.set(att.submission_id, list);
      });

      const subsWithAtts = q.rows.map((sub) => ({
        ...sub,
        attachments: attMap.get(sub.id) || []
      }));

      return res.json(subsWithAtts);
    }

    const asg = inMemoryAssignments.find(
      (a) => a.id === assignmentId && isSameSchool(a.school_id, req.user!.schoolId!)
    );
    if (!asg) {
      return res.status(404).json({ message: 'Assignment not found or does not belong to your school' });
    }

    const subs = inMemorySubmissions.filter(
      (s) => isSameSchool(s.school_id, req.user!.schoolId!) && s.assignment_id === assignmentId
    );
    res.json(subs);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Unable to fetch submissions' });
  }
});

/**
 * 8a. GET /api/teacher/assignments/:id/submissions/:submissionId/attachments/:attachmentId/preview
 */
router.get('/:id/submissions/:submissionId/attachments/:attachmentId/preview', async (req: AuthRequest, res: Response) => {
  try {
    const { id: assignmentId, submissionId, attachmentId } = req.params;

    const asgQ = await pool.query(
      `SELECT * FROM student_assignments WHERE id = $1 AND school_id = $2`,
      [assignmentId, req.user!.schoolId!]
    );
    if (asgQ.rowCount === 0) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const attQ = await pool.query(
      `SELECT * FROM student_assignment_attachments
       WHERE id = $1 AND assignment_id = $2 AND submission_id = $3 AND school_id = $4`,
      [attachmentId, assignmentId, submissionId, req.user!.schoolId!]
    );
    if (attQ.rowCount === 0) {
      return res.status(404).json({ message: 'Attachment not found' });
    }

    const att = attQ.rows[0];
    const { buffer, mimeType } = await downloadFromStorage(att.storage_key);

    const effectiveMime = att.mime_type || mimeType || 'application/octet-stream';
    const isInline = isInlinePreviewMime(effectiveMime);
    res.setHeader('Content-Type', effectiveMime);
    res.setHeader('Content-Disposition', `${isInline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(att.file_name)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(buffer);
  } catch (err: any) {
    if (err instanceof StorageConfigurationError || err?.code === 'STORAGE_CONFIGURATION_MISSING') {
      return res.status(503).json({
        error: 'STORAGE_CONFIGURATION_MISSING',
        message: 'File attachment storage is currently unconfigured or unavailable.'
      });
    }
    res.status(500).json({ message: err.message || 'Failed to preview attachment' });
  }
});

/**
 * 8b. GET /api/teacher/assignments/:id/submissions/:submissionId/attachments/:attachmentId/download
 */
router.get('/:id/submissions/:submissionId/attachments/:attachmentId/download', async (req: AuthRequest, res: Response) => {
  try {
    const { id: assignmentId, submissionId, attachmentId } = req.params;

    const asgQ = await pool.query(
      `SELECT * FROM student_assignments WHERE id = $1 AND school_id = $2`,
      [assignmentId, req.user!.schoolId!]
    );
    if (asgQ.rowCount === 0) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const attQ = await pool.query(
      `SELECT * FROM student_assignment_attachments
       WHERE id = $1 AND assignment_id = $2 AND submission_id = $3 AND school_id = $4`,
      [attachmentId, assignmentId, submissionId, req.user!.schoolId!]
    );
    if (attQ.rowCount === 0) {
      return res.status(404).json({ message: 'Attachment not found' });
    }

    const att = attQ.rows[0];
    const { buffer, mimeType } = await downloadFromStorage(att.storage_key);

    res.setHeader('Content-Type', att.mime_type || mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(att.file_name)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(buffer);
  } catch (err: any) {
    if (err instanceof StorageConfigurationError || err?.code === 'STORAGE_CONFIGURATION_MISSING') {
      return res.status(503).json({
        error: 'STORAGE_CONFIGURATION_MISSING',
        message: 'File attachment storage is currently unconfigured or unavailable.'
      });
    }
    res.status(500).json({ message: err.message || 'Failed to download attachment' });
  }
});

/**
 * 9. PUT /api/teacher/assignments/:id/submissions/:submissionId/grade - Grade a student submission
 */
router.put('/:id/submissions/:submissionId/grade', async (req: AuthRequest, res: Response) => {
  try {
    const assignmentId = String(req.params.id);
    const submissionId = String(req.params.submissionId);
    const { marks_obtained, marksObtained, feedback } = req.body || {};
    const marks = Number(marks_obtained ?? marksObtained ?? 0);
    const fbText = String(feedback || '').trim();

    if (isPostgresConfigured) {
      const asgQ = await pool.query(
        `SELECT * FROM student_assignments WHERE id = $1 AND school_id = $2`,
        [assignmentId, req.user!.schoolId!]
      );

      if (asgQ.rowCount === 0) {
        return res.status(404).json({ message: 'Assignment not found or does not belong to your school' });
      }

      const hasUpd = await checkHasUpdatedAtSubmissions();
      const gradeQuery = hasUpd
        ? `UPDATE student_assignment_submissions
           SET marks_obtained = $1, feedback = $2, status = 'GRADED', updated_at = NOW()
           WHERE school_id = $3 AND assignment_id = $4 AND id = $5
           RETURNING *`
        : `UPDATE student_assignment_submissions
           SET marks_obtained = $1, feedback = $2, status = 'GRADED'
           WHERE school_id = $3 AND assignment_id = $4 AND id = $5
           RETURNING *`;
      const q = await pool.query(gradeQuery, [marks, fbText, req.user!.schoolId!, assignmentId, submissionId]);

      if (q.rowCount === 0) {
        return res.status(404).json({ message: 'Submission record not found for this assignment' });
      }

      return res.json({ success: true, message: 'Submission graded successfully', data: q.rows[0] });
    }

    const asg = inMemoryAssignments.find((a) => a.id === assignmentId && isSameSchool(a.school_id, req.user!.schoolId!));
    if (!asg) {
      return res.status(404).json({ message: 'Assignment not found or does not belong to your school' });
    }

    const sub = inMemorySubmissions.find(
      (s) => isSameSchool(s.school_id, req.user!.schoolId!) && s.assignment_id === assignmentId && s.id === submissionId
    );
    if (!sub) {
      return res.status(404).json({ message: 'Submission record not found for this assignment' });
    }

    sub.marks_obtained = marks;
    sub.feedback = fbText;
    sub.status = 'GRADED';

    res.json({
      success: true,
      message: 'Submission graded successfully',
      data: sub
    });
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'Failed to grade submission' });
  }
});

/**
 * 10. GET /api/teacher/assignments/:id/document/preview - Preview teacher's uploaded assignment document
 */
router.get('/:id/document/preview', async (req: AuthRequest, res: Response) => {
  try {
    const { id: assignmentId } = req.params;
    let asg: any = null;

    if (isPostgresConfigured) {
      const q = await pool.query(
        `SELECT * FROM student_assignments WHERE id = $1 AND school_id = $2`,
        [assignmentId, req.user!.schoolId!]
      );
      if (q.rowCount && q.rowCount > 0) asg = q.rows[0];
    } else {
      asg = inMemoryAssignments.find((a) => a.id === assignmentId && isSameSchool(a.school_id, req.user!.schoolId!));
    }

    if (!asg) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const attId = req.query.attachmentId ? String(req.query.attachmentId) : null;
    let targetDoc: any = null;
    if (attId && Array.isArray(asg.attachments)) {
      targetDoc = asg.attachments.find((a: any) => a.id === attId);
    }
    if (!targetDoc) {
      targetDoc = {
        file_name: asg.document_name,
        mime_type: asg.document_mime,
        storage_key: asg.storage_key,
        file_data: asg.document_data
      };
    }

    if (!targetDoc.file_name && !targetDoc.file_data && !targetDoc.storage_key) {
      return res.status(404).json({ message: 'No document attached to this assignment' });
    }

    let buffer: Buffer | null = null;
    let mimeType = targetDoc.mime_type || 'application/octet-stream';
    const fileName = targetDoc.file_name || 'assignment-document.pdf';

    if (targetDoc.storage_key) {
      try {
        const dl = await downloadFromStorage(targetDoc.storage_key);
        buffer = dl.buffer;
        mimeType = dl.mimeType || mimeType;
      } catch (_e) {}
    }

    if (!buffer && targetDoc.file_data) {
      const cleanBase64 = String(targetDoc.file_data).replace(/^data:[^;]+;base64,/, '');
      buffer = Buffer.from(cleanBase64, 'base64');
    }

    if (!buffer) {
      return res.status(404).json({ message: 'Document content is unavailable' });
    }

    const isInline = isInlinePreviewMime(mimeType);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `${isInline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to preview document' });
  }
});

/**
 * 11. GET /api/teacher/assignments/:id/document/download - Download teacher's uploaded assignment document
 */
router.get('/:id/document/download', async (req: AuthRequest, res: Response) => {
  try {
    const { id: assignmentId } = req.params;
    let asg: any = null;

    if (isPostgresConfigured) {
      const q = await pool.query(
        `SELECT * FROM student_assignments WHERE id = $1 AND school_id = $2`,
        [assignmentId, req.user!.schoolId!]
      );
      if (q.rowCount && q.rowCount > 0) asg = q.rows[0];
    } else {
      asg = inMemoryAssignments.find((a) => a.id === assignmentId && isSameSchool(a.school_id, req.user!.schoolId!));
    }

    if (!asg) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const attId = req.query.attachmentId ? String(req.query.attachmentId) : null;
    let targetDoc: any = null;
    if (attId && Array.isArray(asg.attachments)) {
      targetDoc = asg.attachments.find((a: any) => a.id === attId);
    }
    if (!targetDoc) {
      targetDoc = {
        file_name: asg.document_name,
        mime_type: asg.document_mime,
        storage_key: asg.storage_key,
        file_data: asg.document_data
      };
    }

    if (!targetDoc.file_name && !targetDoc.file_data && !targetDoc.storage_key) {
      return res.status(404).json({ message: 'No document attached to this assignment' });
    }

    let buffer: Buffer | null = null;
    let mimeType = targetDoc.mime_type || 'application/octet-stream';
    const fileName = targetDoc.file_name || 'assignment-document.pdf';

    if (targetDoc.storage_key) {
      try {
        const dl = await downloadFromStorage(targetDoc.storage_key);
        buffer = dl.buffer;
        mimeType = dl.mimeType || mimeType;
      } catch (_e) {}
    }

    if (!buffer && targetDoc.file_data) {
      const cleanBase64 = String(targetDoc.file_data).replace(/^data:[^;]+;base64,/, '');
      buffer = Buffer.from(cleanBase64, 'base64');
    }

    if (!buffer) {
      return res.status(404).json({ message: 'Document content is unavailable' });
    }

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to download document' });
  }
});

export default router;
