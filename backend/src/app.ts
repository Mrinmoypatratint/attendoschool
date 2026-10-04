import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { env } from './config/env';
import { requireAuth } from './middleware/auth';
import { securityHeaders, apiRateLimit, requestContext } from './middleware/security';

// Core routes
import health from './routes/health';
import auth from './routes/auth';
import dashboard from './routes/dashboard';
import schoolData from './routes/schoolData';
import routines from './routes/routines';
import teacher from './routes/teacher';
import notifications from './routes/notifications';
import superAdmin from './routes/superAdmin';

// Operational routes (clean non-versioned)
import superAdminOperations from './routes/superAdminOperations';
import payment from './routes/payment';
import schoolPayment from './routes/schoolPayment';
import razorpayWebhook from './routes/razorpayWebhook';
import razorpaySchool from './routes/razorpaySchool';
import invoices from './routes/invoices';
import notificationChannels from './routes/notificationChannels';
import attendanceReports from './routes/attendanceReports';
import attendanceCorrections from './routes/attendanceCorrections';
import peopleManagement from './routes/peopleManagement';
import academicYears from './routes/academicYears';
import studentPromotions from './routes/studentPromotions';
import parentPortal from './routes/parentPortal';
import permissions from './routes/permissions';
import subscriptions from './routes/subscriptions';
import security from './routes/security';
import backups from './routes/backups';
import timetable from './routes/timetable';
import offlineAttendance from './routes/offlineAttendance';
import analytics from './routes/analytics';
import communication from './routes/communication';
import production from './routes/production';
import parentOnboarding from './routes/parentOnboarding';
import finalIntegration from './routes/finalIntegration';
import student from './routes/student';
import reviews from './routes/reviews';
import calendar from './routes/calendar';

const app = express();

const allowedOrigin =
  env.corsOrigin === '*'
    ? true
    : env.corsOrigin.includes(',')
      ? env.corsOrigin.split(',').map((s) => s.trim())
      : env.corsOrigin;

app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(express.json());

// Root health probe for cloud platform monitors (Render / Railway / Kubernetes)
app.get('/health', (_q, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// Static brand assets (AttendoSchool logo for live email previews & direct assets)
const backendAssetsDir = path.resolve(__dirname, '../assets');
const frontendPublicDir = path.resolve(__dirname, '../../frontend/public');
app.use('/assets', express.static(backendAssetsDir));
app.get('/attendo-school-logo.png', (_req, res) => {
  const localLogo = path.join(backendAssetsDir, 'attendo-school-logo.png');
  const frontendLogo = path.join(frontendPublicDir, 'attendo-school-logo.png');
  if (fs.existsSync(localLogo)) {
    return res.sendFile(localLogo);
  } else if (fs.existsSync(frontendLogo)) {
    return res.sendFile(frontendLogo);
  }
  res.status(404).send('Logo not found');
});

// Public integration endpoints
app.use('/api/parent-onboarding', parentOnboarding);
app.use('/api/parent-onboarding-v27', parentOnboarding);
app.use('/api/final-integration', finalIntegration);
app.use('/api/final-v28', finalIntegration);
app.use('/api/production', production);
app.use('/api/production-v26', production);

// Global security middleware
app.use(securityHeaders);
app.use(requestContext);
app.use(apiRateLimit);

// Authenticated operational routes (mounted on clean paths + backward-compatible aliases)
app.use('/api/communication', requireAuth, communication);
app.use('/api/communication-v25', requireAuth, communication);

app.use('/api/analytics', requireAuth, analytics);
app.use('/api/analytics-v24', requireAuth, analytics);

app.use('/api/offline-attendance', requireAuth, offlineAttendance);
app.use('/api/offline-attendance-v23', requireAuth, offlineAttendance);

app.use('/api/timetable', requireAuth, timetable);
app.use('/api/timetable-v22', requireAuth, timetable);

app.use('/api/backups', requireAuth, backups);
app.use('/api/backups-v21', requireAuth, backups);

app.use('/api/security', requireAuth, security);
app.use('/api/security-v20', requireAuth, security);

app.use('/api/subscriptions', requireAuth, subscriptions);
app.use('/api/subscriptions-v19', requireAuth, subscriptions);

app.use('/api/permissions', requireAuth, permissions);
app.use('/api/permissions-v18', requireAuth, permissions);

app.use('/api/parent-portal', requireAuth, parentPortal);
app.use('/api/parent-portal-v17', requireAuth, parentPortal);

app.use('/api/student-promotions', requireAuth, studentPromotions);
app.use('/api/student-promotions-v16', requireAuth, studentPromotions);

app.use('/api/academic-years', requireAuth, academicYears);
app.use('/api/academic-years-v15', requireAuth, academicYears);

app.use('/api/people', requireAuth, peopleManagement);
app.use('/api/people-v14', requireAuth, peopleManagement);

app.use('/api/attendance-corrections', requireAuth, attendanceCorrections);
app.use('/api/attendance-corrections-v13', requireAuth, attendanceCorrections);

app.use('/api/attendance-reports', requireAuth, attendanceReports);
app.use('/api/attendance-reports-v12', requireAuth, attendanceReports);

app.use('/api/calendar', requireAuth, calendar);

// Info endpoints
app.get('/', (_q, res) => res.json({
  name: 'School Attendance SaaS Backend API',
  version: 'production',
  status: 'running',
  frontendUrl: 'http://localhost:5173',
  endpoints: {
    baseApi: '/api',
    health: '/api/health',
    productionHealth: '/api/production/health',
    ready: '/api/production/ready',
    dbCheck: '/api/final-integration/db-check'
  }
}));

app.get('/api', (_q, res) => res.json({ name: 'School Attendance SaaS API', version: 'production' }));

// Core routes
app.use('/api/health', health);
app.use('/api/auth', auth);
app.use('/api/dashboard', dashboard);
app.use('/api/super-admin', superAdmin);
app.use('/api/super-admin', superAdminOperations);
app.use('/api/super-admin', payment);
app.use('/api/invoices', invoices);
app.use('/api/notifications-channels', notificationChannels);
app.use('/api/notification-channels', notificationChannels);
app.use('/api/notifications-v11', notificationChannels);
app.use('/api/school-payment', schoolPayment);
app.use('/api/webhooks', razorpayWebhook);
app.use('/api/school-payment', razorpaySchool);
app.use('/api', schoolData);
app.use('/api/routines', routines);
app.use('/api/teacher', teacher);
app.use('/api/attendance', teacher);
app.use('/api/notifications', notifications);
app.use('/api/student', student);
app.use('/api/reviews', requireAuth, reviews);

// 404 handler
app.use((_q, res) => res.status(404).json({ message: 'API route not found' }));

// Centralized error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled server error:', err);
  const status = Number(err.status || err.statusCode || 500);
  res.status(status).json({
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
  });
});

export default app;
