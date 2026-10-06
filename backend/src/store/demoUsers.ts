/**
 * Shared in-memory user store for fallback mode.
 * Contains demo accounts for Greenwood International School and Techno International New Town (TINT).
 * All school admins and teachers are registered dynamically when created.
 */

import { isSameSchool } from '../utils/tenant';

export interface DemoUser {
  id: string;
  schoolId: string | null;
  name: string;
  email: string;
  role: string;
  password: string;
  admissionNumber?: string;
  isActive?: boolean;
  photo_url?: string;
  photoUrl?: string;
}

const demoUsers: DemoUser[] = [
  {
    id: '00000000-0000-0000-0000-000000000020',
    schoolId: null,
    name: 'Company Super Admin',
    email: 'superadmin@attendance.local',
    role: 'SUPER_ADMIN',
    password: 'ChangeMe123!',
    isActive: true
  },
  // Greenwood School Admin & Faculty
  {
    id: '00000000-0000-0000-0000-000000000021',
    schoolId: '00000000-0000-0000-0000-000000000001',
    name: 'School Administrator',
    email: 'admin@demo-school.local',
    role: 'SCHOOL_ADMIN',
    password: 'ChangeMe123!',
    isActive: true
  },
  {
    id: '00000000-0000-0000-0000-000000000022',
    schoolId: '00000000-0000-0000-0000-000000000001',
    name: 'Rahul Sharma',
    email: 'rahul@demo-school.local',
    role: 'TEACHER',
    password: 'ChangeMe123!',
    isActive: true
  },
  {
    id: '00000000-0000-0000-0000-000000000023',
    schoolId: '00000000-0000-0000-0000-000000000001',
    name: 'Priya Patel',
    email: 'priya@demo-school.local',
    role: 'TEACHER',
    password: 'ChangeMe123!',
    isActive: true
  },
  {
    id: '00000000-0000-0000-0000-000000000025',
    schoolId: '00000000-0000-0000-0000-000000000001',
    name: 'Rohan Sharma',
    email: 'student@greenwood.local',
    role: 'STUDENT',
    password: 'ChangeMe123!',
    admissionNumber: 'ADM-2026-001',
    isActive: true
  },
  // Techno International New Town (TINT) School Admin, Faculty & Student
  {
    id: '00000000-0000-0000-0000-000000000031',
    schoolId: 'sch-1790665531365',
    name: 'TINT School Administrator',
    email: 'admin@tint.edu.in',
    role: 'SCHOOL_ADMIN',
    password: 'ChangeMe123!',
    isActive: true
  },
  {
    id: '00000000-0000-0000-0000-000000000032',
    schoolId: 'sch-1790665531365',
    name: 'TINT Administrator',
    email: 'admin@tint.local',
    role: 'SCHOOL_ADMIN',
    password: 'ChangeMe123!',
    isActive: true
  },
  {
    id: '00000000-0000-0000-0000-000000000035',
    schoolId: 'sch-1790665531365',
    name: 'TINT Faculty Teacher',
    email: 'teacher@tint.edu.in',
    role: 'TEACHER',
    password: 'ChangeMe123!',
    isActive: true
  },
  {
    id: 'ce8082a9-4280-47a1-90aa-0feaa5f42234',
    schoolId: 'sch-1790665531365',
    name: 'Sweta Mondal',
    email: 'sweta@gmail.com',
    role: 'STUDENT',
    password: 'ChangeMe123!',
    admissionNumber: 'ADM-2025-105',
    isActive: true
  },
  {
    id: '00000000-0000-0000-0000-000000000037',
    schoolId: 'sch-1790665531365',
    name: 'TINT Demo Student',
    email: 'student@tint.edu.in',
    role: 'STUDENT',
    password: 'ChangeMe123!',
    admissionNumber: 'ADM-2025-001',
    isActive: true
  }
];

/** Find a demo user by email, student admission number, or id (case-insensitive with school isolation) */
export function findDemoUser(identifier: string, schoolId?: string | null, role?: string): DemoUser | undefined {
  const norm = identifier.toLowerCase().trim();
  return demoUsers.find(u => {
    if (u.isActive === false) return false;

    // Check admission number match
    if (u.admissionNumber && u.admissionNumber.toLowerCase() === norm) {
      if (schoolId && u.schoolId && !isSameSchool(u.schoolId, schoolId)) {
        return false;
      }
      return true;
    }

    // Check email or ID match
    const emailMatches = u.email.toLowerCase() === norm;
    const idMatches = u.id.toLowerCase() === norm;
    if (emailMatches || idMatches) {
      if (schoolId && u.schoolId && role && role !== 'SUPER_ADMIN' && !isSameSchool(u.schoolId, schoolId)) {
        return false;
      }
      return true;
    }

    return false;
  });
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

/** Update photo for a demo user */
export function updateDemoUserPhoto(userIdOrEmail: string, photoUrl: string | null): void {
  const norm = userIdOrEmail.toLowerCase().trim();
  const u = demoUsers.find(user => user.id.toLowerCase() === norm || user.email.toLowerCase() === norm);
  if (u) {
    if (photoUrl) {
      u.photo_url = photoUrl;
      u.photoUrl = photoUrl;
    } else {
      delete u.photo_url;
      delete u.photoUrl;
    }
  }
}

