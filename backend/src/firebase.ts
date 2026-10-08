import 'dotenv/config';
import { CollectionReference, DocumentData } from 'firebase-admin/firestore';

/**
 * Firebase / Cloud Firestore Module — DISABLED
 * 
 * The system has fully migrated to 100% Supabase PostgreSQL.
 * All Google Cloud Firestore connections, authentication, and SDK calls are permanently disabled.
 * Harmless dummy stubs are provided below so existing type references compile cleanly without overhead.
 */

console.log('[Firebase] Cloud Firestore is completely disabled. Operating 100% on Supabase PostgreSQL.');

export function resolveServiceAccountPath(): string | null {
  return null;
}
export const findServiceAccountPath = resolveServiceAccountPath;

// Harmless dummy document snapshot
const emptyDocSnapshot: any = {
  id: '',
  exists: false,
  data: () => null,
  get: () => null
};

// Harmless dummy collection snapshot
const emptyQuerySnapshot: any = {
  empty: true,
  size: 0,
  docs: [],
  forEach: () => {}
};

// Harmless dummy query/collection reference
const dummyCollection: any = {
  doc: (_id?: string) => ({
    id: _id || '',
    get: async () => emptyDocSnapshot,
    set: async () => {},
    update: async () => {},
    delete: async () => {}
  }),
  where: () => dummyCollection,
  limit: () => dummyCollection,
  orderBy: () => dummyCollection,
  count: () => ({
    get: async () => ({ data: () => ({ count: 0 }) })
  }),
  get: async () => emptyQuerySnapshot,
  add: async () => ({ id: '' })
};

export const firestore: any = {
  collection: (_name: string) => dummyCollection,
  batch: () => ({
    set: () => {},
    update: () => {},
    delete: () => {},
    commit: async () => {}
  }),
  runTransaction: async (fn: any) => fn({
    get: async () => emptyDocSnapshot,
    set: () => {},
    update: () => {},
    delete: () => {}
  })
};

// Named collection references for backwards compatibility
export const collections = {
  schools: (): CollectionReference<DocumentData> => dummyCollection,
  users: (): CollectionReference<DocumentData> => dummyCollection,
  students: (): CollectionReference<DocumentData> => dummyCollection,
  classes: (): CollectionReference<DocumentData> => dummyCollection,
  sections: (): CollectionReference<DocumentData> => dummyCollection,
  attendanceSessions: (): CollectionReference<DocumentData> => dummyCollection,
  attendanceRecords: (): CollectionReference<DocumentData> => dummyCollection,
  subscriptionPlans: (): CollectionReference<DocumentData> => dummyCollection,
  schoolSubscriptions: (): CollectionReference<DocumentData> => dummyCollection,
  payments: (): CollectionReference<DocumentData> => dummyCollection,
  invoices: (): CollectionReference<DocumentData> => dummyCollection,
  timetables: (): CollectionReference<DocumentData> => dummyCollection,
  timetablePeriods: (): CollectionReference<DocumentData> => dummyCollection,
  timetableEntries: (): CollectionReference<DocumentData> => dummyCollection,
  teachers: (): CollectionReference<DocumentData> => dummyCollection,
  subjects: (): CollectionReference<DocumentData> => dummyCollection,
  teacherAssignments: (): CollectionReference<DocumentData> => dummyCollection,
  notifications: (): CollectionReference<DocumentData> => dummyCollection,
  announcements: (): CollectionReference<DocumentData> => dummyCollection,
  academicYears: (): CollectionReference<DocumentData> => dummyCollection,
  attendanceCorrections: (): CollectionReference<DocumentData> => dummyCollection,
  auditLogs: (): CollectionReference<DocumentData> => dummyCollection,
};

export function isFirebaseConfigured(): boolean {
  return false;
}

export function getFirebaseStatus() {
  return {
    configured: false,
    mode: 'disabled',
    projectId: 'disabled',
    credentialSource: 'None (Firebase Disabled — Supabase Only)',
    serviceAccountDetected: false,
    envCredentialsDetected: false,
    fileKeyDetected: false
  };
}

export async function checkFirestoreHealth(): Promise<{
  ok: boolean;
  message: string;
  mode?: string;
  projectId?: string;
  credentialSource?: string;
  timestamp?: string;
}> {
  return {
    ok: false,
    message: 'Firebase/Firestore is permanently disabled. Supabase PostgreSQL is the sole database engine.',
    mode: 'disabled',
    projectId: 'none',
    credentialSource: 'none',
    timestamp: new Date().toISOString()
  };
}

export default firestore;
