# Universal Preview & Edit Before Save System — Test Matrix & Verification Cases

This document details the complete functional, UI/UX, security, and regression test suites for the Universal Preview & Edit Before Save System across **AttendoSchool**.

---

## 1. Functional Test Suite

| Test ID | Module | Scenario / Workflow | Steps to Execute | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-FUNC-01** | Student Management | Create Student → Preview → Back to Edit → Modify → Preview → Save | 1. Open "Add Student" modal.<br>2. Fill in Name, Roll Number, Session, Class, Section.<br>3. Click "Preview & Save".<br>4. Inspect Preview Modal.<br>5. Click "Back to Edit".<br>6. Modify Roll Number.<br>7. Click "Preview & Save" again.<br>8. Click "Confirm & Enroll". | 1. Preview renders all sections accurately.<br>2. Clicking "Back to Edit" preserves all inputs without clearing.<br>3. Updated Roll Number shows in second preview.<br>4. Student is successfully saved to database. | **PASSED** |
| **TC-FUNC-02** | Student Management | Edit Student → Visual Change Detection (Diff) | 1. Select student and click "Edit Student".<br>2. Change Section from 'A' to 'B' and Phone.<br>3. Click "Preview & Save Changes". | 1. Preview highlights "Changes Detected (2 fields modified)".<br>2. Section diff displays `A ➔ B`.<br>3. Confirm updates student in Firestore / Postgres. | **PASSED** |
| **TC-FUNC-03** | Student Management | Destructive Single Student Delete | 1. Click Delete button on a student row.<br>2. Inspect `DestructiveConfirmModal`.<br>3. Click "Cancel".<br>4. Click Delete again and click "Confirm Delete". | 1. Modal displays student name, roll number, and class.<br>2. "Cancel" aborts deletion with zero database impact.<br>3. "Confirm" disables button, shows spinner, and purges student. | **PASSED** |
| **TC-FUNC-04** | Student Management | Destructive Bulk Student Delete | 1. Select 5 student checkboxes.<br>2. Click "Delete Selected (5)".<br>3. Review bulk confirmation modal.<br>4. Confirm deletion. | 1. Modal shows count (5 students) and irreversible warning.<br>2. All 5 students removed from roster. | **PASSED** |
| **TC-FUNC-05** | Teacher Management | Create Teacher → Preview Profile & Credentials | 1. Open "Add Teacher" modal.<br>2. Fill in Employee ID, Name, Email, Mobile.<br>3. Click "Preview & Save".<br>4. Confirm and register. | 1. Previews Faculty Profile and System Credentials.<br>2. Creates faculty record upon confirmation. | **PASSED** |
| **TC-FUNC-06** | Teacher Management | Edit Teacher → Diff & Update | 1. Open Edit Teacher for existing faculty.<br>2. Change email and mobile.<br>3. Click "Preview & Save".<br>4. Confirm. | 1. Shows previous email vs new email.<br>2. Updates teacher record cleanly. | **PASSED** |
| **TC-FUNC-07** | Teacher Management | Teaching Allocations Preview & Save | 1. Open "Allocations" modal for a teacher.<br>2. Assign Subject, Class, Section, Session.<br>3. Click "Save Allocations".<br>4. Inspect preview table.<br>5. Confirm. | 1. Displays allocation table with Subject, Class, Section, and Type.<br>2. Persists allocations to database. | **PASSED** |
| **TC-FUNC-08** | Classes & Sections | Add Class & Add Section Preview | 1. Click "Add Class" or "Add Section".<br>2. Choose class number or section name.<br>3. Click "Add Class" / "Add Section".<br>4. Inspect modal and confirm. | 1. Previews Grade Level and Section metadata.<br>2. Creates class/section without bypassing confirmation. | **PASSED** |
| **TC-FUNC-09** | Subjects | Add Subject Preview & Confirmation | 1. Fill in Subject Name.<br>2. Click "Add Subject".<br>3. Review subject preview modal.<br>4. Confirm. | 1. Previews Subject Title, Department Scope, and Tracking.<br>2. Inserts subject into catalog. | **PASSED** |
| **TC-FUNC-10** | Attendance Station | Daily Attendance Mark & Summary KPI Preview | 1. Select Class and Section.<br>2. Mark students (Present, Absent, Late).<br>3. Click "Preview & Commit Attendance".<br>4. Inspect KPI cards.<br>5. Confirm. | 1. Previews 5 KPI cards: Total, Present, Absent, Late, Rate %.<br>2. Previews student roster status badges.<br>3. Commits bulk marks to attendance log. | **PASSED** |
| **TC-FUNC-11** | Attendance Station | Whole-Class Re-attendance Workflow | 1. Click "Mark All Present" or toggle multiple records.<br>2. Click "Preview & Commit Attendance".<br>3. Click "Back to Edit Sheet".<br>4. Toggle 2 students to Absent.<br>5. Preview again and commit. | 1. Back to Edit retains all modified marks on sheet.<br>2. Updated counts reflect accurately in second preview.<br>3. Commits finalized marks. | **PASSED** |
| **TC-FUNC-12** | Academic Sessions | Session Create with Date Bounds Validation | 1. Open "Create Academic Session".<br>2. Enter session name, code, start date, and end date.<br>3. Click "Preview & Create Session".<br>4. Confirm. | 1. Validates that start date precedes end date.<br>2. Previews session metadata and date range.<br>3. Persists session record. | **PASSED** |
| **TC-FUNC-13** | Student Promotion | Roster Migration & Outcome Preview | 1. Select Source Session/Class and Target Session/Class.<br>2. Toggle individual students (Promote / Retain).<br>3. Click "Preview & Confirm Promotion".<br>4. Review candidate table.<br>5. Confirm. | 1. Previews table with Student Name, Current Class, and Action.<br>2. Back to Edit retains individual student statuses.<br>3. Processes promotions in batch. | **PASSED** |
| **TC-FUNC-14** | School Profile | Profile Details Diff & Save | 1. Navigate to School Profile.<br>2. Update Principal Phone and Address.<br>3. Click "Preview & Save Profile".<br>4. Inspect diff view and confirm. | 1. Displays Before vs After address and contact info.<br>2. Updates institution profile in database. | **PASSED** |
| **TC-FUNC-15** | Communication | Announcement Broadcast Scope Preview | 1. Enter Title, Message, Audience (CLASS), Priority (HIGH).<br>2. Click "Preview & Save Announcement".<br>3. Inspect preview modal.<br>4. Confirm. | 1. Previews audience scope badge and priority warning.<br>2. Saves announcement draft and enables publication. | **PASSED** |
| **TC-FUNC-16** | Global | Stage 1 Validation Failure Block | 1. Open "Add Student" modal.<br>2. Leave First Name and Roll Number blank.<br>3. Click "Preview & Save". | 1. Preview modal does NOT open.<br>2. Alert / error notice highlights missing fields.<br>3. User remains in form. | **PASSED** |
| **TC-FUNC-17** | Global | Stage 2 Pre-flight Validation Failure | 1. Manipulate state so required field is empty before API call.<br>2. Click "Confirm & Save". | 1. Pre-flight check detects invalid payload.<br>2. Inline error banner displayed; API request aborted. | **PASSED** |
| **TC-FUNC-18** | Global | Double Submission Lockout | 1. Click "Confirm & Save" on preview modal.<br>2. Attempt rapid repeated clicks on the button. | 1. Button immediately transitions to disabled + spinner.<br>2. Second click ignored; exactly one API call dispatched. | **PASSED** |
| **TC-FUNC-19** | Global | Backend Error Recovery & State Preservation | 1. Trigger student enrollment with duplicate Roll Number (causes 409 Conflict).<br>2. Observe error state in preview modal. | 1. Modal displays red error banner: "Roll number already registered".<br>2. Form data is preserved.<br>3. Clicking "Back to Edit" allows correcting roll number. | **PASSED** |
| **TC-FUNC-20** | Bulk Import | Excel Import Error Highlighting | 1. Upload Excel with missing First Name in row 3.<br>2. View Preview & Confirm step. | 1. Row 3 highlighted in red with warning icon.<br>2. Error tag specifies "First Name is required".<br>3. User can click "Re-upload" or cancel. | **PASSED** |
| **TC-FUNC-21** | Bulk Import | Valid Import Confirmation | 1. Upload valid Excel sheet with 25 students.<br>2. Click "Confirm & Import 25 Valid Students". | 1. Imports valid records in batch.<br>2. Closes modal and refreshes student table. | **PASSED** |

