# AttendoSchool — Enterprise Scalability & High-Concurrency Architecture Guide
### Engineering Blueprint for 200,000+ (2 Lakhs+) Concurrent Users (Logins & Operations)
*Standards comparable to State Board Examination Portals (CBSE, WBCHSE, NTA) and Enterprise University Systems.*

---

## Executive Summary

Handling **2 Lakhs+ (200,000+) concurrent users** who are actively logging in, viewing student/faculty dashboards, checking timetables, and submitting attendance during peak morning windows (8:00 AM – 9:30 AM) is an **enterprise-tier throughput challenge**.

Under this volume:
- **Peak Request Throughput**: **20,000 to 35,000 Requests Per Second (RPS)**.
- **Login Traffic**: **500 to 1,500 password verifications/second**.
- **Bandwidth**: **2.5 to 4.0 Gbps** sustained egress.
- **Database Write Load**: **5,000 to 10,000 attendance batch records/minute**.

This document outlines the **exact architectural bottlenecks, system design, database plans, Hostinger hosting strategies, technology stack, and an executable implementation roadmap** to achieve uninterrupted 99.99% availability at this scale.

---

## 1. The Engineering Mathematics of 200k Concurrency

To understand why traditional single-server or free-tier setups fail immediately, consider the mathematical reality:

| Metric | Calculation | Impact on Infrastructure |
| :--- | :--- | :--- |
| **Active Sessions** | 200,000 concurrent connected users | ~200k active JWT/sessions in memory |
| **Peak Login Rate** | 200k logins spread across 15–20 minutes | **~500 – 1,000 logins/second (RPS)** |
| **Bcrypt CPU Cost** | 1 bcrypt hash at cost 10 = ~80ms CPU time | **80 CPU cores required at 100% saturation** purely to compute password hashes |
| **API Request Volume** | Average 1 request every 8 seconds per user | **25,000 Requests Per Second (RPS)** |
| **Database Connections** | Default PostgreSQL `max_connections` = 100 | **Connection pool exhausted in 50 milliseconds** without PgBouncer |
| **Network Egress** | 25,000 RPS × 15 KB average JSON response | **~375 MB/sec = 3.0 Gbps network bandwidth** |

---

## 2. Current Codebase Bottlenecks & Critical Issues

A comprehensive audit of the current repository reveals seven critical architectural bottlenecks that must be resolved:

### Issue 1: In-Memory Stores Prevent Horizontal Scaling
- **Files**: `backend/src/store/demoUsers.ts`, `backend/src/store/leavesStore.ts`, `backend/src/routes/schoolData.ts` (`demoStudents`, `demoTeachers`), `backend/src/server.ts` (`rehydrateAllFromFirestore`).
- **Failure Mode**: When you run 10–30 backend instances behind a load balancer, each server maintains its own private memory. An update on Server A is invisible to Server B. Furthermore, loading 200k student objects into Node.js heap causes **JavaScript Heap Out-Of-Memory (OOM) crashes**.
- **Remedy**: Backend must become **100% stateless**. All persistence must reside in PostgreSQL / Firestore, and all volatile session/cache data must reside in **Redis**.

### Issue 2: Synchronous Database Writes on Attendance Marking
- **Files**: `backend/src/routes/attendanceReports.ts`, `backend/src/routes/teacher.ts`.
- **Failure Mode**: When 5,000 teachers submit classroom attendance simultaneously at 8:30 AM, each request initiates a direct `INSERT` / `UPDATE` query. Database row locks, deadlocks, and connection queue timeouts (HTTP 504) cascade across the entire platform.
- **Remedy**: **Asynchronous Queue Ingestion**. The API accepts attendance payloads, places them onto a high-speed Redis message queue (BullMQ), returns `HTTP 202 Accepted` to the client in <30ms, and background worker pools write records in optimized batches.

### Issue 3: Bcrypt CPU Bottleneck during Morning Login Rush
- **Files**: `backend/src/routes/auth.ts` (`bcrypt.compare`).
- **Failure Mode**: Node.js event loop blocks on heavy cryptographic hashing. At 500+ logins/sec, the single thread event loop starves all other API requests.
- **Remedy**:
  1. Offload bcrypt to worker threads or switch to native **Argon2id**.
  2. Implement **Long-Lived Refresh Tokens (7–30 days)** so returning students and teachers do not re-verify passwords every morning.
  3. Cache authenticated session validation in Redis.

