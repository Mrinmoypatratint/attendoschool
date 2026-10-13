export interface LeaveStoreItem {
  id: string;
  school_id: string;
  applicant_type?: string;
  student_id?: string;
  applicant_id?: string;
  applicant_name?: string;
  identifier?: string;
  detail?: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  reviewed_by?: string;
  reviewer_name?: string;
  review_notes?: string;
  created_at: string;
  updated_at?: string;
}

export const inMemoryLeaves: LeaveStoreItem[] = [];

export interface TeacherLeaveStoreItem {
  id: string;
  school_id: string;
  teacher_id: string;
  teacher_name?: string;
  teacher_email?: string;
  leave_type?: string;
  start_date: string;
  end_date: string;
  reason: string;
  document_url?: string | null;
  document_name?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reviewed_by?: string;
  reviewer_name?: string;
  review_notes?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at?: string;
}

export const inMemoryTeacherLeaves: TeacherLeaveStoreItem[] = [];