---

## 2. UI, UX & Responsiveness Test Suite

| Test ID | Aspect | Scenario | Expected Behavior | Status |
| :--- | :--- | :--- | :--- | :--- |
| **TC-UI-01** | Desktop (>1200px) | Layout & Grid Display | Modal width scales appropriately (640px to 800px). Sections display clean 2-column key-value pairs. Roster tables occupy full modal width with sticky headers. | **PASSED** |
| **TC-UI-02** | Tablet (768px - 1024px) | Responsive Stacking | 2-column sections collapse gracefully to 1 column where appropriate. Summary KPI cards wrap without overflow. | **PASSED** |
| **TC-UI-03** | Mobile (<768px) | Touch & Scrollability | Modal renders full screen or bottom sheet with padded safe areas. Tabular previews enable horizontal scroll with visual scrollbar. Action buttons stack vertically with large touch targets. | **PASSED** |
| **TC-UI-04** | Keyboard Accessibility | Focus & Escape Handling | Pressing `Escape` triggers `onClose` / `Back to Edit`. Modal traps focus inside dialog. `Tab` navigates between `[Back to Edit]` and `[Confirm & Save]`. | **PASSED** |
| **TC-UI-05** | Loading States | Visual Feedback | When `loading=true`, spinner rotates smoothly and text reads "Saving...", "Creating...", or "Deleting...". Buttons have `opacity: 0.6` and `cursor: not-allowed`. | **PASSED** |

---

## 3. Security & RBAC Test Suite

| Test ID | Security Area | Scenario | Expected Behavior | Status |
| :--- | :--- | :--- | :--- | :--- |
| **TC-SEC-01** | Authentication | Expired Token or Unauthenticated API Request | If auth token expires during preview inspection, clicking "Confirm & Save" triggers 401 response. System prompts user to re-authenticate without crashing. | **PASSED** |
| **TC-SEC-02** | Multi-Tenant Isolation | Cross-School Data Mutation Prevention | Backend verifies `req.user.schoolId` against targeted record. Even if frontend preview attempts to post a foreign `school_id`, backend overrides or rejects the request. | **PASSED** |
| **TC-SEC-03** | RBAC Enforcement | Role Privilege Verification | A user with role `TEACHER` cannot open or confirm Super Admin or School Configuration preview modals. Backend routes enforce role guards (`checkRole(['SCHOOL_ADMIN', 'SUPER_ADMIN'])`). | **PASSED** |
| **TC-SEC-04** | Payload Tampering | Client-Side Manipulated Request | If preview payload is intercepted and tampered with (e.g. attempting to assign admin privileges), server schema validation halts persistence. | **PASSED** |
