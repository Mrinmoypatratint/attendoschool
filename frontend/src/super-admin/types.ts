export interface SchoolRecord {
  id: string;
  name: string;
  code: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';
  enquiry_number?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  admin_email?: string;
  admin_name?: string;
  student_count: number;
  start_date?: string;
  end_date?: string;
  subscription_status?: string;
  plan_name?: string;
  plan_price_monthly?: number;
  computed_status?: string;
  created_at?: string;
  color?: string;
}

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'SCHOOL_ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT';
  schoolId?: string | null;
  schoolName?: string;
  status: 'ACTIVE' | 'SUSPENDED';
  phone?: string;
  lastLogin?: string;
  createdAt?: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description?: string;
  max_students: number;
  price_monthly: number;
  price_yearly: number;
  discount_percentage?: number;
  is_active: boolean;
}

export interface PaymentRecord {
  id: string;
  school_id: string;
  school_name?: string;
  plan_name?: string;
  provider: string;
  provider_order_id?: string;
  amount: number;
  currency: string;
  status: 'PAID' | 'PENDING' | 'FAILED';
  reconciliation_status?: string;
  invoice_number?: string;
  created_at?: string;
  paid_at?: string;
}

export interface InvoiceRecord {
  id: string;
  invoice_number: string;
  receipt_number?: string;
  school_name: string;
  school_code?: string;
  amount: number;
  currency: string;
  status: string;
  issued_at?: string;
  paid_at?: string;
}

export interface AuditLogRecord {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  schoolId?: string | null;
  schoolName?: string;
  action: string;
  entityType: string;
  entityId: string;
  ipAddress?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface SystemSettings {
  companyName: string;
  companyGstin: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyGstRate: number;
  smsProvider: string;
  smsSenderId: string;
  razorpayKeyId: string;
  razorpayWebhookSecret: string;
  sessionTimeoutMinutes: number;
  enforceStrongPasswords: boolean;
  rateLimitPerMinute: number;
  maintenanceMode: boolean;
}

export interface OverviewMetrics {
  totalSchools: number;
  activeSchools: number;
  suspendedSchools: number;
  expiredSchools: number;
  totalStudents: number;
  pendingPayments: number;
  totalRevenue: number;
  activeRatio: number;
  expiredRatio: number;
}
