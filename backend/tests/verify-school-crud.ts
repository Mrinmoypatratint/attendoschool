import { collections, isFirebaseConfigured } from '../src/firebase';
import { syncSchoolToFirestore, deleteSchoolFromFirestore } from '../src/services/firestoreSync';

async function runTest() {
  console.log('=== VERIFYING SUPER ADMIN SCHOOL CRUD OPERATIONS ===');
  console.log('Firebase configured:', isFirebaseConfigured());

  const testSchoolId = `test-crud-school-${Date.now()}`;
  const testSchoolCode = `TEST${Math.floor(Math.random() * 10000)}`;

  try {
    // 1. CREATE
    console.log('\n[1] Testing CREATE School...');
    const schoolPayload = {
      id: testSchoolId,
      name: 'Verification Test Academy',
      code: testSchoolCode,
      status: 'ACTIVE',
      phone: '+91 99999 88888',
      email: 'test@academy.local',
      address: '99 Innovation Street, Tech Hub',
      planName: 'Enterprise',
      maxStudents: 2500,
      createdAt: new Date().toISOString()
    };

    const synced = await syncSchoolToFirestore(schoolPayload);
    console.log('Sync to Firestore result:', synced);

    // 2. READ
    console.log('\n[2] Testing READ School from Firestore...');
    const readDoc = await collections.schools().doc(testSchoolId).get();
    if (!readDoc.exists) {
      throw new Error(`School doc ${testSchoolId} not found after creation!`);
    }
    const createdData = readDoc.data()!;
    console.log('Successfully read school doc:');
    console.log(`- Name: ${createdData.name}`);
    console.log(`- Code: ${createdData.code}`);
    console.log(`- Status: ${createdData.status}`);
    console.log(`- Email: ${createdData.email}`);

    // 3. UPDATE
    console.log('\n[3] Testing UPDATE School in Firestore...');
    const updateData = {
      name: 'Verification Test Academy (Renamed)',
      phone: '+91 11111 22222',
      status: 'SUSPENDED',
      updatedAt: new Date().toISOString()
    };
    await collections.schools().doc(testSchoolId).set(updateData, { merge: true });

    const updatedDoc = await collections.schools().doc(testSchoolId).get();
    const updatedData = updatedDoc.data()!;
    if (updatedData.name !== updateData.name || updatedData.status !== 'SUSPENDED') {
      throw new Error('Update verification failed!');
    }
    console.log('Successfully updated school doc:');
    console.log(`- Updated Name: ${updatedData.name}`);
    console.log(`- Updated Status: ${updatedData.status}`);
    console.log(`- Updated Phone: ${updatedData.phone}`);

    // Add dummy child records to verify cascade deletion
    console.log('\n[4] Adding mock child records (user, student) to test cascade deletion...');
    const dummyUserDoc = collections.users().doc(`test-user-${Date.now()}`);
    await dummyUserDoc.set({
      id: dummyUserDoc.id,
      schoolId: testSchoolId,
      name: 'Test School Admin',
      role: 'SCHOOL_ADMIN'
    });

    const dummyStudentDoc = collections.students().doc(`test-student-${Date.now()}`);
    await dummyStudentDoc.set({
      id: dummyStudentDoc.id,
      schoolId: testSchoolId,
      fullName: 'Test Student One',
      rollNumber: '101'
    });
    console.log('Dummy child documents created.');

    // 5. DELETE
    console.log('\n[5] Testing DELETE School (with cascading cleanup)...');
    const deleteResult = await deleteSchoolFromFirestore(testSchoolId, testSchoolCode);
    console.log('Delete from Firestore result:', deleteResult);

    // Verify main doc deletion
    const verifyDoc = await collections.schools().doc(testSchoolId).get();
    if (verifyDoc.exists) {
      throw new Error('School document still exists after deletion!');
    }
    console.log('Main school document confirmed DELETED.');

    // Verify child documents deleted
    const usersSnap = await collections.users().where('schoolId', '==', testSchoolId).get();
    const studentsSnap = await collections.students().where('schoolId', '==', testSchoolId).get();
    console.log(`Associated users remaining: ${usersSnap.size}`);
    console.log(`Associated students remaining: ${studentsSnap.size}`);
    if (usersSnap.size !== 0 || studentsSnap.size !== 0) {
      throw new Error('Cascade delete did not purge child documents!');
    }
    console.log('All associated records confirmed CASCADE PURGED.');

    console.log('\n*** FULL CRUD VERIFICATION PASSED SUCCESSFULLY! ***\n');
    process.exit(0);
  } catch (err: any) {
    console.error('CRUD Verification Failed:', err);
    process.exit(1);
  }
}

runTest();
