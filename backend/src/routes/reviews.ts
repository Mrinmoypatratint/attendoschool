import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { pool, isPostgresConfigured } from '../db';
import { collections, isFirebaseConfigured } from '../firebase';
import { sendPhotoReviewEmail } from '../services/emailService';
import { clearStudentDashboardCache } from '../services/studentService';

const router = Router();

// Ensure review tables exist in PostgreSQL
let tablesInitialized = false;
async function ensureReviewTables() {
  if (tablesInitialized || !isPostgresConfigured) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS photo_approval_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID NOT NULL,
        applicant_type VARCHAR(20) NOT NULL DEFAULT 'STUDENT',
        applicant_id UUID NOT NULL,
        applicant_name VARCHAR(255) NOT NULL,
        identifier VARCHAR(100),
        detail VARCHAR(255),
        current_photo_url TEXT,
        photo_url TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        rejection_reason TEXT,
        reviewed_by UUID,
        reviewed_by_name VARCHAR(255),
        reviewed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS teacher_leave_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID NOT NULL,
        teacher_id UUID NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        reason TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        reviewed_by UUID,
        review_notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS student_leave_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID NOT NULL,
        student_id UUID NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        reason TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        reviewed_by UUID,
        review_notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      ALTER TABLE teacher_leave_requests ADD COLUMN IF NOT EXISTS leave_type VARCHAR(50) DEFAULT 'CASUAL';
      ALTER TABLE teacher_leave_requests ADD COLUMN IF NOT EXISTS teacher_name VARCHAR(255);
      ALTER TABLE teacher_leave_requests ADD COLUMN IF NOT EXISTS teacher_email VARCHAR(255);
      ALTER TABLE teacher_leave_requests ADD COLUMN IF NOT EXISTS reviewer_name VARCHAR(255);
      ALTER TABLE teacher_leave_requests ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;

      ALTER TABLE student_leave_requests DROP CONSTRAINT IF EXISTS student_leave_requests_status_check;
      ALTER TABLE student_leave_requests ADD CONSTRAINT student_leave_requests_status_check CHECK (status IN ('PENDING', 'SEEN', 'APPROVED', 'REJECTED', 'CANCELLED'));
    `);
    tablesInitialized = true;
  } catch (err) {
    console.error('Failed to ensure review tables:', err);
    tablesInitialized = true;
  }
}

import { inMemoryLeaves, inMemoryTeacherLeaves } from '../store/leavesStore';
import { isTintSchool, isTestSchool, isSameSchool } from '../utils/tenant';

function resolvePostgresSchoolId(sid: string | null | undefined): string | null {
  if (!sid) return null;
  if (isTintSchool(sid)) return '00000000-0000-0000-0000-000000000002';
  if (isTestSchool(sid)) return '00000000-0000-0000-0000-000000000001';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sid)) return sid;
  return null;
}

// In-memory fallback if Postgres is not configured
const inMemoryPhotos: any[] = [];

/* =========================================================================
   PHOTO APPROVAL ENDPOINTS
   ========================================================================= */

// GET /api/reviews/photos
router.get('/photos', async (req: AuthRequest, res: Response) => {
  try {
    await ensureReviewTables();
    const schoolId = req.user?.schoolId;
    if (!schoolId) {
      return res.status(400).json({ success: false, message: 'School ID required' });
    }

    const { status, search, role } = req.query;

    if (isPostgresConfigured) {
      let query = `
        SELECT p.*
        FROM photo_approval_requests p
        WHERE p.school_id = $1
      `;
      const params: any[] = [schoolId];
      let paramIdx = 2;

      if (status && status !== 'ALL') {
        query += ` AND p.status = $${paramIdx++}`;
        params.push(status);
      }

      if (role && role !== 'ALL') {
        query += ` AND p.applicant_type = $${paramIdx++}`;
        params.push(role);
      }

      if (search && typeof search === 'string' && search.trim()) {
        query += ` AND (p.applicant_name ILIKE $${paramIdx} OR p.identifier ILIKE $${paramIdx})`;
        params.push(`%${search.trim()}%`);
        paramIdx++;
      }

      query += ` ORDER BY CASE WHEN p.status = 'PENDING' THEN 1 WHEN p.status = 'APPROVED' THEN 2 ELSE 3 END, p.created_at DESC`;

      const result = await pool.query(query, params);

      // Fetch accurate counts for badges
      const countRes = await pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'PENDING') as pending,
          COUNT(*) FILTER (WHERE status = 'APPROVED') as approved,
          COUNT(*) FILTER (WHERE status = 'REJECTED') as rejected
        FROM photo_approval_requests
        WHERE school_id = $1
      `, [schoolId]);

      const counts = {
        all: parseInt(countRes.rows[0]?.total || '0', 10),
        pending: parseInt(countRes.rows[0]?.pending || '0', 10),
        approved: parseInt(countRes.rows[0]?.approved || '0', 10),
        rejected: parseInt(countRes.rows[0]?.rejected || '0', 10),
      };

      return res.json({
        success: true,
        data: result.rows,
        counts
      });
    }

    // In-memory fallback
    const filtered = inMemoryPhotos.filter(p => p.school_id === schoolId);
    const counts = {
      all: filtered.length,
      pending: filtered.filter(p => p.status === 'PENDING').length,
      approved: filtered.filter(p => p.status === 'APPROVED').length,
      rejected: filtered.filter(p => p.status === 'REJECTED').length,
    };
    return res.json({ success: true, data: filtered, counts });
  } catch (error: any) {
    console.error('Error fetching photo approval requests:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch photos' });
  }
});

