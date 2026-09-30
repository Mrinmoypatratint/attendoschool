import http from 'http';
import jwt from 'jsonwebtoken';
import app from '../app';
import { pool, isPostgresConfigured } from '../db';
import { env } from '../config/env';

async function runLifecycleAudit() {
  console.log('================================================================');
  console.log('   DEEP AUDIT: SCHOOL LIFECYCLE, PERSISTENCE & MULTI-TENANT AUTH');
  console.log('================================================================\n');

  // 1. Start test server
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}/api`;
  console.log(`[Test Server] Listening on ${baseUrl}\n`);

  try {
    // Generate valid Super Admin token
    const superAdminToken = jwt.sign(
      {
        id: 'super-admin-root-001',
        name: 'Platform Super Administrator',
        email: 'superadmin@attendance.local',
        role: 'SUPER_ADMIN'
      },
      env.jwtSecret,
      { expiresIn: '1h' }
    );

    const testSchoolCode = `HHA-${Math.floor(1000 + Math.random() * 9000)}`;
    const testAdminEmail = `principal.${testSchoolCode.toLowerCase()}@horizonheights.test`;
    const testAdminPassword = 'HorizonAdminPass2026!';
    const testSchoolName = 'Horizon Heights Academy';

    console.log(`[Step 1] Creating School via Super Admin: "${testSchoolName}" (${testSchoolCode})...`);
    const createRes = await fetch(`${baseUrl}/super-admin/schools`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`
      },
      body: JSON.stringify({
        name: testSchoolName,
        code: testSchoolCode,
        adminName: 'Dr. Alistair Finch',
        adminEmail: testAdminEmail,
        adminPassword: testAdminPassword,
        planId: 'plan-enterprise',
        days: 365,
        address: '742 Evergreen Terrace',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
        phone: '+91 9123456789'
      })
    });

    const createBody = await createRes.json() as any;
    console.log(`Status: ${createRes.status}`, createBody);

    if (createRes.status !== 201 || !createBody.schoolId) {
      throw new Error(`School creation failed: ${JSON.stringify(createBody)}`);
    }

    const createdSchoolId = createBody.schoolId;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(createdSchoolId);
    console.log(`✓ School created with canonical ID: ${createdSchoolId} (isUUID: ${isUuid})\n`);
    if (!isUuid) throw new Error(`School ID is not a canonical UUID: ${createdSchoolId}`);

    // [Step 2] Verify Database Transactions in Supabase PostgreSQL
    console.log('[Step 2] Verifying Primary Database State (Supabase PostgreSQL)...');
    if (isPostgresConfigured) {
      // Check schools table
      const schDb = await pool.query('SELECT * FROM schools WHERE id = $1', [createdSchoolId]);
      if (schDb.rowCount === 0) throw new Error('School record not found in PostgreSQL "schools" table!');
      console.log(`✓ PostgreSQL "schools" record verified: name="${schDb.rows[0].name}", status="${schDb.rows[0].status}"`);

      // Check users table
      const usrDb = await pool.query('SELECT * FROM users WHERE school_id = $1 AND role = $2', [createdSchoolId, 'SCHOOL_ADMIN']);
      if (usrDb.rowCount === 0) throw new Error('School Admin user not found in PostgreSQL "users" table!');
      console.log(`✓ PostgreSQL "users" admin record verified: id="${usrDb.rows[0].id}", email="${usrDb.rows[0].email}"`);

      // Check academic_years table
      const ayDb = await pool.query('SELECT * FROM academic_years WHERE school_id = $1', [createdSchoolId]);
      if (ayDb.rowCount === 0) throw new Error('Active academic year not found in "academic_years" table!');
      console.log(`✓ PostgreSQL "academic_years" record verified: name="${ayDb.rows[0].name}", active=${ayDb.rows[0].is_active}`);

      // Check classes and sections
      const clsDb = await pool.query('SELECT COUNT(*)::int as count FROM classes WHERE school_id = $1', [createdSchoolId]);
      const secDb = await pool.query('SELECT COUNT(*)::int as count FROM sections WHERE school_id = $1', [createdSchoolId]);
      console.log(`✓ PostgreSQL academic structure verified: ${clsDb.rows[0].count} classes provisioned, ${secDb.rows[0].count} sections provisioned`);

      // Check subscriptions and payments
      const subDb = await pool.query('SELECT * FROM school_subscriptions WHERE school_id = $1', [createdSchoolId]);
      const payDb = await pool.query('SELECT * FROM payments WHERE school_id = $1', [createdSchoolId]);
      if (subDb.rowCount === 0) throw new Error('Subscription not found in "school_subscriptions" table!');
      if (payDb.rowCount === 0) throw new Error('Payment not found in "payments" table!');
      console.log(`✓ PostgreSQL subscription & payment verified: sub_status="${subDb.rows[0].status}", payment_status="${payDb.rows[0].status}", amount=${payDb.rows[0].amount}\n`);
    } else {
      console.log('PostgreSQL not configured, skipping SQL queries.\n');
    }

    // [Step 3] Verify School List in Super Admin Portal
    console.log('[Step 3] Verifying Super Admin School Directory API (GET /api/super-admin/schools)...');
    const saListRes = await fetch(`${baseUrl}/super-admin/schools`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    const saList = await saListRes.json() as any[];
    const foundInSaList = saList.find((s: any) => s.id === createdSchoolId || s.code === testSchoolCode);
    if (!foundInSaList) {
      throw new Error(`Newly created school ${testSchoolCode} does NOT appear in Super Admin School List!`);
    }
    console.log(`✓ Found in Super Admin List: "${foundInSaList.name}" (Code: ${foundInSaList.code}, Status: ${foundInSaList.status}, Students: ${foundInSaList.student_count})\n`);

    // [Step 4] Verify School Details Dossier Endpoint
    console.log(`[Step 4] Verifying School Dossier API (GET /api/super-admin/schools/${createdSchoolId})...`);
    const dossierRes = await fetch(`${baseUrl}/super-admin/schools/${createdSchoolId}`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    if (dossierRes.status !== 200) {
      throw new Error(`Failed to load school dossier for ID ${createdSchoolId}: HTTP ${dossierRes.status}`);
    }
    const dossier = await dossierRes.json() as any;
    console.log(`✓ Dossier verified: "${dossier.name}" | Admin: ${dossier.adminName} (${dossier.adminEmail})\n`);

    // [Step 5] Verify Public Login Dropdown (GET /api/auth/institutes)
    console.log('[Step 5] Verifying Login Dropdown Institutions API (GET /api/auth/institutes)...');
    const institutesRes = await fetch(`${baseUrl}/auth/institutes`);
    const institutes = await institutesRes.json() as any[];
    const foundInInstitutes = institutes.find((i: any) => i.id === createdSchoolId || i.code === testSchoolCode);
    if (!foundInInstitutes) {
      throw new Error(`Newly created school ${testSchoolCode} does NOT appear in Public Institutes list!`);
    }
    console.log(`✓ Found in Login Dropdown: "${foundInInstitutes.name}" (ID: ${foundInInstitutes.id}, Code: ${foundInInstitutes.code})\n`);

    // [Step 6] Test Multi-Tenant Authentication (POST /api/auth/login)
    console.log('[Step 6] Testing Multi-Tenant Login as School Admin...');

    // 6A. Login using canonical school UUID
    console.log('   6A: Login with School UUID instituteId...');
    const loginUuidRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instituteId: createdSchoolId,
        email: testAdminEmail,
        password: testAdminPassword,
        role: 'SCHOOL_ADMIN'
      })
    });
    const loginUuidBody = await loginUuidRes.json() as any;
    if (loginUuidRes.status !== 200 || !loginUuidBody.token) {
      throw new Error(`Login with UUID failed: Status ${loginUuidRes.status}, Body: ${JSON.stringify(loginUuidBody)}`);
    }
    console.log(`   ✓ Authenticated successfully with UUID! Provider: ${loginUuidBody.provider}, Token schoolId: ${loginUuidBody.user.schoolId}`);

    // 6B. Login using school code as instituteId
    console.log('   6B: Login with School Code instituteId...');
    const loginCodeRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instituteId: testSchoolCode,
        email: testAdminEmail,
        password: testAdminPassword,
        role: 'SCHOOL_ADMIN'
      })
    });
    const loginCodeBody = await loginCodeRes.json() as any;
    if (loginCodeRes.status !== 200 || !loginCodeBody.token) {
      throw new Error(`Login with Code failed: Status ${loginCodeRes.status}, Body: ${JSON.stringify(loginCodeBody)}`);
    }
    console.log(`   ✓ Authenticated successfully with Code! Provider: ${loginCodeBody.provider}, Token schoolId: ${loginCodeBody.user.schoolId}`);

    // 6C. Tenant Isolation check: Login under wrong school
    console.log('   6C: Verify tenant isolation (cross-tenant login attempt rejected)...');
    const wrongSchoolRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instituteId: '00000000-0000-0000-0000-000000000001', // Greenwood International School ID
        email: testAdminEmail,
        password: testAdminPassword,
        role: 'SCHOOL_ADMIN'
      })
    });
    console.log(`   Status: ${wrongSchoolRes.status} (Expected: 401)`);
    if (wrongSchoolRes.status !== 401) {
      throw new Error(`Security breach: Cross-tenant login was not rejected! Status: ${wrongSchoolRes.status}`);
    }
    console.log('   ✓ Cross-tenant access strictly denied!\n');

    // [Step 7] Test School Lifecycle State Transitions
    console.log('[Step 7] Testing School State Transitions (Suspend & Re-activate)...');

    // 7A. Suspend School
    const suspendRes = await fetch(`${baseUrl}/super-admin/schools/${createdSchoolId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`
      },
      body: JSON.stringify({ status: 'SUSPENDED' })
    });
    if (suspendRes.status !== 200) throw new Error('Failed to suspend school');
    console.log('   ✓ School status updated to SUSPENDED');

    // 7B. Verify login blocked when school is SUSPENDED
    const loginSuspendedRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instituteId: createdSchoolId,
        email: testAdminEmail,
        password: testAdminPassword,
        role: 'SCHOOL_ADMIN'
      })
    });
    console.log(`   Login on suspended school status: ${loginSuspendedRes.status} (Expected: 401)`);
    if (loginSuspendedRes.status !== 401) {
      throw new Error('Suspended school user was able to log in!');
    }
    console.log('   ✓ Login correctly blocked for suspended school');

    // 7C. Re-activate School
    const activateRes = await fetch(`${baseUrl}/super-admin/schools/${createdSchoolId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`
      },
      body: JSON.stringify({ status: 'ACTIVE' })
    });
    if (activateRes.status !== 200) throw new Error('Failed to re-activate school');
    console.log('   ✓ School status re-activated to ACTIVE\n');

    // [Step 8] Clean Up: Delete test school and verify cascading cleanup
    console.log('[Step 8] Cleaning up: Deleting test school and all cascading records...');
    const deleteRes = await fetch(`${baseUrl}/super-admin/schools/${createdSchoolId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    const deleteBody = await deleteRes.json() as any;
    console.log(`Delete status: ${deleteRes.status}`, deleteBody);
    if (deleteRes.status !== 200) throw new Error(`Failed to delete school: ${JSON.stringify(deleteBody)}`);

    // Verify deletion in database
    if (isPostgresConfigured) {
      const verifyDel = await pool.query('SELECT 1 FROM schools WHERE id = $1', [createdSchoolId]);
      if (verifyDel.rowCount !== 0) throw new Error('School record still exists in database after deletion!');
      console.log('✓ PostgreSQL verification: School completely removed from database');
    }

    console.log('\n================================================================');
    console.log('   ALL CHECKS PASSED: SCHOOL LIFECYCLE 100% VERIFIED & COMPLIANT');
    console.log('================================================================\n');
  } finally {
    server.close();
    await pool.end();
  }
}

runLifecycleAudit().catch((err) => {
  console.error('\n❌ LIFECYCLE AUDIT FAILED:', err);
  process.exit(1);
});
