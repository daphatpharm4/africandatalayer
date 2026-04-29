import { expect, test } from '../fixtures/auth';

function parseAlpha(backgroundColor: string): number {
  const rgbaMatch = backgroundColor.match(/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([0-9.]+)\s*\)/i);
  if (rgbaMatch?.[1]) return Number(rgbaMatch[1]);
  if (/^rgb\(/i.test(backgroundColor)) return 1;
  return 0;
}

test('Explore map keeps mission peek above a readable bottom navigation', async ({ page, gotoApp }) => {
  await gotoApp('/');

  await expect(page.getByTestId('screen-home')).toBeVisible();

  const mapTab = page.getByRole('button', { name: /^Map$/i }).first();
  await mapTab.click();

  const nav = page.getByTestId('main-navigation');
  const missionPeek = page.getByTestId('mission-peek-primary');

  await expect(page.getByTestId('home-map-view')).toBeVisible();
  await expect(nav).toBeVisible();
  await expect(missionPeek).toBeVisible();
  await expect(missionPeek).toContainText(/Next high-value capture/i);

  const navBackground = await nav.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(parseAlpha(navBackground)).toBeGreaterThanOrEqual(0.98);

  const navBox = await nav.boundingBox();
  const missionBox = await missionPeek.boundingBox();
  expect(navBox).not.toBeNull();
  expect(missionBox).not.toBeNull();
  if (!navBox || !missionBox) return;

  expect(missionBox.y + missionBox.height).toBeLessThanOrEqual(navBox.y - 8);
});
