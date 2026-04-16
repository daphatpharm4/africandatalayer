import { expect, test } from '../fixtures/auth';

test('agent can inspect a mapped point and enter contribution flow', async ({
  page,
  gotoApp,
}) => {
  await gotoApp('/');

  await expect(page.getByTestId('screen-home')).toBeVisible();
  await expect(page.getByTestId('home-list-view')).toBeVisible();
  const pharmacyPoint = page.getByRole('button', {
    name: /Bonamoussadi Pharmacy Center/i,
  });
  await expect(pharmacyPoint).toBeVisible();

  await pharmacyPoint.evaluate((element: HTMLElement) => {
    element.scrollIntoView({ block: 'center', inline: 'nearest' });
  });
  await pharmacyPoint.click();

  await expect(page.getByTestId('screen-details')).toBeVisible();
  await expect(page.getByText(/Geo-anchored location/i)).toBeVisible();

  await page
    .getByRole('button', { name: /Enrich this point|Update this point/i })
    .click();

  await expect(page.getByTestId('screen-contribution-flow')).toBeVisible();
  await expect(page.getByText(/Live photo \+ GPS mandatory/i)).toBeVisible();
});

test('agent can open the compact local leaderboard from the bottom navigation', async ({
  page,
  gotoApp,
}) => {
  await gotoApp('/');

  await expect(page.getByTestId('screen-home')).toBeVisible();
  await page.getByRole('button', { name: /Leaderboard/i }).click();

  await expect(page.getByTestId('screen-analytics')).toBeVisible();
  await expect(
    page.getByText(/Top contributors near you/i).first(),
  ).toBeVisible();
  await expect(page.getByText(/How rankings work/i)).toBeVisible();
  await expect(page.getByText(/Verified value score/i).first()).toBeVisible();
});
