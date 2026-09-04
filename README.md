# School Attendance SaaS (v28 Production Release)

> A production-grade, multi-tenant SaaS platform for school attendance tracking, multi-channel parent communication (SMS, WhatsApp, Email), timetable management, automated student promotions, and subscription billing with GST invoicing.

[![Version](https://img.shields.io/badge/version-v28.0.0-blue.svg)](file:///c:/Users/Mrinmoy/Downloads/School-Attendance-SaaS-v28-COMPLETE-FIXED-3/README.md)
[![Backend](https://img.shields.io/badge/backend-Express%205%20%7C%20TypeScript-green.svg)](file:///c:/Users/Mrinmoy/Downloads/School-Attendance-SaaS-v28-COMPLETE-FIXED-3/backend)
[![Frontend](https://img.shields.io/badge/frontend-React%2019%20%7C%20Vite%207-indigo.svg)](file:///c:/Users/Mrinmoy/Downloads/School-Attendance-SaaS-v28-COMPLETE-FIXED-3/frontend)
[![Database](https://img.shields.io/badge/database-PostgreSQL%2016-blue.svg)](file:///c:/Users/Mrinmoy/Downloads/School-Attendance-SaaS-v28-COMPLETE-FIXED-3/database)
[![Tests](https://img.shields.io/badge/tests-93%20passed-emerald.svg)](file:///c:/Users/Mrinmoy/Downloads/School-Attendance-SaaS-v28-COMPLETE-FIXED-3/backend/tests)

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [User Roles & Demo Credentials](#user-roles--demo-credentials)
- [Feature Modules](#feature-modules)
- [Quick Start Guide](#quick-start-guide)
- [Environment Configuration](#environment-configuration)
- [Testing & Quality Assurance](#testing--quality-assurance)
- [API Reference](#api-reference)
- [Production Deployment](#production-deployment)
- [License](#license)

---

## Overview

**School Attendance SaaS** is designed for educational institutions ranging from single independent schools to multi-branch school networks. It simplifies daily attendance, immediately alerts parents of absent students, tracks academic calendars across sessions, and manages commercial SaaS subscriptions with GST-compliant billing.

### Key Highlights
- **Multi-Tenant Architecture**: Strict school-level data isolation backed by PostgreSQL foreign keys and role-based access control.
- **Fast Attendance Taking**: Teachers can mark a class of 50+ students in under 15 seconds. Checked students are marked present; unchecked students automatically become absent.
- **Automated Absence Alerts**: Instant dispatch across SMS, WhatsApp, and Email with dynamic template variables (`{student_name}`, `{class_name}`, `{time}`, `{teacher_name}`).
- **Offline Attendance**: Progressive Web capability allowing teachers to take attendance without active internet connectivity and synchronize once reconnected.
- **Complete Billing Lifecycle**: Starter, Growth, and Enterprise plans, 18% GST split (CGST 9% + SGST 9%), PDF invoice generation, Razorpay integration, and automated expiry workflows.
- **Modern UI/UX**: Built with a custom design system featuring dark/light mode toggle, toast notifications, skeleton loaders, and responsive layouts.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React 19 + Vite 7)             │
│    SPA Architecture · Dark/Light Mode · Context Auth API   │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / REST (Axios)
┌──────────────────────────────▼──────────────────────────────┐
│                    Backend (Node.js + Express 5)            │
│  TypeScript · JWT Auth · Security Headers · Rate Limiter    │
│  Centralized Error Handler · Graceful Shutdown Engine       │
└──────┬───────────────────────┬───────────────────────┬──────┘
       │                       │                       │
┌──────▼──────┐         ┌──────▼──────┐         ┌──────▼──────┐
│ PostgreSQL  │         │ Notification│         │ Background  │
│ Database    │         │ Queue Worker│         │ Workers     │
│ 28 Migrs.   │         │ SMS/WA/Mail │         │ Subscription│
└─────────────┘         └─────────────┘         └─────────────┘
```

### Technology Stack
- **Frontend**: React 19, TypeScript, Vite 7, React Router 7, Axios, Lucide Icons, Vanilla CSS Design System.
- **Backend**: Express 5, TypeScript, `pg` (PostgreSQL client pool), `bcryptjs`, `jsonwebtoken`, `pdfkit` (invoice generation), `nodemailer`.
- **Database**: PostgreSQL 16 with 28 incremental migration files (`007_v07` to `028_v28`).
- **Security**: Strict HTTP security headers (`nosniff`, `DENY` frames, referrer policy), memory-bucket API rate limiting (120 req/min), PBKDF2/bcrypt hashing, and request ID context propagation.

---

## User Roles & Demo Credentials

The platform provides dedicated workflows and dashboards tailored to each role:

| Persona | Role Key | Email | Password | Primary Capabilities |
|---|---|---|---|---|
| **Company Super Admin** | `SUPER_ADMIN` | `superadmin@attendance.local` | `ChangeMe123!` | School onboarding, plan management, global SaaS revenue monitoring, system backups, RBAC policies |
| **School Administrator** | `SCHOOL_ADMIN` | `admin@demo-school.local` | `ChangeMe123!` | Student/Teacher roster, Class 1-12 routines, reports, attendance corrections, academic year promotions, billing |
| **Teacher** | `TEACHER` | `rahul@demo-school.local` | `ChangeMe123!` | Today's assigned schedule, classroom attendance submission, attendance history, offline mode |
| **Teacher (Alt)** | `TEACHER` | `priya@demo-school.local` | `ChangeMe123!` | Secondary demo teacher account |
| **Parent** | `PARENT` | Onboarded via SMS/Email | — | Child attendance record lookup, attendance percentage, school notices |

---

## Feature Modules

### 1. Attendance & Operations
- **Classroom Attendance**: Teachers view only their assigned routine slots for the day. Unmarked students are automatically flagged absent.
- **Attendance Corrections**: Formal audit workflow allowing teachers to submit correction requests with approval notes and reasons.
- **Comprehensive Reports**: Student-wise and class-wise attendance percentages, presence/absence tallies, and one-click CSV export.
- **Offline Attendance Mode**: Local queueing in IndexedDB/localStorage with auto-sync when network connectivity is restored.

### 2. Parent Communication & Notifications
- **Multi-Channel Dispatch**: Native support for SMS, WhatsApp, and Email alerts.
- **Template Customization**: Per-channel custom templates with automated placeholder injection:
  - `{student_name}`, `{class_name}`, `{section}`, `{time}`, `{teacher_name}`, `{enquiry_number}`
- **School Announcements**: Broadcast announcements targeted to the entire school, specific grades, sections, or parents with priority tags (`NORMAL`, `HIGH`, `EMERGENCY`).

### 3. Academic Structure & Management
- **Academic Years**: Session management allowing creation, activation, and archiving of academic years without losing historical data.
- **Student Promotions**: Multi-student batch promotions (`PROMOTED`, `RETAINED`, `GRADUATED`, `TRANSFERRED`) carry students forward into new academic sessions.
- **Timetable & Period Engine**: Period configurations, break slots, room assignments, teacher conflict detection, and substitute teacher allocation.
- **Routines & Subjects**: Class 1 to 12 structure with custom sections (A, B, C...) and subject-teacher mapping.

### 4. SaaS Billing, Subscriptions & GST
- **Tiered Plans**: Starter, Standard, and Enterprise plans with student and teacher quota limits.
- **Indian GST Compliance**: Automated 18% GST calculation (split into CGST 9% and SGST 9%) with downloadable PDF tax invoices and receipts.
- **Payment Providers**: Mock payment gateway for local sandboxing and plug-and-play Razorpay integration for production.
- **Subscription Enforcement**: Automatic expiry calculation with configurable grace periods before restricting attendance operations.

### 5. Security & Disaster Recovery
- **Security Hardening**: Real-time password policy validator, brute force defense, and audit logging of all administrative actions.
- **Database Backups**: On-demand and scheduled backup creation with SHA-256 integrity checksum calculation and retention cleanup.
- **Advanced Analytics**: Platform-wide attendance ranking, daily attendance snapshot trends, and revenue metrics.

---

## Quick Start Guide

### Prerequisites
- **Node.js**: v20.x or v22.x+
- **npm**: v10.x+
- **Docker & Docker Compose** (Optional, for local PostgreSQL)

### 1. Clone & Setup Workspace
```bash
git clone https://github.com/your-org/school-attendance-saas.git
cd school-attendance-saas
```

### 2. Start PostgreSQL (Docker)
A ready-to-use Docker Compose configuration is included:
```bash
docker compose up -d postgres
```
*Note: This automatically initializes PostgreSQL 16 on port `5432` and applies the baseline schema and seed data.*

### 3. Install & Start Backend
```bash
cd backend
npm install
npm run dev
```
The API server starts on **http://localhost:5000**.

### 4. Install & Start Frontend
In a new terminal:
```bash
cd frontend
npm install
npm run dev
```
The web application is live at **http://localhost:5173**.

### 5. Initial Platform Access (Clean Slate)
The application starts with a clean database containing only the master platform Super Admin account:
- **Role**: Company Super Admin
- **Email**: `superadmin@attendance.local`
- **Password**: `ChangeMe123!`

All schools, school administrators, teachers, classes, and students are created dynamically by the Super Admin and School Admins through the platform.

### 6. (Optional) Run Background Workers
To run the automated background workers:
```bash
# In backend directory:
npm run worker                # SMS processing worker
npm run notification-worker   # Multi-channel notification worker
npm run subscription-worker   # Subscription expiry synchronization
```

---

## Environment Configuration

### Backend (`backend/.env`)
```env
PORT=5000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/school_attendance
JWT_SECRET=super-secret-jwt-key-for-local-testing-12345
CORS_ORIGIN=http://localhost:5173

# Payment Gateway (Optional in Mock mode)
RAZORPAY_KEY_ID=rzp_test_mock12345
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

# Email SMTP (Optional)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM="School Attendance <no-reply@attendance.local>"

# Company & Tax Details
COMPANY_NAME="School Attendance SaaS"
COMPANY_GSTIN="19AAACB1234P1Z5"
COMPANY_ADDRESS="Kolkata, WB, India"
COMPANY_PHONE="9000000000"
COMPANY_GST_RATE=18
```

### Frontend (`frontend/.env`)
```env
VITE_API_URL=http://localhost:5000/api
VITE_RAZORPAY_KEY_ID=rzp_test_mock12345
```

---

## Testing & Quality Assurance

The codebase includes two automated test suites covering both backend unit/integration tests and end-to-end user persona journeys:

### 1. Comprehensive Backend Test Suite
Executes 50 tests verifying schema tables, cryptographic hashing, JWT verification, rate limiting, security headers, template substitutions, GST tax calculations, and route authorization.
```bash
cd backend
npm test
```

### 2. End-to-End Persona Journey Test Suite
Tests 43 live scenarios simulating School Admin, Teacher, and Super Admin workflows, verifying HTML assets, CSS design tokens, and API endpoints.
```bash
cd backend
npx tsx tests/automated-e2e-journey.ts
```

### 3. TypeScript Build Verification
Verify clean compilation across both projects:
```bash
# Backend compilation check
cd backend && npm run build

# Frontend bundle compilation check
cd frontend && npm run build
```

---

## API Reference

All API routes are prefixed with `/api`. Protected routes require a Bearer token in the `Authorization` header (`Bearer <JWT>`).

### Authentication & Core
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | Public | Authenticate user and obtain JWT token |
| `GET` | `/api/auth/me` | Authenticated | Retrieve authenticated user profile |
| `GET` | `/api/health` | Public | Health check with database connection status |
| `GET` | `/api/production-v26/health` | Public | Production memory and uptime status |

### School Administration
| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/api/dashboard/school` | `SCHOOL_ADMIN` | School statistics and overview |
| `GET` | `/api/students` | `SCHOOL_ADMIN` | List all students in school |
| `POST` | `/api/students` | `SCHOOL_ADMIN` | Create a new student record |
| `GET` | `/api/teachers` | `SCHOOL_ADMIN` | List teacher accounts |
| `POST` | `/api/teachers` | `SCHOOL_ADMIN` | Create a new teacher account |
| `GET` | `/api/classes` | `SCHOOL_ADMIN` | List classes (5–12) with section counts |
| `GET` | `/api/routines` | `SCHOOL_ADMIN` | Master schedule of all class routines |
| `GET` | `/api/attendance-reports-v12/summary` | `SCHOOL_ADMIN` | Date-filtered attendance summary |
| `GET` | `/api/academic-years-v15` | `SCHOOL_ADMIN` | List all academic sessions |

### Teacher Operations
| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/api/teacher/routine/today` | `TEACHER` | Get teacher's assigned classes for today |
| `GET` | `/api/teacher/students/:classId/:sectionId`| `TEACHER` | Get class roster for attendance |
| `POST` | `/api/teacher/attendance` | `TEACHER` | Submit attendance session |
| `GET` | `/api/teacher/attendance/history` | `TEACHER` | View previously submitted sessions |

### Company Super Admin
| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/api/super-admin/overview` | `SUPER_ADMIN` | SaaS platform metrics and revenue |
| `GET` | `/api/super-admin/schools` | `SUPER_ADMIN` | Directory of all onboarded schools |
| `POST` | `/api/super-admin/schools` | `SUPER_ADMIN` | Onboard a new school with admin |
| `PUT` | `/api/super-admin/schools/:id/status` | `SUPER_ADMIN` | Activate or suspend school access |
| `GET` | `/api/super-admin/monitor` | `SUPER_ADMIN` | Operational dashboard and expiring schools |
| `GET` | `/api/super-admin/invoices` | `SUPER_ADMIN` | Invoices and payment receipts |
| `GET` | `/api/analytics-v24/platform` | `SUPER_ADMIN` | Platform analytics and rankings |

---

## Production Deployment

### Docker Production Stack
A multi-container setup with Nginx reverse proxy, PostgreSQL, and Node.js backend is provided in `docker-compose.production.yml`:

```bash
# 1. Configure production environment
cp .env.production.example .env.production

# 2. Build and launch production stack
docker compose -f docker-compose.production.yml up -d --build

# 3. Verify services are healthy
curl http://localhost/api/production-v26/health
```

### Production Checklist
- [ ] Ensure `JWT_SECRET` is set to a secure, randomly generated string (minimum 32 characters).
- [ ] Configure TLS/SSL certificate termination via Nginx or Cloudflare.
- [ ] Set up automated PostgreSQL daily backups via cron or managed database provider.
- [ ] Map production SMS provider gateway credentials in `backend/.env`.
- [ ] Connect production Razorpay API keys and configure webhook secret.

---

## License

This project is licensed under the MIT License. Commercial school deployment rights are governed by the respective SaaS subscription agreement.
