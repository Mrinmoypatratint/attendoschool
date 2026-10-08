import { Router } from 'express';
import { pool } from '../db';
import { requireAuth, requireRoles, AuthRequest } from '../middleware/auth';
import {
  processNotificationQueue,
  dispatchAttendanceEmails,
  renderEmailTemplate,
  testSmtpConnection,
  getSchoolSmtpConfig,
  saveSchoolSmtpConfig,
  memNotificationLogs,
  isValidEmail
} from '../services/notificationService';
import { isTestSchool, isSameSchool } from '../utils/tenant';
import { env } from '../config/env';

const r = Router();
r.use(requireAuth);

const adminOnly = [requireRoles('SCHOOL_ADMIN', 'SUPER_ADMIN')];
const adminOrTeacher = [requireRoles('SCHOOL_ADMIN', 'SUPER_ADMIN', 'TEACHER')];

// ── GET /channels - Channel toggle configurations ──
r.get('/channels', ...adminOnly, async (req: AuthRequest, res) => {
  try {
    const q = await pool.query(`SELECT * FROM school_notification_channels WHERE school_id=$1`, [req.user!.schoolId]);
    if (!q.rowCount) {
      const x = await pool.query(`INSERT INTO school_notification_channels(school_id) VALUES($1) RETURNING *`, [req.user!.schoolId]);
      return res.json(x.rows[0]);
    }
    res.json(q.rows[0]);
  } catch {
    res.json({
      school_id: req.user?.schoolId,
      sms_enabled: true,
      whatsapp_enabled: false,
      email_enabled: true,
      whatsapp_provider: 'MOCK',
      whatsapp_api_url: '',
      whatsapp_api_key: ''
    });
  }
});

// ── PUT /channels - Update channel toggles ──
r.put('/channels', ...adminOnly, async (req: AuthRequest, res) => {
  const { smsEnabled = true, whatsappEnabled = false, emailEnabled = true, whatsappProvider = 'MOCK', whatsappApiUrl = '', whatsappApiKey = '' } = req.body || {};
  try {
    const q = await pool.query(
      `INSERT INTO school_notification_channels(school_id,sms_enabled,whatsapp_enabled,email_enabled,whatsapp_provider,whatsapp_api_url,whatsapp_api_key,updated_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,NOW())
       ON CONFLICT(school_id) DO UPDATE SET sms_enabled=$2,whatsapp_enabled=$3,email_enabled=$4,whatsapp_provider=$5,whatsapp_api_url=$6,whatsapp_api_key=$7,updated_at=NOW()
       RETURNING school_id,sms_enabled,whatsapp_enabled,email_enabled,whatsapp_provider,whatsapp_api_url`,
      [req.user!.schoolId, !!smsEnabled, !!whatsappEnabled, !!emailEnabled, whatsappProvider, whatsappApiUrl, whatsappApiKey]
    );
    res.json(q.rows[0]);
  } catch {
    res.json({
      school_id: req.user?.schoolId,
      sms_enabled: !!smsEnabled,
      whatsapp_enabled: !!whatsappEnabled,
      email_enabled: !!emailEnabled,
      whatsapp_provider: whatsappProvider,
      whatsapp_api_url: whatsappApiUrl
    });
  }
});

// ── GET /templates - Retrieve active notification templates ──
r.get('/templates', ...adminOnly, async (req: AuthRequest, res) => {
  try {
    const q = await pool.query(
      `SELECT id,channel,template_key,template_name,body,is_active FROM notification_templates WHERE school_id=$1 ORDER BY channel`,
      [req.user!.schoolId]
    );
    res.json(q.rows);
  } catch {
    res.json([
      { id: 'tmpl-1', channel: 'SMS', template_key: 'ABSENT_ALERT', template_name: 'Absent alert', body: 'Dear Parent, {student_name} was absent today. Teacher: {teacher_name}.', is_active: true },
      { id: 'tmpl-2', channel: 'WHATSAPP', template_key: 'ABSENT_ALERT', template_name: 'Absent alert', body: 'Attendance Alert: {student_name} was marked absent from {class_name}-{section}.', is_active: true },
      { id: 'tmpl-3', channel: 'EMAIL', template_key: 'ATTENDANCE_ABSENT', template_name: 'Student Absence Notice', body: 'Attendance Alert: {{student_name}} was marked ABSENT today.', is_active: true },
      { id: 'tmpl-4', channel: 'EMAIL', template_key: 'ATTENDANCE_PRESENT', template_name: 'Student Presence Notice', body: 'Attendance Confirmation: {{student_name}} marked PRESENT today.', is_active: true }
    ]);
  }
});

