import { expect, test } from "../fixtures/auth";

test("help center routes expose cross-role documentation and search", async ({ page, gotoApp }) => {
  await gotoApp("/docs/client");

  await expect(page.getByRole("heading", { name: /Client docs/i })).toBeVisible();
  await expect(page.locator("#screen-spatial-intelligence-focus")).toContainText("s0wzm8");

  await page.getByLabel(/Search docs/i).fill("submission queue");
  await expect(page.getByRole("button", { name: /Submission queue/i }).first()).toBeVisible();

  await page.getByRole("button", { name: /^Admin$/i }).first().click();
  await expect(page.getByRole("heading", { name: /Admin docs/i })).toBeVisible();
  await expect(page.locator("#screen-admin-automation")).toContainText("Automation leads");
});
