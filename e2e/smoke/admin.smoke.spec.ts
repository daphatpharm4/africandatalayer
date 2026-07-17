import { expect, test } from "../fixtures/auth";

test("admin can reach analytics and open the forensics queue", async ({ page, gotoApp }) => {
  await gotoApp("/");

  await expect(page.getByTestId("screen-admin-queue")).toBeVisible();
  await page.getByRole("button", { name: /^Analytics$/i }).click();

  await expect(page.getByTestId("screen-delta-dashboard")).toBeVisible();

  await page.getByRole("button", { name: /^Queue$/i }).click();

  await expect(page.getByTestId("screen-admin-queue")).toBeVisible();
  await expect(page.getByRole("tab", { name: /Review cockpit/i })).toBeVisible();
  await expect(page.getByTestId("admin-review-queue")).toContainText("Bonamoussadi Pharmacy Center");
});

test("ADL admin can inspect and suspend a company from the cockpit", async ({ page, gotoApp }) => {
  await gotoApp("/");
  await expect(page.getByTestId("screen-admin-queue")).toBeVisible();
  await page.getByRole("tab", { name: /^Companies$/i }).click();

  await expect(page.getByTestId("admin-companies-panel")).toBeVisible();
  await expect(page.getByText("Usiku Research")).toBeVisible();
  await expect(page.getByTestId("admin-company-5a2f8f18-0000-4000-8000-000000000001")).toContainText("19");

  await page.getByRole("button", { name: /Access and data/i }).click();
  await expect(page.getByText("owner@usiku.co.ke")).toBeVisible();
  await expect(page.getByText("Retail Census")).toBeVisible();

  await page.getByRole("button", { name: /^Suspend$/i }).click();
  await page.getByPlaceholder("Example: Subscription payment overdue").fill("Subscription payment overdue");
  await page.getByRole("button", { name: /Confirm suspension/i }).click();
  await expect(page.getByTestId("admin-company-5a2f8f18-0000-4000-8000-000000000001")).toContainText("Suspended");
});
