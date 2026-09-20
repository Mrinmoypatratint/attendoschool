import bcrypt from 'bcryptjs';
import { collections, firestore, isFirebaseConfigured } from '../firebase';

async function seed() {
  if (!isFirebaseConfigured()) {
    console.log('⚠️  [Firebase Seeder] Firebase credentials or emulator host not detected.');
    return;
  }
  console.log('🌱 [Firebase Seeder] Seeding comprehensive Greenwood test data into Cloud Firestore...');
  const passwordHash = await bcrypt.hash('ChangeMe123!', 10);
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  const batch = firestore.batch();

  // Clean up any legacy duplicate school doc if present
  try {
    const dupDoc = await collections.schools().doc('school-greenwood-001').get();
    if (dupDoc.exists) {
      batch.delete(collections.schools().doc('school-greenwood-001'));
    }
  } catch {}

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

  // 2. Greenwood International School (Canonical UUID)
  const schoolId = '00000000-0000-0000-0000-000000000001';
  const schoolData = {
    id: schoolId,
    name: 'Greenwood International School',
    code: 'GIS001',
    address: 'Campus 4, Tech Park Boulevard, Bengaluru, Karnataka',
    phone: '+91 98765 43210',
    enquiry_number: '+91 98765 43210',
    email: 'contact@greenwood.edu.in',
    status: 'ACTIVE',
    planId: 'plan-enterprise',
    planName: 'Enterprise',
    maxStudents: 5000,
    subscriptionStart: now,
    subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560103',
    createdAt: now,
    updatedAt: now
  };
  batch.set(collections.schools().doc(schoolId), schoolData);

  // 3. Greenwood School Admin
  const schoolAdminRef = collections.users().doc('user-schooladmin-001');
  batch.set(schoolAdminRef, {
    id: 'user-schooladmin-001',
    schoolId: schoolId,
    schoolName: 'Greenwood International School',
    schoolCode: 'GIS001',
    name: 'Greenwood Principal Admin',
    email: 'admin@demo-school.local',
    passwordHash,
    role: 'SCHOOL_ADMIN',
    phone: '+91 98765 43211',
    status: 'ACTIVE',
    createdAt: now
  });

  // 4. Greenwood Faculty / Teachers
  const teachers = [
    {
      id: 'user-teacher-001',
      name: 'Rahul Sen',
      email: 'rahul@demo-school.local',
      phone: '+91 98765 43212',
      employeeId: 'EMP-GW-001',
      subject: 'Mathematics'
    },
    {
      id: 'user-teacher-002',
      name: 'Priya Patel',
      email: 'priya@demo-school.local',
      phone: '+91 98765 43213',
      employeeId: 'EMP-GW-002',
      subject: 'Science'
    },
    {
      id: 'user-teacher-003',
      name: 'Amit Roy',
      email: 'amit@demo-school.local',
      phone: '+91 98765 43214',
      employeeId: 'EMP-GW-003',
      subject: 'English'
    }
  ];

  for (const t of teachers) {
    // In users collection
    batch.set(collections.users().doc(t.id), {
      id: t.id,
      schoolId: schoolId,
      schoolName: 'Greenwood International School',
      schoolCode: 'GIS001',
      name: t.name,
      email: t.email,
      passwordHash,
      role: 'TEACHER',
      phone: t.phone,
      employeeId: t.employeeId,
      status: 'ACTIVE',
      createdAt: now
    });

    // In teachers collection
    batch.set(collections.teachers().doc(t.id), {
      id: t.id,
      schoolId: schoolId,
      name: t.name,
      email: t.email,
      phone: t.phone,
      employeeId: t.employeeId,
      subjectSpecialization: t.subject,
      status: 'ACTIVE',
      createdAt: now
    });
  }

  // 5. Greenwood Student Portal User
  const studentUserRef = collections.users().doc('user-student-001');
  batch.set(studentUserRef, {
    id: 'user-student-001',
    schoolId: schoolId,
    schoolName: 'Greenwood International School',
    schoolCode: 'GIS001',
    name: 'Rohan Sharma',
    email: 'student@greenwood.local',
    passwordHash,
    role: 'STUDENT',
    phone: '+91 98000 11001',
    status: 'ACTIVE',
    createdAt: now
  });

  // 6. Subscription Plans
  const plans = [
    {
      id: 'plan-basic',
      name: 'Basic',
      priceMonthly: 499,
      priceYearly: 4999,
      maxStudents: 300,
      features: ['Daily Attendance', 'Basic SMS Alerts', 'CSV Export', 'Standard Support'],
      status: 'ACTIVE',
      createdAt: now
    },
    {
      id: 'plan-standard',
      name: 'Standard',
      priceMonthly: 999,
      priceYearly: 9999,
      maxStudents: 1000,
      features: ['Timetable Management', 'WhatsApp & Email Notifications', 'Parent Portal', 'Offline Sync', 'Priority Support'],
      status: 'ACTIVE',
      createdAt: now
    },
    {
      id: 'plan-enterprise',
      name: 'Enterprise',
      priceMonthly: 1999,
      priceYearly: 19999,
      maxStudents: 5000,
      features: ['Unlimited Attendance & Timetables', 'Multi-channel Broadcasts', 'Advanced Analytics', 'Automated Backups', '24/7 Dedicated Support'],
      status: 'ACTIVE',
      createdAt: now
    }
  ];

  for (const p of plans) {
    batch.set(collections.subscriptionPlans().doc(p.id), p);
  }

  // 7. Classes & Sections for Greenwood
  const classesData = [
    { id: 'cls-gw-10', classNumber: 10, name: 'Class 10' },
    { id: 'cls-gw-09', classNumber: 9, name: 'Class 9' },
    { id: 'cls-gw-08', classNumber: 8, name: 'Class 8' }
  ];

  for (const c of classesData) {
    batch.set(collections.classes().doc(c.id), {
      ...c,
      schoolId: schoolId,
      createdAt: now
    });
  }

  const sectionsData = [
    { id: 'sec-gw-10-A', classId: 'cls-gw-10', className: '10', name: 'A' },
    { id: 'sec-gw-10-B', classId: 'cls-gw-10', className: '10', name: 'B' },
    { id: 'sec-gw-09-A', classId: 'cls-gw-09', className: '9', name: 'A' },
    { id: 'sec-gw-08-A', classId: 'cls-gw-08', className: '8', name: 'A' }
  ];

  for (const s of sectionsData) {
    batch.set(collections.sections().doc(s.id), {
      ...s,
      schoolId: schoolId,
      createdAt: now
    });
  }

  // 8. Subjects
  const subjectsData = [
    { id: 'subj-gw-math', name: 'Mathematics', code: 'MATH-10' },
    { id: 'subj-gw-sci', name: 'Science & Physics', code: 'SCI-10' },
    { id: 'subj-gw-eng', name: 'English Literature', code: 'ENG-10' },
    { id: 'subj-gw-sst', name: 'Social Studies', code: 'SST-10' },
    { id: 'subj-gw-cs', name: 'Computer Science', code: 'CS-10' }
  ];

  for (const sub of subjectsData) {
    batch.set(collections.subjects().doc(sub.id), {
      ...sub,
      schoolId: schoolId,
      createdAt: now
    });
  }

  // 9. Enrolled Students in Class 10-A (10 Students)
  const students = [
    { id: 'stud-001', admissionNumber: 'GW-2025-001', rollNumber: '01', fullName: 'Rohan Sharma', className: '10', section: 'A', parentName: 'Mohan Sharma', parentPhone: '+91 98000 11001', parentEmail: 'mohan.sharma@gmail.com', email: 'student@greenwood.local' },
    { id: 'stud-002', admissionNumber: 'GW-2025-002', rollNumber: '02', fullName: 'Aarav Verma', className: '10', section: 'A', parentName: 'Vikram Verma', parentPhone: '+91 98000 11002', parentEmail: 'vikram.verma@gmail.com' },
    { id: 'stud-003', admissionNumber: 'GW-2025-003', rollNumber: '03', fullName: 'Ananya Patel', className: '10', section: 'A', parentName: 'Deepak Patel', parentPhone: '+91 98000 11003', parentEmail: 'deepak.patel@gmail.com' },
    { id: 'stud-004', admissionNumber: 'GW-2025-004', rollNumber: '04', fullName: 'Diya Mukherjee', className: '10', section: 'A', parentName: 'Amit Mukherjee', parentPhone: '+91 98000 11004', parentEmail: 'amit.mukherjee@gmail.com' },
    { id: 'stud-005', admissionNumber: 'GW-2025-005', rollNumber: '05', fullName: 'Vivaan Reddy', className: '10', section: 'A', parentName: 'Kiran Reddy', parentPhone: '+91 98000 11005', parentEmail: 'kiran.reddy@gmail.com' },
    { id: 'stud-006', admissionNumber: 'GW-2025-006', rollNumber: '06', fullName: 'Ishaan Gupta', className: '10', section: 'A', parentName: 'Rajesh Gupta', parentPhone: '+91 98000 11006', parentEmail: 'rajesh.gupta@gmail.com' },
    { id: 'stud-007', admissionNumber: 'GW-2025-007', rollNumber: '07', fullName: 'Sneha Rao', className: '10', section: 'A', parentName: 'Venkat Rao', parentPhone: '+91 98000 11007', parentEmail: 'venkat.rao@gmail.com' },
    { id: 'stud-008', admissionNumber: 'GW-2025-008', rollNumber: '08', fullName: 'Tanvi Mehta', className: '10', section: 'A', parentName: 'Pradeep Mehta', parentPhone: '+91 98000 11008', parentEmail: 'pradeep.mehta@gmail.com' },
    { id: 'stud-009', admissionNumber: 'GW-2025-009', rollNumber: '09', fullName: 'Kabir Joshi', className: '10', section: 'A', parentName: 'Sunil Joshi', parentPhone: '+91 98000 11009', parentEmail: 'sunil.joshi@gmail.com' },
    { id: 'stud-010', admissionNumber: 'GW-2025-010', rollNumber: '10', fullName: 'Pooja Iyer', className: '10', section: 'A', parentName: 'Sundar Iyer', parentPhone: '+91 98000 11010', parentEmail: 'sundar.iyer@gmail.com' }
  ];

  for (const st of students) {
    batch.set(collections.students().doc(st.id), {
      ...st,
      schoolId: schoolId,
      schoolName: 'Greenwood International School',
      schoolCode: 'GIS001',
      classId: 'cls-gw-10',
      sectionId: 'sec-gw-10-A',
      status: 'ACTIVE',
      createdAt: now
    });
  }

  // 10. Today's Attendance Session & Records for Class 10-A
  const sessionId = `att-sess-gw-${today}`;
  batch.set(collections.attendanceSessions().doc(sessionId), {
    id: sessionId,
    schoolId: schoolId,
    classId: 'cls-gw-10',
    sectionId: 'sec-gw-10-A',
    className: '10',
    sectionName: 'A',
    attendanceDate: today,
    startTime: '09:00:00',
    endTime: '09:45:00',
    takenBy: 'user-teacher-001',
    teacherName: 'Rahul Sen',
    presentCount: 9,
    absentCount: 1,
    totalCount: 10,
    createdAt: now
  });

  // Attendance Records: stud-005 is ABSENT, others PRESENT
  students.forEach((st, idx) => {
    const recId = `att-rec-${sessionId}-${st.id}`;
    const isPresent = idx !== 4; // Vivaan Reddy absent for realistic data
    batch.set(collections.attendanceRecords().doc(recId), {
      id: recId,
      sessionId,
      studentId: st.id,
      studentName: st.fullName,
      rollNumber: st.rollNumber,
      schoolId: schoolId,
      status: isPresent ? 'PRESENT' : 'ABSENT',
      isPresent,
      attendanceDate: today,
      markedAt: now,
      createdAt: now
    });
  });

  // 11. Timetable Entries for Class 10-A
  const timetableSchedule = [
    { id: 'tt-gw-01', dayOfWeek: 1, period: 1, startTime: '09:00', endTime: '09:45', subjectName: 'Mathematics', teacherName: 'Rahul Sen', room: 'Room 101' },
    { id: 'tt-gw-02', dayOfWeek: 1, period: 2, startTime: '09:45', endTime: '10:30', subjectName: 'Science & Physics', teacherName: 'Priya Patel', room: 'Lab 2' },
    { id: 'tt-gw-03', dayOfWeek: 1, period: 3, startTime: '10:45', endTime: '11:30', subjectName: 'English Literature', teacherName: 'Amit Roy', room: 'Room 101' },
    { id: 'tt-gw-04', dayOfWeek: 1, period: 4, startTime: '11:30', endTime: '12:15', subjectName: 'Computer Science', teacherName: 'Rahul Sen', room: 'Comp Lab' }
  ];

  for (const entry of timetableSchedule) {
    batch.set(collections.timetableEntries().doc(entry.id), {
      ...entry,
      schoolId: schoolId,
      classId: 'cls-gw-10',
      sectionId: 'sec-gw-10-A',
      className: '10',
      sectionName: 'A',
      createdAt: now
    });
  }

  // 12. Payments & School Subscription Record
  batch.set(collections.schoolSubscriptions().doc('sub-greenwood-001'), {
    id: 'sub-greenwood-001',
    schoolId: schoolId,
    planId: 'plan-enterprise',
    planName: 'Enterprise',
    startDate: now.slice(0, 10),
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    status: 'ACTIVE',
    createdAt: now
  });

  batch.set(collections.payments().doc('pay-greenwood-001'), {
    id: 'pay-greenwood-001',
    schoolId: schoolId,
    schoolName: 'Greenwood International School',
    planName: 'Enterprise',
    amount: 1999,
    currency: 'INR',
    provider: 'MOCK',
    status: 'PAID',
    invoiceNumber: 'INV-2025-001',
    createdAt: now,
    paidAt: now
  });

  await batch.commit();

  console.log('✅ [Firebase Seeder] Successfully seeded Greenwood test data:');
  console.log('   - 1 Demo School: Greenwood International School (GIS001)');
  console.log('   - 1 School Admin: admin@demo-school.local (ChangeMe123!)');
  console.log('   - 3 Teachers: rahul@demo-school.local, priya@demo-school.local, amit@demo-school.local');
  console.log('   - 1 Student Login: student@greenwood.local (ChangeMe123!)');
  console.log('   - 3 Classes & 4 Sections');
  console.log('   - 5 Subjects (Mathematics, Science, English, Social Studies, Computer Science)');
  console.log('   - 10 Students in Class 10-A with full profiles and contact info');
  console.log('   - 1 Live Attendance Session with 10 records for Class 10-A');
  console.log('   - 4 Timetable period schedules');
  console.log('   - Enterprise Subscription & Paid Payment Record (INV-2025-001)');
}

seed().catch(err => {
  console.error('❌ [Firebase Seeder] Failed to seed Firestore:', err);
  process.exit(1);
});
