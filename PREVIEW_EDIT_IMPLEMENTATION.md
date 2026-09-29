# Universal Preview & Edit Before Save System — Implementation Guide

## 1. Overview of Core Components

All preview components are housed in [`frontend/src/components/preview/`](file:///d:/Project_Abir/attendoschool/frontend/src/components/preview) and exported via [`index.ts`](file:///d:/Project_Abir/attendoschool/frontend/src/components/preview/index.ts).

### 1.1 `UniversalPreviewModal.tsx`
Renders a preview modal dialog designed for standard create, update, and action operations.
- **Header**: Displays entity icon, title, subtitle badge, and operation tag (`CREATE`, `UPDATE`, `SUBMIT`, `ACTION`).
- **Summary Cards**: Optional KPI cards rendered at the top (e.g. Total Marks, Present, Absent, Rate %).
- **Change Detection View**: Renders visual diffs if `changes` array is provided (showing field, old value, and new value).
- **Structured Sections**: Renders 2-column card grids categorized by section.
- **Embedded Table**: Displays roster rows or tabular previews (e.g., student attendance marks or teaching allocations).
- **Actions Bar**: Includes `[Back to Edit]` and `[Confirm & Save]` buttons with active loading spinner and inline error banner.

### 1.2 `DestructiveConfirmModal.tsx`
Dedicated guard modal for deletion, deactivation, and archiving operations.
- Renders danger styling, warning callouts, and item details.
- Disables buttons and shows active spinner during deletion API requests.

### 1.3 `usePreviewConfirm.ts`
Provides reusable state helpers and the `calculateChanges` diff utility.

---

## 2. Module Integrations

### 2.1 Student Management ([`frontend/src/App.tsx`](file:///d:/Project_Abir/attendoschool/frontend/src/App.tsx))
- **Create Student**:
  - `handleInitiateStudentSave()` runs Stage 1 validation (checking name, session, class, roll number, and phone format).
  - Opens `UniversalPreviewModal` structured into:
    1. *Student Identity*: First Name, Last Name, Full Name, Admission Number, Roll Number.
    2. *Class & Academic Placement*: Academic Session, Grade Class, Section.
    3. *Guardian & Contact Information*: Parent Name, Parent Mobile Phone.
    4. *Student Portal Access*: Student Email, Default Password.
  - Clicking `[Back to Edit]` closes the modal while retaining all fields in the `f` state object.
  - `executeConfirmStudentSave()` runs Stage 2 validation and posts to `/students`.
- **Edit Student**:
  - Runs `calculateChanges(editingStudent, f, studentFieldLabels)`.
  - Displays Before vs After comparison in `PreviewChanges`.
  - Submits via PUT `/students/:id`.
- **Delete Student (Single & Bulk)**:
  - Invokes `DestructiveConfirmModal` showing student name, roll number, class, and section, replacing unstyled browser alerts.

### 2.2 Teacher Management ([`frontend/src/App.tsx`](file:///d:/Project_Abir/attendoschool/frontend/src/App.tsx))
- **Create Teacher**:
  - Validates full name, employee ID, email, and mobile number.
  - Previews *Faculty Profile* and *System Credentials*.
  - Submits via POST `/teachers`.
- **Edit Teacher**:
  - Calculates diff between initial teacher object and updated form fields.
  - Submits via PUT `/teachers/:id`.
- **Teaching Allocations**:
  - Administrators map teachers to subjects, classes, sections, and sessions.
  - Clicking `Save Allocations` triggers Stage 1 validation (checking at least one valid row is configured).
  - Previews complete allocation roster table in `UniversalPreviewModal`.
  - Persists allocations via PUT `/teachers/:id/allocations`.
- **Delete Faculty**:
  - Guarded by `DestructiveConfirmModal` showing employee ID and name.

### 2.3 Class & Section Management ([`frontend/src/App.tsx`](file:///d:/Project_Abir/attendoschool/frontend/src/App.tsx))
- **Add Class**:
  - Validates class number selection.
  - Previews Grade Level and default section provisioning.
  - Submits via POST `/classes`.
- **Add Section**:
  - Validates class selection and section letter.
  - Previews Section Name, Parent Class, and Capacity.
  - Submits via POST `/classes/:id/sections`.

### 2.4 Subject Management ([`frontend/src/App.tsx`](file:///d:/Project_Abir/attendoschool/frontend/src/App.tsx))
- **Add Subject**:
  - Validates subject name.
  - Previews Subject Title, Department Scope, and Academic Tracking.
  - Submits via POST `/subjects`.

### 2.5 Attendance Station ([`frontend/src/App.tsx`](file:///d:/Project_Abir/attendoschool/frontend/src/App.tsx))
- **Daily Class Attendance & Whole-Class Re-attendance**:
  - Stage 1 validation ensures valid class, section, date, and student roster entries.
  - Generates 5 summary KPI cards:
    - Total Enrolled Students
    - Present Count (Green)
    - Absent Count (Red)
    - Late / Half-Day Count (Amber)
    - Attendance Rate %
  - Previews student roster table with designated status badges.
  - `[Back to Edit Sheet]` preserves all selected marks.
  - `[Confirm & Commit Attendance]` pushes bulk marks to `/attendance/bulk`.

### 2.6 School Profile ([`frontend/src/App.tsx`](file:///d:/Project_Abir/attendoschool/frontend/src/App.tsx))
- **Update Profile**:
  - Validates school name, email, phone, and address.
  - Computes changes against current profile.
  - Previews changes in `UniversalPreviewModal`.
  - Submits via PUT `/schools/profile`.

### 2.7 Academic Sessions ([`frontend/src/pages/admin/AcademicYears.tsx`](file:///d:/Project_Abir/attendoschool/frontend/src/pages/admin/AcademicYears.tsx))
- **Create Session**:
  - Validates session label, code, and date bounds (`startDate < endDate`).
  - Previews Session Metadata and Date Range in `UniversalPreviewModal`.
  - Submits via POST `/academic-years`.
- **Session Activation & Archival**:
  - Guarded by `DestructiveConfirmModal` with session details.

### 2.8 Student Promotion ([`frontend/src/pages/admin/StudentPromotion.tsx`](file:///d:/Project_Abir/attendoschool/frontend/src/pages/admin/StudentPromotion.tsx))
- **Promotion & Roster Migration**:
  - Validates source session/class and target destination.
  - Previews candidate table with student names, current classes, and selected promotion outcomes (`Promote`, `Retain`, `Transfer`).
  - `[Back to Edit Roster]` preserves individual student toggles.
  - `[Confirm & Process Promotions]` persists promotion roster via POST `/academic-years/promote`.

### 2.9 Communication & Announcements ([`frontend/src/pages/admin/Communication.tsx`](file:///d:/Project_Abir/attendoschool/frontend/src/pages/admin/Communication.tsx))
- **Create Announcement**:
  - Validates title and message content.
  - Previews broadcast scope (Audience Target, Priority Level, Message Preview).
  - Submits via POST `/communication/announcements`.
- **Publish Announcement**:
  - Confirmation dialog verifies recipient scope before delivering notifications.

### 2.10 Bulk Import Rosters ([`frontend/src/App.tsx`](file:///d:/Project_Abir/attendoschool/frontend/src/App.tsx))
- Excel/CSV files for Students and Faculty follow a 3-step wizard:
  1. *Scope Configuration*: Select session, class, section.
  2. *File Ingestion & Schema Check*: Dropzone with client-side parse.
  3. *Preview & Confirmation*: Shows total records, error rows in red with exact column issue, and allows `[Re-upload]` before confirming.

### 2.11 Super Admin School Management ([`frontend/src/super-admin/SchoolsManagement.tsx`](file:///d:/Project_Abir/attendoschool/frontend/src/super-admin/SchoolsManagement.tsx))
- Multi-step onboarding wizard with Step 4 dedicated to an *Onboarding Summary* preview.
- Destructive modals for License Renewal, School Suspension, and Permanent Database Purge.

---

## 3. Zero Data Loss Verification

The preview modal uses layered modal rendering rather than navigation rerouting. 

```tsx
{/* Primary Form Modal (isOpen = isFormOpen) */}
{isFormOpen && (
  <Modal title="Enroll Student" close={() => setIsFormOpen(false)}>
    <form>
      <input value={f.firstName} onChange={e => setF({...f, firstName: e.target.value})} />
      ...
      <button type="button" onClick={handleInitiateStudentSave}>
        Preview & Save
      </button>
    </form>
  </Modal>
)}

{/* Universal Preview Modal (isOpen = studentPreview.isOpen) */}
<UniversalPreviewModal
  isOpen={studentPreview.isOpen}
  onClose={() => setStudentPreview(prev => ({ ...prev, isOpen: false }))}
  onEdit={() => setStudentPreview(prev => ({ ...prev, isOpen: false }))}
  onConfirm={executeConfirmStudentSave}
  sections={studentPreview.sections}
/>
```

When `onEdit` fires, `studentPreview.isOpen` becomes `false`. The primary form modal never unmounted; its React state `f` remains completely intact.
