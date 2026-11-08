import { test, expect } from '@playwright/test';
import { nativeApiUrl, PRODUCTION_API_URL } from '../../frontend/src/platform/apiConfig';

test('native API defaults to the same production backend as the web application', () => {
  expect(nativeApiUrl()).toBe(PRODUCTION_API_URL);
  expect(nativeApiUrl('https://staging.example.com/api/')).toBe('https://staging.example.com/api');
  for (const invalid of ['/api', 'http://localhost:5001/api', 'https://user:secret@example.com/api', 'https://example.com/api?token=secret']) {
    expect(() => nativeApiUrl(invalid)).toThrow();
  }
});

for (const platform of ['android', 'ios']) {
  test(`${platform} sends login and school lookup to the shared production API`, async ({ page }) => {
    await page.addInitScript(name => {
      (window as any).CapacitorCustomPlatform = { name };
    }, platform);
    const calls: string[] = [];
    await page.route('https://attendoschool.online/api/**', async route => {
      const url = route.request().url();
      calls.push(url);
      if (url.includes('/auth/institutes')) return route.fulfill({ json: [{ id: 'school-1', name: 'Shared School', code: 'SHARED' }] });
      if (url.includes('/auth/lookup-institute')) return route.fulfill({ json: { found: true, instituteId: 'school-1', instituteName: 'Shared School', instituteCode: 'SHARED' } });
      if (url.endsWith('/auth/login')) {
        expect(route.request().postDataJSON()).toMatchObject({ role: 'STUDENT', instituteId: 'school-1', admissionNumber: 'ADM-101' });
        return route.fulfill({ status: 401, json: { message: 'Shared server received login.' } });
      }
      return route.fulfill({ json: [] });
    });
    await page.goto('/');
    await expect(page).toHaveURL(/#\/login/);
    await expect(page.locator('html')).toHaveClass(/native-app/);
    await page.selectOption('#login-role', 'STUDENT');
    await page.locator('#identifier-input').fill('ADM-101');
    await page.locator('#password-input').fill('test-password');
    await expect(page.locator('#detected-institute-display')).toContainText('Shared School');
    await page.locator('#submit-auth-btn').click();
    await expect(page.getByRole('alert')).toContainText('Shared server received login.');
    expect(calls.some(url => url.includes('/auth/lookup-institute'))).toBe(true);
    expect(calls.some(url => url.endsWith('/auth/login'))).toBe(true);
  });
}

test('ordinary web browsers retain same-origin API routing', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ json: [] }));
  await page.goto('/#/login');
  const apiBase = await page.evaluate(async () => {
    const modulePath = '/src/api.ts';
    return (await import(modulePath)).API_BASE_URL;
  });
  // Local development may have an existing explicit API override in .env.
  expect(apiBase === '/api' || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/api$/.test(apiBase)).toBe(true);
  await expect(page.locator('html')).not.toHaveClass(/native-app/);
});
