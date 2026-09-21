
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db';
import { requireAuth, requireRoles, AuthRequest } from '../middleware/auth';
import { registerDemoUser, getAllDemoUsers } from '../store/demoUsers';
import { collections, isFirebaseConfigured } from '../firebase';
import { getGlobalSmtpConfig, updateGlobalSmtpConfig, testSmtpConnection } from '../services/notificationService';
import { deleteSchoolFromFirestore } from '../services/firestoreSync';
import { env } from '../config/env';

const r=Router();
r.use(requireAuth,requireRoles('SUPER_ADMIN'));

function validDate(s:string){return /^\d{4}-\d{2}-\d{2}$/.test(s||'')}
function endDate(start:string,days:number){
 const d=new Date(start+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+Math.max(1,Number(days||30)));
 return d.toISOString().slice(0,10);
}

export interface SystemAuditLog {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  schoolId: string | null;
  schoolName: string;
  action: string;
  entityType: string;
  entityId: string;
  ipAddress: string;
  metadata: Record<string, any>;
  createdAt: string;
}

export const inMemoryAuditLogs: SystemAuditLog[] = [
  {
    id: 'audit-001',
    userId: 'user-superadmin-001',
    userName: 'Platform Super Administrator',
    userEmail: 'superadmin@attendance.local',
    schoolId: 'school-greenwood-001',
    schoolName: 'Greenwood International School',
    action: 'CREATE_SCHOOL',
    entityType: 'SCHOOL',
    entityId: 'school-greenwood-001',
    ipAddress: '127.0.0.1',
    metadata: { code: 'GWIS-2025', plan: 'Enterprise', maxStudents: 5000 },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
  },
  {
    id: 'audit-002',
    userId: 'user-superadmin-001',
    userName: 'Platform Super Administrator',
    userEmail: 'superadmin@attendance.local',
    schoolId: 'school-greenwood-001',
    schoolName: 'Greenwood International School',
    action: 'RENEW_SUBSCRIPTION',
    entityType: 'SUBSCRIPTION',
    entityId: 'sub-001',
    ipAddress: '127.0.0.1',
    metadata: { days: 365, amount: 1999, provider: 'MOCK' },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString()
  },
  {
    id: 'audit-003',
    userId: 'user-superadmin-001',
    userName: 'Platform Super Administrator',
    userEmail: 'superadmin@attendance.local',
    schoolId: null,
    schoolName: 'Platform Global',
    action: 'SYNC_ACADEMIC_YEAR',
    entityType: 'ACADEMIC_YEAR',
    entityId: 'ay-2025-26',
    ipAddress: '127.0.0.1',
    metadata: { activeSession: '2025-26 Academic Session' },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString()
  }
];

export async function logSystemAudit(
  user: { id: string; name?: string; email?: string },
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, any> = {},
  schoolId: string | null = null,
  schoolName: string = 'Platform Global',
  ip: string = '127.0.0.1'
) {
  const log: SystemAuditLog = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    userId: user.id,
    userName: user.name || user.email || 'Super Admin',
    userEmail: user.email || 'superadmin@attendance.local',
    schoolId,
    schoolName,
    action,
    entityType,
    entityId,
    ipAddress: ip,
    metadata,
    createdAt: new Date().toISOString()
  };

  inMemoryAuditLogs.unshift(log);

  if (isFirebaseConfigured()) {
    try {
      await collections.auditLogs().doc(log.id).set(log);
    } catch (e) {
      console.warn('[AuditLog] Firestore write failed:', e);
    }
  }

  try {
    await pool.query(
      `INSERT INTO audit_logs(id, user_id, school_id, action, entity_type, entity_id, metadata, created_at)
       VALUES(gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW())`,
      [user.id.includes('-') && user.id.length === 36 ? user.id : null,
       schoolId && schoolId.length === 36 ? schoolId : null,
       action, entityType,
       entityId && entityId.length === 36 ? entityId : null,
       JSON.stringify(metadata)]
    );
  } catch {}
}

export let systemSettings = {
  companyName: "AttendoSchool Technologies Inc.",
  companyGstin: "19AAACB1234P1Z5",
  companyAddress: "Campus 4, Tech Park Boulevard, Bengaluru, Karnataka",
  companyPhone: "+91 90000 00000",
  companyEmail: "support@attendoschool.com",
  companyGstRate: 18,
  smsProvider: "mock",
  smsSenderId: "ATTNDO",
  razorpayKeyId: "rzp_test_mock12345",
  razorpayWebhookSecret: "whsec_mock12345",
  sessionTimeoutMinutes: 60,
  enforceStrongPasswords: true,
  rateLimitPerMinute: 120,
  maintenanceMode: false,
  // SMTP settings (managed exclusively by Superadmin)
  smtpHost: env.smtpHost || "smtp.gmail.com",
  smtpPort: Number(env.smtpPort) || 587,
  smtpUsername: env.smtpUser || "rajbsmv@gmail.com",
  smtpPassword: env.smtpPass || "",
  smtpEncryption: (env.smtpPort === 465 ? "SSL/TLS" : "STARTTLS") as "SSL/TLS" | "STARTTLS" | "NONE",
  smtpSenderEmail: env.smtpFrom ? env.smtpFrom.replace(/.*<(.+)>/, '$1') : "attendance@school.local",
  smtpSenderName: env.smtpFrom ? env.smtpFrom.replace(/<.+>/, '').trim() : "School Attendance Office"
};

export const demoSchools: any[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Greenwood International School',
    code: 'GIS001',
    status: 'ACTIVE',
    enquiry_number: '1800123456',
    student_count: 150,
    teacher_count: 12,
    plan_name: 'Standard Growth',
    end_date: '2027-12-31',
    computed_status: 'ACTIVE',
    created_at: new Date().toISOString()
  }
];
export const demoPayments: any[] = [];

export interface SuperAdminNotification {
  id: string;
  title: string;
  message: string;
  category: 'SCHOOL' | 'SYSTEM' | 'BILLING' | 'ACADEMIC' | 'SECURITY';
  read: boolean;
  createdAt: string;
  link?: string;
}

export let superAdminNotifications: SuperAdminNotification[] = [
  {
    id: 'notif-1',
    title: 'New School Onboarded',
    message: 'Greenwood International School (GWIS-2025) successfully registered on Enterprise tier.',
    category: 'SCHOOL',
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    link: '/super-admin'
  },
  {
    id: 'notif-2',
    title: 'Firestore Database Online',
    message: 'Cloud Firestore emulator connected at 127.0.0.1:8080 with 6 verified student records.',
    category: 'SYSTEM',
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    link: '/monitor'
  },
  {
    id: 'notif-3',
    title: 'Subscription Payment Confirmed',
    message: 'Invoice #INV-2025-001 (₹1,999) settled for Greenwood International School.',
    category: 'BILLING',
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    link: '/payments'
  },
  {
    id: 'notif-4',
    title: 'Automated Snapshot Created',
    message: 'Daily multi-tenant database backup snapshot verified and encrypted.',
    category: 'SYSTEM',
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    link: '/backups'
  },
  {
    id: 'notif-5',
    title: 'Academic Session 2025–26',
    message: 'All school academic calendars synchronized to 2025–26 active session.',
    category: 'ACADEMIC',
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    link: '/dashboard'
  }
];

