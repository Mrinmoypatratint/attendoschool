# AttendoSchool — Enterprise Attendance & School Operations Platform

> A production-grade, multi-tenant SaaS platform for school attendance tracking, multi-channel guardian notifications (SMS, WhatsApp, Email), timetable management, automated student promotions, and subscription billing with Indian GST invoicing.

[![Release](https://img.shields.io/badge/release-Production%20Ready-blue.svg)](#)
[![Backend](https://img.shields.io/badge/backend-Express%205%20%7C%20TypeScript-green.svg)](file:///d:/Project_Abir/attendoschool/backend)
[![Frontend](https://img.shields.io/badge/frontend-React%2019%20%7C%20Vite%207-indigo.svg)](file:///d:/Project_Abir/attendoschool/frontend)
[![Primary DB](https://img.shields.io/badge/primary%20database-Supabase%20PostgreSQL%2016-3ECF8E.svg)](file:///d:/Project_Abir/attendoschool/database)
[![Secondary DB](https://img.shields.io/badge/failover%20store-Cloud%20Firestore-FFCA28.svg)](file:///d:/Project_Abir/attendoschool/backend/src/firebase.ts)
[![Tests](https://img.shields.io/badge/tests-93%20passed-emerald.svg)](file:///d:/Project_Abir/attendoschool/backend/tests)

## Live Deployments & Endpoints

| Environment / Service | Provider | Status | URL |
|---|---|---|---|
| **Frontend Production App** | Hostinger Web Hosting (LiteSpeed / FTPS) | [![Deploy](https://img.shields.io/badge/status-Live-brightgreen.svg)](#) | **[https://attendoschool.optinetinnovations.in](https://attendoschool.optinetinnovations.in)** |
| **Backend REST API** | Render Cloud (Node.js 20 LTS) | [![API](https://img.shields.io/badge/status-Active-blue.svg)](#) | **[https://attendoschool-backend.onrender.com](https://attendoschool-backend.onrender.com)** |
| **Backend Health Check** | Render Cloud Endpoint | [![Health](https://img.shields.io/badge/probe-200%20OK-emerald.svg)](#) | **[https://attendoschool-backend.onrender.com/api/health](https://attendoschool-backend.onrender.com/api/health)** |
| **CI/CD Pipeline** | GitHub Actions | [![CI/CD](https://github.com/Mrinmoypatratint/attendoschool/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/Mrinmoypatratint/attendoschool/actions/workflows/ci-cd.yml) | **[GitHub Actions Runs](https://github.com/Mrinmoypatratint/attendoschool/actions)** |

---

## Quick Navigation

- **[Enterprise SRS Specification (ATTENDOSCHOOL_SRS.md)](file:///d:/Project_Abir/attendoschool/ATTENDOSCHOOL_SRS.md)** — Complete enterprise-grade Software Requirements Specification (SRS) with workflows, ERDs, sequence diagrams, and traceability matrices.
- **[Firebase Data Architecture (FIREBASE_DATA_ARCHITECTURE.md)](file:///d:/Project_Abir/attendoschool/FIREBASE_DATA_ARCHITECTURE.md)** — Core specification for 100% Firebase-backed, school-isolated data architecture.
- **[Multi-Tenant Security Architecture (MULTI_TENANT_SECURITY.md)](file:///d:/Project_Abir/attendoschool/MULTI_TENANT_SECURITY.md)** — Multi-tenant security principles, JWT derivation, and RBAC matrix.
- **[School Data Isolation (SCHOOL_DATA_ISOLATION.md)](file:///d:/Project_Abir/attendoschool/SCHOOL_DATA_ISOLATION.md)** — Detailed specification of tenant partitioning, query scoping, and zero-fallback data hygiene.
- **[Firebase Security Rules Specification (FIREBASE_SECURITY_RULES.md)](file:///d:/Project_Abir/attendoschool/FIREBASE_SECURITY_RULES.md)** — Production Firestore rules, helper functions, and custom claims verification.
- **[Dashboard Data Mapping (DASHBOARD_DATA_MAPPING.md)](file:///d:/Project_Abir/attendoschool/DASHBOARD_DATA_MAPPING.md)** — Direct mapping of all dashboard metrics and cards to Firestore collections and aggregation queries.
- **[Data Integrity & Isolation Test Plan (DATA_INTEGRITY_TEST_PLAN.md)](file:///d:/Project_Abir/attendoschool/DATA_INTEGRITY_TEST_PLAN.md)** — Verification procedures for cross-tenant boundaries, clean slate testing, and preview workflows.
- **[Detailed Setup Guide (SETUP.md)](file:///d:/Project_Abir/attendoschool/SETUP.md)** — Step-by-step installation, environment variables, Firebase emulator, and troubleshooting.
- **[System Architecture & Documentation (DOCUMENTATION.md)](file:///d:/Project_Abir/attendoschool/DOCUMENTATION.md)** — Comprehensive 2,300+ line technical architecture, schemas, and API documentation.
- **[Hostinger Full-Stack VPS Guide (HOSTINGER-VPS-DEPLOYMENT.md)](file:///d:/Project_Abir/attendoschool/HOSTINGER-VPS-DEPLOYMENT.md)** — Host frontend and backend together on Hostinger VPS with Nginx, PM2, and SSL.
- **[Hostinger hPanel CI/CD Guide (HOSTINGER-DEPLOYMENT-GUIDE.md)](file:///d:/Project_Abir/attendoschool/HOSTINGER-DEPLOYMENT-GUIDE.md)** — Automated GitHub Actions CI/CD to Hostinger hPanel subdomain.
- **[Cloud Deployment Guide (CLOUD-DEPLOYMENT-GUIDE.md)](file:///d:/Project_Abir/attendoschool/CLOUD-DEPLOYMENT-GUIDE.md)** — Cloud deployment instructions for Render, Vercel, and Docker.

---

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Key Features](#key-features)
- [User Roles & Demo Credentials](#user-roles--demo-credentials)
- [Quick Start Guide](#quick-start-guide)
  - [1. Clone & Install Dependencies](#1-clone--install-dependencies)
  - [2. Start the Firebase Firestore Emulator](#2-start-the-firebase-firestore-emulator)
  - [3. Seed Demo Data](#3-seed-demo-data)
  - [4. Launch Backend API Server](#4-launch-backend-api-server)
  - [5. Launch Frontend Web App](#5-launch-frontend-web-app)
- [Environment Configuration](#environment-configuration)
- [Testing & Quality Assurance](#testing--quality-assurance)
- [API Reference](#api-reference)
- [Production Deployment](#production-deployment)
- [License](#license)

---

## Overview

**AttendoSchool** is built for educational institutions ranging from single independent academies to multi-branch school networks. It automates daily attendance taking, instantly notifies parents of absent students, schedules class routines across academic years, and manages commercial SaaS subscriptions with 18% GST tax invoices.

### Key Highlights
- **Dual Database Persistence**: First-class support for **Firebase Cloud Firestore** (with offline local emulator) as the primary document store, alongside **PostgreSQL 16** (incremental migrations).
- **Unified Student Portal**: Comprehensive student portal (`/student/dashboard`) providing daily routines, subject-wise attendance analytics, assignments & homework submissions, examination timetables & grade cards, leave applications, and campus notice announcements.
- **Role-Based Email Onboarding**: When registering students, administrators can configure Student Portal login using the student's direct email or the parent/guardian's email. When registering faculty, official emails are linked for Faculty Portal access.
- **Anti-Spam Welcome & Password Setup**: RFC-compliant multipart transactional emails with high-deliverability headers, spam filter avoidance, and single-use 24-hour setup links.
- **Dedicated Password Reset Interface**: Clean, institutional `/reset-password` page with real-time password requirement checklists, hash routing resilience, and a self-service "Forgot Password?" flow on the login page.
- **Sub-15-Second Attendance**: Intuitive UI allowing teachers to mark a class of 50+ students in under 15 seconds. Present students are confirmed with bulk controls; unmarked students are flagged absent.
- **Automated Absence Alerts**: Instant dispatch across SMS, WhatsApp, and Email with dynamic placeholders (`{student_name}`, `{class_name}`, `{time}`, `{teacher_name}`).
- **Audit-Trailed Corrections**: Post-submission attendance modifications require structured correction tickets with teacher remarks and administrator approval.
- **Complete Billing Lifecycle**: Starter, Standard, and Enterprise tiers, 18% GST split (CGST 9% + SGST 9%), downloadable PDF tax invoices via PDFKit, and Razorpay integration.
- **Offline Attendance**: Progressive offline queueing in IndexedDB/localStorage with automated synchronization when internet connectivity restores.
- **Flexible Notification Architecture**: Nodemailer SMTP with CID-embedded school logos, development sandbox fallback, diagnostic health endpoints (`/api/health/email-status`), and HTTP email API support for cloud providers blocking outbound SMTP ports.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│               Frontend Client (React 19 + Vite 7)           │
│   Split-Screen Login · Super Admin · School Admin · Teacher │
│   Student Portal · Password Reset · Light Institutional UI  │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / REST (Axios)
┌──────────────────────────────▼──────────────────────────────┐
│                  Backend API (Node.js + Express 5)          │
│   TypeScript · JWT Auth · Security Headers · Rate Limiter   │
│   Anti-Spam Email Service · Centralized Error Handler       │
└───────────────┬─────────────────────────────┬───────────────┘
                │                             │
    ┌───────────▼────────────┐    ┌───────────▼───────────┐
    │ Firebase Cloud Firestore│    │  PostgreSQL 16 Engine │
    │ (Local Emulator / Cloud)│    │  (Relational Storage) │
    │ Collections: users,     │    │  67 Normalized Tables │
    │ schools, students, etc. │    │  33 Migration Sets    │
    └─────────────────────────┘    └───────────────────────┘
                │                             │
    ┌───────────▼────────────┐    ┌───────────▼───────────┐
    │ Notification Dispatch  │    │ Background Workers    │
    │ SMS · WhatsApp · Email │    │ Subscription Sync     │
    └─────────────────────────┘    └───────────────────────┘
```

### Technology Stack
- **Frontend**: React 19, TypeScript, Vite 7, React Router 7, Axios, Lucide Icons, Clean Light Institutional Design System.
- **Backend**: Node.js, Express 5, TypeScript, Firebase Admin SDK (`firebase-admin` v14), PostgreSQL client (`pg`), `bcryptjs`, `jsonwebtoken`, `pdfkit`, `nodemailer`.
- **Database**:
  - **Firebase Cloud Firestore**: Cloud NoSQL document store with Firebase Local Emulator (`127.0.0.1:8080`, UI `127.0.0.1:4000/firestore`).
  - **PostgreSQL 16**: Relational storage engine with 33 migrations (`007_payment_invoices.sql` to `033_reattendance_and_cross_teacher_visibility.sql`) across 67 normalized tables.
- **Security**: Strict HTTP security headers (`nosniff`, `X-Frame-Options: DENY`, referrer policy), memory-bucket rate limiting (120 req/min), PBKDF2/bcrypt hashing, and request ID context propagation.

---

## User Roles & Demo Credentials

All administrative and portal accounts share the default credential password: **`ChangeMe123!`**

| Persona | Role Key | Email / Identifier | Password | Primary Capabilities |
|---|---|---|---|---|
| **Platform Super Admin** | `SUPER_ADMIN` | `superadmin@attendance.local` | `ChangeMe123!` | School onboarding, plan management, global SaaS revenue monitoring, system backups, RBAC policies |
| **School Administrator** | `SCHOOL_ADMIN` | `admin@demo-school.local` | `ChangeMe123!` | Student/Teacher roster, Class routines, reports, attendance corrections, academic year promotions, billing |
| **Classroom Teacher** | `TEACHER` | `rahul@demo-school.local` | `ChangeMe123!` | Today's assigned schedule, classroom attendance submission, attendance history, offline mode |
| **Classroom Teacher (Alt)** | `TEACHER` | `priya@demo-school.local` | `ChangeMe123!` | Secondary faculty account for routine and class allocation |
| **Student Portal** | `STUDENT` | `student@greenwood.local` | `ChangeMe123!` | Timetable, attendance percentage, homework & assignments, exam marks, announcements, leave requests |

> [!NOTE]
> **Clean Baseline Architecture (Zero Mock Data)**:
> In accordance with production hygiene standards, all operational dummy records (students, classes, sections, routines, and attendance sessions) have been purged. The database begins with **0 ghost students and 0 mock attendance sessions**, keeping strictly the foundational login credentials for authentication.

> [!IMPORTANT]
> **Scope Boundary: Unified Student Portal Only**
> There is **no separate Parent Portal** in AttendoSchool. Guardians who need access to their child's academic tracking are configured during student enrollment using **"Use Parent Email for Student Portal Login"**, which creates a Student Portal user account (`role = 'STUDENT'`). All guardian and student tracking is centralized within the **Student Portal** (`/student/dashboard`).

> [!TIP]
> On the login page, select **Greenwood International School** and click any of the **Quick Demo Switcher** buttons (`Super Admin`, `School Admin`, `Teacher`, `Student`) to auto-populate credentials instantly.

---

## Quick Start Guide

### Prerequisites
- **Node.js**: v20.x, v22.x, or v24.x+ (LTS)
- **npm**: v10.x+
- **Supabase PostgreSQL** account (or local PostgreSQL 16)

### 1. Clone & Install Dependencies
```bash
# Navigate to project root
cd attendoschool

# Install Backend Dependencies
cd backend
npm install

# Install Frontend Dependencies
cd ../frontend
npm install
```

### 2. Configure Database & Apply Migrations
Configure your Supabase connection URL in `backend/.env`:
```env
DB_DRIVER=postgres
USE_POSTGRES=true
DATABASE_URL=postgresql://postgres.xxx:password@aws-0-xx.pooler.supabase.com:5432/postgres
SUPABASE_DATABASE_URL=postgresql://postgres.xxx:password@aws-0-xx.pooler.supabase.com:5432/postgres
```

Run schema migrations and initialize baseline credentials:
```bash
cd backend
# 1. Run all 34 incremental database migrations
npm run db:migrate

# 2. Seed clean baseline login credentials
npx tsx src/scripts/seedGreenwoodSupabase.ts
```

### 3. (Optional) Historical Firebase Data Migration
If you previously used Firebase Cloud Firestore and wish to copy historical documents into Supabase:
```bash
cd backend
npm run migrate:firebase-to-supabase
```

### 4. Launch Backend API Server
```bash
cd backend
npm run dev
```
*Backend API server is live on [http://localhost:5000](http://localhost:5000).*

### 5. Launch Frontend Web App
```bash
cd frontend
npm run dev
```
*Frontend application is live on [http://localhost:5173](http://localhost:5173).*

---

## Environment Configuration

### Backend (`backend/.env`)
```env
PORT=5000
CORS_ORIGIN=http://localhost:5173
JWT_SECRET=super-secret-jwt-key-for-local-testing-12345

# Database Selection ('firebase' | 'postgres')
DB_DRIVER=firebase

# Firebase Firestore Emulator Configuration
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
FIREBASE_PROJECT_ID=attendoschool-saas

# PostgreSQL (Optional fallback)
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/school_attendance

# Communications (Mock for local dev)
SMS_PROVIDER=mock

# Company & Tax Details
COMPANY_NAME="AttendoSchool Technologies Inc."
COMPANY_GSTIN="19AAACB1234P1Z5"
COMPANY_ADDRESS="Campus 4, Tech Park Boulevard, Bengaluru, Karnataka"
COMPANY_PHONE="+91 90000 00000"
COMPANY_GST_RATE=18
```

### Frontend (`frontend/.env`)
```env
VITE_API_URL=http://localhost:5000/api
VITE_RAZORPAY_KEY_ID=rzp_test_mock12345
```

---

## Testing & Quality Assurance

The codebase includes comprehensive automated test suites:

### 1. Backend Integration & Unit Tests (50 Tests)
Tests schema tables, cryptographic hashing, JWT verification, rate limiting, security headers, template substitutions, GST calculations, and route authorization:
```bash
cd backend
npm test
```

### 2. End-to-End Persona Journey Suite (43 Tests)
Simulates School Admin, Teacher, and Super Admin workflows, checking API endpoints, tokens, and payloads:
```bash
cd backend
npx tsx tests/automated-e2e-journey.ts
```

### 3. API & Integration Smoke Tests
Smoke test production readiness and integration endpoints:
```bash
cd backend
npm run test:api-smoke
npm run test:integration-smoke
```

### 4. TypeScript Typecheck & Build
```bash
cd backend && npm run build
cd ../frontend && npm run build
```

---

## API Reference

All API routes are prefixed with `/api`. Protected routes require a Bearer token in the `Authorization` header (`Bearer <JWT>`).

### Authentication & Core
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | Public | Authenticate user (Firestore + PostgreSQL fallback) |
| `GET` | `/api/auth/me` | Authenticated | Retrieve authenticated user profile |
| `GET` | `/api/health` | Public | Health check with Firestore and PostgreSQL status |
| `GET` | `/api/production/health` | Public | Production memory and uptime status |

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
| `GET` | `/api/attendance-reports/summary` | `SCHOOL_ADMIN` | Date-filtered attendance summary |
| `GET` | `/api/academic-years` | `SCHOOL_ADMIN` | List all academic sessions |

### Teacher Operations
| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/api/teacher/routine/today` | `TEACHER` | Get teacher's assigned classes for today |
| `GET` | `/api/teacher/students/:classId/:sectionId`| `TEACHER` | Get class roster for attendance |
| `POST` | `/api/teacher/attendance` | `TEACHER` | Submit attendance session |
| `GET` | `/api/teacher/attendance/history` | `TEACHER` | View previously submitted sessions |

### Platform Super Admin
| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/api/super-admin/overview` | `SUPER_ADMIN` | SaaS platform metrics and revenue |
| `GET` | `/api/super-admin/schools` | `SUPER_ADMIN` | Directory of all onboarded schools |
| `POST` | `/api/super-admin/schools` | `SUPER_ADMIN` | Onboard a new school with admin |
| `PUT` | `/api/super-admin/schools/:id/status` | `SUPER_ADMIN` | Activate or suspend school access |
| `GET` | `/api/super-admin/monitor` | `SUPER_ADMIN` | Operational dashboard and expiring schools |
| `GET` | `/api/super-admin/invoices` | `SUPER_ADMIN` | Invoices and payment receipts |
| `GET` | `/api/analytics/platform` | `SUPER_ADMIN` | Platform analytics and rankings |

---

## Production Deployment

### Live Production Architecture
The platform runs a decoupled cloud architecture designed for high availability, automatic SSL, and zero-maintenance operations:

- **Frontend Client**: Hosted on **Hostinger Web Hosting (LiteSpeed / Apache)** at **[https://attendoschool.optinetinnovations.in](https://attendoschool.optinetinnovations.in)** with automatic SPA client-side routing (`.htaccess`) and free Let's Encrypt SSL.
- **Backend API**: Hosted on **Render Cloud (Node.js 20 LTS Web Service)** at **[https://attendoschool-backend.onrender.com](https://attendoschool-backend.onrender.com)**.
- **Primary Database**: Hosted on **Supabase PostgreSQL 16 Cloud** with transactional pooling and Supabase Realtime synchronization.
- **Failover / Historical Store**: **Google Cloud Firestore** (multi-tenant isolated document collections).

### Automated CI/CD (GitHub Actions)
Every `git push` to the `main` branch automatically triggers the AttendoSchool CI/CD pipeline (`.github/workflows/ci-cd.yml`):
1. **`backend-ci`**: Node 20 dependency caching, linting, and TypeScript compilation (`npm run build`).
2. **`frontend-ci`**: Typecheck (`tsc --noEmit`) and Vite production bundle compilation.
3. **`deploy-hostinger`**: Automated deployment to Hostinger via FTPS (`SamKirkland/FTP-Deploy-Action@v4.3.5`).

### Docker Production Stack
A multi-container setup with Nginx reverse proxy, PostgreSQL, and Node.js backend is provided in `docker-compose.production.yml`:

```bash
# 1. Configure production environment
cp .env.production.example .env.production

# 2. Build and launch production stack
docker compose -f docker-compose.production.yml up -d --build

# 3. Verify services are healthy
curl http://localhost/api/production/health
```

Refer to:
- **[HOSTINGER-DEPLOYMENT-GUIDE.md](file:///d:/Project_Abir/attendoschool/HOSTINGER-DEPLOYMENT-GUIDE.md)** for Hostinger hPanel automated deployment setup.
- **[HOSTINGER-VPS-DEPLOYMENT.md](file:///d:/Project_Abir/attendoschool/HOSTINGER-VPS-DEPLOYMENT.md)** for Hostinger VPS with Nginx and PM2.
- **[CLOUD-DEPLOYMENT-GUIDE.md](file:///d:/Project_Abir/attendoschool/CLOUD-DEPLOYMENT-GUIDE.md)** for Cloud deployment on Render, Railway, AWS, and Vercel.

---

## License

This project is licensed under the MIT License. Commercial school deployment rights are governed by the respective SaaS subscription agreement.
