import bcrypt from 'bcryptjs';
import { collections, firestore, isFirebaseConfigured } from '../firebase';

async function seed() {
  if (!isFirebaseConfigured()) {
    console.log('⚠️  [Firebase Seeder] Firebase credentials or emulator host not detected.');
    console.log('   To seed your Firebase database:');
    console.log('   1. Place your serviceAccountKey.json in the backend/ directory, OR');
    console.log('   2. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in backend/.env, OR');
    console.log('   3. Run the Firebase Emulator: firebase emulators:start --only firestore');
    console.log('      and set FIRESTORE_EMULATOR_HOST=localhost:8080 in backend/.env');
    return;
  }
  console.log('🌱 [Firebase Seeder] Seeding initial data into Cloud Firestore...');
  const passwordHash = await bcrypt.hash('ChangeMe123!', 10);
  const now = new Date().toISOString();

  const batch = firestore.batch();

  // 1. Super Admin User
  const superAdminRef = collections.users().doc('user-superadmin-001');
  batch.set(superAdminRef, {
    id: 'user-superadmin-001',
    schoolId: null,
    name: 'Platform Super Administrator',
    email: 'superadmin@attendance.local',
    passwordHash,
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
    createdAt: now
  });

  // 2. Demo School: Greenwood International School
  const schoolId = '00000000-0000-0000-0000-000000000001';
  const schoolData = {
    id: schoolId,
    name: 'Greenwood International School',
    code: 'GIS001',
    address: 'Campus 4, Tech Park Boulevard, Bengaluru, Karnataka',
    phone: '+91 98765 43210',
    email: 'contact@greenwood.edu.in',
    status: 'ACTIVE',
    planId: 'plan-enterprise',
    planName: 'Enterprise',
    maxStudents: 5000,
    subscriptionStart: now,
    subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: now
  };
  batch.set(collections.schools().doc(schoolId), schoolData);
  // Alias for compatibility
  batch.set(collections.schools().doc('school-greenwood-001'), { ...schoolData, id: 'school-greenwood-001' });

  // 3. School Admin: admin@demo-school.local
  const schoolAdminRef = collections.users().doc('user-schooladmin-001');
  batch.set(schoolAdminRef, {
    id: 'user-schooladmin-001',
    schoolId: schoolId,
    name: 'Greenwood Principal Admin',
    email: 'admin@demo-school.local',
    passwordHash,
    role: 'SCHOOL_ADMIN',
    phone: '+91 98765 43211',
    status: 'ACTIVE',
    createdAt: now
  });

  // 4. Demo Teacher 1: rahul@demo-school.local
  const teacherRef = collections.users().doc('user-teacher-001');
  batch.set(teacherRef, {
    id: 'user-teacher-001',
    schoolId: schoolId,
    name: 'Rahul Sen (Senior Faculty)',
    email: 'rahul@demo-school.local',
    passwordHash,
    role: 'TEACHER',
    phone: '+91 98765 43212',
    status: 'ACTIVE',
    createdAt: now
  });

  // 4b. Demo Teacher 2: priya@demo-school.local
  const teacher2Ref = collections.users().doc('user-teacher-002');
  batch.set(teacher2Ref, {
    id: 'user-teacher-002',
    schoolId: schoolId,
    name: 'Priya Patel (Science Dept)',
    email: 'priya@demo-school.local',
    passwordHash,
    role: 'TEACHER',
    phone: '+91 98765 43213',
    status: 'ACTIVE',
    createdAt: now
  });

  // 4c. Demo Student: student@greenwood.local
  const studentUserRef = collections.users().doc('user-student-001');
  batch.set(studentUserRef, {
    id: 'user-student-001',
    schoolId: schoolId,
    name: 'Rohan Sharma',
    email: 'student@greenwood.local',
    passwordHash,
    role: 'STUDENT',
    phone: '+91 98000 11003',
    status: 'ACTIVE',
    createdAt: now
  });

  // 5. Subscription Plans
  const plans = [
    {
      id: 'plan-basic',
      name: 'Basic',
      priceMonthly: 499,
      maxStudents: 300,
      features: ['Daily Attendance', 'Basic SMS Alerts', 'CSV Export', 'Standard Support'],
      status: 'ACTIVE',
      createdAt: now
    },
    {
      id: 'plan-standard',
      name: 'Standard',
      priceMonthly: 999,
      maxStudents: 1000,
      features: ['Timetable Management', 'WhatsApp & Email Notifications', 'Parent Portal', 'Offline Sync', 'Priority Support'],
      status: 'ACTIVE',
      createdAt: now
    },
    {
      id: 'plan-enterprise',
      name: 'Enterprise',
      priceMonthly: 1999,
      maxStudents: 5000,
      features: ['Unlimited Attendance & Timetables', 'Multi-channel Broadcasts', 'Advanced Analytics', 'Automated Backups', '24/7 Dedicated Support'],
      status: 'ACTIVE',
      createdAt: now
    }
  ];

  for (const p of plans) {
    const pRef = collections.subscriptionPlans().doc(p.id);
    batch.set(pRef, p);
  }

  // 6. Demo Students in Class 10 - Section A
  const students = [
    { id: 'stud-001', admissionNumber: 'GW-2025-001', fullName: 'Aarav Sharma', className: '10', section: 'A', parentName: 'Vikram Sharma', parentPhone: '+91 98000 11001' },
    { id: 'stud-002', admissionNumber: 'GW-2025-002', fullName: 'Ananya Patel', className: '10', section: 'A', parentName: 'Deepak Patel', parentPhone: '+91 98000 11002' },
    { id: 'stud-003', admissionNumber: 'GW-2025-003', fullName: 'Rohan Verma', className: '10', section: 'A', parentName: 'Suresh Verma', parentPhone: '+91 98000 11003' },
    { id: 'stud-004', admissionNumber: 'GW-2025-004', fullName: 'Diya Mukherjee', className: '10', section: 'A', parentName: 'Amit Mukherjee', parentPhone: '+91 98000 11004' },
    { id: 'stud-005', admissionNumber: 'GW-2025-005', fullName: 'Vivaan Reddy', className: '10', section: 'A', parentName: 'Kiran Reddy', parentPhone: '+91 98000 11005' },
  ];

  for (const st of students) {
    const stRef = collections.students().doc(st.id);
    batch.set(stRef, {
      ...st,
      schoolId: schoolId,
      status: 'ACTIVE',
      createdAt: now
    });
  }

  await batch.commit();
  console.log('✅ [Firebase Seeder] Successfully seeded Firestore:');
  console.log('   - 1 Super Admin: superadmin@attendance.local');
  console.log('   - 1 Demo School: Greenwood International School (school-greenwood-001)');
  console.log('   - 1 School Admin: admin@demo-school.local');
  console.log('   - 2 Teachers: rahul@demo-school.local, priya@demo-school.local');
  console.log('   - 1 Student: student@greenwood.local');
  console.log('   - 3 Subscription Plans (Basic, Standard, Enterprise)');
  console.log('   - 5 Demo Students in Class 10-A');
}

seed().catch(err => {
  console.error('❌ [Firebase Seeder] Failed to seed Firestore:', err);
  process.exit(1);
});
