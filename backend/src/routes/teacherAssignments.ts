import { Router, Response } from 'express';
import { requireAuth, requireRoles, AuthRequest } from '../middleware/auth';
import { pool, isPostgresConfigured } from '../db';
import { verifyTeacherPublishingEligibility, getTeacherEligiblePublishingOptions } from '../services/mentorService';
import { isSameSchool } from '../utils/tenant';
import { downloadFromStorage, uploadToStorage, validateAttachment, StorageConfigurationError } from '../utils/supabaseStorage';

const router = Router();

export interface InMemoryAssignment {
  id: string;
  school_id: string;
  class_id: string;
  section_id: string | null;
  subject_id: string;
  teacher_id: string;
  title: string;
  description: string;
  due_date: string;
  max_marks: number;
  created_at: string;
  subject_name?: string;
  class_number?: number;
  section_name?: string;
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
 * 0. GET /api/teacher/assignments/eligible-options - Get mentor-authorized class-section-subject options for logged-in teacher
 */
router.get('/eligible-options', async (req: AuthRequest, res: Response) => {
  try {
    const list = await getTeacherEligiblePublishingOptions(req.user!.schoolId!, req.user!.id);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Unable to fetch eligible assignment publishing options' });
  }
});

/**
 * 1. POST /api/teacher/assignments - Create and publish assignment
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { class_id, classId, section_id, sectionId, subject_id, subjectId, title, description, due_date, dueDate, max_marks, maxMarks } = req.body || {};

    const cId = String(class_id || classId || '').trim();
    const sIdRaw = section_id !== undefined ? section_id : sectionId;
    const sId = sIdRaw ? String(sIdRaw).trim() : null;
    const subId = String(subject_id || subjectId || '').trim();
    const tTitle = String(title || '').trim();
    const tDesc = String(description || '').trim();
    const dDate = String(due_date || dueDate || '').trim();
    const marks = Number(max_marks ?? maxMarks ?? 100);

    if (!cId || !subId || !tTitle || !dDate) {
      return res.status(400).json({ message: 'class_id, subject_id, title, and due_date are required' });
    }

    // STRICT BACKEND VERIFICATION (Requirements #1 & #2)
    // Validate that requester is an authorized primary teacher for this class, section, and subject
    const sectionCheck = sId || 'sec-a'; // fallback section identifier for section validation if null
    const eligibility = await verifyTeacherPublishingEligibility(req.user!.schoolId!, req.user!.id, cId, sectionCheck, subId);
    if (!eligibility.eligible) {
      return res.status(403).json({
        message: eligibility.message || 'Unauthorized to publish assignment',
        code: eligibility.code || 'ASSIGNMENT_PUBLISH_UNAUTHORIZED'
      });
    }

    // Process optional documents/attachments uploaded by teacher
    const processedAttachments: any[] = [];
    let docName: string | null = null;
    let docSize: number | null = null;
    let docMime: string | null = null;
    let docData: string | null = null;
    let docStorageKey: string | null = null;
    let docUrl: string | null = req.body?.document_url || null;

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
      if (v.valid) {
        const fileId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const storageKey = `teacher-assignments/${req.user!.schoolId}/${cId}/${fileId}_${v.sanitizedName}`;
        let uploaded = false;
        try {
          await uploadToStorage(storageKey, v.buffer, v.mimeType);
          uploaded = true;
        } catch (_upErr) {
          // If storage is unconfigured/fails, we still preserve document_data inline safely
        }

        const formattedData = typeof item.fileData === 'string' && item.fileData.startsWith('data:')
          ? item.fileData
          : `data:${v.mimeType};base64,${typeof item.fileData === 'string' ? item.fileData.replace(/^data:[^;]+;base64,/, '') : ''}`;

        const fileEntry = {
          id: fileId,
          file_name: v.sanitizedName,
          file_size: v.buffer.length,
          mime_type: v.mimeType,
          storage_key: uploaded ? storageKey : null,
          file_data: formattedData
        };
        processedAttachments.push(fileEntry);

        if (!docName) {
          docName = fileEntry.file_name;
          docSize = fileEntry.file_size;
          docMime = fileEntry.mime_type;
          docStorageKey = fileEntry.storage_key;
          docData = fileEntry.file_data;
        }
      }
    }

    // Insert into PostgreSQL student_assignments table
    if (isPostgresConfigured) {
      const q = await pool.query(
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
          docUrl, docName, docSize, docMime, docData, docStorageKey, JSON.stringify(processedAttachments)
        ]
      );

      const rec = q.rows[0];
      // Keep in-memory store in sync
      inMemoryAssignments.push({
        id: rec.id,
        school_id: rec.school_id,
        class_id: rec.class_id,
        section_id: rec.section_id,
        subject_id: rec.subject_id,
        teacher_id: rec.teacher_id,
        title: rec.title,
        description: rec.description,
        due_date: rec.due_date,
        max_marks: Number(rec.max_marks),
        document_url: rec.document_url,
        document_name: rec.document_name,
        document_size: rec.document_size ? Number(rec.document_size) : null,
        document_mime: rec.document_mime,
        document_data: rec.document_data,
        storage_key: rec.storage_key,
        attachments: processedAttachments,
        created_at: rec.created_at
      });

      return res.status(201).json({ success: true, message: 'Assignment published successfully', data: rec });
    }

    // Fallback in-memory assignment for test environment
    const mockAssignment: InMemoryAssignment = {
      id: `asg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      school_id: req.user!.schoolId!,
      class_id: cId,
      section_id: sId,
      subject_id: subId,
      teacher_id: req.user!.id,
      title: tTitle,
      description: tDesc,
      due_date: dDate,
      max_marks: marks,
      document_url: docUrl,
      document_name: docName,
      document_size: docSize,
      document_mime: docMime,
      document_data: docData,
      storage_key: docStorageKey,
      attachments: processedAttachments,
      created_at: new Date().toISOString()
    };
    inMemoryAssignments.push(mockAssignment);

    res.status(201).json({ success: true, message: 'Assignment published successfully', data: mockAssignment });
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'Failed to publish assignment' });
  }
});

/**
 * 2. GET /api/teacher/assignments - List assignments created by teacher or for school
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const classId = String(req.query.class_id || req.query.classId || '').trim();
    const sectionId = String(req.query.section_id || req.query.sectionId || '').trim();

    if (isPostgresConfigured) {
      let query = `
        SELECT a.*, sub.name AS subject_name, c.class_number, sec.name AS section_name,
               (SELECT COUNT(*)::int FROM student_assignment_submissions s WHERE s.assignment_id = a.id) AS submission_count
        FROM student_assignments a
        LEFT JOIN subjects sub ON sub.id = a.subject_id
        LEFT JOIN classes c ON c.id = a.class_id
        LEFT JOIN sections sec ON sec.id = a.section_id
        WHERE a.school_id = $1 AND a.teacher_id = $2
      `;
      const params: any[] = [req.user!.schoolId!, req.user!.id];

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
      if (q.rowCount && q.rowCount > 0) return res.json(q.rows);
    }

    // In-memory fallback filtering
    const filtered = inMemoryAssignments.filter(a =>
      isSameSchool(a.school_id, req.user!.schoolId!) &&
      a.teacher_id === req.user!.id &&
      (!classId || a.class_id === classId) &&
      (!sectionId || a.section_id === null || a.section_id === sectionId)
    ).map(a => {
      const subs = inMemorySubmissions.filter(s => s.assignment_id === a.id);
      return { ...a, submission_count: subs.length };
    });

    res.json(filtered);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Unable to fetch assignments' });
  }
});

/**
 * 3. GET /api/teacher/assignments/:id/submissions - List student submissions for an assignment
 */
router.get('/:id/submissions', async (req: AuthRequest, res: Response) => {
  try {
    const assignmentId = String(req.params.id);

    if (isPostgresConfigured) {
      // 1. Fetch assignment and check ownership & scope
      const asgQ = await pool.query(
        `SELECT * FROM student_assignments WHERE id = $1 AND school_id = $2`,
        [assignmentId, req.user!.schoolId!]
      );

      if (asgQ.rowCount === 0) {
        return res.status(404).json({ message: 'Assignment not found or does not belong to your school' });
      }

      const asg = asgQ.rows[0];

      // Validate assignment ownership or eligibility
      if (req.user!.role !== 'SUPER_ADMIN' && asg.teacher_id !== req.user!.id) {
        const secCheck = asg.section_id || 'sec-a';
        const elig = await verifyTeacherPublishingEligibility(req.user!.schoolId!, req.user!.id, asg.class_id, secCheck, asg.subject_id);
        if (!elig.eligible) {
          return res.status(403).json({ message: 'Access denied: You are not authorized to view submissions for this assignment' });
        }
      }

      // 2. Query student submissions
      const q = await pool.query(
        `SELECT sub.*, st.name AS student_name, st.roll_number, st.admission_number
         FROM student_assignment_submissions sub
         JOIN students st ON st.id = sub.student_id
         WHERE sub.school_id = $1 AND sub.assignment_id = $2
         ORDER BY st.roll_number, st.name`,
        [req.user!.schoolId!, assignmentId]
      );

      // Query attachments for these submissions
      const attQ = await pool.query(
        `SELECT id, submission_id, file_name, file_size, mime_type, created_at
         FROM student_assignment_attachments
         WHERE school_id = $1 AND assignment_id = $2
         ORDER BY created_at ASC`,
        [req.user!.schoolId!, assignmentId]
      );
      const attMap = new Map<string, any[]>();
      attQ.rows.forEach(att => {
        const list = attMap.get(att.submission_id) || [];
        list.push(att);
        attMap.set(att.submission_id, list);
      });

      const subsWithAtts = q.rows.map(sub => ({
        ...sub,
        attachments: attMap.get(sub.id) || []
      }));

      return res.json(subsWithAtts);
    }

    // In-memory check
    const asg = inMemoryAssignments.find(a => a.id === assignmentId && isSameSchool(a.school_id, req.user!.schoolId!));
    if (!asg) {
      return res.status(404).json({ message: 'Assignment not found or does not belong to your school' });
    }

    if (req.user!.role !== 'SUPER_ADMIN' && asg.teacher_id !== req.user!.id) {
      return res.status(403).json({ message: 'Access denied: You are not authorized to view submissions for this assignment' });
    }

    const subs = inMemorySubmissions.filter(s => isSameSchool(s.school_id, req.user!.schoolId!) && s.assignment_id === assignmentId);
    res.json(subs);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Unable to fetch submissions' });
  }
});

/**
 * 3a. GET /api/teacher/assignments/:id/submissions/:submissionId/attachments/:attachmentId/preview - Preview student attachment
 */
router.get('/:id/submissions/:submissionId/attachments/:attachmentId/preview', async (req: AuthRequest, res: Response) => {
  try {
    const { id: assignmentId, submissionId, attachmentId } = req.params;

    // Verify assignment authorization
    const asgQ = await pool.query(
      `SELECT * FROM student_assignments WHERE id = $1 AND school_id = $2`,
      [assignmentId, req.user!.schoolId!]
    );
    if (asgQ.rowCount === 0) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    const asg = asgQ.rows[0];

    if (req.user!.role !== 'SUPER_ADMIN' && asg.teacher_id !== req.user!.id) {
      const secCheck = asg.section_id || 'sec-a';
      const elig = await verifyTeacherPublishingEligibility(req.user!.schoolId!, req.user!.id, asg.class_id, secCheck, asg.subject_id);
      if (!elig.eligible) {
        return res.status(403).json({ message: 'Access denied: You are not authorized to preview this attachment' });
      }
    }

    // Verify attachment exists for submission
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
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(att.file_name)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(buffer);
  } catch (err: any) {
    if (err instanceof StorageConfigurationError || err?.name === 'StorageConfigurationError' || err?.code === 'STORAGE_CONFIGURATION_MISSING') {
      return res.status(503).json({
        error: 'STORAGE_CONFIGURATION_MISSING',
        message: 'File attachment storage is currently unconfigured or unavailable.'
      });
    }
    res.status(500).json({ message: err.message || 'Failed to preview attachment' });
  }
});

/**
 * 3b. GET /api/teacher/assignments/:id/submissions/:submissionId/attachments/:attachmentId/download - Download student attachment
 */
router.get('/:id/submissions/:submissionId/attachments/:attachmentId/download', async (req: AuthRequest, res: Response) => {
  try {
    const { id: assignmentId, submissionId, attachmentId } = req.params;

    // Verify assignment authorization
    const asgQ = await pool.query(
      `SELECT * FROM student_assignments WHERE id = $1 AND school_id = $2`,
      [assignmentId, req.user!.schoolId!]
    );
    if (asgQ.rowCount === 0) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    const asg = asgQ.rows[0];

    if (req.user!.role !== 'SUPER_ADMIN' && asg.teacher_id !== req.user!.id) {
      const secCheck = asg.section_id || 'sec-a';
      const elig = await verifyTeacherPublishingEligibility(req.user!.schoolId!, req.user!.id, asg.class_id, secCheck, asg.subject_id);
      if (!elig.eligible) {
        return res.status(403).json({ message: 'Access denied: You are not authorized to download this attachment' });
      }
    }

    // Verify attachment exists for submission
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
    if (err instanceof StorageConfigurationError || err?.name === 'StorageConfigurationError' || err?.code === 'STORAGE_CONFIGURATION_MISSING') {
      return res.status(503).json({
        error: 'STORAGE_CONFIGURATION_MISSING',
        message: 'File attachment storage is currently unconfigured or unavailable.'
      });
    }
    res.status(500).json({ message: err.message || 'Failed to download attachment' });
  }
});

/**
 * 4. PUT /api/teacher/assignments/:id/submissions/:submissionId/grade - Grade a student submission
 */
router.put('/:id/submissions/:submissionId/grade', async (req: AuthRequest, res: Response) => {
  try {
    const assignmentId = String(req.params.id);
    const submissionId = String(req.params.submissionId);
    const { marks_obtained, marksObtained, feedback } = req.body || {};
    const marks = Number(marks_obtained ?? marksObtained ?? 0);
    const fbText = String(feedback || '').trim();

    if (isPostgresConfigured) {
      // 1. Fetch assignment and check ownership & scope
      const asgQ = await pool.query(
        `SELECT * FROM student_assignments WHERE id = $1 AND school_id = $2`,
        [assignmentId, req.user!.schoolId!]
      );

      if (asgQ.rowCount === 0) {
        return res.status(404).json({ message: 'Assignment not found or does not belong to your school' });
      }

      const asg = asgQ.rows[0];

      if (req.user!.role !== 'SUPER_ADMIN' && asg.teacher_id !== req.user!.id) {
        const secCheck = asg.section_id || 'sec-a';
        const elig = await verifyTeacherPublishingEligibility(req.user!.schoolId!, req.user!.id, asg.class_id, secCheck, asg.subject_id);
        if (!elig.eligible) {
          return res.status(403).json({ message: 'Access denied: You are not authorized to grade submissions for this assignment' });
        }
      }

      // 2. Update submission record with strict assignment_id AND submissionId check
      const q = await pool.query(
        `UPDATE student_assignment_submissions
         SET marks_obtained = $1, feedback = $2, status = 'GRADED', updated_at = NOW()
         WHERE school_id = $3 AND assignment_id = $4 AND id = $5
         RETURNING *`,
        [marks, fbText, req.user!.schoolId!, assignmentId, submissionId]
      );

      if (q.rowCount === 0) {
        return res.status(404).json({ message: 'Submission record not found for this assignment' });
      }

      return res.json({ success: true, message: 'Submission graded successfully', data: q.rows[0] });
    }

    // In-memory fallback
    const asg = inMemoryAssignments.find(a => a.id === assignmentId && isSameSchool(a.school_id, req.user!.schoolId!));
    if (!asg) {
      return res.status(404).json({ message: 'Assignment not found or does not belong to your school' });
    }

    if (req.user!.role !== 'SUPER_ADMIN' && asg.teacher_id !== req.user!.id) {
      return res.status(403).json({ message: 'Access denied: You are not authorized to grade submissions for this assignment' });
    }

    const sub = inMemorySubmissions.find(s => isSameSchool(s.school_id, req.user!.schoolId!) && s.assignment_id === assignmentId && s.id === submissionId);
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
 * 5a. GET /api/teacher/assignments/:id/document/preview - Preview teacher's uploaded assignment document
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
      asg = inMemoryAssignments.find(a => a.id === assignmentId && isSameSchool(a.school_id, req.user!.schoolId!));
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
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to preview document' });
  }
});

/**
 * 5b. GET /api/teacher/assignments/:id/document/download - Download teacher's uploaded assignment document
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
      asg = inMemoryAssignments.find(a => a.id === assignmentId && isSameSchool(a.school_id, req.user!.schoolId!));
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
