# UI Reskin Plan — AttendoSchool

Visual-only re-skin to the flat "school office" design language (white panels, 1px borders, one accent `#e11d55`,
Assistant font, 4px radius, bold uppercase labels). **Zero functional change**: no API, route, guard, handler,
prop, test-hook or text changes.

Branch: `feature/ui-reskin` (local; not pushed — pushing auto-merges to `main` and deploys).

## Step 0 — Inventory

### Tech stack
| Area | Finding |
| --- | --- |
| Framework | React 19 + Vite 7 + TypeScript (`frontend/`) |
| Router | `react-router-dom` 7, **HashRouter** (`/#/...`), routes in `frontend/src/App.tsx` |
| Styling | Tailwind 3.4 (`preflight: false`) **plus** a 14k-line global `src/styles.css`, `super-admin/super-admin.css` (3.8k), `components/student/student-portal.css` (1.3k), and many inline `style={{}}` objects |
| Tokens | Existing CSS variable layer in `styles.css` `:root` (`--primary-50…900`, `--gray-*`, `--bg*`, `--text*`, `--border*`, `--shadow-*`, `--radius-*`, `--font`) and a dark block |
| Component library | none (hand-written); shared widgets in `src/components/*`, preview/confirm modals in `src/components/preview/*` |
| Icons | `lucide-react` (line set — kept) |
| Charts | none as a library (CSS/SVG inline) |
| Fonts | Google Fonts `<link>` in `index.html` (DM Sans, DM Serif, Caveat, Inter, Kalam, Orbitron, Share Tech Mono) |
| Dark mode | **Yes** — `[data-theme="dark"]` / `.dark` (Tailwind `darkMode: ['class','[data-theme="dark"]']`) |

### Roles, shells, navigation
| Role | Shell | Nav config |
| --- | --- | --- |
| SCHOOL_ADMIN | `Layout` in `App.tsx` (`.app-shell`, `.app-topbar`, `aside`) | `adminLinks` in `App.tsx` |
| TEACHER | same `Layout` | `teacherLinks` |
| PARENT | same `Layout` | `adminLinks` fallback (parent pages: `/parent-portal`, `/parent-communication`) |
| SUPER_ADMIN | `super-admin/SuperAdminLayout.tsx` (`.sa-*`) | `navGroups` in `SuperAdminLayout.tsx` |
| STUDENT | `components/student/StudentLayout` (`.student-*`) | student layout nav |

### Screens (by module; routes from `App.tsx`)
- **Dashboards:** `/dashboard` (AdminHome / TeacherHome / SuperAdminHome), `/student/dashboard`, `/super-admin`.
- **People:** `/students`, `/teachers`, `/designations`, `/people`→`/students`.
- **Classes & subjects:** `/classes` (incl. temporary assignments tab), `/subjects`, `/routine`.
- **Attendance:** `/take-attendance`, `/attendance-reports`, `/attendance-corrections`, `/offline-attendance`, `/student/attendance`.
- **Timetable & calendar:** `/timetable`, `/academic-years`, `/calendar`, `/working-calendar`, `/holidays`, `/settings`, `/student/timetable`.
- **Assignments:** `/teacher/assignments`, `/student/assignments`.
- **Communication:** `/communication`, `/announcements`, `/smtp-logs`, `/notifications`, `/parent-communication`, `/student/announcements`.
- **Leave & reviews:** `/leave-applications`, `/teacher-leave-approvals`, `/teacher/leave-request`, `/leave-policy`, `/photo-approvals`, `/student/leave-request`.
- **Mentors:** `/teacher/mentor-workspace`.
- **Promotions / analytics:** `/promotion`, `/analytics`.
- **Settings / security:** `/school-profile`, `/permissions` (Access Control), `/subscription-enforcement`, `/security`, `/backups`, `/teacher/profile`, `/student/profile`.
- **Super Admin module:** overview, schools, subscriptions, payments, invoices, monitoring, analytics, reports, people, features & permissions, security, audit logs, backups, settings.
- **Public/auth:** `/` landing, `/login`, `/reset-password`.
- **Not present in code:** Exams & Results, Fees collection UI for schools (billing only), Library, Transport — no screens to restyle.

