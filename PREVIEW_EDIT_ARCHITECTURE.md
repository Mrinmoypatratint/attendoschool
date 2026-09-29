# Universal Preview & Edit Before Save System — Architecture

## 1. Executive Summary & Core Principle

In **AttendoSchool**, every workflow that creates, updates, deletes, imports, submits, or approves data is subject to a strict architectural rule:

> **No user-generated or user-modified state is ever directly committed to the backend without explicit visual inspection, validation, and user confirmation.**

The mandatory execution pipeline across the platform is:

```
[ Form / Input ] 
       ↓ 
[ Trigger: Save / Submit / Delete / Import ]
       ↓ 
[ Stage 1 Validation: Schema & Field Integrity ]
       ↓ (Halts with inline error focus if invalid)
[ Universal Preview / Confirmation Layer ]
       ↓ 
  ┌─────────────────────────────────────────────────────────┐
  │ Visual Inspection (Entities, KPI Cards, Diff, Tables)  │
  ├────────────────────────────┬────────────────────────────┤
  │       [Back to Edit]       │      [Confirm & Save]      │
  │  (Zero-data-loss return    │   (Execute Stage 2 checks  │
  │   to underlying form state)│    and API persistence)    │
  └────────────────────────────┴────────────────────────────┘
                                     ↓
                     [ Stage 2 Pre-flight Validation ]
                                     ↓
                     [ Double-Submission Lockout ]
                                     ↓
                     [ Backend API / Database Ops ]
                                     ↓
                     [ Audit Log & Real-time Update ]
```

---

## 2. Component Hierarchy & Layering

