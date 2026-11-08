/**
 * RBAC catalog — SINGLE SOURCE OF TRUTH for features, permissions and route bindings.
 *
 * v1 is RESTRICT-ONLY (R4): for every permission, ceilingRoles === defaultRoles === the roles that
 * effectively reach the bound routes TODAY (middleware + inline handler checks, see
 * docs/rbac/route-permission-map.md and docs/rbac/catalog-draft.md). Toggles can only REMOVE access.
 *
 * SUPER_ADMIN is never listed: the resolver allows it at layer 0.
 */

export type Role = 'SUPER_ADMIN' | 'SCHOOL_ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT';
export type BaseRole = 'SCHOOL_ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT';
export const BASE_ROLES: BaseRole[] = ['SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT'];

export type FeatureDef = {
  key: string;
  label: string;
  description: string;
  core: boolean;
  defaultEnabled: boolean;
  dependsOn?: string[];
};

export type PermissionDef = {
  key: string;
  feature: string;
  label: string;
  description: string;
  ceilingRoles: BaseRole[];
  defaultRoles: BaseRole[];
  dangerous?: boolean;
  /** locked: cannot be changed at role level or per person by school admins (core). */
  locked?: boolean;
  /** lockedForAdmin: can never be turned off for the SCHOOL_ADMIN role (R10). */
  lockedForAdmin?: boolean;
  /** knownIssue: documents a confirmed over-permissive legacy behaviour kept for R1. */
  knownIssue?: string;
};

/**
 * Role normalisation — identical to existing code:
 *  - routes/auth.ts roleMatches(): ADMIN / ADMINISTRATOR → SUPER_ADMIN
 *  - middleware/attendanceAuth.ts treats ADMIN / PRINCIPAL as administrators; tokens never carry
 *    PRINCIPAL today, it is mapped to SCHOOL_ADMIN (the school-scoped administrator).
 */
export function normalizeRole(role: unknown): Role | null {
  const r = String(role || '').trim().toUpperCase();
  if (r === 'ADMIN' || r === 'ADMINISTRATOR' || r === 'SUPER_ADMIN') return 'SUPER_ADMIN';
  if (r === 'PRINCIPAL' || r === 'SCHOOL_ADMIN') return 'SCHOOL_ADMIN';
  if (r === 'TEACHER' || r === 'STUDENT' || r === 'PARENT') return r;
  return null;
}

export function isBaseRole(role: unknown): role is BaseRole {
  return BASE_ROLES.includes(role as BaseRole);
}

// ---------------------------------------------------------------------------
// Features
// ---------------------------------------------------------------------------
const F = (key: string, label: string, description: string, extra: Partial<FeatureDef> = {}): FeatureDef =>
  ({ key, label, description, core: false, defaultEnabled: true, ...extra });

export const FEATURES: FeatureDef[] = [
  F('access_control', 'Access control', 'Roles, per-person permissions and login control', { core: true }),
  F('billing', 'Billing & subscription', 'Subscription status, invoices and payments', { core: true }),
  F('dashboard', 'Dashboard', 'Dashboards, global search and notification bell', { core: true }),
  F('profile', 'Profile', 'Own profile, password, photo and school profile', { core: true }),
  F('students', 'Students', 'Student records, import and export'),
  F('teachers', 'Teachers', 'Teacher records and import'),
  F('classes_subjects', 'Classes, subjects & academic years', 'Classes, sections, subjects, academic years and subject allocation'),
  F('designations', 'Designations', 'Teacher designations and designation promotions', { dependsOn: ['teachers'] }),
  F('academic_calendar', 'Academic calendar', 'Holidays and working days'),
  F('timetable', 'Timetable', 'Timetable, periods, substitutes and routines', { dependsOn: ['classes_subjects'] }),
  F('attendance', 'Attendance', 'Take, edit and review attendance'),
  F('attendance_corrections', 'Attendance corrections', 'Correction requests and reviews', { dependsOn: ['attendance'] }),
  F('attendance_reports', 'Attendance reports', 'Attendance reports and exports', { dependsOn: ['attendance'] }),
  F('offline_attendance', 'Offline attendance', 'Offline sync and offline import', { dependsOn: ['attendance'] }),
  F('mentors_and_temporary_assignments', 'Mentors & temporary assignments', 'Class mentors, mentor workspace and temporary class assignments'),
  F('assignments', 'Assignments', 'Teacher assignments, grading and student submissions'),
  F('announcements_communication', 'Announcements & communication', 'Announcements, replies and inboxes'),
  F('notification_logs', 'Notifications', 'Notification channels, templates, SMTP settings and logs'),
  F('student_leave', 'Student leave', 'Student leave applications and reviews'),
  F('teacher_leave', 'Teacher leave', 'Teacher leave applications and reviews'),
  F('leave_policy', 'Leave policy', 'Leave policy configuration'),
  F('photo_approvals', 'Photo approvals', 'Profile photo change requests and reviews'),
  F('promotions', 'Student promotions', 'Promote students to the next class', { dependsOn: ['students'] }),
  F('analytics', 'Analytics', 'School analytics'),
  F('parent_portal', 'Parent portal', 'Parent portal and parent onboarding'),
  F('student_portal', 'Student portal', 'Student dashboard and exams'),
];

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------
const AD: BaseRole = 'SCHOOL_ADMIN';
const T: BaseRole = 'TEACHER';
const S: BaseRole = 'STUDENT';
const P: BaseRole = 'PARENT';
const ALL: BaseRole[] = [AD, T, S, P];

