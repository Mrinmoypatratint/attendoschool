# AttendoSchool — Enterprise Architecture & System Documentation

> A production-ready, multi-tenant SaaS platform for school attendance automation, timetable planning, multi-channel parent communication (SMS, WhatsApp, Email), student promotions, and subscription lifecycle management with Indian GST compliance.

---

## Table of Contents

- [1. Executive Summary](#1-executive-summary)
- [2. Project Overview](#2-project-overview)
- [3. Problem Statement](#3-problem-statement)
- [4. Objectives](#4-objectives)
- [5. Target Users](#5-target-users)
- [6. Key Features](#6-key-features)
- [7. System Architecture](#7-system-architecture)
- [8. Architecture Diagrams](#8-architecture-diagrams)
  - [8.1 High-Level System Architecture](#81-high-level-system-architecture)
  - [8.2 Detailed Backend Request Pipeline](#82-detailed-backend-request-pipeline)
  - [8.3 Frontend Architecture & State Flow](#83-frontend-architecture--state-flow)
  - [8.4 Core Authentication Flow](#84-core-authentication-flow)
- [9. Application Flow](#9-application-flow)
- [10. Technology Stack](#10-technology-stack)
- [11. Project Structure](#11-project-structure)
- [12. Frontend Architecture](#12-frontend-architecture)
- [13. Backend Architecture](#13-backend-architecture)
- [14. Database Architecture](#14-database-architecture)
- [15. Database Schema](#15-database-schema)
- [16. Entity Relationship Diagram](#16-entity-relationship-diagram)
- [17. Authentication & Authorization](#17-authentication--authorization)
- [18. Roles & Permissions](#18-roles--permissions)
- [19. API Documentation](#19-api-documentation)
  - [19.1 Authentication & Health](#191-authentication--health)
  - [19.2 School & Master Academic Data](#192-school--master-academic-data)
  - [19.3 Teacher & Daily Attendance Operations](#193-teacher--daily-attendance-operations)
  - [19.4 Academic Years & Sessions](#194-academic-years--sessions)
  - [19.5 Student Promotions](#195-student-promotions)
  - [19.6 Attendance Corrections & Auditing](#196-attendance-corrections--auditing)
  - [19.7 Attendance Reports & Analytics](#197-attendance-reports--analytics)
  - [19.8 Advanced Timetable & Substitute Allocation](#198-advanced-timetable--substitute-allocation)
  - [19.9 Parent Portal & Onboarding](#199-parent-portal--onboarding)
  - [19.10 Communications & Announcements](#1910-communications--announcements)
  - [19.11 Offline Attendance Synchronization](#1911-offline-attendance-synchronization)
  - [19.12 Granular Roles & RBAC](#1912-granular-roles--rbac)
  - [19.13 Subscriptions, Billing & GST Invoices](#1913-subscriptions-billing--gst-invoices)
  - [19.14 Payments & Razorpay Integration](#1914-payments--razorpay-integration)
  - [19.15 Disaster Recovery & Backups](#1915-disaster-recovery--backups)
  - [19.16 Security Hardening & Session Management](#1916-security-hardening--session-management)
  - [19.17 Super Admin Operations & Monitoring](#1917-super-admin-operations--monitoring)
  - [19.18 Production & Health Probes](#1918-production--health-probes)
  - [19.19 Student Portal & Academic Operations](#1919-student-portal--academic-operations)
- [20. API Authentication](#20-api-authentication)
- [21. Third-Party Integrations](#21-third-party-integrations)
- [22. Environment Variables](#22-environment-variables)
- [23. Security Audit & Findings](#23-security-audit--findings)
- [24. Performance Review](#24-performance-review)
- [25. Error Handling](#25-error-handling)
- [26. Logging & Monitoring](#26-logging--monitoring)
- [27. Testing](#27-testing)
- [28. Development Setup](#28-development-setup)
- [29. Installation](#29-installation)
- [30. Database Setup & Migrations](#30-database-setup--migrations)
- [31. Running the Application](#31-running-the-application)
- [32. Build & Production](#32-build--production)
- [33. Deployment Architecture](#33-deployment-architecture)
- [34. CI/CD](#34-cicd)
- [35. Major Business Workflows](#35-major-business-workflows)
  - [35.1 Daily Classroom Attendance Workflow](#351-daily-classroom-attendance-workflow)
  - [35.2 Absence Notification Pipeline](#352-absence-notification-pipeline)
  - [35.3 SaaS Subscription Checkout & GST Invoicing](#353-saas-subscription-checkout--gst-invoicing)
  - [35.4 Academic Year Batch Student Promotion](#354-academic-year-batch-student-promotion)
  - [35.5 Timetable Conflict Detection](#355-timetable-conflict-detection)
- [36. Known Issues & Discrepancies](#36-known-issues--discrepancies)
- [37. Technical Debt](#37-technical-debt)
- [38. Future Improvements](#38-future-improvements)
- [39. Project Status Matrix](#39-project-status-matrix)
- [40. Troubleshooting](#40-troubleshooting)
- [41. Developer Guide](#41-developer-guide)
- [42. Contribution Guidelines](#42-contribution-guidelines)
- [43. Glossary](#43-glossary)
- [44. Conclusion](#44-conclusion)

---

## 1. Executive Summary

**AttendoSchool** (internal package name `school-attendance-saas`) is an enterprise educational administration and student presence tracking software platform. The system operates as a **multi-tenant Software-as-a-Service (SaaS)** solution designed to serve educational institutions (K-12 schools, multi-branch networks, and colleges).

The core value proposition centers on eliminating administrative overhead in attendance recording, guaranteeing instantaneous notification to guardians when a student is absent, preventing unauthorized attendance tampering through audit-trailed correction requests, managing routine and timetable conflict resolution, providing dedicated student and parent portals with multi-tenant login resolution, and providing commercial SaaS subscription billing with automated Indian GST tax invoicing.

The application is structured as a decoupled **Client-Server Architecture** comprising a Single Page Application (SPA) frontend built on React 19 and Vite 7, a RESTful backend API powered by Express 5 and TypeScript running on Node.js (tested on Node 20.x, 24.x), and a **dual-database persistence architecture** supporting **Firebase Cloud Firestore** (with local emulator support for zero-config offline development) alongside an enterprise **PostgreSQL 16** relational persistence layer consisting of 67 tables managed through 29 incremental migration files.

---

## 2. Project Overview

AttendoSchool provides end-to-end digitisation of daily academic routines and school operations:

- **Institutional Onboarding**: Schools are registered on the platform with distinct identifiers (`school_id`), contact information, administrative credentials, and assigned subscription tiers (`Basic`, `Standard`, `Enterprise`).
- **Data Isolation**: Strict multi-tenancy is enforced at the database level using `school_id` foreign keys and within the backend API routing layer.
- **Roster & Academic Structure**: School administrators configure Academic Years, Classes (Class 1 to 12), Sections (A, B, C...), Subjects, Students, and Teachers. Bulk Excel/CSV upload is natively implemented for student and faculty onboarding.
- **Rapid Classroom Attendance**: Teachers log into a mobile-friendly interface displaying their assigned timetable slots for the current calendar day. Present students are confirmed with bulk controls; unmarked students are flagged absent upon submission.
- **Automated Absence Dispatch**: When attendance is finalized, background queueing engines trigger SMS, WhatsApp, and Email alerts to guardians with dynamic token variables.
- **Audit-Controlled Corrections**: Teachers cannot silently change attendance records after submission. Formal correction tickets must be submitted, justified with notes, and reviewed by the School Administrator.
- **Subscription Billing**: The platform includes integrated plan enforcement, mock sandbox payments, Razorpay checkout integration, automated 18% GST calculation (split into 9% CGST + 9% SGST), and downloadable PDF tax invoices generated via PDFKit.
- **Offline Reliability**: An IndexedDB/localStorage queue mechanism allows teachers in low-connectivity areas to take attendance offline and automatically synchronize upon reconnecting.

---

## 3. Problem Statement

Educational institutions face recurring operational inefficiencies:

1. **Manual Roll Calls & Paper Registers**: Traditional paper-based attendance wastes 5–10 minutes per period and lacks historical visibility.
2. **Delayed Parent Notification**: Guardians often discover absences days later, preventing timely intervention.
3. **Record Tampering & Lack of Auditing**: Paper logs or unversioned spreadsheets allow retroactive modifications without an audit trail.
4. **Academic Year Transitions**: Moving hundreds of students between grades at the end of an academic session is error-prone and time-consuming.
5. **Billing and Subscription Friction**: EdTech SaaS providers struggle with GST-compliant billing, multi-tenant quota enforcement, and tracking subscription expiries.
6. **Network Vulnerability in Rural/Semi-Urban Schools**: School campuses frequently experience intermittent internet connectivity, disabling purely cloud-dependent tools.

---

## 4. Objectives

The AttendoSchool platform was developed to fulfill the following measurable technical and business goals:

- **Sub-15-Second Attendance Submission**: Allow classroom teachers to record an entire class roster (50+ students) in under 15 seconds.
- **Immediate Parent Alerts**: Queue absence notifications within 500ms of attendance submission.
- **Zero Silent Edits**: Record all post-submission modifications in `attendance_correction_audit` with timestamps and reviewer IDs.
- **Deterministic Batch Promotions**: Support one-click bulk promotion (`PROMOTED`, `RETAINED`, `GRADUATED`, `TRANSFERRED`) across academic years.
- **Statutory GST Billing Compliance**: Automatically generate tax invoices containing HSN/SAC codes, CGST (9%), SGST (9%), and school GSTIN numbers.
- **Offline Resilience**: Allow offline attendance storage and batch synchronization with idempotency checks.

---

## 5. Target Users

The platform implements 4 primary user roles defined in the PostgreSQL database enum `user_role`:

| Role Key | Name | Access Level | Primary Objectives |
|---|---|---|---|
| `SUPER_ADMIN` | Platform Super Administrator | Global (Platform-wide) | Onboard new schools, manage subscription plans, monitor revenue, trigger system backups, execute database health diagnostics, inspect audit logs. |
| `SCHOOL_ADMIN` | Institutional Principal / Administrator | Tenant-specific (`school_id`) | Configure academic years, manage teacher/student directories, assign routines, review attendance correction requests, broadcast announcements, manage school billing. |
| `TEACHER` | Classroom Teacher / Instructor | Tenant-specific (`school_id`) | View assigned timetable slots, mark attendance, submit attendance correction tickets, view classroom attendance history, utilize offline mode. |
| `PARENT` | Student Guardian / Parent | Tenant-specific (`school_id`) | View linked children's daily attendance records, monitor attendance percentage, read school announcements and notices. |

---

## 6. Key Features

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ATTENDOSCHOOL PLATFORM                            │
├──────────────────────┬──────────────────────┬───────────────────────────────┤
│ Academic Management  │ Daily Operations     │ SaaS Administration & Billing │
├──────────────────────┼──────────────────────┼───────────────────────────────┤
│ · Academic Years     │ · Quick Attendance   │ · Multi-Tenant Isolation      │
│ · Student Promotion  │ · Absence Alerts     │ · Plan Limits & Quotas        │
│ · Class & Section    │ · Offline Sync Engine│ · Mock & Razorpay Payments    │
│ · Timetable Engine   │ · Attendance Audits  │ · PDF Invoicing with 18% GST  │
│ · Conflict Detection │ · Parent Portal      │ · Automated Backups & Checks  │
│ · People Management  │ · Broadcast Notices  │ · Granular RBAC Permissions   │
└──────────────────────┴──────────────────────┴───────────────────────────────┘
```

1. **Multi-Tenant Foundation**: Complete operational isolation between different schools using PostgreSQL relational foreign keys.
2. **Speed-Optimized Attendance**: Teachers submit attendance with instant toggle controls.
3. **Absence Notification Pipeline**: Pluggable notification engine supporting SMS (HTTP & Mock), WhatsApp, and Email with template interpolation (`{student_name}`, `{class_name}`, `{time}`, etc.).
4. **Offline Attendance Queue**: Teacher devices store attendance batches locally in `localStorage` when offline and push to `/api/offline-attendance/sync` when online.
5. **Audited Correction System**: Formal workflow for teachers to request modifications to locked attendance records, requiring School Admin approval.
6. **Timetable & Conflict Engine**: Scheduling engine that maps teachers, classes, subjects, rooms, and periods while detecting room and teacher scheduling conflicts.
7. **Session Management & Student Promotions**: Academic year activation and batch promotion of students into new sessions with retention and graduation tracking.
8. **Subscription & GST Engine**: Tiered subscriptions (`Basic`, `Standard`, `Enterprise`) with automatic 18% GST calculation (9% CGST + 9% SGST), Razorpay webhook support, and PDF invoice generation via PDFKit.
9. **Disaster Recovery & Database Backups**: On-demand and scheduled `pg_dump` execution, SHA-256 integrity checksum verification, and retention cleanup.
10. **Security Hardening**: Exponential login failure tracking (5 failed attempts locks account for 15 minutes), refresh session tracking, and HTTP security headers (`nosniff`, `DENY` frames).

---

## 7. System Architecture

AttendoSchool follows a **Decoupled Modular Client-Server Architecture**:

- **Frontend Tier**: Single Page Application built on React 19, React Router 7, and Vite 7. Styling is delivered via custom Vanilla CSS (`frontend/src/styles.css`) featuring native CSS variables, responsive layouts, and dark/light theme switching.
- **API / Application Tier**: Express 5 application written in TypeScript (`backend/src/server.ts`, `backend/src/app.ts`). Express 5 routing handles requests, passes them through global security middleware, verifies JWT bearer tokens, enforces tenant isolation, and dispatches to route modules and service handlers.
- **Persistence Tier**: Dual persistence architecture:
  - **Firebase Cloud Firestore**: Cloud NoSQL document store and local Firebase Emulator suite (`127.0.0.1:8080`, Web UI `127.0.0.1:4000/firestore`) initialized via `firebase-admin` (`backend/src/firebase.ts`).
  - **PostgreSQL 16**: Relational database running with connection pooling via the `pg` driver (`backend/src/db.ts`). Database migrations are tracked across 28 sequential SQL files (`database/migrations/`).
- **Worker / Background Tier**: Asynchronous background jobs (`smsWorker.ts`, `notificationWorker.ts`, `subscriptionWorker.ts`, `productionWorker.ts`) execute decoupled tasks like queue processing and subscription expiry synchronization.

---

## 8. Architecture Diagrams

### 8.1 High-Level System Architecture

```mermaid
flowchart TD
    subgraph Clients["Client Layer"]
        B_Admin["School Admin (Browser)"]
        B_Teacher["Teacher (Desktop / Mobile PWA)"]
        B_Super["Super Admin (Console)"]
        B_Parent["Parent (Portal / SMS / WA)"]
        B_Student["Student (Portal / Dashboard / Mobile PWA)"]
    end

    subgraph ReverseProxy["Ingress & Gateway Layer"]
        NGINX["Nginx 1.27 Reverse Proxy (Port 80 / 443)"]
    end

    subgraph FrontendApp["Frontend Tier (Vite / React 19)"]
        SPA["React SPA (Port 5173 / dist)"]
        Theme["Theme Context & CSS Vars"]
        AuthCtx["Auth Context & Token Store"]
        OfflineQ["Offline Storage Queue"]
    end

    subgraph BackendApp["Backend Tier (Node.js / Express 5)"]
        AppServer["Express 5 REST API (Port 5000)"]
        SecMW["Security Headers & Rate Limiting"]
        AuthMW["JWT Auth & Role Enforcement"]
        SubMW["Subscription Enforcement MW"]
        
        subgraph Services["Core Business Services"]
            S_FS["Firestore Service (CRUD / Collections)"]
            S_Att["Attendance & Correction Service"]
            S_Time["Timetable & Conflict Engine"]
            S_Promo["Student Promotion Service"]
            S_Pay["Payment & Invoicing Service"]
            S_Notif["Notification & SMS Dispatcher"]
            S_Sec["Security & Audit Service"]
            S_Back["Backup & Disaster Recovery"]
            S_Student["Student Portal & Academic Service"]
        end
    end

    subgraph BackgroundWorkers["Background Worker Engines"]
        W_SMS["SMS Queue Worker"]
        W_Notif["Notification Delivery Worker"]
        W_Sub["Subscription Expiry Worker"]
        W_Prod["Production Maintenance Worker"]
    end

    subgraph DatabaseTier["Dual Persistence Layer"]
        FS[("Firebase Cloud Firestore\n(Local Emulator: 8080 / Cloud)\nDocument Collections")]
        PG[("PostgreSQL 16 Database\n(school_attendance)\n67 Tables")]
    end

    subgraph ExternalServices["External Providers & Integrations"]
        Ext_Razorpay["Razorpay Payment Gateway"]
        Ext_SMTP["SMTP Mail Server"]
        Ext_SMS["External SMS Gateway (HTTP)"]
    end

    Clients --> NGINX
    NGINX -->|"/api/*"| AppServer
    NGINX -->|"/*"| SPA

    SPA -->|Axios REST| AppServer
    AppServer --> SecMW --> AuthMW --> SubMW --> Services
    Services --> FS
    Services --> PG

    BackgroundWorkers --> PG
    W_SMS --> Ext_SMS
    W_Notif --> Ext_SMTP
    S_Pay --> Ext_Razorpay
```

### 8.2 Detailed Backend Request Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor Client as HTTP Client (Axios / Browser)
    participant Sec as Security & RateLimit MW
    participant Auth as requireAuth (JWT Verify)
    participant Role as requireRoles MW
    participant Sub as requireSubscription MW
    participant Route as Route Handler
    participant Svc as Business Service
    participant DB as PostgreSQL Connection Pool

    Client->>Sec: Incoming HTTP Request (e.g. POST /api/teacher/attendance)
    Sec->>Sec: Apply Headers (nosniff, DENY, Referrer Policy)
    Sec->>Sec: Check IP Bucket (120 req/min limit)
    Sec->>Auth: Pass to Auth Middleware
    
    Auth->>Auth: Extract Authorization: Bearer <token>
    Auth->>Auth: Verify JWT signature using JWT_SECRET
    alt Token Missing or Invalid
        Auth-->>Client: 401 Unauthorized
    else Token Valid
        Auth->>Auth: Populate req.user (id, schoolId, role)
        Auth->>Role: Pass to Role Guard
    end

    Role->>Role: Check if req.user.role matches allowed roles
    alt Role Not Authorized
        Role-->>Client: 403 Access Denied
    else Role Authorized
        Role->>Sub: Check Subscription (if applied)
    end

    opt Subscription Guarded Endpoint
        Sub->>DB: Check school_subscriptions status & end_date
        alt Subscription Expired / Inactive
            Sub-->>Client: 402 Payment Required
        end
    end

    Sub->>Route: Dispatch to Route Controller
    Route->>Svc: Invoke Business Logic Method
    Svc->>DB: Query Database with Parameterized SQL ($1, $2)
    DB-->>Svc: Query Results
    Svc-->>Route: Formatted DTO / Result
    Route-->>Client: HTTP 200/201 JSON Response
```

### 8.3 Frontend Architecture & State Flow

```mermaid
flowchart LR
    subgraph UI["View Layer (React Components)"]
        Dashboard["Dashboard View"]
        TakeAttendance["Take Attendance View"]
        TimetablePage["Timetable Management"]
        PeoplePage["People Management"]
        PromoPage["Student Promotion"]
        BillingPage["Subscription & Invoicing"]
        ReportsPage["Attendance Reports"]
    end

    subgraph State["State & Context Providers"]
        AuthProvider["AuthProvider (useAuth)"]
        ThemeEngine["Theme Manager (useTheme)"]
        OfflineQueue["Offline Attendance Queue"]
        LocalCache["LocalStorage (Tokens & Queue)"]
    end

    subgraph Transport["Transport Layer"]
        AxiosClient["Axios Instance (api.ts)"]
        Interceptors["JWT Request Interceptor"]
    end

    subgraph Server["Backend API"]
        API["Express 5 REST Endpoints"]
    end

    UI --> AuthProvider
    UI --> ThemeEngine
    UI --> OfflineQueue
    OfflineQueue <--> LocalCache
    AuthProvider <--> LocalCache

    UI --> AxiosClient
    AxiosClient --> Interceptors
    Interceptors -->|Bearer Authorization| API
```

### 8.4 Core Authentication Flow

```mermaid
sequenceDiagram
    actor User as User (Super Admin / School Admin / Teacher / Parent / Student)
    participant UI as Login Component (React)
    participant AuthAPI as Auth Route (/api/auth)
    participant DB as PostgreSQL (schools & users)
    participant Fallback as In-Memory Demo Store
    participant Storage as Browser LocalStorage

    UI->>AuthAPI: GET /api/auth/institutes
    AuthAPI->>DB: SELECT id, name, code FROM schools WHERE status='ACTIVE'
    DB-->>AuthAPI: Institute List (or Fallback demoSchools)
    AuthAPI-->>UI: 200 OK [{ id, name, code }]

    User->>UI: Select Institute, Enter Email/Student ID & Password
    UI->>AuthAPI: POST /api/auth/login { instituteId, email, password }
    
    AuthAPI->>DB: SELECT * FROM users WHERE LOWER(email)=LOWER($1) (or student roll_number lookup)
    alt User Found in DB
        AuthAPI->>AuthAPI: Verify school_id === instituteId (Tenant Isolation Guard)
        AuthAPI->>AuthAPI: bcrypt.compare(password, password_hash)
        alt Password Matches & is_active = true
            AuthAPI->>AuthAPI: jwt.sign(user, JWT_SECRET, { expiresIn: '8h' })
            AuthAPI-->>UI: 200 OK { token, user: { id, schoolId, role, studentProfile... } }
        else Password Mismatch or Tenant Mismatch
            AuthAPI-->>UI: 401 Invalid email/credentials or school mismatch
        end
    else DB Query Throws / DB Disconnected
        AuthAPI->>Fallback: findDemoUser(email/identifier, instituteId)
        alt In-Memory Demo User Exists & Password Matches
            AuthAPI->>AuthAPI: jwt.sign(demoUser, JWT_SECRET, { expiresIn: '8h' })
            AuthAPI-->>UI: 200 OK { token, user }
        else Demo User Not Found
            AuthAPI-->>UI: 401 Invalid credentials
        end
    end

    opt On Successful Login
        UI->>Storage: Store attendance_token & attendance_user
        alt Role is STUDENT
            UI->>User: Redirect to /student/dashboard
        else Role is PARENT
            UI->>User: Redirect to /parent
        else Role is ADMIN or TEACHER
            UI->>User: Redirect to /dashboard
        end
    end
```

---

## 9. Application Flow

The standard operational flow across the platform progresses through four sequential phases:

```
[Phase 1: Institutional Provisioning]
Super Admin registers School -> Assigns Subscription Plan -> Creates School Admin

[Phase 2: Academic Configuration]
School Admin activates Academic Year -> Creates Classes & Sections -> Adds Subjects ->
Registers Teachers & Students -> Schedules Timetable Entries & Routines

[Phase 3: Daily Execution]
Teacher logs in -> System fetches today's routine slots -> Teacher marks attendance ->
Transaction commits attendance_records -> Event triggers SMS & Notification Queues ->
Absence alerts sent to parents

[Phase 4: Auditing, Governance & Billing]
Teacher submits correction requests if error occurred -> Admin approves/rejects ->
Subscription expiry tracked by worker -> Renewal order created via Mock/Razorpay ->
GST Invoice & Receipt generated with PDF download
```

---

## 10. Technology Stack

| Category | Technology | Version | Purpose & Usage in Codebase |
|---|---|---|---|
| **Frontend Framework** | React | `^19.1.1` | Core UI component library (`frontend/package.json`) |
| **Frontend DOM** | React DOM | `^19.1.1` | React DOM renderer |
| **Frontend Routing** | React Router DOM | `^7.8.2` | Client-side SPA routing and navigation guards |
| **Build Tool & Dev Server**| Vite | `^7.1.3` (running `7.3.6`) | Fast frontend bundler and dev server |
| **Icons Library** | Lucide React | `^0.468.0` | UI iconography across all views |
| **Spreadsheet Parsing** | XLSX | `^0.18.5` | Client-side Excel/CSV parsing for bulk roster import |
| **HTTP Client** | Axios | `^1.11.0` | Frontend HTTP transport with JWT interceptor |
| **Frontend Styling** | Vanilla CSS | CSS3 Custom Properties | Design system, responsive layout, dark/light themes |
| **Backend Runtime** | Node.js | `20-alpine` (Docker) / `v24.19.0` (Host) | JavaScript runtime environment |
| **Backend Framework** | Express | `^5.1.0` | REST API routing and middleware pipeline |
| **Language** | TypeScript | `^5.9.2` | Type definitions and compilation for backend & frontend |
| **TypeScript Execution**| tsx | `^4.20.3` | Fast TypeScript watch & execution runner for backend |
| **Firebase Admin SDK** | `firebase-admin` | `^14.4.0` | Cloud Firestore initialization, collections & document CRUD (`backend/package.json`) |
| **Firebase CLI / Tools**| `firebase-tools` | `v15.28.2` | Local Firestore Emulator suite & web UI (`firebase.json`, `firestore.rules`) |
| **Primary Document DB** | Firebase Cloud Firestore | Emulator / Cloud | Document store for schools, users, rosters, sessions, and subscriptions |
| **Relational Database** | PostgreSQL | `16-alpine` | Relational multi-tenant engine (62 tables) |
| **Database Driver (PG)** | pg (node-postgres) | `^8.16.3` | PostgreSQL connection pooling and parameterized query client |
| **Authentication** | JSON Web Tokens (`jsonwebtoken`) | `^9.0.2` | Stateless HMAC-SHA256 bearer token issuance & validation |
| **Password Hashing** | bcryptjs | `^3.0.2` | Salted password hashing (cost factor 10) |
| **PDF Generation** | PDFKit | `^0.16.0` | Server-side generation of Indian GST tax invoices |
| **Email Transport** | Nodemailer | `^7.0.6` | SMTP email transport for notifications and invoice dispatch |
| **CORS Middleware** | cors | `^2.8.5` | Cross-Origin Resource Sharing handling |
| **Env Configuration** | dotenv | `^17.2.1` | Loading environment variables from `.env` |
| **Web Server / Proxy** | Nginx | `1.27-alpine` | Containerized reverse proxy and static asset server |
| **E2E Testing** | Playwright | Configured in `playwright.config.ts` | End-to-end browser automation smoke testing |
| **Containerization** | Docker / Compose | Compose spec `3.9` | Production and development multi-container orchestration |

---

## 11. Project Structure

```
attendoschool/
├── .env                             # Root environment configuration (Emulator & local ports)
├── .env.production.example          # Production environment template
├── .firebaserc                      # Firebase project selector (attendoschool-saas)
├── .gitignore                       # Git exclusion rules
├── CLOUD-DEPLOYMENT-GUIDE.md        # Cloud setup documentation (Vercel/Render/Neon)
├── DOCUMENTATION.md                 # System Architecture & Technical Documentation
├── PRODUCTION-DEPLOYMENT.md         # On-premise / Docker deployment runbook
├── README.md                        # Project introduction, feature overview & quick start
├── SETUP.md                         # Detailed developer setup, emulator & operational guide
├── docker-compose.yml               # Local development PostgreSQL container configuration
├── docker-compose.production.yml    # Production multi-service Docker Compose (Nginx + Apps + DB)
├── firebase.json                    # Firebase Emulator suite config (Firestore: 8080, UI: 4000)
├── firestore.rules                  # Cloud Firestore security rules
├── playwright.config.ts             # Playwright configuration for E2E testing
├── render.yaml                      # Render.com Blueprint configuration (Web + Managed DB)
│
├── backend/                         # Backend Application Root
│   ├── .env.example                 # Backend environment variable template
│   ├── Dockerfile                   # Multi-stage production build (Node 20 Alpine)
│   ├── Procfile                     # Process file for Render / Heroku deployment
│   ├── package.json                 # Backend dependencies and execution scripts
│   ├── tsconfig.json                # TypeScript compiler configuration
│   ├── src/                         # Backend Source Code
│   │   ├── app.ts                   # Express application setup, security middleware, route mounts
│   │   ├── server.ts                # Server entry point & graceful shutdown handlers
│   │   ├── db.ts                    # PostgreSQL connection pool with cloud SSL detection
│   │   ├── firebase.ts              # Firebase Admin SDK & Cloud Firestore initialization
│   │   ├── config/
│   │   │   └── env.ts               # Centralized environment variable accessor with defaults
│   │   ├── middleware/
│   │   │   ├── auth.ts              # JWT verification (`requireAuth`) & role guard (`requireRoles`)
│   │   │   ├── security.ts          # Security headers, requestContext, and IP rate limiter
│   │   │   └── subscriptionEnforcement.ts # Checks school subscription validity on protected operations
│   │   ├── routes/                  # 33 modular Express route controllers (includes student.ts)
│   │   ├── services/                # Business logic and data access services (includes firestoreService.ts, studentService.ts)
│   │   ├── types/
│   │   │   └── firestoreSchema.ts   # Typed interfaces for Firestore collections
│   │   ├── store/
│   │   │   └── demoUsers.ts         # In-memory user fallback store with student demo user
│   │   ├── scripts/
│   │   │   ├── migrate.ts           # PostgreSQL migration runner
│   │   │   └── seedFirestore.ts     # Cloud Firestore seeder script (`npm run seed:firestore`)
│   │   └── workers/                 # Consolidated background workers
│   │       ├── notificationWorker.ts# Background worker for multi-channel notifications
│   │       ├── smsWorker.ts         # Background worker for SMS queue processing
│   │       ├── subscriptionWorker.ts# Background worker for subscription status synchronization
│   │       └── productionWorker.ts  # Master maintenance worker (cleanups, retentions, subscriptions)
│   └── tests/                       # Backend test suites
│       ├── student-portal-e2e.ts    # 41-assertion automated student portal & RBAC test suite
│       ├── comprehensive-test-suite.ts # 50-assertion automated validation suite
│       ├── automated-e2e-journey.ts    # End-to-end multi-tenant lifecycle journey
│       ├── deep-feature-e2e-test.ts    # Deep API feature regression tests
│       ├── manual-feature-audit.ts     # Manual verification helper
│       ├── test-admin-endpoints.js     # Legacy admin endpoint verification
│       ├── verify-live-stack.ts        # Live stack connection tester
│       └── verify-new-features.ts      # Verifies feature additions
│
├── frontend/                        # Frontend Single Page Application Root
│   ├── .env.example                 # Frontend environment template (API URL)
│   ├── .env.production.example      # Frontend production environment template
│   ├── Dockerfile                   # Multi-stage build (Vite build -> Nginx 1.27 Alpine)
│   ├── nginx.conf                   # Nginx SPA rewrite configuration
│   ├── index.html                   # HTML5 document root with PWA meta tags
│   ├── package.json                 # Frontend dependencies and Vite scripts
│   ├── tsconfig.json                # TypeScript configuration
│   ├── vercel.json                  # Vercel SPA rewrite rule
│   ├── vite.config.ts               # Vite bundler configuration with React plugin
│   ├── public/                      # Static web assets
│   │   ├── attendo-school-logo.png  # Official full uncropped brand logo
│   │   ├── educational_student_campus.jpg # Login hero image
│   │   ├── manifest.webmanifest     # PWA manifest
│   │   ├── sw.js                    # Service worker stub
│   │   └── _redirects               # Netlify SPA rewrite configuration
│   └── src/                         # Frontend React Components & Modules
│       ├── main.tsx                 # React DOM mount point (`createRoot`)
│       ├── App.tsx                  # Split-screen Login UI, master routing & core view components
│       ├── api.ts                   # Axios HTTP client with JWT interceptor & auto-base URL
│       ├── styles.css               # Comprehensive custom design system (Vanilla CSS)
│       ├── components/
│       │   ├── Toast.tsx            # Global toast notifications
│       │   ├── ThreeDBackground.tsx # Interactive background effects
│       │   ├── HandwritingQuoteTyping.tsx # Dynamic quote animator
│       │   └── student/
│       │       └── StudentLayout.tsx# Dedicated Student Portal ERP sidebar & topbar layout
│       ├── hooks/
│       │   └── useAuth.tsx          # AuthContext with STUDENT role, AuthProvider, RoleGuard
│       ├── services/
│       │   ├── studentApi.ts        # Dedicated API client for Student Portal endpoints
│       │   └── offlineAttendanceQueue.ts # LocalStorage queue & sync dispatcher
│       ├── super-admin/             # Super Admin Platform Management
│       │   ├── SuperAdminModule.tsx # Super Admin routes and sub-modules
│       │   └── SuperAdminLayout.tsx # Super Admin layout and navigation
│       └── pages/                   # Modular Page Components
│           ├── admin/               # School Administrator Management Pages
│           │   ├── AcademicYears.tsx        # Session creation & academic year activation view
│           │   ├── Analytics.tsx            # Attendance snapshots & rank analytics
│           │   ├── AttendanceCorrections.tsx# Formal attendance change request & audit view
│           │   ├── AttendanceReports.tsx    # Summary, student-wise, daily breakdown & Excel export
│           │   ├── Backup.tsx               # Database backup creation, restore testing & history
│           │   ├── Communication.tsx        # Announcements creation, publishing & recipient counts
│           │   ├── OfflineAttendance.tsx    # Offline attendance recording & batch sync UI
│           │   ├── ParentCommunication.tsx  # Parent notice inbox & read acknowledgements
│           │   ├── PeopleManagement.tsx     # Student & faculty directory, editing & bulk import
│           │   ├── Permissions.tsx          # System RBAC role assignment & custom permissions
│           │   ├── Security.tsx             # Password policy validator & security audit view
│           │   ├── StudentPromotion.tsx     # Batch promotion & retention engine between years
│           │   ├── SubscriptionEnforcement.tsx # Subscription plan status & feature quota view
│           │   └── Timetable.tsx            # Period timing, timetable matrix, conflict checker & substitutes
│           ├── auth/                # Authentication Flow Pages
│           │   └── ResetPassword.tsx        # Password setup & reset interface
│           ├── parent/              # Parent Guardian Portal Pages
│           │   └── ParentPortal.tsx         # Guardian student attendance tracking
│           └── student/             # Student Portal View Pages
│               ├── StudentDashboard.tsx    # High-fidelity dashboard with greeting, KPIs, routine, calendar
│               ├── StudentAttendance.tsx   # Detailed monthly attendance log, status badges, analytics
│               ├── StudentTimetable.tsx    # Weekly schedule grid organized by day of week
│               ├── StudentAssignments.tsx  # Pending & completed homework with submission modal
│               ├── StudentExams.tsx        # Upcoming exams, test dates, and published marksheets
│               ├── StudentAnnouncements.tsx# Institute notice feed with priority filtering
│               ├── StudentLeaveRequest.tsx # Leave application submission and approval tracker
│               └── StudentProfile.tsx      # Comprehensive student card & BCrypt password rotation
│
├── database/                        # Database Definition Root
│   ├── schema.sql                   # Base DDL schema definition
│   ├── seed.sql                     # Base initial seed data (Super Admin & Plans)
│   └── migrations/                  # 23 incremental migration SQL scripts (007 to 029)
│
├── deploy/                          # Production Deployment Configurations
│   └── nginx/
│       └── nginx.conf               # Multi-container reverse proxy configuration
│
├── scripts/                         # Operational Shell & Smoke Scripts
│   ├── backup.sh                    # Host database backup script
│   ├── migrate.sh                   # Migration execution trigger
│   ├── production-check.sh          # Pre-deployment host validation checklist
│   ├── integration-smoke.ts         # Integration test smoke script
│   └── api-smoke.ts                 # API verification smoke script
│
└── tests/                           # E2E Tests
    └── e2e/
        └── smoke.spec.ts            # Playwright application load test
```

---

## 12. Frontend Architecture

The frontend is an entirely client-rendered Single Page Application (SPA).

### Component & Page Mapping

| File Path | Component Name | Role Guards | Responsibilities |
|---|---|---|---|
| [frontend/src/App.tsx](file:///d:/Project_Abir/attendoschool/frontend/src/App.tsx) | `Login` | Public | Credential entry, show/hide password, error handling, JWT storage |
| [frontend/src/App.tsx](file:///d:/Project_Abir/attendoschool/frontend/src/App.tsx) | `Dashboard` | Authenticated | Role-specific landing dashboard (School Admin vs Super Admin) |
| [frontend/src/App.tsx](file:///d:/Project_Abir/attendoschool/frontend/src/App.tsx) | `Students` | Authenticated | Student directory, single creation, deletion, Excel bulk import |
| [frontend/src/App.tsx](file:///d:/Project_Abir/attendoschool/frontend/src/App.tsx) | `Teachers` | Authenticated | Faculty directory, credential provisioning, Excel bulk import |
| [frontend/src/App.tsx](file:///d:/Project_Abir/attendoschool/frontend/src/App.tsx) | `Classes` | Authenticated | Grade management (Class 1–12) and Section allocation |
| [frontend/src/App.tsx](file:///d:/Project_Abir/attendoschool/frontend/src/App.tsx) | `Subjects` | Authenticated | Subject curriculum catalog management |
| [frontend/src/App.tsx](file:///d:/Project_Abir/attendoschool/frontend/src/App.tsx) | `Routine` | Authenticated | Class routine slot mapping (day of week, start/end time, room) |
| [frontend/src/App.tsx](file:///d:/Project_Abir/attendoschool/frontend/src/App.tsx) | `Attendance` | Authenticated | Daily classroom attendance recording interface for teachers |
| [frontend/src/App.tsx](file:///d:/Project_Abir/attendoschool/frontend/src/App.tsx) | `History` | Authenticated | Teacher classroom attendance historical session log |
| [frontend/src/pages/admin/AttendanceReports.tsx](file:///d:/Project_Abir/attendoschool/frontend/src/pages/admin/AttendanceReports.tsx) | `AttendanceReports` | `SUPER_ADMIN`, `SCHOOL_ADMIN`, `TEACHER` | Date-range filters, attendance %, student absence tallies, Excel export |
| [frontend/src/pages/admin/AttendanceCorrections.tsx](file:///d:/Project_Abir/attendoschool/frontend/src/pages/admin/AttendanceCorrections.tsx) | `AttendanceCorrections`| `SCHOOL_ADMIN`, `TEACHER` | Requesting attendance edits & administrative review/approval |
| [frontend/src/pages/admin/PeopleManagement.tsx](file:///d:/Project_Abir/attendoschool/frontend/src/pages/admin/PeopleManagement.tsx) | `PeopleManagement` | `SUPER_ADMIN`, `SCHOOL_ADMIN` | Comprehensive student/faculty directory with status toggling |
| [frontend/src/pages/admin/AcademicYears.tsx](file:///d:/Project_Abir/attendoschool/frontend/src/pages/admin/AcademicYears.tsx) | `AcademicYears` | `SCHOOL_ADMIN` | Academic session creation, activation, archiving |
| [frontend/src/pages/admin/StudentPromotion.tsx](file:///d:/Project_Abir/attendoschool/frontend/src/pages/admin/StudentPromotion.tsx) | `StudentPromotion` | `SCHOOL_ADMIN` | Multi-student promotion workflow between sessions |
| [frontend/src/pages/parent/ParentPortal.tsx](file:///d:/Project_Abir/attendoschool/frontend/src/pages/parent/ParentPortal.tsx) | `ParentPortal` | `PARENT` | Guardian dashboard to inspect child attendance logs |
| [frontend/src/pages/admin/Permissions.tsx](file:///d:/Project_Abir/attendoschool/frontend/src/pages/admin/Permissions.tsx) | `Permissions` | `SUPER_ADMIN`, `SCHOOL_ADMIN` | Custom administrative role assignment and permission inspection |
| [frontend/src/pages/admin/SubscriptionEnforcement.tsx](file:///d:/Project_Abir/attendoschool/frontend/src/pages/admin/SubscriptionEnforcement.tsx) | `SubscriptionEnforcement` | `SUPER_ADMIN`, `SCHOOL_ADMIN` | Subscription status, student quota tracking, grace period display |
| [frontend/src/pages/admin/Security.tsx](file:///d:/Project_Abir/attendoschool/frontend/src/pages/admin/Security.tsx) | `Security` | `SUPER_ADMIN` | Password policy validation, audit events, session cleanup |
| [frontend/src/pages/admin/Backup.tsx](file:///d:/Project_Abir/attendoschool/frontend/src/pages/admin/Backup.tsx) | `Backup` | `SUPER_ADMIN`, `SCHOOL_ADMIN` | Database backup triggering, checksum inspection, restore testing |
| [frontend/src/pages/admin/Timetable.tsx](file:///d:/Project_Abir/attendoschool/frontend/src/pages/admin/Timetable.tsx) | `Timetable` | `SCHOOL_ADMIN`, `TEACHER` | Period definitions, timetable entries, substitute assignment |
| [frontend/src/pages/admin/OfflineAttendance.tsx](file:///d:/Project_Abir/attendoschool/frontend/src/pages/admin/OfflineAttendance.tsx) | `OfflineAttendance`| `TEACHER` | Offline roster attendance taker and queue sync status |
| [frontend/src/pages/admin/Analytics.tsx](file:///d:/Project_Abir/attendoschool/frontend/src/pages/admin/Analytics.tsx) | `Analytics` | `SUPER_ADMIN`, `SCHOOL_ADMIN` | Daily snapshots, presence trends, school-wide ranking |
| [frontend/src/pages/admin/Communication.tsx](file:///d:/Project_Abir/attendoschool/frontend/src/pages/admin/Communication.tsx) | `Communication` | `SCHOOL_ADMIN` | School announcement authoring, priority tags, publishing |
| [frontend/src/pages/admin/ParentCommunication.tsx](file:///d:/Project_Abir/attendoschool/frontend/src/pages/admin/ParentCommunication.tsx) | `ParentCommunication` | `PARENT` | Notice inbox with read receipts |
| [frontend/src/pages/auth/ResetPassword.tsx](file:///d:/Project_Abir/attendoschool/frontend/src/pages/auth/ResetPassword.tsx) | `ResetPassword` | Public | Password setup & reset interface |
| [frontend/src/super-admin/SuperAdminModule.tsx](file:///d:/Project_Abir/attendoschool/frontend/src/super-admin/SuperAdminModule.tsx) | `SuperAdminModule` | `SUPER_ADMIN` | Super Admin operations suite and metrics |
| [frontend/src/components/student/StudentLayout.tsx](file:///d:/Project_Abir/attendoschool/frontend/src/components/student/StudentLayout.tsx) | `StudentLayout` | `STUDENT` | ERP sidebar navigation, institute indicator, profile badge, theme toggle |
| [frontend/src/pages/student/StudentDashboard.tsx](file:///d:/Project_Abir/attendoschool/frontend/src/pages/student/StudentDashboard.tsx) | `StudentDashboard` | `STUDENT` | Greeting banner, attendance KPI, upcoming exams, today schedule, calendar |
| [frontend/src/pages/student/StudentAttendance.tsx](file:///d:/Project_Abir/attendoschool/frontend/src/pages/student/StudentAttendance.tsx) | `StudentAttendance` | `STUDENT` | Read-only presence records, month/status filters, historical session list |
| [frontend/src/pages/student/StudentTimetable.tsx](file:///d:/Project_Abir/attendoschool/frontend/src/pages/student/StudentTimetable.tsx) | `StudentTimetable` | `STUDENT` | Weekly class timetable schedule organized by day of week |
| [frontend/src/pages/student/StudentAssignments.tsx](file:///d:/Project_Abir/attendoschool/frontend/src/pages/student/StudentAssignments.tsx) | `StudentAssignments` | `STUDENT` | Homework tasks, due date countdowns, file/link submission modal |
| [frontend/src/pages/student/StudentExams.tsx](file:///d:/Project_Abir/attendoschool/frontend/src/pages/student/StudentExams.tsx) | `StudentExams` | `STUDENT` | Exam schedule with timings, published subject marksheets, grade cards |
| [frontend/src/pages/student/StudentAnnouncements.tsx](file:///d:/Project_Abir/attendoschool/frontend/src/pages/student/StudentAnnouncements.tsx) | `StudentAnnouncements` | `STUDENT` | School notices feed with priority badges and unread indicator |
| [frontend/src/pages/student/StudentLeaveRequest.tsx](file:///d:/Project_Abir/attendoschool/frontend/src/pages/student/StudentLeaveRequest.tsx) | `StudentLeaveRequest` | `STUDENT` | Leave application form (reason, dates) and administrative approval tracker |
| [frontend/src/pages/student/StudentProfile.tsx](file:///d:/Project_Abir/attendoschool/frontend/src/pages/student/StudentProfile.tsx) | `StudentProfile` | `STUDENT` | Student card, guardian contact details, BCrypt password change form |

---

## 13. Backend Architecture

The backend is structured as an Express 5 REST API written in TypeScript.

### Request Lifecycle
1. **Entry**: Request received by HTTP listener in [backend/src/server.ts](file:///d:/Project_Abir/attendoschool/backend/src/server.ts) and passed into Express instance configured in [backend/src/app.ts](file:///d:/Project_Abir/attendoschool/backend/src/app.ts).
2. **CORS & Parsing**: CORS options evaluate `CORS_ORIGIN`; `express.json()` parses payloads.
3. **Security Middleware**:
   - `securityHeaders`: Sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`.
   - `requestContext`: Extracts client IP and User-Agent into `req.securityContext`.
   - `apiRateLimit`: Enforces a sliding 1-minute window bucket (limit: 120 req/min in production, 1000 in dev).
4. **Authentication & Roles**:
   - `requireAuth`: Parses `Authorization: Bearer <token>`, verifies JWT signature, attaches decoded payload to `req.user`.
   - `requireRoles(...roles)`: Verifies if `req.user.role` matches the route requirements.
5. **Subscription Gate**: `requireSubscription('ATTENDANCE' | 'GENERAL')` executes `checkAccess()` in [backend/src/services/subscriptionEnforcementService.ts](file:///d:/Project_Abir/attendoschool/backend/src/services/subscriptionEnforcementService.ts) to verify active subscription or grace period before allowing write operations.
6. **Controller & Service Layer**: The route handler delegates business logic to specialized services in `backend/src/services/`.
7. **Database Persistence**:
   - **Firestore Service**: Resolves requests via `firestoreService.ts` against Cloud Firestore collections (`users`, `schools`, `students`, etc.) or the local Firestore Emulator.
   - **PostgreSQL Pool**: Queries use parameterized SQL (`$1, $2, ...`) via `pool.query()` from [backend/src/db.ts](file:///d:/Project_Abir/attendoschool/backend/src/db.ts).
   - **In-Memory Demo Store**: Automatic fallback in [backend/src/store/demoUsers.ts](file:///d:/Project_Abir/attendoschool/backend/src/store/demoUsers.ts) ensures system resilience during offline testing.
8. **Dual Health Checking**: The `/api/health` route tests connectivity to both PostgreSQL and Cloud Firestore simultaneously and reports individual status flags.
9. **Centralized Error Handler**: Any uncaught errors are caught by `app.use((err, req, res, next))` returning JSON `{ message: err.message }` and HTTP status codes.

---

## 14. Database Architecture

AttendoSchool features a **dual database architecture** supporting both modern document persistence and relational SQL storage:

### 14.1 Firebase Cloud Firestore (Primary Document Engine)
- **Engine**: Google Cloud Firestore (Serverless NoSQL Document Database)
- **Local Development**: Firebase Emulator Suite (`firebase-tools`) listening on port `8080`, with real-time web emulator UI on `http://127.0.0.1:4000/firestore`.
- **SDK**: `firebase-admin` v14.4.0 with modular imports (`firebase-admin/app`, `firebase-admin/firestore`).
- **Initialization**: Managed by [backend/src/firebase.ts](file:///d:/Project_Abir/attendoschool/backend/src/firebase.ts), supporting service account keys (`FIREBASE_SERVICE_ACCOUNT_PATH`), direct environment credentials (`FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`), or local emulator (`FIRESTORE_EMULATOR_HOST`).
- **Typed Schema Models**: Defined in [backend/src/types/firestoreSchema.ts](file:///d:/Project_Abir/attendoschool/backend/src/types/firestoreSchema.ts).
- **Core Collections**:
  - `schools`: Tenant organization details, plan references, student limits, contact metadata.
  - `users`: Super Admin, School Admin, Teacher, and Parent accounts with hashed passwords and roles.
  - `students`: Student rosters, admission numbers, class/section assignments, and guardian contacts.
  - `classes` & `sections`: Class structure (1 to 12) and section groupings.
  - `attendance_sessions`: Daily attendance batches marked by teachers with status (`PENDING`, `SUBMITTED`).
  - `attendance_records`: Individual student presence flags (`PRESENT`, `ABSENT`).
  - `subscription_plans`: Available SaaS tiers (`Basic`, `Standard`, `Enterprise`) with pricing and features.
  - `payments` & `invoices`: Transaction records and generated GST invoices.
  - `timetables`: Routine slots, period mappings, room assignments.
  - `notifications` & `announcements`: Multi-channel alerts and school-wide broadcast notices.
  - `audit_logs`: Administrative actions and security events.

### 14.2 PostgreSQL 16 (Relational Engine)
- **Engine**: PostgreSQL 16
- **Connection Mechanism**: Connection pool managed via `pg.Pool` with SSL mode auto-detection for cloud providers (`neon.tech`, `render.com`, `railway.app`, `supabase.co`).
- **Isolation Model**: Multi-tenant with shared database and shared schema (`public`). Multi-tenancy is enforced through `school_id` foreign keys indexed across operational tables.
- **Migration Strategy**: Sequential `.sql` migration files executed in sorted order by [backend/src/scripts/migrate.ts](file:///d:/Project_Abir/attendoschool/backend/src/scripts/migrate.ts).

### Database Evolution History (29 Migrations)
- `schema.sql`: Baseline tables (`schools`, `users`, `classes`, `sections`, `subjects`, `students`, `class_routines`, `attendance_sessions`, `attendance_records`, `subscription_plans`, `school_subscriptions`, `payments`, `audit_logs`).
- `migrations/007_payment_invoices.sql`: Adds `subscription_invoices` table.
- `migrations/008_school_billing.sql`: Adds school billing details and automated renewal helpers.
- `migrations/009_gst_reconciliation.sql`: Adds GSTIN, CGST, SGST tax breakdown fields.
- `migrations/010_invoice_email.sql`: Adds invoice delivery logs and email tracking.
- `migrations/011_notifications.sql`: Multi-channel notification logs and school notification channels.
- `migrations/012_attendance_reporting.sql`: Analytical functions and reporting views.
- `migrations/013_attendance_corrections.sql`: Adds `attendance_correction_requests` and audit table.
- `migrations/014_people_management.sql`: Status management and soft-activation for students/teachers.
- `migrations/015_academic_years.sql`: Academic year sessions and activation state.
- `migrations/016_student_promotion.sql`: Multi-student promotion audit history.
- `migrations/017_parent_portal.sql`: Adds `parent_profiles` and `parent_student_links`.
- `migrations/018_permissions.sql`: Custom administrative roles, permissions, and assignments.
- `migrations/019_subscription_enforcement.sql`: Access policies and feature restriction thresholds.
- `migrations/020_security_hardening.sql`: Account locking, refresh sessions, and security event logging.
- `migrations/021_backup_disaster_recovery.sql`: Backup jobs, restore test logs, and backup schedules.
- `migrations/022_advanced_timetable.sql`: Period configurations, timetable entries, conflicts, and substitute allocation.
- `migrations/023_offline_attendance.sql`: Offline sync batches and item reconciliation queues.
- `migrations/024_advanced_analytics.sql`: Daily attendance snapshots and attendance rank analytics.
- `migrations/025_communication.sql`: Announcements, audience targeting, and delivery tracking.
- `migrations/026_production.sql`: Job run monitoring and production readiness verification.
- `migrations/027_final_integration.sql`: Final integration tests and parent isolation validation.
- `migrations/028_final_integrated.sql`: Multi-channel delivery attempts and end-to-end telemetry.
- `migrations/029_student_role_and_portal.sql`: Adds `'STUDENT'` role to `user_role` ENUM/check, student login credential columns (`user_id`, `email`, `admission_number`, `date_of_birth`), `student_assignments`, `student_assignment_submissions`, `student_exams`, `student_exam_results`, and `student_leave_requests` tables.

---

## 15. Database Schema

The database consists of **67 relational tables** (including 5 dedicated tables introduced in migration 029 for the Student Portal). Below is the specification of core entities:

### 1. `schools`
| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary Key |
| `name` | `varchar(255)` | NO | — | Registered institution name |
| `code` | `varchar(50)` | NO | — | Unique school code (e.g. `DEMO001`) |
| `status` | `school_status` (ENUM) | NO | `'ACTIVE'` | Institution status: `ACTIVE`, `SUSPENDED`, `EXPIRED` |
| `enquiry_number` | `varchar(50)` | YES | — | Office helpline number for parent alerts |
| `gstin` | `varchar(50)` | YES | — | Tax identification number for GST invoices |
| `billing_address`| `text` | YES | — | Physical/billing address |
| `created_at` | `timestamptz` | NO | `now()` | Registration timestamp |
| `updated_at` | `timestamptz` | NO | `now()` | Last modification timestamp |

### 2. `users`
| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary Key |
| `school_id` | `uuid` | YES | — | Tenant FK -> `schools(id)` (NULL for Super Admin) |
| `name` | `varchar(255)` | NO | — | Full display name |
| `email` | `varchar(255)` | NO | — | Unique login email |
| `password_hash` | `text` | NO | — | Salted bcrypt password hash |
| `role` | `user_role` (ENUM) | NO | — | `SUPER_ADMIN`, `SCHOOL_ADMIN`, `TEACHER`, `PARENT`, `STUDENT` |
| `is_active` | `boolean` | NO | `true` | Account active flag |
| `failed_login_attempts` | `integer` | YES | `0` | Consecutive login failures (locks at 5) |
| `locked_until` | `timestamptz` | YES | — | Lock expiry timestamp |
| `last_login_at` | `timestamptz` | YES | — | Last authenticated session timestamp |
| `password_changed_at` | `timestamptz` | YES | — | Last credential rotation |
| `created_at` | `timestamptz` | NO | `now()` | Creation timestamp |
| `updated_at` | `timestamptz` | NO | `now()` | Update timestamp |

### 3. `students`
| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary Key |
| `school_id` | `uuid` | NO | — | FK -> `schools(id)` |
| `class_id` | `uuid` | NO | — | FK -> `classes(id)` |
| `section_id` | `uuid` | NO | — | FK -> `sections(id)` |
| `academic_year_id` | `uuid` | YES | — | FK -> `academic_years(id)` |
| `user_id` | `uuid` | YES | — | FK -> `users(id)` (Dedicated Student User Account) |
| `name` | `varchar(255)` | NO | — | Student full name |
| `email` | `varchar(255)` | YES | — | Student portal login email |
| `roll_number` | `varchar(50)` | NO | — | Class roll number |
| `admission_number` | `varchar(50)` | YES | — | Institutional admission identifier |
| `date_of_birth` | `date` | YES | — | Student birth date |
| `parent_name` | `varchar(255)` | YES | — | Primary guardian name |
| `parent_sms_number` | `varchar(50)` | YES | — | Guardian phone number for SMS/WhatsApp |
| `parent_email` | `varchar(255)` | YES | — | Guardian email for notices |
| `is_active` | `boolean` | NO | `true` | Enrollment active status |
| `created_at` | `timestamptz` | NO | `now()` | Enrollment timestamp |

### 4. `attendance_sessions`
| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary Key |
| `school_id` | `uuid` | NO | — | FK -> `schools(id)` |
| `class_id` | `uuid` | NO | — | FK -> `classes(id)` |
| `section_id` | `uuid` | NO | — | FK -> `sections(id)` |
| `subject_id` | `uuid` | YES | — | FK -> `subjects(id)` |
| `teacher_id` | `uuid` | NO | — | FK -> `users(id)` (Teacher who marked) |
| `attendance_date`| `date` | NO | — | Calendar date of attendance |
| `start_time` | `time` | NO | — | Routine slot start time |
| `end_time` | `time` | NO | — | Routine slot end time |
| `created_at` | `timestamptz` | NO | `now()` | Submission timestamp |

### 5. `attendance_records`
| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary Key |
| `attendance_session_id` | `uuid` | NO | — | FK -> `attendance_sessions(id)` |
| `student_id` | `uuid` | NO | — | FK -> `students(id)` |
| `is_present` | `boolean` | NO | — | `true` = Present, `false` = Absent |
| `status` | `varchar` | NO | `'PRESENT'` | Status string representation |
| `marked_at` | `timestamptz` | NO | `now()` | Timestamp marked |

### 6. `attendance_correction_requests`
| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary Key |
| `school_id` | `uuid` | NO | — | FK -> `schools(id)` |
| `attendance_record_id` | `uuid` | NO | — | FK -> `attendance_records(id)` |
| `requested_by` | `uuid` | NO | — | FK -> `users(id)` (Teacher) |
| `proposed_status` | `varchar(20)` | NO | — | Desired status (`PRESENT` or `ABSENT`) |
| `reason` | `text` | NO | — | Justification for correction |
| `status` | `varchar(20)` | NO | `'PENDING'` | `PENDING`, `APPROVED`, `REJECTED` |
| `reviewed_by` | `uuid` | YES | — | FK -> `users(id)` (School Admin) |
| `review_notes` | `text` | YES | — | Administrator decision rationale |
| `reviewed_at` | `timestamptz` | YES | — | Timestamp of review |
| `created_at` | `timestamptz` | NO | `now()` | Submission timestamp |

### 7. `school_subscriptions`
| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary Key |
| `school_id` | `uuid` | NO | — | FK -> `schools(id)` |
| `plan_id` | `uuid` | NO | — | FK -> `subscription_plans(id)` |
| `status` | `subscription_status` (ENUM) | NO | `'ACTIVE'` | `ACTIVE`, `PENDING`, `EXPIRED`, `CANCELLED` |
| `start_date` | `date` | NO | — | Subscription start date |
| `end_date` | `date` | NO | — | Subscription expiration date |
| `auto_renew` | `boolean` | NO | `true` | Automatic renewal flag |
| `created_at` | `timestamptz` | NO | `now()` | Record creation timestamp |

### 8. `subscription_invoices`
| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary Key |
| `payment_id` | `uuid` | NO | — | FK -> `payments(id)` |
| `school_id` | `uuid` | NO | — | FK -> `schools(id)` |
| `invoice_number` | `varchar(100)` | NO | — | Unique invoice number (e.g. `INV-2026-...`) |
| `receipt_number` | `varchar(100)` | YES | — | Associated payment receipt identifier |
| `amount` | `numeric(10,2)` | NO | — | Total invoice amount in INR |
| `taxable_amount` | `numeric(10,2)` | YES | — | Pre-tax base amount |
| `gst_rate` | `numeric(5,2)` | YES | `18.00` | Applied GST percentage (18%) |
| `gst_amount` | `numeric(10,2)` | YES | — | Total GST calculated |
| `currency` | `varchar(10)` | NO | `'INR'` | Billing currency |
| `status` | `varchar(50)` | NO | `'PAID'` | Payment status |
| `issued_at` | `timestamptz` | NO | `now()` | Issuance timestamp |
| `paid_at` | `timestamptz` | YES | — | Settlement timestamp |

### 9. `student_assignments`
| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary Key |
| `school_id` | `uuid` | NO | — | FK -> `schools(id)` |
| `class_id` | `uuid` | NO | — | FK -> `classes(id)` |
| `section_id` | `uuid` | YES | — | FK -> `sections(id)` |
| `subject_id` | `uuid` | YES | — | FK -> `subjects(id)` |
| `teacher_id` | `uuid` | YES | — | FK -> `users(id)` |
| `title` | `varchar(200)` | NO | — | Assignment title |
| `description` | `text` | YES | — | Task details, instructions, links |
| `due_date` | `date` | NO | — | Submission deadline date |
| `max_marks` | `numeric(5,2)` | YES | `100.00` | Maximum assignable score |
| `created_at` | `timestamptz` | NO | `now()` | Record creation timestamp |
| `updated_at` | `timestamptz` | NO | `now()` | Last modification timestamp |

### 10. `student_assignment_submissions`
| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary Key |
| `school_id` | `uuid` | NO | — | FK -> `schools(id)` |
| `assignment_id` | `uuid` | NO | — | FK -> `student_assignments(id)` |
| `student_id` | `uuid` | NO | — | FK -> `students(id)` |
| `status` | `varchar(30)` | NO | `'PENDING'` | `PENDING`, `SUBMITTED`, `GRADED`, `OVERDUE` |
| `submitted_at` | `timestamptz` | YES | — | Submission completion timestamp |
| `submission_text` | `text` | YES | — | Solution notes, repository URL, or link |
| `marks_obtained` | `numeric(5,2)` | YES | — | Awarded marks |
| `feedback` | `text` | YES | — | Teacher grading feedback |
| `created_at` | `timestamptz` | NO | `now()` | Submission creation timestamp |

### 11. `student_exams`
| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary Key |
| `school_id` | `uuid` | NO | — | FK -> `schools(id)` |
| `class_id` | `uuid` | NO | — | FK -> `classes(id)` |
| `subject_id` | `uuid` | YES | — | FK -> `subjects(id)` |
| `title` | `varchar(150)` | NO | — | Examination name / term title |
| `exam_date` | `date` | NO | — | Scheduled calendar date |
| `start_time` | `time` | NO | — | Examination commencement time |
| `end_time` | `time` | NO | — | Examination conclusion time |
| `room` | `varchar(50)` | YES | — | Examination hall / room number |
| `total_marks` | `numeric(5,2)` | NO | `100.00` | Total test marks |
| `passing_marks` | `numeric(5,2)` | NO | `35.00` | Minimum passing threshold |
| `created_at` | `timestamptz` | NO | `now()` | Record creation timestamp |

### 12. `student_exam_results`
| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary Key |
| `school_id` | `uuid` | NO | — | FK -> `schools(id)` |
| `exam_id` | `uuid` | NO | — | FK -> `student_exams(id)` |
| `student_id` | `uuid` | NO | — | FK -> `students(id)` |
| `marks_obtained` | `numeric(5,2)` | NO | — | Achieved exam score |
| `grade` | `varchar(10)` | YES | — | Letter grade (A+, A, B, etc.) |
| `remarks` | `text` | YES | — | Examiner evaluation remarks |
| `created_at` | `timestamptz` | NO | `now()` | Record creation timestamp |

### 13. `student_leave_requests`
| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary Key |
| `school_id` | `uuid` | NO | — | FK -> `schools(id)` |
| `student_id` | `uuid` | NO | — | FK -> `students(id)` |
| `start_date` | `date` | NO | — | Leave commencement date |
| `end_date` | `date` | NO | — | Leave conclusion date |
| `reason` | `text` | NO | — | Student application rationale |
| `status` | `varchar(30)` | NO | `'PENDING'` | `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED` |
| `reviewed_by` | `uuid` | YES | — | FK -> `users(id)` (Approving administrator/teacher) |
| `review_notes` | `text` | YES | — | Decision rationale or instructions |
| `created_at` | `timestamptz` | NO | `now()` | Application submission timestamp |
| `updated_at` | `timestamptz` | NO | `now()` | Last modification timestamp |

---

## 16. Entity Relationship Diagram

```mermaid
erDiagram
    schools ||--o{ users : "employs"
    schools ||--o{ classes : "defines"
    schools ||--o{ students : "enrolls"
    schools ||--o{ school_subscriptions : "subscribes"
    schools ||--o{ academic_years : "operates"
    schools ||--o{ announcements : "broadcasts"
    schools ||--o{ backup_jobs : "generates"
    schools ||--o{ student_assignments : "assigns"
    schools ||--o{ student_exams : "schedules"

    subscription_plans ||--o{ school_subscriptions : "defines_tier"
    school_subscriptions ||--o{ payments : "billed_by"
    payments ||--|| subscription_invoices : "generates"

    classes ||--o{ sections : "contains"
    classes ||--o{ students : "groups"
    sections ||--o{ students : "allocates"
    classes ||--o{ student_assignments : "assigned_to"
    classes ||--o{ student_exams : "examined_in"

    users ||--o{ class_routines : "taught_by"
    classes ||--o{ class_routines : "scheduled_for"
    sections ||--o{ class_routines : "allocated_to"
    subjects ||--o{ class_routines : "covers"

    users ||--o{ attendance_sessions : "submits"
    classes ||--o{ attendance_sessions : "attends"
    sections ||--o{ attendance_sessions : "participates"
    subjects ||--o{ attendance_sessions : "taught_in"

    attendance_sessions ||--o{ attendance_records : "logs"
    students ||--o{ attendance_records : "recorded_for"

    attendance_records ||--o{ attendance_correction_requests : "modified_by"
    users ||--o{ attendance_correction_requests : "requested_by"
    users ||--o{ attendance_correction_requests : "reviewed_by"

    academic_years ||--o{ student_promotions : "from_year"
    academic_years ||--o{ student_promotions : "to_year"
    students ||--o{ student_promotions : "promoted_student"

    users ||--o{ parent_student_links : "parent_guardian"
    students ||--o{ parent_student_links : "ward"
    users ||--o{ students : "student_user_account"

    student_assignments ||--o{ student_assignment_submissions : "receives"
    students ||--o{ student_assignment_submissions : "submits"

    student_exams ||--o{ student_exam_results : "produces"
    students ||--o{ student_exam_results : "scores"

    students ||--o{ student_leave_requests : "applies"

    attendance_sessions ||--o{ sms_logs : "triggers_sms"
    attendance_sessions ||--o{ notification_logs : "triggers_notifications"

    timetable_periods ||--o{ timetable_entries : "time_slot"
    timetable_entries ||--o{ substitute_assignments : "reassigned"
```

---

## 17. Authentication & Authorization

### Authentication Mechanism
1. **Multi-Tenant Institute Resolution**: Before authentication, clients query `GET /api/auth/institutes` to fetch active schools (`{ id, name, code }`) to bind the user's session to the target institution tenant.
2. **Credentials Validation**: Authentication is performed via `POST /api/auth/login` with `email` (or student roll number/admission identifier), `password`, and optional `instituteId`. Passwords are validated using `bcrypt.compare()` against `users.password_hash`. Tenant isolation is enforced by ensuring the user belongs to the selected school.
3. **Token Issuance**: A signed JWT bearer token is returned upon successful authentication with full user identity and role:
   ```json
   {
     "id": "20000000-0000-0000-0000-000000000001",
     "schoolId": "00000000-0000-0000-0000-000000000001",
     "name": "Rohan Sharma",
     "email": "student@greenwood.local",
     "role": "STUDENT",
     "studentProfile": {
       "studentId": "30000000-0000-0000-0000-000000000001",
       "rollNumber": "25",
       "className": "Class 10",
       "sectionName": "A",
       "schoolName": "Greenwood International School"
     }
   }
   ```
4. **Validity**: Tokens are signed using `env.jwtSecret` with an 8-hour expiration window (`expiresIn: '8h'`).
5. **Transport**: Clients store the token in `localStorage.attendance_token` and inject it into the `Authorization: Bearer <token>` header via Axios interceptors.
6. **Fallback Store**: If the PostgreSQL database is unreachable, `auth.ts` falls back to the in-memory demo store defined in [backend/src/store/demoUsers.ts](file:///d:/Abir%200.1/attendoschool/backend/src/store/demoUsers.ts) with full support for student demo credentials.

---

## 18. Roles & Permissions

### Role Matrix

| Capability / Resource | `SUPER_ADMIN` | `SCHOOL_ADMIN` | `TEACHER` | `PARENT` | `STUDENT` | Enforcing Middleware / Logic |
|---|:---:|:---:|:---:|:---:|:---:|---|
| **Platform Revenue & Multi-School Overview** |  | ❌ | ❌ | ❌ | ❌ | `requireRoles('SUPER_ADMIN')` |
| **School Onboarding & Plan Allocation** |  | ❌ | ❌ | ❌ | ❌ | `requireRoles('SUPER_ADMIN')` |
| **Trigger Full DB Backups (`pg_dump`)** |  |  *(Observed)* | ❌ | ❌ | ❌ | `requireRoles('SUPER_ADMIN','SCHOOL_ADMIN')` |
| **Class, Section & Subject Creation** | ❌ |  | ❌ | ❌ | ❌ | `requireRoles('SCHOOL_ADMIN')` |
| **Student & Faculty Provisioning** | ❌ |  | ❌ | ❌ | ❌ | `requireRoles('SCHOOL_ADMIN')` |
| **Routines & Timetable Assignment** | ❌ |  | ❌ | ❌ | ❌ | `requireRoles('SCHOOL_ADMIN')` |
| **Take Classroom Attendance** | ❌ | ❌ |  | ❌ | ❌ | `requireRoles('TEACHER')` |
| **Teacher Today Schedule** | ❌ | ❌ |  | ❌ | ❌ | `requireRoles('TEACHER')` |
| **Submit Attendance Correction Request** | ❌ | ❌ |  | ❌ | ❌ | `requireRoles('TEACHER','SCHOOL_ADMIN')` |
| **Approve / Reject Correction Request** | ❌ |  | ❌ | ❌ | ❌ | `requireRoles('SCHOOL_ADMIN')` |
| **Academic Year Promotions** | ❌ |  | ❌ | ❌ | ❌ | `requireRoles('SCHOOL_ADMIN')` |
| **View Attendance Reports & Analytics** |  |  |  | ❌ | ❌ | `requireRoles('SUPER_ADMIN','SCHOOL_ADMIN','TEACHER')` |
| **Offline Attendance Sync Submission** | ❌ | ❌ |  | ❌ | ❌ | `requireRoles('TEACHER','SCHOOL_ADMIN')` |
| **Parent Portal Child Attendance** | ❌ | ❌ | ❌ |  | ❌ | `requireRoles('PARENT')` |
| **School Announcement Broadcasts** | ❌ |  | ❌ | ❌ | ❌ | `requireRoles('SCHOOL_ADMIN')` |
| **Parent Read Announcements** | ❌ | ❌ | ❌ |  | ❌ | `requireRoles('PARENT')` |
| **Subscription Renewal & Payment** |  |  | ❌ | ❌ | ❌ | `requireSubscription` / Role Guard |
| **Student Dashboard & Overview KPIs** | ❌ | ❌ | ❌ | ❌ |  | `requireRoles('STUDENT')` |
| **Student Personal Attendance Log** | ❌ | ❌ | ❌ | ❌ |  | `requireRoles('STUDENT')` |
| **Student Class Routine & Timetable** | ❌ | ❌ | ❌ | ❌ |  | `requireRoles('STUDENT')` |
| **Student Homework & Assignments** | ❌ | ❌ | ❌ | ❌ |  | `requireRoles('STUDENT')` |
| **Submit Assignment Solution / URL** | ❌ | ❌ | ❌ | ❌ |  | `requireRoles('STUDENT')` |
| **Student Exam Schedule & Results** | ❌ | ❌ | ❌ | ❌ |  | `requireRoles('STUDENT')` |
| **Student Announcement Feed** | ❌ | ❌ | ❌ | ❌ |  | `requireRoles('STUDENT')` |
| **Apply & Track Student Leave** | ❌ | ❌ | ❌ | ❌ |  | `requireRoles('STUDENT')` |
| **Student Profile & Password Rotation** | ❌ | ❌ | ❌ | ❌ |  | `requireRoles('STUDENT')` |

---

## 19. API Documentation

AttendoSchool exposes **242 distinct endpoint mappings**. All operational modules are dual-mounted on both clean URLs (e.g. `/api/timetable`) and legacy versioned aliases (e.g. `/api/timetable-v22`) for backward compatibility.

### 19.1 Authentication & Health

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `GET` | `/health` | Public | Any | Root container/uptime health check |
| `GET` | `/api` | Public | Any | API identity check |
| `GET` | `/api/health` | Public | Any | Database connection health probe |
| `GET` | `/api/auth/institutes` | Public | Any | List active institutions for login tenant selector |
| `POST` | `/api/auth/login` | Public | Any | Authenticate email/password and issue JWT |
| `GET` | `/api/auth/me` | Required | Any | Retrieve active user identity from token |
| `POST` | `/api/auth/request-password-reset` | Public | Any | Request a secure 24-hour setup/reset link by email |
| `GET` | `/api/auth/verify-reset-token` | Public | Any | Verify security token validity and fetch recipient info |
| `POST` | `/api/auth/reset-password` | Public | Any | Set new account password with verified token |

#### `POST /api/auth/login`
- **Request**:
  ```json
  {
    "email": "superadmin@attendance.local",
    "password": "<REDACTED>"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "47526c01-4c09-4a2f-8e23-a2d2463e5777",
      "schoolId": null,
      "name": "Company Super Admin",
      "email": "superadmin@attendance.local",
      "role": "SUPER_ADMIN"
    }
  }
  ```
- **Errors**: `400 Bad Request` (missing fields), `401 Unauthorized` (invalid credentials or inactive account).

---

### 19.2 School & Master Academic Data

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `GET` | `/api/classes` | Required | `SCHOOL_ADMIN` | List classes for active school |
| `POST` | `/api/classes` | Required | `SCHOOL_ADMIN` | Create class (1 to 12) |
| `GET` | `/api/sections` | Required | `SCHOOL_ADMIN` | List sections with class names |
| `POST` | `/api/sections` | Required | `SCHOOL_ADMIN` | Create section under a class |
| `GET` | `/api/subjects` | Required | `SCHOOL_ADMIN` | List academic subjects |
| `POST` | `/api/subjects` | Required | `SCHOOL_ADMIN` | Create subject |
| `GET` | `/api/students` | Required | `SCHOOL_ADMIN` | List enrolled students |
| `POST` | `/api/students` | Required | `SCHOOL_ADMIN` | Create student record (supports student/parent login email option and invite email dispatch) |
| `POST` | `/api/students/:id/send-reset-email` | Required | `SCHOOL_ADMIN` | Manually re-dispatch password setup link to student/parent email |
| `DELETE`| `/api/students/:id` | Required | `SCHOOL_ADMIN` | Remove student |
| `POST` | `/api/students/bulk-import` | Required | `SCHOOL_ADMIN` | Bulk import students from JSON/Excel |
| `POST` | `/api/students/bulk-delete` | Required | `SCHOOL_ADMIN` | Bulk delete students by ID array |
| `GET` | `/api/teachers` | Required | `SCHOOL_ADMIN` | List faculty teachers |
| `POST` | `/api/teachers` | Required | `SCHOOL_ADMIN` | Create teacher user account (with optional password setup invite email) |
| `POST` | `/api/teachers/:id/send-reset-email` | Required | `SCHOOL_ADMIN` | Manually re-dispatch password setup link to teacher email |
| `DELETE`| `/api/teachers/:id` | Required | `SCHOOL_ADMIN` | Remove teacher account |
| `POST` | `/api/teachers/bulk-import` | Required | `SCHOOL_ADMIN` | Bulk import teachers |
| `POST` | `/api/teachers/bulk-delete` | Required | `SCHOOL_ADMIN` | Bulk delete teachers |
| `GET` | `/api/routines` | Required | `SCHOOL_ADMIN` | List routine slot mappings |
| `POST` | `/api/routines` | Required | `SCHOOL_ADMIN` | Create routine mapping |
| `DELETE`| `/api/routines/:id` | Required | `SCHOOL_ADMIN` | Delete routine mapping |

---

### 19.3 Teacher & Daily Attendance Operations

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `GET` | `/api/teacher/routine/today` | Required | `TEACHER` | Get assigned routine slots for current day |
| `GET` | `/api/teacher/students/:classId/:sectionId` | Required | `TEACHER` | Get class roster for attendance |
| `POST` | `/api/teacher/attendance` | Required | `TEACHER` | Submit classroom attendance & trigger alerts |
| `GET` | `/api/teacher/attendance/history` | Required | `TEACHER` | View past attendance submission sessions |

#### `POST /api/teacher/attendance`
- **Request**:
  ```json
  {
    "classId": "cls-uuid",
    "sectionId": "sec-uuid",
    "subjectId": "sub-uuid",
    "startTime": "09:00",
    "endTime": "09:45",
    "attendanceDate": "2026-09-17",
    "presentStudentIds": [
      "st-uuid-1",
      "st-uuid-2"
    ]
  }
  ```
- **Response** (`201 Created`):
  ```json
  {
    "success": true,
    "sessionId": "session-uuid",
    "total": 45,
    "present": 43,
    "absent": 2,
    "smsQueued": 2
  }
  ```
- **Errors**: `400 Bad Request` (missing fields), `409 Conflict` (attendance already submitted for this slot).

---

### 19.4 Academic Years & Sessions

*Mounted on `/api/academic-years` and `/api/academic-years-v15`.*

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `GET` | `/api/academic-years` | Required | Any with `schoolId` | List academic years |
| `GET` | `/api/academic-years/active` | Required | Any with `schoolId` | Get currently active academic session |
| `POST` | `/api/academic-years` | Required | Any with `schoolId` | Create new academic session |
| `POST` | `/api/academic-years/:id/activate` | Required | Any with `schoolId` | Set year as active session |
| `POST` | `/api/academic-years/:id/archive` | Required | Any with `schoolId` | Archive academic session |

---

### 19.5 Student Promotions

*Mounted on `/api/student-promotions` and `/api/student-promotions-v16`.*

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `GET` | `/api/student-promotions/candidates` | Required | Any with `schoolId` | List students eligible for promotion |
| `POST` | `/api/student-promotions/process` | Required | `SCHOOL_ADMIN`, `SUPER_ADMIN` | Execute batch promotions |

#### `POST /api/student-promotions/process`
- **Request**:
  ```json
  {
    "fromYearId": "year-2025-uuid",
    "toYearId": "year-2026-uuid",
    "items": [
      {
        "studentId": "st-uuid-1",
        "action": "PROMOTED",
        "toClassId": "class-9-uuid",
        "toSectionId": "sec-a-uuid"
      }
    ]
  }
  ```

---

### 19.6 Attendance Corrections & Auditing

*Mounted on `/api/attendance-corrections` and `/api/attendance-corrections-v13`.*

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `GET` | `/api/attendance-corrections` | Required | Any with `schoolId` | List correction tickets with filter params |
| `POST` | `/api/attendance-corrections` | Required | Any with `schoolId` | Submit a correction ticket |
| `POST` | `/api/attendance-corrections/:id/review` | Required | `SCHOOL_ADMIN`, `SUPER_ADMIN` | Approve or reject correction ticket |

---

### 19.7 Attendance Reports & Analytics

*Mounted on `/api/attendance-reports` and `/api/attendance-reports-v12`.*

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `GET` | `/api/attendance-reports/summary` | Required | Any with `schoolId` | Overall presence/absence rate by date range |
| `GET` | `/api/attendance-reports/students` | Required | Any with `schoolId` | Student-level attendance % and absence count |
| `GET` | `/api/attendance-reports/daily` | Required | Any with `schoolId` | Day-by-day attendance trends |

*Analytics mounted on `/api/analytics` and `/api/analytics-v24`.*

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `GET` | `/api/analytics/daily-snapshots` | Required | Any with `schoolId` | Historical attendance snapshot metrics |
| `GET` | `/api/analytics/rankings` | Required | Any with `schoolId` | Class and student attendance performance rank |

---

### 19.8 Advanced Timetable & Substitute Allocation

*Mounted on `/api/timetable` and `/api/timetable-v22`.*

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `GET` | `/api/timetable/periods` | Required | Any with `schoolId` | List period slot definitions |
| `POST` | `/api/timetable/periods` | Required | Any with `schoolId` | Create period slot |
| `GET` | `/api/timetable/entries` | Required | Any with `schoolId` | List timetable entries |
| `GET` | `/api/timetable/conflicts` | Required | Any with `schoolId` | Identify room or teacher scheduling conflicts |
| `POST` | `/api/timetable/entries` | Required | Any with `schoolId` | Create timetable schedule entry |
| `POST` | `/api/timetable/entries/:id/publish` | Required | Any with `schoolId` | Publish timetable entry |
| `POST` | `/api/timetable/substitutes` | Required | Any with `schoolId` | Assign substitute teacher to slot |

---

### 19.9 Student Portal & Unified Access Model

> [!NOTE]
> **Unified Student Portal**: AttendoSchool centralizes all learner and guardian self-service capabilities into a single **Student Portal** (`/student/dashboard`). During student enrollment, school administrators can designate either the student's email or the parent/guardian's email as the portal login credential. User accounts created under either option receive `role: 'STUDENT'`, granting direct, comprehensive access to timetable routines, attendance metrics, homework, exams, and announcements.

*Mounted on `/api/parent-portal` and `/api/parent-portal-v17` (legacy alias retained for backwards compatibility).*

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `GET` | `/api/parent-portal/children` | Required | `PARENT`, `STUDENT` | List wards or personal student identity |
| `GET` | `/api/parent-portal/children/:id/attendance`| Required | `PARENT`, `STUDENT` | Attendance records for student |

---

### 19.10 Communications & Announcements

*Mounted on `/api/communication` and `/api/communication-v25`.*

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `GET` | `/api/communication/announcements` | Required | Any with `schoolId` | List school announcements |
| `POST` | `/api/communication/announcements` | Required | Any with `schoolId` | Create announcement |
| `POST` | `/api/communication/announcements/:id/publish` | Required | Any with `schoolId` | Publish announcement & resolve recipients |
| `GET` | `/api/communication/parent/inbox` | Required | `PARENT` | View announcements sent to parent |
| `POST` | `/api/communication/parent/read/:id` | Required | `PARENT` | Mark announcement as read |
| `GET` | `/api/communication/parent/preferences` | Required | `PARENT` | Retrieve notification channel preferences |
| `PUT` | `/api/communication/parent/preferences` | Required | `PARENT` | Update channel preferences (SMS/WA/Email) |
| `POST` | `/api/communication/process-scheduled` | Required | Any with `schoolId` | Trigger scheduled message dispatch |
| `GET` | `/api/communication/delivery-summary` | Required | Any with `schoolId` | Announcement delivery metrics |

---

### 19.11 Offline Attendance Synchronization

*Mounted on `/api/offline-attendance` and `/api/offline-attendance-v23`.*

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `POST` | `/api/offline-attendance/sync` | Required | `SUPER_ADMIN`, `SCHOOL_ADMIN`, `TEACHER` | Upload offline batch of records |
| `POST` | `/api/offline-attendance/sync/:id/process` | Required | `SUPER_ADMIN`, `SCHOOL_ADMIN`, `TEACHER` | Reconcile batch items into records table |
| `GET` | `/api/offline-attendance/sync/:id` | Required | `SUPER_ADMIN`, `SCHOOL_ADMIN`, `TEACHER` | Check reconciliation batch status |

---

### 19.12 Granular Roles & RBAC

*Mounted on `/api/permissions` and `/api/permissions-v18`.*

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `GET` | `/api/permissions` | Required | `SCHOOL_ADMIN`, `SUPER_ADMIN` | List system roles and permissions |
| `POST` | `/api/permissions/seed` | Required | `SCHOOL_ADMIN`, `SUPER_ADMIN` | Seed default school admin role definitions |
| `GET` | `/api/permissions/roles` | Required | `SCHOOL_ADMIN`, `SUPER_ADMIN` | Get configured roles |
| `GET` | `/api/permissions/permissions`| Required | `SCHOOL_ADMIN`, `SUPER_ADMIN` | Get catalog of permission definitions |
| `POST` | `/api/permissions/assign` | Required | `SCHOOL_ADMIN`, `SUPER_ADMIN` | Assign granular role to user |
| `GET` | `/api/permissions/me` | Required | Any | Get caller's granular permissions |

---

### 19.13 Subscriptions, Billing & GST Invoices

*Mounted on `/api/subscriptions` and `/api/subscriptions-v19`.*

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `GET` | `/api/subscriptions/status` | Required | Any with `schoolId` | Get current school subscription status & quotas |
| `GET` | `/api/subscriptions/access` | Required | Guarded by `requireSubscription` | Verify active operational access |
| `POST` | `/api/subscriptions/run-worker`| Required | Any with `schoolId` | Manually run subscription expiry check |
| `GET` | `/api/subscriptions/details` | Required | Any with `schoolId` | Detailed plan parameters and end dates |

*Invoices mounted on `/api/invoices`.*

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `GET` | `/api/invoices` | Required | Any with `schoolId` | List school tax invoices |
| `GET` | `/api/invoices/:id/pdf` | Required | Any with `schoolId` | Download PDF tax invoice generated via PDFKit |
| `POST` | `/api/invoices/:id/email` | Required | Any with `schoolId` | Send PDF invoice via SMTP email |

---

### 19.14 Payments & Razorpay Integration

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `POST` | `/api/school-payment/order` | Required | `SCHOOL_ADMIN` | Create mock or Razorpay renewal order |
| `POST` | `/api/school-payment/mock/complete` | Required | `SCHOOL_ADMIN` | Complete mock sandbox payment |
| `POST` | `/api/school-payment/razorpay/verify` | Required | `SCHOOL_ADMIN` | Verify Razorpay HMAC-SHA256 checkout signature |
| `POST` | `/api/webhooks/razorpay` | Public | Razorpay Signature | Webhook handler for `payment.captured` & `payment.failed` |

---

### 19.15 Disaster Recovery & Backups

*Mounted on `/api/backups` and `/api/backups-v21`.*

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `GET` | `/api/backups/jobs` | Required | `SUPER_ADMIN`, `SCHOOL_ADMIN` | List database backup jobs |
| `POST` | `/api/backups/create` | Required | `SUPER_ADMIN`, `SCHOOL_ADMIN` | Trigger on-demand `pg_dump` backup |
| `POST` | `/api/backups/restore-test/:id` | Required | `SUPER_ADMIN`, `SCHOOL_ADMIN` | Register safe restore verification test |
| `POST` | `/api/backups/cleanup` | Required | `SUPER_ADMIN`, `SCHOOL_ADMIN` | Remove backups older than retention days |

---

### 19.16 Security Hardening & Session Management

*Mounted on `/api/security` and `/api/security-v20`.*

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `POST` | `/api/security/check-login` | Required | Any | Check account lock status by email |
| `POST` | `/api/security/validate-password`| Required | Any | Validate password policy compliance |
| `POST` | `/api/security/logout-refresh` | Required | Any | Revoke refresh token session |
| `POST` | `/api/security/cleanup` | Required | Any | Delete expired refresh tokens and idempotency keys |

---

### 19.17 Super Admin Operations & Monitoring

*Mounted on `/api/super-admin`.*

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `GET` | `/api/super-admin/overview` | Required | `SUPER_ADMIN` | Global school count, active ratio, revenue metrics |
| `GET` | `/api/super-admin/schools` | Required | `SUPER_ADMIN` | List all schools across platform |
| `POST` | `/api/super-admin/schools` | Required | `SUPER_ADMIN` | Provision new school & initial admin user |
| `PATCH`| `/api/super-admin/schools/:id/status` | Required | `SUPER_ADMIN` | Update school status (`ACTIVE`, `SUSPENDED`) |
| `GET` | `/api/super-admin/plans` | Required | `SUPER_ADMIN` | List subscription plans |
| `POST` | `/api/super-admin/plans` | Required | `SUPER_ADMIN` | Create new subscription tier |
| `POST` | `/api/super-admin/subscriptions` | Required | `SUPER_ADMIN` | Provision school subscription manual override |
| `GET` | `/api/super-admin/monitor` | Required | `SUPER_ADMIN` | Telemetry: today sessions, present/absent counts |
| `POST` | `/api/super-admin/payments/order`| Required | `SUPER_ADMIN` | Create renewal order on behalf of school |
| `POST` | `/api/super-admin/payments/mock/complete` | Required | `SUPER_ADMIN` | Settle payment via mock provider |
| `POST` | `/api/super-admin/payments/razorpay/verify`| Required | `SUPER_ADMIN` | Verify Razorpay payment signature |
| `GET` | `/api/super-admin/payments` | Required | `SUPER_ADMIN` | Global payment transaction ledger |

---

### 19.18 Production & Health Probes

*Mounted on `/api/production`, `/api/production-v26`, `/api/final-integration`, `/api/final-v28`.*

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `GET` | `/api/production/health` | Public | Any | Returns `{ ok: true, uptime: ... }` |
| `GET` | `/api/production/ready` | Public | Any | Verifies DB connectivity and returns system readiness |
| `GET` | `/api/production/jobs` | Public | Any | Inspect recent background job execution runs |
| `GET` | `/api/final-integration/db-check` | Public | Any | Comprehensive DB table count diagnostic |
| `GET` | `/api/final-integration/migration-smoke` | Public | Any | Verifies migration file presence & integrity |
| `GET` | `/api/final-integration/integrity` | Public | Any | Verifies foreign key constraints and schema relations |
| `GET` | `/api/final-integration/parent-isolation/:parentUserId/:studentId` | Public | Any | Confirms strict parent-child boundary isolation |

---

### 19.19 Student Portal & Academic Operations

*Mounted on `/api/student`.* All endpoints are strictly guarded by `[requireAuth, requireRoles('STUDENT')]`. Students cannot perform admin operations, take attendance, edit rosters, or view unauthorized peers' data.

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `GET` | `/api/student/me` | Required | `STUDENT` | Retrieve student profile, enrollment, and school metadata |
| `GET` | `/api/student/dashboard` | Required | `STUDENT` | Student dashboard summary (KPIs, today routine, notices, pending tasks) |
| `GET` | `/api/student/attendance` | Required | `STUDENT` | Personal attendance history, statistics (present/absent), and session logs |
| `GET` | `/api/student/timetable` | Required | `STUDENT` | Complete weekly timetable organized by day of week |
| `GET` | `/api/student/announcements` | Required | `STUDENT` | Active school circulars and priority announcements |
| `GET` | `/api/student/assignments` | Required | `STUDENT` | Assigned homework tasks with submission state & grades |
| `POST` | `/api/student/assignments/:id/submit` | Required | `STUDENT` | Submit assignment solution text or resource URL |
| `GET` | `/api/student/exams` | Required | `STUDENT` | Upcoming examinations timetable and published subject marksheets |
| `GET` | `/api/student/leave-requests` | Required | `STUDENT` | List submitted leave applications with administrative review status |
| `POST` | `/api/student/leave-requests` | Required | `STUDENT` | Apply for formal student leave (start/end dates, reason) |
| `PUT` | `/api/student/change-password` | Required | `STUDENT` | Update student portal login password with BCrypt hashing |

#### `GET /api/student/dashboard`
- **Response** (`200 OK`):
  ```json
  {
    "student": {
      "id": "30000000-0000-0000-0000-000000000001",
      "name": "Rohan Sharma",
      "rollNumber": "25",
      "className": "Class 10",
      "sectionName": "A",
      "schoolName": "Greenwood International School"
    },
    "kpis": {
      "attendancePercentage": 92.4,
      "totalSessions": 45,
      "presentCount": 42,
      "absentCount": 3,
      "pendingAssignments": 2,
      "upcomingExams": 1,
      "unreadAnnouncements": 2
    },
    "todayTimetable": [
      {
        "id": "period-1",
        "periodName": "Period 1",
        "subjectName": "Mathematics",
        "teacherName": "Anita Desai",
        "room": "Room 204",
        "startTime": "08:30",
        "endTime": "09:15",
        "status": "ongoing"
      }
    ],
    "announcements": [
      {
        "id": "ann-1",
        "title": "Annual Sports Meet 2026",
        "content": "Registration starts on Monday for all events.",
        "priority": "HIGH",
        "publishedAt": "2026-09-17T10:00:00.000Z"
      }
    ],
    "pendingTasks": [
      {
        "id": "asgn-1",
        "title": "Quadratic Equations Problem Set",
        "subjectName": "Mathematics",
        "dueDate": "2026-09-22",
        "status": "PENDING"
      }
    ]
  }
  ```

#### `POST /api/student/assignments/:id/submit`
- **Request**:
  ```json
  {
    "submissionText": "Solved all problems on paper and uploaded to school drive: https://drive.google.com/open?id=xyz"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "submission": {
      "id": "sub-101",
      "assignmentId": "asgn-1",
      "status": "SUBMITTED",
      "submittedAt": "2026-09-17T19:00:00.000Z"
    }
  }
  ```

#### `POST /api/student/leave-requests`
- **Request**:
  ```json
  {
    "startDate": "2026-09-24",
    "endDate": "2026-09-25",
    "reason": "Family function requiring out-of-station travel."
  }
  ```
- **Response** (`201 Created`):
  ```json
  {
    "success": true,
    "leaveRequest": {
      "id": "leave-101",
      "startDate": "2026-09-24",
      "endDate": "2026-09-25",
      "reason": "Family function requiring out-of-station travel.",
      "status": "PENDING",
      "createdAt": "2026-09-17T19:15:00.000Z"
    }
  }
  ```

---

## 20. API Authentication

All authenticated requests require the standard HTTP Authorization header:

```http
Authorization: Bearer <token>
```

Tokens are verified statelessly by `requireAuth` in [backend/src/middleware/auth.ts](file:///d:/Project_Abir/attendoschool/backend/src/middleware/auth.ts):
```typescript
const h = req.headers.authorization;
if (!h?.startsWith('Bearer ')) return res.status(401).json({ message: 'Authentication required' });
try {
  req.user = jwt.verify(h.slice(7), env.jwtSecret) as AuthUser;
  next();
} catch {
  return res.status(401).json({ message: 'Invalid or expired token' });
}
```

---

## 21. Third-Party Integrations

| Provider | Purpose | Where Used | Configuration Required | Mode / Fallback |
|---|---|---|---|---|
| **Razorpay** | Online Payment Gateway for SaaS subscriptions | [backend/src/services/razorpayService.ts](file:///d:/Project_Abir/attendoschool/backend/src/services/razorpayService.ts), [backend/src/routes/razorpaySchool.ts](file:///d:/Project_Abir/attendoschool/backend/src/routes/razorpaySchool.ts) | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Supports `MOCK` sandbox provider when keys are not configured |
| **Nodemailer / SMTP** | Email delivery for PDF tax invoices and parent notices | [backend/src/services/emailService.ts](file:///d:/Project_Abir/attendoschool/backend/src/services/emailService.ts), [backend/src/services/notificationService.ts](file:///d:/Project_Abir/attendoschool/backend/src/services/notificationService.ts) | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Skips actual dispatch with console log if SMTP credentials missing |
| **HTTP SMS Gateway** | External SMS delivery for absence alerts | [backend/src/services/smsService.ts](file:///d:/Project_Abir/attendoschool/backend/src/services/smsService.ts) | `SMS_PROVIDER_URL`, `SMS_PROVIDER_API_KEY`, `SMS_SENDER_ID` | Defaults to `mock` SMS provider (`console.log`) for local development |
| **WhatsApp Gateway** | WhatsApp messaging (schema configured) | [backend/src/services/notificationService.ts](file:///d:/Project_Abir/attendoschool/backend/src/services/notificationService.ts), `.env.production.example` | `WHATSAPP_PROVIDER`, `WHATSAPP_API_KEY` | Logged to `notification_delivery_attempts_v28` |
| **PDFKit** | Headless PDF generation for GST invoices | [backend/src/services/invoicePdfService.ts](file:///d:/Project_Abir/attendoschool/backend/src/services/invoicePdfService.ts) | None (in-process library) | Generates A4 PDF buffer in memory |

---

## 22. Environment Variables

> [!NOTE]
> All sensitive passwords, private keys, and API secrets are strictly redacted in this documentation per security guidelines.

| Variable Name | Level | Required | Default / Expected | Purpose |
|---|---|---|---|---|
| `PORT` | Backend | No | `5000` (Local) / `10000` (Render) | TCP port for Express API server |
| `DATABASE_URL` | Backend | Yes | `""` | Full PostgreSQL connection string with credentials `<REDACTED>` |
| `JWT_SECRET` | Backend | Yes | `'development-only-secret'` | Secret key used for signing & verifying JWT tokens `<REDACTED>` |
| `CORS_ORIGIN` | Backend | No | `'http://localhost:5173'` | Allowed origins for CORS (`*` or comma-separated URLs) |
| `NODE_ENV` | Backend | No | `undefined` / `'production'` | Runtime environment mode (`development`, `production`) |
| `RATE_LIMIT` | Backend | No | `120` (Prod) / `1000` (Dev) | Maximum requests per minute per IP bucket |
| `BACKUP_DIR` | Backend | No | `process.cwd()/backups` | Target directory for `pg_dump` database dumps |
| `BACKUP_RETENTION_DAYS`| Backend | No | `30` | Number of days before old backup files are pruned |
| `PG_DUMP_PATH` | Backend | No | `'pg_dump'` | Binary path for PostgreSQL dump executable |
| `RAZORPAY_KEY_ID` | Backend / Frontend | No | `""` | Public Razorpay key `<REDACTED>` |
| `RAZORPAY_KEY_SECRET` | Backend | No | `""` | Razorpay API secret `<REDACTED>` |
| `RAZORPAY_WEBHOOK_SECRET` | Backend | No | `""` | Secret for HMAC-SHA256 webhook signature validation `<REDACTED>` |
| `SMTP_HOST` | Backend | No | `""` | Outgoing SMTP mail server host |
| `SMTP_PORT` | Backend | No | `587` | Outgoing SMTP mail server port |
| `SMTP_USER` | Backend | No | `""` | SMTP authentication username `<REDACTED>` |
| `SMTP_PASS` | Backend | No | `""` | SMTP authentication password `<REDACTED>` |
| `SMTP_FROM` | Backend | No | `""` | Outgoing `From` header email address |
| `SMS_PROVIDER` | Backend | No | `'mock'` | SMS driver (`mock` or external HTTP) |
| `SMS_PROVIDER_URL` | Backend | No | `""` | REST URL of upstream SMS gateway |
| `SMS_PROVIDER_API_KEY` | Backend | No | `""` | Upstream SMS provider API key `<REDACTED>` |
| `SMS_SENDER_ID` | Backend | No | `""` | Approved alphanumeric SMS sender header |
| `COMPANY_NAME` | Backend | No | `'School Attendance SaaS'` | Platform company name for GST tax invoices |
| `COMPANY_GSTIN` | Backend | No | `""` | Company GSTIN tax registration number |
| `COMPANY_ADDRESS` | Backend | No | `""` | Company physical address printed on invoices |
| `COMPANY_PHONE` | Backend | No | `""` | Company helpline printed on invoices |
| `COMPANY_GST_RATE` | Backend | No | `18` | Statutory GST rate percentage |
| `VITE_API_URL` | Frontend | No | `'http://localhost:5000/api'` | Base URL prefix for backend REST requests |

---

## 23. Security Audit & Findings

A thorough static and behavioral code review of the repository identified the following findings:

| Severity | Category | Finding | Location | Recommendation |
|---|---|---|---|---|
| **High** | **CORS Misconfiguration** | When `CORS_ORIGIN=*`, `app.ts` passes `origin: true` with `credentials: true`. This reflects incoming Origin headers and allows any external domain to make authenticated cross-origin requests. | [backend/src/app.ts:45-52](file:///d:/Project_Abir/attendoschool/backend/src/app.ts#L45-L52) | Explicitly restrict `CORS_ORIGIN` to trusted production frontend URLs when credentials are enabled. |
| **High** | **Cross-Tenant Backup Execution** | The backup router allows users with `SCHOOL_ADMIN` role to invoke `createDatabaseBackup()`, which runs `pg_dump` on the **entire multi-tenant database**, exposing data across all schools. | [backend/src/routes/backups.ts:6-9](file:///d:/Project_Abir/attendoschool/backend/src/routes/backups.ts#L6-L9) | Restrict backup trigger and download endpoints exclusively to `SUPER_ADMIN`. |
| **Medium** | **Memory Leak in Rate Limiter** | `apiRateLimit` stores requests in a global `buckets = new Map()`. Map keys (`ip:userId`) are never deleted or expired, causing unbounded memory growth under prolonged traffic. | [backend/src/middleware/security.ts:3-24](file:///d:/Project_Abir/attendoschool/backend/src/middleware/security.ts#L3-L24) | Implement a periodic sweep or use an LRU / Redis cache with TTL for rate-limiting buckets. |
| **Medium** | **Missing Backend Role Guards** | Several endpoints (e.g. `POST /api/academic-years`, `POST /api/academic-years/:id/archive`) check `requireAuth` and verify `schoolId`, but omit `requireRoles('SCHOOL_ADMIN')`. A linked teacher could invoke session archiving. | [backend/src/routes/academicYears.ts:10-67](file:///d:/Project_Abir/attendoschool/backend/src/routes/academicYears.ts#L10-L67) | Enforce explicit `requireRoles('SCHOOL_ADMIN')` on all administrative mutation routes. |
| **Medium** | **Hardcoded Fallback JWT Secret** | `env.ts` defaults `jwtSecret` to `'development-only-secret'` if `JWT_SECRET` is unset. If deployed without setting the variable, tokens could be forged. | [backend/src/config/env.ts:6](file:///d:/Project_Abir/attendoschool/backend/src/config/env.ts#L6) | Throw a fatal error on startup in production if `JWT_SECRET` is missing or shorter than 32 characters. |
| **Low** | **Default Password Provisioning** | When creating students or teachers, default passwords `'ChangeMe123!'` are assigned without forcing password rotation on first login. | [backend/src/routes/schoolData.ts](file:///d:/Project_Abir/attendoschool/backend/src/routes/schoolData.ts) | Introduce a `must_change_password` boolean flag on the `users` table. |
| **Positive** | **SQL Injection Immunity** | All database queries across all services utilize parameterized statements (`$1, $2, ...`). No raw SQL string interpolation with user input was identified. | Entire Backend | Maintain parameterized queries as an architectural standard. |
| **Positive** | **Timing Attack Mitigation** | Razorpay checkout and webhook signature verifications utilize `crypto.timingSafeEqual` to prevent timing attacks. | [backend/src/services/razorpayService.ts:28,33](file:///d:/Project_Abir/attendoschool/backend/src/services/razorpayService.ts#L28) | Exemplary cryptographic verification pattern. |

---

## 24. Performance Review

### Confirmed Issues
1. **Unbounded Rate-Limiter Map**: [backend/src/middleware/security.ts:3](file:///d:/Project_Abir/attendoschool/backend/src/middleware/security.ts#L3) retains every historical client IP in memory without eviction.
2. **Sequential Loop Inserts in Attendance Submission**: In [backend/src/routes/teacher.ts:95-100](file:///d:/Project_Abir/attendoschool/backend/src/routes/teacher.ts#L95-L100), attendance records are inserted using a sequential `for (const st of students)` loop with individual `await client.query()` calls instead of a single multi-row batch insert (`INSERT ... VALUES (...), (...)`). In a class of 60 students, this triggers 60 consecutive round-trips to PostgreSQL inside a single transaction.

### Potential Improvements
1. **Multi-Row Insert Batching**: Rewrite attendance submission to use `UNNEST` or dynamically constructed parameterized multi-row `VALUES` tuples to reduce round-trips from N to 1.
2. **Composite Indexes for Attendance Filtering**: While foreign keys are indexed, adding composite indexes on `attendance_records(attendance_session_id, is_present)` and `attendance_sessions(school_id, attendance_date)` will accelerate report aggregations as historical data scales into millions of rows.
3. **Connection Pool Sizing**: Configure `max` pool size in `backend/src/db.ts` tailored to container memory limits rather than relying on `pg` library defaults (10 connections).

---

## 25. Error Handling

1. **API Layer**: Centralized error middleware in [backend/src/app.ts:153-160](file:///d:/Project_Abir/attendoschool/backend/src/app.ts#L153-L160):
   ```typescript
   app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
     console.error('Unhandled server error:', err);
     const status = Number(err.status || err.statusCode || 500);
     res.status(status).json({
       message: err.message || 'Internal server error',
       ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
     });
   });
   ```
2. **Transaction Rollback**: Multi-statement database operations in services wrap queries in `BEGIN` / `COMMIT` / `ROLLBACK` blocks inside `try...catch...finally` ensuring `client.release()` is executed regardless of query success or failure.
3. **Frontend UI Notifications**: The frontend catches Axios rejections, extracts `e?.response?.data?.message`, and renders contextual alerts or toasts via `Toast.tsx`.

---

## 26. Logging & Monitoring

- **Console Logging**: Standard output streams capture server lifecycle events (`Server running on...`, `Received SIGINT...`), worker operations (`[notification-worker]`, `[subscription-worker]`), and error stacks.
- **Database Audit Logs**: The `audit_logs` and `admin_activity_logs` tables record administrative actions (`action`, `resource_type`, `resource_id`, `details`, `ip_address`).
- **Security Audit Logs**: The `security_events` table logs authentication events (`LOGIN_SUCCESS`, `LOGIN_FAILED`, `ACCOUNT_LOCKED`).
- **Health & Readiness Endpoints**:
  - `GET /health`: Uptime and basic process liveness.
  - `GET /api/health`: Validates active PostgreSQL pool connectivity.
  - `GET /api/production/ready`: Production gate returning readiness status.

---

## 27. Testing

### Test Suites Identified

| Test File | Framework / Runner | Location | Purpose |
|---|---|---|---|
| `comprehensive-test-suite.ts` | Custom Runner (`tsx`) | [backend/tests/comprehensive-test-suite.ts](file:///d:/Project_Abir/attendoschool/backend/tests/comprehensive-test-suite.ts) | 93-assertion automated suite validating schema, migrations, security, and routes |
| `automated-e2e-journey.ts` | Custom Runner (`tsx`) | [backend/tests/automated-e2e-journey.ts](file:///d:/Project_Abir/attendoschool/backend/tests/automated-e2e-journey.ts) | Simulates full lifecycle: Super Admin -> School -> Teacher -> Attendance -> Invoice |
| `api-smoke.ts` | Custom Runner (`tsx`) | [scripts/api-smoke.ts](file:///d:/Project_Abir/attendoschool/scripts/api-smoke.ts) | HTTP smoke tests against live running server |
| `integration-smoke.ts` | Custom Runner (`tsx`) | [scripts/integration-smoke.ts](file:///d:/Project_Abir/attendoschool/scripts/integration-smoke.ts) | Production integration smoke tests |
| `smoke.spec.ts` | Playwright | [tests/e2e/smoke.spec.ts](file:///d:/Project_Abir/attendoschool/tests/e2e/smoke.spec.ts) | Browser automation testing login page load and rendering |

### Untested Functionality
- Direct unit tests for React components (`@testing-library/react` is not installed).
- Live email delivery mocking (Nodemailer tests depend on environment variables).
- Real Razorpay API communication (mocked in tests).

---

## 28. Development Setup

> [!NOTE]
> For a quick step-by-step developer walkthrough, see **[SETUP.md](file:///d:/Project_Abir/attendoschool/SETUP.md)**.

### Prerequisites
- **Node.js**: `v20.x` or `v22.x`+ (LTS)
- **npm**: `v10.x`+
- **Java JRE/JDK**: Version 11 or 21+ (Required by the Firebase Local Emulator Suite)
- **PostgreSQL**: `v16.x` *(Optional, if utilizing PostgreSQL persistence engine)*

---

## 29. Installation

Clone the repository and install dependencies in both application tiers:

```bash
# Clone repository
git clone https://github.com/Mrinmoypatratint/attendoschool.git
cd attendoschool

# Install Backend Dependencies
cd backend
npm install

# Install Frontend Dependencies
cd ../frontend
npm install
```

---

## 30. Database Setup & Seeding

### Option A: Firebase Cloud Firestore Emulator (Recommended for Local Dev)
1. In `backend/.env`, ensure `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` and `FIREBASE_PROJECT_ID=attendoschool-saas` are configured.
2. Launch the emulator:
   ```bash
   cd backend
   npm run emulator:firestore
   ```
   *(Emulator runs on `127.0.0.1:8080`, Web console at `http://127.0.0.1:4000/firestore`)*
3. Seed the emulator with demo institutions, accounts, and student rosters:
   ```bash
   cd backend
   npm run seed:firestore
   ```

### Option B: PostgreSQL Relational Database
1. Launch container via Docker:
   ```bash
   docker compose up -d postgres
   ```
2. Configure `DATABASE_URL` in `backend/.env`:
   ```env
   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/school_attendance
   ```
3. Execute automated schema creation and all 29 migrations:
   ```bash
   cd backend
   npm run db:migrate
   ```

---

## 31. Running the Application

For local development with the Firebase Emulator, maintain three terminal processes:

### Terminal 1: Firebase Firestore Emulator
```bash
cd backend
npm run emulator:firestore
```

### Terminal 2: Backend API Server
```bash
cd backend
npm run dev
```
*API server listens on **http://localhost:5000**.*

### Terminal 3: Frontend Web Application
```bash
cd frontend
npm run dev
```
*Vite web application is live at **http://localhost:5173**.*

### Initial Demo Accounts & Credentials
All seeded development accounts use the password: **`ChangeMe123!`**
- **Platform Super Admin**: `superadmin@attendance.local`
- **School Administrator (Greenwood International School)**: `admin@demo-school.local` / `admin@greenwood.local`
- **Classroom Teacher (Faculty)**: `rahul@demo-school.local` / `teacher@greenwood.local`
- **Student (Rohan Sharma, Class 10 - Section A, Roll No. 25)**: `student@greenwood.local` or Roll No. `25`

---

## 32. Build & Production

To compile production-ready distribution bundles:

```bash
# Build Backend (Compiles TypeScript to backend/dist)
cd backend
npm run build

# Start Production Backend
npm run start

# Build Frontend (Compiles Vite React bundle to frontend/dist)
cd ../frontend
npm run build

# Preview Production Frontend
npm run preview
```

---

## 33. Deployment Architecture

```mermaid
flowchart TD
    subgraph Internet["Public Web"]
        Users["End Users (Admins, Teachers, Parents)"]
    end

    subgraph ReverseProxy["Edge / Reverse Proxy Tier"]
        NginxProxy["Nginx Container (Port 80 / 443)\n- SSL Termination\n- Gzip / Security Headers"]
    end

    subgraph AppTier["Application Container Tier"]
        FrontendService["Frontend Container\n(Nginx 1.27 Alpine + Static React Assets)"]
        BackendService["Backend Container\n(Node.js 20 Alpine + Express 5 API)"]
        WorkerService["Background Worker\n(Node.js 20 Alpine)"]
    end

    subgraph DataTier["Managed Persistence Tier"]
        PostgresDB[("PostgreSQL 16 Engine\n(Persistent Volume / Neon.tech / Render DB)")]
    end

    Users --> NginxProxy
    NginxProxy -->|"/* (Static SPA Routes)"| FrontendService
    NginxProxy -->|"/api/* (REST API Calls)"| BackendService
    BackendService --> PostgresDB
    WorkerService --> PostgresDB
```

The repository includes ready-to-deploy configurations for:
1. **Render.com Blueprint** (`render.yaml`): Automatic deployment of web service and managed PostgreSQL.
2. **Vercel / Netlify** (`frontend/vercel.json`, `frontend/public/_redirects`): Static frontend hosting with SPA fallback rewrites.
3. **Docker Compose Production** (`docker-compose.production.yml`): Complete three-tier multi-container stack with Nginx, backend API, frontend static server, and PostgreSQL with healthchecks.

---

## 34. CI/CD

- **Current Implementation**: Continuous Integration workflows are **Not identified in the current codebase** (no `.github/workflows` directory exists).
- **Automated Verification Scripts**: The repository includes local pre-deployment smoke scripts:
  - `npm run release:check` (runs `npm run build && npm run test:api-smoke`)
  - `scripts/production-check.sh`
  - `scripts/api-smoke.ts`
  - `scripts/integration-smoke.ts`

---

## 35. Major Business Workflows

### 35.1 Daily Classroom Attendance Workflow

```mermaid
sequenceDiagram
    autonumber
    actor T as Teacher
    participant UI as React Attendance View
    participant API as Backend (/api/teacher/attendance)
    participant DB as PostgreSQL
    participant Q as SMS / Notification Queue

    T->>UI: Select assigned class routine slot
    UI->>API: GET /api/teacher/students/:classId/:sectionId
    API->>DB: Query active students in class & section
    DB-->>API: Student roster
    API-->>UI: Display roster with attendance toggles (default: Present)

    T->>UI: Toggle absent students & click "Submit Attendance"
    UI->>API: POST /api/teacher/attendance { classId, sectionId, presentStudentIds, ... }
    
    API->>DB: BEGIN Transaction
    API->>DB: Check for duplicate session on same date/time
    API->>DB: INSERT INTO attendance_sessions (...) RETURNING id
    API->>DB: INSERT INTO attendance_records (session_id, student_id, is_present)
    API->>DB: COMMIT Transaction

    API->>Q: queueAbsentSms(sessionId)
    Q->>DB: INSERT INTO sms_logs (status: 'QUEUED') for all absent students
    API->>Q: queueAbsentNotifications(sessionId)

    API-->>UI: 201 Created { total, present, absent, smsQueued }
    UI-->>T: Show confirmation toast & summary statistics
```

### 35.2 Absence Notification Pipeline

```mermaid
sequenceDiagram
    autonumber
    participant Session as Attendance Submission
    participant NotifSvc as notificationService.ts
    participant DB as PostgreSQL (sms_logs / notification_logs)
    participant Worker as smsWorker / notificationWorker
    participant Provider as External SMS / SMTP Gateway
    actor Parent as Student Parent

    Session->>NotifSvc: queueAbsentNotifications(sessionId)
    NotifSvc->>DB: Query absent students and parent contact numbers
    NotifSvc->>NotifSvc: Interpolate template placeholders ({student_name}, {time}...)
    NotifSvc->>DB: INSERT INTO notification_logs (status: 'QUEUED', channel: 'SMS')

    loop Worker Cron / Background Process
        Worker->>DB: SELECT * FROM notification_logs WHERE status='QUEUED' LIMIT 100 FOR UPDATE
        Worker->>Provider: Dispatch HTTP POST /send-sms or SMTP Mail
        alt Provider Returns Success
            Provider-->>Worker: HTTP 200 { messageId: "msg-123" }
            Worker->>DB: UPDATE notification_logs SET status='SENT', sent_at=NOW()
            Provider->>Parent: Deliver SMS / WhatsApp Alert
        else Provider Returns Failure
            Provider-->>Worker: HTTP Error / Timeout
            Worker->>DB: UPDATE notification_logs SET status='FAILED', attempts=attempts+1
        end
    end
```

### 35.3 SaaS Subscription Checkout & GST Invoicing

```mermaid
sequenceDiagram
    autonumber
    actor Admin as School Admin
    participant UI as Subscription Page
    participant API as Payment Router (/api/school-payment)
    participant Rzp as Razorpay Gateway
    participant DB as PostgreSQL
    participant PDF as PDFKit Invoice Generator

    Admin->>UI: Select Subscription Plan & Duration (e.g. Standard, 365 Days)
    UI->>API: POST /api/school-payment/order { planId, days, gateway: 'RAZORPAY' }
    API->>Rzp: POST /v1/orders { amount: 11798.82, currency: 'INR' }
    Rzp-->>API: Order Created { id: 'order_xyz' }
    API->>DB: INSERT INTO payments (provider_order_id, status: 'CREATED', amount: 11798.82)
    API-->>UI: Return Razorpay Checkout Options { orderId, keyId, amount }

    Admin->>UI: Complete Payment in Razorpay Modal
    UI->>API: POST /api/school-payment/razorpay/verify { orderId, paymentId, signature }
    API->>API: Verify HMAC-SHA256 signature using RAZORPAY_KEY_SECRET
    
    API->>DB: UPDATE payments SET status='PAID', provider_payment_id=paymentId
    API->>DB: UPDATE school_subscriptions SET end_date=end_date+365, status='ACTIVE'
    
    API->>PDF: Generate Tax Invoice (18% GST: 9% CGST + 9% SGST)
    PDF-->>API: PDF Buffer
    API->>DB: INSERT INTO subscription_invoices (invoice_number, amount, gst_amount, status: 'PAID')
    
    API-->>UI: 200 OK { success: true, invoiceNumber: 'INV-2026-...' }
    UI-->>Admin: Show success modal with "Download GST Tax Invoice" button
```

### 35.4 Academic Year Batch Student Promotion

```mermaid
sequenceDiagram
    autonumber
    actor Admin as School Admin
    participant UI as Student Promotion Page
    participant API as Promotion Route (/api/student-promotions)
    participant Svc as studentPromotionService.ts
    participant DB as PostgreSQL

    Admin->>UI: Select From-Year (2025-26) and To-Year (2026-27)
    UI->>API: GET /api/student-promotions/candidates?fromYearId=...
    API->>DB: Query students enrolled in active year
    DB-->>API: Student list
    API-->>UI: Render promotion candidate table

    Admin->>UI: Set actions (Promote to Class 9A, Retain in Class 8A, Graduate)
    Admin->>UI: Click "Process Batch Promotion"
    UI->>API: POST /api/student-promotions/process { fromYearId, toYearId, items }
    
    API->>Svc: promoteStudents(schoolId, adminId, fromYearId, toYearId, items)
    Svc->>DB: BEGIN Transaction
    loop Each Student in Batch
        Svc->>DB: INSERT INTO student_promotions (student_id, action, from_class_id, to_class_id...)
        alt Action == PROMOTED
            Svc->>DB: UPDATE students SET class_id=toClassId, section_id=toSectionId, academic_year_id=toYearId
            Svc->>DB: INSERT INTO student_enrollment_history_v28 (...)
        else Action == RETAINED
            Svc->>DB: UPDATE students SET academic_year_id=toYearId
        else Action == GRADUATED
            Svc->>DB: UPDATE students SET is_active=false
        end
    end
    Svc->>DB: COMMIT Transaction
    Svc-->>API: Promotion summary results
    API-->>UI: 200 OK { processed: count, successful: count }
```

### 35.5 Timetable Conflict Detection

```mermaid
sequenceDiagram
    autonumber
    actor Admin as School Admin
    participant UI as Timetable Matrix View
    participant API as Timetable Route (/api/timetable)
    participant Svc as timetableService.ts
    participant DB as PostgreSQL

    Admin->>UI: Assign Teacher X to Class 9A in Period 3 (Room 101)
    UI->>API: GET /api/timetable/conflicts?periodId=...&teacherId=X&room=101
    API->>Svc: findConflicts(schoolId, query)
    
    Svc->>DB: SELECT * FROM timetable_entries WHERE school_id=$1 AND period_id=$2 AND (teacher_id=$3 OR room=$4)
    DB-->>Svc: Conflicting slot records
    
    alt Conflict Exists
        Svc-->>API: [ { type: 'TEACHER_CONFLICT', details: 'Teacher X already teaching Class 10B' } ]
        API-->>UI: HTTP 200 [ conflicts ]
        UI-->>Admin: Display Red Warning Alert: "Teacher Conflict Detected!"
    else No Conflicts
        Svc-->>API: []
        API-->>UI: HTTP 200 []
        Admin->>UI: Confirm Schedule Entry
        UI->>API: POST /api/timetable/entries
        API->>DB: INSERT INTO timetable_entries (...)
        API-->>UI: 201 Created
    end
```

---

## 36. Known Issues & Discrepancies

1. **Seed Data in Dual-Engine Environments**:
   - When running with the Firebase Cloud Firestore Emulator, executing `npm run seed:firestore` seeds all 3 primary roles (`superadmin@attendance.local`, `admin@demo-school.local`, `rahul@demo-school.local`), Greenwood International School, Class 10-A students, and subscription plans.
   - When running on pure PostgreSQL without Firestore, the baseline [database/seed.sql](file:///d:/Project_Abir/attendoschool/database/seed.sql) seeds only `superadmin@attendance.local`, and additional schools and faculty accounts must be created through the Super Admin onboarding interface.
2. **Offline Attendance Insert Constraint Violation**:
   - In [backend/src/services/offlineAttendanceService.ts:41-44](file:///d:/Project_Abir/attendoschool/backend/src/services/offlineAttendanceService.ts#L41-L44), `processBatch()` attempts to insert into `attendance_records(attendance_session_id, student_id, status)`.
   - However, the `attendance_records` table schema has `is_present boolean NOT NULL` with no default value.
   - Calling `processBatch()` will fail with a PostgreSQL not-null constraint violation on `is_present` unless the column is explicitly passed in the query.
3. **Frontend Default Login Values**:
   - [frontend/src/App.tsx:52-53](file:///d:/Project_Abir/attendoschool/frontend/src/App.tsx#L52-L53) pre-populates the login form with `admin@demo-school.local` instead of the seeded `superadmin@attendance.local`.

---

## 37. Technical Debt

1. **Dual Route Aliasing (`-vXX` Endpoints)**: The backend mounts both clean paths (`/api/timetable`) and legacy incremental aliases (`/api/timetable-v22`, `/api/subscriptions-v19`, etc.) across 18 route files. Several frontend components still invoke `-vXX` paths. Standardizing the frontend on clean routes will eliminate redundant Express router stack entries.
2. **Single-File Frontend Concentration in `App.tsx`**: [frontend/src/App.tsx](file:///d:/Project_Abir/attendoschool/frontend/src/App.tsx) contains nearly 2,000 lines of code and bundles numerous distinct views (`Dashboard`, `Students`, `Teachers`, `Classes`, `Subjects`, `Routine`, `Attendance`, `History`). Breaking these into modular components under `frontend/src/pages/` will improve maintainability.
3. **In-Memory Rate Limiting**: The rate limiter in [backend/src/middleware/security.ts](file:///d:/Project_Abir/attendoschool/backend/src/middleware/security.ts) stores IP counts in a Node process `Map`. In a multi-instance production environment behind a load balancer, rate limits are not shared across server instances.

---

## 38. Future Improvements

1. **Redis Integration**: Adopt Redis for distributed rate limiting, session token blacklisting, and background job queuing with BullMQ.
2. **Automated CI/CD**: Implement GitHub Actions workflows for automated linting, TypeScript compilation, unit testing, and Docker container publishing.
3. **Comprehensive Component Testing**: Introduce Vitest and React Testing Library to provide unit and integration coverage for frontend UI components.
4. **WebSocket / Server-Sent Events (SSE)**: Implement real-time live attendance counters on the Super Admin and School Admin dashboards.

---

## 39. Project Status Matrix

| Feature / Module | Status | Evidence from Codebase |
|---|---|---|
| **Multi-Tenant Foundation** | **Implemented** | Foreign key constraints on `school_id` across 67 database tables |
| **Authentication & JWT** | **Implemented** | [backend/src/routes/auth.ts](file:///d:/Abir%200.1/attendoschool/backend/src/routes/auth.ts), `requireAuth` middleware |
| **Classroom Attendance Taking** | **Implemented** | [backend/src/routes/teacher.ts](file:///d:/Abir%200.1/attendoschool/backend/src/routes/teacher.ts), frontend `Attendance` component |
| **Attendance Corrections & Audit**| **Implemented** | [backend/src/routes/attendanceCorrections.ts](file:///d:/Abir%200.1/attendoschool/backend/src/routes/attendanceCorrections.ts), `attendance_correction_audit` table |
| **Academic Years & Promotions** | **Implemented** | [backend/src/routes/academicYears.ts](file:///d:/Abir%200.1/attendoschool/backend/src/routes/academicYears.ts), [backend/src/routes/studentPromotions.ts](file:///d:/Abir%200.1/attendoschool/backend/src/routes/studentPromotions.ts) |
| **Timetable & Conflict Engine** | **Implemented** | [backend/src/services/timetableService.ts](file:///d:/Abir%200.1/attendoschool/backend/src/services/timetableService.ts), [frontend/src/Timetable.tsx](file:///d:/Abir%200.1/attendoschool/frontend/src/Timetable.tsx) |
| **Offline Attendance Sync** | **Partially Implemented** | Queue implemented; insert query in `offlineAttendanceService.ts:41` lacks `is_present` |
| **Parent Portal** | **Implemented** | [backend/src/routes/parentPortal.ts](file:///d:/Abir%200.1/attendoschool/backend/src/routes/parentPortal.ts), [frontend/src/ParentPortal.tsx](file:///d:/Abir%200.1/attendoschool/frontend/src/ParentPortal.tsx) |
| **Student Portal & RBAC (v29)** | **Implemented** | [backend/src/routes/student.ts](file:///d:/Abir%200.1/attendoschool/backend/src/routes/student.ts), [backend/src/services/studentService.ts](file:///d:/Abir%200.1/attendoschool/backend/src/services/studentService.ts), [frontend/src/pages/student/](file:///d:/Abir%200.1/attendoschool/frontend/src/pages/student/), 41 automated tests |
| **SaaS Subscriptions & 18% GST**| **Implemented** | [backend/src/services/invoicePdfService.ts](file:///d:/Abir%200.1/attendoschool/backend/src/services/invoicePdfService.ts), PDFKit invoice generation |
| **Mock & Razorpay Payments** | **Implemented** | [backend/src/services/razorpayService.ts](file:///d:/Abir%200.1/attendoschool/backend/src/services/razorpayService.ts), webhook signature verification |
| **Disaster Recovery Backups** | **Implemented** | [backend/src/services/backupService.ts](file:///d:/Abir%200.1/attendoschool/backend/src/services/backupService.ts), `pg_dump` execution & checksums |
| **Automated CI/CD Pipelines** | **Missing / Not Identified** | No `.github/` workflows directory exists in the codebase |

---

## 40. Troubleshooting

### Issue 1: "Invalid email or password" on Fresh Database
- **Cause**: Logging in with `admin@demo-school.local` on a freshly migrated database.
- **Solution**: Log in using the seeded Super Admin credentials (`superadmin@attendance.local` / `ChangeMe123!`). Create your school and school administrator from the Super Admin dashboard.

### Issue 2: Port 5000 or 5173 Already in Use
- **Cause**: Orphaned Node processes occupying ports.
- **Solution**:
  ```powershell
  # Windows PowerShell:
  Get-Process -Id (Get-NetTCPConnection -LocalPort 5000, 5173).OwningProcess | Stop-Process -Force
  ```

### Issue 3: Offline Attendance Sync Failure (`500 Internal Server Error`)
- **Cause**: `offlineAttendanceService.ts` omitting `is_present` column in `attendance_records` insert.
- **Workaround**: Submit attendance directly through the standard online classroom interface (`POST /api/teacher/attendance`).

---

## 41. Developer Guide

### Running Database Migrations Manually
```bash
cd backend
npx tsx src/scripts/migrate.ts
```

### Running Backend Test Suites
```bash
cd backend
npm test               # 50 comprehensive system assertions
npm run test:student   # 41 student portal & RBAC security tests
npm run test:api-smoke   # API integration smoke script
```

### Code Style & Architecture Guidelines
1. **Always Parameterize SQL**: Never interpolate user variables into raw query strings. Use `$1, $2` parameters.
2. **Tenant Scoping**: Every operational query on school entities must explicitly filter by `school_id = $1` extracted from `req.user.schoolId`.
3. **Transaction Safety**: Wrap multi-step mutations in `BEGIN` / `COMMIT` / `ROLLBACK` blocks. Always release clients in `finally`.

---

## 42. Contribution Guidelines

1. **Branching Strategy**: Create feature branches from `main` (`feature/feature-name` or `bugfix/issue-description`).
2. **Commit Hygiene**: Write declarative commit messages detailing component impact.
3. **Migration Numbering**: Increment database migration filenames sequentially (e.g. `030_description.sql`) under `database/migrations/`.
4. **Validation**: Execute `npm run release:check` before submitting pull requests.

---

## 43. Glossary

- **Tenant**: An educational institution (school or college) with strictly isolated data.
- **RBAC**: Role-Based Access Control enforcing permissions by role (`SUPER_ADMIN`, `SCHOOL_ADMIN`, `TEACHER`, `PARENT`, `STUDENT`).
- **CGST / SGST**: Central Goods and Services Tax (9%) and State Goods and Services Tax (9%), totaling an 18% statutory tax rate in India.
- **Routine**: The weekly timetable schedule mapping a class, section, subject, and teacher to a time window and room.
- **Idempotency**: Ensuring repeated API requests with the same key produce identical side-effects without duplicate billing or record creation.

---

## 44. Conclusion

AttendoSchool is an architecturally sound, feature-complete SaaS platform designed specifically for institutional school management. Its multi-tenant relational architecture, comprehensive 67-table schema, 242 API endpoints, and Indian GST billing engine provide an enterprise foundation for scaling educational operations. This documentation serves as the authoritative source of truth for the codebase as implemented.
