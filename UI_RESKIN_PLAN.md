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