### Shared components
`components/TablePagination.tsx` (toolbar + pagination), `Toast.tsx`, `PopupModal.tsx`, `preview/*` (UniversalPreviewModal,
DestructiveConfirmModal), `SidebarToggle.tsx`, `AnnouncementDateFilter.tsx`, hover cards, `TemporaryAssignment*`,
RBAC `rbac/components.tsx` (ToggleSwitch, TriState, ConfirmChangeModal, SourceBadge), `rbac/accessGate.tsx`.

### Protected surfaces (do not change)
- Test hooks: every `data-testid`, `aria-*`, `role`, `id`, `name`; e2e selectors `.app-shell`, `.app-topbar`,
  `.app-shell > main`, `.app-shell > aside`, `.student-topbar`, `.student-main-wrapper`, `.student-sidebar`,
  `.sa-topbar`, `.sa-main-wrap`, `.sa-sidebar`, `button[aria-controls="primary-navigation"]`, sidebar button names.
- Printable/official outputs: invoice/receipt PDFs are generated server-side (`pdfkit`) — untouched. Attendance
  report exports are CSV/PDF/XLSX from the backend — untouched.
- All text strings (labels, statuses) — case changes only via CSS `text-transform`.

### Commands & baseline (2026-11-08, before any styling change)
| Command | Result |
| --- | --- |
| `npm --prefix frontend run build` (tsc -b + vite build = typecheck) | ✅ pass |
| `npm --prefix backend run build` | ✅ pass |
| Lint | no lint script exists in any package.json |
| `npx playwright test` (Vite dev server, no backend) | **8 passed, 10 failed** — all 10 failures are pre-existing `navigation-layout.spec.ts` cases (pathname URLs with HashRouter, §16 of PROJECT_CONTEXT) |
| Backend RBAC suites (`rbac-baseline/resolver/enforcement/security-fixes`, `auth-demo-fallback`) | ✅ all pass (unaffected by UI) |
| Pre-existing `npm test` | not run (talks to configured live databases) |

## Approach (highest leverage, styling layers only)
1. **Token layer** `src/theme/tokens.css` (imported after the existing CSS): re-points every existing variable
   (`--primary-*`, `--gray-*`, `--bg*`, `--text*`, `--border*`, `--radius-*`, `--shadow-*`, `--font`) to the new
   palette, adds the new semantic tokens, light + dark.
2. **Tailwind theme mapping** (`tailwind.config.js`): blue/indigo → primary scale, violet/purple/sky/cyan → info,
   slate/gray/zinc → neutral greys, emerald/green/teal → success, amber/yellow/orange → warning, red/rose → destructive,
   pink → primary; radii → 4px (full stays); shadows → none / one small floating shadow; backdrop blur → 0;
   font → Assistant. Gradient utilities collapse to the flat "from" colour via a small plugin.
3. **Global component CSS** `src/theme/components.css`: base element + existing class styling (buttons, inputs,
   tables, badges, tabs, modals, toasts, nav active state, shells, focus ring, print, reduced motion).
4. **Sweep**: mechanical removal of `linear/radial-gradient`, `backdrop-filter`, emoji decorations in restyled files.

## Phases & commits
(filled in as work proceeds — see "Results" below)

## Needs owner decision
(see "Results")

## Results

Continuation completed locally on `feature/ui-reskin`, 2026-11-08. No push, merge, backend change, dependency installation, test edit, API/route/guard/handler/state change, or visible-string rewrite was performed in this continuation. The two A commits preserve the inherited work described in `ui_update.md`, including its existing markup adjustments.

### Changes and local commits

