import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

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
  // production rewrites /console to the same file in vercel.json.
  await page.goto('/console.html#/members');
  await expect(page.getByRole('heading', { name: /sign in required|connexion requise/i })).toBeVisible();
  await expect(page.getByRole('main')).toHaveCount(1);

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expectNoAxeViolations(results.violations);
});
