/**
 * Shared in-memory user store for fallback mode.
 * Contains demo accounts for Greenwood International School and Techno International New Town (TINT).
 * All school admins and teachers are registered dynamically when created.
 */

export interface DemoUser {
  id: string;
  schoolId: string | null;
  name: string;
  email: string;
  role: string;
  password: string;
}

const demoUsers: DemoUser[] = [
  {
    id: '00000000-0000-0000-0000-000000000020',
    schoolId: null,
    name: 'Company Super Admin',
    email: 'superadmin@attendance.local',
    role: 'SUPER_ADMIN',
    password: 'ChangeMe123!'
  },
  // Greenwood School Admin & Faculty
  {
    id: '00000000-0000-0000-0000-000000000021',
    schoolId: '00000000-0000-0000-0000-000000000001',
    name: 'School Administrator',
    email: 'admin@demo-school.local',
    role: 'SCHOOL_ADMIN',
    password: 'ChangeMe123!'
  },
  {
    id: '00000000-0000-0000-0000-000000000022',
    schoolId: '00000000-0000-0000-0000-000000000001',
    name: 'Rahul Sharma',
    email: 'rahul@demo-school.local',
    role: 'TEACHER',
    password: 'ChangeMe123!'
  },
  {
    id: '00000000-0000-0000-0000-000000000023',
    schoolId: '00000000-0000-0000-0000-000000000001',
    name: 'Priya Patel',
    email: 'priya@demo-school.local',
    role: 'TEACHER',
    password: 'ChangeMe123!'
  },
  {
    id: '00000000-0000-0000-0000-000000000025',
    schoolId: '00000000-0000-0000-0000-000000000001',
    name: 'Rohan Sharma',
    email: 'student@greenwood.local',
    role: 'STUDENT',
    password: 'ChangeMe123!'
  },
  // TINT (Techno International New Town) Demo Accounts
  {
    id: '00000000-0000-0000-0000-000000000031',
    schoolId: '00000000-0000-0000-0000-000000000002',
    name: 'TINT School Administrator',
    email: 'admin@tint.edu.in',
    role: 'SCHOOL_ADMIN',
    password: 'ChangeMe123!'
  },
  {
    id: '00000000-0000-0000-0000-000000000032',
    schoolId: '00000000-0000-0000-0000-000000000002',
    name: 'TINT Administrator',
    email: 'admin@tint.local',
    role: 'SCHOOL_ADMIN',
    password: 'ChangeMe123!'
  },
  {
    id: '00000000-0000-0000-0000-000000000033',
    schoolId: '00000000-0000-0000-0000-000000000002',
    name: 'TINT Faculty Member',
    email: 'teacher@tint.local',
    role: 'TEACHER',
    password: 'ChangeMe123!'
  },
  {
    id: '00000000-0000-0000-0000-000000000034',
    schoolId: '00000000-0000-0000-0000-000000000002',
    name: 'TINT Student',
    email: 'student@tint.local',
    role: 'STUDENT',
    password: 'ChangeMe123!'
  }
];

/** Find a demo user by email or student identifier (case-insensitive) */
export function findDemoUser(identifier: string): DemoUser | undefined {
  const norm = identifier.toLowerCase().trim();
  return demoUsers.find(u =>
    u.email.toLowerCase() === norm ||
    u.id.toLowerCase() === norm
  );
}

/** Register a user in the fallback demo store */
export function registerDemoUser(user: DemoUser): void {
  const existing = demoUsers.findIndex(u => u.email.toLowerCase() === user.email.toLowerCase());
  if (existing >= 0) {
    demoUsers[existing] = user;
  } else {
    demoUsers.push(user);
  }
}

/** Get all demo users */
export function getAllDemoUsers(): DemoUser[] {
  return [...demoUsers];
}