| Task | Local commit | Build |
| --- | --- | --- |
| A1 — theme | `3a5eb59` | Pass |
| A2 — inherited mechanical sweep | `35aaab3` | Pass |
| B — overview metrics | `1f36fc5` | Pass |
| C — topbars | `b73263d` | Pass |
| D — fonts | `2924801` | Pass |
| E — student guidance | `dc0d9c7` | Pass |
| F — admin | `6f27a80` | Pass |
| F — teacher | `e8a3785` | Pass |
| F — student | `19fa5d8` | Pass |
| F — super-admin | `6e97520` | Pass |
| G — grids/attendance | `ca31dcd` | Pass |
| H — dark surfaces | `7cc744c` | Pass |
| I — mobile review and final surface fixes | `c0a0e69` | Pass |
| J — results record | This documentation commit | Pass (final frontend build) |

Exact files per task:

<details>
<summary>A1 — theme (6 files)</summary>

- `frontend/index.html`
- `frontend/src/main.tsx`
- `frontend/src/theme/auth.css`
- `frontend/src/theme/components.css`
- `frontend/src/theme/tokens.css`
- `frontend/tailwind.config.js`

</details>

<details>
<summary>A2 — inherited mechanical sweep (67 files)</summary>

- `frontend/src/App.tsx`
- `frontend/src/components/StudentProfileHoverCard.tsx`
- `frontend/src/components/TeacherProfileHoverCard.tsx`
- `frontend/src/components/ThreeDBackground.tsx`
- `frontend/src/components/Toast.tsx`
- `frontend/src/components/preview/DestructiveConfirmModal.tsx`
- `frontend/src/components/student/StudentLayout.tsx`
- `frontend/src/components/student/StudentSearchBar.tsx`
- `frontend/src/components/student/student-portal.css`
- `frontend/src/pages/admin/AcademicYears.tsx`
- `frontend/src/pages/admin/Analytics.tsx`
- `frontend/src/pages/admin/AttendanceReports.tsx`
- `frontend/src/pages/admin/Communication.tsx`
- `frontend/src/pages/admin/Designations.tsx`
- `frontend/src/pages/admin/LeaveApprove.tsx`
- `frontend/src/pages/admin/LeavePolicy.tsx`
- `frontend/src/pages/admin/PeopleManagement.tsx`
- `frontend/src/pages/admin/Permissions.tsx`
- `frontend/src/pages/admin/PhotoApprove.tsx`
- `frontend/src/pages/admin/SmtpLogs.tsx`
- `frontend/src/pages/admin/StudentPromotion.tsx`
- `frontend/src/pages/admin/TeacherLeaveApprove.tsx`
- `frontend/src/pages/admin/Timetable.tsx`
- `frontend/src/pages/landing/LandingCapabilities.tsx`
- `frontend/src/pages/landing/LandingDemo.tsx`
- `frontend/src/pages/landing/LandingFlow.tsx`
- `frontend/src/pages/landing/LandingFooter.tsx`
- `frontend/src/pages/landing/LandingHero.tsx`
- `frontend/src/pages/landing/LandingNav.tsx`
- `frontend/src/pages/landing/LandingRoles.tsx`
- `frontend/src/pages/landing/LandingTrust.tsx`
- `frontend/src/pages/landing/LandingWhy.tsx`
- `frontend/src/pages/landing/components/ExplodedLayers3D.tsx`
- `frontend/src/pages/landing/components/FeaturePreviewScreens.tsx`
- `frontend/src/pages/landing/components/ProductDashboard3D.tsx`
- `frontend/src/pages/landing/components/RolePortalScreens.tsx`
- `frontend/src/pages/landing/landing.css`
- `frontend/src/pages/student/StudentAnnouncements.tsx`
- `frontend/src/pages/student/StudentAssignments.tsx`
- `frontend/src/pages/student/StudentAttendance.tsx`
- `frontend/src/pages/student/StudentDashboard.tsx`
- `frontend/src/pages/student/StudentExams.tsx`
- `frontend/src/pages/student/StudentLeaveRequest.tsx`
- `frontend/src/pages/student/StudentProfile.tsx`
- `frontend/src/pages/student/StudentTimetable.tsx`
- `frontend/src/pages/teacher/ClassMentorWorkspace.tsx`
- `frontend/src/pages/teacher/TeacherAnnouncements.tsx`
- `frontend/src/pages/teacher/TeacherAssignments.tsx`
- `frontend/src/pages/teacher/TeacherLeaveRequest.tsx`
- `frontend/src/pages/teacher/TeacherProfile.tsx`
- `frontend/src/styles.css`
- `frontend/src/super-admin/AuditLogsViewer.tsx`
- `frontend/src/super-admin/BackupsManagement.tsx`
- `frontend/src/super-admin/InvoicesManagement.tsx`
- `frontend/src/super-admin/MonitoringHealth.tsx`
- `frontend/src/super-admin/PaymentsLedger.tsx`
- `frontend/src/super-admin/PeopleDirectory.tsx`
- `frontend/src/super-admin/PlatformAnalytics.tsx`
- `frontend/src/super-admin/PlatformSettings.tsx`
- `frontend/src/super-admin/ReportsManagement.tsx`
- `frontend/src/super-admin/RolesPermissions.tsx`
- `frontend/src/super-admin/SchoolsManagement.tsx`
- `frontend/src/super-admin/SecurityCenter.tsx`
- `frontend/src/super-admin/SubscriptionsManagement.tsx`
- `frontend/src/super-admin/SuperAdminLayout.tsx`
- `frontend/src/super-admin/SuperAdminOverview.tsx`
- `frontend/src/super-admin/super-admin.css`

