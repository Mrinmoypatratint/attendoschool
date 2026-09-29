import dotenv from 'dotenv';
import path from 'path';

// Load .env from backend/ and root directories so configuration works consistently from any directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

export const env = {
  port: Number(process.env.PORT || 5000),
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'development-only-secret',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173,https://attendoschool.optinetinnovations.in,http://attendoschool.optinetinnovations.in,https://attendoschool.vercel.app',
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
  smtpPort: Number(process.env.SMTP_PORT || 465),
  smtpUser: process.env.SMTP_USER || 'rajbsmv@gmail.com',
  smtpPass: process.env.SMTP_PASS || 'ovmz huhs fxnx inlq',
  smtpFrom: process.env.SMTP_FROM || 'AttendoSchool Superadmin <rajbsmv@gmail.com>',
  companyName: process.env.COMPANY_NAME || 'School Attendance SaaS',
  companyGstin: process.env.COMPANY_GSTIN || '',
  companyAddress: process.env.COMPANY_ADDRESS || '',
  companyPhone: process.env.COMPANY_PHONE || '',
  companyGstRate: Number(process.env.COMPANY_GST_RATE || 18),
  // Firebase configuration
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'attendoschool-saas',
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
  firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
  firebaseServiceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '',
  firebaseServiceAccount: process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '',
  firestoreEmulatorHost: process.env.FIRESTORE_EMULATOR_HOST || '',
  dbDriver: (process.env.DB_DRIVER || 'firebase').toLowerCase(), // 'firebase' | 'postgres'
  keepAliveUrl: process.env.KEEP_ALIVE_URL || process.env.RENDER_EXTERNAL_URL || '',
  // Email & deliverability settings
  emailEnabled: process.env.EMAIL_ENABLED !== 'false',
  emailRateLimit: Number(process.env.EMAIL_RATE_LIMIT || 50),
  emailMaxRetries: Number(process.env.EMAIL_MAX_RETRIES || 4),
  smtpReplyTo: process.env.SMTP_REPLY_TO || '',
  smtpFromName: process.env.SMTP_FROM_NAME || 'AttendoSchool Notifications',
  appBaseUrl: process.env.APP_BASE_URL || process.env.FRONTEND_URL || 'https://attendoschool.optinetinnovations.in',
};

