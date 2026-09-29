# TASK-001: AttendO School Enhancement Specification
## End-to-End Architecture, Workflow, Feature, Fix & Test Case Specification

---

### Document Control
- **Document Identifier**: `TASK-001-SPEC-v1.0`
- **Product Name**: AttendO School (`school-attendance-saas`)
- **Document Title**: Student, Teacher, Attendance, Communication & Notification Enhancement Specification
- **Target File**: `task1.md`
- **Specification Status**: Implementation-Ready Engineering Blueprint
- **Target Audience**: Solution Architects, Full-Stack Engineers, Database Administrators, QA/Test Automation Engineers, Security Engineers, Product Managers
- **Creation Date**: September 29, 2026
- **Baseline Codebase Version**: 0.11.0 (Production Release)

---

## 1. Executive Summary

This document defines the comprehensive architectural, functional, database, API, user interface, security, and quality assurance specification for **TASK-001** of the AttendO School platform.

AttendO School is a multi-tenant enterprise Educational Operations & Attendance SaaS platform supporting dual database persistence engines (**Google Cloud Firestore** and **PostgreSQL 16** with 33 migration sets). While core classroom roll-call, timetable routines, and billing engines are production-ready, this specification addresses critical functional gaps, broken workflows, missing modules, and architectural enhancements across five key institutional pillars:

1. **Student Management & Excel Import Lifecycle**: Transitioning from ad-hoc JSON arrays to standardized Excel (`.xlsx`/`.csv`) template downloads, strict header/row validation, automatic `full_name` generation from `first_name` and `last_name`, session-aware student enrollment, import staging/previews, individual and bulk student transactional onboarding emails, and delivery tracking.
2. **Teacher Management & Faculty Onboarding**: Introducing bulk faculty Excel onboarding, template validation, preview workflows, and SMTP-driven welcome credentials with delivery logs.
3. **Attendance Import & Enhanced Analytics**: Implementing offline attendance Excel sheet ingestion, validation, preview, and submission, coupled with multi-dimensional filtering (Session, Class, Section, Date Range) and dual CSV/Excel reporting exports.
4. **Centralized Mail & Communication Hub**: Establishing an institutional mail management center supporting individual and bulk composing, draft states, multi-sender identity selection, delivery status tracking, and failed email resend queues.
5. **Notice, Announcement & Bidirectional Notification Replies**: Decoupling notices from announcements, adding multi-part attachment handling, supporting faculty and student target audiences, and implementing a complete bidirectional notification reply system capturing user identity, class/section metadata, timestamps, and auditable database persistence.

---

## 2. Codebase Analysis & Baseline Findings

A rigorous audit of the existing AttendO School codebase was performed across all frontend, backend, database, configuration, and test files:

### 2.1 Frontend Inspection (`frontend/src/`)
- **People Management (`frontend/src/pages/admin/PeopleManagement.tsx`)**:
  - Implements search and listing for students and teachers across tabs.
  - *Gap*: Has no Excel upload button, no sample template download, no import preview modal, no bulk email trigger, and no student status filter.
- **Attendance Reports (`frontend/src/pages/admin/AttendanceReports.tsx`)**:
  - Contains summary cards and student attendance percentages.
  - Only provides Date `from` and `to` inputs.
  - *Gap*: Missing Class and Section dropdown filters; export is strictly hardcoded client-side CSV via `Blob` without Excel (`.xlsx`) generation.
- **Offline Attendance (`frontend/src/pages/admin/OfflineAttendance.tsx`)**:
  - Strictly interacts with the client-side IndexedDB/localStorage queue manager (`frontend/src/services/offlineAttendanceQueue.ts`).
  - *Gap*: Does not support Excel file upload, Excel attendance validation, or preview.
- **Communication (`frontend/src/pages/admin/Communication.tsx`)**:
  - Implements basic announcement creation with title, message, priority, and audience (`SCHOOL`, `CLASS`, `SECTION`, `PARENTS`).
  - *Gap*: No file attachment support, no audience selection for `TEACHER` or `STUDENT`, no notice vs. announcement distinction, and no reply viewing or submission interface.
- **Student Dashboard (`frontend/src/pages/student/StudentDashboard.tsx`)**:
  - Read-only widgets for attendance, timetable, assignments, announcements, and leave requests.
  - *Gap*: Cannot reply to announcements or notifications.

### 2.2 Backend Inspection (`backend/src/`)
- **Student Routes (`backend/src/routes/schoolData.ts` lines 439–684)**:
  - `POST /api/students`: Accepts raw `name` string; does not accept or compute `first_name` and `last_name`. Does not bind `academic_year_id` / `session_id`.
  - `POST /api/students/bulk-import`: Accepts `{ students: [...] }` JSON payload only; cannot ingest Excel files; performs no dry-run preview; skips email triggers.
- **Teacher Routes (`backend/src/routes/schoolData.ts` lines 869–950)**:
  - `POST /api/teachers`: Dispatches individual teacher onboarding with password setup link.
  - *Gap*: No bulk teacher import endpoint (`/api/teachers/bulk-import`) exists.
- **Attendance Reports (`backend/src/routes/attendanceReports.ts`)**:
  - `GET /api/attendance-reports/summary` and `/students`: Filter by `from` and `to`.
  - `GET /api/attendance-reports/export/csv`: Streams text/csv.
  - *Gap*: Does not accept `classId`, `sectionId`, or `sessionId` query parameters; no Excel route (`/export/excel`).
- **Communication Service (`backend/src/services/communicationService.ts`)**:
  - Enforces `if (!['SCHOOL','CLASS','SECTION','PARENTS'].includes(audience)) throw new Error('Invalid audience')`.
  - *Gap*: Rejects `TEACHER` or `STUDENT` audiences; table `announcements` has no `attachment_url` column; no table or route exists for notification replies.
- **Notification Service (`backend/src/services/notificationService.ts`)**:
  - Handles Nodemailer SMTP with branded logo CID embedding and sandbox fallback.
  - *Gap*: Lacks a generic bulk mailing queue API for arbitrary administrative broadcasts and has no admin-facing failed email retry endpoint.

### 2.3 Database Inspection (`database/migrations/`)
- **Migrations 001–033**:
  - Migration 015 (`015_academic_years.sql`): Created `academic_years` table and added `academic_year_id` to `students` and `classes`. *Defect*: `schoolData.ts` never populates `academic_year_id` upon student creation.
  - Migration 025 (`025_communication.sql`): Created `announcements`, `announcement_recipients`, `communication_preferences`, `communication_delivery_logs`. *Defect*: Lacks `attachments` array/JSONB, `notice_type`, and `notification_replies`.
  - Migration 032 (`032_email_notifications_hardening.sql`): Added `subject`, `html_body`, `recipient_type`, `idempotency_key` to `notification_logs`.

---

## 3. Current Architecture

```mermaid
graph TD
    subgraph CurrentClient["Current Frontend Client"]
        PM[PeopleManagement.tsx<br/>Manual Form & Search Table]
        AR[AttendanceReports.tsx<br/>Date Filter Only & CSV Blob]
        OA[OfflineAttendance.tsx<br/>IndexedDB Local Queue Sync]
        COM[Communication.tsx<br/>Announcements: Text Only]
    end

    subgraph CurrentAPI["Current Backend Layer"]
        R_STU["/api/students<br/>Raw Name, No Session FK"]
        R_BLK["/api/students/bulk-import<br/>JSON Array Only, No Preview"]
        R_TCH["/api/teachers<br/>Individual Creation Only"]
        R_REP["/api/attendance-reports<br/>Date Only Queries"]
        R_COM["/api/communication<br/>Strict 4 Audiences, No Attachments"]
    end

    subgraph CurrentDB["Current Database Schema"]
        T_STU[(students<br/>academic_year_id NULL)]
        T_ANN[(announcements<br/>No attachments column)]
        T_REC[(announcement_recipients<br/>parent_user_id FK only)]
        T_LOG[(notification_logs<br/>No Admin Resend Endpoint)]
    end

    PM -->|JSON POST| R_STU
    PM -->|JSON POST| R_BLK
    AR -->|GET| R_REP
    OA -->|IndexedDB sync| CurrentAPI
    COM -->|JSON POST| R_COM

    R_STU --> T_STU
    R_BLK --> T_STU
    R_COM --> T_ANN
    R_COM --> T_REC
```

---

## 4. Target Architecture

