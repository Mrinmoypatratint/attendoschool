# RBAC Catalog — P0 DRAFT (superseded)

> **Superseded by `backend/src/rbac/catalog.ts`.** Kept as the P0 discovery record. Differences from this draft:
> `leave.student.view`, `leave.teacher.view` and `photos.view` were split out so admins can restrict list views
> separately; `defaultRoles = ceilingRoles = Today` everywhere (R1/R4 — the "Intended" column was NOT applied);
> `leave.teacher.review` is `AD` after the P6 fix; `/api/school-payment/*` is UNGATED (never-gate list).

Source of truth after P1 will be `backend/src/rbac/catalog.ts`. This draft is derived from
`route-permission-map.md` (middleware-level baseline) plus the inline handler checks read in P0.

Legend: SA = SUPER_ADMIN (always allowed by resolver layer 0, so never listed), AD = SCHOOL_ADMIN,
T = TEACHER, S = STUDENT, P = PARENT.

- **Today** = effective roles that reach the handler AND pass its inline checks today.
- **Intended** = what the code/UI/comments say the access should be. Shown only where it differs from today,
  because of a confirmed authorization hole. **Owner decision Q3:** which column becomes `defaultRoles`/`ceilingRoles`.

## Features

| Feature | Core | defaultEnabled | dependsOn | Notes |
| --- | --- | --- | --- | --- |
| access_control | ✅ | on | — | locked; access.manage never off for AD (R10) |
| billing | ✅ | on | — | subscriptions, invoices, school-payment |
| dashboard | ✅ | on | — | dashboards, global search, bell aggregator |
| profile | ✅ | on | — | own profile/password/photo; school profile |
| students | | on | — | |
| teachers | | on | — | |
| classes_subjects | | on | — | classes, sections, subjects, academic years, subject allocation |
| designations | | on | teachers | teacher designations & designation promotions |
| academic_calendar | | on | — | holidays, working days |
| timetable | | on | classes_subjects | timetable + legacy routines |
| attendance | | on | — | take/edit/reattendance/history/audit export |
| attendance_corrections | | on | attendance | |
| attendance_reports | | on | attendance | |
| offline_attendance | | on | attendance | offline sync + offline import |
| mentors_and_temporary_assignments | | on | — | class mentors, mentor workspace, temporary assignments |
| assignments | | on | — | teacher assignments, grading, student submissions |
| announcements_communication | | on | — | announcements, replies, inboxes |
| notification_logs | | on | — | notification channels/templates/SMTP/logs, attendance e-mail |
| student_leave | | on | — | |
| teacher_leave | | on | — | |
| leave_policy | | on | — | |
| photo_approvals | | on | — | |
| promotions | | on | students | student promotions |
| analytics | | on | — | school analytics |
| parent_portal | | on | — | parent portal + parent onboarding |
| student_portal | | on | — | student dashboard/exams |
| ~~backups~~ | — | — | — | **Not a school feature**: `/api/backups` is SUPER_ADMIN-only; listed as UNGATED platform route (Q8) |

`academic_years` is folded into `classes_subjects` rather than invented as a separate module.

## Permissions

