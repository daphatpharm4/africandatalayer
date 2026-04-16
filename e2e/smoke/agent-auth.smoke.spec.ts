import { expect, test } from '@playwright/test';
import { installAdlMocks } from '../fixtures/mockApi';

function seedGuestState() {
  window.localStorage.setItem('adl_splash_seen', 'true');
  window.localStorage.setItem('adl_has_authenticated', 'false');
  window.localStorage.setItem('adl_language', 'en');
}

test.beforeEach(async ({ page }) => {
  await installAdlMocks(page, 'agent', {
    initialSession: null,
    enableCredentialAuth: true,
  });
  await page.addInitScript(seedGuestState);
});

test('guest can create an account with credentials and return to the home screen', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page.getByTestId('screen-home')).toBeVisible();
  await page
    .getByTestId('main-navigation')
    .getByRole('button', { name: /sign in/i })
    .click();

  await expect(page.getByTestId('screen-auth')).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Use Google to continue/i }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /Join the network/i }),
  ).toBeVisible();

  await page.getByLabel(/Phone number or email/i).fill('new.agent@adl.test');
  await page.getByLabel(/^Password$/i).fill('Password123!');
  await page.getByRole('button', { name: /Create account/i }).click();

  await expect(page.getByTestId('screen-home')).toBeVisible();
  await expect(
    page
      .getByTestId('main-navigation')
      .getByRole('button', { name: /^Profile$/i }),
  ).toBeVisible();
});

test('guest sees an inline error for invalid credentials', async ({ page }) => {
  await page.goto('/');
  await page
    .getByTestId('main-navigation')
    .getByRole('button', { name: /sign in/i })
    .click();

  await expect(page.getByTestId('screen-auth')).toBeVisible();
  await page.getByRole('button', { name: /Sign in instead/i }).click();
  await page
    .getByLabel(/Phone number or email/i)
    .fill('agent.bonamoussadi@adl.test');
  await page.getByLabel(/^Password$/i).fill('WrongPass123!');
  await page.getByRole('button', { name: /^Sign in$/i }).click();

  await expect(
    page.getByText(/Invalid phone\/email or password/i),
  ).toBeVisible();
});

test('guest can move from registration conflict to the sign-in flow', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByTestId('main-navigation')
    .getByRole('button', { name: /sign in/i })
    .click();

  await expect(page.getByTestId('screen-auth')).toBeVisible();
  await page
    .getByLabel(/Phone number or email/i)
    .fill('agent.bonamoussadi@adl.test');
  await page.getByLabel(/^Password$/i).fill('Password123!');
  await page.getByRole('button', { name: /Create account/i }).click();

  await expect(
    page.getByText(/An account already exists for this phone\/email/i),
  ).toBeVisible();
  await page
    .getByRole('button', { name: /Already registered\? Sign in instead/i })
    .click();
  await expect(
    page.getByRole('heading', { name: /Welcome back/i }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /^Sign in$/i })).toBeVisible();
});