```mermaid
graph TB
    subgraph ClientLayer["Enhanced Frontend UI (React 19 / Vite)"]
        UI_STU["Student Management<br/>• Excel Template Downloader<br/>• First/Last/Full Name Parser<br/>• Session Dropdown Binding<br/>• Drag-and-Drop XLSX Uploader<br/>• Dry-Run Validation & Preview Grid<br/>• Bulk Email Dispatcher"]
        UI_TCH["Teacher Management<br/>• Faculty Excel Import<br/>• Header Validator<br/>• Bulk Welcome Emailer"]
        UI_ATT["Attendance Engine<br/>• Offline Excel Ingestion<br/>• Row-by-Row Validator<br/>• Multi-Filter Reports (Session/Class/Sec)<br/>• Dual CSV/Excel Exporter"]
        UI_MAIL["Mail Center<br/>• Centralized Inbox/Sent<br/>• Rich Composer & Drafts<br/>• Multi-Sender Selector<br/>• Failed Queue & Resend"]
        UI_NOT["Notice & Announcement Hub<br/>• Multi-File Attachments<br/>• Student/Teacher/Parent Audience<br/>• Interactive Reply Thread UI"]
    end

    subgraph GatewayLayer["Secure API Gateway & Middlewares"]
        AUTH_MW["requireAuth & requireRoles"]
        TENANT_MW["Zero-Trust school_id Isolator"]
        UPLOAD_MW["Multer XLSX/File Parser & MIME Guard"]
        VALID_MW["Zod / Schema Validation Filter"]
    end

    subgraph ServiceLayer["Enhanced Backend Services"]
        SVC_EXCEL["Excel Processing Service<br/>(xlsx / csv-parser)"]
        SVC_STU["Student Service Engine<br/>(Name Formatter, Session Linker)"]
        SVC_TCH["Teacher Service Engine"]
        SVC_ATT["Attendance Aggregation Engine"]
        SVC_NOTIF["Notification & SMTP Dispatcher<br/>(Nodemailer, Queue, Logger)"]
        SVC_COM["Notice & Reply Service"]
    end

    subgraph PersistenceLayer["Dual Database Storage"]
        PG_DB[("PostgreSQL 16 Relational<br/>• students (session_id FK)<br/>• notice_attachments<br/>• notification_replies<br/>• mail_drafts<br/>• notification_logs")]
        FS_DB[("Cloud Firestore<br/>• Real-time Notification Nodes<br/>• Synced Student Profiles")]
    end

    ClientLayer --> GatewayLayer
    GatewayLayer --> ServiceLayer
    ServiceLayer --> PersistenceLayer
```

---

## 5. Requirement Inventory

| Requirement ID | Module | Requirement Description | Priority |
| :--- | :--- | :--- | :---: |
| `REQ-001` | Student | The system shall provide a standardized downloadable Excel template for student onboarding. | P1 |
| `REQ-002` | Student | The system shall automatically compute student full name from `first_name` and `last_name`. | P0 |
| `REQ-003` | Student | The system shall mandate and validate an active academic session (`academic_year_id`) for every student. | P0 |
| `REQ-004` | Student | The system shall accept Excel (.xlsx/.xls/.csv) files for bulk student onboarding. | P1 |
| `REQ-005` | Student | The system shall generate sample pre-filled student Excel files with sample data. | P2 |
| `REQ-006` | Student | The system shall perform pre-ingestion validation on Excel headers, formats, and duplicate admission numbers. | P0 |
| `REQ-007` | Student | The system shall present an interactive tabular preview of parsed student records before committing to the DB. | P1 |
| `REQ-008` | Student | The system shall render student demographic and parent contact previews. | P2 |
| `REQ-009` | Student | The system shall support one-click individual student portal welcome/password-reset email dispatch. | P1 |
| `REQ-010` | Student | The system shall support bulk welcome email dispatch to selected or all imported students. | P1 |
| `REQ-011` | Student | The system shall record and display student email delivery statuses (`QUEUED`, `SENT`, `FAILED`). | P1 |
| `REQ-012` | Student | The system shall isolate email delivery failures without rolling back student database records. | P0 |
| `REQ-013` | Teacher | The system shall allow single faculty profile creation with employee ID and contact details. | P1 |
| `REQ-014` | Teacher | The system shall automatically trigger a welcome email with credentials upon teacher creation. | P1 |
| `REQ-015` | Teacher | The system shall support bulk teacher onboarding via standardized Excel template upload. | P1 |
| `REQ-016` | Teacher | The system shall validate teacher Excel rows for unique emails and employee IDs. | P0 |
| `REQ-017` | Teacher | The system shall provide an interactive preview grid for parsed teacher import rows. | P1 |
| `REQ-018` | Teacher | The system shall support bulk welcome/credentials email dispatch to faculty members. | P1 |
| `REQ-019` | Teacher | The system shall dispatch faculty emails via configured institutional SMTP with TLS/STARTTLS. | P0 |
| `REQ-020` | Teacher | The system shall record and display teacher email delivery status logs. | P1 |
| `REQ-021` | Attendance | The system shall support uploading offline attendance records via standardized Excel sheets. | P1 |
| `REQ-022` | Attendance | The system shall validate attendance Excel sheets against registered students, dates, and allowed statuses. | P0 |
| `REQ-023` | Attendance | The system shall present an attendance preview showing student statuses before saving. | P1 |
| `REQ-024` | Attendance | The system shall submit verified attendance sheets with idempotency guarantees. | P0 |
| `REQ-025` | Attendance | The system shall provide historical attendance lookups filtered by date, class, and section. | P1 |
| `REQ-026` | Attendance | The system shall compute real-time attendance analytics directly from the database. | P1 |
| `REQ-027` | Attendance | The system shall filter attendance reports by academic session, grade class, section, and date range. | P1 |
| `REQ-028` | Attendance | The system shall allow authorized attendance corrections with mandatory audit reasons. | P1 |
| `REQ-029` | Attendance | The system shall maintain an immutable history of all attendance correction requests and approvals. | P1 |
| `REQ-030` | Attendance | The system shall export attendance report data in both CSV and Excel (.xlsx) formats. | P1 |
| `REQ-031` | Mail | The system shall provide a centralized mail management dashboard for school administrators. | P1 |
| `REQ-032` | Mail | The system shall support composing and sending customized individual emails to any student, parent, or teacher. | P1 |
| `REQ-033` | Mail | The system shall support bulk broadcast emails filtered by role, class, or section. | P1 |
| `REQ-034` | Mail | The system shall allow drafting, editing, and saving unsent emails. | P2 |
| `REQ-035` | Mail | The system shall allow selecting sender identity profiles (`Principal`, `Administration`, `Attendance Desk`). | P2 |
| `REQ-036` | Mail | The system shall maintain an auditable chronological email log of all outbound messages. | P1 |
| `REQ-037` | Mail | The system shall track real-time delivery status for every email recipient. | P1 |
| `REQ-038` | Mail | The system shall provide a dedicated failed email management view with one-click resend capabilities. | P1 |
| `REQ-039` | Notice | The system shall support creating official institutional notices with priority levels. | P1 |
| `REQ-040` | Notice | The system shall support multi-file attachments (PDF, DOCX, PNG, JPG up to 10MB) for notices. | P1 |
| `REQ-041` | Notice | The system shall publish notices directly to the Parent Portal with read receipts. | P1 |
| `REQ-042` | Notice | The system shall store and display notice history with archived status and expiration dates. | P2 |
| `REQ-043` | Announcement | The system shall support publishing school-wide announcements visible to all stakeholders. | P1 |
| `REQ-044` | Announcement | The system shall support targeted class-level announcements visible only to selected grades. | P1 |
| `REQ-045` | Announcement | The system shall support dedicated faculty/teacher announcements restricted to staff. | P1 |
| `REQ-046` | Announcement | The system shall support student-specific announcements displayed on the Student Portal. | P1 |
| `REQ-047` | Announcement | The system shall enforce audience targeting rules preventing unauthorized cross-audience viewing. | P0 |
| `REQ-048` | Notification | The system shall automatically generate in-app notifications whenever announcements are published. | P1 |
| `REQ-049` | Notification | The system shall maintain an inbox of actionable notifications for students. | P1 |
| `REQ-050` | Notification | The system shall maintain an inbox of faculty notifications for teachers. | P1 |
| `REQ-051` | Notification | The system shall dispatch instant multi-channel absence alerts to parents upon roll-call. | P0 |
| `REQ-052` | Notification | The system shall log complete notification delivery histories with timestamps. | P1 |
| `REQ-053` | Reply | The system shall allow parents and students to reply to eligible notices and notifications. | P1 |
| `REQ-054` | Reply | The system shall automatically capture and bind the responding user's identity to the reply. | P0 |
| `REQ-055` | Reply | The system shall attach the student's class and section metadata to notification replies. | P1 |
| `REQ-056` | Reply | The system shall record timezone-accurate ISO timestamps for every reply submission. | P1 |
| `REQ-057` | Reply | The system shall store notification replies in a relational table accessible to administrators. | P0 |
| `REQ-058` | Data | The system shall enforce relational integrity and unique admission numbers in student storage. | P0 |
| `REQ-059` | Data | The system shall persist teacher profiles with foreign key bindings to user accounts. | P0 |
| `REQ-060` | Data | The system shall guarantee atomic attendance persistence across sessions and student records. | P0 |
| `REQ-061` | Data | The system shall store attendance correction audits with before/after state captures. | P0 |
| `REQ-062` | Data | The system shall retain notice and announcement histories with soft-deletion support. | P1 |
| `REQ-063` | Data | The system shall persist immutable email delivery logs with provider message IDs. | P0 |
| `REQ-064` | Data | The system shall provide structured database storage for notification replies with threaded lookups. | P0 |

