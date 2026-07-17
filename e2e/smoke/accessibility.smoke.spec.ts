import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

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
  expect(results.violations).toEqual([]);
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
  expect(results.violations).toEqual([]);
});