### Issue 4: PostgreSQL Connection Starvation
- **Files**: `backend/src/db.ts` (`new Pool({ max: 10 })`).
- **Failure Mode**: Under heavy traffic, 20 backend worker containers each opening 10–50 connections will exceed PostgreSQL's connection limits, rejecting all further traffic.
- **Remedy**: Implement **PgBouncer** connection pooler in `transaction` mode. 20,000 client requests can be multiplexed through just 200–300 persistent database connections.

### Issue 5: Missing Read-Caching Layer for Public & Repetitive Data
- **Files**: `/api/schools`, `/api/timetable`, student profiles, calendar events.
- **Failure Mode**: 200,000 students repeatedly query the timetable and school configuration. Querying the database 25,000 times/sec for identical read-only records will saturate database I/O.
- **Remedy**: Cache all timetables, student profiles, and school metadata in **Redis** with a 5–15 minute TTL. Redis handles 100k+ reads/sec with sub-millisecond response.

### Issue 6: Unpartitioned Large Tables
- With 200k students generating attendance daily, the `attendance_records` table accumulates **4 million records per month**.
- Unpartitioned tables lead to multi-second query execution times on reports and statistics.
- **Remedy**: Declarative PostgreSQL table partitioning by `academic_year` and hash partitioning by `school_id`.

---

## 3. High-Concurrency System Architecture

Below is the production-grade architecture required to withstand 200k concurrent users:

```
                                 [ 200,000+ Concurrent Clients ]
                                                │
                                                ▼
                                   [ Cloudflare Enterprise / CDN ]
                         - DDoS Shield (Layer 3/4 & Layer 7)
                         - Edge SSL Termination
                         - Static Frontend Caching (Vite Assets, CSS, Images)
                         - Edge API Caching for static lists
                                                │
                                                ▼
                                 [ High-Performance Reverse Proxy ]
                              (NGINX / HAProxy / AWS ALB / Hostinger VPS)
                         - Rate Limiting (100 req/min per IP)
                         - Least-Connections Load Balancing
                         - HTTP/2 & HTTP/3 multiplexing
                                                │
             ┌──────────────────────────────────┼──────────────────────────────────┐
             ▼                                  ▼                                  ▼
   [ Node.js API Node 1 ]             [ Node.js API Node 2 ]             [ Node.js API Node N ]
    (PM2 Cluster / Docker)             (PM2 Cluster / Docker)             (PM2 Cluster / Docker)
             │                                  │                                  │
             ├──────────────────────────────────┴──────────────────────────────────┤
             ▼                                                                     ▼
   [ Redis Cluster Layer ]                                                [ BullMQ Message Queue ]
   - Session & JWT Blacklist Cache                                        - Attendance Ingestion Queue
   - Student Profile & Timetable Cache                                    - SMS / WhatsApp / Email Queue
   - Distributed Rate Limiter                                             - Audit Log Queue
             │                                                                     │
             ▼                                                                     ▼
   [ PgBouncer Connection Pooler ]                                        [ Dedicated Worker Pool ]
   - Transaction Mode Pooling (Pool size: 200)                            - Batch Inserts (500 rows/batch)
   - Max 10,000 Client Waiters                                            - Notification Dispatchers
             │                                                                     │
             ├──────────────────────────────────┬──────────────────────────────────┘
             ▼                                  ▼
┌───────────────────────────────┐  ┌────────────────────────────────┐
│ Primary PostgreSQL (Writes)   │  │ Read Replica 1 & 2 (Dashboard) │
│ - Attendance Writes           │  │ - Report generation            │
│ - Auth & User Registrations   │  │ - Student Analytics queries    │
└───────────────────────────────┘  └────────────────────────────────┘
```

---

## 4. Hostinger Plan Evaluation & Recommendations

The user's direct question: **"What Hostinger plan should I have?"**

### The Honest Truth About Hostinger Shared vs VPS
1. **Hostinger Shared / Cloud Startup / Cloud Professional Hosting**:
   - **CANNOT handle 200,000 concurrent users**.
   - These plans enforce strict process execution limits (Nginx/LiteSpeed max concurrent connections of 100–300, 1–4 CPU cores, and process throttling). It will crash within 5 seconds of a 200k user surge.