---

## 6. Feature Inventory

- **Student Management**: `FEAT-001` (Template), `FEAT-002` (Auto Full Name), `FEAT-003` (Session Select), `FEAT-004` (Bulk Import), `FEAT-005` (Sample Download), `FEAT-006` (Import Validation), `FEAT-007` (Import Preview), `FEAT-008` (Info Preview), `FEAT-009` (Individual Email), `FEAT-010` (Bulk Email), `FEAT-011` (Email Tracking), `FEAT-012` (Email Failure Handling).
- **Teacher Management**: `FEAT-013` (Teacher Creation), `FEAT-014` (Auto Teacher Email), `FEAT-015` (Bulk Teacher Import), `FEAT-016` (Teacher Validation), `FEAT-017` (Teacher Preview), `FEAT-018` (Bulk Teacher Email), `FEAT-019` (SMTP Email), `FEAT-020` (Teacher Delivery Tracking).
- **Attendance**: `FEAT-021` (Offline Excel Import), `FEAT-022` (Attendance Validation), `FEAT-023` (Attendance Preview), `FEAT-024` (Attendance Submission), `FEAT-025` (Attendance History), `FEAT-026` (DB Reports), `FEAT-027` (Attendance Filtering), `FEAT-028` (Attendance Correction), `FEAT-029` (Correction History), `FEAT-030` (Attendance Export).
- **Mail Management**: `FEAT-031` (Centralized Mail Hub), `FEAT-032` (Individual Mail), `FEAT-033` (Bulk Mail), `FEAT-034` (Drafts), `FEAT-035` (Multiple Senders), `FEAT-036` (Email History), `FEAT-037` (Delivery Tracking), `FEAT-038` (Failed Mail Resend).
- **Notice Management**: `FEAT-039` (Notice Creation), `FEAT-040` (Notice Attachments), `FEAT-041` (Parent Notice), `FEAT-042` (Notice History).
- **Announcement Management**: `FEAT-043` (School Announcement), `FEAT-044` (Class Announcement), `FEAT-045` (Faculty Announcement), `FEAT-046` (Student Announcement), `FEAT-047` (Target Audience).
- **Notification Management**: `FEAT-048` (Announcement Notifications), `FEAT-049` (Student Notifications), `FEAT-050` (Teacher Notifications), `FEAT-051` (Parent Notifications), `FEAT-052` (Notification History).
- **Notification Reply**: `FEAT-053` (Reply Functionality), `FEAT-054` (User Identification), `FEAT-055` (Class/Section Context), `FEAT-056` (Reply Timestamp), `FEAT-057` (DB Storage).
- **Data Management**: `FEAT-058` (Student Data Storage), `FEAT-059` (Teacher Storage), `FEAT-060` (Attendance Storage), `FEAT-061` (Correction Storage), `FEAT-062` (Notice Storage), `FEAT-063` (Email Log Storage), `FEAT-064` (Reply Storage).

---

## 7. Feature Status Matrix

| Feature ID | Feature Name | Status in Codebase | Verification Finding |
| :--- | :--- | :---: | :--- |
| `FEAT-001` | Student Excel Template Standardization | **MISSING** | No `.xlsx` template generator or endpoint exists. |
| `FEAT-002` | Automatic Student Full Name | **MISSING** | Code accepts raw `name` string; no first/last name concatenation. |
| `FEAT-003` | Standardized Session Selection | **BROKEN** | `academic_year_id` column exists in SQL but ignored in routes. |
| `FEAT-004` | Bulk Student Import | **PARTIAL** | Only accepts raw JSON in `/api/students/bulk-import`; cannot parse `.xlsx`. |
| `FEAT-005` | Student Sample Excel Download | **MISSING** | No sample download endpoint. |
| `FEAT-006` | Student Import Validation | **PARTIAL** | Only superficial string presence checks; no regex or duplicate checks. |
| `FEAT-007` | Student Import Preview | **MISSING** | Directly inserts to database with zero preview modal. |
| `FEAT-008` | Student Information Preview | **IMPLEMENTED** | Student details previewed in admin table and student portal. |
| `FEAT-009` | Individual Student Email | **IMPLEMENTED** | Handled in `/api/students/:id/send-reset-email`. |
| `FEAT-010` | Bulk Student Email | **MISSING** | No bulk email trigger endpoint for students. |
| `FEAT-011` | Student Email Delivery Tracking | **PARTIAL** | Recorded in `notification_logs`, but no admin UI view. |
| `FEAT-012` | Student Email Failure Handling | **BROKEN** | Fails silently with `console.warn`; no UI alert or retry queue. |
| `FEAT-013` | Individual Teacher Creation | **IMPLEMENTED** | Implemented in `POST /api/teachers`. |
| `FEAT-014` | Automatic Teacher Email | **IMPLEMENTED** | Welcome invite with reset URL queued upon creation. |
| `FEAT-015` | Bulk Teacher Import | **MISSING** | No bulk teacher import endpoint or UI. |
| `FEAT-016` | Teacher Import Validation | **MISSING** | No validation schema for teacher spreadsheets. |
| `FEAT-017` | Teacher Import Preview | **MISSING** | No teacher staging grid. |
| `FEAT-018` | Bulk Teacher Email | **MISSING** | No bulk teacher credentials dispatcher. |
| `FEAT-019` | SMTP-Based Teacher Email | **IMPLEMENTED** | Dispatched via Nodemailer in `notificationService.ts`. |
| `FEAT-020` | Teacher Email Delivery Tracking | **PARTIAL** | Stored in database, but hidden from faculty management table. |
| `FEAT-021` | Offline Attendance Excel Import | **MISSING** | Offline page only supports IndexedDB JSON queue. |
| `FEAT-022` | Attendance Excel Validation | **MISSING** | No Excel attendance parser or status validator. |
| `FEAT-023` | Attendance Preview | **MISSING** | No attendance staging table before submission. |
| `FEAT-024` | Attendance Submission | **IMPLEMENTED** | Implemented in `POST /api/teacher/attendance`. |
| `FEAT-025` | Attendance History | **IMPLEMENTED** | Queryable in `/api/teacher/attendance/history`. |
| `FEAT-026` | Database-Driven Attendance Reports | **IMPLEMENTED** | Aggregated in `/api/attendance-reports/summary`. |
| `FEAT-027` | Attendance Filtering | **PARTIAL** | Only Date range implemented; Class & Section filters missing. |
| `FEAT-028` | Attendance Correction | **IMPLEMENTED** | Correction tickets in `/api/attendance-corrections`. |
| `FEAT-029` | Attendance Correction History | **IMPLEMENTED** | Immutable status audits (`PENDING`, `APPROVED`, `REJECTED`). |
| `FEAT-030` | Attendance Export | **PARTIAL** | Only client CSV Blob supported; native Excel `.xlsx` missing. |
| `FEAT-031` | Centralized Mail Management | **MISSING** | No centralized communication dashboard for arbitrary emails. |
| `FEAT-032` | Individual Email | **PARTIAL** | Only system alerts / reset emails exist; no generic composer. |
| `FEAT-033` | Bulk Email | **MISSING** | No bulk broadcast emailing feature. |
| `FEAT-034` | Email Drafts | **MISSING** | No draft persistence table or routes. |
| `FEAT-035` | Multiple Senders | **PARTIAL** | Config supports `senderEmail`, but no UI identity switcher. |
| `FEAT-036` | Email History | **PARTIAL** | In database, not exposed in administrator interface. |
| `FEAT-037` | Email Delivery Tracking | **PARTIAL** | In database, no real-time status monitor. |
| `FEAT-038` | Failed Email Management | **MISSING** | No failed queue monitor or one-click retry. |
| `FEAT-039` | Notice Creation | **PARTIAL** | Merged into announcements; no distinct notice entity. |
| `FEAT-040` | Notice Attachments | **MISSING** | Announcements table has no attachment handling or storage. |
| `FEAT-041` | Parent Notice Communication | **PARTIAL** | Announcements visible in Parent Inbox. |
| `FEAT-042` | Notice History | **PARTIAL** | Stored in `announcements`, lacking archive controls. |
| `FEAT-043` | School Announcement | **IMPLEMENTED** | `audience_type: 'SCHOOL'`. |
| `FEAT-044` | Class Announcement | **IMPLEMENTED** | `audience_type: 'CLASS'`. |
| `FEAT-045` | Faculty/Teacher Announcement | **MISSING** | Backend check strictly rejects `TEACHER` audience. |
| `FEAT-046` | Student Announcement | **PARTIAL** | Rendered on student portal, but lacks distinct audience key. |
| `FEAT-047` | Announcement Target Audience | **PARTIAL** | Limited to 4 hardcoded audience keys. |
| `FEAT-048` | Announcement Notifications | **PARTIAL** | Creates in-app recipient rows, but no push/email trigger. |
| `FEAT-049` | Student Notifications | **PARTIAL** | Read receipts implemented on student dashboard. |
| `FEAT-050` | Teacher Notifications | **MISSING** | No notification inbox for teachers. |
| `FEAT-051` | Parent Notifications | **IMPLEMENTED** | Instant parent absence email upon roll-call. |
| `FEAT-052` | Notification History | **PARTIAL** | Stored in `notification_logs`. |
| `FEAT-053` | Notification Reply | **MISSING** | No reply submission or viewing capability. |
| `FEAT-054` | Reply User Identification | **MISSING** | No schema or tracking for reply authors. |
| `FEAT-055` | Reply Class/Section Information | **MISSING** | No metadata binding. |
| `FEAT-056` | Reply Timestamp | **MISSING** | No timestamp capture for replies. |
| `FEAT-057` | Reply Database Storage | **MISSING** | No `notification_replies` table exists. |
| `FEAT-058` | Student Data Storage | **IMPLEMENTED** | `students` table + Firestore. |
| `FEAT-059` | Teacher Data Storage | **IMPLEMENTED** | `users` + `teacher_profiles` + Firestore. |
| `FEAT-060` | Attendance Data Storage | **IMPLEMENTED** | `daily_attendance` + `attendance_records`. |
| `FEAT-061` | Attendance Correction Storage | **IMPLEMENTED** | `attendance_corrections` table. |
| `FEAT-062` | Notice History Storage | **PARTIAL** | Stored in `announcements` table. |
| `FEAT-063` | Email Delivery Log Storage | **IMPLEMENTED** | `notification_logs` table. |
| `FEAT-064` | Notification Reply Storage | **MISSING** | Table needs creation in migration 034. |