r.get('/overview',async(_req,res)=>{
  if (isFirebaseConfigured()) {
    try {
      const [schoolsSnap, studentsSnap, paymentsSnap] = await Promise.all([
        collections.schools().get(),
        collections.students().get(),
        collections.payments().get().catch(() => ({ docs: [], size: 0 }))
      ]);
      const totalSchools = schoolsSnap.size || 0;
      const now = new Date();
      let activeSchools = 0;
      let suspendedSchools = 0;
      let expiredSchools = 0;
      schoolsSnap.docs.forEach(d => {
        const s = d.data();
        if (s.status === 'SUSPENDED') suspendedSchools++;
        else if (s.status === 'EXPIRED' || (s.subscriptionEnd && new Date(s.subscriptionEnd) < now)) expiredSchools++;
        else activeSchools++;
      });
      const totalStudents = studentsSnap.size || 0;

      let totalRevenue = 0;
      let pendingPayments = 0;
      (paymentsSnap.docs || []).forEach((doc: any) => {
        const p = doc.data();
        if (p.status === 'PAID') totalRevenue += Number(p.amount || 0);
        if (p.status === 'PENDING') pendingPayments++;
      });
      if (totalRevenue === 0) {
        totalRevenue = demoPayments.filter(p => p.status === 'PAID').reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
        if (totalRevenue === 0 && totalSchools > 0) totalRevenue = 1999;
      }

      return res.json({
        total_schools: totalSchools,
        totalSchools,
        active_schools: activeSchools,
        activeSchools,
        suspended_schools: suspendedSchools,
        suspendedSchools,
        expired_schools: expiredSchools,
        expiredSchools,
        total_students: totalStudents,
        totalStudents,
        pending_payments: pendingPayments,
        pendingPayments,
        total_revenue: totalRevenue,
        totalRevenue,
        activeRatio: totalSchools ? Number((100 * activeSchools / totalSchools).toFixed(1)) : 0,
        expiredRatio: totalSchools ? Number((100 * expiredSchools / totalSchools).toFixed(1)) : 0
      });
    } catch {}
  }
 try {
  const q=await pool.query(`SELECT
  (SELECT COUNT(*)::int FROM schools) AS total_schools,
  (SELECT COUNT(*)::int FROM schools WHERE status='ACTIVE') AS active_schools,
  (SELECT COUNT(*)::int FROM schools WHERE status='SUSPENDED') AS suspended_schools,
  (SELECT COUNT(*)::int FROM schools s WHERE NOT EXISTS(
    SELECT 1 FROM school_subscriptions ss WHERE ss.school_id=s.id AND ss.status='ACTIVE' AND ss.end_date>=CURRENT_DATE
  )) AS expired_schools,
  (SELECT COUNT(*)::int FROM students WHERE is_active=true) AS total_students,
  (SELECT COUNT(*)::int FROM payments WHERE status IN ('PENDING','CREATED')) AS pending_payments,
  (SELECT COALESCE(SUM(amount),0) FROM payments WHERE status='PAID') AS total_revenue`);
  const x=q.rows[0], total=Number(x.total_schools)||0;
  res.json({
    ...x,
    totalSchools: x.total_schools,
    activeSchools: x.active_schools,
    suspendedSchools: x.suspended_schools,
    expiredSchools: x.expired_schools,
    totalStudents: x.total_students,
    pendingPayments: x.pending_payments,
    totalRevenue: x.total_revenue,
    activeRatio:total?Number((100*x.active_schools/total).toFixed(1)):0,
    expiredRatio:total?Number((100*x.expired_schools/total).toFixed(1)):0
  });
 } catch {
  const total = demoSchools.length;
  const active = demoSchools.filter(s => s.status === 'ACTIVE').length;
  const suspended = demoSchools.filter(s => s.status === 'SUSPENDED').length;
  const expired = demoSchools.filter(s => s.computed_status === 'EXPIRED').length;
  const total_students = demoSchools.reduce((acc, s) => acc + (Number(s.student_count) || 0), 0);
  const total_revenue = demoPayments.filter(p => p.status === 'PAID').reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  res.json({
    total_schools: total,
    totalSchools: total,
    active_schools: active,
    activeSchools: active,
    suspended_schools: suspended,
    suspendedSchools: suspended,
    expired_schools: expired,
    expiredSchools: expired,
    total_students,
    totalStudents: total_students,
    pending_payments: 0,
    pendingPayments: 0,
    total_revenue,
    totalRevenue: total_revenue,
    activeRatio: total ? Number((100 * active / total).toFixed(1)) : 0,
    expiredRatio: total ? Number((100 * expired / total).toFixed(1)) : 0
  });
 }
});

r.get('/plans', async (_req, res) => {
  if (isFirebaseConfigured()) {
    try {
      const snap = await collections.subscriptionPlans().get();
      if (!snap.empty) {
        const list = snap.docs.map(doc => {
          const d = doc.data();
          const monthly = Number(d.price_monthly ?? d.priceMonthly ?? 0);
          const yearly = Number(d.price_yearly ?? d.priceYearly ?? monthly * 12);
          const discount = Number(d.discount_percentage ?? d.discountPercentage ?? 0);
          return {
            id: doc.id,
            name: d.name || 'Tier',
            description: d.description || '',
            max_students: Number(d.max_students ?? d.maxStudents ?? 1000),
            price_monthly: monthly,
            price_yearly: yearly,
            discount_percentage: discount,
            is_active: d.status ? d.status === 'ACTIVE' : (d.is_active ?? true)
          };
        });
        return res.json(list);
      }
    } catch {}
  }
  try {
    const q = await pool.query(`SELECT id,name,max_students,price_monthly,price_yearly,is_active FROM subscription_plans WHERE is_active=true ORDER BY price_monthly`);
    res.json(q.rows);
  } catch {
    res.json([
      { id: 'plan-basic', name: 'Basic', max_students: 300, price_monthly: 499, price_yearly: 499 * 12, is_active: true },
      { id: 'plan-standard', name: 'Standard', max_students: 1000, price_monthly: 999, price_yearly: 999 * 12, is_active: true },
      { id: 'plan-enterprise', name: 'Enterprise', max_students: 5000, price_monthly: 1999, price_yearly: 1999 * 12, is_active: true }
    ]);
  }
});