2. **Hostinger KVM VPS Plans**:
   - Hostinger VPS instances provide dedicated virtual CPU, NVMe SSD storage, and full root access where Docker, NGINX, Node.js, and Redis can be tuned.

### Recommended Hostinger Setup Options

#### Option A: Hostinger Multi-VPS Architecture (Most Cost-Effective Enterprise Setup)
To support 200k users on Hostinger, you **cannot use a single machine**. You must deploy a multi-VPS cluster:

| Role | Hostinger Plan | Specifications | Purpose |
| :--- | :--- | :--- | :--- |
| **Load Balancer & Reverse Proxy** | **Hostinger KVM 4** | 4 vCPU, 16 GB RAM, 16 TB Bandwidth | NGINX SSL termination, Cloudflare origin, rate limiting, load balancing. |
| **API Application Nodes (x3 to x4)** | **Hostinger KVM 8** (3x) | 8 vCPU, 32 GB RAM, 400 GB NVMe (each) | Runs Node.js API backend in Docker/PM2 cluster (8 processes per server × 3 = 24 CPU cores). |
| **Cache & Queue Server** | **Hostinger KVM 4** | 4 vCPU, 16 GB RAM, NVMe | Dedicated Redis Cluster / DragonflyDB + BullMQ message queue broker. |
| **Database Server (PgBouncer + Postgres)** | **Hostinger KVM 8** | 8 vCPU, 32 GB RAM, 400 GB NVMe | PostgreSQL 16 + PgBouncer with dedicated tuning for 32GB RAM. |

*Total Monthly Hostinger Cost: Approx. $100 – $160/month (significantly cheaper than AWS enterprise equivalents).*

#### Option B: Hybrid Cloud Architecture (Recommended for Peak Reliability)
- **Frontend & Static Assets**: Hostinger Subdomain (`attendoschool.optinetinnovations.in`) behind Cloudflare.
- **API Compute**: Hostinger KVM 8 Cluster **OR** Google Cloud Run (Auto-scales from 2 to 40 instances automatically during the 8:00 AM rush and scales down at 10:00 AM).
- **Database**: Managed Dedicated Database (AWS RDS / Supabase Team) with automated daily snapshots and multi-AZ redundancy.

---

## 5. Database Plan Selection & Sizing

The user's direct question: **"What plan should I choose for database?"**

For 200k concurrent users, the database will store **millions of records** and process thousands of queries per second.

### Database Plan Comparison

| Provider | Recommended Plan | Specs | Concurrent Capacity | Verdict |
| :--- | :--- | :--- | :--- | :--- |
| **Supabase** | **Team Plan + Compute Add-on (4XL or 8XL)** | 8–16 vCPU, 32–64 GB RAM, Supavisor connection pooler | 150k – 250k users | **Excellent** (Built-in Supavisor pooler, automatic backups, instant scalability). |
| **AWS RDS PostgreSQL** | **`db.r6g.2xlarge` (Primary) + 1 `db.r6g.xlarge` (Read Replica)** | 8 vCPU, 64 GB RAM, gp3 (3,000 – 10,000 Provisioned IOPS) | 200k – 400k users | **Industry Standard** for state exam portals (Highest durability, multi-AZ failover). |
| **Self-Hosted PostgreSQL on Hostinger VPS 8** | **PostgreSQL 16 + PgBouncer on dedicated KVM 8** | 8 vCPU, 32 GB RAM, NVMe SSD | 100k – 200k users | **Lowest Cost**, but requires manual management of replication, WAL archiving, and backup scripts. |

### Mandatory PostgreSQL Configuration Parameters (`postgresql.conf`)
For a 32 GB RAM dedicated database server:
```ini
# Memory Configuration
shared_buffers = 8GB                  # 25% of total RAM
effective_cache_size = 24GB           # 75% of total RAM
maintenance_work_mem = 2GB
work_mem = 32MB                       # Memory per query operation
max_connections = 300                 # Capped because PgBouncer handles client pool

# Checkpoint & WAL Tuning
wal_buffers = 16MB
min_wal_size = 2GB
max_wal_size = 16GB
checkpoint_completion_target = 0.9

# Worker Threads
max_worker_processes = 8
max_parallel_workers_per_gather = 4
max_parallel_workers = 8

# Query Planner Optimization for SSD
random_page_cost = 1.1
effective_io_concurrency = 200
```

