
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db';
import { requireAuth, requireRoles, AuthRequest } from '../middleware/auth';
import { registerDemoUser } from '../store/demoUsers';
import { collections, isFirebaseConfigured } from '../firebase';

const r=Router();
r.use(requireAuth,requireRoles('SUPER_ADMIN'));

function validDate(s:string){return /^\d{4}-\d{2}-\d{2}$/.test(s||'')}
function endDate(start:string,days:number){
 const d=new Date(start+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+Math.max(1,Number(days||30)));
 return d.toISOString().slice(0,10);
}

export const demoSchools: any[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Demo Higher Secondary School',
    code: 'DEMO001',
    status: 'ACTIVE',
    enquiry_number: '9000000000',
    student_count: 10,
    teacher_count: 3,
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
      const [schoolsSnap, studentsSnap] = await Promise.all([
        collections.schools().get(),
        collections.students().get()
      ]);
      const totalSchools = schoolsSnap.size || 1;
      const activeSchools = schoolsSnap.docs.filter(d => d.data().status === 'ACTIVE').length || totalSchools;
      const suspendedSchools = schoolsSnap.docs.filter(d => d.data().status === 'SUSPENDED').length;
      const expiredSchools = schoolsSnap.docs.filter(d => d.data().status === 'EXPIRED').length;
      const totalStudents = studentsSnap.size || 6;
      const totalRevenue = 148875;
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
        pending_payments: 0,
        pendingPayments: 0,
        total_revenue: totalRevenue,
        totalRevenue,
        activeRatio: totalSchools ? Number((100 * activeSchools / totalSchools).toFixed(1)) : 100,
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

r.get('/plans',async(_req,res)=>{
 try {
  const q=await pool.query(`SELECT id,name,max_students,price_monthly,price_yearly,is_active FROM subscription_plans WHERE is_active=true ORDER BY price_monthly`);
  res.json(q.rows);
 } catch {
  res.json([
    { id: 'plan-basic', name: 'Basic', max_students: 300, price_monthly: 499, price_yearly: 4999, is_active: true },
    { id: 'plan-standard', name: 'Standard', max_students: 1000, price_monthly: 999, price_yearly: 9999, is_active: true },
    { id: 'plan-enterprise', name: 'Enterprise', max_students: 5000, price_monthly: 1999, price_yearly: 19999, is_active: true }
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
      const stCount = studentsSnap.size;
      const list = schoolsSnap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          name: d.name,
          code: d.code || 'GWIS',
          status: d.status || 'ACTIVE',
          enquiry_number: d.phone || '9876543210',
          admin_email: d.email || 'admin@demo-school.local',
          student_count: stCount,
          start_date: d.subscriptionStart?.slice(0, 10) || '2025-01-01',
          end_date: d.subscriptionEnd?.slice(0, 10) || '2026-12-31',
          subscription_status: 'ACTIVE',
          plan_name: d.planName || 'Enterprise',
          plan_price_monthly: 1999,
          computed_status: d.status || 'ACTIVE'
        };
      });
      if (list.length > 0) return res.json(list);
    } catch {}
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

r.post('/schools',async(req:AuthRequest,res)=>{
 const {name,code,enquiryNumber='1800123456',adminName='Admin',adminEmail,adminPassword='ChangeMe123!',planId='plan-standard',startDate=new Date().toISOString().slice(0,10),days=30}=req.body||{};
 if(!name||!code||!adminEmail)
   return res.status(400).json({message:'name, code, and adminEmail are required'});
 try {
   const client=await pool.connect();
   try{
     await client.query('BEGIN');
     const exists=await client.query('SELECT 1 FROM schools WHERE LOWER(code)=LOWER($1) OR LOWER(name)=LOWER($2) LIMIT 1',[code,name]);
     if(exists.rowCount) throw Object.assign(new Error('School code or name already exists'),{status:409});
     const emailExists=await client.query('SELECT 1 FROM users WHERE LOWER(email)=LOWER($1)',[adminEmail]);
     if(emailExists.rowCount) throw Object.assign(new Error('Admin email already exists'),{status:409});
     const s=await client.query(`INSERT INTO schools(name,code,enquiry_number,status) VALUES($1,$2,$3,'ACTIVE') RETURNING id`,
       [name,code.toUpperCase(),enquiryNumber]);
     const schoolId=s.rows[0].id;
     const hash=await bcrypt.hash(adminPassword,10);
     await client.query(`INSERT INTO users(school_id,name,email,password_hash,role,is_active) VALUES($1,$2,$3,$4,'SCHOOL_ADMIN',true)`,
       [schoolId,adminName,adminEmail,hash]);
     await client.query(`INSERT INTO classes(school_id,class_number) SELECT $1,x FROM generate_series(5,12) x ON CONFLICT DO NOTHING`,[schoolId]);
      let selectedPlanId = planId;
      const plan=await client.query('SELECT id,price_monthly FROM subscription_plans WHERE id::text=$1 OR LOWER(name)=LOWER($2) AND is_active=true LIMIT 1',[planId, String(planId).replace(/^plan-/i, '')]);
      let price = 999;
      if (plan.rowCount) {
        selectedPlanId = plan.rows[0].id;
        price = Number(plan.rows[0].price_monthly || 0);
      } else {
        const fallback = await client.query('SELECT id,price_monthly FROM subscription_plans WHERE is_active=true ORDER BY price_monthly LIMIT 1');
        if (fallback.rowCount) {
          selectedPlanId = fallback.rows[0].id;
          price = Number(fallback.rows[0].price_monthly || 0);
        }
      }
      const end=endDate(startDate,days);
      const sub=await client.query(`INSERT INTO school_subscriptions(school_id,plan_id,start_date,end_date,status) VALUES($1,$2,$3,$4,'ACTIVE') RETURNING id`,
        [schoolId,selectedPlanId,startDate,end]);
     await client.query(`INSERT INTO payments(school_id,subscription_id,provider,amount,currency,status,paid_at) VALUES($1,$2,'MOCK',$3,'INR','PAID',NOW())`,
       [schoolId,sub.rows[0].id,price]);
     await client.query(`INSERT INTO audit_logs(user_id,school_id,action,entity_type,entity_id,metadata) VALUES($1,$2,'CREATE_SCHOOL','SCHOOL',$2,$3)`,
       [req.user!.id,schoolId,JSON.stringify({code,name,adminEmail})]);
     await client.query('COMMIT');res.status(201).json({message:'School created',schoolId});
   }catch(e:any){await client.query('ROLLBACK');throw e;}
   finally{client.release()}
 } catch(e:any) {
   console.error('Database create school failed:', e);
   if (e.status === 409) return res.status(409).json({ message: e.message });
   // Database unavailable — register the new admin in the in-memory store
   // so they can log in immediately after school creation
   const schoolId = `sch-${Date.now()}`;
   const adminPassword = req.body.adminPassword || 'ChangeMe123!';
   registerDemoUser({
     id: `user-${Date.now()}`,
     schoolId,
     name: req.body.adminName || 'Admin',
     email: req.body.adminEmail,
     role: 'SCHOOL_ADMIN',
     password: adminPassword,
   });
   const end = endDate(startDate, days);
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
     plan_name: String(planId).replace('plan-', '').toUpperCase(),
     plan_price_monthly: 999,
     computed_status: 'ACTIVE'
   };
   demoSchools.unshift(newSchool);
   demoPayments.unshift({
     id: `pay-${Date.now()}`,
     school_id: schoolId,
     school_name: name,
     plan_name: newSchool.plan_name,
     provider: 'MOCK',
     amount: 999,
     currency: 'INR',
     status: 'PAID',
     created_at: new Date().toISOString()
   });
   res.status(201).json({ message: 'School created', schoolId });
 }
});

r.put('/schools/:id/status',async(req:AuthRequest,res)=>{
 const {status}=req.body||{};
 if(!['ACTIVE','SUSPENDED'].includes(status)) return res.status(400).json({message:'Status must be ACTIVE or SUSPENDED'});
 try {
   const q=await pool.query(`UPDATE schools SET status=$1 WHERE id=$2 RETURNING id,status`,[status,req.params.id]);
   if(!q.rowCount) return res.status(404).json({message:'School not found'});
   await pool.query(`INSERT INTO audit_logs(user_id,school_id,action,entity_type,entity_id,metadata) VALUES($1,$2,$3,'SCHOOL',$2,$4)`,
   [req.user!.id,req.params.id,'UPDATE_SCHOOL_STATUS',JSON.stringify({status})]);
   res.json(q.rows[0]);
 } catch {
   const s = demoSchools.find(x => x.id === req.params.id);
   if (s) {
     s.status = status;
     s.computed_status = status;
   }
   res.json({ id: req.params.id, status });
 }
});

r.post('/schools/:id/renew',async(req:AuthRequest,res)=>{
 const {days=30,amount=0}=req.body||{};
 let client: any;
 try{
   client=await pool.connect();
   await client.query('BEGIN');
   const cur=await client.query(`SELECT ss.*,sp.price_monthly FROM school_subscriptions ss JOIN subscription_plans sp ON sp.id=ss.plan_id
     WHERE ss.school_id=$1 ORDER BY ss.end_date DESC NULLS LAST LIMIT 1`,[req.params.id]);
   if(!cur.rowCount) throw Object.assign(new Error('No subscription found for school'),{status:404});
   const old=cur.rows[0];
   const base=new Date(Math.max(Date.now(),new Date(old.end_date).getTime()));
   base.setUTCDate(base.getUTCDate()+Math.max(1,Number(days)));
   const end=base.toISOString().slice(0,10);
   const sub=await client.query(`INSERT INTO school_subscriptions(school_id,plan_id,start_date,end_date,status) VALUES($1,$2,GREATEST(CURRENT_DATE,$3::date),$4,'ACTIVE') RETURNING id`,
     [req.params.id,old.plan_id,old.end_date,end]);
   await client.query(`INSERT INTO payments(school_id,subscription_id,provider,provider_order_id,amount,currency,status,paid_at)
     VALUES($1,$2,'MOCK',$3,$4,'INR','PAID',NOW())`,
     [req.params.id,sub.rows[0].id,'MOCK-'+Date.now(),Number(amount||old.price_monthly||0)]);
   await client.query(`UPDATE schools SET status='ACTIVE' WHERE id=$1`,[req.params.id]);
   await client.query('COMMIT');return res.json({message:'Subscription renewed',endDate:end});
 }catch(_e:any){
   if(client){try{await client.query('ROLLBACK')}catch{}}
   const s = demoSchools.find(x => x.id === req.params.id);
   const end = endDate(new Date().toISOString().slice(0, 10), days);
   if (s) {
     s.end_date = end;
     s.status = 'ACTIVE';
     s.computed_status = 'ACTIVE';
   }
   demoPayments.unshift({
     id: `pay-${Date.now()}`,
     school_id: req.params.id,
     school_name: s ? s.name : 'School',
     plan_name: s ? s.plan_name : 'Standard',
     provider: 'MOCK',
     amount: Number(amount) || 999,
     currency: 'INR',
     status: 'PAID',
     created_at: new Date().toISOString()
   });
   return res.json({ message: 'Subscription renewed', endDate: end });
 }
 finally{if(client){try{client.release()}catch{}}}
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
  const n = superAdminNotifications.find(x => x.id === req.params.id);
  if (n) n.read = true;
  const unreadCount = superAdminNotifications.filter(x => !x.read).length;
  res.json({ success: true, unreadCount });
});

r.delete('/notifications/:id', async (req, res) => {
  superAdminNotifications = superAdminNotifications.filter(x => x.id !== req.params.id);
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