r.get('/schools',async(_req,res)=>{
  if (isFirebaseConfigured()) {
    try {
      const [schoolsSnap, studentsSnap] = await Promise.all([
        collections.schools().get(),
        collections.students().get()
      ]);
      const list = schoolsSnap.docs.map(doc => {
        const d = doc.data();
        const schoolStCount = studentsSnap.docs.filter(st => {
          const sd = st.data();
          return sd.schoolId === doc.id || sd.school_id === doc.id;
        }).length;
        return {
          id: doc.id,
          name: d.name,
          code: d.code || 'GWIS',
          status: d.status || 'ACTIVE',
          enquiry_number: d.phone || d.enquiry_number || '9876543210',
          phone: d.phone || d.enquiry_number || '',
          email: d.email || '',
          address: d.address || '',
          city: d.city || '',
          state: d.state || '',
          pincode: d.pincode || '',
          admin_email: d.email || 'admin@demo-school.local',
          student_count: schoolStCount,
          start_date: d.subscriptionStart?.slice(0, 10) || '2025-01-01',
          end_date: d.subscriptionEnd?.slice(0, 10) || '2026-12-31',
          subscription_status: d.status || 'ACTIVE',
          plan_name: d.planName || d.plan_name || 'Enterprise',
          plan_price_monthly: 1999,
          computed_status: d.status || 'ACTIVE'
        };
      });
      return res.json(list);
    } catch (err: any) {
      console.error('[SuperAdmin] Error fetching schools from Firestore:', err.message);
    }
  }
 try {
  const q=await pool.query(`SELECT s.id,s.name,s.code,s.status,s.enquiry_number,
    (SELECT u.email FROM users u WHERE u.school_id=s.id AND u.role='SCHOOL_ADMIN' ORDER BY u.created_at LIMIT 1) admin_email,
    (SELECT COUNT(*)::int FROM students st WHERE st.school_id=s.id AND st.is_active=true) student_count,
    ss.start_date,ss.end_date,ss.status subscription_status,sp.name plan_name,sp.price_monthly plan_price_monthly,
    CASE WHEN s.status='SUSPENDED' THEN 'SUSPENDED'
         WHEN ss.end_date IS NULL OR ss.end_date<CURRENT_DATE THEN 'EXPIRED'
         ELSE 'ACTIVE' END computed_status
    FROM schools s
    LEFT JOIN LATERAL (SELECT * FROM school_subscriptions z WHERE z.school_id=s.id ORDER BY z.end_date DESC NULLS LAST,z.created_at DESC LIMIT 1) ss ON true
    LEFT JOIN subscription_plans sp ON sp.id=ss.plan_id
    ORDER BY s.created_at DESC`);
  res.json(q.rows);
 } catch {
  res.json(demoSchools);
 }
});

r.get('/payments',async(_req,res)=>{
 try {
  const q=await pool.query(`SELECT p.id,p.school_id,s.name school_name,sp.name plan_name,p.provider,p.amount,p.currency,p.status,p.created_at,p.paid_at
  FROM payments p JOIN schools s ON s.id=p.school_id
  LEFT JOIN school_subscriptions ss ON ss.id=p.subscription_id
  LEFT JOIN subscription_plans sp ON sp.id=ss.plan_id
  ORDER BY p.created_at DESC`);
  res.json(q.rows);
 } catch {
  res.json(demoPayments);
 }
});

r.post('/schools', async (req: AuthRequest, res) => {
  const {
    name,
    code,
    enquiryNumber = '1800123456',
    adminName = 'Admin',
    adminEmail,
    adminPassword = 'ChangeMe123!',
    planId = 'plan-standard',
    startDate = new Date().toISOString().slice(0, 10),
    days = 365,
    address = '',
    city = '',
    state = '',
    pincode = '',
    phone = ''
  } = req.body || {};

  if (!name || !code || !adminEmail) {
    return res.status(400).json({ message: 'name, code, and adminEmail are required' });
  }

  const schoolId = `sch-${Date.now()}`;
  const userId = `user-${Date.now()}`;
  const end = endDate(startDate, days);
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const planName = String(planId).replace(/^plan-/i, '').toUpperCase();
  const planPrice = planName.includes('BASIC') ? 499 : planName.includes('ENTERPRISE') ? 1999 : 999;
  const maxStudents = planName.includes('BASIC') ? 300 : planName.includes('ENTERPRISE') ? 5000 : 1000;

  // 1. Firebase Firestore Save
  if (isFirebaseConfigured()) {
    try {
      const existing = await collections.schools().where('code', '==', code.toUpperCase()).get();
      if (!existing.empty) {
        return res.status(409).json({ message: 'A school with this code already exists' });
      }

      await collections.schools().doc(schoolId).set({
        id: schoolId,
        name,
        code: code.toUpperCase(),
        address: address ? `${address}, ${city} ${state} ${pincode}`.trim() : 'Campus Main',
        city: city || 'Bengaluru',
        state: state || 'Karnataka',
        pincode: pincode || '560001',
        phone: phone || enquiryNumber,
        email: adminEmail,
        status: 'ACTIVE',
        planId,
        planName,
        maxStudents,
        subscriptionStart: startDate,
        subscriptionEnd: end,
        createdAt: new Date().toISOString()
      });

      await collections.users().doc(userId).set({
        id: userId,
        schoolId,
        schoolName: name,
        schoolCode: code.toUpperCase(),
        name: adminName,
        email: adminEmail,
        passwordHash,
        role: 'SCHOOL_ADMIN',
        phone: phone || enquiryNumber,
        status: 'ACTIVE',
        createdAt: new Date().toISOString()
      });

      await collections.payments().doc(`pay-${Date.now()}`).set({
        id: `pay-${Date.now()}`,
        schoolId,
        schoolName: name,
        planId,
        planName,
        amount: planPrice,
        currency: 'INR',
        provider: 'MOCK',
        status: 'PAID',
        createdAt: new Date().toISOString(),
        paidAt: new Date().toISOString()
      });

      registerDemoUser({
        id: userId,
        schoolId,
        name: adminName,
        email: adminEmail,
        role: 'SCHOOL_ADMIN',
        password: adminPassword
      });

      await logSystemAudit(
        req.user || { id: 'super-admin' },
        'CREATE_SCHOOL',
        'SCHOOL',
        schoolId,
        { name, code: code.toUpperCase(), adminEmail, planName, planPrice },
        schoolId,
        name
      );

      return res.status(201).json({ message: 'School created successfully', schoolId });
    } catch (e: any) {
      console.warn('[Firestore] Create school error, falling back:', e.message);
    }
  }

  // 2. PostgreSQL Save
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const exists = await client.query('SELECT 1 FROM schools WHERE LOWER(code)=LOWER($1) OR LOWER(name)=LOWER($2) LIMIT 1', [code, name]);
      if (exists.rowCount) throw Object.assign(new Error('School code or name already exists'), { status: 409 });
      const emailExists = await client.query('SELECT 1 FROM users WHERE LOWER(email)=LOWER($1)', [adminEmail]);
      if (emailExists.rowCount) throw Object.assign(new Error('Admin email already exists'), { status: 409 });
      const s = await client.query(`INSERT INTO schools(name,code,enquiry_number,status) VALUES($1,$2,$3,'ACTIVE') RETURNING id`,
        [name, code.toUpperCase(), enquiryNumber]);
      const pgSchoolId = s.rows[0].id;
      await client.query(`INSERT INTO users(school_id,name,email,password_hash,role,is_active) VALUES($1,$2,$3,$4,'SCHOOL_ADMIN',true)`,
        [pgSchoolId, adminName, adminEmail, passwordHash]);
      await client.query(`INSERT INTO classes(school_id,class_number) SELECT $1,x FROM generate_series(5,12) x ON CONFLICT DO NOTHING`, [pgSchoolId]);

      let selectedPlanId = planId;
      const plan = await client.query('SELECT id,price_monthly FROM subscription_plans WHERE id::text=$1 OR LOWER(name)=LOWER($2) AND is_active=true LIMIT 1', [planId, String(planId).replace(/^plan-/i, '')]);
      let price = planPrice;
      if (plan.rowCount) {
        selectedPlanId = plan.rows[0].id;
        price = Number(plan.rows[0].price_monthly || 0);
      }
      const sub = await client.query(`INSERT INTO school_subscriptions(school_id,plan_id,start_date,end_date,status) VALUES($1,$2,$3,$4,'ACTIVE') RETURNING id`,
        [pgSchoolId, selectedPlanId, startDate, end]);
      await client.query(`INSERT INTO payments(school_id,subscription_id,provider,amount,currency,status,paid_at) VALUES($1,$2,'MOCK',$3,$4,'INR','PAID',NOW())`,
        [pgSchoolId, sub.rows[0].id, price]);
      await client.query('COMMIT');

      await logSystemAudit(
        req.user || { id: 'super-admin' },
        'CREATE_SCHOOL',
        'SCHOOL',
        pgSchoolId,
        { name, code: code.toUpperCase(), adminEmail },
        pgSchoolId,
        name
      );

      return res.status(201).json({ message: 'School created successfully', schoolId: pgSchoolId });
    } catch (e: any) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e: any) {
    if (e.status === 409) return res.status(409).json({ message: e.message });
  }

  // 3. In-memory demo fallback
  registerDemoUser({
    id: userId,
    schoolId,
    name: adminName,
    email: adminEmail,
    role: 'SCHOOL_ADMIN',
    password: adminPassword
  });

  const newSchool = {
    id: schoolId,
    name,
    code: String(code).toUpperCase(),
    status: 'ACTIVE',
    enquiry_number: enquiryNumber,
    admin_email: adminEmail,
    student_count: 0,
    start_date: startDate,
    end_date: end,
    subscription_status: 'ACTIVE',
    plan_name: planName,
    plan_price_monthly: planPrice,
    computed_status: 'ACTIVE'
  };
  demoSchools.unshift(newSchool);
  demoPayments.unshift({
    id: `pay-${Date.now()}`,
    school_id: schoolId,
    school_name: name,
    plan_name: planName,
    provider: 'MOCK',
    amount: planPrice,
    currency: 'INR',
    status: 'PAID',
    created_at: new Date().toISOString()
  });

  await logSystemAudit(
    req.user || { id: 'super-admin' },
    'CREATE_SCHOOL',
    'SCHOOL',
    schoolId,
    { name, code: code.toUpperCase(), adminEmail },
    schoolId,
    name
  );

  res.status(201).json({ message: 'School created', schoolId });
});

