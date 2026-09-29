# Multi-Tenant Security & Tenant Isolation Model

## 1. Principles of Tenant Isolation

In **AttendoSchool**, every school functions as an autonomous, logically isolated tenant:

1. **Strict Tenant Keying:** Every persistent record must include a `school_id` property representing the immutable UUID of the tenant.
2. **Context Derivation from Cryptographic Token:** The `school_id` is **never trusted from request bodies or URL path parameters** for privilege elevation. It is extracted from the verified JWT payload (`req.user.schoolId`).
3. **Zero Cross-Tenant Leakage:** A school administrator or teacher cannot read, update, or delete data belonging to another school under any circumstances.
4. **Deny-by-Default:** Requests lacking an authenticated session or valid `school_id` are rejected immediately with `401 Unauthorized` or `400 Bad Request (TENANT_REQUIRED)`.

---

## 2. Authentication & Authorization Layers

### Middleware Enforcement (`backend/src/middleware/auth.ts`)
```typescript
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });

  const payload = verifyJwt(token);
  req.user = {
    id: payload.userId,
    role: payload.role,
    schoolId: payload.schoolId, // Injected from trusted cryptographic signature
    schoolName: payload.schoolName
  };
  next();
}
```

### Role-Based Access Control (RBAC) Matrix

| Resource / Action | SUPER_ADMIN | SCHOOL_ADMIN | TEACHER | STUDENT / PARENT |
| :--- | :---: | :---: | :---: | :---: |
| **All Schools Global Stats** | Read | Denied | Denied | Denied |
| **Tenant Dashboard** | All Tenants | Own Tenant | Denied | Denied |
| **Student Roster** | Read All | Own Tenant (Full CRUD) | Own Assigned Classes | Own Profile Only |
| **Faculty Directory** | Read All | Own Tenant (Full CRUD) | Read Own School Faculty | Denied |
| **Submit Attendance** | Full CRUD | Own Tenant | Own Assigned Classes | Denied |
| **Attendance Reports** | Read All | Own Tenant (Export) | Own Assigned Classes | Own Presence Only |
| **Broadcast Notice** | Broadcast All | Own Tenant | Own Assigned Classes | Read & Reply Only |
| **Threaded Reply** | Read All | Own Tenant (Read) | Own Tenant (Read) | Create Own Reply |

---

## 3. Database Layer Isolation

Every database transaction and query binds `school_id`:
```typescript
// PostgreSQL
SELECT * FROM students WHERE school_id = $1 AND is_active = true

// Cloud Firestore
collections.students().where('school_id', '==', sid).get()
```

Cross-tenant access attempts trigger security alerts and terminate the session.
