import { Router } from 'express';
import { checkPostgresHealth, isPostgresConfigured } from '../db';
import { env } from '../config/env';
import { testSmtpConnection, getGlobalSmtpConfig, isEmailServiceEnabled } from '../services/notificationService';

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
  const brevoKey = env.brevoApiKey || process.env.BREVO_API_KEY || '';
  const brevoKeyType = brevoKey.startsWith('xkeysib-') ? 'REST_API_KEY' : (brevoKey.startsWith('xsmtpsib-') ? 'SMTP_PASSWORD' : (brevoKey ? 'CUSTOM_KEY' : 'NOT_SET'));
  const port443Ready = Boolean(brevoKey.startsWith('xkeysib-') || env.resendApiKey || env.gmailRelayUrl);
  const isRender = Boolean(process.env.RENDER || process.env.RENDER_SERVICE_ID || (env.keepAliveUrl && env.keepAliveUrl.includes('render.com')));

  res.json({
    status: hasCreds || port443Ready ? 'configured' : 'missing_credentials',
    emailEnabled: isEmailServiceEnabled(),
    database: {
      engine: 'supabase_postgres',
      configured: isPostgresConfigured
    },
    smtp: {
      host: smtp.host || '(not set)',
      port: smtp.port || 465,
      user: smtp.username || '(not set)',
      passHint,
      from: smtp.defaultSenderEmail || '(not set)',
      fromName: smtp.defaultSenderName || '(not set)',
      encryption: smtp.encryption
    },
    gateways: {
      brevo: {
        configured: Boolean(brevoKey),
        keyType: brevoKeyType,
        keyPrefix: brevoKey ? `${brevoKey.slice(0, 8)}...` : null,
        senderEmail: env.brevoSenderEmail || smtp.username,
        isRestApiCompatible: brevoKey.startsWith('xkeysib-')
      },
      gmailRelay: {
        configured: Boolean(env.gmailRelayUrl)
      },
      resend: {
        configured: Boolean(env.resendApiKey)
      },
      port443Ready
    },
    renderEgress: {
      isRender,
      canDirectSmtp: !isRender,
      requiresPort443: isRender,
      status: (!isRender || port443Ready) ? 'READY' : 'ACTION_REQUIRED',
      guidance: isRender && !port443Ready ? (
        brevoKeyType === 'SMTP_PASSWORD'
          ? 'BREVO_API_KEY currently contains an SMTP key (xsmtpsib-). Generate an API Key (xkeysib-) in Brevo -> SMTP & API -> API Keys to enable HTTPS Port 443 delivery on Render.'
          : 'Render Free Tier blocks ports 25/465/587. Add a Brevo API Key (xkeysib-...) or GMAIL_RELAY_URL to send emails over Port 443.'
      ) : 'All egress requirements satisfied.'
    },
    envSource: {
      SMTP_HOST: process.env.SMTP_HOST ? 'env' : 'default',
      SMTP_USER: process.env.SMTP_USER ? 'env' : 'default',
      SMTP_PASS: process.env.SMTP_PASS ? 'env' : 'default',
      BREVO_API_KEY: process.env.BREVO_API_KEY ? 'env' : 'not_set',
      EMAIL_ENABLED: process.env.EMAIL_ENABLED || 'default(true)',
      NODE_ENV: process.env.NODE_ENV || 'development'
    },
    timestamp: new Date().toISOString()
  });
});

// ── Send a real test email to verify SMTP on the live server ──
r.post('/email-test', async (req, res) => {
  const { to, port, host, encryption, brevoApiKey, brevoSenderEmail, brevoSenderName } = req.body || {};
  const recipient = to || env.smtpUser;
  if (!recipient) {
    return res.status(400).json({ success: false, message: 'Recipient email is required for SMTP test' });
  }

  try {
    const result = await testSmtpConnection('global', recipient, {
      ...(host ? { host } : {}),
      ...(port ? { port: Number(port) } : {}),
      ...(encryption ? { encryption } : {}),
      ...(brevoApiKey ? { brevoApiKey } : {}),
      ...(brevoSenderEmail ? { brevoSenderEmail } : {}),
      ...(brevoSenderName ? { brevoSenderName } : {})
    });
    res.json({
      success: true,
      ...result,
      sentTo: recipient,
      diagnostics: {
        targetHost: host || env.smtpHost,
        requestedPort: port ? Number(port) : env.smtpPort,
        activeEncryption: encryption || (Number(port || env.smtpPort) === 465 ? 'SSL/TLS' : 'STARTTLS')
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