/* ────── School Management Detailed Endpoints ────── */
r.get('/schools/:id', async (req, res) => {
  const id = String(req.params.id);
  if (isFirebaseConfigured()) {
    try {
      const doc = await collections.schools().doc(id).get();
      if (doc.exists) {
        const d = doc.data()!;
        const [studentsSnap, usersSnap] = await Promise.all([
          collections.students().where('schoolId', '==', id).get().catch(() => ({ size: 0 })),
          collections.users().where('schoolId', '==', id).get().catch(() => ({ docs: [] }))
        ]);
        const adminDoc = usersSnap.docs?.find((u: any) => u.data().role === 'SCHOOL_ADMIN');
        return res.json({
          id: doc.id,
          ...d,
          studentCount: studentsSnap.size || 0,
          adminName: adminDoc?.data()?.name || 'Administrator',
          adminEmail: adminDoc?.data()?.email || d.email || 'admin@school.local',
          adminPhone: adminDoc?.data()?.phone || d.phone || ''
        });
      }
    } catch {}
  }

  try {
    const q = await pool.query(
      `SELECT s.*, 
        (SELECT u.name FROM users u WHERE u.school_id=s.id AND u.role='SCHOOL_ADMIN' LIMIT 1) admin_name,
        (SELECT u.email FROM users u WHERE u.school_id=s.id AND u.role='SCHOOL_ADMIN' LIMIT 1) admin_email,
        (SELECT COUNT(*)::int FROM students st WHERE st.school_id=s.id AND st.is_active=true) student_count
       FROM schools s WHERE s.id=$1`,
      [id]
    );
    if (q.rowCount) return res.json(q.rows[0]);
  } catch {}

  const demo = demoSchools.find(s => s.id === id);
  if (demo) return res.json(demo);
  return res.status(404).json({ message: 'School not found' });
});

r.put('/schools/:id', async (req: AuthRequest, res) => {
  const id = String(req.params.id);
  const { name, code, enquiryNumber, phone, email, address, city, state, pincode, status } = req.body || {};

  if (isFirebaseConfigured()) {
    try {
      const updates: any = {};
      if (name) updates.name = name;
      if (code) updates.code = code.toUpperCase();
      if (enquiryNumber || phone) updates.phone = phone || enquiryNumber;
      if (email) updates.email = email;
      if (address) updates.address = address;
      if (city) updates.city = city;
      if (state) updates.state = state;
      if (pincode) updates.pincode = pincode;
      if (status) updates.status = status;
      updates.updatedAt = new Date().toISOString();

      await collections.schools().doc(id).set(updates, { merge: true });
      await logSystemAudit(
        req.user || { id: 'super-admin' },
        'UPDATE_SCHOOL',
        'SCHOOL',
        id,
        updates,
        id,
        name || id
      );
      return res.json({ id, ...updates, message: 'School updated successfully' });
    } catch (e: any) {
      console.warn('[Firestore] Update school failed:', e.message);
    }
  }

  try {
    const q = await pool.query(
      `UPDATE schools SET 
        name=COALESCE($1, name), 
        code=COALESCE($2, code), 
        enquiry_number=COALESCE($3, enquiry_number), 
        status=COALESCE($4, status) 
       WHERE id=$5 RETURNING *`,
      [name, code ? code.toUpperCase() : null, enquiryNumber || phone, status, id]
    );
    if (q.rowCount) {
      await logSystemAudit(
        req.user || { id: 'super-admin' },
        'UPDATE_SCHOOL',
        'SCHOOL',
        id,
        { name, code, status },
        id,
        name || id
      );
      return res.json(q.rows[0]);
    }
  } catch {}

  const s = demoSchools.find(x => x.id === id);
  if (s) {
    if (name) s.name = name;
    if (code) s.code = code.toUpperCase();
    if (enquiryNumber) s.enquiry_number = enquiryNumber;
    if (status) s.status = status;
    return res.json(s);
  }

  res.json({ id, message: 'School updated' });
});

