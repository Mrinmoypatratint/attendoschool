import 'dotenv/config';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore, CollectionReference, DocumentData } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';
import { env } from './config/env';

let firebaseApp: App;
let connectionMode: 'live_cloud' | 'emulator' | 'local_unconfigured' = 'local_unconfigured';
let credentialSource: string = 'None';
let resolvedProjectId: string = env.firebaseProjectId || 'attendoschool';

/**
 * Automatically locate service account key file if present
 */
export function resolveServiceAccountPath(): string | null {
  const candidates = [
    env.firebaseServiceAccountPath,
    path.resolve(process.cwd(), 'serviceAccountKey.json'),
    path.resolve(process.cwd(), 'backend/serviceAccountKey.json'),
    path.resolve(__dirname, '../serviceAccountKey.json'),
    path.resolve(__dirname, '../../serviceAccountKey.json'),
    process.env.GOOGLE_APPLICATION_CREDENTIALS
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    try {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        return p;
      }
    } catch {}
  }
  return null;
}

export const findServiceAccountPath = resolveServiceAccountPath;

const serviceAccountFilePath = resolveServiceAccountPath();

try {
  const existingApps = getApps();
  if (existingApps.length > 0) {
    firebaseApp = existingApps[0]!;
    connectionMode = 'live_cloud';
    credentialSource = 'Existing App Instance';
  } else if (serviceAccountFilePath) {
    // 1. Live Google Cloud credentials via Service Account JSON File
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountFilePath, 'utf8'));
    resolvedProjectId = serviceAccount.project_id || env.firebaseProjectId || 'attendoschool';
    firebaseApp = initializeApp({
      credential: cert(serviceAccount),
      projectId: resolvedProjectId
    });
    connectionMode = 'live_cloud';
    credentialSource = `Service Account File: ${path.basename(serviceAccountFilePath)}`;
    console.log(`[Firebase] Connected to Live Google Cloud Firestore (Project: ${resolvedProjectId}) via ${serviceAccountFilePath}`);
  } else if (env.firebaseServiceAccount) {
    // 2. Live Google Cloud credentials via Direct JSON String or Base64 in Environment Variable
    let serviceAccount: any;
    try {
      const raw = env.firebaseServiceAccount.trim();
      const text = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
      serviceAccount = JSON.parse(text);
    } catch (parseErr: any) {
      throw new Error(`Failed to parse FIREBASE_SERVICE_ACCOUNT: ${parseErr.message}`);
    }
    resolvedProjectId = serviceAccount.project_id || env.firebaseProjectId || 'attendoschool';
    firebaseApp = initializeApp({
      credential: cert(serviceAccount),
      projectId: resolvedProjectId
    });
    connectionMode = 'live_cloud';
    credentialSource = 'Environment Variable (FIREBASE_SERVICE_ACCOUNT)';
    console.log(`[Firebase] Connected to Live Google Cloud Firestore (Project: ${resolvedProjectId})`);
  } else if (env.firebaseClientEmail && env.firebasePrivateKey) {
    // 3. Live Google Cloud credentials via Direct Environment Variables
    resolvedProjectId = env.firebaseProjectId || 'attendoschool';
    firebaseApp = initializeApp({
      credential: cert({
        projectId: resolvedProjectId,
        clientEmail: env.firebaseClientEmail,
        privateKey: env.firebasePrivateKey,
      }),
      projectId: resolvedProjectId
    });
    connectionMode = 'live_cloud';
    credentialSource = 'Environment Variables (FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY)';
    console.log(`[Firebase] Connected to Live Google Cloud Firestore (Project: ${resolvedProjectId})`);
  } else if (env.firestoreEmulatorHost) {
    // 4. Local Firestore Emulator
    process.env.FIRESTORE_EMULATOR_HOST = env.firestoreEmulatorHost;
    firebaseApp = initializeApp({
      projectId: resolvedProjectId
    });
    connectionMode = 'emulator';
    credentialSource = `Local Emulator: ${env.firestoreEmulatorHost}`;
    console.log(`[Firebase] Initialized in Emulator mode (Host: ${env.firestoreEmulatorHost}, Project: ${resolvedProjectId})`);
  } else {
    // 5. Default fallback development
    firebaseApp = initializeApp({
      projectId: resolvedProjectId
    });
    connectionMode = 'local_unconfigured';
    credentialSource = 'Default Development ID';
    console.log(`[Firebase] Initialized in local dev mode (Project: ${resolvedProjectId})`);
  }
} catch (error: any) {
  console.warn('[Firebase] Warning during initialization:', error.message);
  const apps = getApps();
  firebaseApp = apps.length > 0 ? apps[0]! : initializeApp({ projectId: resolvedProjectId });
}