### PgBouncer Configuration (`pgbouncer.ini`)
```ini
[databases]
attendoschool = host=127.0.0.1 port=5432 dbname=attendoschool

[pgbouncer]
listen_port = 6432
listen_addr = *
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction               # Critical: Reuses DB connections per transaction
max_client_conn = 10000               # Handles up to 10k backend client connections
default_pool_size = 150               # Max physical server connections
min_pool_size = 20
reserve_pool_size = 20
max_db_connections = 250
```

---

## 6. Complete Technology Stack Specification

| Tier | Technology | Purpose |
| :--- | :--- | :--- |
| **Edge / CDN** | **Cloudflare Pro / Business** | DDoS mitigation, SSL, HTTP/3, Web Application Firewall (WAF). |
| **Reverse Proxy** | **NGINX 1.25+ (Worker connections: 65,535)** | Load balances traffic across backend instances; Gzip/Brotli compression. |
| **Application Runtime**| **Node.js 20 LTS (Cluster Mode / PM2)** | Utilizes all available CPU cores per server. |
| **In-Memory Cache** | **Redis 7.2 or DragonflyDB** | Microsecond response for sessions, student profiles, and timetable queries. |
| **Message Queue** | **BullMQ (`bullmq` + `ioredis`)** | Asynchronous queuing for attendance submissions, emails, and SMS alerts. |
| **Database Pooler** | **PgBouncer 1.22+** | High-density connection pooling in transaction mode. |
| **Primary Database** | **PostgreSQL 16 Enterprise** | Relational ACID store with JSONB support and table partitioning. |
| **Secondary DB / Mirror**| **Google Cloud Firestore (Blaze)** | Document sync, real-time app events, and failover redundancy. |
| **Process Manager** | **Docker Compose / PM2** | Auto-restart, cluster management, zero-downtime reloads. |
| **Load Testing** | **k6 (Grafana k6)** | Industry-standard load testing tool capable of generating 100k+ virtual users. |

---

## 7. Executable Implementation Plan

### Phase 1: Codebase Preparation (Statelessness & Caching)
- [ ] **Step 1.1**: Purge all remaining in-memory stores (`demoUsers.ts`, `demoStudents`). Replace with standard database queries.
- [ ] **Step 1.2**: Install `ioredis` and implement a centralized `redisClient.ts` service:
  ```bash
  npm --prefix backend install ioredis
  ```
- [ ] **Step 1.3**: Add Redis caching middleware for read-heavy routes:
  - `GET /api/schools` (Cache TTL: 1 hour)
  - `GET /api/timetable` (Cache TTL: 15 minutes)
  - `GET /api/student/profile` (Cache TTL: 5 minutes)
- [ ] **Step 1.4**: Optimize Auth flow:
  - Generate JWT with 7-day expiration + refresh token flow.
  - Check JWT revocation against Redis blacklist instead of querying database on every request.

### Phase 2: Asynchronous Attendance Queue (BullMQ)
- [ ] **Step 2.1**: Install BullMQ:
  ```bash
  npm --prefix backend install bullmq
  ```
- [ ] **Step 2.2**: Create `src/queues/attendanceQueue.ts`:
  - When `POST /api/attendance` is called:
    1. Validate input payload.
    2. Add job to `attendanceQueue.add('process_attendance', payload)`.
    3. Return `res.status(202).json({ success: true, message: 'Attendance queued for processing' })`.
- [ ] **Step 2.3**: Create background worker `src/workers/attendanceBatchWorker.ts`:
  - Batches 100–500 attendance entries into a single SQL transaction:
    ```sql
    INSERT INTO attendance_records (id, student_id, class_id, date, status)
    VALUES (...)
    ON CONFLICT (student_id, date) DO UPDATE SET status = EXCLUDED.status;
    ```

### Phase 3: Database Optimization & Partitioning
- [ ] **Step 3.1**: Partition `attendance_records` by Academic Year:
  ```sql
  CREATE TABLE attendance_records (
      id UUID NOT NULL,
      school_id UUID NOT NULL,
      student_id UUID NOT NULL,
      class_id UUID NOT NULL,
      date DATE NOT NULL,
      status VARCHAR(20) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      PRIMARY KEY (id, date)
  ) PARTITION BY RANGE (date);

  -- Create annual partitions
  CREATE TABLE attendance_2025 PARTITION OF attendance_records
      FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

  CREATE TABLE attendance_2026 PARTITION OF attendance_records
      FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
  ```