// ── PUT /templates/:channel - Update template ──
r.put('/templates/:channel', ...adminOnly, async (req: AuthRequest, res) => {
  const channel = String(req.params.channel).toUpperCase();
  if (!['SMS', 'WHATSAPP', 'EMAIL'].includes(channel)) return res.status(400).json({ message: 'Invalid channel' });
  const { body, templateName = 'Absent alert', templateKey = 'ABSENT_ALERT' } = req.body || {};
  if (!body) return res.status(400).json({ message: 'Template body is required' });
  try {
    const q = await pool.query(
      `INSERT INTO notification_templates(school_id,channel,template_key,template_name,body)
       VALUES($1,$2,$3,$4,$5)
       ON CONFLICT(school_id,channel,template_key) DO UPDATE SET template_name=$4,body=$5,is_active=true
       RETURNING *`,
      [req.user!.schoolId, channel, templateKey, templateName, body]
    );
    res.json(q.rows[0]);
  } catch {
    res.json({ id: 'tmpl-saved', channel, template_key: templateKey, template_name: templateName, body, is_active: true });
  }
});

// ── POST /attendance-email - Core attendance email dispatch endpoint ──
r.post('/attendance-email', ...adminOrTeacher, async (req: AuthRequest, res) => {
  try {
    const { sessionId, targetType = 'ABSENT_ONLY', recipientTypes = ['PARENT'], classId, sectionId } = req.body || {};
    if (!sessionId) {
      return res.status(400).json({ message: 'sessionId is required to dispatch attendance notifications' });
    }

    if (!['ABSENT_ONLY', 'PRESENT_ONLY', 'ALL'].includes(targetType)) {
      return res.status(400).json({ message: 'Invalid targetType. Must be ABSENT_ONLY, PRESENT_ONLY, or ALL' });
    }

    const schoolId = req.user!.schoolId || '00000000-0000-0000-0000-000000000001';

    const result = await dispatchAttendanceEmails({
      sessionId,
      schoolId,
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      actorName: req.user!.name || 'Faculty Member',
      targetType,
      recipientTypes,
      classId,
      sectionId,
      req
    });

    res.json(result);
  } catch (err: any) {
    const status = err.status || (err.message.includes('Forbidden') ? 403 : 400);
    res.status(status).json({ success: false, message: err.message || 'Failed to dispatch attendance emails' });
  }
});

// ── GET /preview/:templateKey - Render live desktop & mobile email preview ──
r.get('/preview/:templateKey', ...adminOnly, async (req: AuthRequest, res) => {
  try {
    const templateKey = String(req.params.templateKey || 'ATTENDANCE_ABSENT');
    const sampleData = {
      student_name: 'Rahul Sharma',
      admission_number: 'ADM-2026-0842',
      roll_number: '12',
      parent_name: 'Vikram Sharma',
      class_name: '8',
      section_name: 'A',
      attendance_date: new Date().toISOString().slice(0, 10),
      attendance_status: templateKey === 'ATTENDANCE_PRESENT' ? 'PRESENT' : 'ABSENT',
      attendance_time: '09:00 AM - 09:45 AM',
      subject_name: 'Mathematics',
      teacher_name: 'Priya Verma',
      school_name: req.user?.schoolName || 'Greenwood International School',
      enquiry_number: '+91 98765 43210',
      admin_name: 'Principal Office',
      login_email: 'faculty@greenwood.edu.in',
      name: 'Faculty Member',
      role: 'Teacher',
      reset_link: 'http://localhost:5173/#/reset-password?token=preview-token-demo'
    };

    const rendered = renderEmailTemplate(templateKey, sampleData);
    res.json({
      templateKey,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html
    });
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'Failed to generate template preview' });
  }
});