</details>

<details>
<summary>B — overview metrics (2 files)</summary>

- `frontend/src/super-admin/SuperAdminOverview.tsx`
- `frontend/src/super-admin/super-admin.css`

</details>

<details>
<summary>C — topbars (1 files)</summary>

- `frontend/src/theme/components.css`

</details>

<details>
<summary>D — fonts (2 files)</summary>

- `frontend/index.html`
- `frontend/src/styles.css`

</details>

<details>
<summary>E — student guidance (1 files)</summary>

- `frontend/src/theme/components.css`

</details>

<details>
<summary>F — admin (14 files)</summary>

- `frontend/src/pages/admin/AcademicYears.tsx`
- `frontend/src/pages/admin/Analytics.tsx`
- `frontend/src/pages/admin/AttendanceReports.tsx`
- `frontend/src/pages/admin/Communication.tsx`
- `frontend/src/pages/admin/Designations.tsx`
- `frontend/src/pages/admin/LeaveApprove.tsx`
- `frontend/src/pages/admin/LeavePolicy.tsx`
- `frontend/src/pages/admin/PeopleManagement.tsx`
- `frontend/src/pages/admin/Permissions.tsx`
- `frontend/src/pages/admin/PhotoApprove.tsx`
- `frontend/src/pages/admin/SmtpLogs.tsx`
- `frontend/src/pages/admin/StudentPromotion.tsx`
- `frontend/src/pages/admin/TeacherLeaveApprove.tsx`
- `frontend/src/pages/admin/Timetable.tsx`

</details>

<details>
<summary>F — teacher (5 files)</summary>

- `frontend/src/pages/teacher/ClassMentorWorkspace.tsx`
- `frontend/src/pages/teacher/TeacherAnnouncements.tsx`
- `frontend/src/pages/teacher/TeacherAssignments.tsx`
- `frontend/src/pages/teacher/TeacherLeaveRequest.tsx`
- `frontend/src/pages/teacher/TeacherProfile.tsx`

</details>

<details>
<summary>F — student (5 files)</summary>

- `frontend/src/pages/student/StudentAnnouncements.tsx`
- `frontend/src/pages/student/StudentAssignments.tsx`
- `frontend/src/pages/student/StudentDashboard.tsx`
- `frontend/src/pages/student/StudentProfile.tsx`
- `frontend/src/pages/student/StudentTimetable.tsx`

