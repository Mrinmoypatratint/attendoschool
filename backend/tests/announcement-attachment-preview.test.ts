process.env.NODE_ENV = 'test';
process.env.SKIP_SMTP_SYNC = 'true';

import assert from 'assert';
import app from '../src/app';
import jwt from 'jsonwebtoken';
import http from 'http';
import { memAnnouncements } from '../src/services/communicationService';

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-1234567890';

function makeToken(user: { id: string; schoolId: string; role: string; name?: string }) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '1h' });
}

function doRequest(
  server: http.Server,
  method: string,
  path: string,
  token?: string,
  headers: Record<string, string> = {}
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as any;
    const reqHeaders: Record<string, string> = { ...headers };
    if (token) {
      reqHeaders['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(
      {
        host: '127.0.0.1',
        port: addr.port,
        path,
        method,
        headers: reqHeaders
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        res.on('end', () => {
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            body: Buffer.concat(chunks)
          });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function runAnnouncementAttachmentTests() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  ATTENDOSCHOOL — ANNOUNCEMENT ATTACHMENT PREVIEW & DOWNLOAD   ');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));

  try {
    const schoolA = '11111111-1111-4111-a111-000000000001';
    const schoolB = '22222222-2222-4222-a222-000000000002';

    const adminToken = makeToken({ id: 'user-admin-1', schoolId: schoolA, role: 'SCHOOL_ADMIN', name: 'Admin A' });
    const teacherToken = makeToken({ id: 'user-teacher-1', schoolId: schoolA, role: 'TEACHER', name: 'Teacher A' });
    const studentToken = makeToken({ id: 'user-student-1', schoolId: schoolA, role: 'STUDENT', name: 'Student A' });
    const schoolBAdminToken = makeToken({ id: 'user-admin-b', schoolId: schoolB, role: 'SCHOOL_ADMIN', name: 'Admin B' });

    // Seed in-memory test announcements
    const samplePdfBytes = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
    const pdfDataUrl = `data:application/pdf;base64,${samplePdfBytes.toString('base64')}`;

    const samplePngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    const pngDataUrl = `data:image/png;base64,${samplePngBytes.toString('base64')}`;

    const docxDataUrl = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,UEsDBBQAAAAIAAA=`;

    const pdfNoticeId = 'ann-test-pdf-1';
    const pngNoticeId = 'ann-test-png-1';
    const docxNoticeId = 'ann-test-docx-1';
    const noAttachNoticeId = 'ann-test-none-1';
    const teacherOnlyNoticeId = 'ann-test-teacher-only-1';

    // Clear and push test notices to memAnnouncements
    memAnnouncements.unshift(
      {
        id: pdfNoticeId,
        school_id: schoolA,
        title: 'PDF Notice',
        message: 'Notice with PDF attachment',
        audience_type: 'SCHOOL',
        status: 'PUBLISHED',
        attachment_url: pdfDataUrl,
        attachment_name: 'test-policy.pdf',
        attachment_type: 'application/pdf',
        attachment_size: samplePdfBytes.length
      },
      {
        id: pngNoticeId,
        school_id: schoolA,
        title: 'Image Notice',
        message: 'Notice with PNG attachment',
        audience_type: 'SCHOOL',
        status: 'PUBLISHED',
        attachment_url: pngDataUrl,
        attachment_name: 'sports-day.png',
        attachment_type: 'image/png',
        attachment_size: samplePngBytes.length
      },
      {
        id: docxNoticeId,
        school_id: schoolA,
        title: 'Word Notice',
        message: 'Notice with Word DOCX',
        audience_type: 'SCHOOL',
        status: 'PUBLISHED',
        attachment_url: docxDataUrl,
        attachment_name: 'circular.docx',
        attachment_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        attachment_size: 100
      },
      {
        id: noAttachNoticeId,
        school_id: schoolA,
        title: 'No Attachment Notice',
        message: 'Notice with no file attached',
        audience_type: 'SCHOOL',
        status: 'PUBLISHED'
      },
      {
        id: teacherOnlyNoticeId,
        school_id: schoolA,
        title: 'Staff Only Meeting',
        message: 'Faculty meeting agenda',
        audience_type: 'TEACHER',
        status: 'PUBLISHED',
        attachment_url: pdfDataUrl,
        attachment_name: 'agenda.pdf',
        attachment_type: 'application/pdf',
        attachment_size: samplePdfBytes.length
      }
    );

    // ─── TEST 1: Unauthenticated request should be rejected (401) ───
    console.log('[1/7] Testing unauthenticated access rejection...');
    const unauthRes = await doRequest(server, 'GET', `/api/communication/announcements/${pdfNoticeId}/attachment/preview`);
    assert.strictEqual(unauthRes.status, 401, 'Unauthenticated request should return 401');
    console.log('      ✓ Correctly rejected unauthenticated request with 401');

    // ─── TEST 2: PDF Preview endpoint returns inline disposition & valid buffer ───
    console.log('[2/7] Testing PDF preview endpoint headers & buffer...');
    const pdfRes = await doRequest(server, 'GET', `/api/communication/announcements/${pdfNoticeId}/attachment/preview`, adminToken);
    assert.strictEqual(pdfRes.status, 200, 'PDF preview should return 200');
    assert.strictEqual(pdfRes.headers['content-type'], 'application/pdf', 'Content-Type should be application/pdf');
    assert(
      (pdfRes.headers['content-disposition'] || '').includes('inline'),
      `Content-Disposition should be inline, got: ${pdfRes.headers['content-disposition']}`
    );
    assert.strictEqual(pdfRes.headers['x-content-type-options'], 'nosniff', 'nosniff header should be present');
    assert.strictEqual(pdfRes.body.toString('utf-8', 0, 5), '%PDF-', 'Buffer should match PDF signature');
    console.log('      ✓ PDF preview successfully returned inline disposition and matching buffer');

    // ─── TEST 3: Image Preview endpoint returns image/png and inline ───
    console.log('[3/7] Testing Image preview endpoint...');
    const imgRes = await doRequest(server, 'GET', `/api/communication/announcements/${pngNoticeId}/attachment/preview`, teacherToken);
    assert.strictEqual(imgRes.status, 200, 'Image preview should return 200');
    assert.strictEqual(imgRes.headers['content-type'], 'image/png', 'Content-Type should be image/png');
    assert(
      (imgRes.headers['content-disposition'] || '').includes('inline'),
      `Content-Disposition should be inline, got: ${imgRes.headers['content-disposition']}`
    );
    assert.deepStrictEqual(imgRes.body.subarray(0, samplePngBytes.length), samplePngBytes, 'Image bytes should match');
    console.log('      ✓ Image preview returned inline disposition and matching binary data');

    // ─── TEST 4: DOCX Preview gracefully forces attachment disposition ───
    console.log('[4/7] Testing unsupported preview format (DOCX) fallback to attachment disposition...');
    const docxRes = await doRequest(server, 'GET', `/api/communication/announcements/${docxNoticeId}/attachment/preview`, studentToken);
    assert.strictEqual(docxRes.status, 200, 'DOCX preview request should return 200');
    assert(
      (docxRes.headers['content-disposition'] || '').includes('attachment'),
      `Content-Disposition should fallback to attachment for DOCX, got: ${docxRes.headers['content-disposition']}`
    );
    console.log('      ✓ DOCX preview safely enforced attachment disposition instead of inline rendering');

    // ─── TEST 5: Download endpoint always returns attachment disposition ───
    console.log('[5/7] Testing dedicated download endpoint...');
    const dlRes = await doRequest(server, 'GET', `/api/communication/announcements/${pdfNoticeId}/attachment/download`, studentToken);
    assert.strictEqual(dlRes.status, 200, 'Download should return 200');
    assert(
      (dlRes.headers['content-disposition'] || '').includes('attachment'),
      `Content-Disposition should be attachment, got: ${dlRes.headers['content-disposition']}`
    );
    assert.strictEqual(dlRes.headers['content-type'], 'application/pdf');
    console.log('      ✓ Download endpoint successfully returned attachment disposition');

    // ─── TEST 6: Tenant isolation (School B cannot view School A attachment) ───
    console.log('[6/7] Testing strict multi-tenant isolation...');
    const tenantLeakRes = await doRequest(
      server,
      'GET',
      `/api/communication/announcements/${pdfNoticeId}/attachment/preview`,
      schoolBAdminToken
    );
    assert.strictEqual(tenantLeakRes.status, 404, 'Cross-tenant request should return 404');
    console.log('      ✓ Multi-tenant isolation verified: cross-school request returns 404');

    // ─── TEST 7: Role audience check (Student blocked from TEACHER audience notice) ───
    console.log('[7/7] Testing role-based audience protection...');
    const studentBlockedRes = await doRequest(
      server,
      'GET',
      `/api/communication/announcements/${teacherOnlyNoticeId}/attachment/preview`,
      studentToken
    );
    assert.strictEqual(studentBlockedRes.status, 403, 'Student should be forbidden from teacher-only announcement');
    console.log('      ✓ Role-based audience protection verified: student access forbidden (403)');

    console.log('\n───────────────────────────────────────────────────────────────');
    console.log('  ALL 7 ANNOUNCEMENT ATTACHMENT PREVIEW TESTS PASSED SUCCESSFULLY! ');
    console.log('───────────────────────────────────────────────────────────────\n');
  } finally {
    server.close();
  }
}

runAnnouncementAttachmentTests().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
