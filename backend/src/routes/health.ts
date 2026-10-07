import { Router } from 'express';
import { checkPostgresHealth, isPostgresConfigured } from '../db';
import { env } from '../config/env';
import { testSmtpConnection, getGlobalSmtpConfig } from '../services/notificationService';

const r = Router();

r.get('/', async (_req, res) => {
  let pgOk = false;
  let latency: number | undefined;
  try {
    const pgHealth = await checkPostgresHealth();
    pgOk = pgHealth.ok;
    latency = pgHealth.latency;
  } catch {}

  res.status(200).json({
    status: 'ok',
    database: {
      supabase: pgOk ? 'connected' : (isPostgresConfigured ? 'connecting' : 'disconnected'),
      mode: 'supabase_postgres',
      ...(latency !== undefined ? { latency: `${latency}ms` } : {})
    },
    version: 'production',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// ── Email System Diagnostics (No auth needed for basic status) ──
r.get('/email-status', (_req, res) => {
  const smtp = getGlobalSmtpConfig();
  const hasCreds = Boolean(smtp.username && smtp.password && smtp.host);
  const passHint = smtp.password ? `${smtp.password.slice(0, 4)}${'•'.repeat(Math.max(0, smtp.password.length - 4))}` : '(not set)';

  res.json({
    status: hasCreds ? 'configured' : 'missing_credentials',
    emailEnabled: env.emailEnabled,
    database: {
      engine: 'supabase_postgres',
      configured: isPostgresConfigured
    },
    smtp: {
      host: smtp.host || '(not set)',
      port: smtp.port || 587,
      user: smtp.username || '(not set)',
      passHint,
      from: smtp.defaultSenderEmail || '(not set)',
      fromName: smtp.defaultSenderName || '(not set)',
      encryption: smtp.encryption
    },
    envSource: {
      SMTP_HOST: process.env.SMTP_HOST ? 'env' : 'default',
      SMTP_USER: process.env.SMTP_USER ? 'env' : 'default',
      SMTP_PASS: process.env.SMTP_PASS ? 'env' : 'default',
      EMAIL_ENABLED: process.env.EMAIL_ENABLED || 'default(true)',
      NODE_ENV: process.env.NODE_ENV || 'development'
    },
    timestamp: new Date().toISOString()
  });
});

// ── Send a real test email to verify SMTP on the live server ──
r.post('/email-test', async (req, res) => {
  const { to, port, host, encryption } = req.body || {};
  const recipient = to || env.smtpUser;
  if (!recipient) {
    return res.status(400).json({ success: false, message: 'Recipient email is required for SMTP test' });
  }

  try {
    const result = await testSmtpConnection('global', recipient, {
      ...(host ? { host } : {}),
      ...(port ? { port: Number(port) } : {}),
      ...(encryption ? { encryption } : {})
    });
    res.json({
      success: true,
      ...result,
      sentTo: recipient,
      diagnostics: {
        targetHost: host || env.smtpHost,
        requestedPort: port ? Number(port) : env.smtpPort,
        activeEncryption: encryption || (Number(port || env.smtpPort) === 587 ? 'STARTTLS' : 'SSL/TLS')
      },
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'SMTP delivery failed',
      code: err.code,
      sentTo: recipient,
      timestamp: new Date().toISOString()
    });
  }
});

export default r;
