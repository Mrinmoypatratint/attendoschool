import 'dotenv/config';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore, CollectionReference, DocumentData } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';
import { env } from './config/env';

let firebaseApp: App;
let connectionMode: 'live_cloud' | 'emulator' | 'local_unconfigured' = 'local_unconfigured';
let credentialSource: string = 'None';
let resolvedProjectId: string = env.firebaseProjectId || 'attendoschool-2d0fb';

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
    path.resolve(__dirname, './serviceAccountKey.json'),
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
    // 1. Local Service Account JSON File
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountFilePath, 'utf8'));
    resolvedProjectId = serviceAccount.project_id || env.firebaseProjectId || 'attendoschool-2d0fb';
    firebaseApp = initializeApp({
      credential: cert(serviceAccount),
      projectId: resolvedProjectId
    });
    connectionMode = 'live_cloud';
    credentialSource = `Service Account File: ${path.basename(serviceAccountFilePath)}`;
    console.log(`[Firebase] Connected to Live Cloud Firestore (Project: ${resolvedProjectId}) via ${serviceAccountFilePath}`);
  } else if (env.firebaseClientEmail && env.firebasePrivateKey) {
    // 2. Direct Environment Variables in .env
    resolvedProjectId = env.firebaseProjectId || 'attendoschool-2d0fb';
    firebaseApp = initializeApp({
      credential: cert({
        projectId: resolvedProjectId,
        clientEmail: env.firebaseClientEmail,
        privateKey: env.firebasePrivateKey.replace(/\\n/g, '\n'),
      }),
      projectId: resolvedProjectId
    });
    connectionMode = 'live_cloud';
    credentialSource = 'Environment Variables (.env: FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY)';
    console.log(`[Firebase] Connected to Live Cloud Firestore (Project: ${resolvedProjectId}) via .env credentials`);
  } else if (env.firestoreEmulatorHost) {
    // 3. Local Firestore Emulator
    process.env.FIRESTORE_EMULATOR_HOST = env.firestoreEmulatorHost;
    firebaseApp = initializeApp({
      projectId: resolvedProjectId
    });
    connectionMode = 'emulator';
    credentialSource = `Local Emulator: ${env.firestoreEmulatorHost}`;
    console.log(`[Firebase] Initialized in Emulator mode (Host: ${env.firestoreEmulatorHost}, Project: ${resolvedProjectId})`);
  } else {
    // 4. Default fallback development
    firebaseApp = initializeApp({
      projectId: resolvedProjectId
    });
    connectionMode = 'local_unconfigured';
    credentialSource = 'Default Development ID';
    console.log(`[Firebase] Initialized in fallback mode (Project: ${resolvedProjectId})`);
  }
} catch (error: any) {
  console.warn('[Firebase] Warning during initialization:', error.message);
  const apps = getApps();
  firebaseApp = apps.length > 0 ? apps[0]! : initializeApp({ projectId: resolvedProjectId });
}

export const firestore: Firestore = getFirestore(firebaseApp);
export { firebaseApp };

try {
  firestore.settings({ ignoreUndefinedProperties: true });
} catch {}

// Named collection references for Firestore
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
  academicYears: (): CollectionReference<DocumentData> => firestore.collection('academic_years'),
  attendanceCorrections: (): CollectionReference<DocumentData> => firestore.collection('attendance_correction_requests'),
  auditLogs: (): CollectionReference<DocumentData> => firestore.collection('audit_logs'),
};

export function isFirebaseConfigured(): boolean {
  return (
    connectionMode === 'live_cloud' ||
    connectionMode === 'emulator' ||
    Boolean(serviceAccountFilePath) ||
    Boolean(env.firebaseClientEmail && env.firebasePrivateKey)
  );
}

export function getFirebaseStatus() {
  return {
    configured: isFirebaseConfigured(),
    mode: connectionMode,
    projectId: resolvedProjectId,
    credentialSource,
    serviceAccountDetected: Boolean(serviceAccountFilePath),
    fileKeyDetected: Boolean(serviceAccountFilePath)
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
      message: 'Firebase credentials pending.',
      mode: connectionMode,
      projectId: resolvedProjectId,
      credentialSource
    };
  }
  try {
    const testDoc = await firestore.collection('_system_health').doc('connection_test').get();
    return {
      ok: true,
      message: 'Live Google Cloud Firestore connection active',
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
