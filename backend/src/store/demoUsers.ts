/**
 * Shared in-memory user store for fallback mode.
 * Contains only the initial Company Super Admin seed.
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
  }
];

/** Find a demo user by email (case-insensitive) */
export function findDemoUser(email: string): DemoUser | undefined {
  return demoUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
}

/** Register a new user in the in-memory store */
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