---

## 8. Student Management Specification

### 8.1 Functional Blueprint
1. **Name Normalization**: Input accepts `firstName` and `lastName`. System computes `fullName = "${firstName.trim()} ${lastName.trim()}".trim()`. Stored in DB as `first_name`, `last_name`, and `name`/`full_name`.
2. **Mandatory Session Binding**: Every student enrollment must specify an active `academic_year_id` (`sessionId`). Reject creation with HTTP 400 if `sessionId` is invalid or belongs to another tenant.
3. **Unique Admission Constraint**: Enforce unique index `(school_id, admission_number)` at both database and application levels.
4. **Excel Ingestion Pipeline**:
   - Provide standard template generator (`GET /api/students/template`).
   - Validate headers: `First Name`, `Last Name`, `Admission Number`, `Roll Number`, `Parent Name`, `Parent Phone`, `Parent Email`, `Student Email`.
   - Render interactive staging preview with error highlights.
   - Commit confirmed rows inside a PostgreSQL transaction (`BEGIN ... COMMIT`).

---

## 9. Teacher Management Specification

1. **Bulk Onboarding**: School Admin can upload faculty Excel spreadsheet (`GET /api/teachers/template`).
2. **Validation Engine**: Ensures `email` format is valid, `employee_id` is unique within school, and `mobile` is 10 digits.
3. **Automated Credentials**: Upon database commit, generate cryptographically random temporary password (`crypto.randomBytes(8).toString('hex') + 'Tt1!'`) or single-use 24-hour password setup link (`/reset-password?token=...`).
4. **Asynchronous SMTP Dispatch**: Enqueue welcome emails with teacher employee ID and login URL in `notification_logs`.

---

## 10. Student Email Automation

1. **Event Trigger**: When a student record is created individually or via bulk import, and `sendInviteEmail = true` and `loginOption != 'NONE'`.
2. **Recipient Resolution**: If `loginOption == 'STUDENT'`, send to `student_email`; if `PARENT`, send to `parent_email`.
3. **Template**: Render `STUDENT_CREATED` / `PARENT_CREATED` with school name, class, section, roll number, and password setup URL.
4. **Resilience**: In the event of an SMTP network error, the student record **remains committed**. The email log is updated with `status = 'FAILED'` and `last_error = err.message`.

---

## 11. Teacher Email Automation

1. **Event Trigger**: Dispatched immediately upon teacher account provisioning.
2. **Delivery Security**: Enforce TLS/STARTTLS on port 587 or HTTPS Email API fallback (Port 443).
3. **Audit Trail**: Every outbound faculty email logged in `notification_logs` with `recipient_type = 'TEACHER'`.

---

## 12. Attendance Management Specification

### 12.1 Offline Excel Ingestion
- Administrators or teachers can upload an offline attendance spreadsheet.
- Expected Columns: `Admission Number` (or `Roll Number`), `Student Name`, `Status` (`P`, `A`, `L`, `HD`), `Date` (`YYYY-MM-DD`).
- Validates that all students exist in the selected class and section.
- Previews attendance breakdown (Total, Present, Absent, Late).
- Upon confirmation, upserts into `daily_attendance` and `attendance_records` idempotently.

### 12.2 Multi-Dimensional Filtering & Dual Export
- Add Class Grade, Section, and Academic Session selectors to `AttendanceReports.tsx`.
- Support exporting to both `.csv` and native formatted `.xlsx` (using `xlsx` library with header styling and total percentage rows).

---

## 13. Mail Management Hub Specification

Build `frontend/src/pages/admin/MailManagement.tsx` and `backend/src/routes/mail.ts`:
1. **Centralized Views**: Inbox / Sent Logs, Compose New Email, Drafts, and Failed Deliveries.
2. **Recipient Scope**:
   - Individual: Single email lookup.
   - Bulk: "All Students in Class 10-A", "All Faculty", "All School Parents".
3. **Sender Profile Selector**:
   - `Office Desk <office@school.com>`
   - `Principal's Office <principal@school.com>`
4. **Failed Email Queue**:
   - Filter `status = 'FAILED'`.
   - Displays error description (e.g., *Connection timeout on port 587*).
   - "Retry All Failed" button triggers background worker re-dispatch.

---

## 14. Notice Management Specification

1. **Separation from Announcements**: Notices represent official institutional directives with formal reference numbers, issuance dates, and target roles (`STUDENT`, `TEACHER`, `PARENT`).
2. **Multi-File Attachments**: Upload up to 5 attachments per notice (PDF, DOCX, PNG, JPG up to 10MB per file) via Multer, stored under `/uploads/notices/` with sanitized UUIDs.
3. **Portal Feeds**: Notices appear pinned at the top of the Student and Parent Portals.

---

## 15. Announcement Management Specification

1. **Audience Extension**: Update `communicationService.ts` to allow `audience_type IN ('SCHOOL', 'CLASS', 'SECTION', 'PARENTS', 'TEACHER', 'STUDENT')`.
2. **Strict RBAC Enforcement**:
   - `TEACHER` announcements are visible strictly to authenticated faculty accounts.
   - `STUDENT` announcements appear in the Student Portal feed.

---

## 16. Notification Management Specification

1. **Multi-Channel Dispatch**: Announcements with priority `EMERGENCY` automatically trigger email notifications in addition to in-app notification rows.
2. **Faculty In-App Inbox**: Add a notification bell and drawer in the Teacher Portal.

---

## 17. Notification Reply Specification

1. **Reply Mechanism**: Parents and students can click "Reply" on eligible notices.
2. **Captured Context**:
   - `user_id`: Authenticated author.
   - `student_id`: Linked student.
   - `class_id`, `section_id`: Student's academic placement.
   - `reply_text`: Sanitized response text.
   - `created_at`: ISO timestamp.
3. **Database Table**: Stored in `notification_replies`.
4. **Administrator Console**: School Admins view threaded replies grouped by notice in the Communication Center.

---

## 18. Database & Data Management

```sql
-- Migration 034: Task-1 Architecture Enhancements
-- File: database/migrations/034_task1_enhancements.sql

-- 1. Student Name Breakdown & Session Foreign Key
ALTER TABLE students ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
ALTER TABLE students ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);
ALTER TABLE students ADD COLUMN IF NOT EXISTS full_name VARCHAR(200);

-- Backfill full_name for existing students
UPDATE students SET full_name = name WHERE full_name IS NULL;

-- 2. Notice Multi-File Attachments
CREATE TABLE IF NOT EXISTS notice_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_type VARCHAR(100),
  file_size_bytes INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notice_attachments_announcement 
  ON notice_attachments(announcement_id);

-- 3. Notification & Notice Replies
CREATE TABLE IF NOT EXISTS notification_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  section_id UUID REFERENCES sections(id) ON DELETE SET NULL,
  reply_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notification_replies_announcement 
  ON notification_replies(announcement_id, created_at ASC);

-- 4. Centralized Mail Drafts
CREATE TABLE IF NOT EXISTS mail_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  sender_profile VARCHAR(100),
  recipient_type VARCHAR(50),
  target_audience VARCHAR(100),
  subject VARCHAR(255),
  body_html TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 19. Excel Import Architecture

```mermaid
flowchart TD
    A[Download Official Template] --> B[User Prepares Excel .xlsx]
    B --> C[Select Session, Class, Section]
    C --> D[Drop File on Dropzone]
    D --> E[Client-Side Worker Parses Headers]
    E --> F{Headers Valid?}
    F -- No --> G[Show Header Mismatch Error]
    F -- Yes --> H[POST /api/import/validate Dry-Run]
    H --> I[Backend Validates DB Constraints]
    I --> J[Render Staging Preview Grid]
    J --> K{User Edits or Confirms?}
    K -- Cancel --> L[Discard Staging Data]
    K -- Confirm --> M[POST /api/import/confirm]
    M --> N[Atomic PostgreSQL Transaction]
    N --> O[Enqueue Background Welcome Emails]
    O --> P[Render Summary Toast]
