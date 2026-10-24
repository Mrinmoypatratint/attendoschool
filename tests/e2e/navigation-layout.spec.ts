import { test, expect, Page } from '@playwright/test';

type AppRole = 'SUPER_ADMIN' | 'SCHOOL_ADMIN' | 'TEACHER' | 'PARENT' | 'STUDENT';

async function authenticate(page: Page, role: AppRole) {
  await page.addInitScript((activeRole: AppRole) => {
    localStorage.setItem('attendance_token', 'layout-regression-token');
    localStorage.setItem('attendance_user', JSON.stringify({
      id: `${activeRole.toLowerCase()}-test`,
      schoolId: activeRole === 'SUPER_ADMIN' ? null : 'school-test',
      name: `${activeRole.replace(/_/g, ' ')} Test`,
      email: `${activeRole.toLowerCase()}@test.local`,
      role: activeRole,
      studentId: activeRole === 'STUDENT' ? 'student-test' : undefined,
      schoolName: 'Layout Test School',
      schoolCode: 'TEST01'
    }));
  }, role);
}

const cases: Array<{ role: AppRole; route: string; header: string; scrollOwner: string; sidebar: string }> = [
  { role: 'SCHOOL_ADMIN', route: '/dashboard', header: '.app-topbar', scrollOwner: '.app-shell > main', sidebar: '.app-shell > aside' },
  { role: 'TEACHER', route: '/dashboard', header: '.app-topbar', scrollOwner: '.app-shell > main', sidebar: '.app-shell > aside' },
  { role: 'PARENT', route: '/parent-portal', header: '.app-topbar', scrollOwner: '.app-shell > main', sidebar: '.app-shell > aside' },
  { role: 'STUDENT', route: '/student/dashboard', header: '.student-topbar', scrollOwner: '.student-main-wrapper', sidebar: '.student-sidebar' },
  { role: 'SUPER_ADMIN', route: '/super-admin', header: '.sa-topbar', scrollOwner: '.sa-main-wrap', sidebar: '.sa-sidebar' }
];

for (const current of cases) {
  test(`${current.role}: sticky header and first-click sidebar rail`, async ({ page }) => {
    await authenticate(page, current.role);
    await page.goto(current.route);
    const header = page.locator(current.header).first();
    const sidebar = page.locator(current.sidebar).first();
    const toggle = header.locator('button[aria-controls="primary-navigation"]').first();
    await expect(header).toBeVisible();
    await expect(toggle).toBeVisible();

    const expandedWidth = (await sidebar.boundingBox())?.width || 0;
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect.poll(async () => (await sidebar.boundingBox())?.width || 0).toBeLessThan(expandedWidth);

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect.poll(async () => (await sidebar.boundingBox())?.width || 0).toBeGreaterThan(200);

    const topBefore = (await header.boundingBox())?.y;
    await page.locator(current.scrollOwner).evaluate(node => { node.scrollTop = 1000; });
    const topAfter = (await header.boundingBox())?.y;
    expect(Math.abs((topAfter || 0) - (topBefore || 0))).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy();
  });

  test(`${current.role}: mobile navigation uses a drawer`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page, current.role);
    await page.goto(current.route);
    const header = page.locator(current.header).first();
    const sidebar = page.locator(current.sidebar).first();
    const toggle = header.locator('button[aria-controls="primary-navigation"]').first();
    await expect(header).toBeVisible();
    await toggle.click();
    await expect.poll(async () => (await sidebar.boundingBox())?.x ?? -999).toBeGreaterThanOrEqual(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy();
  });
}
