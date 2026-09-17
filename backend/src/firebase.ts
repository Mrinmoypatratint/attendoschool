import 'dotenv/config';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore, CollectionReference, DocumentData } from 'firebase-admin/firestore';
import * as fs from 'fs';
import { env } from './config/env';

let firebaseApp: App;

// Configure emulator if specified
if (env.firestoreEmulatorHost) {
  process.env.FIRESTORE_EMULATOR_HOST = env.firestoreEmulatorHost;
}

try {
  const existingApps = getApps();
  if (existingApps.length > 0) {
    firebaseApp = existingApps[0]!;
  } else if (env.firebaseServiceAccountPath && fs.existsSync(env.firebaseServiceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(env.firebaseServiceAccountPath, 'utf8'));
    firebaseApp = initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id || env.firebaseProjectId
    });
    console.log('[Firebase] Initialized with service account file:', env.firebaseServiceAccountPath);
  } else if (env.firebaseClientEmail && env.firebasePrivateKey) {
    firebaseApp = initializeApp({
      credential: cert({
        projectId: env.firebaseProjectId,
        clientEmail: env.firebaseClientEmail,
        privateKey: env.firebasePrivateKey,
      }),
      projectId: env.firebaseProjectId
    });
    console.log('[Firebase] Initialized with environment credentials for project:', env.firebaseProjectId);
  } else {
    // Default development / emulator initialization
    firebaseApp = initializeApp({
      projectId: env.firebaseProjectId || 'attendoschool-saas'
    });
    console.log('[Firebase] Initialized in local/emulator mode (Project:', env.firebaseProjectId || 'attendoschool-saas', ')');
  }
} catch (error: any) {
  console.warn('[Firebase] Warning during initialization:', error.message);
  const apps = getApps();
  firebaseApp = apps.length > 0 ? apps[0]! : initializeApp({ projectId: 'attendoschool-saas' });
}

export const firestore: Firestore = getFirestore(firebaseApp);

// Optional settings for Firestore
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
  notifications: (): CollectionReference<DocumentData> => firestore.collection('notifications'),
  announcements: (): CollectionReference<DocumentData> => firestore.collection('announcements'),
  auditLogs: (): CollectionReference<DocumentData> => firestore.collection('audit_logs'),
};

export function isFirebaseConfigured(): boolean {
  return Boolean(
    env.firestoreEmulatorHost ||
    (env.firebaseServiceAccountPath && fs.existsSync(env.firebaseServiceAccountPath)) ||
    (env.firebaseClientEmail && env.firebasePrivateKey) ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS
  );
}

/**
 * Health check helper for Cloud Firestore
 */
export async function checkFirestoreHealth(): Promise<{ ok: boolean; message: string; timestamp?: string }> {
  if (!isFirebaseConfigured()) {
    return {
      ok: false,
      message: 'Firebase credentials pending. Add FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_CLIENT_EMAIL to .env'
    };
  }
  try {
    const testDoc = await firestore.collection('_system_health').doc('ping').get();
    return { ok: true, message: 'Firestore connection active', timestamp: new Date().toISOString() };
  } catch (err: any) {
    return { ok: false, message: err.message };
  }
}

export default firestore;