```

---

## 20. Session Management Cross-Cutting Architecture

```
Academic Session Master (academic_years)
  ├── 1. Student Enrollment (students.academic_year_id)
  ├── 2. Class & Section Allocation (classes.academic_year_id)
  ├── 3. Timetable Routines (class_routines.academic_year_id)
  ├── 4. Attendance Roll-Calls (daily_attendance filtered by session)
  ├── 5. Attendance Reporting (Aggregated within session boundaries)
  └── 6. Annual Student Promotion (Transfers cohort from Session N to N+1)
```

---

## 21. Email / SMTP Architecture

```mermaid
graph TD
    EVENT[Event: Student / Teacher / Notice / Mail] --> DISPATCH[Notification Router]
    DISPATCH --> CHECK_ENV{Environment & Host Check}
    
    CHECK_ENV -- Render Free Tier (Port 587 Blocked) --> API_GW[Resend / Brevo HTTPS API (Port 443)]
    CHECK_ENV -- Hostinger VPS / Standard Node --> SMTP_GW[Nodemailer direct TLS/STARTTLS smtp.gmail.com:587]
    CHECK_ENV -- Local Dev with Demo Strings --> SANDBOX[Simulated In-Memory Sandbox Mock]

    API_GW --> LOG[(notification_logs Table)]
    SMTP_GW --> LOG
    SANDBOX --> LOG

    LOG --> FAILED{Delivery Status?}
    FAILED -- FAILED --> RETRY_Q[Failed Email Management Queue]
    RETRY_Q --> MANUAL_RETRY[Admin Clicks 'Resend All Failed']
    MANUAL_RETRY --> DISPATCH
    FAILED -- SENT --> DONE([Delivery Confirmed])
```

---

## 22. Security Requirements

1. **Formula Injection Mitigation**: Any spreadsheet cell value starting with `=`, `+`, `-`, or `@` must have a leading single quote `'` prepended prior to database storage or rendering.
2. **Path Traversal Guard**: Uploaded attachments are stripped of all relative path notations (`../`, `..\\`), renamed with deterministic UUIDs, and served with `X-Content-Type-Options: nosniff`.
3. **Cross-Tenant Isolation**: Every database write and read must include `WHERE school_id = req.user.schoolId`. Cross-tenant session or class IDs result in HTTP 403 Forbidden.
4. **Email Header Sanitization**: Inbound email subjects and recipient names are stripped of newline characters (`\r`, `\n`) to prevent CRLF injection attacks.

---

## 23. Data Integrity & Transactional Semantics

1. **All-or-Nothing Import Transactions**: When an administrator confirms a bulk student or teacher import, all records within the batch are inserted inside a single PostgreSQL database transaction. If any database write fails, the entire transaction rolls back (`ROLLBACK`), preventing partial imports.
2. **Non-Rollback Email Isolation**: If database persistence succeeds but the subsequent SMTP email dispatch fails, the student/teacher database records **must never be rolled back**. The failure is recorded in `notification_logs` for subsequent administrator retry.

---

## 24. Feature-by-Feature Architecture Traceability

```
User Action
  ↓
Frontend UI Component
  ↓
Client-Side Validation (Zod / Regex)
  ↓
API Request (Axios with Bearer JWT)
  ↓
Express Gateway Middleware (CORS, Rate Limiter, Security Headers)
  ↓
Authentication & Role Middleware (requireAuth, requireRoles)
  ↓
Tenant Context Resolver (req.user.schoolId)
  ↓
Route Handler Controller
  ↓
Business Service Engine
  ↓
Database Persistence (PostgreSQL 16 Transaction + Cloud Firestore Mirror)
  ↓
Asynchronous Notification Job (Nodemailer / Brevo / Resend)
  ↓
Audit Event Logging (audit_logs table)
  ↓
HTTP Response JSON
  ↓
Frontend React State Update & UI Notification Toast
```

---

## 25. Feature Flowcharts (Mermaid)

### 25.1 Offline Attendance Excel Ingestion Flowchart

```mermaid
flowchart TD
    A[Teacher Uploads attendance_class10.xlsx] --> B[Parse Class, Section & Date Headers]
    B --> C[Lookup Enrolled Students for Class & Section]
    C --> D[Validate Rows: Admission No, Name, Status P/A/L/HD]
    D --> E{All Statuses Valid?}
    E -- No --> F[Highlight Invalid Status Rows in Red] --> A
    E -- Yes --> G[Render Attendance Summary & Preview Grid]
    G --> H{Teacher Confirms Submission?}
    H -- No --> I[Cancel]
    H -- Yes --> J[POST /api/offline-attendance/excel-submit]
    J --> K[Upsert daily_attendance & attendance_records]
    K --> L[Dispatch Absent Notifications if Enabled]
    L --> M[Return Success: Attendance Recorded]
```

---

## 26. Use Case Diagrams

```mermaid
flowchart LR
    ADMIN((School Admin))
    TEACHER((Teacher))
    PARENT((Parent))
    SYS[AttendO School Platform]
    SMTP[SMTP Email Server]

    ADMIN -->|Upload Student Roster| SYS
    ADMIN -->|Preview Staged Students| SYS
    ADMIN -->|Confirm Student Ingestion| SYS
    ADMIN -->|Send Bulk Setup Emails| SYS
    SYS -->|Dispatch Transactional Mail| SMTP
    SMTP -->|Delivery Status Result| SYS
    TEACHER -->|Upload Offline Attendance Sheet| SYS
    PARENT -->|Submit Notification Reply| SYS
```

---

## 27. API Architecture Specification

### API-001: Download Student Template
- **Method**: `GET /api/students/template`
- **Auth**: `Bearer <JWT>` (`SCHOOL_ADMIN`)
- **Query**: `?sample=true`
- **Output**: `.xlsx` binary stream.

### API-002: Validate Student Import (Dry-Run Preview)
- **Method**: `POST /api/students/import/validate`
- **Auth**: `Bearer <JWT>` (`SCHOOL_ADMIN`)
- **Body**: `{ sessionId, classId, sectionId, students: [...] }`
- **Output**: `{ valid: true, totalRows: 50, preview: [...] }`.

### API-003: Confirm Bulk Student Import
- **Method**: `POST /api/students/import/confirm`
- **Auth**: `Bearer <JWT>` (`SCHOOL_ADMIN`)
- **Body**: `{ sessionId, classId, sectionId, students: [...], sendWelcomeEmails: true }`
- **Output**: `{ success: true, count: 50, emailsQueued: 50 }`.

### API-004: Bulk Student Email Dispatch
- **Method**: `POST /api/students/bulk-email`
- **Auth**: `Bearer <JWT>` (`SCHOOL_ADMIN`)
- **Body**: `{ studentIds: [...], emailType: 'WELCOME' }`
- **Output**: `{ success: true, enqueued: 50 }`.

### API-005: Download Teacher Template
- **Method**: `GET /api/teachers/template`
- **Auth**: `Bearer <JWT>` (`SCHOOL_ADMIN`)
- **Output**: `.xlsx` binary stream.

### API-006: Confirm Bulk Teacher Import
- **Method**: `POST /api/teachers/bulk-import`
- **Auth**: `Bearer <JWT>` (`SCHOOL_ADMIN`)
- **Body**: `{ teachers: [...], sendWelcomeEmails: true }`
- **Output**: `{ success: true, count: 12, emailsQueued: 12 }`.

### API-007: Attendance Excel Preview & Ingest
- **Method**: `POST /api/offline-attendance/excel-validate`
- **Auth**: `Bearer <JWT>` (`TEACHER`, `SCHOOL_ADMIN`)
- **Body**: Multipart file or JSON `{ sessionId, classId, sectionId, date, records: [...] }`
- **Output**: `{ valid: true, summary: { present: 42, absent: 3, late: 1 }, preview: [...] }`.

### API-008: Attendance Excel Export
- **Method**: `GET /api/attendance-reports/export/excel`
- **Auth**: `Bearer <JWT>` (`SCHOOL_ADMIN`, `TEACHER`)
- **Query**: `?from=YYYY-MM-DD&to=YYYY-MM-DD&classId=...&sectionId=...`
- **Output**: `.xlsx` binary stream.

### API-009: Submit Notification Reply
- **Method**: `POST /api/communication/announcements/:id/reply`
- **Auth**: `Bearer <JWT>` (`PARENT`, `STUDENT`)
- **Body**: `{ "replyText": "Received, thank you." }`
- **Output**: `{ id: "...", userName: "...", userRole: "PARENT", createdAt: "..." }`.

