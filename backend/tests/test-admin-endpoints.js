async function testAdmin() {
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@demo-school.local', password: 'ChangeMe123!' })
  });
  const { token } = await loginRes.json();
  const headers = { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' };

  const endpoints = [
    ['GET', '/dashboard/school'],
    ['GET', '/students'],
    ['POST', '/students', { name: 'Test Student', rollNumber: '999', parentSmsNumber: '9999999999', classId: 'cls-8', sectionId: 'sec-a' }],
    ['GET', '/teachers'],
    ['POST', '/teachers', { name: 'Test Teacher', email: 'test@demo.local', employeeId: 'EMP999', mobile: '9999999999', password: 'ChangeMe123!' }],
    ['GET', '/classes'],
    ['POST', '/classes', { classNumber: 11 }],
    ['GET', '/sections'],
    ['POST', '/sections', { classId: 'cls-8', name: 'C' }],
    ['GET', '/subjects'],
    ['POST', '/subjects', { name: 'Economics' }],
    ['GET', '/routines'],
    ['POST', '/routines', { dayOfWeek: 1, classId: 'cls-8', sectionId: 'sec-a', subjectId: 'sub-1', teacherId: 'tch-1', startTime: '11:00', endTime: '11:45' }],
    ['GET', '/attendance-reports-v12/summary?from=2026-09-01&to=2026-09-30'],
    ['GET', '/attendance-reports-v12/students?from=2026-09-01&to=2026-09-30'],
    ['GET', '/attendance-corrections-v13?status=PENDING'],
    ['POST', '/attendance-corrections-v13/corr-001/review', { decision: 'APPROVED', reviewNote: 'Approved for test' }],
    ['GET', '/people-v14/students'],
    ['GET', '/people-v14/teachers'],
    ['GET', '/academic-years-v15'],
    ['POST', '/academic-years-v15', { name: '2027-28', startDate: '2027-04-01', endDate: '2028-03-31' }],
    ['GET', '/student-promotions-v16/candidates?fromYearId=ay-2026-27'],
    ['POST', '/student-promotions-v16/process', { fromYearId: 'ay-2026-27', toYearId: 'ay-2027-28', items: [{ studentId: 'st-01', outcome: 'PROMOTED' }] }],
    ['GET', '/timetable-v22/periods'],
    ['POST', '/timetable-v22/periods', { name: 'Period 5', periodNumber: 5, startTime: '12:00', endTime: '12:45', isBreak: false }],
    ['GET', '/timetable-v22/entries'],
    ['GET', '/notifications-v11/channels'],
    ['GET', '/notifications-v11/logs'],
    ['GET', '/notifications-v11/analytics'],
    ['GET', '/notifications-v11/templates'],
    ['PUT', '/notifications-v11/channels', { smsEnabled: true, whatsappEnabled: false, emailEnabled: false }],
    ['POST', '/notifications-v11/process'],
    ['GET', '/communication-v25/announcements'],
    ['POST', '/communication-v25/announcements', { title: 'Test Announcement', message: 'Testing announcement body', audienceType: 'SCHOOL', priority: 'NORMAL' }],
    ['GET', '/school-payment/subscription'],
    ['GET', '/school-payment/payments'],
    ['POST', '/school-payment/renew/order', { days: 30, gateway: 'MOCK' }],
    ['GET', '/analytics-v24/school'],
    ['GET', '/backups-v21/jobs'],
    ['POST', '/backups-v21/create']
  ];

  console.log('Testing School Admin endpoints:');
  for (const [method, ep, body] of endpoints) {
    try {
      const res = await fetch('http://localhost:5000/api' + ep, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });
      const txt = await res.text();
      let statusIcon = res.status < 400 ? '✔' : '✖';
      console.log(`  ${statusIcon} [${res.status}] ${method} ${ep}`);
      if (res.status >= 400) {
        console.log(`     Error: ${txt.slice(0, 150)}`);
      }
    } catch (err) {
      console.log(`  ✖ [ERR] ${method} ${ep} - ${err.message}`);
    }
  }
}
testAdmin();