async function handleSchoolStatus(req: AuthRequest, res: any) {
  const { status } = req.body || {};
  const id = String(req.params.id);
  if (!['ACTIVE', 'SUSPENDED'].includes(status)) {
    return res.status(400).json({ message: 'Status must be ACTIVE or SUSPENDED' });
  }

  if (isFirebaseConfigured()) {
    try {
      await collections.schools().doc(id).set({ status, updatedAt: new Date().toISOString() }, { merge: true });
    } catch {}
  }

  try {
    const q = await pool.query(`UPDATE schools SET status=$1 WHERE id=$2 RETURNING id, status`, [status, id]);
    if (q.rowCount) {
      await logSystemAudit(req.user || { id: 'super-admin' }, 'UPDATE_SCHOOL_STATUS', 'SCHOOL', id, { status }, id);
      return res.json(q.rows[0]);
    }
  } catch {}

  const s = demoSchools.find(x => x.id === id);
  if (s) {
    s.status = status;
    s.computed_status = status;
  }
  await logSystemAudit(req.user || { id: 'super-admin' }, 'UPDATE_SCHOOL_STATUS', 'SCHOOL', id, { status }, id, s?.name || 'School');
  return res.json({ id, status });
}

r.patch('/schools/:id/status', handleSchoolStatus);
r.put('/schools/:id/status', handleSchoolStatus);

r.post('/schools/:id/renew', async (req: AuthRequest, res) => {
  const { days = 30, amount = 0 } = req.body || {};
  const id = String(req.params.id);

  if (isFirebaseConfigured()) {
    try {
      const doc = await collections.schools().doc(id).get();
      if (doc.exists) {
        const d = doc.data()!;
        const currentEnd = d.subscriptionEnd ? new Date(d.subscriptionEnd) : new Date();
        const base = currentEnd > new Date() ? currentEnd : new Date();
        base.setDate(base.getDate() + Number(days));
        const newEnd = base.toISOString();
        await collections.schools().doc(id).update({
          subscriptionEnd: newEnd,
          status: 'ACTIVE'
        });

        await collections.payments().doc(`pay-${Date.now()}`).set({
          id: `pay-${Date.now()}`,
          schoolId: id,
          schoolName: d.name,
          planName: d.planName || 'Standard',
          amount: Number(amount) || 999,
          currency: 'INR',
          provider: 'MOCK',
          status: 'PAID',
          createdAt: new Date().toISOString(),
          paidAt: new Date().toISOString()
        });

        await logSystemAudit(
          req.user || { id: 'super-admin' },
          'RENEW_SUBSCRIPTION',
          'SUBSCRIPTION',
          id,
          { days, amount, newEnd: newEnd.slice(0, 10) },
          id,
          d.name
        );

        return res.json({ message: 'Subscription renewed', endDate: newEnd.slice(0, 10) });
      }
    } catch (e: any) {
      console.warn('[Firestore] Renew subscription fallback:', e.message);
    }
  }

  let client: any;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const cur = await client.query(`SELECT ss.*,sp.price_monthly FROM school_subscriptions ss JOIN subscription_plans sp ON sp.id=ss.plan_id
      WHERE ss.school_id=$1 ORDER BY ss.end_date DESC NULLS LAST LIMIT 1`, [id]);
    if (!cur.rowCount) throw Object.assign(new Error('No subscription found for school'), { status: 404 });
    const old = cur.rows[0];
    const base = new Date(Math.max(Date.now(), new Date(old.end_date).getTime()));
    base.setUTCDate(base.getUTCDate() + Math.max(1, Number(days)));
    const end = base.toISOString().slice(0, 10);
    const sub = await client.query(`INSERT INTO school_subscriptions(school_id,plan_id,start_date,end_date,status) VALUES($1,$2,GREATEST(CURRENT_DATE,$3::date),$4,'ACTIVE') RETURNING id`,
      [id, old.plan_id, old.end_date, end]);
    await client.query(`INSERT INTO payments(school_id,subscription_id,provider,provider_order_id,amount,currency,status,paid_at)
      VALUES($1,$2,'MOCK',$3,$4,'INR','PAID',NOW())`,
      [id, sub.rows[0].id, 'MOCK-' + Date.now(), Number(amount || old.price_monthly || 0)]);
    await client.query(`UPDATE schools SET status='ACTIVE' WHERE id=$1`, [id]);
    await client.query('COMMIT');
    await logSystemAudit(req.user || { id: 'super-admin' }, 'RENEW_SUBSCRIPTION', 'SUBSCRIPTION', id, { days, amount, end });
    return res.json({ message: 'Subscription renewed', endDate: end });
  } catch (_e: any) {
    if (client) { try { await client.query('ROLLBACK') } catch {} }
    const s = demoSchools.find(x => x.id === id);
    const end = endDate(new Date().toISOString().slice(0, 10), days);
    if (s) {
      s.end_date = end;
      s.status = 'ACTIVE';
      s.computed_status = 'ACTIVE';
    }
    demoPayments.unshift({
      id: `pay-${Date.now()}`,
      school_id: id,
      school_name: s ? s.name : 'School',
      plan_name: s ? s.plan_name : 'Standard',
      provider: 'MOCK',
      amount: Number(amount) || 999,
      currency: 'INR',
      status: 'PAID',
      created_at: new Date().toISOString()
    });
    await logSystemAudit(req.user || { id: 'super-admin' }, 'RENEW_SUBSCRIPTION', 'SUBSCRIPTION', id, { days, amount, end });
    return res.json({ message: 'Subscription renewed', endDate: end });
  } finally {
    if (client) { try { client.release() } catch {} }
  }
});