| Permission | Feature | Today | Intended (if different) | Flags |
| --- | --- | --- | --- | --- |
| access.manage | access_control | AD | | locked for AD |
| access.login.manage | access_control | — (new) | AD | dangerous; new capability (no route today) |
| billing.view | billing | AD, T, S, P (GET /api/subscriptions*) / AD (invoices, school-payment) | AD | locked for AD |
| billing.pay | billing | AD | | locked for AD |
| dashboard.view | dashboard | AD, T | | core |
| profile.self | profile | AD, T, S | | core |
| profile.school.manage | profile | AD | | core |
| students.view | students | AD, T | | |
| students.create | students | AD | | |
| students.edit | students | AD | | |
| students.delete | students | AD | | dangerous |
| students.export | students | AD, T, S, P (analytics/export-students: school context only) | AD, T | ⚠️ hole |
| parents.manage | parent_portal | AD | | ⚠️ cross-school hole (P6 bug 2) |
| teachers.view | teachers | AD, T | | |
| teachers.create | teachers | AD | | |
| teachers.edit | teachers | AD | | |
| teachers.delete | teachers | AD | | dangerous |
| designations.view | designations | AD, T | | |
| designations.manage | designations | AD | | |
| designations.promote | designations | AD | | |
| classes.view | classes_subjects | AD, T | | |
| classes.manage | classes_subjects | AD | | |
| subjects.assign | classes_subjects | AD | | |
| academic_years.view | classes_subjects | AD, T (`/active`: AD, T, S, P) | | |
| academic_years.manage | classes_subjects | AD | | |
| calendar.view | academic_calendar | AD, T | | |
| calendar.manage | academic_calendar | AD | | |
| timetable.view | timetable | AD, T, S, P | | |
| timetable.manage | timetable | AD | | |
| timetable.publish | timetable | AD | | |
| attendance.view | attendance | AD, T, S (own) | | |
| attendance.take | attendance | AD, T (class teacher / mentor / temporary) | | |
| attendance.edit | attendance | AD, T (requireAttendanceTeacher) | | |
| attendance.edit_past | attendance | AD, T | | reattendance |
| attendance.audit.export | attendance | AD, T | | |
| attendance.offline.sync | offline_attendance | AD, T | | |
| attendance.offline.import | offline_attendance | AD, T, S, P (no role check; `?schoolId` honoured) | AD, T | ⚠️ cross-tenant write hole |
| attendance.reports.view | attendance_reports | AD, T, S, P (no role check; `?schoolId` honoured) | AD, T | ⚠️ cross-tenant read hole |
| attendance.reports.export | attendance_reports | AD, T, S, P (same) | AD, T | ⚠️ cross-tenant read hole |
| attendance.corrections.view | attendance_corrections | AD, T, S, P (school context only) | ⚠️ ask | |
| attendance.corrections.request | attendance_corrections | AD, T, S, P (school context only) | ⚠️ ask | |
| attendance.corrections.review | attendance_corrections | AD | | |
| mentors.manage | mentors_and_temporary_assignments | AD | | |
| mentors.workspace | mentors_and_temporary_assignments | AD, T | | |
| mentors.permissions.manage | mentors_and_temporary_assignments | AD, T | ⚠️ ask (T can PUT mentor permissions) | |
| temporary_assignments.manage | mentors_and_temporary_assignments | AD | | |
| assignments.view | assignments | AD, T | | |
| assignments.create | assignments | AD, T | | create / edit / attach |
| assignments.delete | assignments | AD, T | | |
| assignments.grade | assignments | AD, T | | |
| student.assignments.view | assignments | S | | |
| student.assignments.submit | assignments | S | | |
| announcements.view | announcements_communication | AD, T, S, P | | |
| announcements.manage | announcements_communication | AD, T (teacher: own only) | | |
| announcements.publish | announcements_communication | AD, T (own) | | |
| announcements.reply | announcements_communication | AD, T, S, P | | |
| announcements.replies.view | announcements_communication | AD, T (+ per-announcement replies: all) | | |
| announcements.delivery.view | announcements_communication | AD | | |
| notifications.logs.view | notification_logs | AD, T | | |
| notifications.settings.manage | notification_logs | AD | | |
| notifications.attendance_email.send | notification_logs | AD, T | | |
| leave.student.review | student_leave | AD, T (mentor) **+ S, P** (fall into admin branch) | AD, T | ⚠️ hole |
| student.leave.apply | student_leave | S (student route); POST /reviews/leaves: any role, body `studentId` trusted | S, P | ⚠️ hole |
| leave.teacher.apply | teacher_leave | any school role | T | |
| leave.teacher.review | teacher_leave | any school role (list, export, approve, reject) | AD | ⚠️ P6 bug 1 |
| leave.policy.view | leave_policy | AD, T | | |
| leave.policy.manage | leave_policy | AD | | |
| photos.request | photo_approvals | any school role | ⚠️ ask | |
| photos.review | photo_approvals | AD, T (scoped) **+ S, P** (admin branch) | AD, T | ⚠️ hole |
| promotions.view | promotions | AD, T, S, P (school context only) | AD, T | ⚠️ ask |
| promotions.manage | promotions | AD | | dangerous |
| analytics.view | analytics | AD, T, S, P (school context only) | AD, T | ⚠️ ask |
| analytics.manage | analytics | AD | | |
| parent.portal.view | parent_portal | P | | |
| student.portal.view | student_portal | S | | |

## Resolver notes carried into P1
- Role normalisation: tokens only carry the 5 base roles. Login maps `ADMIN`/`ADMINISTRATOR` → `SUPER_ADMIN`
  (`routes/auth.ts:270`). `attendanceAuth` accepts `ADMIN`/`PRINCIPAL` literals as admin; the resolver will map
  `ADMIN`/`ADMINISTRATOR` → `SUPER_ADMIN` and `PRINCIPAL` → `SCHOOL_ADMIN`, identical to existing checks.
- Principal id = JWT `id` (SQL `users.id` / Firestore user doc id). STUDENT tokens also carry `studentId` (students.id).
- School id = `canonicalSchoolId(user.schoolId)`. The SQL login path does **not** canonicalise; the Firestore and demo paths do.
