export type UserRole = 'SUPER_ADMIN' | 'SCHOOL_ADMIN' | 'TEACHER' | 'PARENT' | 'STUDENT';

export interface FirestoreSchool {
  id: string;
  name: string;
  code?: string;
  address?: string;
  phone?: string;
  enquiryNumber?: string;
  contact_number?: string;
  website?: string;
  city?: string;
  state?: string;
  pincode?: string;
  email?: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';
  planId?: string;
  planName?: string;
  maxStudents?: number;
  subscriptionStart?: string;
  subscriptionEnd?: string;
  createdAt: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface FirestoreUser {
  id: string;
  schoolId: string | null;
  schoolName?: string;
  schoolCode?: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  phone?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  lastLoginAt?: string;
}

export interface FirestoreStudent {
  id: string;
  schoolId: string;
  schoolName: string;
  schoolCode?: string;
  schoolEmail?: string;
  schoolPhone?: string;
  schoolAddress?: string;
  school?: {
    id: string;
    name: string;
    code?: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  admissionNumber: string;
  fullName: string;
  className: string;
  section: string;
  rollNumber?: string;
  email?: string;
  parentName?: string;
  parentPhone?: string;
  parentEmail?: string;
  parentUserId?: string;
  status: 'ACTIVE' | 'ARCHIVED' | 'TRANSFERRED';
  createdAt: string;
  updatedAt?: string;
}

export interface FirestoreAttendanceSession {
  id: string;
  schoolId: string;
  className: string;
  section: string;
  sessionDate: string; // YYYY-MM-DD
  periodNumber?: number;
  takenByUserId: string;
  takenByUserName?: string;
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  lateCount?: number;
  createdAt: string;
}

export interface FirestoreAttendanceRecord {
  id: string;
  sessionId: string;
  schoolId: string;
  studentId: string;
  studentName?: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE';
  remarks?: string;
  createdAt: string;
}

export interface FirestoreSubscriptionPlan {
  id: string;
  name: string;
  description?: string;
  priceMonthly: number;
  priceYearly?: number;
  maxStudents: number;
  features: string[];
  status: 'ACTIVE' | 'DEPRECATED';
  createdAt: string;
}

export interface FirestorePayment {
  id: string;
  schoolId: string;
  schoolName?: string;
  planId?: string;
  planName?: string;
  amount: number;
  currency: string;
  provider: string; // 'RAZORPAY' | 'MANUAL'
  providerOrderId?: string;
  providerPaymentId?: string;
  status: 'PAID' | 'FAILED' | 'PENDING';
  invoiceNumber?: string;
  receiptNumber?: string;
  createdAt: string;
  paidAt?: string;
}

export interface FirestoreAuditLog {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  schoolId?: string | null;
  schoolName?: string;
  action: string;
  entityType: string;
  entityId?: string;
  ipAddress?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

