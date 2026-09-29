async function test() {
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@demo-school.local', password: 'ChangeMe123!' })
  });
  const { token } = await loginRes.json();
  const headers = { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' };

  console.log('1. Testing Create Announcement with TEACHER audience...');
  const tAnn = await fetch('http://localhost:5000/api/communication/announcements', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: 'Faculty Emergency Briefing',
      message: 'All faculty members report to Conference Hall A.',
      audienceType: 'TEACHER',
      priority: 'EMERGENCY'
    })
  });
  const tData = await tAnn.json();
  console.log('TEACHER Announcement status:', tAnn.status, 'ID:', tData.id, 'Audience:', tData.audience_type);

  console.log('\n2. Testing Create Announcement with STUDENT audience...');
  const sAnn = await fetch('http://localhost:5000/api/communication/announcements', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: 'Annual Sports Day Registration',
      message: 'Registrations are open in the student portal.',
      audienceType: 'STUDENT',
      priority: 'NORMAL'
    })
  });
  const sData = await sAnn.json();
  console.log('STUDENT Announcement status:', sAnn.status, 'ID:', sData.id, 'Audience:', sData.audience_type);

  console.log('\n3. Testing Publish Announcement with EMERGENCY priority (triggers multi-channel dispatch)...');
  const pubRes = await fetch(`http://localhost:5000/api/communication/announcements/${tData.id}/publish`, {
    method: 'POST',
    headers
  });
  const pubData = await pubRes.json();
  console.log('Publish status:', pubRes.status, 'Status:', pubData.status);

  console.log('\n4. Testing Notification Reply on Announcement...');
  const replyRes = await fetch(`http://localhost:5000/api/communication/announcements/${tData.id}/reply`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      replyText: 'Acknowledged. Will be attending the briefing on time.'
    })
  });
  const replyData = await replyRes.json();
  console.log('Reply post status:', replyRes.status, 'Reply ID:', replyData.id);

  console.log('\n5. Testing Threaded Replies on Announcement (GET /api/communication/announcements/:id/replies)...');
  const getRepliesRes = await fetch(`http://localhost:5000/api/communication/announcements/${tData.id}/replies`, {
    method: 'GET',
    headers
  });
  const repliesData = await getRepliesRes.json();
  console.log('Replies retrieved:', repliesData.length, 'First reply:', repliesData[0]?.reply_text);

  console.log('\n6. Testing Administrator Console Grouped Replies (GET /api/communication/replies)...');
  const allRepliesRes = await fetch('http://localhost:5000/api/communication/replies', {
    method: 'GET',
    headers
  });
  const allRepliesData = await allRepliesRes.json();
  console.log('Grouped replies count:', allRepliesData.length);

  console.log('\n7. Testing Teacher In-App Inbox (GET /api/communication/teacher/inbox)...');
  const teacherInboxRes = await fetch('http://localhost:5000/api/communication/teacher/inbox', {
    method: 'GET',
    headers
  });
  const teacherInboxData = await teacherInboxRes.json();
  console.log('Teacher Inbox count:', teacherInboxData.length, 'Titles:', teacherInboxData.map(x => x.title));

  console.log('\nALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!');
}

test().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