const PERM = (key: string, feature: string, label: string, roles: BaseRole[], extra: Partial<PermissionDef> = {}): PermissionDef =>
  ({ key, feature, label, description: extra.description || label, ceilingRoles: [...roles], defaultRoles: [...roles], ...extra });

const HOLE = 'Legacy behaviour kept for backward compatibility (R1); see docs/rbac/catalog-draft.md';

export const PERMISSIONS: PermissionDef[] = [
  // core
  PERM('access.manage', 'access_control', 'Manage roles & permissions', [AD], { lockedForAdmin: true, dangerous: true }),
  PERM('access.login.manage', 'access_control', 'Enable / disable user logins', [AD], { dangerous: true }),
  PERM('billing.view', 'billing', 'View subscription & invoices', ALL, { lockedForAdmin: true }),
  PERM('billing.pay', 'billing', 'Pay / renew subscription', [AD], { lockedForAdmin: true }),
  PERM('dashboard.view', 'dashboard', 'View dashboard', [AD, T], { locked: true }),
  PERM('profile.self', 'profile', 'Manage own profile', [AD, T, S], { locked: true }),
  PERM('profile.school.manage', 'profile', 'Manage school profile', [AD], { locked: true }),
  // students / parents
  PERM('students.view', 'students', 'View students', [AD, T]),
  PERM('students.create', 'students', 'Add / import students', [AD]),
  PERM('students.edit', 'students', 'Edit students', [AD]),
  PERM('students.delete', 'students', 'Delete students', [AD], { dangerous: true }),
  PERM('students.export', 'students', 'Export student list', ALL, { knownIssue: HOLE }),
  PERM('parents.manage', 'parent_portal', 'Onboard & link parents', [AD]),
  // teachers / designations
  PERM('teachers.view', 'teachers', 'View teachers', [AD, T]),
  PERM('teachers.create', 'teachers', 'Add / import teachers', [AD]),
  PERM('teachers.edit', 'teachers', 'Edit teachers', [AD]),
  PERM('teachers.delete', 'teachers', 'Delete teachers', [AD], { dangerous: true }),
  PERM('designations.view', 'designations', 'View designations', [AD, T]),
  PERM('designations.manage', 'designations', 'Manage designations', [AD]),
  PERM('designations.promote', 'designations', 'Promote teacher designations', [AD]),
  // classes / subjects / academic years
  PERM('classes.view', 'classes_subjects', 'View classes, sections & subjects', [AD, T]),
  PERM('classes.manage', 'classes_subjects', 'Manage classes, sections & subjects', [AD]),
  PERM('subjects.assign', 'classes_subjects', 'Allocate subjects to teachers', [AD]),
  PERM('academic_years.view', 'classes_subjects', 'View academic years', ALL),
  PERM('academic_years.manage', 'classes_subjects', 'Manage academic years', [AD], { dangerous: true }),
  // calendar
  PERM('calendar.view', 'academic_calendar', 'View academic calendar', [AD, T]),
  PERM('calendar.manage', 'academic_calendar', 'Manage holidays & working days', [AD]),
  // timetable
  PERM('timetable.view', 'timetable', 'View timetable', ALL),
  PERM('timetable.manage', 'timetable', 'Manage timetable', [AD]),
  PERM('timetable.publish', 'timetable', 'Publish timetable', [AD]),
  // attendance
  PERM('attendance.view', 'attendance', 'View attendance', [AD, T, S]),
  PERM('attendance.take', 'attendance', 'Take attendance', [AD, T]),
  PERM('attendance.edit', 'attendance', 'Edit attendance records', [AD, T]),
  PERM('attendance.edit_past', 'attendance', 'Re-take (re-attendance) past sessions', [AD, T], { dangerous: true }),
  PERM('attendance.audit.export', 'attendance', 'Export attendance audit trail', [AD, T]),
  PERM('attendance.offline.sync', 'offline_attendance', 'Offline attendance sync', [AD, T]),
  PERM('attendance.offline.import', 'offline_attendance', 'Import offline attendance', ALL, { knownIssue: HOLE }),
  PERM('attendance.reports.view', 'attendance_reports', 'View attendance reports', ALL, { knownIssue: HOLE }),
  PERM('attendance.reports.export', 'attendance_reports', 'Export attendance reports', ALL, { knownIssue: HOLE }),
  PERM('attendance.corrections.view', 'attendance_corrections', 'View correction requests', ALL),
  PERM('attendance.corrections.request', 'attendance_corrections', 'Request attendance corrections', ALL),
  PERM('attendance.corrections.review', 'attendance_corrections', 'Review attendance corrections', [AD]),
  // mentors
  PERM('mentors.manage', 'mentors_and_temporary_assignments', 'Assign class mentors', [AD]),
  PERM('mentors.workspace', 'mentors_and_temporary_assignments', 'Mentor workspace', [AD, T]),
  PERM('mentors.permissions.manage', 'mentors_and_temporary_assignments', 'Manage mentor publishing permissions', [AD, T]),
  PERM('temporary_assignments.manage', 'mentors_and_temporary_assignments', 'Manage temporary class assignments', [AD]),
  // assignments
  PERM('assignments.view', 'assignments', 'View assignments', [AD, T]),
  PERM('assignments.create', 'assignments', 'Create / edit assignments', [AD, T]),
  PERM('assignments.delete', 'assignments', 'Delete assignments', [AD, T], { dangerous: true }),
  PERM('assignments.grade', 'assignments', 'View submissions & grade', [AD, T]),
  PERM('student.assignments.view', 'assignments', 'View my assignments', [S]),
  PERM('student.assignments.submit', 'assignments', 'Submit assignments', [S]),
  // communication
  PERM('announcements.view', 'announcements_communication', 'View announcements', ALL),
  PERM('announcements.manage', 'announcements_communication', 'Create / edit announcements', [AD, T]),
  PERM('announcements.publish', 'announcements_communication', 'Publish announcements', [AD, T]),
  PERM('announcements.reply', 'announcements_communication', 'Reply to announcements', ALL),
  PERM('announcements.replies.view', 'announcements_communication', 'View replies', ALL),
  PERM('announcements.delivery.view', 'announcements_communication', 'View delivery summary', [AD]),
  // notifications
  PERM('notifications.logs.view', 'notification_logs', 'View notification logs', [AD, T]),
  PERM('notifications.settings.manage', 'notification_logs', 'Manage channels, templates & SMTP', [AD], { dangerous: true }),
  PERM('notifications.attendance_email.send', 'notification_logs', 'Send attendance e-mails', [AD, T]),
  // leave
  PERM('leave.student.view', 'student_leave', 'View student leave requests', ALL, { knownIssue: HOLE }),
  PERM('leave.student.review', 'student_leave', 'Approve / reject student leave', ALL, { knownIssue: HOLE }),
  PERM('student.leave.apply', 'student_leave', 'Apply for student leave', ALL),
  PERM('leave.teacher.apply', 'teacher_leave', 'Apply for teacher leave', ALL),
  PERM('leave.teacher.view', 'teacher_leave', 'View / export teacher leave', ALL, { knownIssue: HOLE }),
  PERM('leave.teacher.review', 'teacher_leave', 'Approve / reject teacher leave', [AD]),
  PERM('leave.policy.view', 'leave_policy', 'View leave policy', [AD, T]),
  PERM('leave.policy.manage', 'leave_policy', 'Manage leave policy', [AD]),
  // photos
  PERM('photos.request', 'photo_approvals', 'Request photo change', ALL),
  PERM('photos.view', 'photo_approvals', 'View photo requests', ALL, { knownIssue: HOLE }),
  PERM('photos.review', 'photo_approvals', 'Approve / reject photos', ALL, { knownIssue: HOLE }),
  // promotions / analytics / portals
  PERM('promotions.view', 'promotions', 'View promotion candidates', ALL),
  PERM('promotions.manage', 'promotions', 'Execute promotions', [AD], { dangerous: true }),
  PERM('analytics.view', 'analytics', 'View analytics', ALL),
  PERM('analytics.manage', 'analytics', 'Capture analytics snapshots', [AD]),
  PERM('parent.portal.view', 'parent_portal', 'Parent portal', [P]),
  PERM('student.portal.view', 'student_portal', 'Student portal', [S]),
];

