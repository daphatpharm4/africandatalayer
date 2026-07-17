import { expect, test } from '../fixtures/auth';

const ORG_ID = '5a2f8f18-0000-4000-8000-000000000001';
const PROJECT_ID = '5a2f8f18-0000-4000-8000-000000000002';
const SCHEMA_ID = '5a2f8f18-0000-4000-8000-000000000003';

test('invited collector sees company profile and submits the company form on mobile', async ({ page, gotoApp }) => {
  let submittedBody: Record<string, unknown> | null = null;
  const publicExploreRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/submissions') {
      publicExploreRequests.push(request.url());
    }
  });
  await page.route('**/api/user?view=platform_*', async (route) => {
    const request = route.request();
    const view = new URL(request.url()).searchParams.get('view');
    if (view === 'platform_org_list') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ organizations: [{
        id: ORG_ID, name: 'Usiku Research', slug: 'usiku-research', logoUrl: '/company-logo.png',
        accentColor: '#0f3d5e', createdAt: '2026-07-17T00:00:00.000Z', role: 'collector',
      }] }) });
      return;
    }
    if (view === 'platform_project_list') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ projects: [{
        id: PROJECT_ID, organizationId: ORG_ID, name: 'Retail Census', status: 'active',
        coverageScope: 'country', coverageLabel: 'Kenya', createdAt: '2026-07-17T00:00:00.000Z',
      }] }) });
      return;
    }
    if (view === 'platform_schema_get') {
      const published = {
        id: SCHEMA_ID, projectId: PROJECT_ID, organizationId: ORG_ID, version: 1, status: 'published', publishedAt: '2026-07-17T00:00:00.000Z',
        definition: { recordTypes: [{
          key: 'retail_outlet', label: { en: 'Retail outlet', fr: 'Point de vente' },
          fields: [
            { key: 'outlet_name', label: { en: 'Outlet name', fr: 'Nom du point' }, type: 'text', required: true },
            { key: 'formal', label: { en: 'Formal business', fr: 'Entreprise formelle' }, type: 'boolean', required: true },
          ],
          evidence: { gpsRequired: false, minPhotos: 0, notesRequired: false },
        }] },
      };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ draft: null, published, versions: [published] }) });
      return;
    }
    if (view === 'platform_record_create' && request.method() === 'POST') {
      submittedBody = request.postDataJSON() as Record<string, unknown>;
      expect(request.headers()['idempotency-key']).toBeTruthy();
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ record: {
        id: 'record-1', organizationId: ORG_ID, projectId: PROJECT_ID, schemaVersionId: SCHEMA_ID,
        recordTypeKey: 'retail_outlet', data: (submittedBody as { data?: unknown }).data, evidence: { photos: [] },
        status: 'pending_review', capturedBy: 'agent.bonamoussadi@adl.test', createdAt: '2026-07-17T00:00:00.000Z',
      } }) });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Not mocked' }) });
  });

  await gotoApp('/');
  await expect(page.getByTestId('screen-home')).toBeVisible();
  await expect(page.getByTestId('company-explore-name')).toHaveText('Usiku Research');
  await expect(page.getByTestId('company-explore-logo')).toHaveAttribute('src', '/company-logo.png');
  await expect(page.getByTestId('company-vertical-picker')).toContainText('Retail outlet');
  await expect(page.getByTestId('screen-home')).toContainText('Company workspace · Kenya');
  await expect(page.getByText('Next high-value capture')).toHaveCount(0);
  await expect(page.getByText('+25 XP')).toHaveCount(0);
  await expect(page.getByText('Nearby opportunities')).toHaveCount(0);
  await expect(page.getByText('Browse as list')).toHaveCount(0);
  await expect(page.getByText('19 points in view')).toHaveCount(0);
  await expect(page.getByText('Category: Pharmacy')).toHaveCount(0);
  await expect(page.getByTestId('main-navigation').getByRole('button', { name: 'Leaderboard' })).toHaveCount(0);
  expect(publicExploreRequests).toEqual([]);
  await page.getByTestId('main-navigation').getByRole('button', { name: 'Contribute' }).click();

  await expect(page.getByTestId('screen-platform-collection')).toBeVisible();
  await expect(page.getByText('Usiku Research').first()).toBeVisible();
  await expect(page.getByText('Retail outlet').first()).toBeVisible();
  await page.getByLabel('Outlet name').fill('Marché Central Kiosk');
  await page.getByRole('button', { name: 'Yes' }).click();
  await page.getByRole('button', { name: 'Submit to company' }).click();

  await expect(page.getByText('Company record sent')).toBeVisible();
  expect((submittedBody?.data as Record<string, unknown>).outlet_name).toBe('Marché Central Kiosk');
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByTestId('main-navigation').getByRole('button', { name: 'Profile' }).click();
  await expect(page.getByTestId('profile-company-workspace')).toContainText('Usiku Research');
  await expect(page.getByTestId('profile-company-workspace')).toContainText('collector');
  await expect(page.getByRole('button', { name: 'Redeem XP' })).toHaveCount(0);
  await expect(page.getByText('Convert to Rewards', { exact: true })).toHaveCount(0);
});

test('public contributors retain access to rewards', async ({ page, gotoApp }) => {
  await gotoApp('/');
  await page.getByTestId('main-navigation').getByRole('button', { name: 'Profile' }).click();

  await expect(page.getByTestId('screen-profile')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Redeem XP' })).toBeVisible();
  await expect(page.getByText('Convert to Rewards', { exact: true })).toBeVisible();
});

test('suspended company users stay out of public collection and see the access reason', async ({ page, gotoApp }) => {
  await page.route('**/api/user?view=platform_*', async (route) => {
    const view = new URL(route.request().url()).searchParams.get('view');
    if (view === 'platform_org_list') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ organizations: [{
        id: ORG_ID,
        name: 'Usiku Research',
        slug: 'usiku-research',
        logoUrl: null,
        accentColor: '#0f3d5e',
        accessStatus: 'suspended',
        suspensionReason: 'Subscription payment overdue',
        suspendedAt: '2026-07-18T00:00:00.000Z',
        createdAt: '2026-07-17T00:00:00.000Z',
        role: 'collector',
      }] }) });
      return;
    }
    await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({
      error: 'This company workspace is suspended. Contact ADL support.',
      code: 'platform_org_suspended',
    }) });
  });

  await gotoApp('/');
  await expect(page.getByTestId('company-explore-name')).toHaveText('Usiku Research');
  await expect(page.getByText('Company access suspended')).toBeVisible();
  await expect(page.getByText('Subscription payment overdue')).toBeVisible();
  await expect(page.getByText('Next high-value capture')).toHaveCount(0);
  await page.getByTestId('main-navigation').getByRole('button', { name: 'Contribute' }).click();
  await expect(page.getByTestId('screen-platform-collection')).toContainText('Company access suspended');
  await expect(page.getByRole('button', { name: 'Submit to company' })).toHaveCount(0);
});
