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
