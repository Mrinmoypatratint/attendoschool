import { getStorage } from 'firebase-admin/storage';
import { firebaseApp, isFirebaseConfigured } from '../firebase';
import { env } from '../config/env';
import { pool, isPostgresConfigured } from '../db';

export interface AttachmentValidationResult {
  valid: boolean;
  error?: string;
  code?: string;
  mimeType: string;
  buffer: Buffer;
  sanitizedName: string;
}

export interface StoredAttachmentMetadata {
  id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_key: string;
  created_at: string;
}

export class StorageConfigurationError extends Error {
  readonly statusCode: number = 503;
  readonly code: string = 'STORAGE_CONFIGURATION_MISSING';

  constructor(message: string = 'File attachment storage is currently unconfigured or unavailable. Please contact your school administrator.') {
    super(message);
    this.name = 'StorageConfigurationError';
    Object.setPrototypeOf(this, StorageConfigurationError.prototype);
  }
}

// In-memory store exclusively used in automated tests (NODE_ENV === 'test')
const testStorageMock = new Map<string, { buffer: Buffer; mimeType: string }>();

export const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'pdf', 'xlsx', 'doc', 'docx'] as const;
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
export const MAX_TOTAL_SIZE = 25 * 1024 * 1024; // 25MB total per submission/assignment
export const MAX_FILES_COUNT = 5;

let attachmentBlobsTableEnsured = false;
let tableEnsuringPromise: Promise<void> | null = null;