</details>

<details>
<summary>F — super-admin (15 files)</summary>

- `frontend/src/super-admin/AuditLogsViewer.tsx`
- `frontend/src/super-admin/BackupsManagement.tsx`
- `frontend/src/super-admin/InvoicesManagement.tsx`
- `frontend/src/super-admin/MonitoringHealth.tsx`
- `frontend/src/super-admin/PaymentsLedger.tsx`
- `frontend/src/super-admin/PeopleDirectory.tsx`
- `frontend/src/super-admin/PlatformAnalytics.tsx`
- `frontend/src/super-admin/PlatformSettings.tsx`
- `frontend/src/super-admin/ReportsManagement.tsx`
- `frontend/src/super-admin/RolesPermissions.tsx`
- `frontend/src/super-admin/SchoolsManagement.tsx`
- `frontend/src/super-admin/SecurityCenter.tsx`
- `frontend/src/super-admin/SubscriptionsManagement.tsx`
- `frontend/src/super-admin/SuperAdminLayout.tsx`
- `frontend/src/super-admin/SuperAdminOverview.tsx`

</details>

<details>
<summary>G — grids/attendance (5 files)</summary>

- `frontend/src/App.tsx`
- `frontend/src/pages/admin/AcademicYears.tsx`
- `frontend/src/pages/admin/Timetable.tsx`
- `frontend/src/pages/student/StudentTimetable.tsx`
- `frontend/src/theme/components.css`

</details>

<details>
<summary>H — dark surfaces (7 files)</summary>

- `artifacts/ui-reskin/parent-dark-desktop.png`
- `artifacts/ui-reskin/school_admin-dark-desktop.png`
- `artifacts/ui-reskin/student-dark-desktop.png`
- `artifacts/ui-reskin/super_admin-dark-desktop.png`
- `artifacts/ui-reskin/teacher-dark-desktop.png`
- `artifacts/ui-reskin/visual-results.json`
- `frontend/src/theme/components.css`

</details>

<details>
<summary>I — mobile review and final surface fixes (10 files)</summary>

- `artifacts/ui-reskin/parent-dark-desktop.png`
- `artifacts/ui-reskin/parent-dark-mobile.png`
- `artifacts/ui-reskin/school_admin-dark-desktop.png`
- `artifacts/ui-reskin/school_admin-dark-mobile.png`
- `artifacts/ui-reskin/student-dark-mobile.png`
- `artifacts/ui-reskin/super_admin-dark-desktop.png`
- `artifacts/ui-reskin/super_admin-dark-mobile.png`
- `artifacts/ui-reskin/teacher-dark-desktop.png`
- `artifacts/ui-reskin/teacher-dark-mobile.png`
- `frontend/src/theme/components.css`

</details>

J changes `UI_RESKIN_PLAN.md` and records `artifacts/ui-reskin/verification-summary.json`.

### Verification

| Check | Before | After |
| --- | --- | --- |
| Frontend `tsc -b && vite build` | Pass | Pass after each task/module and final fixes |
| Full Playwright suite (18 cases) | 8 passed / 10 failed | 8 passed / 10 failed; zero new failures |
| Failure identity | 10 navigation-layout cases | Same 10 cases; unchanged pathname/HashRouter mismatch |
| Protected TSX structure | Snapshot after inherited sweep (`35aaab3`) | Unchanged after abstracting className/literal inline-style values; conditions retained |
| Test/backend files | Unchanged | Unchanged |
| Dark screenshots | Prior handover only | Five roles, 1440 × 1000, settled after welcome animation |
| Mobile screenshots | Prior handover only | Five roles, 360 × 800 |
| Page-level mobile overflow | Prior handover only | 17/17 checked routes: scrollWidth = clientWidth = 360 |
| Browser page errors with mocked API | Not measured in this continuation baseline | Zero on all five role contexts |
| Dark canvas/header | Mixed legacy colours | Body/main `rgb(18,18,18)`; topbar `rgb(28,28,28)` across all five roles |
| Topbar dimensions | Mixed/inset | All five: height 64px, radius 0; mobile layout corrected |
| Dev server | Inherited server on 5173 | Verification server stopped after checks |