export const firestore: Firestore = getFirestore(firebaseApp);

// Settings for Firestore
try {
  firestore.settings({ ignoreUndefinedProperties: true });
} catch {}

// Named collection references for type safety and consistency
export const collections = {
  schools: (): CollectionReference<DocumentData> => firestore.collection('schools'),
  users: (): CollectionReference<DocumentData> => firestore.collection('users'),
  students: (): CollectionReference<DocumentData> => firestore.collection('students'),
  classes: (): CollectionReference<DocumentData> => firestore.collection('classes'),
  sections: (): CollectionReference<DocumentData> => firestore.collection('sections'),
  attendanceSessions: (): CollectionReference<DocumentData> => firestore.collection('attendance_sessions'),
  attendanceRecords: (): CollectionReference<DocumentData> => firestore.collection('attendance_records'),
  subscriptionPlans: (): CollectionReference<DocumentData> => firestore.collection('subscription_plans'),
  schoolSubscriptions: (): CollectionReference<DocumentData> => firestore.collection('school_subscriptions'),
  payments: (): CollectionReference<DocumentData> => firestore.collection('payments'),
  invoices: (): CollectionReference<DocumentData> => firestore.collection('invoices'),
  timetables: (): CollectionReference<DocumentData> => firestore.collection('timetables'),
  timetablePeriods: (): CollectionReference<DocumentData> => firestore.collection('timetable_periods'),
  timetableEntries: (): CollectionReference<DocumentData> => firestore.collection('timetable_entries'),
  teachers: (): CollectionReference<DocumentData> => firestore.collection('teachers'),
  subjects: (): CollectionReference<DocumentData> => firestore.collection('subjects'),
  teacherAssignments: (): CollectionReference<DocumentData> => firestore.collection('teacher_assignments'),
  notifications: (): CollectionReference<DocumentData> => firestore.collection('notifications'),
  announcements: (): CollectionReference<DocumentData> => firestore.collection('announcements'),
  auditLogs: (): CollectionReference<DocumentData> => firestore.collection('audit_logs'),
};

export function isFirebaseConfigured(): boolean {
  return connectionMode === 'live_cloud' || connectionMode === 'emulator' || Boolean(resolveServiceAccountPath());
}

export function getFirebaseStatus() {
  return {
    configured: isFirebaseConfigured(),
    mode: connectionMode,
    projectId: resolvedProjectId,
    credentialSource,
    serviceAccountDetected: Boolean(serviceAccountFilePath)
  };
}

/**
 * Health check helper for Cloud Firestore
 */
export async function checkFirestoreHealth(): Promise<{
  ok: boolean;
  message: string;
  mode?: string;
  projectId?: string;
  credentialSource?: string;
  timestamp?: string;
}> {
  if (!isFirebaseConfigured()) {
    return {
      ok: false,
      message: 'Firebase credentials pending. Place serviceAccountKey.json in backend/ or set FIREBASE_CLIENT_EMAIL in .env',
      mode: connectionMode,
      projectId: resolvedProjectId,
      credentialSource
    };
  }
  try {
    const testDoc = await firestore.collection('_system_health').doc('ping').get();
    return {
      ok: true,
      message: connectionMode === 'live_cloud'
        ? 'Live Google Cloud Firestore connection active'
        : 'Firestore connection active (Emulator mode)',
      mode: connectionMode,
      projectId: resolvedProjectId,
      credentialSource,
      timestamp: new Date().toISOString()
    };
  } catch (err: any) {
    return {
      ok: false,
      message: `Firestore connection error: ${err.message}`,
      mode: connectionMode,
      projectId: resolvedProjectId,
      credentialSource
    };
  }
}

export default firestore;
