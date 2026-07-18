import { expect, test } from '../fixtures/auth';
import type { Page } from '@playwright/test';

const ORG_ID = '5a2f8f18-0000-4000-8000-000000000001';

async function mockConsoleRole(page: Page, role: 'viewer' | 'reviewer' | 'manager' | 'owner') {
  await page.route('**/api/user?view=platform_*', async (route) => {
    const view = new URL(route.request().url()).searchParams.get('view');
    if (view === 'platform_org_list') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ organizations: [{
        id: ORG_ID, name: 'Usiku Research', slug: 'usiku-research', logoUrl: null,
        accentColor: '#0f3d5e', createdAt: '2026-07-17T00:00:00.000Z', role,
      }] }) });
      return;
    }
    if (view === 'platform_record_list') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ records: [{
        id: 'record-evidence-1', organizationId: ORG_ID,
        projectId: '5a2f8f18-0000-4000-8000-000000000002', schemaVersionId: '5a2f8f18-0000-4000-8000-000000000003',
        recordTypeKey: 'retail_outlet', data: { outlet_name: 'Evidence kiosk', formal: true },
        evidence: {
          photos: ['data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='],
          gps: { latitude: -1.286389, longitude: 36.817223, accuracyMeters: 9 },
          capturedAt: '2026-07-18T08:30:00.000Z',
          device: { platform: 'Android', language: 'en', userAgent: 'ADL field app' },
          photoMetadata: [{ width: 1080, height: 1920, originalBytes: 450000, storedBytes: 90000 }],
        },
        status: 'pending_review', capturedBy: 'collector@usiku.test', createdAt: '2026-07-18T08:30:00.000Z',
      }] }) });
      return;
    }
    if (view === 'platform_record_browse') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ records: [] }) });
      return;
    }
    if (view === 'platform_project_list') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ projects: [] }) });
      return;
    }
    if (view === 'platform_org_members') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ members: Array.from({ length: 24 }, (_, index) => ({
        organizationId: ORG_ID, userId: `member-${index + 1}@usiku.test`, role: index === 0 ? 'owner' : 'collector', createdAt: '2026-07-17T00:00:00.000Z',
      })), invites: [] }) });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Not mocked' }) });
  });
}

test('reviewer inspects form, photo, GPS, and device evidence before deciding', async ({ page }) => {
  await mockConsoleRole(page, 'reviewer');
  await page.goto('/console.html#/review');
  await page.getByRole('button', { name: /retail outlet/i }).click();

  await expect(page.getByText('Evidence kiosk')).toBeVisible();
  await expect(page.getByText('-1.286389, 36.817223 · ±9 m')).toBeVisible();
  await expect(page.getByText(/Android · en · ADL field app/)).toBeVisible();
  await expect(page.getByText(/1080×1920/)).toBeVisible();
  await page.getByRole('button', { name: 'Field evidence photo 1' }).click();
  await expect(page.getByRole('dialog', { name: 'Field evidence photo 1' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Field evidence photo 1' })).toHaveCount(0);
});

test('company console remains vertically scrollable on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockConsoleRole(page, 'owner');
  await page.goto('/console.html#/members');
  await expect(page.getByText('member-24@usiku.test')).toBeAttached();

  const scrollRegion = page.locator('main.console-scroll-region');
  await expect(scrollRegion).toBeVisible();
  const before = await scrollRegion.evaluate((element) => ({ top: element.scrollTop, height: element.clientHeight, full: element.scrollHeight }));
  expect(before.full).toBeGreaterThan(before.height);
  await scrollRegion.evaluate((element) => element.scrollTo({ top: element.scrollHeight, behavior: 'instant' }));
  await expect.poll(() => scrollRegion.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
});

const roleCases = [
  { role: 'viewer' as const, heading: 'Data viewer workspace', visible: 'Company data', hidden: 'Review queue' },
  { role: 'reviewer' as const, heading: 'Review workspace', visible: 'Review queue', hidden: 'Members' },
  { role: 'manager' as const, heading: 'Operations workspace', visible: 'Members', hidden: 'Settings' },
  { role: 'owner' as const, heading: 'Company administration', visible: 'Settings', hidden: '' },
];

for (const item of roleCases) {
  test(`${item.role} receives the correct company console workspace`, async ({ page }) => {
    await mockConsoleRole(page, item.role);
    await page.goto('/console.html#/overview');
    await expect(page.getByRole('heading', { name: item.heading })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Console sections' }).getByText(item.visible, { exact: true })).toBeVisible();
    if (item.hidden) {
      await expect(page.getByRole('navigation', { name: 'Console sections' }).getByText(item.hidden, { exact: true })).toHaveCount(0);
    }
  });
}

test('non-admin accounts without a company are sent to invitation flow, not owner onboarding', async ({ page }) => {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      user: { id: 'new@company.test', email: 'new@company.test', role: 'agent', isAdmin: false },
      expires: '2030-01-01T00:00:00.000Z',
    }) });
  });
  await page.route('**/api/user?view=platform_org_list', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ organizations: [] }) });
  });
  await page.goto('/console.html#/onboarding');
  await expect(page.getByRole('heading', { name: 'A company invitation is required' })).toBeVisible();
  await expect(page.getByText('Create your organization')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
});
