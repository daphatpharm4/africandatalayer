import { expect, test } from '../fixtures/auth';

const ORG_ID = '5a2f8f18-0000-4000-8000-000000000001';
const PROJECT_ID = '5a2f8f18-0000-4000-8000-000000000002';
const SCHEMA_ID = '5a2f8f18-0000-4000-8000-000000000003';

test('invited collector sees company profile and submits the company form on mobile', async ({ page, gotoApp }) => {
  let submittedBody: Record<string, unknown> | null = null;
  await page.route('**/api/user?view=platform_*', async (route) => {
    const request = route.request();
    const view = new URL(request.url()).searchParams.get('view');
    if (view === 'platform_org_list') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ organizations: [{
        id: ORG_ID, name: 'Usiku Research', slug: 'usiku-research', logoUrl: null,
        accentColor: '#0f3d5e', createdAt: '2026-07-17T00:00:00.000Z', role: 'collector',
      }] }) });
      return;
    }
    if (view === 'platform_project_list') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ projects: [{
        id: PROJECT_ID, organizationId: ORG_ID, name: 'Retail Census', status: 'active', createdAt: '2026-07-17T00:00:00.000Z',
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
});
