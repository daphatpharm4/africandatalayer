import { expect, test } from "../fixtures/auth";

test("help center shows only the viewer's role tab and redirects disallowed routes", async ({ page, gotoApp }) => {
  await gotoApp("/docs/client");

  await expect(page.getByRole("heading", { name: /Client docs/i })).toBeVisible();
  await expect(page.locator("#screen-spatial-intelligence-focus")).toContainText("s0wzm8");

  const tabs = page.getByRole("navigation", { name: /Help center audiences/i });
  await expect(tabs.getByRole("button", { name: /^Overview$/i })).toBeVisible();
  await expect(tabs.getByRole("button", { name: /^Client$/i })).toBeVisible();
  await expect(tabs.getByRole("button", { name: /^Agent$/i })).toHaveCount(0);
  await expect(tabs.getByRole("button", { name: /^Admin$/i })).toHaveCount(0);

  await page.getByLabel(/Search docs/i).fill("submission queue");
  await expect(page.getByRole("button", { name: /Submission queue/i }).first()).toBeVisible();

  await page.goto("/docs/admin");
  await expect(page).toHaveURL(/\/docs\/client$/);
  await expect(page.getByRole("heading", { name: /Client docs/i })).toBeVisible();
});
