# Firebase-Driven Data Architecture Specification

## 1. Executive Summary & Core Principle

**AttendoSchool** is an institutional SaaS multi-tenant school attendance and administrative management platform. This document defines the authoritative architecture ensuring that:

> **Every piece of displayed application data originates from Firebase Cloud Firestore and is strictly scoped to the authenticated school tenant (`req.user.schoolId`).**

There is **zero hardcoded, mock, placeholder, demo, or fallback data** in production screens. If a tenant has zero students, teachers, classes, or attendance logs, the application displays verified empty states (`[]`, `0`), never synthetic fallback data.

---

## 2. Cloud Firestore Tenant-Isolated Collections

All institutional entities are stored in top-level Firestore collections, indexed and partitioned by `school_id`:

| Collection | Tenant Key | Schema & Purpose | Aggregation Method |
| :--- | :--- | :--- | :--- |
| `schools` | `id` (Document ID) | School profile, name, institutional code, affiliation, address, enquiry phone, subscription plan | Direct document read (`.doc(schoolId)`) |
| `users` | `school_id` | Authentication identities, role assignments (`SCHOOL_ADMIN`, `TEACHER`, `STUDENT`, `PARENT`), status | `.where('school_id', '==', sid).where('role', '==', role).count()` |
| `students` | `school_id` | Student roster, admission number, roll number, class ID, section ID, academic session ID, parent email | `.where('school_id', '==', sid).where('is_active', '==', true).count()` |
| `teachers` | `school_id` | Faculty directory, designation, Savior_No, employee ID, official email, phone, status | `.where('school_id', '==', sid).where('is_active', '==', true).count()` |
| `classes` | `school_id` | Class grades (`L-KG`, `U-KG`, `Class 1` to `Class 12`) | `.where('school_id', '==', sid).count()` |
| `sections` | `school_id` | Section divisions (`A`, `B`, `C`, etc.) mapped to classes | `.where('school_id', '==', sid).count()` |
| `attendance_sessions` | `school_id` | Daily classroom attendance sessions marked by faculty for a specific date, class, and section | `.where('school_id', '==', sid).where('attendance_date', '==', todayStr)` |
| `attendance_records` | `school_id` | Individual student presence entries (`PRESENT`, `ABSENT`, `LATE`, `HALF_DAY`), timestamped | Scoped to valid session IDs and `school_id` |
| `announcements` | `school_id` | Broadcast notices targeting school, faculty, students, classes, or sections | `.where('school_id', '==', sid).orderBy('created_at', 'desc')` |
| `announcement_replies` | `school_id` | Threaded parent and student responses linked to announcements | `.where('school_id', '==', sid).orderBy('created_at', 'desc')` |
| `academic_years` | `school_id` | Academic terms and sessions (`2025–26`, `2026–27`) | `.where('school_id', '==', sid).where('is_active', '==', true)` |
| `attendance_correction_requests` | `school_id` | Faculty correction workflow requests awaiting administrative approval | `.where('school_id', '==', sid).where('status', '==', 'PENDING').count()` |

---

## 3. High-Performance Aggregation & Quota Protection

To guarantee real-time scalability while protecting the Firebase Cloud Firestore read quotas:

1. **Firestore Aggregation Queries (`.count()`):**
   - Counts are executed using Firestore's native aggregation API (`collection.count().get()`).
   - Native count queries charge **1 document read per 1,000 index entries**, reducing Firestore read consumption by **99.9%** compared to loading entire collections.
2. **Short-Lived Tenant-Scoped Memory Cache:**
   - In `backend/src/services/tenantDataService.ts`, calculated metrics are cached with a **30-second TTL** keyed by `dashboard:${schoolId}`.
   - Rapid administrative reloads and dashboard polling hit in-memory cache without incurring redundant Cloud Firestore read charges.
3. **Strict Parameter Scoping:**
   - Every `.get()` query includes `.where('school_id', '==', sid)`.
   - Blanket un-scoped queries (e.g. `collections.students().get()`) are completely prohibited.

---

## 4. Dual-Engine Persistence Model

AttendoSchool supports a robust hybrid architecture:
- **Cloud Firestore (Primary Cloud Real-Time Store):** Multi-region, low-latency document database for frontend subscriptions, mobile apps, and tenant records.
- **PostgreSQL (Enterprise Relational Engine):** When `USE_POSTGRES=true`, transactional SQL queries execute with foreign-key constraints and ACID guarantees, continuously synchronized with Firestore via `firestoreSync.ts`.