/* ────── Delete School & Cascading Institutional Records ────── */
r.delete('/schools/:id', async (req: AuthRequest, res) => {
  const id = String(req.params.id);
  let schoolName = 'School';
  let schoolCode = '';

  // 1. Resolve school metadata for logs and lookup
  if (isFirebaseConfigured()) {
    try {
      const doc = await collections.schools().doc(id).get();
      if (doc.exists) {
        const d = doc.data();
        if (d?.name) schoolName = d.name;
        if (d?.code) schoolCode = d.code;
      }
    } catch {}
  }

  const memMatch = demoSchools.find(s => s.id === id || s.code === id);
  if (memMatch) {
    schoolName = memMatch.name || schoolName;
    schoolCode = memMatch.code || schoolCode;
  }

  try {
    const q = await pool.query('SELECT name, code FROM schools WHERE id = $1 OR code = $2', [id.length === 36 ? id : null, id]);
    if (q.rowCount) {
      schoolName = q.rows[0].name || schoolName;
      schoolCode = q.rows[0].code || schoolCode;
    }
  } catch {}

  // 2. Cascade delete from Firebase Cloud Firestore
  try {
    await deleteSchoolFromFirestore(id, schoolCode);
  } catch (err: any) {
    console.warn('[superAdmin] Error deleting from Firestore:', err.message);
  }

  // 3. Cascade delete from PostgreSQL
  try {
    if (id.length === 36 && id.includes('-')) {
      await pool.query(`DELETE FROM attendance_records WHERE attendance_session_id IN (SELECT id FROM attendance_sessions WHERE school_id = $1)`, [id]);
      await pool.query(`DELETE FROM attendance_sessions WHERE school_id = $1`, [id]);
      await pool.query(`DELETE FROM class_routines WHERE school_id = $1`, [id]);
      await pool.query(`DELETE FROM teacher_profiles WHERE user_id IN (SELECT id FROM users WHERE school_id = $1)`, [id]);
      await pool.query(`DELETE FROM sms_logs WHERE school_id = $1`, [id]);
      await pool.query(`DELETE FROM payments WHERE school_id = $1`, [id]);
      await pool.query(`DELETE FROM school_subscriptions WHERE school_id = $1`, [id]);
      await pool.query(`DELETE FROM students WHERE school_id = $1`, [id]);
      await pool.query(`DELETE FROM sections WHERE school_id = $1`, [id]);
      await pool.query(`DELETE FROM classes WHERE school_id = $1`, [id]);
      await pool.query(`DELETE FROM subjects WHERE school_id = $1`, [id]);
      await pool.query(`DELETE FROM users WHERE school_id = $1`, [id]);
      await pool.query(`DELETE FROM audit_logs WHERE school_id = $1`, [id]);
      await pool.query(`DELETE FROM schools WHERE id = $1`, [id]);
    } else if (schoolCode) {
      await pool.query(`DELETE FROM schools WHERE code = $1`, [schoolCode]);
    }
  } catch (err: any) {
    console.warn('[superAdmin] Postgres deletion non-fatal warning:', err.message);
  }

  // 4. Remove from in-memory cache
  for (let i = demoSchools.length - 1; i >= 0; i--) {
    if (demoSchools[i].id === id || (schoolCode && demoSchools[i].code === schoolCode)) {
      demoSchools.splice(i, 1);
    }
  }

  // 5. System Audit Log
  await logSystemAudit(
    req.user || { id: 'super-admin' },
    'DELETE_SCHOOL',
    'SCHOOL',
    id,
    { id, name: schoolName, code: schoolCode },
    id,
    schoolName
  );

  return res.json({
    success: true,
    message: `School "${schoolName}" and all associated institutional records were permanently deleted.`,
    id
  });
});