const FEATURE_MAP = new Map(FEATURES.map((f) => [f.key, f]));
const PERMISSION_MAP = new Map(PERMISSIONS.map((p) => [p.key, p]));

export const getFeature = (key: string) => FEATURE_MAP.get(key) || null;
export const getPermission = (key: string) => PERMISSION_MAP.get(key) || null;

/** Feature + every feature it (transitively) depends on, nearest first. */
export function featureChain(key: string): string[] {
  const out: string[] = [];
  const visit = (k: string) => {
    if (out.includes(k)) return;
    out.push(k);
    for (const d of getFeature(k)?.dependsOn || []) visit(d);
  };
  visit(key);
  return out;
}

/** Features that (transitively) depend on `key` — turning `key` OFF disables these too. */
export function featureDependents(key: string): string[] {
  return FEATURES.filter((f) => f.key !== key && featureChain(f.key).includes(key)).map((f) => f.key);
}

export type LockInfo = { locked: boolean; reason?: string };

/** Whether a ROLE-level toggle is locked for this role. */
export function roleToggleLock(perm: PermissionDef, role: BaseRole): LockInfo {
  if (!perm.ceilingRoles.includes(role)) return { locked: true, reason: 'This role cannot reach this feature today (restrict-only v1).' };
  if (perm.locked || getFeature(perm.feature)?.core && perm.feature !== 'access_control' && perm.feature !== 'billing') {
    return { locked: true, reason: 'Core permission — always on.' };
  }
  if (perm.lockedForAdmin && role === 'SCHOOL_ADMIN') return { locked: true, reason: 'Always on for School Admin (lock-out protection).' };
  return { locked: false };
}