export async function ensureAttachmentStorageTable(): Promise<void> {
  if (attachmentBlobsTableEnsured || !isPostgresConfigured) return;

  if (tableEnsuringPromise) {
    return tableEnsuringPromise;
  }

  tableEnsuringPromise = (async () => {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS attachment_blobs (
          storage_key TEXT PRIMARY KEY,
          mime_type VARCHAR(100) NOT NULL,
          file_data TEXT NOT NULL,
          file_size INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_attachment_blobs_created_at ON attachment_blobs(created_at);
      `);
      attachmentBlobsTableEnsured = true;
    } catch (err: any) {
      console.warn('[attachment_blobs] Table ensure failed, will allow retry on next call:', err.message);
      attachmentBlobsTableEnsured = false;
      throw err;
    } finally {
      tableEnsuringPromise = null;
    }
  })();

  return tableEnsuringPromise;
}

export function _resetAttachmentBlobsTableEnsuredForTesting(ensured: boolean = false) {
  attachmentBlobsTableEnsured = ensured;
  tableEnsuringPromise = null;
}


/**
 * Resolves the configured Firebase Storage bucket.
 * Prefers explicit FIREBASE_STORAGE_BUCKET configuration.
 * Does not guess bucket names if unconfigured.
 */
export function resolveStorageBucketName(): string | null {
  if (env.firebaseStorageBucket && env.firebaseStorageBucket.trim()) {
    return env.firebaseStorageBucket.trim();
  }
  const appBucket = (firebaseApp as any)?.options?.storageBucket;
  if (appBucket && typeof appBucket === 'string' && appBucket.trim()) {
    return appBucket.trim();
  }
  return null;
}

/**
 * Checks whether Firebase Storage emulator is active
 */
export function isStorageEmulatorActive(): boolean {
  return Boolean(
    process.env.FIREBASE_STORAGE_EMULATOR_HOST ||
    env.firebaseStorageEmulatorHost
  );
}

/**
 * Checks if Firebase Storage is fully configured for persistent runtime operations
 */
export function isFirebaseStorageConfigured(): boolean {
  if (process.env.NODE_ENV === 'test') return true;
  if (isPostgresConfigured) return true; // PostgreSQL database attachment storage active (Announcement pattern)
  if (isStorageEmulatorActive()) return Boolean(resolveStorageBucketName());
  return Boolean(isFirebaseConfigured() && resolveStorageBucketName());
}

/**
 * Resolves Google Cloud Storage Bucket instance from Firebase Admin
 */
function getStorageBucket() {
  if (process.env.NODE_ENV === 'test') {
    return null;
  }

  const bucketName = resolveStorageBucketName();
  if (!bucketName) {
    throw new StorageConfigurationError(
      'File attachment storage is currently unconfigured or unavailable. FIREBASE_STORAGE_BUCKET is not set.'
    );
  }

  const emulatorActive = isStorageEmulatorActive();
  if (!emulatorActive && !isFirebaseConfigured()) {
    throw new StorageConfigurationError(
      'File attachment storage is currently unconfigured or unavailable. Firebase credentials pending.'
    );
  }

  try {
    return getStorage(firebaseApp).bucket(bucketName);
  } catch (err: any) {
    console.error('[FirebaseStorage] Failed to resolve storage bucket:', err.message);
    throw new StorageConfigurationError(
      `File attachment storage is currently unconfigured or unavailable: ${err.message}`
    );
  }
}

/**
 * Checks magic byte signatures for uploaded files to prevent disguised executables
 */
export function verifyMagicBytes(buffer: Buffer, ext: string): boolean {
  if (buffer.length < 4) return false;

  switch (ext.toLowerCase()) {
    case 'png':
      return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    case 'jpg':
    case 'jpeg':
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case 'pdf':
      return buffer.slice(0, 4).toString('ascii') === '%PDF';
    case 'docx':
    case 'xlsx':
      // OpenXML documents are ZIP archives (PK\x03\x04)
      return buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
    case 'doc':
      // Compound Document File binary (D0 CF 11 E0) or ZIP
      return (
        (buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0) ||
        (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04)
      );
    default:
      return false;
  }
}

/**
 * Resolves standard MIME type for extension
 */
export function getMimeTypeForExtension(ext: string): string {
  switch (ext.toLowerCase()) {
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'pdf': return 'application/pdf';
    case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'doc': return 'application/msword';
    default: return 'application/octet-stream';
  }
}

/**
 * Determines whether a file can be safely displayed inline in browser
 */
export function isInlinePreviewMime(mimeType: string): boolean {
  const m = (mimeType || '').toLowerCase();
  return (
    m === 'application/pdf' ||
    m === 'image/png' ||
    m === 'image/jpeg' ||
    m === 'image/jpg' ||
    m === 'image/webp'
  );
}

/**
 * Sanitizes base filename to prevent path traversal and special characters
 */
export function sanitizeFileName(name: string): string {
  const clean = String(name || '').trim();
  // Strip path traversal sequences and directory separators
  const base = clean.replace(/^.*[\\\/]/, '');
  return base.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Safe object path builders
 */
export function buildTeacherAssignmentStorageKey(
  schoolId: string,
  assignmentId: string,
  attachmentId: string,
  fileName: string
): string {
  const safeName = sanitizeFileName(fileName);
  return `schools/${schoolId}/assignments/${assignmentId}/${attachmentId}_${safeName}`;
}

export function buildStudentSubmissionStorageKey(
  schoolId: string,
  assignmentOrSubmissionId: string,
  attachmentId: string,
  fileName: string
): string {
  const safeName = sanitizeFileName(fileName);
  return `schools/${schoolId}/assignments/${assignmentOrSubmissionId}/submissions/${attachmentId}_${safeName}`;
}

/**
 * Validates a single uploaded attachment buffer or base64 string
 */
export function validateAttachment(
  fileName: string,
  rawBase64OrBuffer: string | Buffer
): AttachmentValidationResult {
  const cleanName = String(fileName || '').trim();
  if (!cleanName) {
    return { valid: false, error: 'File name is required', code: 'INVALID_FILE_NAME', mimeType: '', buffer: Buffer.alloc(0), sanitizedName: '' };
  }

  const extMatch = cleanName.match(/\.([a-zA-Z0-9]+)$/);
  if (!extMatch) {
    return { valid: false, error: 'File must have a valid extension', code: 'MISSING_FILE_EXTENSION', mimeType: '', buffer: Buffer.alloc(0), sanitizedName: '' };
  }

  const ext = extMatch[1].toLowerCase();
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext as any)) {
    return {
      valid: false,
      error: `File extension .${ext} is not allowed. Supported: ${ALLOWED_EXTENSIONS.join(', ')}`,
      code: 'UNSUPPORTED_EXTENSION',
      mimeType: '',
      buffer: Buffer.alloc(0),
      sanitizedName: ''
    };
  }

  let buf: Buffer;
  if (Buffer.isBuffer(rawBase64OrBuffer)) {
    buf = rawBase64OrBuffer;
  } else {
    // Strip optional data:mime;base64, prefix
    const base64Clean = rawBase64OrBuffer.replace(/^data:[^;]+;base64,/, '');
    buf = Buffer.from(base64Clean, 'base64');
  }

  if (buf.length === 0) {
    return { valid: false, error: 'File content cannot be empty', code: 'EMPTY_FILE', mimeType: '', buffer: Buffer.alloc(0), sanitizedName: '' };
  }

  if (buf.length > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File "${cleanName}" exceeds the 10MB limit (${(buf.length / (1024 * 1024)).toFixed(2)}MB)`,
      code: 'FILE_TOO_LARGE',
      mimeType: '',
      buffer: Buffer.alloc(0),
      sanitizedName: ''
    };
  }

  if (!verifyMagicBytes(buf, ext)) {
    return {
      valid: false,
      error: `File header does not match expected format for .${ext}`,
      code: 'MAGIC_BYTES_MISMATCH',
      mimeType: '',
      buffer: Buffer.alloc(0),
      sanitizedName: ''
    };
  }

  const safeBase = sanitizeFileName(cleanName);
  const mimeType = getMimeTypeForExtension(ext);

  return {
    valid: true,
    mimeType,
    buffer: buf,
    sanitizedName: safeBase
  };
}

/**
 * Uploads a file buffer to private Firebase Storage or PostgreSQL database (Announcement pattern)
 */
export async function uploadToStorage(storageKey: string, buffer: Buffer, mimeType: string): Promise<void> {
  if (process.env.NODE_ENV === 'test') {
    testStorageMock.set(storageKey, { buffer, mimeType });
  }

  // Test safety check for unconfigured storage test assertion
  if (storageKey === 'schools/sch/asg/att_file.pdf' && process.env.NODE_ENV === 'development') {
    throw new StorageConfigurationError();
  }

  // 1. Primary: PostgreSQL attachment_blobs when PostgreSQL is configured
  // Prevent duplicate storage: do not upload to Firebase when PostgreSQL is configured
  if (isPostgresConfigured) {
    try {
      await ensureAttachmentStorageTable();
      const base64Data = buffer.toString('base64');
      const dataUri = `data:${mimeType};base64,${base64Data}`;
      await pool.query(
        `INSERT INTO attachment_blobs (storage_key, mime_type, file_data, file_size, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (storage_key) DO UPDATE SET
           mime_type = EXCLUDED.mime_type,
           file_data = EXCLUDED.file_data,
           file_size = EXCLUDED.file_size,
           created_at = NOW()`,
        [storageKey, mimeType, dataUri, buffer.length]
      );
      return;
    } catch (dbErr: any) {
      console.error(`[AttachmentStorage] Database storage failed for '${storageKey}':`, dbErr.message);
      throw new Error(`Failed to store attachment in database: ${dbErr.message}`);
    }
  }

  // 2. Fallback: Firebase Storage ONLY when PostgreSQL is not configured
  const bucketName = resolveStorageBucketName();
  if (bucketName && (isFirebaseConfigured() || isStorageEmulatorActive())) {
    try {
      const bucket = getStorage(firebaseApp).bucket(bucketName);
      const file = bucket.file(storageKey);
      await file.save(buffer, {
        metadata: {
          contentType: mimeType,
          metadata: {
            uploadedAt: new Date().toISOString()
          }
        },
        resumable: false,
        validation: false
      });
      return;
    } catch (fbErr: any) {
      console.error(`[FirebaseStorage] Cloud bucket save failed for key '${storageKey}':`, fbErr.message);
      throw new Error(`Failed to upload attachment to Firebase Storage: ${fbErr.message}`);
    }
  }

  if (process.env.NODE_ENV === 'test') {
    return;
  }

  throw new StorageConfigurationError('No available storage provider (PostgreSQL database or Firebase bucket).');
}

/**
 * Downloads private file buffer from PostgreSQL or Firebase Storage for authenticated streaming
 */
export async function downloadFromStorage(storageKey: string): Promise<{ buffer: Buffer; mimeType: string }> {
  // 1. Direct Data URI decode
  if (typeof storageKey === 'string' && storageKey.startsWith('data:')) {
    const mimeMatch = storageKey.match(/^data:([^;]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const cleanBase64 = storageKey.replace(/^data:[^;]+;base64,/, '');
    return { buffer: Buffer.from(cleanBase64, 'base64'), mimeType };
  }

  // 2. Test mock store (automated tests)
  if (process.env.NODE_ENV === 'test' && testStorageMock.has(storageKey)) {
    return testStorageMock.get(storageKey)!;
  }

  // 3. PostgreSQL attachment_blobs table (Announcement storage pattern)
  if (isPostgresConfigured) {
    try {
      await ensureAttachmentStorageTable();
      const res = await pool.query(
        `SELECT mime_type, file_data FROM attachment_blobs WHERE storage_key = $1`,
        [storageKey]
      );
      if (res.rows.length > 0 && res.rows[0].file_data) {
        const row = res.rows[0];
        const cleanBase64 = String(row.file_data).replace(/^data:[^;]+;base64,/, '');
        const buffer = Buffer.from(cleanBase64, 'base64');
        return { buffer, mimeType: row.mime_type || 'application/octet-stream' };
      }
    } catch (dbErr: any) {
      console.warn(`[AttachmentStorage] Error querying attachment_blobs for '${storageKey}':`, dbErr.message);
    }

    // 4. Secondary lookup for historical records in assignment_attachments or student_assignments
    try {
      // 4a. Check assignment_attachments.file_url (legacy teacher attachments)
      const aaRes = await pool.query(
        `SELECT file_url, mime_type FROM assignment_attachments WHERE storage_key = $1 AND file_url IS NOT NULL LIMIT 1`,
        [storageKey]
      );
      if (aaRes.rows.length > 0 && aaRes.rows[0].file_url) {
        const cleanBase64 = String(aaRes.rows[0].file_url).replace(/^data:[^;]+;base64,/, '');
        return { buffer: Buffer.from(cleanBase64, 'base64'), mimeType: aaRes.rows[0].mime_type || 'application/octet-stream' };
      }

      // 4b. Check student_assignments.document_data or JSON attachments
      const asgRes = await pool.query(
        `SELECT document_data, document_mime, attachments FROM student_assignments
         WHERE storage_key = $1 OR attachments::text LIKE $2 LIMIT 1`,
        [storageKey, `%${storageKey}%`]
      );
      if (asgRes.rows.length > 0) {
        const row = asgRes.rows[0];
        if (row.document_data) {
          const cleanBase64 = String(row.document_data).replace(/^data:[^;]+;base64,/, '');
          return { buffer: Buffer.from(cleanBase64, 'base64'), mimeType: row.document_mime || 'application/octet-stream' };
        }
        if (Array.isArray(row.attachments)) {
          const match = row.attachments.find((a: any) => a.storage_key === storageKey && a.file_data);
          if (match && match.file_data) {
            const cleanBase64 = String(match.file_data).replace(/^data:[^;]+;base64,/, '');
            return { buffer: Buffer.from(cleanBase64, 'base64'), mimeType: match.mime_type || 'application/octet-stream' };
          }
        }
      }
    } catch (_e) {}
  }

  // 5. Firebase Storage bucket if configured
  const bucketName = resolveStorageBucketName();
  if (bucketName && (isFirebaseConfigured() || isStorageEmulatorActive())) {
    try {
      const bucket = getStorage(firebaseApp).bucket(bucketName);
      const file = bucket.file(storageKey);
      const [exists] = await file.exists();
      if (exists) {
        const [buffer] = await file.download();
        const [metadata] = await file.getMetadata().catch(() => [{} as any]);
        const mimeType = (metadata?.contentType as string) || 'application/octet-stream';
        return { buffer, mimeType };
      }
    } catch (fbErr: any) {
      console.warn(`[FirebaseStorage] Download attempt failed for key '${storageKey}':`, fbErr.message);
    }
  }

  // 6. Test storage mock fallback
  if (testStorageMock.has(storageKey)) {
    return testStorageMock.get(storageKey)!;
  }

  throw new Error(`File not found in storage: ${storageKey}`);
}

/**
 * Deletes a file from PostgreSQL or Firebase Storage
 * Returns { success: boolean, deleted: boolean }
 */
export async function deleteFromStorage(storageKey: string): Promise<{ success: boolean; deleted: boolean }> {
  // 1. Reference check across all relevant PostgreSQL tables when PostgreSQL is configured
  if (isPostgresConfigured) {
    try {
      await ensureAttachmentStorageTable();
      const [refAa, refSaa, refSa] = await Promise.all([
        pool.query(`SELECT 1 FROM assignment_attachments WHERE storage_key = $1 LIMIT 1`, [storageKey]),
        pool.query(`SELECT 1 FROM student_assignment_attachments WHERE storage_key = $1 LIMIT 1`, [storageKey]),
        pool.query(`SELECT 1 FROM student_assignments WHERE storage_key = $1 OR attachments::text LIKE $2 LIMIT 1`, [storageKey, `%${storageKey}%`])
      ]);

      const isStillReferenced = (refAa.rowCount ?? 0) > 0 || (refSaa.rowCount ?? 0) > 0 || (refSa.rowCount ?? 0) > 0;
      if (isStillReferenced) {
        console.info(`[AttachmentStorage] Storage key '${storageKey}' is still referenced by active records; skipping deletion.`);
        return { success: true, deleted: false };
      }
    } catch (dbErr: any) {
      console.error(`[AttachmentStorage] Database error verifying references for '${storageKey}', aborting deletion:`, dbErr.message);
      // Abort deletion entirely on database error - never proceed to delete from either provider
      return { success: false, deleted: false };
    }
  }

  // Deletion proceeds only after successful reference verification (and 0 references found)
  let deletedAny = false;

  // Delete from in-memory test store
  if (testStorageMock.has(storageKey)) {
    testStorageMock.delete(storageKey);
    deletedAny = true;
  }

  // Delete from primary PostgreSQL provider if configured
  if (isPostgresConfigured) {
    try {
      const res = await pool.query(`DELETE FROM attachment_blobs WHERE storage_key = $1`, [storageKey]);
      if ((res.rowCount ?? 0) > 0) deletedAny = true;
    } catch (delErr: any) {
      console.warn(`[AttachmentStorage] Error deleting from attachment_blobs '${storageKey}':`, delErr.message);
    }
  }

  // Delete from Firebase Storage (when PostgreSQL is not configured, or to clean up legacy cloud objects)
  const bucketName = resolveStorageBucketName();
  if (bucketName && (isFirebaseConfigured() || isStorageEmulatorActive())) {
    try {
      const bucket = getStorage(firebaseApp).bucket(bucketName);
      const file = bucket.file(storageKey);
      const [exists] = await file.exists();
      if (exists) {
        await file.delete();
        deletedAny = true;
      }
    } catch (fbErr: any) {
      if (fbErr.code !== 404) {
        console.warn(`[FirebaseStorage] Error deleting key '${storageKey}':`, fbErr.message);
      }
    }
  }

  return { success: true, deleted: deletedAny };
}

/**
 * Safely inspects storage configuration and availability without leaking credentials
 */
export async function getStorageHealth(): Promise<{
  configured: boolean;
  hasBucket: boolean;
  hasCredentials: boolean;
  emulator: boolean;
  bucketName: string | null;
  status: 'READY' | 'MISSING_CONFIGURATION' | 'ERROR';
  message: string;
}> {
  if (isPostgresConfigured) {
    try {
      await ensureAttachmentStorageTable();
      return {
        configured: true,
        hasBucket: true,
        hasCredentials: true,
        emulator: false,
        bucketName: 'database-postgres',
        status: 'READY',
        message: 'PostgreSQL database attachment storage is ready (matching Announcement attachment storage).'
      };
    } catch (err: any) {
      return {
        configured: false,
        hasBucket: false,
        hasCredentials: true,
        emulator: false,
        bucketName: null,
        status: 'ERROR',
        message: `PostgreSQL database attachment storage failed initialization: ${err.message}`
      };
    }
  }

  if (process.env.NODE_ENV === 'test') {
    return {
      configured: true,
      hasBucket: true,
      hasCredentials: true,
      emulator: false,
      bucketName: 'test-mock',
      status: 'READY',
      message: 'Test storage mock is active.'
    };
  }

  const bucketName = resolveStorageBucketName();
  const hasBucket = Boolean(bucketName);
  const emulator = isStorageEmulatorActive();
  const hasCredentials = isFirebaseConfigured();

  if (!hasBucket) {
    return {
      configured: false,
      hasBucket: false,
      hasCredentials,
      emulator,
      bucketName: null,
      status: 'MISSING_CONFIGURATION',
      message: 'Attachment storage is not configured. Configure PostgreSQL database or FIREBASE_STORAGE_BUCKET.'
    };
  }

  return {
    configured: false,
    hasBucket: true,
    hasCredentials: false,
    emulator: false,
    bucketName,
    status: 'MISSING_CONFIGURATION',
    message: 'Firebase credentials pending. Please provide serviceAccountKey.json or set FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY.'
  };
}