### API-010: List Notification Replies
- **Method**: `GET /api/communication/announcements/:id/replies`
- **Auth**: `Bearer <JWT>` (`SCHOOL_ADMIN`)
- **Output**: Array of reply records with student class and section metadata.

---

## 28. Database Architecture Specification

- **PostgreSQL 16**: Normalized 67 tables + migration 034 (4 tables/columns).
- **Foreign Keys**: Cascade delete on `school_id`, set null on user references.
- **Indexes**: Composite unique index on `(school_id, admission_number)`, index on `(announcement_id, created_at)`.
- **Cloud Firestore**: Hierarchical document store synced via `firestoreSync.ts`.

---

## 29. Positive Test Cases (`TC-POS-XXX`)

| Test ID | Feature | Steps | Expected Result | Priority |
| :--- | :--- | :--- | :--- | :---: |
| `TC-POS-001` | `FEAT-001` | Request `GET /api/students/template` | Returns HTTP 200 with valid `.xlsx` template. | P1 |
| `TC-POS-002` | `FEAT-002` | Create student with `firstName: "Aman"`, `lastName: "Das"` | `full_name` saved as `"Aman Das"`. | P0 |
| `TC-POS-003` | `FEAT-004` | Import 50 valid student rows via Excel | HTTP 201; 50 students inserted into database. | P1 |
| `TC-POS-004` | `FEAT-009` | Dispatch student password reset email | HTTP 200; reset URL generated and logged in `notification_logs`. | P1 |
| `TC-POS-005` | `FEAT-024` | Submit daily roll-call attendance | HTTP 200; absent notifications enqueued. | P0 |
| `TC-POS-006` | `FEAT-030` | Export attendance report to Excel | HTTP 200; downloads styled `.xlsx` file. | P1 |
| `TC-POS-007` | `FEAT-040` | Publish notice with PDF attachment | HTTP 201; file stored on server; download link active. | P1 |
| `TC-POS-008` | `FEAT-053` | Submit notification reply | HTTP 201; reply bound to user and student metadata. | P1 |

---

## 30. Negative Test Cases (`TC-NEG-XXX`)

| Test ID | Feature | Scenario | Expected Result | Priority |
| :--- | :--- | :--- | :--- | :---: |
| `TC-NEG-001` | `FEAT-004` | Upload non-Excel file (.exe) | HTTP 400; "Invalid file format. Only Excel files allowed." | P0 |
| `TC-NEG-002` | `FEAT-006` | Duplicate admission number in Excel | Validation flags duplicate row; blocks commit. | P0 |
| `TC-NEG-003` | `FEAT-003` | Empty academic session ID | HTTP 400; "Active academic session is mandatory." | P0 |
| `TC-NEG-004` | `FEAT-019` | SMTP server offline during creation | Teacher created in DB; email status logged as `FAILED`. | P0 |
| `TC-NEG-005` | `FEAT-047` | Unauthorized student access to faculty notice | HTTP 403 Forbidden; notice hidden from response. | P0 |
| `TC-NEG-006` | `FEAT-053` | Empty notification reply text | HTTP 400; "Reply text cannot be empty." | P2 |

---

## 31. Edge Case Test Cases (`TC-EDGE-XXX`)

| Test ID | Feature | Scenario | Expected Result | Priority |
| :--- | :--- | :--- | :--- | :---: |
| `TC-EDGE-001` | `FEAT-002` | Student with no last name (mononym) | `full_name` stored cleanly as `"Kavita"`. | P1 |
| `TC-EDGE-002` | `FEAT-004` | Excel sheet with 1,000 student rows | Chunked processing completes in $< 5\text{ seconds}$. | P1 |
| `TC-EDGE-003` | `FEAT-004` | Unicode student names (`"Zoë Müller"`, `"অভিরূপ"`) | UTF-8 encoding preserved without corruption. | P1 |
| `TC-EDGE-004` | `FEAT-028` | Simultaneous attendance updates by two teachers | Concurrency locking prevents duplicate sessions. | P0 |
| `TC-EDGE-005` | `FEAT-040` | File attachment upload exactly at 10.0MB limit | File accepted and verified without memory crash. | P2 |

---

## 32. Security Test Cases (`TC-SEC-XXX`)

| Test ID | Feature | Vulnerability Tested | Expected Result | Priority |
| :--- | :--- | :--- | :--- | :---: |
| `TC-SEC-001` | `FEAT-004` | CSV Formula Injection (`=cmd|'...'!A0`) | Formula sanitized; prepended with single quote. | P0 |
| `TC-SEC-002` | `FEAT-003` | Cross-Tenant Session Tampering | HTTP 403; cross-tenant session rejected. | P0 |
| `TC-SEC-003` | `FEAT-040` | Path Traversal via Attachment Filename | Sanitized to UUID; stored strictly in designated folder. | P0 |
| `TC-SEC-004` | `FEAT-031` | Email Header CRLF Injection | Newlines stripped; prevents BCC injection. | P0 |

---

## 33. Performance Test Cases (`TC-PERF-XXX`)

| Test ID | Dimension | Workload | Target SLA |
| :--- | :--- | :--- | :--- |
| `TC-PERF-001` | Bulk Student Parse & Ingest | 500 rows dry-run validated. | Response time $< 1,500\text{ ms}$. |
| `TC-PERF-002` | Excel Attendance Export | 1,200 students × 30 days. | Generation time $< 800\text{ ms}$; file size $< 2\text{ MB}$. |
| `TC-PERF-003` | Bulk Email Enqueueing | 200 welcome emails queued. | Database enqueue completes in $< 350\text{ ms}$. |

---

## 34. Fix Register & Remediation Blueprint

| Fix ID | Feature ID | Problem & Root Cause in Existing Code | Required Remediation | Files Impacted | Priority |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `FIX-001` | `FEAT-001`, `FEAT-005` | No standardized Excel template download endpoint exists. | Implement `GET /api/students/template` and `GET /api/teachers/template` streaming `.xlsx` with SheetJS. | `backend/src/routes/schoolData.ts`, `frontend/src/pages/admin/PeopleManagement.tsx` | P1 |
| `FIX-002` | `FEAT-002` | `schoolData.ts` accepts raw `name` string without first/last name breakdown. | Update schema and routes to accept `first_name` & `last_name`, auto-computing `full_name`. | `backend/src/routes/schoolData.ts`, `database/migrations/034_task1_enhancements.sql` | P0 |
| `FIX-003` | `FEAT-003`, `FEAT-058` | Student enrollment routes omit `academic_year_id`, leaving students unlinked to active sessions. | Bind active `academic_year_id` during student creation and bulk import; enforce foreign key constraint. | `backend/src/routes/schoolData.ts`, `frontend/src/pages/admin/PeopleManagement.tsx` | P0 |
| `FIX-004` | `FEAT-004`, `FEAT-006`, `FEAT-007` | Bulk student import is limited to JSON payloads with zero dry-run validation or preview modal. | Build Multer file upload handler, SheetJS parser, preview staging endpoint, and React preview dialog. | `backend/src/routes/schoolData.ts`, `frontend/src/pages/admin/PeopleManagement.tsx` | P1 |
| `FIX-005` | `FEAT-010`, `FEAT-018` | No mechanism exists to trigger welcome emails in bulk after importing students or faculty. | Implement `POST /api/students/bulk-email` and `POST /api/teachers/bulk-email` with chunked queuing. | `backend/src/routes/schoolData.ts`, `backend/src/services/notificationService.ts` | P1 |
| `FIX-006` | `FEAT-011`, `FEAT-012`, `FEAT-020` | Email failures log to console with `console.warn` without database log or admin notification. | Ensure every SMTP failure writes to `notification_logs` (status `FAILED`) and surface failure counts in UI. | `backend/src/services/notificationService.ts`, `frontend/src/pages/admin/` | P0 |
| `FIX-007` | `FEAT-015`, `FEAT-016`, `FEAT-017` | Faculty onboarding lacks bulk Excel import; only single teacher creation exists. | Create `POST /api/teachers/bulk-import` with template validation and preview grid. | `backend/src/routes/schoolData.ts`, `frontend/src/pages/admin/PeopleManagement.tsx` | P1 |
| `FIX-008` | `FEAT-021`, `FEAT-022`, `FEAT-023` | Offline attendance page only handles IndexedDB sync; cannot ingest Excel sheets. | Add Excel file upload for attendance with student roll/status validation and preview table. | `backend/src/routes/offlineAttendance.ts`, `frontend/src/pages/admin/OfflineAttendance.tsx` | P1 |
| `FIX-009` | `FEAT-027` | Attendance reports UI only has Date filters, omitting Class, Section, and Session filters. | Add Class, Section, and Academic Year dropdown filters to `AttendanceReports.tsx` and backend route. | `backend/src/routes/attendanceReports.ts`, `frontend/src/pages/admin/AttendanceReports.tsx` | P1 |
| `FIX-010` | `FEAT-030` | Attendance export strictly generates CSV, lacking styled Excel (`.xlsx`) format. | Implement `GET /api/attendance-reports/export/excel` using `exceljs`/`xlsx` with cell formatting. | `backend/src/routes/attendanceReports.ts`, `frontend/src/pages/admin/AttendanceReports.tsx` | P1 |
| `FIX-011` | `FEAT-031`, `FEAT-032`, `FEAT-033`, `FEAT-034` | No centralized Mail Management interface exists for custom communications. | Build `MailManagement.tsx` and `/api/mail` routes supporting individual/bulk emails and drafts. | `backend/src/routes/mail.ts`, `frontend/src/pages/admin/MailManagement.tsx` | P1 |
| `FIX-012` | `FEAT-035` | Sender profile is hardcoded to single SMTP address without selectable identities. | Allow admin to select sender profile (`Principal`, `Accounts`, `Administration`) with verified `from` headers. | `backend/src/services/notificationService.ts` | P2 |
| `FIX-013` | `FEAT-038` | No failed email queue or retry mechanism is accessible in the administrator console. | Add failed email view in Mail Management with a one-click "Retry Failed Emails" API trigger. | `backend/src/routes/mail.ts`, `frontend/src/pages/admin/MailManagement.tsx` | P1 |
| `FIX-014` | `FEAT-039`, `FEAT-041`, `FEAT-042` | Notices and announcements are conflated without formal notice categorization. | Create distinct Notice entity with formal publication status, priority badges, and target roles. | `backend/src/routes/communication.ts`, `frontend/src/pages/admin/Communication.tsx` | P1 |
| `FIX-015` | `FEAT-040` | Announcements table has no attachment support, preventing document circulation. | Add `notice_attachments` table and Multer file upload handler supporting PDF/images. | `backend/src/routes/communication.ts`, `database/migrations/034_task1_enhancements.sql` | P1 |
| `FIX-016` | `FEAT-045`, `FEAT-046`, `FEAT-047` | `communicationService.ts` strictly rejects audience types outside `SCHOOL`, `CLASS`, `SECTION`, `PARENTS`. | Expand allowed audiences to include `TEACHER` and `STUDENT`; enforce audience role checks. | `backend/src/services/communicationService.ts`, `frontend/src/pages/admin/Communication.tsx` | P0 |
| `FIX-017` | `FEAT-048`, `FEAT-049`, `FEAT-050` | In-app notification creation does not cover faculty teachers or trigger alert toasts. | Dispatch notification events across teacher inboxes and student portals upon announcement release. | `backend/src/services/communicationService.ts` | P1 |
| `FIX-018` | `FEAT-053` to `FEAT-057`, `FEAT-064` | Notification reply capability is completely missing across database, API, and UI. | Create `notification_replies` table, `/reply` API endpoints, and interactive reply modal/thread. | `backend/src/routes/communication.ts`, `frontend/src/pages/admin/Communication.tsx` | P0 |

