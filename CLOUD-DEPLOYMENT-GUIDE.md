# AttendoSchool — Cloud Deployment Guide
### Complete Setup for Vercel / Netlify (Frontend) + Render / Railway (Backend) + Neon / Render (PostgreSQL)

This production release is pre-configured for immediate one-click cloud deployment.

---

## 🏗️ Architecture Overview

| Layer | Recommended Cloud Provider | Alternative Providers | Pre-Configured Files |
|---|---|---|---|
| **Frontend** (SPA) | **Vercel** | Netlify, Render Static | `frontend/vercel.json`, `frontend/public/_redirects` |
| **Backend** (API) | **Render** | Railway, Heroku, Fly.io | `render.yaml`, `backend/Procfile`, `backend/Dockerfile` |
| **Database** (PostgreSQL) | **Neon.tech** (Free Serverless) | Render Managed DB, Supabase | `backend/src/scripts/migrate.ts` (`npm run db:migrate`) |

---

## ⚡ Step 1: Database Setup (Neon or Render)

### Option A: Free Serverless PostgreSQL on Neon (Recommended — Takes 1 min)
1. Go to [https://neon.tech](https://neon.tech) and create a free account.
2. Click **Create Project**, name it `attendoschool-db`.
3. Copy the **Connection Details** string (`postgresql://...`).
   - Example: `postgresql://attendoschool_owner:pass@ep-cool-snowflake-12345.us-east-2.aws.neon.tech/attendoschool?sslmode=require`
4. Run the automated migration script locally to populate the cloud database with the entire schema, 28 migrations, and initial seed data:
   ```bash
   cd "School-Attendance-SaaS-v28-COMPLETE-FIXED-3 - Copy/backend"
   $env:DATABASE_URL="your-neon-connection-string"
   npm run db:migrate
   ```
   *(Or on Linux/Mac: `DATABASE_URL="your-neon-connection-string" npm run db:migrate`)*

### Option B: Render Managed PostgreSQL
1. On [https://render.com](https://render.com), click **New +** → **PostgreSQL**.
2. Name it `attendoschool-db`.
3. Render automatically provisions the database and links the internal `DATABASE_URL` when using `render.yaml`.

---

## 🚀 Step 2: Backend API Deployment (Render or Railway)

### Deploy to Render:
1. Go to [https://render.com](https://render.com) and connect your GitHub repository.
2. Click **New +** → **Web Service** (or use the Blueprint from `render.yaml`).
3. Configure the following settings:
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
   - **Health Check Path**: `/api/health`
4. Add **Environment Variables** in Render dashboard:
   | Key | Value | Description |
   |---|---|---|
   | `NODE_ENV` | `production` | Production optimizations |
   | `PORT` | `10000` | Port used by Render |
   | `DATABASE_URL` | `postgresql://...` | Connection string from Step 1 |
   | `JWT_SECRET` | *(Generate a 32+ character random string)* | Token encryption secret |
   | `CORS_ORIGIN` | `*` *(or your Vercel frontend URL)* | Allowed cross-origin domains |
5. Click **Deploy Web Service**.
6. Once deployed, note down your backend URL (e.g. `https://attendoschool-api.onrender.com`).
   - Test it: Open `https://attendoschool-api.onrender.com/api/health` — it should return HTTP 200 with `{ status: "ok" }`.

---

## 🌐 Step 3: Frontend Deployment (Vercel or Netlify)

### Deploy to Vercel (Recommended):
1. Go to [https://vercel.com](https://vercel.com) and click **Add New...** → **Project**.
2. Select your GitHub repository.
3. Configure project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click *Edit* and select `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add **Environment Variables**:
   | Key | Value |
   |---|---|
   | `VITE_API_URL` | `https://attendoschool-api.onrender.com/api` *(Your backend API URL from Step 2)* |
5. Click **Deploy**.
6. Vercel will build the frontend and provide your live URL (e.g., `https://attendoschool.vercel.app`).
   - SPA routing is already handled by `frontend/vercel.json`.

---

## 📦 Step 4: Pushing Your Code to GitHub

To connect your project to Vercel and Render:

```bash
cd "d:\School-Attendance-SaaS-v28-COMPLETE-FIXED-PROD\School-Attendance-SaaS-v28-COMPLETE-FIXED-3 - Copy"

# 1. Initialize git
git init

# 2. Stage all files
git add .

# 3. Commit
git commit -m "AttendoSchool v28 Production Release with official logo & cloud configuration"

# 4. Create repository on GitHub (e.g., https://github.com/your-username/attendoschool)
# 5. Link and push:
git remote add origin https://github.com/YOUR_USERNAME/attendoschool.git
git branch -M main
git push -u origin main
```

---

## 🔑 Demo Credentials on Deployed System

Once deployed, you can immediately log into the live platform using the pre-seeded credentials:

| Persona | Email | Password | Access Portal |
|---|---|---|---|
| **Super Admin** | `superadmin@attendance.local` | `ChangeMe123!` | Company-wide SaaS management & schools directory |
| **School Admin** | `admin@demo-school.local` | `ChangeMe123!` | Academic year, classes, student roster & daily attendance |
| **Teacher** | `rahul@demo-school.local` | `ChangeMe123!` | Classroom routine & instant attendance marking |

---

## ✅ Pre-Flight Verification Checklist
- [x] Full uncropped official AttendoSchool logo deployed everywhere
- [x] SPA routing configured for Vercel (`vercel.json`) & Netlify (`_redirects`)
- [x] Render Blueprint pre-configured (`render.yaml`)
- [x] Automatic SSL support for cloud PostgreSQL pools (`Neon`, `Render`, `Supabase`)
- [x] Universal database migration command ready (`npm run db:migrate`)
- [x] All 93 test suites passing (50 backend unit + 43 end-to-end)
