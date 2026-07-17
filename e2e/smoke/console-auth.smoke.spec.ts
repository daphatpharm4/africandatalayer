import { expect, test } from '@playwright/test';
import { installAdlMocks } from '../fixtures/mockApi';

const ORG_ID = '5a2f8f18-0000-4000-8000-000000000001';
const INVITE_TOKEN = 'a'.repeat(64);

function companyOrganization(role: 'collector' | 'manager' = 'collector') {
  return {
    id: ORG_ID,
    name: 'Usiku Research',
    slug: 'usiku-research',
    logoUrl: null,
    accentColor: '#0f3d5e',
    accessStatus: 'active',
    suspensionReason: null,
    suspendedAt: null,
    createdAt: '2026-07-17T00:00:00.000Z',
    role,
  };
}

test.beforeEach(async ({ page }) => {
  await installAdlMocks(page, 'agent', {
    initialSession: null,
    enableCredentialAuth: true,
  });
  await page.addInitScript(() => {
    window.localStorage.setItem('adl_language', 'en');
    window.localStorage.setItem('adl_has_authenticated', 'false');
  });
});

test('company users sign in on the dedicated console and land in their workspace', async ({ page }) => {
  await page.route('**/api/user?view=platform_org_list', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ organizations: [companyOrganization('manager')] }),
    });
  });

  await page.goto('/console.html');
  await expect(page.getByRole('heading', { name: 'Sign in to your company' })).toBeVisible();
  await expect(page.getByText('Company Console', { exact: true })).toBeVisible();
  await expect(page.getByText(/Pharmacy|Fuel station|Mobile money/i)).toHaveCount(0);

  await page.getByLabel('Work email').fill('agent.bonamoussadi@adl.test');
  await page.getByLabel('Password', { exact: true }).fill('Password123!');
  await page.getByRole('button', { name: 'Open company console' }).click();

  await expect(page.getByRole('heading', { name: 'Operations workspace' })).toBeVisible();
  await expect(page.getByText('Usiku Research').first()).toBeVisible();
  await expect(page).toHaveURL(/console\.html(?:#\/overview)?$/);
});

test('invited user creates the account inside the console and joins automatically', async ({ page }) => {
  let joined = false;
  await page.route('**/api/user?view=platform_*', async (route) => {
    const request = route.request();
    const view = new URL(request.url()).searchParams.get('view');
    if (view === 'platform_org_list') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ organizations: joined ? [companyOrganization()] : [] }),
      });
      return;
    }
    if (view === 'platform_invite_accept' && request.method() === 'POST') {
      joined = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ organizationId: ORG_ID }),
      });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Not mocked' }) });
  });

  await page.goto(`/console.html#/join?token=${INVITE_TOKEN}`);
  await expect(page.getByRole('heading', { name: 'Create your invited company account' })).toBeVisible();
  await page.getByLabel('Work email').fill('new.collector@usiku.co.ke');
  await page.getByLabel('Password', { exact: true }).fill('Password123!');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Create account and join company' }).click();

  await expect(page.getByText('You have joined the organization.')).toBeVisible();
  await expect(page.getByText('Usiku Research').first()).toBeVisible();
  await expect(page).toHaveURL(/console\.html#\/overview$/);
});