---

## 35. Feature → Fix → Test Traceability Matrix

| Feature ID | Requirement ID | Fix ID | Verification Test Cases | Implementation Status |
| :--- | :--- | :--- | :--- | :---: |
| `FEAT-001` | `REQ-001` | `FIX-001` | `TC-POS-001`, `TC-NEG-001` | Planned via `FIX-001` |
| `FEAT-002` | `REQ-002` | `FIX-002` | `TC-POS-002`, `TC-EDGE-001` | Planned via `FIX-002` |
| `FEAT-003` | `REQ-003` | `FIX-003` | `TC-NEG-003`, `TC-SEC-002` | Planned via `FIX-003` |
| `FEAT-004` | `REQ-004` | `FIX-004` | `TC-POS-003`, `TC-EDGE-002`, `TC-PERF-001` | Planned via `FIX-004` |
| `FEAT-005` | `REQ-005` | `FIX-001` | `TC-POS-001` | Planned via `FIX-001` |
| `FEAT-006` | `REQ-006` | `FIX-004` | `TC-NEG-002`, `TC-SEC-001` | Planned via `FIX-004` |
| `FEAT-007` | `REQ-007` | `FIX-004` | `TC-POS-003` | Planned via `FIX-004` |
| `FEAT-008` | `REQ-008` | — | `TC-POS-003` | **IMPLEMENTED** |
| `FEAT-009` | `REQ-009` | — | `TC-POS-004` | **IMPLEMENTED** |
| `FEAT-010` | `REQ-010` | `FIX-005` | `TC-PERF-003` | Planned via `FIX-005` |
| `FEAT-011` | `REQ-011` | `FIX-006` | `TC-POS-004` | Planned via `FIX-006` |
| `FEAT-012` | `REQ-012` | `FIX-006` | `TC-NEG-004` | Planned via `FIX-006` |
| `FEAT-013` | `REQ-013` | — | `TC-POS-004` | **IMPLEMENTED** |
| `FEAT-014` | `REQ-014` | — | `TC-POS-004` | **IMPLEMENTED** |
| `FEAT-015` | `REQ-015` | `FIX-007` | `TC-POS-003` | Planned via `FIX-007` |
| `FEAT-016` | `REQ-016` | `FIX-007` | `TC-NEG-002` | Planned via `FIX-007` |
| `FEAT-017` | `REQ-017` | `FIX-007` | `TC-POS-003` | Planned via `FIX-007` |
| `FEAT-018` | `REQ-018` | `FIX-005` | `TC-PERF-003` | Planned via `FIX-005` |
| `FEAT-019` | `REQ-019` | — | `TC-POS-004`, `TC-NEG-004` | **IMPLEMENTED** |
| `FEAT-020` | `REQ-020` | `FIX-006` | `TC-POS-004` | Planned via `FIX-006` |
| `FEAT-021` | `REQ-021` | `FIX-008` | `TC-POS-003` | Planned via `FIX-008` |
| `FEAT-022` | `REQ-022` | `FIX-008` | `TC-NEG-001`, `TC-NEG-002` | Planned via `FIX-008` |
| `FEAT-023` | `REQ-023` | `FIX-008` | `TC-POS-003` | Planned via `FIX-008` |
| `FEAT-024` | `REQ-024` | — | `TC-POS-005`, `TC-EDGE-004` | **IMPLEMENTED** |
| `FEAT-025` | `REQ-025` | — | `TC-POS-005` | **IMPLEMENTED** |
| `FEAT-026` | `REQ-026` | — | `TC-POS-006` | **IMPLEMENTED** |
| `FEAT-027` | `REQ-027` | `FIX-009` | `TC-POS-006` | Planned via `FIX-009` |
| `FEAT-028` | `REQ-028` | — | `TC-POS-005`, `TC-EDGE-004` | **IMPLEMENTED** |
| `FEAT-029` | `REQ-029` | — | `TC-POS-005` | **IMPLEMENTED** |
| `FEAT-030` | `REQ-030` | `FIX-010` | `TC-POS-006`, `TC-PERF-002` | Planned via `FIX-010` |
| `FEAT-031` | `REQ-031` | `FIX-011` | `TC-POS-004` | Planned via `FIX-011` |
| `FEAT-032` | `REQ-032` | `FIX-011` | `TC-POS-004` | Planned via `FIX-011` |
| `FEAT-033` | `REQ-033` | `FIX-011` | `TC-PERF-003` | Planned via `FIX-011` |
| `FEAT-034` | `REQ-034` | `FIX-011` | `TC-POS-004` | Planned via `FIX-011` |
| `FEAT-035` | `REQ-035` | `FIX-012` | `TC-POS-004` | Planned via `FIX-012` |
| `FEAT-036` | `REQ-036` | `FIX-006` | `TC-POS-004` | Planned via `FIX-006` |
| `FEAT-037` | `REQ-037` | `FIX-006` | `TC-POS-004` | Planned via `FIX-006` |
| `FEAT-038` | `REQ-038` | `FIX-013` | `TC-NEG-004` | Planned via `FIX-013` |
| `FEAT-039` | `REQ-039` | `FIX-014` | `TC-POS-007` | Planned via `FIX-014` |
| `FEAT-040` | `REQ-040` | `FIX-015` | `TC-POS-007`, `TC-EDGE-005`, `TC-SEC-003` | Planned via `FIX-015` |
| `FEAT-041` | `REQ-041` | `FIX-014` | `TC-POS-007` | Planned via `FIX-014` |
| `FEAT-042` | `REQ-042` | `FIX-014` | `TC-POS-007` | Planned via `FIX-014` |
| `FEAT-043` | `REQ-043` | — | `TC-POS-007` | **IMPLEMENTED** |
| `FEAT-044` | `REQ-044` | — | `TC-POS-007` | **IMPLEMENTED** |
| `FEAT-045` | `REQ-045` | `FIX-016` | `TC-POS-007`, `TC-SEC-004` | Planned via `FIX-016` |
| `FEAT-046` | `REQ-046` | `FIX-016` | `TC-POS-007`, `TC-SEC-004` | Planned via `FIX-016` |
| `FEAT-047` | `REQ-047` | `FIX-016` | `TC-SEC-004` | Planned via `FIX-016` |
| `FEAT-048` | `REQ-048` | `FIX-017` | `TC-POS-007` | Planned via `FIX-017` |
| `FEAT-049` | `REQ-049` | `FIX-017` | `TC-POS-007` | Planned via `FIX-017` |
| `FEAT-050` | `REQ-050` | `FIX-017` | `TC-POS-007` | Planned via `FIX-017` |
| `FEAT-051` | `REQ-051` | — | `TC-POS-005` | **IMPLEMENTED** |
| `FEAT-052` | `REQ-052` | `FIX-006` | `TC-POS-005` | Planned via `FIX-006` |
| `FEAT-053` | `REQ-053` | `FIX-018` | `TC-POS-008`, `TC-NEG-006` | Planned via `FIX-018` |
| `FEAT-054` | `REQ-054` | `FIX-018` | `TC-POS-008` | Planned via `FIX-018` |
| `FEAT-055` | `REQ-055` | `FIX-018` | `TC-POS-008` | Planned via `FIX-018` |
| `FEAT-056` | `REQ-056` | `FIX-018` | `TC-POS-008` | Planned via `FIX-018` |
| `FEAT-057` | `REQ-057` | `FIX-018` | `TC-POS-008` | Planned via `FIX-018` |
| `FEAT-058` | `REQ-058` | `FIX-003` | `TC-POS-003`, `TC-NEG-002` | Planned via `FIX-003` |
| `FEAT-059` | `REQ-059` | — | `TC-POS-004` | **IMPLEMENTED** |
| `FEAT-060` | `REQ-060` | — | `TC-POS-005` | **IMPLEMENTED** |
| `FEAT-061` | `REQ-061` | — | `TC-POS-005` | **IMPLEMENTED** |
| `FEAT-062` | `REQ-062` | `FIX-014` | `TC-POS-007` | Planned via `FIX-014` |
| `FEAT-063` | `REQ-063` | — | `TC-POS-004`, `TC-POS-005` | **IMPLEMENTED** |
| `FEAT-064` | `REQ-064` | `FIX-018` | `TC-POS-008` | Planned via `FIX-018` |

