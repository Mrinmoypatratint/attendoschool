import { api } from '../api';

export interface Institute {
  id: string;
  name: string;
  code: string;
  address?: string;
}

export interface StudentProfile {
  id: string;
  userId: string;
  schoolId: string;
  name: string;
  email: string;
  rollNumber: string;
  admissionNumber: string;
  className: string;
  classNumber: number;
  sectionName: string;
  schoolName: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  dateOfBirth: string;
  gender?: string;
  academicSession: string;
  photoUrl?: string;
  pendingPhotoUrl?: string | null;
  hasPendingPhotoApproval?: boolean;
  photoApprovalStatus?: string;
  photoRejectionReason?: string | null;
}

export interface StudentDashboardData {
  student: {
    id: string;
    name: string;
    className: string;
    sectionName: string;
    rollNumber: string;
    admissionNumber?: string;
    schoolName: string;
    avatarUrl?: string;
  };
  kpis: {
    attendancePercentage: number;
    attendanceText: string;
    pendingAssignmentsCount: number;
    upcomingExamTitle: string;
    announcementsCount: number;
  };
  todayTimetable: Array<{
    periodNumber: number;
    time: string;
    subject: string;
    teacher: string;
    room: string;
    status: 'Completed' | 'Ongoing' | 'Upcoming';
  }>;
  recentAttendance: Array<{
    date: string;
    subject: string;
    status: 'Present' | 'Absent';
  }>;
  announcements: Array<{
    id: string;
    title: string;
    date: string;
    description: string;
    priority: string;
  }>;
  pendingAssignments: Array<{
    id: string;
    title: string;
    subject: string;
    dueDate: string;
    daysLeft: string;
    status: string;
  }>;
  upcomingExam: {
    subject: string;
    title: string;
    date: string;
    time: string;
    room: string;
  };
}

export interface AttendanceRecord {
  attendance_date: string;
  status: 'PRESENT' | 'ABSENT';
  start_time: string;
  end_time: string;
  subject_name?: string;
  teacher_name?: string;
}

export interface AttendanceData {
  records: AttendanceRecord[];
  summary: {
    present: number;
    absent: number;
    total: number;
    percentage: number;
  };
}

export interface TimetableEntry {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  subject_name: string;
  teacher_name: string;
  room?: string;
}

export interface Assignment {
  id: string;
  title: string;
  description: string;
  subject_name: string;
  teacher_name: string;
  due_date: string;
  max_marks: number;
  submission_status: 'PENDING' | 'SUBMITTED' | 'GRADED' | 'OVERDUE';
  submitted_at?: string;
  marks_obtained?: number;
  feedback?: string;
}

export interface Exam {
  id: string;
  title: string;
  subject_name: string;
  exam_date: string;
  start_time: string;
  end_time: string;
  room: string;
  total_marks: number;
  passing_marks: number;
  marks_obtained?: number;
  grade?: string;
  remarks?: string;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  priority: string;
  published_at: string;
  author_name?: string;
}

export interface LeaveRequest {
  id: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reviewer_name?: string;
  review_notes?: string;
  created_at?: string;
}

export const studentApi = {
  getInstitutes: () => api.get<Institute[]>('/auth/institutes').then((r) => r.data),
  getProfile: () => api.get<StudentProfile>('/student/me').then((r) => r.data),
  getDashboard: () => api.get<StudentDashboardData>('/student/dashboard').then((r) => r.data),
  getAttendance: (from?: string, to?: string) =>
    api.get<AttendanceData>('/student/attendance', { params: { from, to } }).then((r) => r.data),
  getTimetable: () => api.get<TimetableEntry[]>('/student/timetable').then((r) => r.data),
  getAnnouncements: () => api.get<Announcement[]>('/student/announcements').then((r) => r.data),
  replyToAnnouncement: (id: string, replyText: string) => api.post('/communication/announcements/' + id + '/reply', { replyText }).then((r) => r.data),
  getAssignments: () => api.get<Assignment[]>('/student/assignments').then((r) => r.data),
  submitAssignment: (id: string, submissionText: string) =>
    api.post(`/student/assignments/${id}/submit`, { submissionText }).then((r) => r.data),
  getExams: () => api.get<Exam[]>('/student/exams').then((r) => r.data),
  getLeaveRequests: () => api.get<LeaveRequest[]>('/student/leave-requests').then((r) => r.data),
  createLeaveRequest: (data: { startDate: string; endDate: string; reason: string }) =>
    api.post('/student/leave-requests', data).then((r) => r.data),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.put('/student/change-password', { currentPassword, newPassword }).then((r) => r.data),
  updatePhoto: (photoUrl: string) =>
    api.put<{ success: boolean; photoUrl?: string; pendingPhotoUrl?: string; pendingApproval?: boolean; message: string }>('/student/photo', { photoUrl }).then((r) => r.data),
  updateProfile: (data: { gender?: string; dateOfBirth?: string; address?: string }) =>
    api.put<{ success: boolean; message: string }>('/student/profile', data).then((r) => r.data)
};
