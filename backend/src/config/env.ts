import dotenv from 'dotenv';
import path from 'path';

// Load .env from backend/ and root directories so configuration works consistently from any directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

export function cleanEnv(val: string | undefined, fallback: string = ''): string {
  if (!val) return fallback;
  let s = String(val).trim();
  // Strip outer quotes if pasted into Render dashboard or .env with quotes
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s || fallback;
}

export function cleanSmtpPass(val: string | undefined, fallback: string = ''): string {
  let p = cleanEnv(val, fallback);
  // Gmail app passwords are 16 letters, displayed as 4 groups of 4: "ovmz huhs fxnx inlq"
  // Remove whitespace if it matches standard 16-character 4-group app password or general space-separated token
  if (/^[a-zA-Z]{4}(\s+[a-zA-Z]{4}){3}$/.test(p.trim())) {
    p = p.replace(/\s+/g, '');
  }
  return p;
}

export const env = {
  port: Number(cleanEnv(process.env.PORT, '5000')),
  databaseUrl: cleanEnv(process.env.DATABASE_URL, ''),
  jwtSecret: cleanEnv(process.env.JWT_SECRET, 'development-only-secret'),
  corsOrigin: cleanEnv(process.env.CORS_ORIGIN, 'http://localhost:5173,https://attendoschool.optinetinnovations.in,http://attendoschool.optinetinnovations.in,https://attendoschool.vercel.app'),
  razorpayKeyId: cleanEnv(process.env.RAZORPAY_KEY_ID, ''),
  razorpayKeySecret: cleanEnv(process.env.RAZORPAY_KEY_SECRET, ''),
  razorpayWebhookSecret: cleanEnv(process.env.RAZORPAY_WEBHOOK_SECRET, ''),
  smtpHost: cleanEnv(process.env.SMTP_HOST, 'smtp.gmail.com'),
  smtpPort: Number(cleanEnv(process.env.SMTP_PORT, '465')),
  smtpUser: cleanEnv(process.env.SMTP_USER, 'rajbsmv@gmail.com'),
  smtpPass: cleanSmtpPass(process.env.SMTP_PASS, 'ovmz huhs fxnx inlq'),
  smtpFrom: cleanEnv(process.env.SMTP_FROM, 'AttendoSchool Superadmin <rajbsmv@gmail.com>'),
  companyName: cleanEnv(process.env.COMPANY_NAME, 'School Attendance SaaS'),
  companyGstin: cleanEnv(process.env.COMPANY_GSTIN, ''),
  companyAddress: cleanEnv(process.env.COMPANY_ADDRESS, ''),
  companyPhone: cleanEnv(process.env.COMPANY_PHONE, ''),
  companyGstRate: Number(cleanEnv(process.env.COMPANY_GST_RATE, '18')),
  // Firebase configuration
  firebaseProjectId: cleanEnv(process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT, 'attendoschool-saas'),
  firebaseClientEmail: cleanEnv(process.env.FIREBASE_CLIENT_EMAIL, ''),
  firebasePrivateKey: cleanEnv(process.env.FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, '\n') || '',
  firebaseServiceAccountPath: cleanEnv(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, ''),
  firebaseServiceAccount: cleanEnv(process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_KEY, ''),
  firestoreEmulatorHost: cleanEnv(process.env.FIRESTORE_EMULATOR_HOST, ''),
  dbDriver: cleanEnv(process.env.DB_DRIVER, 'firebase').toLowerCase(), // 'firebase' | 'postgres'
  keepAliveUrl: cleanEnv(process.env.KEEP_ALIVE_URL || process.env.RENDER_EXTERNAL_URL, ''),
  // Email & deliverability settings
  emailEnabled: cleanEnv(process.env.EMAIL_ENABLED, 'true') !== 'false',
  emailRateLimit: Number(cleanEnv(process.env.EMAIL_RATE_LIMIT, '50')),
  emailMaxRetries: Number(cleanEnv(process.env.EMAIL_MAX_RETRIES, '4')),
  smtpReplyTo: cleanEnv(process.env.SMTP_REPLY_TO, ''),
  smtpFromName: cleanEnv(process.env.SMTP_FROM_NAME, 'AttendoSchool Superadmin'),
  resendApiKey: cleanEnv(process.env.RESEND_API_KEY, ''),
  resendFrom: cleanEnv(process.env.RESEND_FROM, ''),
  brevoApiKey: cleanEnv(process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY, ''),
  brevoSenderEmail: cleanEnv(process.env.BREVO_SENDER_EMAIL || process.env.SMTP_USER, 'rajbsmv@gmail.com'),
  brevoSenderName: cleanEnv(process.env.BREVO_SENDER_NAME || process.env.SMTP_FROM_NAME, 'AttendoSchool Superadmin'),
  gmailRelayUrl: cleanEnv(process.env.GMAIL_RELAY_URL || process.env.GOOGLE_SCRIPT_URL, ''),
  appBaseUrl: cleanEnv(process.env.APP_BASE_URL || process.env.FRONTEND_URL, 'https://attendoschool.optinetinnovations.in'),
  // Hybrid Dual-Database (Firebase Primary + Supabase PostgreSQL Secondary)
  supabaseDatabaseUrl: cleanEnv(process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL, ''),
  enableDualDbSync: cleanEnv(process.env.ENABLE_DUAL_DB_SYNC, 'true') === 'true',
  secondaryDb: cleanEnv(process.env.SECONDARY_DB, 'supabase').toLowerCase(),
};