/** Whether a PER-PERSON override is locked for this permission/role. */
export function principalToggleLock(perm: PermissionDef, role: BaseRole): LockInfo {
  if (!perm.ceilingRoles.includes(role)) return { locked: true, reason: 'This role cannot reach this feature today (restrict-only v1).' };
  if (perm.locked) return { locked: true, reason: 'Core permission — always on.' };
  if (perm.feature === 'billing' && role === 'SCHOOL_ADMIN') return { locked: true, reason: 'Billing is always available to School Admins.' };
  return { locked: false };
}

// ---------------------------------------------------------------------------
// Route bindings (method + canonical path → feature/permission)
// First match wins. `permission: null` = UNGATED (never gated, R11 / never-gate list).
// ---------------------------------------------------------------------------
export type RouteBinding = { methods: RegExp; path: RegExp; feature: string | null; permission: string | null; note?: string };

const ANY = 'GET|POST|PUT|PATCH|DELETE';
const W = 'POST|PUT|PATCH|DELETE';
const X = '[^/]+';
const B = (methods: string, path: RegExp, feature: string | null, permission: string | null, note?: string): RouteBinding =>
  ({ methods: new RegExp(`^(${methods})$`), path, feature, permission, note });
const UNGATED = (path: RegExp, note: string, methods = ANY) => B(methods, path, null, null, note);

