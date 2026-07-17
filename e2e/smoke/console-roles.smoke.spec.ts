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
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ records: [] }) });
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
    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Not mocked' }) });
  });
}

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