// PUT /api/reviews/photos/:id/approve
router.put('/photos/:id/approve', async (req: AuthRequest, res: Response) => {
  try {
    await ensureReviewTables();
    const { id } = req.params;
    const schoolId = req.user?.schoolId;
    const reviewerId = req.user?.id;
    const reviewerName = req.user?.name || 'School Admin';

    if (isPostgresConfigured) {
      const existing = await pool.query(
        'SELECT * FROM photo_approval_requests WHERE id = $1 AND school_id = $2',
        [id, schoolId]
      );
      if (existing.rowCount === 0) {
        return res.status(404).json({ success: false, message: 'Photo request not found' });
      }

      const reqRow = existing.rows[0];

      // Update approval record
      const updateRes = await pool.query(`
        UPDATE photo_approval_requests
        SET status = 'APPROVED',
            rejection_reason = NULL,
            reviewed_by = $1,
            reviewed_by_name = $2,
            reviewed_at = NOW(),
            updated_at = NOW()
        WHERE id = $3 AND school_id = $4
        RETURNING *
      `, [reviewerId, reviewerName, id, schoolId]);

      // Apply the photo to the student or teacher profile
      if (reqRow.applicant_type === 'STUDENT') {
        await pool.query(
          'UPDATE students SET photo_url = $1, updated_at = NOW() WHERE id = $2 AND school_id = $3',
          [reqRow.photo_url, reqRow.applicant_id, schoolId]
        );

        if (isFirebaseConfigured()) {
          try {
            await collections.students().doc(reqRow.applicant_id).set({
              photo_url: reqRow.photo_url,
              photoUrl: reqRow.photo_url
            }, { merge: true });
          } catch (fsErr: any) {
            console.warn('[Reviews] Error updating student photo in Firestore:', fsErr.message);
          }
        }

        // Fetch student user_id and email to clear cache and send approval email
        try {
          const stRes = await pool.query(`
            SELECT s.id, s.name, s.user_id, s.admission_number, s.email as student_email, s.parent_email,
                   u.email as user_email, sch.name as school_name
            FROM students s
            LEFT JOIN users u ON u.id = s.user_id
            LEFT JOIN schools sch ON sch.id = s.school_id
            WHERE s.id = $1
          `, [reqRow.applicant_id]);

          if (stRes.rows.length > 0) {
            const st = stRes.rows[0];
            if (st.user_id) clearStudentDashboardCache(st.user_id);
            const toEmail = st.student_email || st.user_email || st.parent_email;
            if (toEmail) {
              sendPhotoReviewEmail({
                to: toEmail,
                studentName: reqRow.applicant_name || st.name,
                status: 'APPROVED',
                schoolName: st.school_name,
                schoolId,
                photoUrl: reqRow.photo_url,
                admissionNumber: st.admission_number || undefined
              }).catch(emErr => console.warn('[Reviews] Failed to send approval email:', emErr.message));
            }
          }
        } catch (stErr: any) {
          console.warn('[Reviews] Student lookup error on approval:', stErr.message);
        }
      } else if (reqRow.applicant_type === 'TEACHER') {
        await pool.query(
          'UPDATE teacher_profiles SET photo_url = $1 WHERE user_id = $2',
          [reqRow.photo_url, reqRow.applicant_id]
        );
      }

      return res.json({
        success: true,
        message: 'Photo approved successfully and updated in profile',
        data: updateRes.rows[0]
      });
    }

    return res.json({ success: true, message: 'Photo approved' });
  } catch (error: any) {
    console.error('Error approving photo:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to approve photo' });
  }
});

// PUT /api/reviews/photos/:id/reject
router.put('/photos/:id/reject', async (req: AuthRequest, res: Response) => {
  try {
    await ensureReviewTables();
    const { id } = req.params;
    const { reason } = req.body;
    const schoolId = req.user?.schoolId;
    const reviewerId = req.user?.id;
    const reviewerName = req.user?.name || 'School Admin';

    if (isPostgresConfigured) {
      const existing = await pool.query(
        'SELECT * FROM photo_approval_requests WHERE id = $1 AND school_id = $2',
        [id, schoolId]
      );
      if (existing.rowCount === 0) {
        return res.status(404).json({ success: false, message: 'Photo request not found' });
      }

      const reqRow = existing.rows[0];
      const rejectionReason = reason || 'Photo does not meet administrative standards';

      const updateRes = await pool.query(`
        UPDATE photo_approval_requests
        SET status = 'REJECTED',
            rejection_reason = $1,
            reviewed_by = $2,
            reviewed_by_name = $3,
            reviewed_at = NOW(),
            updated_at = NOW()
        WHERE id = $4 AND school_id = $5
        RETURNING *
      `, [rejectionReason, reviewerId, reviewerName, id, schoolId]);

      // If student, dispatch rejection email
      if (reqRow.applicant_type === 'STUDENT') {
        try {
          const stRes = await pool.query(`
            SELECT s.id, s.name, s.admission_number, s.email as student_email, s.parent_email,
                   u.email as user_email, sch.name as school_name
            FROM students s
            LEFT JOIN users u ON u.id = s.user_id
            LEFT JOIN schools sch ON sch.id = s.school_id
            WHERE s.id = $1
          `, [reqRow.applicant_id]);

          if (stRes.rows.length > 0) {
            const st = stRes.rows[0];
            const toEmail = st.student_email || st.user_email || st.parent_email;
            if (toEmail) {
              sendPhotoReviewEmail({
                to: toEmail,
                studentName: reqRow.applicant_name || st.name,
                status: 'REJECTED',
                reason: rejectionReason,
                schoolName: st.school_name,
                schoolId,
                photoUrl: reqRow.photo_url,
                admissionNumber: st.admission_number || undefined
              }).catch(emErr => console.warn('[Reviews] Failed to send rejection email:', emErr.message));
            }
          }
        } catch (stErr: any) {
          console.warn('[Reviews] Student lookup error on rejection:', stErr.message);
        }
      }

      return res.json({
        success: true,
        message: 'Photo rejected and student notified via email',
        data: updateRes.rows[0]
      });
    }

    return res.json({ success: true, message: 'Photo rejected' });
  } catch (error: any) {
    console.error('Error rejecting photo:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to reject photo' });
  }
});

