import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', route => {
    const url = route.request().url();
    if (url.includes('/auth/institutes')) return route.fulfill({ json: [{ id: 'school-1', name: 'Test School', code: 'TEST' }] });
    if (url.includes('/auth/lookup-institute')) return route.fulfill({ json: { found: true, instituteId: 'school-1', instituteName: 'Test School', instituteCode: 'TEST' } });
    return route.fulfill({ json: [] });
  });
  await page.goto('/#/login');
});

test('single form validates roles and toggles password visibility', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Log In', exact: true })).toBeVisible();
  await expect(page.locator('#identifier-input')).toBeVisible();
  await expect(page.locator('#password-input')).toBeVisible();
  await page.selectOption('#login-role', 'ADMIN');
  await expect(page.locator('#identifier-input')).toHaveValue('');
  await expect(page.locator('#password-input')).toHaveValue('');
  await page.locator('#password-input').fill('private-password');
  await page.getByRole('button', { name: 'Show password', exact: true }).click();
  await expect(page.locator('#password-input')).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Hide password', exact: true }).click();
  await expect(page.locator('#password-input')).toHaveAttribute('type', 'password');
});

for (const role of ['ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT']) {
  test(`${role} sends the existing authentication payload and displays server errors`, async ({ page }) => {
    let payload: any;
    await page.route('**/api/auth/login', async route => {
      payload = route.request().postDataJSON();
      await route.fulfill({ status: 401, json: { message: 'Incorrect credentials. Please try again.' } });
    });
    await page.selectOption('#login-role', role);
    const identifier = role === 'STUDENT' ? 'ADM-101' : 'person@example.com';
    await page.locator('#identifier-input').fill(identifier);
    await page.locator('#password-input').fill('private-password');
    if (role !== 'ADMIN') await expect(page.locator('#detected-institute-display')).toContainText('Test School');
    await page.locator('#submit-auth-btn').click();
    await expect(page.getByRole('alert')).toContainText('Incorrect credentials');
    expect(payload).toMatchObject({ email: identifier, admissionNumber: identifier, password: 'private-password', role });
    if (role !== 'ADMIN') expect(payload.instituteId).toBe('school-1');
    else expect(payload.instituteId).toBeUndefined();
    await expect(page.locator('#submit-auth-btn')).toBeEnabled();
  });
}

test('password reset uses the real reset endpoint', async ({ page }) => {
  let email = '';
  await page.route('**/api/auth/request-password-reset', async route => {
    email = route.request().postDataJSON().email;
    await route.fulfill({ json: { message: 'Check your email for a reset link.' } });
  });
  await page.getByRole('link', { name: 'Forgot Password?' }).click();
  await page.getByLabel('Registered Email Address, Employee ID, or Admission No.').fill('person@example.com');
  await page.getByRole('button', { name: 'Send Reset Link' }).click();
  await expect(page.getByText('Check your email for a reset link.')).toBeVisible();
  expect(email).toBe('person@example.com');
});

test('mobile layout remains in view', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await expect(page.locator('#login-role')).toBeVisible();
  await expect(page.locator('#submit-auth-btn')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const art = await page.locator('.login-art').boundingBox();
  const form = await page.locator('.login-form-panel').boundingBox();
  expect(art && form && art.y + art.height <= form.y).toBeTruthy();
});

test('successful student login stores the session and opens the student portal', async ({ page }) => {
  const user = { id: 'student-1', schoolId: 'school-1', name: 'Test Student', email: 'student@example.com', role: 'STUDENT', studentId: 'student-1' };
  await page.route('**/api/auth/login', route => route.fulfill({ json: { token: 'test-session-token', user } }));
  await page.selectOption('#login-role', 'STUDENT');
  await page.locator('#identifier-input').fill('ADM-101');
  await page.locator('#password-input').fill('private-password');
  await expect(page.locator('#detected-institute-display')).toBeVisible();
  await page.locator('#submit-auth-btn').click();
  await expect(page).toHaveURL(/#\/student\/dashboard/);
  expect(await page.evaluate(() => localStorage.getItem('attendance_token'))).toBe('test-session-token');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('attendance_user') || '{}').role)).toBe('STUDENT');
});

test('manual school selection works when identifier detection finds no match', async ({ page }) => {
  await page.route('**/api/auth/lookup-institute?**', route => route.fulfill({ json: { found: false } }));
  await page.selectOption('#login-role', 'TEACHER');
  await page.locator('#identifier-input').fill('EMP-101');
  await expect(page.locator('#login-school')).toBeVisible();
  await page.selectOption('#login-school', 'school-1');
  await expect(page.locator('#detected-institute-display')).toContainText('Test School');
});

for (const viewport of [{ width: 1366, height: 681 }, { width: 1280, height: 633 }, { width: 1024, height: 600 }]) {
  test(`desktop login fits the browser content area at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.evaluate(() => document.fonts.ready);
    const card = await page.locator('.login-card').boundingBox();
    const submit = await page.locator('#submit-auth-btn').boundingBox();
    expect(card).not.toBeNull();
    expect(submit).not.toBeNull();
    expect(card!.height).toBeLessThanOrEqual(560);
    expect(card!.y).toBeGreaterThanOrEqual(0);
    expect(card!.y + card!.height).toBeLessThanOrEqual(viewport.height);
    expect(submit!.y + submit!.height).toBeLessThanOrEqual(viewport.height);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (viewport.width >= 1280) expect(card!.width).toBe(1160);
  });
}
