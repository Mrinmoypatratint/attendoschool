import app from '../src/app';
import jwt from 'jsonwebtoken';
import http from 'http';
import { env } from '../src/config/env';

const JWT_SECRET = env.jwtSecret || 'dev-secret-key-change-in-production';

function makeToken(user: { id: string; email: string; role: string; schoolId: string }) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '1h' });
}

async function runApiTests() {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}`;

  console.log(`Test server running on ${baseUrl}`);
  console.log('Testing /api/calendar Endpoints & Security Authorization...\n');

  const schoolA = '00000000-0000-0000-0000-000000000001';

  const adminTokenSchoolA = makeToken({
    id: 'admin-a-id',
    email: 'admin@greenwood.edu',
    role: 'SCHOOL_ADMIN',
    schoolId: schoolA
  });

  const teacherTokenSchoolA = makeToken({
    id: 'teacher-a-id',
    email: 'teacher@greenwood.edu',
    role: 'TEACHER',
    schoolId: schoolA
  });

  const parentTokenSchoolA = makeToken({
    id: 'parent-a-id',
    email: 'parent@example.com',
    role: 'PARENT',
    schoolId: schoolA
  });

  try {
    // 1. Unauthorized request (No token)
    const noTokenRes = await fetch(`${baseUrl}/api/calendar/working-days`);
    console.log('1. No token -> status:', noTokenRes.status);
    if (noTokenRes.status !== 401 && noTokenRes.status !== 403) throw new Error('Unauthenticated access should be rejected');

    // 2. PARENT role access attempt (Forbidden)
    const parentRes = await fetch(`${baseUrl}/api/calendar/working-days`, {
      headers: { Authorization: `Bearer ${parentTokenSchoolA}` }
    });
    console.log('2. Parent role -> status:', parentRes.status);
    if (parentRes.status !== 403) throw new Error('Parent role should not have access to admin calendar');

    // 3. School Admin GET working-days
    const getWorkingDaysRes = await fetch(`${baseUrl}/api/calendar/working-days`, {
      headers: { Authorization: `Bearer ${adminTokenSchoolA}` }
    });
    const workingDaysData = await getWorkingDaysRes.json() as any;
    console.log('3. School Admin GET /api/calendar/working-days -> status:', getWorkingDaysRes.status, 'Saturday rule:', workingDaysData.data?.saturday_rule);
    if (getWorkingDaysRes.status !== 200 || !workingDaysData.success) throw new Error('GET working-days failed');

    // 4. Teacher attempting to mutate working-days (Forbidden - admin only)
    const teacherPutRes = await fetch(`${baseUrl}/api/calendar/working-days`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${teacherTokenSchoolA}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ saturday_rule: 'OFF' })
    });
    console.log('4. Teacher PUT /api/calendar/working-days -> status:', teacherPutRes.status);
    if (teacherPutRes.status !== 403) throw new Error('Teacher should not be allowed to modify working days');

    // 5. School Admin calculate endpoint
    const calcRes = await fetch(`${baseUrl}/api/calendar/calculate?startDate=2026-10-01&endDate=2026-10-31`, {
      headers: { Authorization: `Bearer ${adminTokenSchoolA}` }
    });
    const calcData = await calcRes.json() as any;
    console.log('5. GET /api/calendar/calculate -> status:', calcRes.status, 'Total:', calcData.data?.totalDays, 'Working:', calcData.data?.workingDays);
    if (calcRes.status !== 200 || calcData.data?.totalDays !== 31) throw new Error('Calculate endpoint failed');

    // 6. Check-date endpoint for attendance guard (TC-ATT-010)
    const checkGandhiRes = await fetch(`${baseUrl}/api/calendar/check-date?date=2026-10-02`, {
      headers: { Authorization: `Bearer ${teacherTokenSchoolA}` }
    });
    const checkGandhiData = await checkGandhiRes.json() as any;
    console.log('6. GET /api/calendar/check-date (2026-10-02) -> isInstructional:', checkGandhiData.data?.isInstructional, 'Reason:', checkGandhiData.data?.reason);
    if (checkGandhiData.data?.isInstructional !== false) throw new Error('Gandhi Jayanti must be non-instructional');

    const checkSundayRes = await fetch(`${baseUrl}/api/calendar/check-date?date=2026-10-04`, {
      headers: { Authorization: `Bearer ${teacherTokenSchoolA}` }
    });
    const checkSundayData = await checkSundayRes.json() as any;
    console.log('7. GET /api/calendar/check-date (2026-10-04) -> isInstructional:', checkSundayData.data?.isInstructional, 'Reason:', checkSundayData.data?.reason);
    if (checkSundayData.data?.isInstructional !== false) throw new Error('Sunday must be non-instructional');

    // 8. Add Holiday as Admin
    const addHolRes = await fetch(`${baseUrl}/api/calendar/holidays`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminTokenSchoolA}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'API Test Holiday',
        holiday_date: '2026-12-30',
        holiday_type: 'INSTITUTIONAL'
      })
    });
    const addHolData = await addHolRes.json() as any;
    console.log('8. POST /api/calendar/holidays -> status:', addHolRes.status, 'Name:', addHolData.data?.name);
    if (addHolRes.status !== 201) throw new Error('POST holiday failed');

    // 9. Delete Holiday as Admin
    const delRes = await fetch(`${baseUrl}/api/calendar/holidays/${addHolData.data?.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminTokenSchoolA}` }
    });
    console.log('9. DELETE /api/calendar/holidays/:id -> status:', delRes.status);
    if (delRes.status !== 200) throw new Error('DELETE holiday failed');

    console.log('\nAll API endpoints, security guards, and role authorizations VERIFIED SUCCESSFULLY.');
    server.close();
    process.exit(0);
  } catch (e) {
    server.close();
    throw e;
  }
}

runApiTests().catch(err => {
  console.error('API Test Error:', err);
  process.exit(1);
});