---

## 36. Required Project Updates

### 36.1 Critical Fixes (P0)
- `FIX-002`: Implement `first_name` and `last_name` split and auto-generate `full_name`.
- `FIX-003`: Enforce mandatory active `academic_year_id` on student records.
- `FIX-006`: Guarantee all email failures are written to `notification_logs` (status `FAILED`) without throwing unhandled exceptions.
- `FIX-016`: Expand announcement audience validation to include `TEACHER` and `STUDENT`.
- `FIX-018`: Implement database schema and endpoints for `notification_replies`.

### 36.2 Functional Fixes (P1)
- `FIX-001`: Standardize student and teacher Excel templates.
- `FIX-004`: Complete bulk student Excel import pipeline with dry-run preview.
- `FIX-005`: Enable bulk welcome email triggering for students and faculty.
- `FIX-007`: Implement bulk teacher Excel import pipeline.
- `FIX-008`: Implement offline attendance Excel import and preview.
- `FIX-009`: Add Class and Section filters to `AttendanceReports.tsx`.
- `FIX-010`: Add native `.xlsx` attendance report export.
- `FIX-011`: Construct Centralized Mail Management module.
- `FIX-013`: Implement failed email queue and one-click resend.
- `FIX-014`: Decouple notices from announcements.
- `FIX-015`: Add multi-part file attachment handling for notices.
- `FIX-017`: Implement faculty notifications inbox.

### 36.3 Data & Database Fixes
- Execute migration `034_task1_enhancements.sql` adding `first_name`, `last_name`, `full_name` to `students`, and creating `notice_attachments`, `notification_replies`, `mail_drafts`.

### 36.4 Security Fixes
- `TC-SEC-001`: Add formula injection sanitization to spreadsheet parser.
- `TC-SEC-003`: Sanitize uploaded attachment filenames to deterministic UUIDs.

---

## 37. Risks & Mitigations

1. **SMTP Rate Limits & Cloud Port Blocks**:
   - *Risk*: Render Free Tier blocks outbound SMTP ports 25, 465, and 587. Sending high-volume bulk emails can cause socket timeouts.
   - *Mitigation*: Support HTTPS Email APIs (Brevo / Resend over port 443) and batch bulk emails into chunks of 25 with 500ms intervals.
2. **Spreadsheet Memory Overhead**:
   - *Risk*: Parsing extremely large spreadsheets (10,000+ rows) in Node.js memory could trigger heap exhaustion.
   - *Mitigation*: Cap file uploads at 10MB; stream parse files with SheetJS; limit bulk import batches to 1,000 students per file.
3. **Partial Database Commit on Failure**:
   - *Risk*: Server crash halfway through inserting a 200-student batch leaves orphan user accounts.
   - *Mitigation*: Wrap all batch database inserts in a single PostgreSQL `BEGIN ... COMMIT` block.

---

## 38. Dependencies

- **`xlsx` (SheetJS)** / **`exceljs`**: Spreadsheet parsing, cell styling, and template generation.
- **`multer`**: Multipart file upload handling with memory/disk storage.
- **`nodemailer`**: Transactional SMTP email dispatch.
- **`pg`**: PostgreSQL client pool executing transactional migrations and queries.
- **Cloud Firestore SDK (`firebase-admin`)**: Real-time document store synchronization.

---

## 39. Acceptance Criteria

1. **Student Onboarding**:
   - Admin can download a sample `.xlsx` file, populate 50 rows, upload it, view an interactive preview with zero validation errors, and commit it to the database in $< 2\text{ seconds}$.
   - Every student row is persisted with `full_name` computed from `first_name` and `last_name`, and bound to an active `academic_year_id`.
2. **Attendance Reports**:
   - Admin can filter attendance records simultaneously by Academic Session, Class Grade, Section, and Date Range.
   - Admin can download a styled `.xlsx` attendance spreadsheet containing student totals and percentage columns.
3. **Mail Center**:
   - Admin can compose and send individual or bulk broadcast emails.
   - In case of SMTP delivery error, the failure is visible in the Failed Mail queue with a working "Resend" button.
4. **Notice & Replies**:
   - Admin can publish a notice with a 5MB PDF attachment.
   - Parent can view the notice on the Parent Portal and submit a text reply.
   - Admin can view the reply with the parent's name, student name, class, section, and timestamp.

---

## 40. Final Implementation Checklist & Summary Metrics

### Implementation Readiness Checklist
- [x] Architecture & Flowcharts Verified
- [x] Database Schema Migration Script (`034_task1_enhancements.sql`) Formulated
- [x] 64 Requirements & Features Fully Classified
- [x] 18 Fix Blueprints Documented with File References
- [x] 26 Concrete Test Scenarios Formulated (Positive, Negative, Edge, Security, Performance)
- [x] Full Traceability Matrix Established

```text
================================================================================
ATTENDO SCHOOL — TASK-001 SPECIFICATION AUDIT METRICS
================================================================================
Total Requirements:              64
Total Features:                  64
Implemented Features:            18 (28.1%)
Partially Implemented:           21 (32.8%)
Broken:                           3 ( 4.7%) [FEAT-003, FEAT-012, FEAT-058]
Missing:                         22 (34.4%)
Recommended:                      0

Total Fixes:                     18 (FIX-001 to FIX-018)
P0:                               6 (FIX-002, FIX-003, FIX-006, FIX-016, FIX-018, FIX-058)
P1:                              10 (FIX-001, FIX-004, FIX-005, FIX-007, FIX-008, FIX-009, FIX-010, FIX-011, FIX-013, FIX-014, FIX-015, FIX-017)
P2:                               2 (FIX-012, FIX-005)
P3:                               0

Positive Test Cases:              8 (TC-POS-001 to TC-POS-008)
Negative Test Cases:              6 (TC-NEG-001 to TC-NEG-006)
Edge Test Cases:                  5 (TC-EDGE-001 to TC-EDGE-005)
Security Test Cases:              4 (TC-SEC-001 to TC-SEC-004)
Performance Test Cases:           3 (TC-PERF-001 to TC-PERF-003)

Critical Risks:                   3 (SMTP Port Blocks, Spreadsheet Heap Exhaustion, Partial Commits)
Critical Dependencies:            5 (xlsx/exceljs, multer, nodemailer, pg, firebase-admin)
Database Changes Required:        Migration 034_task1_enhancements.sql (4 new tables/columns)
API Changes Required:             10 New Endpoints (Template, Validate, Confirm, Replies, Mail)
Frontend Changes Required:        3 New Pages / Modals (StudentImportModal, MailManagement, ReplyThread)
Backend Changes Required:         ExcelParserService, MailQueueService, NoticeReplyService
SMTP Changes Required:            Port 587 TLS / Port 443 HTTPS Email API Fallback
================================================================================
```

---

*End of TASK-001 Specification Document — AttendO School Platform.*
