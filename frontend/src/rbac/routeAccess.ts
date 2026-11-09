/**
 * SPA path → permission (UX gating for sidebar + direct URLs). Keys must exist in the backend catalog
 * (backend/src/rbac/catalog.ts). Paths not listed are never gated in the UI.
 */
export const PATH_PERMISSIONS: Record<string, string> = {
  '/students': 'students.view',
  '/teachers': 'teachers.view',
  '/designations': 'designations.view',
  '/classes': 'classes.view',
  '/subjects': 'classes.view',
  '/routine': 'timetable.manage',
  '/attendance-reports': 'attendance.reports.view',
  '/attendance-corrections': 'attendance.corrections.view',
  '/academic-years': 'academic_years.view',
  '/calendar': 'calendar.view',
  '/working-calendar': 'calendar.view',
  '/holidays': 'calendar.view',
  '/promotion': 'promotions.manage',
  '/timetable': 'timetable.view',
  '/communication': 'announcements.manage',
  '/announcements': 'announcements.view',
  '/smtp-logs': 'notifications.logs.view',
  '/offline-attendance': 'attendance.offline.sync',
  '/analytics': 'analytics.view',
  '/leave-applications': 'leave.student.view',
  '/photo-approvals': 'photos.view',
  '/leave-policy': 'leave.policy.view',
  '/teacher-leave-approvals': 'leave.teacher.view',
  '/teacher/leave-request': 'leave.teacher.apply',
  '/teacher/mentor-workspace': 'mentors.workspace',
  '/teacher/assignments': 'assignments.view',
  '/take-attendance': 'attendance.take',
  '/parent-portal': 'parent.portal.view',
  '/parent-communication': 'announcements.view',
  '/permissions': 'access.manage',
  '/student/attendance': 'attendance.view',
  '/student/timetable': 'timetable.view',
  '/student/assignments': 'student.assignments.view',
  '/student/announcements': 'announcements.view',
  '/student/leave-request': 'student.leave.apply',
};

export function permissionForPath(path: string): string | undefined {
  const clean = String(path || '').split('?')[0].replace(/\/+$/, '') || '/';
  return PATH_PERMISSIONS[clean];
}