export const ROUTE_BINDINGS: RouteBinding[] = [
  // ---- never gated ----
  UNGATED(/^\/(health|api)?$/, 'root probes'),
  UNGATED(/^\/api\/health(\/|$)/, 'health'),
  UNGATED(/^\/api\/auth(\/|$)/, 'auth core'),
  UNGATED(/^\/api\/access(\/|$)/, 'access control API (own authorization)'),
  UNGATED(/^\/api\/webhooks(\/|$)/, 'signature-verified webhook'),
  UNGATED(/^\/api\/super-admin(\/|$)/, 'platform; SUPER_ADMIN only'),
  UNGATED(/^\/api\/demo-request(\/|$)/, 'public lead form'),
  UNGATED(/^\/api\/production(\/|$)/, 'ops probes'),
  UNGATED(/^\/api\/final-integration(\/|$)/, 'platform diagnostics'),
  UNGATED(/^\/api\/backups(\/|$)/, 'platform; SUPER_ADMIN only'),
  UNGATED(/^\/api\/security(\/|$)/, 'auth/security core'),
  UNGATED(/^\/api\/analytics\/(platform|rankings|events)$/, 'platform analytics (SUPER_ADMIN inline)'),
  UNGATED(/^\/api\/dashboard\/super-admin$/, 'platform dashboard', 'GET'),
  UNGATED(/^\/api\/school-payment(\/|$)/, 'school billing/payment (never gated)'),

  // ---- core ----
  B(ANY, /^\/api\/permissions(\/|$)/, 'access_control', 'access.manage', 'legacy permission API'),
  B('GET', /^\/api\/subscriptions(\/|$)/, 'billing', 'billing.view'),
  B('POST', /^\/api\/subscriptions\/run-worker$/, 'billing', 'billing.view', 'known issue: any role can run worker'),
  B('GET', /^\/api\/invoices(\/|$)/, 'billing', 'billing.view'),
  B(W, /^\/api\/invoices(\/|$)/, 'billing', 'billing.pay'),
  B('GET', /^\/api\/dashboard\/(school|overview)$/, 'dashboard', 'dashboard.view'),
  B('GET', /^\/api\/search$/, 'dashboard', 'dashboard.view'),
  B('GET', /^\/api\/reviews\/notifications$/, 'dashboard', 'dashboard.view', 'bell aggregator'),
  B(ANY, /^\/api\/school-profile(\/|$)/, 'profile', 'profile.school.manage'),
  B(ANY, /^\/api\/teacher\/(profile|change-password|photo)$/, 'profile', 'profile.self'),
  B(ANY, /^\/api\/student\/(me|profile|change-password|photo)$/, 'profile', 'profile.self'),

  // ---- students / parents ----
  B('GET', /^\/api\/students\/template$/, 'students', 'students.create'),
  B('GET', new RegExp(`^\\/api\\/(students|people\\/students)(\\/${X})?$|^\\/api\\/people$`), 'students', 'students.view'),
  B('POST', /^\/api\/students(\/bulk-import)?$/, 'students', 'students.create'),
  B('PUT|PATCH', new RegExp(`^\\/api\\/(students|people\\/students)\\/${X}(\\/status)?$`), 'students', 'students.edit'),
  B('POST', new RegExp(`^\\/api\\/students\\/${X}\\/send-reset-email$`), 'students', 'students.edit'),
  B('DELETE|POST', new RegExp(`^\\/api\\/students(\\/bulk-delete|\\/${X})$`), 'students', 'students.delete'),
  B('GET', /^\/api\/analytics\/export-students$/, 'students', 'students.export'),
  B(ANY, /^\/api\/parent-onboarding(\/|$)/, 'parent_portal', 'parents.manage'),

  // ---- teachers / designations ----
  B('GET', /^\/api\/teachers\/template$/, 'teachers', 'teachers.create'),
  B('GET|PUT', new RegExp(`^\\/api\\/teachers\\/${X}\\/assignments$|^\\/api\\/teacher-assignments$`), 'classes_subjects', 'subjects.assign'),
  B('GET', new RegExp(`^\\/api\\/(teachers|people\\/teachers)(\\/${X})?$`), 'teachers', 'teachers.view'),
  B('POST', /^\/api\/teachers(\/bulk-import)?$/, 'teachers', 'teachers.create'),
  B('PUT|PATCH', new RegExp(`^\\/api\\/(teachers|people\\/teachers)\\/${X}(\\/status)?$`), 'teachers', 'teachers.edit'),
  B('POST', new RegExp(`^\\/api\\/teachers\\/${X}\\/send-reset-email$`), 'teachers', 'teachers.edit'),
  B('DELETE|POST', new RegExp(`^\\/api\\/teachers(\\/bulk-delete|\\/${X})$`), 'teachers', 'teachers.delete'),
  B('GET', /^\/api\/designations(\/|$)/, 'designations', 'designations.view'),
  B(W, /^\/api\/designations\/promot/, 'designations', 'designations.promote'),
  B(W, /^\/api\/designations(\/|$)/, 'designations', 'designations.manage'),

  // ---- classes / subjects / academic years ----
  B('GET', /^\/api\/(classes|sections|subjects)$/, 'classes_subjects', 'classes.view'),
  B(W, new RegExp(`^\\/api\\/(classes|sections|subjects)(\\/${X})?$`), 'classes_subjects', 'classes.manage'),
  B('GET', /^\/api\/academic-years(\/active)?$/, 'classes_subjects', 'academic_years.view'),
  B(W, /^\/api\/academic-years(\/|$)/, 'classes_subjects', 'academic_years.manage'),

  // ---- calendar ----
  B('GET', /^\/api\/calendar(\/|$)/, 'academic_calendar', 'calendar.view'),
  B(W, /^\/api\/calendar(\/|$)/, 'academic_calendar', 'calendar.manage'),

  // ---- timetable ----
  B('GET', /^\/api\/timetable(\/|$)/, 'timetable', 'timetable.view'),
  B('POST', new RegExp(`^\\/api\\/timetable\\/entries\\/${X}\\/publish$`), 'timetable', 'timetable.publish'),
  B(W, /^\/api\/timetable(\/|$)/, 'timetable', 'timetable.manage'),
  B('GET', /^\/api\/routines$/, 'timetable', 'timetable.view'),
  B(W, /^\/api\/routines(\/|$)/, 'timetable', 'timetable.manage'),
  B('GET', /^\/api\/teacher\/routine\//, 'timetable', 'timetable.view'),
  B('GET', /^\/api\/student\/timetable$/, 'timetable', 'timetable.view'),

  // ---- attendance ----
  B('GET', new RegExp(`^\\/api\\/teacher\\/(attendance\\/)?(${X}\\/)?audit-trail\\/export$`), 'attendance', 'attendance.audit.export'),
  B('POST', /^\/api\/teacher(\/attendance)?$/, 'attendance', 'attendance.take'),
  B('PUT', new RegExp(`^\\/api\\/teacher\\/(attendance\\/)?${X}\\/student\\/${X}$`), 'attendance', 'attendance.edit'),
  B('POST', new RegExp(`^\\/api\\/teacher\\/(attendance\\/)?${X}\\/reattendance$`), 'attendance', 'attendance.edit_past'),
  B('GET', /^\/api\/teacher(\/(?!mentor\/|assignments(\/|$))|$)/, 'attendance', 'attendance.view'),
  B('GET', /^\/api\/student\/attendance$/, 'attendance', 'attendance.view'),
  B(ANY, /^\/api\/offline-attendance(\/|$)/, 'offline_attendance', 'attendance.offline.sync'),
  B('POST', /^\/api\/attendance-reports\/import-offline$/, 'offline_attendance', 'attendance.offline.import'),
  B('GET', /^\/api\/attendance-reports\/export\//, 'attendance_reports', 'attendance.reports.export'),
  B('GET', /^\/api\/attendance-reports(\/|$)/, 'attendance_reports', 'attendance.reports.view'),
  B('GET', /^\/api\/attendance-corrections(\/|$)/, 'attendance_corrections', 'attendance.corrections.view'),
  B('POST', /^\/api\/attendance-corrections$/, 'attendance_corrections', 'attendance.corrections.request'),
  B('POST', new RegExp(`^\\/api\\/attendance-corrections\\/${X}\\/review$`), 'attendance_corrections', 'attendance.corrections.review'),

  // ---- mentors / temporary assignments ----
  B(ANY, /^\/api\/admin\/mentors$/, 'mentors_and_temporary_assignments', 'mentors.manage'),
  B('PUT', /^\/api\/teacher\/mentor\/permissions$/, 'mentors_and_temporary_assignments', 'mentors.permissions.manage'),
  B('GET', /^\/api\/teacher\/mentor\//, 'mentors_and_temporary_assignments', 'mentors.workspace'),
  B(ANY, /^\/api\/admin\/temporary-assignments(\/|$)/, 'mentors_and_temporary_assignments', 'temporary_assignments.manage'),

  // ---- assignments ----
  B('PUT', new RegExp(`^\\/api\\/teacher\\/assignments\\/${X}\\/submissions\\/${X}\\/grade$`), 'assignments', 'assignments.grade'),
  B('GET', new RegExp(`^\\/api\\/teacher\\/assignments\\/${X}\\/submissions(\\/|$)`), 'assignments', 'assignments.grade'),
  B('GET', /^\/api\/teacher\/assignments(\/|$)/, 'assignments', 'assignments.view'),
  B('DELETE', new RegExp(`^\\/api\\/teacher\\/assignments\\/${X}$`), 'assignments', 'assignments.delete'),
  B(W, /^\/api\/teacher\/assignments(\/|$)/, 'assignments', 'assignments.create'),
  B('GET', /^\/api\/student\/assignments(\/|$)/, 'assignments', 'student.assignments.view'),
  B('POST|DELETE', /^\/api\/student\/assignments\//, 'assignments', 'student.assignments.submit'),

  // ---- communication ----
  B('POST', new RegExp(`^\\/api\\/communication\\/announcements\\/${X}\\/publish$|^\\/api\\/communication\\/process-scheduled$`), 'announcements_communication', 'announcements.publish'),
  B(W, new RegExp(`^\\/api\\/communication\\/announcements(\\/${X})?$`), 'announcements_communication', 'announcements.manage'),
  B('POST', new RegExp(`^\\/api\\/communication\\/announcements\\/${X}\\/reply$`), 'announcements_communication', 'announcements.reply'),
  B('GET', new RegExp(`^\\/api\\/communication\\/(replies|announcements\\/${X}\\/replies)$`), 'announcements_communication', 'announcements.replies.view'),
  B('GET', /^\/api\/communication\/delivery-summary$/, 'announcements_communication', 'announcements.delivery.view'),
  B('GET|POST|PUT', /^\/api\/communication\/(teacher|parent)\//, 'announcements_communication', 'announcements.view'),
  B('GET', /^\/api\/communication(\/|$)/, 'announcements_communication', 'announcements.view'),
  B('GET|POST', /^\/api\/student\/announcements(\/|$)/, 'announcements_communication', 'announcements.view'),

  // ---- notifications ----
  B('POST', /^\/api\/(notification-channels|notifications)\/attendance-email$/, 'notification_logs', 'notifications.attendance_email.send'),
  B('GET', /^\/api\/(notification-channels\/(logs|smtp-logs|analytics)|notifications(\/(logs|email-logs))?)$/, 'notification_logs', 'notifications.logs.view'),
  B(ANY, /^\/api\/(notification-channels|notifications)(\/|$)/, 'notification_logs', 'notifications.settings.manage'),

  // ---- leave ----
  B('PUT', new RegExp(`^\\/api\\/reviews\\/teacher-leaves\\/${X}\\/(approve|reject)$`), 'teacher_leave', 'leave.teacher.review'),
  B('GET', /^\/api\/reviews\/teacher-leaves(\/export-excel)?$/, 'teacher_leave', 'leave.teacher.view'),
  B('GET|POST', /^\/api\/reviews\/teacher-leaves(\/my)?$/, 'teacher_leave', 'leave.teacher.apply'),
  B('PUT', /^\/api\/reviews\/leaves\//, 'student_leave', 'leave.student.review'),
  B('GET', /^\/api\/reviews\/leaves$/, 'student_leave', 'leave.student.view'),
  B('POST', /^\/api\/reviews\/leaves$/, 'student_leave', 'student.leave.apply'),
  B('GET|POST', /^\/api\/student\/leave-requests$/, 'student_leave', 'student.leave.apply'),
  B('GET', /^\/api\/leave-policies(\/|$)/, 'leave_policy', 'leave.policy.view'),
  B(W, /^\/api\/leave-policies(\/|$)/, 'leave_policy', 'leave.policy.manage'),

  // ---- photos ----
  B('PUT', new RegExp(`^\\/api\\/reviews\\/photos\\/${X}\\/(approve|reject)$`), 'photo_approvals', 'photos.review'),
  B('GET', /^\/api\/reviews\/photos$/, 'photo_approvals', 'photos.view'),
  B('POST', /^\/api\/reviews\/photos$/, 'photo_approvals', 'photos.request'),

  // ---- promotions / analytics / portals ----
  B('GET', /^\/api\/student-promotions(\/|$)/, 'promotions', 'promotions.view'),
  B('POST', /^\/api\/student-promotions\//, 'promotions', 'promotions.manage'),
  B('POST', /^\/api\/analytics\/snapshot$/, 'analytics', 'analytics.manage'),
  B('GET', /^\/api\/analytics(\/school|\/summary)?$/, 'analytics', 'analytics.view'),
  B(ANY, /^\/api\/parent-portal(\/|$)/, 'parent_portal', 'parent.portal.view'),
  B('GET', /^\/api\/student\/(dashboard|exams)$/, 'student_portal', 'student.portal.view'),
];

/** Fold alias mounts (see app.ts) onto canonical paths. Order matters. */
export function canonicalPath(rawPath: string): string {
  let p = String(rawPath || '/').split('?')[0].replace(/\/{2,}/g, '/').toLowerCase();
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return p
    .replace(/^\/api\/notifications-v11(?=\/|$)/, '/api/notification-channels')
    .replace(/^\/api\/final-v28(?=\/|$)/, '/api/final-integration')
    .replace(/^\/api\/([a-z-]+)-v\d+(?=\/|$)/, '/api/$1')
    .replace(/^\/api\/notifications-channels(?=\/|$)/, '/api/notification-channels')
    .replace(/^\/api\/attendance(?=\/|$)/, '/api/teacher')
    .replace(/^\/designations(?=\/|$)/, '/api/designations')
    .replace(/^\/leave-policies(?=\/|$)/, '/api/leave-policies')
    .replace(/^\/demo-request(?=\/|$)/, '/api/demo-request');
}

export function findRouteBinding(method: string, rawPath: string): RouteBinding | null {
  const m = String(method || '').toUpperCase();
  const p = canonicalPath(rawPath);
  return ROUTE_BINDINGS.find((b) => b.methods.test(m) && b.path.test(p)) || null;
}

/** Catalog self-consistency (used by tests and at boot in dev). Returns problems. */
export function validateCatalog(): string[] {
  const problems: string[] = [];
  const fk = new Set<string>();
  for (const f of FEATURES) {
    if (fk.has(f.key)) problems.push(`duplicate feature ${f.key}`);
    fk.add(f.key);
    for (const d of f.dependsOn || []) if (!getFeature(d)) problems.push(`feature ${f.key} depends on unknown ${d}`);
  }
  const pk = new Set<string>();
  for (const p of PERMISSIONS) {
    if (pk.has(p.key)) problems.push(`duplicate permission ${p.key}`);
    pk.add(p.key);
    if (!getFeature(p.feature)) problems.push(`permission ${p.key} has unknown feature ${p.feature}`);
    if (p.key.length > 80) problems.push(`permission ${p.key} longer than 80 chars`);
    for (const r of p.defaultRoles) if (!p.ceilingRoles.includes(r)) problems.push(`permission ${p.key}: default ${r} outside ceiling`);
  }
  for (const b of ROUTE_BINDINGS) {
    if (b.permission && !getPermission(b.permission)) problems.push(`binding ${b.path} → unknown permission ${b.permission}`);
    if (b.permission && getPermission(b.permission)!.feature !== b.feature) problems.push(`binding ${b.path} feature mismatch`);
  }
  return problems;
}
