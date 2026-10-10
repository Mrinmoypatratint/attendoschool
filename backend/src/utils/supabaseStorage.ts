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

// In-memory test store when running automated tests without live Supabase storage secrets
const testStorageMock = new Map<string, { buffer: Buffer; mimeType: string }>();

export const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'pdf', 'xlsx', 'doc', 'docx'] as const;
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
export const MAX_TOTAL_SIZE = 25 * 1024 * 1024; // 25MB total per submission
export const MAX_FILES_COUNT = 5;

export const BUCKET_NAME = 'assignment-submissions';

/**
 * Derives the Supabase URL from parsed env configuration
 */
export function getSupabaseUrl(): string {
  if (env.supabaseUrl) {
    return env.supabaseUrl.replace(/\/+$/, '');
  }
  const dbUrl = env.supabaseDatabaseUrl || env.databaseUrl || '';
  const match = dbUrl.match(/postgres\.([a-z0-9]+):/i);
  if (match) {
    return `https://${match[1]}.supabase.co`;
  }
  return 'https://widbnephnmbufxaggflw.supabase.co';
}

/**
 * Gets the Supabase service role secret key from parsed env configuration
 */
export function getServiceRoleKey(): string {
  return env.supabaseServiceRoleKey;
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
 * Validates a single student uploaded attachment buffer
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
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
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

  // Sanitize file name (remove path traversals, special chars)
  const safeBase = cleanName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const mimeType = getMimeTypeForExtension(ext);

  return {
    valid: true,
    mimeType,
    buffer: buf,
    sanitizedName: safeBase
  };
}

/**
 * Ensures private Supabase Storage bucket exists via official Storage REST API
 */
export async function ensureBucketExists(): Promise<void> {
  const serviceKey = getServiceRoleKey();
  const supabaseUrl = getSupabaseUrl();

  if (!serviceKey) {
    if (process.env.NODE_ENV === 'test') {
      return; // In test mode without secrets, mock handles operations
    }
    throw new StorageConfigurationError();
  }

  try {
    const res = await fetch(`${supabaseUrl}/storage/v1/bucket/${BUCKET_NAME}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${serviceKey}`
      }
    });

    if (res.status === 200) {
      return; // Bucket exists
    }

    if (res.status === 404) {
      // Create private bucket with 10MB file limit
      const createRes = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: BUCKET_NAME,
          name: BUCKET_NAME,
          public: false,
          file_size_limit: MAX_FILE_SIZE,
          allowed_mime_types: [
            'image/png',
            'image/jpeg',
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/msword'
          ]
        })
      });

      if (!createRes.ok && createRes.status !== 409) {
        throw new Error(`Failed to initialize private storage bucket (status ${createRes.status})`);
      }
    }
  } catch (err: any) {
    if (process.env.NODE_ENV === 'test') return;
    throw err;
  }
}

/**
 * Uploads a file buffer to private Supabase Storage
 */
export async function uploadToStorage(storageKey: string, buffer: Buffer, mimeType: string): Promise<void> {
  const serviceKey = getServiceRoleKey();
  const supabaseUrl = getSupabaseUrl();

  if (!serviceKey) {
    if (process.env.NODE_ENV === 'test') {
      testStorageMock.set(storageKey, { buffer, mimeType });
      return;
    }
    throw new StorageConfigurationError();
  }

  await ensureBucketExists();

  const uploadUrl = `${supabaseUrl}/storage/v1/object/${BUCKET_NAME}/${storageKey}`;
  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': mimeType,
      'x-upsert': 'true'
    },
    body: new Uint8Array(buffer)
  });

  if (!res.ok) {
    throw new Error(`Supabase Storage upload failed with status ${res.status}`);
  }
}

/**
 * Creates a short-lived signed URL (60 seconds) for private document access
 */
export async function getSignedUrl(storageKey: string, expiresInSeconds: number = 60): Promise<string> {
  const serviceKey = getServiceRoleKey();
  const supabaseUrl = getSupabaseUrl();

  if (!serviceKey) {
    if (process.env.NODE_ENV === 'test') {
      return `/mock-signed-url/${storageKey}`;
    }
    throw new StorageConfigurationError();
  }

  const signUrl = `${supabaseUrl}/storage/v1/object/sign/${BUCKET_NAME}/${storageKey}`;
  const res = await fetch(signUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ expiresIn: expiresInSeconds })
  });

  if (!res.ok) {
    throw new Error(`Failed to generate signed URL (status ${res.status})`);
  }

  const data: any = await res.json();
  const signedPath = data.signedURL || data.signedUrl;
  if (!signedPath) {
    throw new Error('Supabase Storage returned invalid signed URL payload');
  }

  if (signedPath.startsWith('http://') || signedPath.startsWith('https://')) {
    return signedPath;
  }
  return `${supabaseUrl}/storage/v1${signedPath}`;
}

/**
 * Downloads private file buffer from Supabase Storage for streaming
 */
export async function downloadFromStorage(storageKey: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const serviceKey = getServiceRoleKey();
  const supabaseUrl = getSupabaseUrl();

  if (!serviceKey) {
    if (process.env.NODE_ENV === 'test' && testStorageMock.has(storageKey)) {
      return testStorageMock.get(storageKey)!;
    }
    throw new StorageConfigurationError();
  }

  const downloadUrl = `${supabaseUrl}/storage/v1/object/authenticated/${BUCKET_NAME}/${storageKey}`;
  const res = await fetch(downloadUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${serviceKey}`
    }
  });

  if (!res.ok) {
    throw new Error(`Supabase Storage download failed with status ${res.status}`);
  }

  const arrayBuf = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuf);
  const mimeType = res.headers.get('content-type') || 'application/octet-stream';
  return { buffer, mimeType };
}

/**
 * Deletes a file from Supabase Storage
 */
export async function deleteFromStorage(storageKey: string): Promise<void> {
  const serviceKey = getServiceRoleKey();
  const supabaseUrl = getSupabaseUrl();

  if (!serviceKey) {
    if (process.env.NODE_ENV === 'test') {
      testStorageMock.delete(storageKey);
      return;
    }
    return;
  }

  const deleteUrl = `${supabaseUrl}/storage/v1/object/${BUCKET_NAME}/${storageKey}`;
  await fetch(deleteUrl, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${serviceKey}`
    }
  }).catch(() => {});
}