// POST /api/reviews/photos - Submit photo for review
router.post('/photos', async (req: AuthRequest, res: Response) => {
  try {
    await ensureReviewTables();
    const schoolId = req.user?.schoolId;
    const { applicantType, applicantId, applicantName, identifier, detail, currentPhotoUrl, photoUrl } = req.body;

    if (!photoUrl || !applicantName) {
      return res.status(400).json({ success: false, message: 'Photo URL and applicant name are required' });
    }

    if (isPostgresConfigured) {
      const ins = await pool.query(`
        INSERT INTO photo_approval_requests (
          school_id, applicant_type, applicant_id, applicant_name, identifier, detail, current_photo_url, photo_url, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING')
        RETURNING *
      `, [
        schoolId,
        applicantType || 'STUDENT',
        applicantId || req.user?.id,
        applicantName,
        identifier || '',
        detail || '',
        currentPhotoUrl || null,
        photoUrl
      ]);

      return res.status(201).json({
        success: true,
        message: 'Photo submitted for review',
        data: ins.rows[0]
      });
    }

    return res.status(201).json({ success: true, message: 'Photo submitted' });
  } catch (error: any) {
    console.error('Error submitting photo for review:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to submit photo' });
  }
});

/* =========================================================================
   LEAVE APPROVAL ENDPOINTS
   ========================================================================= */

