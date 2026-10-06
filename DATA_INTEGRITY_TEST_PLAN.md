# Data Integrity & Multi-Tenant Security Test Plan

## 1. Objective & Scope

This document provides the authoritative test plan and verification procedures to ensure that:
1. **Multi-Tenant Isolation is 100% impenetrable**: No tenant can read or mutate another tenant's records.
2. **Zero Fake/Demo Fallbacks**: Production endpoints return strictly true database data or validated empty states (`[]`, `0`), never synthetic demo mocks.
3. **Universal Preview & Confirmation Integrity**: All administrative mutations and broadcasts render a non-destructive Preview & Confirmation modal before execution.
4. **Firestore Quota Optimization**: Aggregations execute via `.count().get()` and memory cache without triggering resource exhaustion.


---

## 2. Test Environment Setup

### 2.1 Test Entities
To execute multi-tenant boundary verification, two isolated schools are provisioned:

| Parameter | Tenant A (Alpha Academy) | Tenant B (Beta Institute) |
| :--- | :--- | :--- |
| **School ID** | `sch_test_alpha_01` | `sch_test_beta_02` |
| **Admin Email** | `admin@alpha-academy.edu` | `admin@beta-institute.edu` |
| **Admin Password** | `AlphaSecurePass123!` | `BetaSecurePass123!` |
| **Student Count** | 5 Enrolled Students | 0 Enrolled Students (Clean Slate) |
| **Faculty Count** | 3 Enrolled Teachers | 0 Enrolled Teachers (Clean Slate) |

---

## 3. Test Suites & Verification Procedures

### Suite 1: Multi-Tenant Boundary Isolation

#### Test 1.1: Cross-Tenant Student Read Prohibition
- **Actor:** Tenant B Administrator (`admin@beta-institute.edu`)
- **Action:** Execute `GET /api/v1/students` with Tenant B JWT.
- **Expected Result:**
  - HTTP 200 OK.
  - JSON payload contains `data: []` (Tenant B has no students).
  - Crucially: **Zero students from Tenant A appear in the response.**

#### Test 1.2: Cross-Tenant Mutation Rejection (IDOR Defense)
- **Actor:** Tenant B Administrator (`admin@beta-institute.edu`)
- **Target:** Student `stu_alpha_999` belonging to Tenant A (`sch_test_alpha_01`).
- **Action:** Execute `PUT /api/v1/students/stu_alpha_999` with payload `{"firstName": "Hacked"}`.
- **Expected Result:**
  - HTTP 403 Forbidden or HTTP 404 Not Found.
  - Student record in database remains unchanged.
  - Security audit log is written recording unauthorized cross-tenant attempt.

#### Test 1.3: Cross-Tenant Announcement Threading
- **Actor:** Tenant B Guardian
- **Target:** Announcement `ann_alpha_001` belonging to Tenant A.
- **Action:** Attempt `POST /api/v1/announcements/ann_alpha_001/replies`.
- **Expected Result:**
  - HTTP 403 Forbidden.

---

### Suite 2: Zero-Fake-Data & Clean Slate Verification

#### Test 2.1: Clean Slate School Dashboard
- **Actor:** Tenant B Administrator
- **Action:** Request `GET /api/dashboard/stats`.
- **Assertions:**
  ```javascript
  expect(response.body.summary.totalStudents).toBe(0);
  expect(response.body.summary.totalTeachers).toBe(0);
  expect(response.body.summary.totalClasses).toBe(0);
  expect(response.body.summary.attendanceRate).toBe(0);
  expect(response.body.summary.pendingCorrections).toBe(0);
  // Must NOT match previous demo constants
  expect(response.body.summary.totalStudents).not.toBe(18);
  expect(response.body.summary.totalTeachers).not.toBe(8);
  expect(response.body.summary.attendanceRate).not.toBe(66.7);
  expect(response.body.summary.attendanceRate).not.toBe(94.2);
  ```

#### Test 2.2: Student Roster Clean Slate
- **Actor:** Tenant B Administrator
- **Action:** Request `GET /api/v1/students`.
- **Assertions:**
  - Response array length is exactly `0`.
  - Must not return `demoStudents` (e.g. `Aarav Sharma`, `Diya Patel`).

#### Test 2.3: Faculty Directory Clean Slate
- **Actor:** Tenant B Administrator
- **Action:** Request `GET /api/v1/teachers`.
- **Assertions:**
  - Response array length is exactly `0`.
  - Must not return `demoTeachers`.

---

### Suite 3: Universal Preview & Confirmation Modal Verification

#### Test 3.1: Student Enrollment Preview Modal
1. Navigate to `/admin/students` -> Click **"Enroll New Student"**.
2. Complete enrollment form fields.
3. Click **"Save Student"**.
4. **Assertion:** Form does NOT submit directly to API. The `UniversalPreviewModal` displays with:
   - Full student summary (Name, Admission No, Class, Section, Guardian Contact).
   - Clear warning: *"Please review enrollment details before confirming."*
   - Two buttons: *"Back to Edit"* and *"Confirm & Enroll"*.
5. Clicking *"Confirm & Enroll"* dispatches `POST /api/v1/students` and displays a success toast.

#### Test 3.2: Destructive Student Deactivation Modal
1. Select existing student -> Click **"Deactivate"**.
2. **Assertion:** Displays `DestructiveConfirmModal` requiring explicit confirmation.

#### Test 3.3: Attendance Submission Confirmation
1. Mark roll-call for Class 10-A.
2. Click **"Submit Attendance"**.
3. **Assertion:** Submission modal renders total Present, Absent, and Late counts with confirmation requirement before committing records.

---

### Suite 4: Quota Protection & Performance

#### Test 4.1: Aggregation Quota Benchmark
- **Action:** Benchmark `GET /api/dashboard/stats` against Firestore read usage.
- **Assertion:** Uses native `.count().get()` rather than loading full document collections.

#### Test 4.2: 30-Second Tenant Cache Hit
- **Action:** Send 10 consecutive requests to `GET /api/dashboard/stats` within 5 seconds.
- **Assertion:**
  - Request 1 queries Firestore.
  - Requests 2–10 return in < 15ms served directly from memory cache.

---

## 4. Automated Execution Script (`test-isolation.sh` / curl)

```bash
#!/usr/bin/env bash
set -e

BASE_URL="http://localhost:5000"

echo "=== 1. Login as Tenant B (Clean School) ==="
TOKEN_B=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@beta-institute.edu","password":"BetaSecurePass123!"}' | jq -r .token)

echo "=== 2. Verify Zero Demo Students for Tenant B ==="
STUDENT_COUNT=$(curl -s -X GET "$BASE_URL/api/v1/students" \
  -H "Authorization: Bearer $TOKEN_B" | jq '.data | length')

if [ "$STUDENT_COUNT" -eq 0 ]; then
  echo "PASS: Zero demo students leaked. Count is 0."
else
  echo "FAIL: Expected 0 students, got $STUDENT_COUNT."
  exit 1
fi

echo "=== 3. Verify Clean Dashboard Stats ==="
TOTAL_STUDENTS=$(curl -s -X GET "$BASE_URL/api/dashboard/stats" \
  -H "Authorization: Bearer $TOKEN_B" | jq '.summary.totalStudents')

if [ "$TOTAL_STUDENTS" -eq 0 ]; then
  echo "PASS: Dashboard reflects 0 students."
else
  echo "FAIL: Leaked demo or cross-tenant students: $TOTAL_STUDENTS."
  exit 1
fi

echo "ALL DATA INTEGRITY AND TENANT ISOLATION TESTS PASSED."
```
