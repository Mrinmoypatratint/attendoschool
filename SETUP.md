# AttendoSchool — Developer Setup & Operational Guide

> Comprehensive step-by-step guide for configuring, running, seeding, and deploying **AttendoSchool** in local development, testing, and production environments.

---

## Table of Contents

- [1. Prerequisites & System Requirements](#1-prerequisites--system-requirements)
- [2. Quick Start (Zero to Running in 5 Minutes)](#2-quick-start-zero-to-running-in-5-minutes)
- [3. Environment Variables Configuration](#3-environment-variables-configuration)
  - [3.1 Root & Backend Configuration (`backend/.env`)](#31-root--backend-configuration-backendenv)
  - [3.2 Frontend Configuration (`frontend/.env`)](#32-frontend-configuration-frontendenv)
- [4. Database Setup & Persistence Engines](#4-database-setup--persistence-engines)
  - [4.1 Firebase Cloud Firestore Emulator (Recommended for Local Dev)](#41-firebase-cloud-firestore-emulator-recommended-for-local-dev)
  - [4.2 Seeding Firestore with Demo Data](#42-seeding-firestore-with-demo-data)
  - [4.3 Connecting to Production Google Cloud Firebase](#43-connecting-to-production-google-cloud-firebase)
  - [4.4 PostgreSQL Relational Database (Alternative / Hybrid)](#44-postgresql-relational-database-alternative--hybrid)
- [5. Running the Application](#5-running-the-application)
  - [5.1 Terminal 1: Firebase Emulator](#51-terminal-1-firebase-emulator)
  - [5.2 Terminal 2: Backend API Server](#52-terminal-2-backend-api-server)
  - [5.3 Terminal 3: Frontend Web Application](#53-terminal-3-frontend-web-application)
- [6. Default User Accounts & Credentials](#6-default-user-accounts--credentials)
- [7. Verifying System Health](#7-verifying-system-health)
- [8. Background Workers (Optional)](#8-background-workers-optional)
- [9. Testing & Quality Assurance](#9-testing--quality-assurance)
- [10. Troubleshooting & Common Issues](#10-troubleshooting--common-issues)
- [11. Related Documentation](#11-related-documentation)

---

## 1. Prerequisites & System Requirements

Ensure the following runtimes and tools are installed on your workstation:

| Tool | Recommended Version | Purpose | Verification Command |
|---|---|---|---|
| **Node.js** | `v20.x` or `v22.x`+ (LTS) | JavaScript runtime for Backend & Frontend | `node -v` |
| **npm** | `v10.x`+ | Package management | `npm -v` |
| **Java Runtime (JRE/JDK)** | `Java 11` or `Java 21`+ | Required by Firebase Emulator suite | `java -version` |
| **Firebase CLI** | `firebase-tools v13+` or `npx` | Emulator and cloud deployment CLI | `npx firebase --version` |
| **Git** | `2.x+` | Source control | `git --version` |
| **Docker & Docker Compose** | *(Optional)* | Only if running local PostgreSQL container | `docker --version` |

> [!NOTE]
> If Java is not already installed on your system, download it from [Adoptium OpenJDK](https://adoptium.net/) or [Oracle Java](https://www.oracle.com/java/technologies/downloads/). The Firebase Firestore emulator runs locally inside Java.

---

## 2. Quick Start (Zero to Running in 5 Minutes)

Run the following commands in separate terminal sessions or in your IDE:

```bash
# 1. Clone repository (or navigate to workspace)
cd attendoschool

# 2. Install backend dependencies
cd backend
npm install

# 3. Install frontend dependencies
cd ../frontend
npm install

# 4. Start the Firebase Firestore Emulator (from backend/)
cd ../backend
npm run emulator:firestore

# 5. In a new terminal, seed the Firestore database (from backend/)
cd backend
npm run seed:firestore

# 6. Start the Backend API (from backend/)
npm run dev

# 7. In another terminal, start the Frontend (from frontend/)
cd frontend
npm run dev
```

Once running:
- **Frontend Web App**: [http://localhost:5173](http://localhost:5173)
- **Backend API Server**: [http://localhost:5000](http://localhost:5000)
- **Firebase Emulator UI**: [http://127.0.0.1:4000/firestore](http://127.0.0.1:4000/firestore)

---

## 3. Environment Variables Configuration

### 3.1 Root & Backend Configuration (`backend/.env`)

Copy `backend/.env.example` to `backend/.env` (or verify your existing `backend/.env`):

```bash
cp backend/.env.example backend/.env
```

Here is the standard local development `.env`:

```env
# Server Port & Core Settings
PORT=5000
CORS_ORIGIN=http://localhost:5173
JWT_SECRET=super-secret-jwt-key-for-local-testing-12345

# Database Persistence Selection
# Options: 'firebase' (default) | 'postgres'
DB_DRIVER=firebase

# Firebase Firestore Configuration (Emulator)
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
FIREBASE_PROJECT_ID=attendoschool-saas

# (Optional) Cloud Firebase Credentials (leave empty when using local emulator)
# FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
# FIREBASE_CLIENT_EMAIL=
# FIREBASE_PRIVATE_KEY=

# PostgreSQL Database (Optional / Fallback)
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/school_attendance

# Communications & SMS Settings (Mock mode for local dev)
SMS_PROVIDER=mock
SMS_PROVIDER_URL=
SMS_PROVIDER_API_KEY=
SMS_SENDER_ID=ATTNDO

# Billing & Tax Configurations
COMPANY_NAME="AttendoSchool Technologies Inc."
COMPANY_GSTIN="19AAACB1234P1Z5"
COMPANY_ADDRESS="Campus 4, Tech Park Boulevard, Bengaluru, Karnataka"
COMPANY_PHONE="+91 90000 00000"
COMPANY_GST_RATE=18

# Payment Gateway (Mock / Sandbox)
RAZORPAY_KEY_ID=rzp_test_mock12345
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

# Email SMTP (Optional)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM="AttendoSchool <no-reply@attendoschool.local>"
```

### 3.2 Frontend Configuration (`frontend/.env`)

Verify or create `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api
VITE_RAZORPAY_KEY_ID=rzp_test_mock12345
```

---

## 4. Database Setup & Persistence Engines

AttendoSchool includes a **dual-database architecture** supporting **Firebase Cloud Firestore** (with local emulator support) as the primary document store, alongside an enterprise **PostgreSQL 16** relational engine.

### 4.1 Firebase Cloud Firestore Emulator (Recommended for Local Dev)

The Firebase Emulator enables completely offline, fast development without needing a Google Cloud account or credit card.

1. **Configuration files**:
   - `firebase.json`: Defines Firestore port `8080` and Emulator UI port `4000`.
   - `firestore.rules`: Configured with open local development rules.
   - `.firebaserc`: Sets default project ID to `attendoschool-saas`.

2. **Start the emulator**:
   ```bash
   cd backend
   npm run emulator:firestore
   ```
   Or from the repository root:
   ```bash
   npx --yes firebase-tools emulators:start --only firestore
   ```

3. **Verify Emulator UI**:
   Open [http://127.0.0.1:4000/firestore](http://127.0.0.1:4000/firestore) in your browser. You can visually inspect collections, documents, and fields in real time.

### 4.2 Seeding Firestore with Demo Data

Once the emulator is running, populate it with demo users, a school, subscription tiers, and students:

```bash
cd backend
npm run seed:firestore
```

**Seed Results**:
- **1 Super Admin**: `superadmin@attendance.local` (Password: `ChangeMe123!`)
- **1 Demo School**: Greenwood International School (`school-greenwood-001`)
- **1 School Admin**: `admin@demo-school.local` (Password: `ChangeMe123!`)
- **1 Teacher**: `rahul@demo-school.local` (Password: `ChangeMe123!`)
- **3 Subscription Plans**: Basic ($499/mo), Standard ($999/mo), Enterprise ($1999/mo)
- **5 Demo Students**: Class 10 - Section A (`stud-001` through `stud-005`)

### 4.3 Connecting to Production Google Cloud Firebase

To connect to live Firebase Cloud Firestore instead of the emulator:

1. In the [Firebase Console](https://console.firebase.google.com/):
   - Create a project (e.g. `attendoschool-prod`).
   - Create a Cloud Firestore database.
   - Navigate to **Project Settings > Service accounts** and click **Generate new private key**.
2. Save the downloaded JSON file as `backend/serviceAccountKey.json`.
3. In `backend/.env`:
   - Comment out or delete `FIRESTORE_EMULATOR_HOST`.
   - Set:
     ```env
     FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
     FIREBASE_PROJECT_ID=attendoschool-prod
     ```
4. Or configure raw environment variables for cloud hosts (Render/Railway/Heroku):
   ```env
   FIREBASE_PROJECT_ID=attendoschool-prod
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@attendoschool-prod.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBA...==\n-----END PRIVATE KEY-----\n"
   ```

### 4.4 PostgreSQL Relational Database (Alternative / Hybrid)

If you wish to use PostgreSQL:

1. **Start PostgreSQL via Docker**:
   ```bash
   docker compose up -d postgres
   ```
2. **Apply migrations**:
   ```bash
   cd backend
   npm run db:migrate
   ```
3. Set `DB_DRIVER=postgres` in `backend/.env`.

---

## 5. Running the Application

For the optimal development workflow, keep three terminal windows active:

### 5.1 Terminal 1: Firebase Emulator

```bash
cd backend
npm run emulator:firestore
```
*Output: `Firestore Emulator running on 127.0.0.1:8080` and `View Emulator UI at http://127.0.0.1:4000/firestore`*

### 5.2 Terminal 2: Backend API Server

```bash
cd backend
npm run dev
```
*Output: `Server running on port 5000` and `[Firebase] Initialized in local/emulator mode`*

### 5.3 Terminal 3: Frontend Web Application

```bash
cd frontend
npm run dev
```
*Output: `VITE v7.1.3 ready in 350 ms` -> `Local: http://localhost:5173/`*

---

## 6. Default User Accounts & Credentials

The AttendoSchool sign-in interface provides 4 specialized login portals:
1. **Administrator Login**: Central platform and SaaS administration. Bypasses school selection with global multi-tenant access.
2. **School Admin Login**: Institutional management and Principal portal. Enforces selecting the school name before entering credentials.
3. **Teacher Login**: Faculty portal for daily attendance and timetable. Enforces selecting the school name before entering credentials.
4. **Student Login**: Student portal for attendance, timetables, homework, and exams. Enforces selecting the school name before entering credentials.

All seeded accounts share the default development password: **`ChangeMe123!`**

| Login Portal | Role | Identifier / Email | School Selection | Accessible Features |
|---|---|---|---|---|
| **Administrator Login** | `SUPER_ADMIN` | `superadmin@attendance.local` | *Not required (Global)* | School Onboarding, Subscriptions, Platform Analytics, System Backups, RBAC Management |
| **School Admin Login** | `SCHOOL_ADMIN` | `admin@demo-school.local` | Greenwood International School | Student & Teacher Directories, Routines, Attendance Corrections, Classrooms, Billing |
| **Teacher Login** | `TEACHER` | `rahul@demo-school.local`<br>`priya@demo-school.local` | Greenwood International School | Today's Assigned Timetable Slots, Class Attendance Taking, History, Offline Mode |
| **Student Login** | `STUDENT` | `student@greenwood.local`<br>(or Roll No. `25`) | Greenwood International School | Today Timetable, Attendance KPI, Homework & Assignments, Exams & Results, Leave Requests |

> [!TIP]
> On the sign-in screen at `http://localhost:5173`, click on any of the 4 tabs (**Administrator**, **School Admin**, **Teacher**, **Student**) to switch portals. Each tab features a 1-click **"Autofill Demo Credentials"** button for immediate testing.

---

## 7. Verifying System Health

### 1. Backend Health Check
Query the backend health route:
```bash
curl http://localhost:5000/api/health
```

Expected response:
```json
{
  "status": "ok",
  "database": {
    "postgres": "unavailable",
    "firestore": "connected"
  },
  "version": "production",
  "uptime": 128.4
}
```

### 2. Authentication Test
Test authentication against Firestore:
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"superadmin@attendance.local","password":"ChangeMe123!"}'
```

Expected response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-superadmin-001",
    "name": "Platform Super Administrator",
    "email": "superadmin@attendance.local",
    "role": "SUPER_ADMIN",
    "provider": "firestore"
  }
}
```

---

## 8. Background Workers (Optional)

The backend includes standalone background worker scripts:

```bash
# In backend/ directory:
npm run worker                # SMS processing queue worker
npm run notification-worker   # Multi-channel notification worker (SMS, WA, Mail)
npm run subscription-worker   # Automatic subscription expiration checker
npm run worker:production     # Unified production worker suite
```

---

## 9. Testing & Quality Assurance

Run the automated test suites to verify functionality:

```bash
# Comprehensive Backend Unit & Integration Tests (50 tests)
cd backend
npm test

# End-to-End Persona Journey Test Suite (43 scenarios)
cd backend
npx tsx tests/automated-e2e-journey.ts

# TypeScript Build Verification
cd backend && npm run build
cd ../frontend && npm run build
```

---

## 10. Troubleshooting & Common Issues

### 1. `Error: Could not find or load main class ...` when starting emulator
- **Cause**: Java JRE/JDK is not installed or not found in system `PATH`.
- **Solution**: Install OpenJDK (version 11 or 21+) and ensure `java -version` returns a valid runtime.

### 2. `NO_ADC_FOUND` or `Firebase credentials pending`
- **Cause**: Backend attempted to contact Cloud Firestore without credentials or without setting the emulator host.
- **Solution**: Ensure `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` is present in `backend/.env`.

### 3. Port Already in Use (`EADDRINUSE`)
- **Port 5000**: Backend API server. Kill the existing process:
  ```powershell
  # Windows PowerShell
  Get-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess | Stop-Process
  ```
- **Port 8080**: Firestore emulator.
- **Port 4000**: Firebase emulator web UI.
- **Port 5173**: Vite frontend dev server.

### 4. Firestore Emulator Data Reset
- The Firestore emulator stores data in volatile memory by default. When the emulator process restarts, run:
  ```bash
  cd backend && npm run seed:firestore
  ```
- To persist emulator data between restarts, use the `--export-on-exit` and `--import` flags:
  ```bash
  npx firebase emulators:start --only firestore --import=./emulator-data --export-on-exit=./emulator-data
  ```

---

## 11. Related Documentation

- [README.md](file:///d:/Project_Abir/attendoschool/README.md) — Main repository introduction, feature list, and architecture overview.
- [DOCUMENTATION.md](file:///d:/Project_Abir/attendoschool/DOCUMENTATION.md) — Complete 1,800+ line technical architecture, database schemas, API specs, and security audit.
- [CLOUD-DEPLOYMENT-GUIDE.md](file:///d:/Project_Abir/attendoschool/CLOUD-DEPLOYMENT-GUIDE.md) — Production deployment instructions for AWS, Render, Vercel, and Docker.