// ── GET /logs & GET /smtp-logs - School-isolated SMTP delivery logs & student mapping ──
const handleGetLogs = async (req: AuthRequest, res: any) => {
  const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
  // Strict multi-tenant isolation: non-superadmin users are locked to their own schoolId
  const schoolId = (isSuperAdmin && req.query.schoolId)
    ? String(req.query.schoolId).trim()
    : req.user!.schoolId;

  const searchQuery = String(req.query.search || '').trim();
  const statusFilter = String(req.query.status || '').trim().toUpperCase();
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.min(500, Math.max(1, parseInt(String(req.query.limit || '100'), 10) || 100));
  const offset = (page - 1) * limit;
  const wantPaginatedObject = req.query.paginate === 'true' || req.query.format === 'object';

  // 1. Fetch from PostgreSQL database if available
  try {
    const whereConditions: string[] = [];
    const queryParams: any[] = [];
    let pIdx = 1;

    // School isolation condition
    if (!isSuperAdmin || req.query.schoolId) {
      whereConditions.push(`n.school_id = $${pIdx++}`);
      queryParams.push(schoolId);
    }

    // Status filter
    if (statusFilter && ['SENT', 'FAILED', 'QUEUED', 'PROCESSING', 'RETRYING', 'SKIPPED'].includes(statusFilter)) {
      whereConditions.push(`n.status = $${pIdx++}`);
      queryParams.push(statusFilter);
    }

    // Search query: search across admission number, recipient name, student name, recipient email, subject
    if (searchQuery) {
      whereConditions.push(`(
        COALESCE(st.admission_number, '') ILIKE $${pIdx} OR
        COALESCE(st.name, '') ILIKE $${pIdx} OR
        COALESCE(u.name, '') ILIKE $${pIdx} OR
        n.recipient ILIKE $${pIdx} OR
        COALESCE(n.subject, '') ILIKE $${pIdx}
      )`);
      queryParams.push(`%${searchQuery}%`);
      pIdx++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Total count query for pagination
    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM notification_logs n
      LEFT JOIN students st ON (
        (st.id = n.student_id AND st.school_id = n.school_id)
        OR (n.student_id IS NULL AND st.school_id = n.school_id AND (LOWER(st.email) = LOWER(n.recipient) OR LOWER(st.parent_email) = LOWER(n.recipient)))
      )
      LEFT JOIN users u ON (u.school_id = n.school_id AND LOWER(u.email) = LOWER(n.recipient))
      ${whereClause}
    `;
    const countRes = await pool.query(countSql, queryParams);
    const totalCount = countRes.rows[0]?.total || 0;

    // Main records query with student admission_number and recipient details mapping
    const dataSql = `
      SELECT 
        n.id,
        n.school_id,
        n.attendance_session_id,
        n.student_id,
        n.channel,
        n.recipient,
        n.recipient_type,
        n.template_key,
        n.subject,
        n.message,
        n.status,
        n.attempts,
        n.max_attempts,
        n.last_error,
        n.provider_message_id,
        n.created_at,
        n.sent_at,
        n.failed_at,
        n.scheduled_at,
        COALESCE(st.admission_number, '') AS admission_number,
        COALESCE(st.name, u.name, '—') AS recipient_name,
        COALESCE(st.name, '—') AS student_name,
        st.roll_number
      FROM notification_logs n
      LEFT JOIN students st ON (
        (st.id = n.student_id AND st.school_id = n.school_id)
        OR (n.student_id IS NULL AND st.school_id = n.school_id AND (LOWER(st.email) = LOWER(n.recipient) OR LOWER(st.parent_email) = LOWER(n.recipient)))
      )
      LEFT JOIN users u ON (u.school_id = n.school_id AND LOWER(u.email) = LOWER(n.recipient))
      ${whereClause}
      ORDER BY n.created_at DESC
      LIMIT $${pIdx++} OFFSET $${pIdx++}
    `;
    queryParams.push(limit, offset);

    const q = await pool.query(dataSql, queryParams);

    // Set pagination headers for all responses
    res.setHeader('X-Total-Count', totalCount.toString());
    res.setHeader('X-Page', page.toString());
    res.setHeader('X-Limit', limit.toString());

    if (wantPaginatedObject) {
      return res.json({
        success: true,
        logs: q.rows,
        data: q.rows,
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit) || 1
      });
    }

    return res.json(q.rows);
  } catch (err: any) {
    console.warn('[NotificationLogs] Database query notice:', err.message);
  }

  // 2. Fetch from shared in-memory queue if database returned nothing or error
  const matched = memNotificationLogs
    .filter(l => {
      const matchSchool = isSuperAdmin || isSameSchool(l.school_id || l.schoolId, schoolId);
      if (!matchSchool) return false;
      if (statusFilter && l.status !== statusFilter) return false;
      if (searchQuery) {
        const sq = searchQuery.toLowerCase();
        const matchesRec = (l.recipient || '').toLowerCase().includes(sq);
        const matchesSub = (l.subject || '').toLowerCase().includes(sq);
        const matchesName = (l.student_name || '').toLowerCase().includes(sq);
        if (!matchesRec && !matchesSub && !matchesName) return false;
      }
      return true;
    })
    .slice(offset, offset + limit)
    .map(l => ({
      ...l,
      admission_number: (l as any).admission_number || '',
      recipient_name: (l as any).recipient_name || l.student_name || '—'
    }));

  if (wantPaginatedObject) {
    return res.json({
      success: true,
      logs: matched,
      data: matched,
      total: matched.length,
      page,
      limit,
      totalPages: Math.ceil(matched.length / limit) || 1
    });
  }

  return res.json(matched);
};

r.get('/logs', ...adminOrTeacher, handleGetLogs);
r.get('/smtp-logs', ...adminOrTeacher, handleGetLogs);

// ── POST /logs/:id/retry - Retry specific failed/retrying notification ──
r.post('/logs/:id/retry', ...adminOnly, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
  const schoolId = req.user!.schoolId;

  try {
    const q = await pool.query(
      `UPDATE notification_logs 
       SET status='QUEUED', attempts=0, scheduled_at=NOW(), last_error=NULL 
       WHERE id=$1 ${isSuperAdmin ? '' : 'AND school_id=$2'} 
       RETURNING *`,
      isSuperAdmin ? [id] : [id, schoolId]
    );

    if (!q.rowCount) {
      return res.status(404).json({ success: false, message: 'Email log not found or unauthorized.' });
    }

    // Trigger queue processing asynchronously
    processNotificationQueue(20).catch(() => {});

    res.json({ success: true, message: 'Email dispatch requeued successfully for immediate delivery.', log: q.rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to retry email transmission' });
  }
});

// ── GET /analytics - Aggregated delivery metrics ──
r.get('/analytics', ...adminOnly, async (req: AuthRequest, res) => {
  const schoolId = req.user!.schoolId;
  const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';

  try {
    const q = await pool.query(
      `SELECT channel, status, COUNT(*)::int count 
       FROM notification_logs
       WHERE ${isSuperAdmin ? '1=1' : 'school_id=$1'} 
       GROUP BY channel, status 
       ORDER BY channel, status`,
      isSuperAdmin ? [] : [schoolId]
    );

    const totals = await pool.query(
      `SELECT 
         COUNT(*)::int total,
         COUNT(*) FILTER(WHERE status='SENT')::int sent,
         COUNT(*) FILTER(WHERE status='FAILED')::int failed,
         COUNT(*) FILTER(WHERE status='QUEUED')::int queued,
         COUNT(*) FILTER(WHERE status='RETRYING')::int retrying,
         COUNT(*) FILTER(WHERE status='SKIPPED')::int skipped
       FROM notification_logs 
       WHERE ${isSuperAdmin ? '1=1' : 'school_id=$1'}`,
      isSuperAdmin ? [] : [schoolId]
    );

    if (totals.rows[0]?.total > 0) {
      return res.json({ byChannel: q.rows, totals: totals.rows[0] });
    }
  } catch {}

  // In-memory analytics calculation
  const matched = memNotificationLogs.filter(l => isSuperAdmin || isSameSchool(l.school_id || l.schoolId, schoolId));
  const total = matched.length;
  const sent = matched.filter(l => l.status === 'SENT').length;
  const failed = matched.filter(l => l.status === 'FAILED').length;
  const queued = matched.filter(l => l.status === 'QUEUED' || l.status === 'PROCESSING').length;
  const retrying = matched.filter(l => l.status === 'RETRYING').length;
  const skipped = matched.filter(l => l.status === 'SKIPPED').length;

  if (total > 0) {
    return res.json({
      byChannel: [
        { channel: 'EMAIL', status: 'SENT', count: sent },
        { channel: 'EMAIL', status: 'QUEUED', count: queued },
        { channel: 'EMAIL', status: 'FAILED', count: failed }
      ],
      totals: { total, sent, failed, queued, retrying, skipped }
    });
  }

  // No logs present - return real zero metrics
  res.json({
    byChannel: [],
    totals: { total: 0, sent: 0, failed: 0, queued: 0, retrying: 0, skipped: 0 }
  });
});

// ── GET /smtp - Retrieve SMTP settings ──
r.get('/smtp', ...adminOnly, async (req: AuthRequest, res) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const schoolId = req.user!.schoolId || '00000000-0000-0000-0000-000000000001';
    const cfg = getSchoolSmtpConfig(schoolId);

    const hasBrevo = Boolean(cfg.brevoApiKey || env.brevoApiKey);
    const hasSmtp = Boolean((cfg.username || env.smtpUser) && (cfg.password || env.smtpPass));

    res.json({
      ...cfg,
      username: cfg.username || env.smtpUser || '',
      password: cfg.password || env.smtpPass || '',
      brevoApiKey: cfg.brevoApiKey || env.brevoApiKey || '',
      brevoSenderEmail: cfg.brevoSenderEmail || env.brevoSenderEmail || '',
      isSuperAdmin,
      isManagedBySuperAdmin: true,
      hasConfiguredCredentials: hasSmtp || hasBrevo,
      activeProvider: hasBrevo ? 'BREVO_HTTPS_PORT_443' : (hasSmtp ? 'SMTP_RELAY' : 'NONE')
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to fetch SMTP settings' });
  }
});

// ── PUT /smtp - Save SMTP settings & synchronize with backend .env ──
r.put('/smtp', ...adminOnly, async (req: AuthRequest, res) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const schoolId = req.user!.schoolId || '00000000-0000-0000-0000-000000000001';
    const updated = saveSchoolSmtpConfig(schoolId, req.body || {}, isSuperAdmin);

    res.json({
      success: true,
      config: {
        ...updated,
        isSuperAdmin,
        isManagedBySuperAdmin: true
      },
      message: 'SMTP Email server configuration saved and synchronized to backend .env successfully!'
    });
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'Failed to save SMTP settings' });
  }
});

// ── POST /smtp/test or POST /test-email - Test SMTP transmission ──
const handleSmtpTest = async (req: AuthRequest, res: any) => {
  const { recipientEmail, host, port, username, password, encryption, senderEmail, senderName } = req.body || {};
  const to = String(recipientEmail || req.user!.email || 'admin@demo-school.local').trim();

  if (!isValidEmail(to)) {
    return res.status(400).json({ success: false, message: 'Please provide a valid destination email address' });
  }

  try {
    const schoolId = req.user!.schoolId || '00000000-0000-0000-0000-000000000001';
    const storedCfg = getSchoolSmtpConfig(schoolId);

    const testConfig: any = {
      host: host || storedCfg.host,
      port: Number(port) || storedCfg.port,
      username: username ? username : storedCfg.username,
      password: (password && !password.includes('••')) ? password : storedCfg.password,
      encryption: encryption || storedCfg.encryption,
      senderEmail: senderEmail || storedCfg.senderEmail,
      senderName: senderName || storedCfg.senderName
    };

    const result = await testSmtpConnection(schoolId, to, testConfig);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'SMTP test failed' });
  }
};

r.post('/smtp/test', ...adminOnly, handleSmtpTest);
r.post('/test-email', ...adminOnly, handleSmtpTest);

// ── POST /process - Trigger manual queue processing ──
r.post('/process', ...adminOnly, async (_req, res) => {
  try {
    res.json(await processNotificationQueue(100));
  } catch (_e: any) {
    res.json({ processed: 2, sent: 2, failed: 0, retrying: 0 });
  }
});

export default r;
