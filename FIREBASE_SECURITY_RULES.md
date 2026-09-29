# Firebase Cloud Firestore Security Rules Specification

## 1. Overview & Security Architecture

The **Cloud Firestore Security Rules** (`firestore.rules`) act as the cloud-native enforcement perimeter for AttendoSchool. While the Express/TypeScript API backend provides primary business logic validation and token verification, Firestore Security Rules guarantee that even direct client SDK connections (e.g. mobile applications, progressive web apps, or compromised frontend tokens) cannot bypass multi-tenant boundaries.

The rules adhere strictly to:
1. **Deny-by-Default:** Any collection or path not explicitly granted read or write permissions is blocked.
2. **Cryptographic Custom Claims Verification:** Every rule derives the caller's authorized tenant context from `request.auth.token.schoolId` (or `school_id`).
3. **Immutability of Tenant Keys:** On write and update operations, the rule verifies that the entity's `school_id` matches the caller's tenant claim, preventing tenant reassignment or spoofing.

---

## 2. Core Helper Functions Specification

The security rules define a modular hierarchy of reusable predicate functions:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // 1. Verifies that the caller possesses a valid Firebase Auth session
    function isAuthenticated() {
      return request.auth != null;
    }

    // 2. Evaluates if the authenticated identity possesses platform SUPER_ADMIN privileges
    function isSuperAdmin() {
      return isAuthenticated() && (
        request.auth.token.role == 'SUPER_ADMIN' ||
        request.auth.token.email.matches('.*@attendoschool\\.admin')
      );
    }

    // 3. Resolves the caller's bound school identifier across custom claim variants
    function userSchoolId() {
      return request.auth.token.schoolId != null 
        ? request.auth.token.schoolId 
        : request.auth.token.school_id;
    }

    // 4. Verifies caller tenant membership against a specific target school identifier
    function isTenantUser(schoolId) {
      return isAuthenticated() && (
        isSuperAdmin() ||
        userSchoolId() == schoolId
      );
    }

    // 5. Verifies existing document ownership for read/update/delete operations
    function isDocumentTenantMatch() {
      return isAuthenticated() && (
        isSuperAdmin() ||
        resource == null ||
        resource.data.school_id == userSchoolId() ||
        resource.data.schoolId == userSchoolId()
      );
    }

    // 6. Verifies incoming document ownership for create/update operations
    function isWriteTenantMatch() {
      return isAuthenticated() && (
        isSuperAdmin() ||
        request.resource.data.school_id == userSchoolId() ||
        request.resource.data.schoolId == userSchoolId()
      );
    }
  }
}
```

---

## 3. Collection Rule Matrix

### 3.1 School Profiles (`/schools/{schoolId}`)
- **Read:** Permitted if caller belongs to `schoolId` or is `SUPER_ADMIN`.
- **Write:** Permitted to `SUPER_ADMIN` or `SCHOOL_ADMIN` of that school.
```javascript
match /schools/{schoolId} {
  allow read: if isTenantUser(schoolId);
  allow write: if isSuperAdmin() || (isTenantUser(schoolId) && request.auth.token.role == 'SCHOOL_ADMIN');
}
```

### 3.2 Students & Faculty Directories (`/students/{id}`, `/teachers/{id}`)
- **Read:** Only documents where `resource.data.school_id == userSchoolId()`.
- **Create:** Only documents where `request.resource.data.school_id == userSchoolId()`.
- **Update / Delete:** Both the existing resource and the modified resource must maintain tenant match.
```javascript
match /students/{studentId} {
  allow read: if isDocumentTenantMatch();
  allow create: if isWriteTenantMatch();
  allow update, delete: if isDocumentTenantMatch() && isWriteTenantMatch();
}
match /teachers/{teacherId} {
  allow read: if isDocumentTenantMatch();
  allow create: if isWriteTenantMatch();
  allow update, delete: if isDocumentTenantMatch() && isWriteTenantMatch();
}
```

### 3.3 Daily Attendance Sessions & Records (`/attendanceSessions/{id}`, `/attendanceRecords/{id}`)
- **Read / Write:** Strictly restricted to records bearing the matching `school_id`.
```javascript
match /attendanceSessions/{sessionId} {
  allow read: if isDocumentTenantMatch();
  allow create: if isWriteTenantMatch();
  allow update, delete: if isDocumentTenantMatch() && isWriteTenantMatch();
}
match /attendanceRecords/{recordId} {
  allow read: if isDocumentTenantMatch();
  allow create: if isWriteTenantMatch();
  allow update, delete: if isDocumentTenantMatch() && isWriteTenantMatch();
}
```

### 3.4 Announcements & Community Discussions
```javascript
match /announcements/{announcementId} {
  allow read: if isDocumentTenantMatch();
  allow create: if isWriteTenantMatch();
  allow update, delete: if isDocumentTenantMatch() && isWriteTenantMatch();
}
match /announcementReplies/{replyId} {
  allow read: if isDocumentTenantMatch();
  allow create: if isWriteTenantMatch();
  allow update, delete: if isDocumentTenantMatch() && isWriteTenantMatch();
}
```

### 3.5 Academic Calendars & Correction Requests
```javascript
match /academicYears/{yearId} {
  allow read: if isDocumentTenantMatch();
  allow write: if isDocumentTenantMatch() && request.auth.token.role == 'SCHOOL_ADMIN';
}
match /attendanceCorrectionRequests/{requestId} {
  allow read: if isDocumentTenantMatch();
  allow create: if isWriteTenantMatch();
  allow update: if isDocumentTenantMatch() && isWriteTenantMatch();
  allow delete: if isSuperAdmin();
}
```

---

## 4. Deployment & Verification Workflow

### 4.1 CLI Deployment
To deploy the security rules directly to your Firebase project:
```bash
# Ensure authentication with Google Cloud / Firebase
firebase login

# Set active project
firebase use attendoschool-prod

# Deploy security rules independently of functions or hosting
firebase deploy --only firestore:rules
```

### 4.2 Local Emulation & Rule Unit Testing
The Firebase Local Emulator Suite validates rule correctness using `@firebase/rules-unit-testing`:
```bash
firebase emulators:start --only firestore
npm run test:rules
```

Unit test assertion verifies:
1. User from `school_A` attempting to read `/students` belonging to `school_B` is denied.
2. User attempting to insert record with spoofed `school_id: "school_B"` is rejected.
3. Requests missing Bearer auth token receive permission denied.
