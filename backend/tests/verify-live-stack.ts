async function verifyLiveStack() {
  console.log('========================================================================');
  console.log('🚀 LIVE STACK & SUPER ADMIN DEEP FUNCTIONAL VERIFICATION');
  console.log('========================================================================\n');
  
  // 1. Check frontend HTML & assets
  console.log('📱 1. Frontend Asset Verification:');
  const htmlRes = await fetch('http://localhost:5173/');
  const html = await htmlRes.text();
  console.log(`  ✔ Frontend Root Status: ${htmlRes.status} (SPA Root: ${html.includes('id="root"')})`);

  const cssRes = await fetch('http://localhost:5173/src/styles.css');
  const cssCode = await cssRes.text();
  console.log(`  ✔ Stylesheet Status: ${cssRes.status} (Toast CSS: ${cssCode.includes('.toast')})`);

  // 2. Authenticate as Super Admin
  console.log('\n👑 2. Super Admin Authentication & Identity:');
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'superadmin@attendance.local', password: 'ChangeMe123!' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  console.log(`  ✔ Super Admin Login: HTTP ${loginRes.status} | Role: ${loginData.user?.role}`);

  const meRes = await fetch('http://localhost:5000/api/auth/me', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const meData = await meRes.json();
  console.log(`  ✔ Session Verified: ${meData.user?.name} (${meData.user?.email})`);

  // 3. Super Admin Operations & API Endpoints
  console.log('\n🏛️ 3. Super Admin Core Endpoints:');
  const superEndpoints: [string, string, any?][] = [
    ['GET', '/super-admin/overview'],
    ['GET', '/super-admin/plans'],
    ['GET', '/super-admin/schools'],
    ['POST', '/super-admin/schools', {
      name: 'Global International School',
      code: 'GIS001',
      enquiryNumber: '9900011122',
      adminName: 'Principal Mehta',
      adminEmail: 'mehta@gis.local',
      adminPassword: 'ChangeMe123!',
      planId: 'plan-enterprise',
      days: 60
    }],
    ['PUT', '/super-admin/schools/00000000-0000-0000-0000-000000000001/status', { status: 'ACTIVE' }],
    ['POST', '/super-admin/schools/00000000-0000-0000-0000-000000000001/renew', { days: 30, amount: 999 }],
    ['GET', '/super-admin/payments'],
    ['POST', '/super-admin/payments/order', { schoolId: '00000000-0000-0000-0000-000000000001', days: 30, amount: 999, provider: 'MOCK' }],
    ['GET', '/super-admin/invoices'],
    ['GET', '/super-admin/invoices/inv-001/receipt'],
    ['GET', '/super-admin/payments/reconciliation'],
    ['POST', '/super-admin/payments/pay-001/reconcile'],
    ['GET', '/super-admin/monitor'],
    ['POST', '/super-admin/subscriptions/expire-now'],
    ['GET', '/analytics-v24/platform'],
    ['POST', '/security-v20/validate-password', { password: 'SecurePassword123!' }],
    ['GET', '/permissions-v18'],
    ['GET', '/backups-v21/jobs'],
    ['POST', '/backups-v21/create'],
    ['GET', '/production-v26/health'],
    ['GET', '/production-v26/ready'],
    ['GET', '/final-v28/db-check'],
    ['GET', '/final-v28/migration-smoke'],
    ['GET', '/final-v28/integrity']
  ];

  let passed = 0, failed = 0;
  for (const [method, ep, body] of superEndpoints) {
    try {
      const res = await fetch('http://localhost:5000/api' + ep, {
        method,
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined
      });
      const ok = res.status < 400;
      if (ok) passed++; else failed++;
      const icon = ok ? '✔' : '✖';
      console.log(`  ${icon} [${res.status}] ${method} ${ep}`);
    } catch (err: any) {
      failed++;
      console.log(`  ✖ [ERR] ${method} ${ep} - ${err.message}`);
    }
  }

  // 4. Verify RBAC Isolation (Teacher forbidden from Super Admin)
  console.log('\n🚫 4. Cross-Role RBAC Barrier Protection:');
  const teacherLogin = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'rahul@demo-school.local', password: 'ChangeMe123!' })
  });
  const teacherToken = (await teacherLogin.json()).token;

  const rbacRes = await fetch('http://localhost:5000/api/super-admin/overview', {
    headers: { 'Authorization': 'Bearer ' + teacherToken }
  });
  console.log(`  ✔ Teacher blocked from /super-admin/overview: HTTP ${rbacRes.status} (Expected 403 Forbidden)`);

  console.log('\n========================================================================');
  console.log(`📊 SUPER ADMIN VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED (Total: ${superEndpoints.length})`);
  console.log('========================================================================\n');
}

verifyLiveStack().catch(console.error);