Commands used `npm.cmd` / `npx.cmd` because PowerShell blocks npm.ps1. An intermediate admin colour replacement failed typechecking (TS2367); conditional tests were restored before that module was committed. Final builds pass. Vite retains its existing large-chunk warning; bundle splitting is outside visual scope.

All `/api/**` requests in the visual checks returned `[]`; fake users/tokens were local browser fixtures. Screenshots exercise empty/fallback states, not real database data, delivery/payment behavior, populated-grid rendering, or every status variation. No real user account was used.

Screenshots and measurements: [artifacts/ui-reskin](artifacts/ui-reskin/), [visual-results.json](artifacts/ui-reskin/visual-results.json), [verification-summary.json](artifacts/ui-reskin/verification-summary.json).

### Needs owner decision / deferred changes

- Decorative emoji remain in visible strings; no removal or wording change was made.
- Landing pages retain the inherited mechanical palette sweep. Further marketing/3D redesign awaits a scope decision.
- Demo credentials in README and the existing demo credential flow were not changed; credential/security remediation is outside this visual-only pass.
- Attendance currently has Present, Left Early and Absent actions plus existing late-arrival flow. Creating literal P/A/L/H actions or renaming these controls would need text/behavior changes, so no new action was added.
- Grids without an existing today-state hook cannot gain a truthful current-date highlight through CSS alone. Existing selected-day styles and existing today hooks were preserved; adding date logic is deferred.
- Status palettes returned by helper functions/configuration objects, SVG paint props, and remaining colour expressions outside literal inline style values were left alone to respect the TSX edit boundary. Full semantic remapping of those helpers needs separately approved scope.
- DM Sans/Inter/Caveat/Kalam remain loaded because they still have actual source references. Orbitron, Share Tech Mono and the unused DM Serif font request were removed; Assistant remains the theme font.
- The 10 navigation tests still use pathname URLs with HashRouter; no test was modified. Correcting that mismatch needs a separate functional/testing task.
- Before any future push, reconcile the branch with current main as described in the handover; no merge/push/deployment was attempted.

### Skipped modules

- Exams & Results: no active `/student/exams` route was added or reskinned. A legacy `StudentExams.tsx` file and related references exist; the handover’s statement that no exam code exists was too broad.
- Fees collection for schools: no module in this scope (platform billing/invoices already exist and were restyled).
- Library and Transport: no modules in this checkout to restyle.


## Login refinement — 2026-11-08

- Owner requested a natural, professional login rather than bright/generated-looking styling.
- Login-only paper/charcoal tokens replace the empty navy panel and pink decorative accents. A native Georgia tagline pairs with the existing Assistant interface font; there are no new images, gradients, glows, shadows, dependencies or font downloads.
- The existing four roles are full-width rows with neutral line icons. Mobile keeps the same hierarchy and visible descriptions. Credential controls are 48px tall; role targets are at least 76px tall.
- Only `frontend/src/theme/auth.css` and `frontend/src/theme/tokens.css` change application styling. API calls, handlers, fields, IDs, guards, routes and visible source strings are unchanged. Authenticated dashboard tokens retain their original palette.
- Frontend build passes. Playwright: **8 passed / the same 10 existing navigation-layout failures**, zero new failures. Four roles × light/dark × desktop/mobile = **16 credential-flow checks**; password visibility, changing roles and reset-dialog opening pass. No horizontal overflow or page errors in those mocked checks; no real sign-in/reset request was sent.
- Preview/evidence: `artifacts/login-refinement/` (role selection and credential screenshots at 1440px and 360px in both themes, plus verification/test JSON).