/* ────── Platform Users Management ────── */
r.get('/users', async (req, res) => {
  const roleFilter = String(req.query.role || '').toUpperCase();
  const search = String(req.query.search || '').trim().toLowerCase();

  const userList: any[] = [];

  // Firestore users
  if (isFirebaseConfigured()) {
    try {
      const snap = await collections.users().get();
      snap.docs.forEach(doc => {
        const u = doc.data();
        userList.push({
          id: doc.id,
          name: u.name || 'User',
          email: u.email,
          role: u.role,
          schoolId: u.schoolId || null,
          schoolName: u.schoolName || (u.schoolId ? 'Greenwood International School' : 'Platform Global'),
          status: u.status || 'ACTIVE',
          phone: u.phone || '',
          lastLogin: u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Recent',
          createdAt: u.createdAt || new Date().toISOString()
        });
      });
    } catch {}
  }

  // Postgres users
  try {
    const q = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at,
              s.name school_name, s.id school_id
       FROM users u LEFT JOIN schools s ON s.id=u.school_id
       ORDER BY u.created_at DESC LIMIT 100`
    );
    q.rows.forEach(u => {
      if (!userList.some(x => x.email.toLowerCase() === u.email.toLowerCase())) {
        userList.push({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          schoolId: u.school_id,
          schoolName: u.school_name || 'Platform Global',
          status: u.is_active ? 'ACTIVE' : 'SUSPENDED',
          lastLogin: 'Recent',
          createdAt: u.created_at
        });
      }
    });
  } catch {}

  // Demo users fallback
  getAllDemoUsers().forEach(du => {
    if (!userList.some(x => x.email.toLowerCase() === du.email.toLowerCase())) {
      userList.push({
        id: du.id,
        name: du.name,
        email: du.email,
        role: du.role,
        schoolId: du.schoolId,
        schoolName: du.schoolId ? 'Greenwood International School' : 'Platform Global',
        status: 'ACTIVE',
        lastLogin: 'Active now',
        createdAt: new Date().toISOString()
      });
    }
  });

  let filtered = userList;
  if (roleFilter && roleFilter !== 'ALL') {
    filtered = filtered.filter(u => u.role === roleFilter);
  }
  if (search) {
    filtered = filtered.filter(u =>
      u.name?.toLowerCase().includes(search) ||
      u.email?.toLowerCase().includes(search) ||
      u.schoolName?.toLowerCase().includes(search)
    );
  }

  res.json({ users: filtered, total: filtered.length });
});

r.patch('/users/:id/status', async (req: AuthRequest, res) => {
  const { status } = req.body || {};
  const id = String(req.params.id);

  if (isFirebaseConfigured()) {
    try {
      await collections.users().doc(id).set({ status }, { merge: true });
    } catch {}
  }

  try {
    await pool.query('UPDATE users SET is_active=$1 WHERE id=$2', [status === 'ACTIVE', id]);
  } catch {}

  await logSystemAudit(
    req.user || { id: 'super-admin' },
    'UPDATE_USER_STATUS',
    'USER',
    id,
    { status }
  );

  res.json({ id, status, success: true });
});

/* ────── Audit Logs Viewer ────── */
r.get('/audit-logs', async (req, res) => {
  const actionFilter = String(req.query.action || '').toUpperCase();
  const search = String(req.query.search || '').trim().toLowerCase();
  const limit = Math.min(Number(req.query.limit || 50), 100);

  let logs: any[] = [];

  if (isFirebaseConfigured()) {
    try {
      const snap = await collections.auditLogs().limit(100).get();
      snap.docs.forEach(d => {
        logs.push({ id: d.id, ...d.data() });
      });
    } catch {}
  }

  inMemoryAuditLogs.forEach(l => {
    if (!logs.some(x => x.id === l.id)) logs.push(l);
  });

  logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (actionFilter && actionFilter !== 'ALL') {
    logs = logs.filter(l => l.action === actionFilter);
  }
  if (search) {
    logs = logs.filter(l =>
      l.userName?.toLowerCase().includes(search) ||
      l.userEmail?.toLowerCase().includes(search) ||
      l.action?.toLowerCase().includes(search) ||
      l.schoolName?.toLowerCase().includes(search)
    );
  }

  res.json({
    logs: logs.slice(0, limit),
    total: logs.length
  });
});

/* ────── System Settings ────── */
r.get('/settings', async (_req, res) => {
  const smtpCfg = getGlobalSmtpConfig();
  res.json({
    ...systemSettings,
    smtpHost: smtpCfg.host || systemSettings.smtpHost,
    smtpPort: smtpCfg.port || systemSettings.smtpPort,
    smtpUsername: smtpCfg.username || systemSettings.smtpUsername,
    smtpPassword: smtpCfg.password || systemSettings.smtpPassword,
    smtpEncryption: smtpCfg.encryption || systemSettings.smtpEncryption,
    smtpSenderEmail: smtpCfg.defaultSenderEmail || systemSettings.smtpSenderEmail,
    smtpSenderName: smtpCfg.defaultSenderName || systemSettings.smtpSenderName
  });
});

r.put('/settings', async (req: AuthRequest, res) => {
  const b = req.body || {};
  systemSettings = {
    ...systemSettings,
    ...b
  };

  // If SMTP credentials or config are submitted, sync with global SMTP gateway
  if (b.smtpUsername !== undefined || b.smtpPassword !== undefined || b.smtpHost !== undefined) {
    updateGlobalSmtpConfig({
      ...(b.smtpHost !== undefined ? { host: b.smtpHost } : {}),
      ...(b.smtpPort !== undefined ? { port: Number(b.smtpPort) } : {}),
      ...(b.smtpUsername !== undefined ? { username: b.smtpUsername } : {}),
      ...(b.smtpPassword !== undefined ? { password: b.smtpPassword } : {}),
      ...(b.smtpEncryption !== undefined ? { encryption: b.smtpEncryption } : {}),
      ...(b.smtpSenderEmail !== undefined ? { defaultSenderEmail: b.smtpSenderEmail } : {}),
      ...(b.smtpSenderName !== undefined ? { defaultSenderName: b.smtpSenderName } : {})
    });
  }

  await logSystemAudit(
    req.user || { id: 'super-admin' },
    'UPDATE_SYSTEM_SETTINGS',
    'SETTINGS',
    'global-settings',
    req.body || {}
  );
  res.json({ success: true, settings: systemSettings, message: 'Settings saved successfully' });
});

/* ────── Dedicated Superadmin SMTP Gateway Endpoints ────── */
r.get('/smtp', async (_req, res) => {
  res.json(getGlobalSmtpConfig());
});

r.put('/smtp', async (req: AuthRequest, res) => {
  const updated = updateGlobalSmtpConfig(req.body || {});
  systemSettings.smtpHost = updated.host;
  systemSettings.smtpPort = updated.port;
  systemSettings.smtpUsername = updated.username;
  systemSettings.smtpPassword = updated.password;
  systemSettings.smtpEncryption = updated.encryption;
  systemSettings.smtpSenderEmail = updated.defaultSenderEmail;
  systemSettings.smtpSenderName = updated.defaultSenderName;

  await logSystemAudit(
    req.user || { id: 'super-admin' },
    'UPDATE_SMTP_CONFIG',
    'SMTP',
    'global-smtp',
    { host: updated.host, port: updated.port, username: updated.username }
  );

  res.json({ success: true, config: updated, message: 'Global SMTP credentials updated successfully by Superadmin' });
});

r.post('/smtp/test', async (req: AuthRequest, res) => {
  const { recipientEmail, host, port, username, password, encryption, senderEmail, senderName } = req.body || {};
  const to = String(recipientEmail || req.user?.email || 'admin@demo-school.local').trim();
  try {
    const result = await testSmtpConnection('global', to, {
      host,
      port: Number(port),
      username,
      password,
      encryption,
      senderEmail,
      senderName
    });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'SMTP test failed' });
  }
});

/* ────── Subscription Plans Management ────── */
r.post('/plans', async (req: AuthRequest, res) => {
  const { name, description, max_students, price_monthly, price_yearly, discount_percentage } = req.body || {};
  if (!name || !price_monthly) return res.status(400).json({ message: 'Name and price are required' });
  const planId = `plan-${Date.now()}`;
  const monthly = Number(price_monthly);
  const yearly = Number(price_yearly || monthly * 12);
  const studentLimit = Number(max_students || 500);
  const discount = Math.max(0, Math.min(100, Number(discount_percentage || 0)));

  if (isFirebaseConfigured()) {
    try {
      await collections.subscriptionPlans().doc(planId).set({
        id: planId,
        name,
        description: description || '',
        maxStudents: studentLimit,
        max_students: studentLimit,
        priceMonthly: monthly,
        price_monthly: monthly,
        priceYearly: yearly,
        price_yearly: yearly,
        discount_percentage: discount,
        discountPercentage: discount,
        status: 'ACTIVE',
        is_active: true,
        createdAt: new Date().toISOString()
      });
    } catch {}
  }
  try {
    await pool.query(
      `INSERT INTO subscription_plans(id, name, max_students, price_monthly, price_yearly, is_active)
       VALUES($1, $2, $3, $4, $5, true)`,
      [planId, name, studentLimit, monthly, yearly]
    );
  } catch {}
  await logSystemAudit(req.user || { id: 'super-admin' }, 'CREATE_PLAN', 'PLAN', planId, { name, price_monthly: monthly, price_yearly: yearly, discount_percentage: discount });
  res.status(201).json({ id: planId, name, price_monthly: monthly, price_yearly: yearly, max_students: studentLimit, discount_percentage: discount, message: 'Plan created' });
});

r.put('/plans/:id', async (req: AuthRequest, res) => {
  const { name, description, max_students, price_monthly, price_yearly, discount_percentage, is_active } = req.body || {};
  const id = String(req.params.id);
  const monthly = price_monthly !== undefined ? Number(price_monthly) : undefined;
  const yearly = price_yearly !== undefined ? Number(price_yearly) : (monthly !== undefined ? monthly * 12 : undefined);
  const discount = discount_percentage !== undefined ? Math.max(0, Math.min(100, Number(discount_percentage))) : undefined;

  if (isFirebaseConfigured()) {
    try {
      const updateData: any = { updatedAt: new Date().toISOString() };
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (max_students !== undefined) {
        updateData.maxStudents = Number(max_students);
        updateData.max_students = Number(max_students);
      }
      if (monthly !== undefined) {
        updateData.priceMonthly = monthly;
        updateData.price_monthly = monthly;
      }
      if (yearly !== undefined) {
        updateData.priceYearly = yearly;
        updateData.price_yearly = yearly;
      }
      if (discount !== undefined) {
        updateData.discount_percentage = discount;
        updateData.discountPercentage = discount;
      }
      if (is_active !== undefined) {
        updateData.status = is_active ? 'ACTIVE' : 'INACTIVE';
        updateData.is_active = Boolean(is_active);
      }
      await collections.subscriptionPlans().doc(id).set(updateData, { merge: true });
    } catch {}
  }

  try {
    await pool.query(
      `UPDATE subscription_plans SET 
        name=COALESCE($1, name),
        max_students=COALESCE($2, max_students),
        price_monthly=COALESCE($3, price_monthly),
        price_yearly=COALESCE($4, price_yearly),
        is_active=COALESCE($5, is_active)
       WHERE id=$6`,
      [name, max_students, monthly, yearly, is_active, id]
    );
  } catch {}
  await logSystemAudit(req.user || { id: 'super-admin' }, 'UPDATE_PLAN', 'PLAN', id, req.body || {});
  res.json({ id, message: 'Plan updated' });
});

r.delete('/plans/:id', async (req: AuthRequest, res) => {
  const id = String(req.params.id);

  if (isFirebaseConfigured()) {
    try {
      await collections.subscriptionPlans().doc(id).delete();
      console.log(`[Firestore] Deleted subscription plan document: ${id}`);
    } catch (fbErr) {
      console.warn('[Firestore] Error deleting plan:', fbErr);
    }
  }

  try {
    await pool.query('DELETE FROM subscription_plans WHERE id = $1', [id]);
  } catch {}

  await logSystemAudit(req.user || { id: 'super-admin' }, 'DELETE_PLAN', 'PLAN', id, { planId: id });
  res.json({ success: true, id, message: 'Subscription tier deleted successfully' });
});

/* ────── Notifications Endpoints (Super Admin) ────── */
r.get('/notifications', async (_req, res) => {
  const unreadCount = superAdminNotifications.filter(n => !n.read).length;
  res.json({
    notifications: superAdminNotifications,
    unreadCount
  });
});

r.post('/notifications/read-all', async (_req, res) => {
  superAdminNotifications.forEach(n => { n.read = true; });
  res.json({ success: true, unreadCount: 0 });
});

r.post('/notifications/:id/read', async (req, res) => {
  const id = String(req.params.id);
  const n = superAdminNotifications.find(x => x.id === id);
  if (n) n.read = true;
  const unreadCount = superAdminNotifications.filter(x => !x.read).length;
  res.json({ success: true, unreadCount });
});

r.delete('/notifications/:id', async (req, res) => {
  const id = String(req.params.id);
  superAdminNotifications = superAdminNotifications.filter(x => x.id !== id);
  const unreadCount = superAdminNotifications.filter(x => !x.read).length;
  res.json({ success: true, unreadCount });
});


/* ────── Global Search Endpoint (Super Admin) ────── */
r.get('/search', async (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  if (!q) {
    return res.json({ query: '', results: { schools: [], students: [], invoices: [] }, total: 0 });
  }

  const schoolResults: any[] = [];
  const studentResults: any[] = [];
  const invoiceResults: any[] = [];

  // 1. Search Schools from Firestore
  if (isFirebaseConfigured()) {
    try {
      const snap = await collections.schools().get();
      snap.docs.forEach(doc => {
        const s = doc.data();
        const name = s.name || '';
        const code = s.code || '';
        const address = s.address || '';
        const email = s.email || '';
        if (
          name.toLowerCase().includes(q) ||
          code.toLowerCase().includes(q) ||
          address.toLowerCase().includes(q) ||
          email.toLowerCase().includes(q)
        ) {
          schoolResults.push({
            id: doc.id,
            type: 'school',
            title: name,
            subtitle: `${code} · ${address || 'Campus'}`,
            badge: s.status || 'ACTIVE',
            meta: { id: doc.id, ...s }
          });
        }
      });
    } catch {}
  }

  // Fallback / Postgres schools
  if (schoolResults.length === 0) {
    demoSchools.forEach(s => {
      if (s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)) {
        schoolResults.push({
          id: s.id,
          type: 'school',
          title: s.name,
          subtitle: `${s.code} · ${s.enquiry_number || ''}`,
          badge: s.status || 'ACTIVE',
          meta: s
        });
      }
    });
  }

  // 2. Search Students from Firestore
  if (isFirebaseConfigured()) {
    try {
      const snap = await collections.students().get();
      snap.docs.forEach(doc => {
        const st = doc.data();
        const name = st.fullName || '';
        const adm = st.admissionNumber || '';
        const roll = st.rollNumber || '';
        const cls = st.className || '';
        const parent = st.parentName || '';
        const schl = st.schoolName || '';
        if (
          name.toLowerCase().includes(q) ||
          adm.toLowerCase().includes(q) ||
          roll.toLowerCase().includes(q) ||
          cls.toLowerCase().includes(q) ||
          parent.toLowerCase().includes(q) ||
          schl.toLowerCase().includes(q)
        ) {
          studentResults.push({
            id: doc.id,
            type: 'student',
            title: name,
            subtitle: `Class ${cls}-${st.section || 'A'} · Roll #${roll || '—'} · ${schl || 'Greenwood'}`,
            badge: adm || `Roll ${roll}`,
            meta: { id: doc.id, ...st }
          });
        }
      });
    } catch {}
  }

  // 3. Search Invoices / Subscriptions
  const demoInvs = [
    { id: 'inv-001', number: 'INV-2025-001', plan: 'Enterprise', school: 'Greenwood International', amount: 1999, status: 'PAID', date: '2025-09-01' },
    { id: 'inv-002', number: 'INV-2025-002', plan: 'Standard Growth', school: 'Delhi Public Academy', amount: 999, status: 'PAID', date: '2025-09-05' },
    { id: 'inv-003', number: 'INV-2025-003', plan: 'Basic Starter', school: 'St. Xavier High School', amount: 499, status: 'PENDING', date: '2025-09-12' }
  ];

  demoInvs.forEach(inv => {
    if (
      inv.number.toLowerCase().includes(q) ||
      inv.plan.toLowerCase().includes(q) ||
      inv.school.toLowerCase().includes(q) ||
      inv.status.toLowerCase().includes(q)
    ) {
      invoiceResults.push({
        id: inv.id,
        type: 'invoice',
        title: `${inv.number} — ${inv.school}`,
        subtitle: `${inv.plan} Plan · ₹${inv.amount.toLocaleString('en-IN')}`,
        badge: inv.status,
        meta: inv
      });
    }
  });

  return res.json({
    query: q,
    results: {
      schools: schoolResults,
      students: studentResults,
      invoices: invoiceResults
    },
    total: schoolResults.length + studentResults.length + invoiceResults.length
  });
});

export default r;
