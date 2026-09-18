import { Query, QueryDocumentSnapshot, DocumentData } from 'firebase-admin/firestore';
import { collections, firestore, isFirebaseConfigured } from '../firebase';
import { FirestoreUser, FirestoreSchool, FirestoreStudent, FirestoreAttendanceSession, FirestoreAttendanceRecord, FirestoreSubscriptionPlan } from '../types/firestoreSchema';

/**
 * User lookups
 */
export async function findFirestoreUserByEmail(email: string): Promise<FirestoreUser | null> {
  if (!isFirebaseConfigured()) return null;
  const snapshot = await collections.users()
    .where('email', '==', email.toLowerCase().trim())
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  const doc = snapshot.docs[0]!;
  return { id: doc.id, ...(doc.data() as any) } as FirestoreUser;
}

export async function findFirestoreUserById(id: string): Promise<FirestoreUser | null> {
  const doc = await collections.users().doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...(doc.data() as any) } as FirestoreUser;
}

export async function createFirestoreUser(user: Omit<FirestoreUser, 'id'>, customId?: string): Promise<FirestoreUser> {
  const docRef = customId ? collections.users().doc(customId) : collections.users().doc();
  const data: FirestoreUser = {
    id: docRef.id,
    ...user,
    email: user.email.toLowerCase().trim(),
    createdAt: user.createdAt || new Date().toISOString()
  };
  await docRef.set(data);
  return data;
}

/**
 * School lookups
 */
export async function getFirestoreSchools(): Promise<FirestoreSchool[]> {
  const snapshot = await collections.schools().orderBy('createdAt', 'desc').get();
  return snapshot.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({ id: d.id, ...(d.data() as any) }));
}

export async function getFirestoreSchoolById(id: string): Promise<FirestoreSchool | null> {
  const doc = await collections.schools().doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...(doc.data() as any) };
}

export async function createFirestoreSchool(school: Omit<FirestoreSchool, 'id'>, customId?: string): Promise<FirestoreSchool> {
  const docRef = customId ? collections.schools().doc(customId) : collections.schools().doc();
  const data: FirestoreSchool = {
    id: docRef.id,
    ...school,
    createdAt: school.createdAt || new Date().toISOString()
  };
  await docRef.set(data);
  return data;
}

/**
 * Student lookups
 */
export async function getFirestoreStudents(schoolId: string, className?: string, section?: string): Promise<FirestoreStudent[]> {
  let q: Query<DocumentData> = collections.students().where('schoolId', '==', schoolId);
  if (className) q = q.where('className', '==', className);
  if (section) q = q.where('section', '==', section);

  const snapshot = await q.get();
  return snapshot.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({ id: d.id, ...(d.data() as any) }));
}

export async function getFirestoreStudentById(id: string): Promise<FirestoreStudent | null> {
  const doc = await collections.students().doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...(doc.data() as any) } as FirestoreStudent;
}

export async function createFirestoreStudent(student: Omit<FirestoreStudent, 'id'>, customId?: string): Promise<FirestoreStudent> {
  const docRef = customId ? collections.students().doc(customId) : collections.students().doc();

  let schoolName = student.schoolName;
  let schoolCode = student.schoolCode;
  let schoolAddress = student.schoolAddress;
  let schoolPhone = student.schoolPhone;
  let schoolEmail = student.schoolEmail;
  let schoolObj = student.school;

  if (student.schoolId && (!schoolName || !schoolObj)) {
    const sDoc = await getFirestoreSchoolById(student.schoolId);
    if (sDoc) {
      schoolName = schoolName || sDoc.name;
      schoolCode = schoolCode || sDoc.code;
      schoolAddress = schoolAddress || sDoc.address;
      schoolPhone = schoolPhone || sDoc.phone;
      schoolEmail = schoolEmail || sDoc.email;
      schoolObj = schoolObj || {
        id: sDoc.id,
        name: sDoc.name,
        code: sDoc.code,
        address: sDoc.address,
        phone: sDoc.phone,
        email: sDoc.email
      };
    }
  }

  const data: FirestoreStudent = {
    id: docRef.id,
    ...student,
    schoolName: schoolName || 'Greenwood International School',
    schoolCode,
    schoolAddress,
    schoolPhone,
    schoolEmail,
    school: schoolObj,
    createdAt: student.createdAt || new Date().toISOString()
  };

  await docRef.set(data);
  return data;
}

/**
 * Attendance Operations
 */
export async function recordFirestoreAttendance(
  session: Omit<FirestoreAttendanceSession, 'id'>,
  records: Array<{ studentId: string; status: 'PRESENT' | 'ABSENT' | 'LATE'; remarks?: string }>
): Promise<{ sessionId: string; totalRecords: number }> {
  const batch = firestore.batch();
  const sessionRef = collections.attendanceSessions().doc();
  
  const sessionData: FirestoreAttendanceSession = {
    id: sessionRef.id,
    ...session,
    createdAt: new Date().toISOString()
  };
  batch.set(sessionRef, sessionData);

  for (const rec of records) {
    const recRef = collections.attendanceRecords().doc();
    const recData: FirestoreAttendanceRecord = {
      id: recRef.id,
      sessionId: sessionRef.id,
      schoolId: session.schoolId,
      studentId: rec.studentId,
      status: rec.status,
      remarks: rec.remarks || '',
      createdAt: new Date().toISOString()
    };
    batch.set(recRef, recData);
  }

  await batch.commit();
  return { sessionId: sessionRef.id, totalRecords: records.length };
}

/**
 * Subscription Plans
 */
export async function getFirestoreSubscriptionPlans(): Promise<FirestoreSubscriptionPlan[]> {
  const snapshot = await collections.subscriptionPlans().get();
  return snapshot.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({ id: d.id, ...(d.data() as any) }));
}