// GET /api/reviews/leaves
router.get('/leaves', async (req: AuthRequest, res: Response) => {
  try {
    await ensureReviewTables();
    const schoolId = req.user?.schoolId;
    if (!schoolId) {
      return res.status(400).json({ success: false, message: 'School ID required' });
    }

    const { status, search, role } = req.query;

    if (isPostgresConfigured) {
      // Query student leaves
      let studentLeaveQuery = `
        SELECT 
          l.id,
          l.school_id,
          'STUDENT' as applicant_type,
          l.student_id as applicant_id,
          s.name as applicant_name,
          s.admission_number as identifier,
          CONCAT('Class ', c.class_number, CASE WHEN sec.name IS NOT NULL THEN CONCAT(' - ', sec.name) ELSE '' END) as detail,
          s.photo_url,
          l.start_date,
          l.end_date,
          l.reason,
          l.status,
          l.reviewed_by,
          u.name as reviewer_name,
          l.review_notes,
          l.created_at,
          l.updated_at
        FROM student_leave_requests l
        LEFT JOIN students s ON s.id = l.student_id
        LEFT JOIN classes c ON c.id = s.class_id
        LEFT JOIN sections sec ON sec.id = s.section_id
        LEFT JOIN users u ON u.id = l.reviewed_by
        WHERE l.school_id = $1
      `;
      const params: any[] = [schoolId];
      let paramIdx = 2;

      if (status && status !== 'ALL') {
        studentLeaveQuery += ` AND l.status = $${paramIdx++}`;
        params.push(status);
      }

      if (search && typeof search === 'string' && search.trim()) {
        studentLeaveQuery += ` AND (s.name ILIKE $${paramIdx} OR s.admission_number ILIKE $${paramIdx} OR l.reason ILIKE $${paramIdx})`;
        params.push(`%${search.trim()}%`);
        paramIdx++;
      }

      studentLeaveQuery += ` ORDER BY CASE WHEN l.status = 'PENDING' THEN 1 WHEN l.status = 'SEEN' THEN 2 WHEN l.status = 'APPROVED' THEN 3 ELSE 4 END, l.created_at DESC`;

      const result = await pool.query(studentLeaveQuery, params);

      // Fetch accurate counts
      const countRes = await pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'PENDING') as pending,
          COUNT(*) FILTER (WHERE status = 'SEEN') as seen,
          COUNT(*) FILTER (WHERE status = 'APPROVED') as approved,
          COUNT(*) FILTER (WHERE status = 'REJECTED') as rejected
        FROM student_leave_requests
        WHERE school_id = $1
      `, [schoolId]);

      const memLeaves = inMemoryLeaves.filter(l => l.school_id === schoolId || !l.school_id);
      let combinedRows = [...result.rows];
      for (const m of memLeaves) {
        if (!combinedRows.some(r => r.id === m.id)) {
          if (!status || status === 'ALL' || m.status === status) {
            combinedRows.push(m);
          }
        }
      }

      const counts = {
        all: parseInt(countRes.rows[0]?.total || '0', 10) + memLeaves.length,
        pending: parseInt(countRes.rows[0]?.pending || '0', 10) + memLeaves.filter(l => l.status === 'PENDING').length,
        seen: parseInt(countRes.rows[0]?.seen || '0', 10) + memLeaves.filter(l => l.status === 'SEEN').length,
        approved: parseInt(countRes.rows[0]?.approved || '0', 10) + memLeaves.filter(l => l.status === 'APPROVED').length,
        rejected: parseInt(countRes.rows[0]?.rejected || '0', 10) + memLeaves.filter(l => l.status === 'REJECTED').length,
      };

      return res.json({
        success: true,
        data: combinedRows,
        counts
      });
    }

    const filtered = inMemoryLeaves.filter(l => l.school_id === schoolId);
    const counts = {
      all: filtered.length,
      pending: filtered.filter(l => l.status === 'PENDING').length,
      seen: filtered.filter(l => l.status === 'SEEN').length,
      approved: filtered.filter(l => l.status === 'APPROVED').length,
      rejected: filtered.filter(l => l.status === 'REJECTED').length,
    };
    return res.json({ success: true, data: filtered, counts });
  } catch (error: any) {
    console.error('Error fetching leaves:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch leaves' });
  }
});

// PUT /api/reviews/leaves/:id/approve
router.put('/leaves/:id/approve', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const schoolId = req.user?.schoolId;
    const reviewerId = req.user?.id;

    const defaultApproveNotes = req.user?.role === 'TEACHER' ? 'Approved by Class Teacher' : 'Approved by School Administration';
    if (isPostgresConfigured) {
      const updateRes = await pool.query(`
        UPDATE student_leave_requests
        SET status = 'APPROVED',
            reviewed_by = $1,
            review_notes = $2,
            updated_at = NOW()
        WHERE id = $3 AND school_id = $4
        RETURNING *
      `, [reviewerId, notes || defaultApproveNotes, id, schoolId]);

      if (updateRes.rowCount === 0) {
        return res.status(404).json({ success: false, message: 'Leave request not found' });
      }

      return res.json({
        success: true,
        message: 'Leave application approved',
        data: updateRes.rows[0]
      });
    }

    const item = inMemoryLeaves.find(l => l.id === id && l.school_id === schoolId);
    if (item) {
      item.status = 'APPROVED';
      item.reviewed_by = reviewerId;
      item.review_notes = notes || defaultApproveNotes;
      item.updated_at = new Date().toISOString();
      return res.json({ success: true, message: 'Leave application approved', data: item });
    }

    return res.json({ success: true, message: 'Leave approved' });
  } catch (error: any) {
    console.error('Error approving leave:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to approve leave' });
  }
});

// PUT /api/reviews/leaves/:id/reject
router.put('/leaves/:id/reject', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason, notes } = req.body;
    const schoolId = req.user?.schoolId;
    const reviewerId = req.user?.id;
    const defaultRejectNotes = req.user?.role === 'TEACHER' ? 'Leave request declined by Class Teacher' : 'Leave request declined by School Administration';

    if (isPostgresConfigured) {
      const updateRes = await pool.query(`
        UPDATE student_leave_requests
        SET status = 'REJECTED',
            reviewed_by = $1,
            review_notes = $2,
            updated_at = NOW()
        WHERE id = $3 AND school_id = $4
        RETURNING *
      `, [reviewerId, notes || reason || defaultRejectNotes, id, schoolId]);

      if (updateRes.rowCount === 0) {
        return res.status(404).json({ success: false, message: 'Leave request not found' });
      }

      return res.json({
        success: true,
        message: 'Leave application rejected',
        data: updateRes.rows[0]
      });
    }

    const item = inMemoryLeaves.find(l => l.id === id && l.school_id === schoolId);
    if (item) {
      item.status = 'REJECTED';
      item.reviewed_by = reviewerId;
      item.review_notes = notes || reason || defaultRejectNotes;
      item.updated_at = new Date().toISOString();
      return res.json({ success: true, message: 'Leave application rejected', data: item });
    }

    return res.json({ success: true, message: 'Leave rejected' });
  } catch (error: any) {
    console.error('Error rejecting leave:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to reject leave' });
  }
});

// PUT /api/reviews/leaves/:id/seen - Mark leave request as seen by faculty
router.put('/leaves/:id/seen', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const schoolId = req.user?.schoolId;
    const reviewerId = req.user?.id;

    const isUuid = (val: any) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
    const safeReviewerId = isUuid(reviewerId) ? reviewerId : null;

    if (isPostgresConfigured && isUuid(id) && isUuid(schoolId)) {
      try {
        const updateRes = await pool.query(`
          UPDATE student_leave_requests
          SET status = 'SEEN',
              reviewed_by = $1,
              review_notes = COALESCE(review_notes, 'Seen by Faculty'),
              updated_at = NOW()
          WHERE id = $2 AND school_id = $3
          RETURNING *
        `, [safeReviewerId, id, schoolId]);

        if (updateRes.rowCount && updateRes.rowCount > 0) {
          return res.json({
            success: true,
            message: 'Leave application marked as seen',
            data: updateRes.rows[0]
          });
        }
      } catch (dbErr: any) {
        console.warn('[Reviews] DB update error on mark seen:', dbErr.message);
      }
    }

    const item = inMemoryLeaves.find(l => (l.id === id || String(l.id) === String(id)) && (!schoolId || l.school_id === schoolId));
    if (item) {
      item.status = 'SEEN';
      item.reviewed_by = reviewerId;
      item.review_notes = item.review_notes || 'Seen by Faculty';
      item.updated_at = new Date().toISOString();
      return res.json({ success: true, message: 'Leave application marked as seen', data: item });
    }

    return res.status(404).json({ success: false, message: 'Leave request not found' });
  } catch (error: any) {
    console.error('Error marking leave as seen:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to mark leave as seen' });
  }
});

// PUT /api/reviews/leaves/mark-all-seen - Mark all pending leaves in the school as seen
router.put('/leaves/mark-all-seen', async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.user?.schoolId;
    const reviewerId = req.user?.id;
    const isUuid = (val: any) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
    const safeReviewerId = isUuid(reviewerId) ? reviewerId : null;

    if (isPostgresConfigured && isUuid(schoolId)) {
      try {
        await pool.query(`
          UPDATE student_leave_requests
          SET status = 'SEEN',
              reviewed_by = $1,
              review_notes = COALESCE(review_notes, 'Seen by Faculty'),
              updated_at = NOW()
          WHERE school_id = $2 AND status = 'PENDING'
        `, [safeReviewerId, schoolId]);
      } catch (err: any) {
        console.warn('[Reviews] DB mark-all-seen error:', err.message);
      }
    }

    inMemoryLeaves.forEach(l => {
      if ((!schoolId || l.school_id === schoolId) && l.status === 'PENDING') {
        l.status = 'SEEN';
        l.reviewed_by = reviewerId;
        l.review_notes = l.review_notes || 'Seen by Faculty';
        l.updated_at = new Date().toISOString();
      }
    });

    return res.json({ success: true, message: 'All pending leave requests marked as seen' });
  } catch (error: any) {
    console.error('Error marking all leaves as seen:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to mark all leaves as seen' });
  }
});

// POST /api/reviews/leaves - Create leave request
router.post('/leaves', async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.user?.schoolId;
    const { studentId, startDate, endDate, reason } = req.body;

    if (!startDate || !endDate || !reason) {
      return res.status(400).json({ success: false, message: 'Start date, end date, and reason are required' });
    }

    let targetStudentId = studentId || req.user?.id;
    if (isPostgresConfigured) {
      // Check if targetStudentId exists in students table. If not, match by user_id or admission number or fallback to an existing student in this school
      const stCheck = await pool.query(`SELECT id FROM students WHERE id::text = $1::text AND school_id = $2`, [String(targetStudentId), schoolId]);
      if (stCheck.rowCount === 0) {
        const altCheck = await pool.query(
          `SELECT id FROM students WHERE (user_id::text = $1::text OR admission_number::text = $1::text OR email::text = $1::text) AND school_id = $2 LIMIT 1`,
          [String(targetStudentId), schoolId]
        );
        if (altCheck.rowCount && altCheck.rowCount > 0) {
          targetStudentId = altCheck.rows[0].id;
        } else {
          const anySt = await pool.query(`SELECT id FROM students WHERE school_id = $1 LIMIT 1`, [schoolId]);
          if (anySt.rowCount && anySt.rowCount > 0) {
            targetStudentId = anySt.rows[0].id;
          }
        }
      }

      const ins = await pool.query(`
        INSERT INTO student_leave_requests (
          school_id, student_id, start_date, end_date, reason, status
        ) VALUES ($1, $2, $3, $4, $5, 'PENDING')
        RETURNING *
      `, [schoolId, targetStudentId, startDate, endDate, reason]);

      return res.status(201).json({
        success: true,
        message: 'Leave request submitted',
        data: ins.rows[0]
      });
    }

    const memItem = {
      id: `leave-${Date.now()}`,
      school_id: schoolId,
      applicant_type: 'STUDENT',
      student_id: targetStudentId,
      applicant_id: targetStudentId,
      applicant_name: req.user?.name || 'Student',
      identifier: 'ADM-STU',
      start_date: startDate,
      end_date: endDate,
      reason,
      status: 'PENDING',
      created_at: new Date().toISOString()
    };
    inMemoryLeaves.unshift(memItem);

    return res.status(201).json({ success: true, message: 'Leave request submitted', data: memItem });
  } catch (error: any) {
    console.error('Error creating leave request:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to create leave request' });
  }
});

/* =========================================================================
   TEACHER LEAVE REQUEST ENDPOINTS
   ========================================================================= */

// POST /api/reviews/teacher-leaves - Teacher submits leave request
router.post('/teacher-leaves', async (req: AuthRequest, res: Response) => {
  try {
    await ensureReviewTables();
    const schoolId = req.user?.schoolId;
    const { startDate, endDate, leaveType, reason } = req.body;

    if (!startDate || !endDate || !reason) {
      return res.status(400).json({ success: false, message: 'Start date, end date, and reason are required' });
    }

    const teacherName = req.user?.name || 'Faculty Member';
    const teacherEmail = req.user?.email || '';
    const teacherId = req.user?.id;
    const cleanLeaveType = String(leaveType || 'CASUAL').toUpperCase();
    const pgSchoolId = resolvePostgresSchoolId(schoolId);

    let savedItem: any = null;
    if (isPostgresConfigured && pgSchoolId) {
      let targetTeacherId = teacherId;
      const isUuid = (val: any) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
      if (!isUuid(targetTeacherId)) {
        const uRes = await pool.query(`SELECT id FROM users WHERE (email = $1 OR id::text = $2) AND school_id = $3 LIMIT 1`, [teacherEmail, String(teacherId), pgSchoolId]);
        if (uRes.rowCount && uRes.rowCount > 0) {
          targetTeacherId = uRes.rows[0].id;
        } else {
          const anyT = await pool.query(`SELECT id FROM users WHERE school_id = $1 AND role = 'TEACHER' LIMIT 1`, [pgSchoolId]);
          if (anyT.rowCount && anyT.rowCount > 0) {
            targetTeacherId = anyT.rows[0].id;
          } else {
            const insUser = await pool.query(
              `INSERT INTO users (school_id, name, email, role, status) VALUES ($1, $2, $3, 'TEACHER', 'ACTIVE') RETURNING id`,
              [pgSchoolId, teacherName, teacherEmail || `teacher-${Date.now()}@school.local`]
            );
            targetTeacherId = insUser.rows[0].id;
          }
        }
      }

      const ins = await pool.query(`
        INSERT INTO teacher_leave_requests (
          school_id, teacher_id, teacher_name, teacher_email, leave_type, start_date, end_date, reason, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING')
        RETURNING *
      `, [pgSchoolId, targetTeacherId, teacherName, teacherEmail, cleanLeaveType, startDate, endDate, reason]);

      return res.status(201).json({
        success: true,
        message: 'Leave application submitted to School Administration',
        data: ins.rows[0]
      });
    }

    const memItem = {
      id: `teacher-leave-${Date.now()}`,
      school_id: schoolId || '00000000-0000-0000-0000-000000000002',
      teacher_id: String(teacherId || ''),
      teacher_name: teacherName,
      teacher_email: teacherEmail,
      leave_type: cleanLeaveType,
      start_date: startDate,
      end_date: endDate,
      reason,
      status: 'PENDING' as const,
      created_at: new Date().toISOString()
    };
    inMemoryTeacherLeaves.unshift(memItem);

    return res.status(201).json({
      success: true,
      message: 'Leave application submitted to School Administration',
      data: memItem
    });
  } catch (error: any) {
    console.error('Error creating teacher leave request:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to submit leave application' });
  }
});

// GET /api/reviews/teacher-leaves/my - Logged-in teacher gets their own leave applications
router.get('/teacher-leaves/my', async (req: AuthRequest, res: Response) => {
  try {
    await ensureReviewTables();
    const schoolId = req.user?.schoolId;
    const teacherId = req.user?.id;
    const teacherEmail = req.user?.email;
    const pgSchoolId = resolvePostgresSchoolId(schoolId);

    if (isPostgresConfigured && pgSchoolId) {
      const q = await pool.query(`
        SELECT 
          l.id,
          l.school_id,
          l.teacher_id,
          COALESCE(l.teacher_name, u.name, 'Teacher') as teacher_name,
          COALESCE(l.teacher_email, u.email, '') as teacher_email,
          l.leave_type,
          l.start_date,
          l.end_date,
          l.reason,
          l.status,
          l.reviewed_by,
          COALESCE(l.reviewer_name, ru.name, 'School Administration') as reviewer_name,
          l.review_notes,
          l.reviewed_at,
          l.created_at,
          l.updated_at
        FROM teacher_leave_requests l
        LEFT JOIN users u ON u.id = l.teacher_id
        LEFT JOIN users ru ON ru.id = l.reviewed_by
        WHERE (l.school_id = $1 OR l.school_id::text = $2)
          AND (l.teacher_id::text = $3 OR l.teacher_email = $4 OR u.email = $4)
        ORDER BY l.created_at DESC
      `, [pgSchoolId, String(schoolId), String(teacherId), teacherEmail]);

      return res.json({ success: true, data: q.rows });
    }

    const filtered = inMemoryTeacherLeaves.filter(l => 
      isSameSchool(l.school_id, schoolId) && 
      (l.teacher_id === teacherId || l.teacher_email === teacherEmail)
    );
    return res.json({ success: true, data: filtered });
  } catch (error: any) {
    console.error('Error fetching my teacher leaves:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/reviews/teacher-leaves - School Admin views all teacher leaves
router.get('/teacher-leaves', async (req: AuthRequest, res: Response) => {
  try {
    await ensureReviewTables();
    const schoolId = req.user?.schoolId;
    const { status, search } = req.query;
    const pgSchoolId = resolvePostgresSchoolId(schoolId);

    if (isPostgresConfigured && pgSchoolId) {
      let query = `
        SELECT 
          l.id,
          l.school_id,
          'TEACHER' as applicant_type,
          l.teacher_id as applicant_id,
          COALESCE(l.teacher_name, u.name, 'Teacher') as applicant_name,
          COALESCE(l.teacher_email, u.email, '') as teacher_email,
          tp.employee_id as identifier,
          COALESCE(tp.qualification, 'Faculty Member') as detail,
          tp.photo_url,
          l.leave_type,
          l.start_date,
          l.end_date,
          l.reason,
          l.status,
          l.reviewed_by,
          COALESCE(l.reviewer_name, ru.name, 'School Administration') as reviewer_name,
          l.review_notes,
          l.reviewed_at,
          l.created_at,
          l.updated_at
        FROM teacher_leave_requests l
        LEFT JOIN users u ON u.id = l.teacher_id
        LEFT JOIN teacher_profiles tp ON tp.user_id = l.teacher_id
        LEFT JOIN users ru ON ru.id = l.reviewed_by
        WHERE (l.school_id = $1 OR l.school_id::text = $2)
      `;
      const params: any[] = [pgSchoolId, String(schoolId)];
      let pIdx = 3;

      if (status && status !== 'ALL') {
        query += ` AND l.status = $${pIdx++}`;
        params.push(status);
      }

      if (search && typeof search === 'string' && search.trim()) {
        query += ` AND (l.teacher_name ILIKE $${pIdx} OR l.teacher_email ILIKE $${pIdx} OR u.name ILIKE $${pIdx} OR l.reason ILIKE $${pIdx})`;
        params.push(`%${search.trim()}%`);
        pIdx++;
      }

      query += ` ORDER BY CASE WHEN l.status = 'PENDING' THEN 1 WHEN l.status = 'APPROVED' THEN 2 ELSE 3 END, l.created_at DESC`;

      const result = await pool.query(query, params);

      const countRes = await pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'PENDING') as pending,
          COUNT(*) FILTER (WHERE status = 'APPROVED') as approved,
          COUNT(*) FILTER (WHERE status = 'REJECTED') as rejected
        FROM teacher_leave_requests
        WHERE (school_id = $1 OR school_id::text = $2)
      `, [pgSchoolId, String(schoolId)]);

      const counts = {
        all: parseInt(countRes.rows[0]?.total || '0', 10),
        pending: parseInt(countRes.rows[0]?.pending || '0', 10),
        approved: parseInt(countRes.rows[0]?.approved || '0', 10),
        rejected: parseInt(countRes.rows[0]?.rejected || '0', 10)
      };

      return res.json({ success: true, data: result.rows, counts });
    }

    const filtered = inMemoryTeacherLeaves.filter(l => isSameSchool(l.school_id, schoolId));
    const counts = {
      all: filtered.length,
      pending: filtered.filter(l => l.status === 'PENDING').length,
      approved: filtered.filter(l => l.status === 'APPROVED').length,
      rejected: filtered.filter(l => l.status === 'REJECTED').length
    };
    return res.json({
      success: true,
      data: filtered.map(m => ({
        ...m,
        applicant_name: m.teacher_name || 'Faculty Member',
        applicant_id: m.teacher_id,
        applicant_type: 'TEACHER',
        identifier: 'FAC-EMP',
        detail: 'Faculty Member'
      })),
      counts
    });
  } catch (error: any) {
    console.error('Error fetching teacher leaves for admin:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/reviews/teacher-leaves/:id/approve - School Admin approves teacher leave
router.put('/teacher-leaves/:id/approve', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const schoolId = req.user?.schoolId;
    const reviewerId = req.user?.id;
    const reviewerName = req.user?.name || 'School Administration';
    const pgSchoolId = resolvePostgresSchoolId(schoolId);
    const defaultNotes = notes || 'Approved by School Administration';

    if (isPostgresConfigured && pgSchoolId) {
      const isUuid = (val: any) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
      const safeReviewerId = isUuid(reviewerId) ? reviewerId : null;

      const updateRes = await pool.query(`
        UPDATE teacher_leave_requests
        SET status = 'APPROVED',
            reviewed_by = $1,
            reviewer_name = $2,
            review_notes = $3,
            reviewed_at = NOW(),
            updated_at = NOW()
        WHERE id::text = $4 AND (school_id = $5 OR school_id::text = $6)
        RETURNING *
      `, [safeReviewerId, reviewerName, defaultNotes, String(id), pgSchoolId, String(schoolId)]);

      if (updateRes.rowCount && updateRes.rowCount > 0) {
        return res.json({
          success: true,
          message: 'Teacher leave approved successfully',
          data: updateRes.rows[0]
        });
      }
    }

    const item = inMemoryTeacherLeaves.find(l => (l.id === id || String(l.id) === String(id)) && isSameSchool(l.school_id, schoolId));
    if (item) {
      item.status = 'APPROVED';
      item.reviewed_by = reviewerId;
      item.reviewer_name = reviewerName;
      item.review_notes = defaultNotes;
      item.reviewed_at = new Date().toISOString();
      item.updated_at = new Date().toISOString();
      return res.json({ success: true, message: 'Teacher leave approved successfully', data: item });
    }

    return res.status(404).json({ success: false, message: 'Teacher leave request not found' });
  } catch (error: any) {
    console.error('Error approving teacher leave:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/reviews/teacher-leaves/:id/reject - School Admin rejects teacher leave
router.put('/teacher-leaves/:id/reject', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason, notes } = req.body;
    const schoolId = req.user?.schoolId;
    const reviewerId = req.user?.id;
    const reviewerName = req.user?.name || 'School Administration';
    const pgSchoolId = resolvePostgresSchoolId(schoolId);
    const defaultNotes = notes || reason || 'Declined by School Administration';

    if (isPostgresConfigured && pgSchoolId) {
      const isUuid = (val: any) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
      const safeReviewerId = isUuid(reviewerId) ? reviewerId : null;

      const updateRes = await pool.query(`
        UPDATE teacher_leave_requests
        SET status = 'REJECTED',
            reviewed_by = $1,
            reviewer_name = $2,
            review_notes = $3,
            reviewed_at = NOW(),
            updated_at = NOW()
        WHERE id::text = $4 AND (school_id = $5 OR school_id::text = $6)
        RETURNING *
      `, [safeReviewerId, reviewerName, defaultNotes, String(id), pgSchoolId, String(schoolId)]);

      if (updateRes.rowCount && updateRes.rowCount > 0) {
        return res.json({
          success: true,
          message: 'Teacher leave application rejected',
          data: updateRes.rows[0]
        });
      }
    }

    const item = inMemoryTeacherLeaves.find(l => (l.id === id || String(l.id) === String(id)) && isSameSchool(l.school_id, schoolId));
    if (item) {
      item.status = 'REJECTED';
      item.reviewed_by = reviewerId;
      item.reviewer_name = reviewerName;
      item.review_notes = defaultNotes;
      item.reviewed_at = new Date().toISOString();
      item.updated_at = new Date().toISOString();
      return res.json({ success: true, message: 'Teacher leave application rejected', data: item });
    }

    return res.status(404).json({ success: false, message: 'Teacher leave request not found' });
  } catch (error: any) {
    console.error('Error rejecting teacher leave:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

function formatLeaveDate(d: any) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d).slice(0, 10);
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit' });
}

// GET /api/reviews/notifications - Pending reviews for notification center and bell popup
router.get('/notifications', async (req: AuthRequest, res: Response) => {
  try {
    await ensureReviewTables();
    const schoolId = req.user?.schoolId;
    const userRole = req.user?.role;
    if (!schoolId) {
      return res.json({ success: true, pendingPhotosCount: 0, pendingLeavesCount: 0, pendingTeacherLeavesCount: 0, totalPendingCount: 0, notifications: [] });
    }

    const pgSchoolId = resolvePostgresSchoolId(schoolId);

    if (isPostgresConfigured && pgSchoolId) {
      const photosRes = (userRole === 'TEACHER') ? { rows: [] } : await pool.query(`
        SELECT id, applicant_name, applicant_type, identifier, detail, photo_url, created_at
        FROM photo_approval_requests
        WHERE (school_id = $1 OR school_id::text = $2) AND status = 'PENDING'
        ORDER BY created_at DESC
        LIMIT 10
      `, [pgSchoolId, String(schoolId)]);

      // For TEACHER: student leaves awaiting review
      const studentLeavesRes = (userRole === 'SCHOOL_ADMIN') ? { rows: [] } : await pool.query(`
        SELECT l.id, 'STUDENT' as applicant_type, COALESCE(s.name, 'Student') as applicant_name,
               s.admission_number as identifier, l.start_date, l.end_date, l.reason, l.created_at
        FROM student_leave_requests l
        LEFT JOIN students s ON s.id = l.student_id
        WHERE (l.school_id = $1 OR l.school_id::text = $2) AND l.status = 'PENDING'
        ORDER BY l.created_at DESC
        LIMIT 10
      `, [pgSchoolId, String(schoolId)]);

      // For SCHOOL_ADMIN: teacher leaves awaiting review
      const teacherLeavesRes = (userRole === 'TEACHER') ? { rows: [] } : await pool.query(`
        SELECT l.id, 'TEACHER' as applicant_type, COALESCE(l.teacher_name, u.name, 'Teacher') as applicant_name,
               tp.employee_id as identifier, l.leave_type, l.start_date, l.end_date, l.reason, l.created_at
        FROM teacher_leave_requests l
        LEFT JOIN users u ON u.id = l.teacher_id
        LEFT JOIN teacher_profiles tp ON tp.user_id = l.teacher_id
        WHERE (l.school_id = $1 OR l.school_id::text = $2) AND l.status = 'PENDING'
        ORDER BY l.created_at DESC
        LIMIT 10
      `, [pgSchoolId, String(schoolId)]);

      const countRes = await pool.query(`
        SELECT 
          (SELECT COUNT(*) FROM photo_approval_requests WHERE (school_id = $1 OR school_id::text = $2) AND status = 'PENDING') as pending_photos,
          (SELECT COUNT(*) FROM student_leave_requests WHERE (school_id = $1 OR school_id::text = $2) AND status = 'PENDING') as pending_student_leaves,
          (SELECT COUNT(*) FROM teacher_leave_requests WHERE (school_id = $1 OR school_id::text = $2) AND status = 'PENDING') as pending_teacher_leaves
      `, [pgSchoolId, String(schoolId)]);

      const rawPhotosCount = parseInt(countRes.rows[0]?.pending_photos || '0', 10);
      const rawStudentLeavesCount = parseInt(countRes.rows[0]?.pending_student_leaves || '0', 10);
      const rawTeacherLeavesCount = parseInt(countRes.rows[0]?.pending_teacher_leaves || '0', 10);

      const pendingPhotosCount = (userRole === 'TEACHER') ? 0 : rawPhotosCount;
      const pendingLeavesCount = (userRole === 'SCHOOL_ADMIN') 
        ? rawTeacherLeavesCount
        : rawStudentLeavesCount;
      const pendingTeacherLeavesCount = (userRole === 'TEACHER') ? 0 : rawTeacherLeavesCount;

      const notifications: any[] = [
        ...photosRes.rows.map(p => ({
          id: `photo-${p.id}`,
          rawId: p.id,
          type: 'PHOTO_APPROVAL',
          category: 'REVIEW',
          title: 'Photo Approval Request',
          message: `${p.applicant_name} (${p.identifier || p.detail || 'Student'}) uploaded a new profile photo for approval.`,
          link: '/photo-approvals',
          createdAt: p.created_at,
          avatar: p.photo_url,
          applicantName: p.applicant_name,
          applicantType: p.applicant_type
        })),
        ...studentLeavesRes.rows.map(l => ({
          id: `leave-${l.id}`,
          rawId: l.id,
          type: 'LEAVE_REQUEST',
          category: 'REVIEW',
          title: 'Student Leave Request',
          message: `${l.applicant_name} submitted a leave application (${formatLeaveDate(l.start_date)} to ${formatLeaveDate(l.end_date)}).`,
          link: '/leave-applications',
          createdAt: l.created_at,
          applicantName: l.applicant_name,
          applicantType: l.applicant_type,
          reason: l.reason,
          startDate: l.start_date,
          endDate: l.end_date
        })),
        ...teacherLeavesRes.rows.map(l => ({
          id: `teacher-leave-${l.id}`,
          rawId: l.id,
          type: 'TEACHER_LEAVE_REQUEST',
          category: 'REVIEW',
          title: "Teacher's Leave Request",
          message: `${l.applicant_name} applied for ${l.leave_type || 'Leave'} (${formatLeaveDate(l.start_date)} to ${formatLeaveDate(l.end_date)}).`,
          link: '/teacher-leave-approvals',
          createdAt: l.created_at,
          applicantName: l.applicant_name,
          applicantType: 'TEACHER',
          leaveType: l.leave_type,
          reason: l.reason,
          startDate: l.start_date,
          endDate: l.end_date
        }))
      ];

      notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return res.json({
        success: true,
        pendingPhotosCount,
        pendingLeavesCount,
        pendingTeacherLeavesCount,
        totalPendingCount: pendingPhotosCount + pendingLeavesCount,
        notifications
      });
    }

    const memTeacherLeaves = (userRole === 'TEACHER') ? [] : inMemoryTeacherLeaves.filter(l => isSameSchool(l.school_id, schoolId) && l.status === 'PENDING');
    const memStudentLeaves = (userRole === 'SCHOOL_ADMIN') ? [] : inMemoryLeaves.filter(l => isSameSchool(l.school_id, schoolId) && l.status === 'PENDING');
    const memPhotos = (userRole === 'TEACHER') ? [] : inMemoryPhotos.filter(p => isSameSchool(p.school_id, schoolId) && p.status === 'PENDING');

    const pendingLeavesCount = (userRole === 'SCHOOL_ADMIN') ? memTeacherLeaves.length : memStudentLeaves.length;

    const notifications: any[] = [
      ...memPhotos.map(p => ({
        id: `photo-${p.id}`,
        rawId: p.id,
        type: 'PHOTO_APPROVAL',
        category: 'REVIEW',
        title: 'Photo Approval Request',
        message: `${p.applicant_name} uploaded a new profile photo for approval.`,
        link: '/photo-approvals',
        createdAt: p.created_at,
        avatar: p.photo_url,
        applicantName: p.applicant_name,
        applicantType: p.applicant_type
      })),
      ...memStudentLeaves.map(l => ({
        id: `leave-${l.id}`,
        rawId: l.id,
        type: 'LEAVE_REQUEST',
        category: 'REVIEW',
        title: 'Student Leave Request',
        message: `${l.applicant_name} submitted a leave application (${formatLeaveDate(l.start_date)} to ${formatLeaveDate(l.end_date)}).`,
        link: '/leave-applications',
        createdAt: l.created_at,
        applicantName: l.applicant_name,
        applicantType: l.applicant_type
      })),
      ...memTeacherLeaves.map(l => ({
        id: `teacher-leave-${l.id}`,
        rawId: l.id,
        type: 'TEACHER_LEAVE_REQUEST',
        category: 'REVIEW',
        title: "Teacher's Leave Request",
        message: `${l.teacher_name} applied for ${l.leave_type || 'Leave'} (${formatLeaveDate(l.start_date)} to ${formatLeaveDate(l.end_date)}).`,
        link: '/teacher-leave-approvals',
        createdAt: l.created_at,
        applicantName: l.teacher_name,
        applicantType: 'TEACHER',
        leaveType: l.leave_type,
        reason: l.reason,
        startDate: l.start_date,
        endDate: l.end_date
      }))
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return res.json({
      success: true,
      pendingPhotosCount: memPhotos.length,
      pendingLeavesCount,
      pendingTeacherLeavesCount: memTeacherLeaves.length,
      totalPendingCount: memPhotos.length + pendingLeavesCount,
      notifications
    });
  } catch (error: any) {
    console.error('Error fetching review notifications:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;

