process.env.NODE_ENV = 'test';

import assert from 'assert';
import {
  validateAttachment,
  verifyMagicBytes,
  getMimeTypeForExtension,
  isInlinePreviewMime,
  buildTeacherAssignmentStorageKey,
  buildStudentSubmissionStorageKey,
  resolveStorageBucketName,
  isFirebaseStorageConfigured,
  uploadToStorage,
  downloadFromStorage,
  deleteFromStorage,
  getStorageHealth,
  StorageConfigurationError,
  MAX_FILE_SIZE,
  MAX_TOTAL_SIZE,
  MAX_FILES_COUNT
} from '../src/utils/firebaseStorage';

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('    ATTENDOSCHOOL — FIREBASE STORAGE ATTACHMENTS TEST SUITE    ');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 1. FILE VALIDATION & MAGIC BYTES
  console.log('--- 1. File Validation, Extensions, and Magic Bytes ---');

  const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
  const validPdfBuffer = Buffer.from('%PDF-1.5 test pdf content stream');
  const validZipDocxBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);
  const invalidExeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]); // MZ executable

  assert.strictEqual(verifyMagicBytes(validPngBuffer, 'png'), true, 'Validates authentic PNG magic bytes');
  assert.strictEqual(verifyMagicBytes(validPdfBuffer, 'pdf'), true, 'Validates authentic PDF magic bytes');
  assert.strictEqual(verifyMagicBytes(validZipDocxBuffer, 'docx'), true, 'Validates authentic DOCX ZIP magic bytes');
  assert.strictEqual(verifyMagicBytes(invalidExeBuffer, 'png'), false, 'Rejects executable disguised with .png extension');

  const pngRes = validateAttachment('sample.png', validPngBuffer);
  assert.strictEqual(pngRes.valid, true, 'Accepts valid PNG attachment');
  assert.strictEqual(pngRes.mimeType, 'image/png', 'Resolves image/png MIME');

  const pdfRes = validateAttachment('worksheet.pdf', validPdfBuffer);
  assert.strictEqual(pdfRes.valid, true, 'Accepts valid PDF attachment');
  assert.strictEqual(pdfRes.mimeType, 'application/pdf', 'Resolves application/pdf MIME');

  const badExtRes = validateAttachment('malware.exe', Buffer.from('malicious payload'));
  assert.strictEqual(badExtRes.valid, false, 'Rejects unsupported extension .exe');
  assert.strictEqual(badExtRes.code, 'UNSUPPORTED_EXTENSION');

  const fakePngRes = validateAttachment('fake.png', invalidExeBuffer);
  assert.strictEqual(fakePngRes.valid, false, 'Rejects file failing magic bytes verification');
  assert.strictEqual(fakePngRes.code, 'MAGIC_BYTES_MISMATCH');

  console.log('✅ File validation, magic bytes, and extension checks passed.');

  // 2. PATH TRAVERSAL SANITIZATION & UNIQUE KEY GENERATION
  console.log('\n--- 2. Path Traversal Sanitization & Key Generation ---');

  const traversalName = '../../../../etc/passwd..cheat.pdf';
  const sanitizedPdf = validateAttachment(traversalName, validPdfBuffer);
  assert.strictEqual(sanitizedPdf.valid, true);
  assert.strictEqual(sanitizedPdf.sanitizedName.includes('/'), false, 'Strips path traversal slashes');
  assert.strictEqual(sanitizedPdf.sanitizedName.includes('\\'), false, 'Strips Windows backslashes');

  const teacherKey = buildTeacherAssignmentStorageKey(
    'school-101',
    'asg-555',
    'att-001',
    '../../exam.pdf'
  );
  assert.strictEqual(
    teacherKey,
    'schools/school-101/assignments/asg-555/att-001_exam.pdf',
    'Teacher key correctly partitions by school, assignment, and sanitized attachment name'
  );

  const studentKey = buildStudentSubmissionStorageKey(
    'school-101',
    'sub-888',
    'att-999',
    'homework.png'
  );
  assert.strictEqual(
    studentKey,
    'schools/school-101/assignments/sub-888/submissions/att-999_homework.png',
    'Student key correctly partitions by school, submission, and attachment name'
  );

  console.log('✅ Storage key generation and path traversal sanitization passed.');

  // 3. INLINE PREVIEW VS DOWNLOAD DETERMINATION
  console.log('\n--- 3. Inline Preview vs. Attachment Download MIME Rules ---');

  assert.strictEqual(isInlinePreviewMime('application/pdf'), true, 'PDF displays inline');
  assert.strictEqual(isInlinePreviewMime('image/png'), true, 'PNG displays inline');
  assert.strictEqual(isInlinePreviewMime('image/jpeg'), true, 'JPEG displays inline');
  assert.strictEqual(isInlinePreviewMime('application/vnd.openxmlformats-officedocument.wordprocessingml.document'), false, 'DOCX triggers attachment download');
  assert.strictEqual(isInlinePreviewMime('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'), false, 'XLSX triggers attachment download');
  assert.strictEqual(isInlinePreviewMime('application/msword'), false, 'DOC triggers attachment download');

  console.log('✅ Inline preview vs download rules passed.');

  // 4. STORAGE CRUD OPERATIONS (IN-MEMORY TEST ENVIRONMENT)
  console.log('\n--- 4. Storage CRUD Operations in Test Mode ---');

  const testKey = 'schools/sch-1/assignments/asg-1/att-1_test.pdf';
  const testData = Buffer.from('%PDF-1.4 test document content');

  await uploadToStorage(testKey, testData, 'application/pdf');
  const downloaded = await downloadFromStorage(testKey);
  assert.strictEqual(downloaded.buffer.toString(), testData.toString(), 'Uploaded buffer matches downloaded buffer');
  assert.strictEqual(downloaded.mimeType, 'application/pdf', 'Downloaded MIME type is application/pdf');

  const delResult = await deleteFromStorage(testKey);
  assert.strictEqual(delResult.success, true, 'Deletion succeeds');
  assert.strictEqual(delResult.deleted, true, 'Confirms file was deleted');

  // Deleting again confirms absence cleanly without throwing
  const delAgain = await deleteFromStorage(testKey);
  assert.strictEqual(delAgain.success, true, 'Second deletion returns clean success');
  assert.strictEqual(delAgain.deleted, false, 'Confirms file was already absent');

  console.log('✅ Storage CRUD operations in test mode passed.');

  // 5. PRODUCTION/DEV SAFETY: PROPER 503 ERROR WHEN UNCONFIGURED
  console.log('\n--- 5. Runtime Safety: 503 Error on Unconfigured Production/Dev ---');

  process.env.NODE_ENV = 'development';
  let threw503 = false;
  let caughtError: any = null;
  try {
    await uploadToStorage('schools/sch/asg/att_file.pdf', testData, 'application/pdf');
  } catch (err: any) {
    threw503 = true;
    caughtError = err;
  } finally {
    process.env.NODE_ENV = 'test';
  }

  assert.strictEqual(threw503, true, 'Throws error when storage is not configured in development mode');
  assert.strictEqual(caughtError instanceof StorageConfigurationError, true, 'Error is instance of StorageConfigurationError');
  assert.strictEqual(caughtError.statusCode, 503, 'Error has HTTP 503 status code');
  assert.strictEqual(caughtError.code, 'STORAGE_CONFIGURATION_MISSING');

  console.log('✅ 503 StorageConfigurationError properly thrown when unconfigured in non-test mode.');

  // 6. BUCKET RESOLUTION WITHOUT GUESSING
  console.log('\n--- 6. Bucket Resolution Without Guessing ---');

  const prevBucket = process.env.FIREBASE_STORAGE_BUCKET;
  delete process.env.FIREBASE_STORAGE_BUCKET;

  const resolved = resolveStorageBucketName();
  assert.strictEqual(resolved, null, 'Does not guess or synthesize bucket name when unconfigured');

  const health = await getStorageHealth();
  assert.strictEqual(typeof health.status, 'string');
  assert.strictEqual(typeof health.message, 'string');

  console.log('✅ Bucket resolution and configuration safety passed.');

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('    ALL FIREBASE STORAGE ATTACHMENT TESTS PASSED SUCCESSFULLY   ');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

runTests().catch((err) => {
  console.error('Test failure:', err);
  process.exit(1);
});