The system is constructed with a decoupled, reusable component structure located in [`frontend/src/components/preview/`](file:///d:/Project_Abir/attendoschool/frontend/src/components/preview):

```
frontend/src/components/preview/
├── types.ts                    # Universal TypeScript definitions
├── PreviewField.tsx            # Formatter for individual attributes & badges
├── PreviewSection.tsx          # Card sections with 2-column grid layout
├── PreviewChanges.tsx          # Before-vs-After diff component for updates
├── UniversalPreviewModal.tsx   # Comprehensive preview modal with actions
├── DestructiveConfirmModal.tsx # Guard modal for deletions & deactivations
├── usePreviewConfirm.ts        # Reusable modal state hook & diff calculator
└── index.ts                    # Barrel export
```

### 2.1 Modal Layering & Zero-Data-Loss Mechanics

When an administrative user enters data into a creation or editing form (e.g., Student Enrollment, Faculty Registration, Allocation Assignment):

1. The underlying form state (`f`, `form`, `selected`, `allocRows`) lives in the host component's React state.
2. The user clicks **Preview & Save / Update**.
3. **Stage 1 Validation** executes synchronously. If any required or formatted field fails, execution stops immediately, and the host form highlights the relevant fields.
4. If validation passes, the `UniversalPreviewModal` opens.
5. The `UniversalPreviewModal` is rendered with a high z-index (`z-index: 1100`) directly above the form backdrop (`z-index: 1000` or below):
   - **Clicking `[Back to Edit]`**: The host simply sets `isOpen: false` on the preview state. The underlying form modal is never unmounted or reinitialized. All entered data, file selections, and custom inputs are preserved with 100% fidelity.
   - **User modifies form fields**: The user adjusts values in the underlying form and clicks **Preview & Save** again. A freshly evaluated preview payload is generated and displayed.
   - **Clicking `[Confirm & Save]`**: Triggers Stage 2 validation and dispatches the persistence request with double-submission lockout.

---

## 3. Two-Stage Validation Architecture

The system enforces validation at two distinct gates to guarantee complete data integrity and prevent race conditions:

```
┌────────────────────────────────────────────────────────┐
│                   Stage 1: Client Gate                 │
│                 (Before Preview Renders)               │
├────────────────────────────────────────────────────────┤
│ • Mandatory field completeness (Name, Code, Email, etc.)│
│ • Format verification (Email syntax, Phone length)     │
│ • Logical range validation (Start Date < End Date)     │
│ • Cross-field prerequisites (e.g. Session required)    │
└────────────────────────────────────────────────────────┘
                           │
                           ▼ (Passes)
┌────────────────────────────────────────────────────────┐
│              Universal Preview Modal Layer             │
│    (User inspects payload, diffs, summary badges)      │
└────────────────────────────────────────────────────────┘
                           │
                           ▼ (User clicks "Confirm & Save")
┌────────────────────────────────────────────────────────┐
│                 Stage 2: Pre-Flight Gate               │
│               (Immediate Pre-Commit Check)             │
├────────────────────────────────────────────────────────┤
│ • Re-verify staged payload against active state        │
│ • Confirm critical fields were not cleared             │
│ • Check authentication token expiration                │
│ • Lock button state and trigger loading spinner        │
└────────────────────────────────────────────────────────┘
                           │
                           ▼ (Dispatches API Call)
┌────────────────────────────────────────────────────────┐
│             Stage 3: Server-Side Validation            │
│         (Postgres / Firebase Database Integrity)       │
├────────────────────────────────────────────────────────┤
│ • RBAC Role & Permission verification                  │
│ • Tenant isolation (school_id scope enforcement)       │
│ • Unique constraint verification (Roll, Email, Code)   │
│ • Foreign key integrity (Class, Section, Subject)      │
└────────────────────────────────────────────────────────┘
```

---

## 4. Change Detection & Visual Diffs (Update Operations)

For any `UPDATE` operation, users must know exactly what is changing compared to the existing record in the database.

The framework provides the `calculateChanges` utility:

```typescript
export function calculateChanges<T extends Record<string, any>>(
  original: T | null | undefined,
  updated: T | null | undefined,
  fieldLabels: Record<string, string>,
  formatters?: Record<string, (val: any) => string>
): PreviewChangeData[]
```

When changes are detected:
- The `UniversalPreviewModal` renders an amber notice with total modifications count.
- The `PreviewChanges` sub-component lists each modified field showing:
  - **Previous Value** in a strike-through reddish pill (`background: #fef2f2`, `color: #dc2626`).
  - An arrow `➔`.
  - **New Value** in a bold emerald pill (`background: #f0fdf4`, `color: #16a34a`).
- If no fields were modified, the modal alerts the user that no net changes were made before sending empty network traffic.

---

## 5. Destructive Operations Guard (`DestructiveConfirmModal`)

Destructive operations (Single Delete, Bulk Deletions, Session Archiving, School Deletion) do NOT use standard create/edit dialogs. They utilize `DestructiveConfirmModal`:

- **Distinct Danger Header**: Uses red alert icons (`AlertTriangle`, `Trash2`) and bold red typography.
- **Entity Identity Preview**: Previews exact record attributes (e.g. Student Name, Roll Number, Class, Section, or Session Code) so administrators never delete the wrong entity.
- **Explicit Irreversibility Callout**: Clearly highlights database consequences (e.g., student roster purging, attendance record archiving).
- **Double-Click Lockout**: The "Yes, Delete" button disables itself immediately upon click, displaying an active spinner (`Deleting...`).

---

## 6. Bulk Import Workflow Architecture

For Excel (`.xlsx`, `.xls`) and CSV files (Student and Faculty rosters), the preview system handles tabular datasets:

1. **Upload & Parse**: The browser parses file buffers via `xlsx` into in-memory row objects.
2. **Row-by-Row Validation**: Each record is inspected against schema requirements (e.g., First Name present, Admission Number unique, Phone format).
3. **Interactive Preview Table**:
   - Total rows counter badge (`X students ready to import`).
   - Highlighted error rows (`outline: 1px solid #fecaca`, red alert badge).
   - Column-level error breakdown explaining why any row failed.
4. **Re-upload & Edit Options**: User can click `[Re-upload]` to adjust source spreadsheets or cancel without touching the database.
5. **Selective Persistence**: The confirmation button explicitly reports the valid count (e.g., `Confirm & Import 48 Valid Students`), preventing invalid rows from corrupting database tables.

---

## 7. Role-Based Access Control (RBAC) & Tenant Security

The Universal Preview layer is strictly a presentation and confirmation gateway. It does not replace or weaken backend security:

- **Frontend Visibility Controls**: The Preview actions are only reachable if the current authenticated user (`useAuth`) possesses the required role (`SUPER_ADMIN`, `SCHOOL_ADMIN`, `TEACHER`).
- **Server Enforcement**: All backend routes (`/students`, `/teachers`, `/timetable`, `/attendance`, `/classes`) independently enforce JWT authentication, school tenant scoping (`school_id = req.user.schoolId`), and role permissions before any SQL / Firestore mutation executes.
- **Direct API Bypass Prevention**: Attempting to bypass the preview via Postman or script triggers standard backend 401 Unauthorized / 403 Forbidden responses.

---

## 8. Double Submission & Failure Recovery

To prevent duplicate database inserts or race conditions:

1. **Button Debounce & Lock**: Upon clicking `[Confirm & Save]`, `loading` becomes `true`. Both `[Confirm]` and `[Back to Edit]` buttons are disabled.
2. **Failure Handling**:
   - If the backend returns an error (e.g., HTTP 409 Conflict - Roll Number already registered; HTTP 500 Network error), the modal remains open.
   - An inline error banner (`#fef2f2` background with `#dc2626` text) displays the exact backend error message.
   - The user is NOT booted from the screen. They can either:
     - Click `[Try Again]` once the issue is rectified.
     - Click `[Back to Edit]` to alter the conflicting field without re-entering the entire form.