- [ ] **Step 3.2**: Add high-performance composite indexes:
  ```sql
  CREATE INDEX idx_attendance_lookup 
  ON attendance_records (school_id, class_id, date);

  CREATE INDEX idx_student_lookup 
  ON students (school_id, admission_number);
  ```

### Phase 4: Production NGINX Reverse Proxy Configuration
Create `/etc/nginx/sites-available/attendoschool.conf`:
```nginx
# Upstream pool of Node.js backend processes
upstream backend_cluster {
    least_conn;
    server 127.0.0.1:5000 max_fails=3 fail_timeout=10s;
    server 127.0.0.1:5001 max_fails=3 fail_timeout=10s;
    server 127.0.0.1:5002 max_fails=3 fail_timeout=10s;
    server 127.0.0.1:5003 max_fails=3 fail_timeout=10s;
    keepalive 512;
}

# Rate Limiting Zones
limit_req_zone $binary_remote_addr zone=api_limit:20m rate=150r/s;
limit_req_zone $binary_remote_addr zone=login_limit:10m rate=5r/s;

server {
    listen 443 ssl http2;
    server_name api.attendoschool.optinetinnovations.in;

    ssl_certificate /etc/letsencrypt/live/api.attendoschool/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.attendoschool/privkey.pem;

    # High Concurrency Socket Tuning
    keepalive_timeout 65;
    keepalive_requests 10000;

    # Login Route Rate-Limiting
    location /api/auth/login {
        limit_req zone=login_limit burst=10 nodelay;
        proxy_pass http://backend_cluster;
        proxy_set_header Connection "";
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # General API Routes
    location /api/ {
        limit_req zone=api_limit burst=200 nodelay;
        proxy_pass http://backend_cluster;
        proxy_set_header Connection "";
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 30s;
    }
}
```

### Phase 5: Verification via k6 Load Testing Script
Create `tests/load/k6-load-test.js` to simulate university exam / 200k user surge:
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 5000 },    // Ramp up to 5,000 VUs
    { duration: '5m', target: 20000 },   // Ramp up to 20,000 VUs
    { duration: '10m', target: 50000 },  // Sustained 50,000 VUs
    { duration: '3m', target: 0 },       // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'],     // 95% of requests must complete under 300ms
    http_req_failed: ['rate<0.01'],       // Less than 1% failure rate
  },
};

const BASE_URL = __ENV.API_URL || 'https://api.attendoschool.optinetinnovations.in';

export default function () {
  // 1. Health Probe
  const healthRes = http.get(`${BASE_URL}/api/health`);
  check(healthRes, { 'health is 200': (r) => r.status === 200 });

  // 2. Fetch Cached Timetable
  const timetableRes = http.get(`${BASE_URL}/api/timetable/public?schoolId=demo`);
  check(timetableRes, { 'timetable is 200': (r) => r.status === 200 });

  sleep(1);
}
```

Run test:
```bash
k6 run tests/load/k6-load-test.js
```

---

## 8. Summary Cost & Capacity Matrix

| Level | Infrastructure | Concurrent Users | Estimated Monthly Cost | Recommended For |
| :--- | :--- | :--- | :--- | :--- |
| **Level 1 (Current)** | Single Render Free Web Service + Free Firestore | ~100 – 200 | $0/mo | Development, internal testing only. |
| **Level 2 (Starter Production)**| Single Hostinger KVM 4 VPS + Supabase Pro | ~5,000 – 15,000 | $35 – $50/mo | 1–5 medium schools (normal usage). |
| **Level 3 (Enterprise Scale)** | **Hostinger Multi-VPS Cluster (3x KVM 8 + 1x KVM 4) + Redis + PgBouncer** | **150,000 – 250,000** | **$120 – $180/mo** | **Large educational districts, 2 Lakhs+ peak students.** |
| **Level 4 (State Board Tier)**| AWS ECS Fargate + AWS RDS Postgres (`db.r6g.2xlarge`) + Cloudflare Business | **500,000+** | $600 – $1,200/mo | State board examinations, nationwide university entrance. |
