import { test, expect, Page } from '@playwright/test';
const backupId = 'attendoschool-backup-20261108-020000-1234abcd';
async function boot(page: Page, role = 'SUPER_ADMIN', failCreate = false) {
  const user = { id: 'fixture-owner', name: 'Fixture Owner', email: 'owner@test.local', role, schoolId: role === 'SUPER_ADMIN' ? null : 'fixture-school' };
  let created = false, reads = 0;
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/access/me')) return route.fulfill({ json: { version: 1, role, schoolId: user.schoolId, loginEnabled: true, mode: 'off', permissions: [], features: [] } });
    if (url.pathname.endsWith('/backups/jobs')) {
      const status = created && ++reads < 2 ? 'queued' : 'ready';
      return route.fulfill({ json: { encrypted: false, jobs: [{ id: backupId, status, startedAt: '2026-11-08T02:00:00Z', encrypted: false, requestedBy: { name: 'Fixture Owner' }, size: 4096, fileName: `${backupId}.tar` }] } });
    }
    if (url.pathname.endsWith('/backups/create')) {
      if (failCreate) return route.fulfill({ status: 500, json: { message: 'Fixture disk is full' } });
      created = true; reads = 0; return route.fulfill({ status: 202, json: { id: backupId, status: 'queued' } });
    }
    if (url.pathname.endsWith('/download')) return route.fulfill({ contentType: 'application/octet-stream', body: 'synthetic-download' });
    return route.fulfill({ json: [] });
  });
  await page.addInitScript(u => { localStorage.setItem('attendance_user', JSON.stringify(u)); localStorage.setItem('attendance_token', 'fixture-token'); }, user);
}
test('owner navbar exposes real backup actions, warning, queue polling, dialog and download', async ({ page }) => {
  await boot(page); await page.goto('/#/super-admin/backups');
  const header = page.locator('header.sa-topbar');
  await header.getByRole('button', { name: 'Backups', exact: true }).click();
  await expect(header.getByRole('alert')).toContainText('Encryption is off');
  await header.getByRole('button', { name: 'Take backup now' }).click();
  await expect(header.getByRole('status')).toContainText('Backup ready', { timeout: 12000 });
  const saved = page.waitForEvent('download');
  await header.getByRole('status').getByRole('button', { name: 'Download', exact: true }).click();
  expect((await saved).suggestedFilename()).toBe(`${backupId}.tar`);
  await header.getByRole('button', { name: 'Backups', exact: true }).click();
  await header.getByRole('button', { name: 'All backups…' }).click();
  await expect(page.getByRole('dialog', { name: 'All backups' })).toContainText('Fixture Owner');
  await page.getByRole('button', { name: 'Close backups' }).click();
  await expect(page.getByRole('dialog', { name: 'All backups' })).not.toBeVisible();
});
test('API failure is shown instead of a successful-backup message', async ({ page }) => {
  await boot(page, 'SUPER_ADMIN', true); await page.goto('/#/super-admin/backups');
  const header = page.locator('header.sa-topbar');
  await header.getByRole('button', { name: 'Backups', exact: true }).click();
  await header.getByRole('button', { name: 'Take backup now' }).click();
  await expect(header.getByRole('status')).toContainText('Fixture disk is full');
});
test('school administrator cannot see backup controls even on the old backup page', async ({ page }) => {
  await boot(page, 'SCHOOL_ADMIN'); await page.goto('/#/backups');
  await expect(page.getByText('Only the platform Super Admin can take or download backups.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Take backup now' })).toHaveCount(0);
  await expect(page.locator('header').getByRole('button', { name: 'Backups', exact: true })).toHaveCount(0);
});
test('owner backup menu and dialog fit a phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await boot(page); await page.goto('/#/super-admin/backups');
  const header = page.locator('header.sa-topbar');
  await header.getByRole('button', { name: 'Backups', exact: true }).click();
  await expect(header.getByRole('button', { name: 'All backups…' })).toBeVisible();
  await header.getByRole('button', { name: 'All backups…' }).click();
  await expect(page.getByRole('dialog', { name: 'All backups' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy();
});
