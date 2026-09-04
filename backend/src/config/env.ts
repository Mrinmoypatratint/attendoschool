import 'dotenv/config';

export const env = {
  port: Number(process.env.PORT || 5000),
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'development-only-secret',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpFrom: process.env.SMTP_FROM || '',
  companyName: process.env.COMPANY_NAME || 'School Attendance SaaS',
  companyGstin: process.env.COMPANY_GSTIN || '',
  companyAddress: process.env.COMPANY_ADDRESS || '',
  companyPhone: process.env.COMPANY_PHONE || '',
  companyGstRate: Number(process.env.COMPANY_GST_RATE || 18),
};
