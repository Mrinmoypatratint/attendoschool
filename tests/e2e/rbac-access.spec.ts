/**
 * RBAC frontend gating (test group 15). Backend is fully mocked with page.route — runs against the
 * Vite dev server (npm run dev:frontend) with no database. HashRouter URLs (/#/...).
 *
 *   npx playwright test tests/e2e/rbac-access.spec.ts
 */
import { test, expect, Page, Route } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:5173';
const SCHOOL = '11111111-1111-4111-8111-111111111111';
const ADMIN = { id: 'adm-a', schoolId: SCHOOL, name: 'Owner A', email: 'a@test.local', role: 'SCHOOL_ADMIN', schoolName: 'Test School' };

function snapshot(denied: Record<string, string>, mode = 'enforce') {
  const keys = ['students.view', 'teachers.view', 'analytics.view', 'access.manage', 'dashboard.view', 'classes.view', 'timetable.view'];
  return {
    version: 3, role: 'SCHOOL_ADMIN', schoolId: SCHOOL, loginEnabled: true, mode, planKey: 'plan-basic', features: [],
    permissions: keys.map((k) => ({ key: k, allowed: !denied[k], reason: denied[k] || 'DEFAULT_ALLOW', source: denied[k] ? 'role' : 'default', feature: k.split('.')[0] })),
  };
}

const catalog = {
  mode: 'enforce', store: 'READY', roles: ['SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT'],
  features: [{ key: 'assignments', label: 'Assignments', core: false }],
  permissions: [{
    key: 'assignments.view', feature: 'assignments', label: 'View assignments', description: '', ceilingRoles: ['SCHOOL_ADMIN', 'TEACHER'],
    roleLocks: { SCHOOL_ADMIN: { locked: false }, TEACHER: { locked: false }, STUDENT: { locked: true }, PARENT: { locked: true } },
    principalLocks: {},
  }],
};
const cell = (inCeiling: boolean) => ({ inCeiling, allowed: inCeiling, source: 'default', locked: !inCeiling, lockReason: null });
const roles = {
  version: 1, counts: { SCHOOL_ADMIN: 1, TEACHER: 42, STUDENT: 300, PARENT: 250 }, features: [{ key: 'assignments', enabled: true, source: 'plan' }],
  matrix: [{ key: 'assignments.view', feature: 'assignments', roles: { SCHOOL_ADMIN: cell(true), TEACHER: cell(true), STUDENT: cell(false), PARENT: cell(false) } }],
};

async function boot(page: Page, opts: { denied?: Record<string, string>; mode?: string; extra?: (route: Route, url: URL) => Promise<boolean> } = {}) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (opts.extra && (await opts.extra(route, url))) return;
    if (url.pathname.endsWith('/api/access/me')) return route.fulfill({ json: snapshot(opts.denied || {}, opts.mode) });
    if (url.pathname.endsWith('/api/access/catalog')) return route.fulfill({ json: catalog });
    if (url.pathname.endsWith('/api/access/roles')) return route.fulfill({ json: roles });
    return route.fulfill({ json: [] });
  });
  await page.addInitScript((u) => {
    localStorage.setItem('attendance_token', 'test-token');
    localStorage.setItem('attendance_user', JSON.stringify(u));
  }, ADMIN);
}

test('direct URL to a denied page shows "Access restricted" instead of redirect loops', async ({ page }) => {
  await boot(page, { denied: { 'students.view': 'ROLE_DENY' } });
  await page.goto(`${BASE}/#/students`);
  await expect(page.getByTestId('access-restricted')).toBeVisible();
  await expect(page.getByTestId('access-restricted')).toContainText(/turned this off for your role/i);
  await expect(page).toHaveURL(/#\/students/);
});

test('sidebar hides items the user cannot open (enforce mode)', async ({ page }) => {
  await boot(page, { denied: { 'analytics.view': 'ROLE_DENY' } });
  await page.goto(`${BASE}/#/permissions`);
  await expect(page.getByRole('button', { name: 'Reports & Analytics', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Students', exact: true }).first()).toBeVisible();
});

test('control: the same sidebar item is visible when the permission is allowed', async ({ page }) => {
  await boot(page, { denied: {} });
  await page.goto(`${BASE}/#/permissions`);
  await expect(page.getByRole('button', { name: 'Reports & Analytics', exact: true })).toBeVisible();
});

test('nothing is hidden in shadow mode (backend would not block either)', async ({ page }) => {
  await boot(page, { denied: { 'students.view': 'ROLE_DENY' }, mode: 'shadow' });
  await page.goto(`${BASE}/#/students`);
  await expect(page.getByTestId('access-restricted')).toHaveCount(0);
});

test('a 403 PERMISSION_DENIED shows a toast and does NOT log the user out', async ({ page }) => {
  await boot(page, {
    extra: async (route, url) => {
      if (url.pathname.endsWith('/api/access/catalog')) {
        await route.fulfill({ status: 403, json: { message: 'You do not have permission to perform this action.', code: 'PERMISSION_DENIED', permission: 'access.manage' } });
        return true;
      }
      return false;
    },
  });
  await page.goto(`${BASE}/#/permissions`);
  await expect(page.getByText('You do not have permission to perform this action.').first()).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('attendance_token'))).toBe('test-token');
  await expect(page).not.toHaveURL(/login/);
});

test('401 ACCOUNT_DISABLED logs out and explains why on the login page', async ({ page }) => {
  await boot(page, {
    extra: async (route, url) => {
      if (url.pathname.endsWith('/api/access/me')) {
        await route.fulfill({ status: 401, json: { message: 'Your account has been disabled by your school administrator.', code: 'ACCOUNT_DISABLED' } });
        return true;
      }
      return false;
    },
  });
  await page.goto(`${BASE}/#/dashboard`);
  await expect(page).toHaveURL(/#\/login/);
  await expect(page.getByText(/account has been disabled/i).first()).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('attendance_token'))).toBeNull();
});

test('role toggle rolls back and shows an error toast when the save fails', async ({ page }) => {
  await boot(page, {
    extra: async (route, url) => {
      if (url.pathname.endsWith('/api/access/catalog')) { await route.fulfill({ json: catalog }); return true; }
      if (url.pathname.endsWith('/api/access/roles')) { await route.fulfill({ json: roles }); return true; }
      if (url.pathname.includes('/api/access/roles/TEACHER/permissions')) {
        await route.fulfill({ status: 409, json: { message: 'Simulated conflict', code: 'LOCKOUT_PREVENTED' } }); return true;
      }
      return false;
    },
  });
  await page.goto(`${BASE}/#/permissions`);
  const sw = page.getByTestId('role-toggle-TEACHER-assignments.view');
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await sw.click();
  await expect(page.getByText('Affects 42 teachers.')).toBeVisible(); // impact shown in confirm
  await page.getByTestId('confirm-change').click();
  await expect(page.getByText('Simulated conflict').first()).toBeVisible();
  await expect(sw).toHaveAttribute('aria-checked', 'true'); // rolled back
});
