import { getStorage } from 'firebase-admin/storage';
import { firebaseApp, isFirebaseConfigured } from '../firebase';
import { env } from '../config/env';

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
  if (isStorageEmulatorActive()) return Boolean(resolveStorageBucketName());
  return isFirebaseConfigured() && Boolean(resolveStorageBucketName());
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
 * Uploads a file buffer to private Firebase Storage
 */
export async function uploadToStorage(storageKey: string, buffer: Buffer, mimeType: string): Promise<void> {
  if (process.env.NODE_ENV === 'test') {
    testStorageMock.set(storageKey, { buffer, mimeType });
    return;
  }

  const bucket = getStorageBucket();
  if (!bucket) {
    throw new StorageConfigurationError();
  }

  const file = bucket.file(storageKey);
  try {
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
  } catch (err: any) {
    console.error(`[FirebaseStorage] Upload failed for key '${storageKey}':`, err.message);
    throw new Error(`Firebase Storage upload failed: ${err.message || 'Unknown error'}`);
  }
}

/**
 * Downloads private file buffer from Firebase Storage for authenticated streaming
 */
export async function downloadFromStorage(storageKey: string): Promise<{ buffer: Buffer; mimeType: string }> {
  if (process.env.NODE_ENV === 'test') {
    if (testStorageMock.has(storageKey)) {
      return testStorageMock.get(storageKey)!;
    }
    throw new Error(`File not found in storage: ${storageKey}`);
  }

  const bucket = getStorageBucket();
  if (!bucket) {
    throw new StorageConfigurationError();
  }

  const file = bucket.file(storageKey);
  try {
    const [exists] = await file.exists();
    if (!exists) {
      throw new Error(`File not found in storage: ${storageKey}`);
    }

    const [buffer] = await file.download();
    const [metadata] = await file.getMetadata().catch(() => [{} as any]);
    const mimeType = (metadata?.contentType as string) || 'application/octet-stream';

    return { buffer, mimeType };
  } catch (err: any) {
    if (err instanceof StorageConfigurationError) throw err;
    console.error(`[FirebaseStorage] Download failed for key '${storageKey}':`, err.message);
    throw new Error(`Firebase Storage download failed: ${err.message || 'File not available'}`);
  }
}

/**
 * Deletes a file from Firebase Storage
 * Returns { success: boolean, deleted: boolean }
 */
export async function deleteFromStorage(storageKey: string): Promise<{ success: boolean; deleted: boolean }> {
  if (process.env.NODE_ENV === 'test') {
    const had = testStorageMock.has(storageKey);
    testStorageMock.delete(storageKey);
    return { success: true, deleted: had };
  }

  const bucket = getStorageBucket();
  if (!bucket) {
    throw new StorageConfigurationError();
  }

  const file = bucket.file(storageKey);
  try {
    const [exists] = await file.exists();
    if (!exists) {
      return { success: true, deleted: false }; // Confirmed absent
    }
    await file.delete();
    return { success: true, deleted: true };
  } catch (err: any) {
    if (err.code === 404) {
      return { success: true, deleted: false };
    }
    console.error(`[FirebaseStorage] Delete failed for key '${storageKey}':`, err.message);
    throw new Error(`Firebase Storage deletion failed: ${err.message}`);
  }
}

/**
 * Safely inspects Firebase storage configuration and bucket availability without leaking credentials
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
      message: 'Firebase Storage bucket is not configured. Set FIREBASE_STORAGE_BUCKET in your environment.'
    };
  }

  if (!hasCredentials && !emulator && process.env.NODE_ENV !== 'test') {
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

  if (process.env.NODE_ENV === 'test') {
    return {
      configured: true,
      hasBucket: true,
      hasCredentials: true,
      emulator: false,
      bucketName,
      status: 'READY',
      message: 'Test storage mock is active.'
    };
  }

  try {
    const bucket = getStorage(firebaseApp).bucket(bucketName!);
    const [exists] = await bucket.exists();
    if (exists) {
      return {
        configured: true,
        hasBucket: true,
        hasCredentials: true,
        emulator,
        bucketName,
        status: 'READY',
        message: `Firebase Storage is ready. Bucket '${bucketName}' exists and is accessible.`
      };
    } else {
      return {
        configured: false,
        hasBucket: true,
        hasCredentials: true,
        emulator,
        bucketName,
        status: 'ERROR',
        message: `Bucket '${bucketName}' does not exist or access was denied.`
      };
    }
  } catch (err: any) {
    return {
      configured: false,
      hasBucket: true,
      hasCredentials: true,
      emulator,
      bucketName,
      status: 'ERROR',
      message: `Failed to connect to Firebase Storage: ${err.message || 'Access error'}`
    };
  }
}
