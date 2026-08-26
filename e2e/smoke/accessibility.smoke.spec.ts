import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { installAdlMocks } from '../fixtures/mockApi';
import { getBrowserSeedState, type AdlRole } from '../fixtures/roles';

const ORG_ID = '5a2f8f18-0000-4000-8000-000000000001';

async function openAuthenticatedApp(
  page: Page,
  role: AdlRole,
  options: { offline?: boolean } = {},
): Promise<void> {
  await installAdlMocks(page, role);
  await page.addInitScript(
    ({ localStorage: seed, offline }) => {
      for (const [key, value] of Object.entries(seed)) {
        window.localStorage.setItem(key, value);
      }
      if (offline) {
        Object.defineProperty(window.navigator, 'onLine', {
          configurable: true,
          get: () => false,
        });
      }
    },
    { localStorage: getBrowserSeedState(role).localStorage, offline: Boolean(options.offline) },
  );
}

async function expectMinimumHitArea(locator: ReturnType<Page['locator']>, minimum: number): Promise<void> {
  const box = await locator.boundingBox();
  expect(box, 'interactive control must have a rendered hit area').not.toBeNull();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(minimum);
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(minimum);
}

async function expectNoSeriousOrCriticalViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expectNoAxeViolations(
    results.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical',
    ),
  );
}

async function mockReviewerConsole(page: Page): Promise<void> {
  await page.route('**/api/user?view=platform_*', async (route) => {
    const view = new URL(route.request().url()).searchParams.get('view');
    if (view === 'platform_org_list') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          organizations: [{
            id: ORG_ID,
            name: 'Usiku Research',
            slug: 'usiku-research',
            logoUrl: null,
            accentColor: '#0f3d5e',
            createdAt: '2026-07-17T00:00:00.000Z',
            role: 'reviewer',
          }],
        }),
      });
      return;
    }
    if (view === 'platform_record_list') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          records: [{
            id: 'record-a11y-1',
            organizationId: ORG_ID,
            projectId: '5a2f8f18-0000-4000-8000-000000000002',
            schemaVersionId: '5a2f8f18-0000-4000-8000-000000000003',
            recordTypeKey: 'retail_outlet',
            data: { outlet_name: 'Accessible evidence kiosk', formal: true },
            evidence: {
              photos: [],
              gps: { latitude: -1.286389, longitude: 36.817223, accuracyMeters: 9 },
              capturedAt: '2026-07-18T08:30:00.000Z',
              device: { platform: 'Android', language: 'en', userAgent: 'ADL field app' },
            },
            status: 'pending_review',
            capturedBy: 'collector@usiku.test',
            createdAt: '2026-07-18T08:30:00.000Z',
          }],
        }),
      });
      return;
    }
    if (view === 'platform_project_list') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"projects":[]}' });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"Not mocked"}' });
  });
}

function expectNoAxeViolations(
  violations: Array<{
    id: string;
    impact?: string | null;
    help: string;
    nodes: Array<{ target?: unknown; html?: string; failureSummary?: string }>;
  }>,
): void {
  if (process.env.CI && violations.length > 0) {
    const summary = violations
      .map((violation) => {
        const nodes = violation.nodes
          .map((node) => `${JSON.stringify(node.target)} ${node.failureSummary ?? node.html ?? ''}`)
          .join('; ');
        return `${violation.id} (${violation.impact ?? 'unknown'}): ${violation.help}; ${nodes}`;
      })
      .join(' | ')
      .replace(/[\r\n]/g, ' ');
    console.error(`::error file=e2e/smoke/accessibility.smoke.spec.ts::axe violations: ${summary}`);
  }
  expect(violations).toEqual([]);
}

test('field entry supports zoom, landscape, keyboard, and WCAG AA', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/');

  const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(viewport).not.toMatch(/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i);
  await expect(page.getByText(/rotate your device|tourner votre appareil/i)).toHaveCount(0);

  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expectNoAxeViolations(results.violations);
});

test('signed-out organization console has one main landmark and WCAG AA', async ({ page }) => {
  // Vite's multi-page dev server exposes the console entry as console.html;
  // in production the console is its own site (console.africandatalayer.com).
  await page.goto('/console.html#/members');
  await expect(page.getByRole('heading', { name: /sign in to your company|connectez-vous à votre entreprise/i })).toBeVisible();
  await expect(page.getByRole('main')).toHaveCount(1);

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expectNoAxeViolations(results.violations);
});

test('selected field-map opportunity has no serious accessibility violations and a 48px action', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openAuthenticatedApp(page, 'agent');
  await page.goto('/');
  await page.getByRole('button', { name: /^Map$/i }).click();

  const marker = page.locator('[title="Bonamoussadi Pharmacy Center"]');
  await expect(marker).toBeVisible();
  await marker.click();
  const primaryAction = page.getByRole('button', { name: /View details/i });
  await expect(primaryAction).toBeVisible();

  await expectMinimumHitArea(primaryAction, 48);
  await expectNoSeriousOrCriticalViolations(page);
});

test('offline field capture exposes recovery without serious accessibility violations', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openAuthenticatedApp(page, 'agent', { offline: true });
  await page.goto('/');

  await expect(page.getByTestId('capture-sync-state')).toContainText(/Offline/i);
  await page.getByRole('button', { name: /^Map$/i }).click();
  await page.locator('[title="Bonamoussadi Pharmacy Center"]').click();
  const viewDetails = page.getByRole('button', { name: /View details/i });
  await expect(viewDetails).toBeVisible();
  await viewDetails.click();
  await page.getByRole('button', { name: /Complete this point|Enrich this point|Update this point/i }).click();

  const recoveryAction = page.getByTestId('capture-recovery-cta');
  await expect(recoveryAction).toBeVisible();
  await expectMinimumHitArea(recoveryAction, 48);
  await expectNoSeriousOrCriticalViolations(page);
});

test('client spatial drill-down has no serious accessibility violations', async ({ page }) => {
  await openAuthenticatedApp(page, 'client');
  await page.goto('/');
  await page.getByRole('button', { name: /^Pharmacy$/i }).click();
  await expect(page.getByTestId('dashboard-map-drilldown')).toBeVisible();

  await expectNoSeriousOrCriticalViolations(page);
});

test('expanded web Console evidence detail has no serious accessibility violations', async ({ page }) => {
  await openAuthenticatedApp(page, 'agent');
  await mockReviewerConsole(page);
  await page.goto('/console.html#/review');
  await page.getByRole('button', { name: /retail outlet/i }).click();
  await expect(page.getByText('Accessible evidence kiosk')).toBeVisible();

  await expectNoSeriousOrCriticalViolations(page);
});
