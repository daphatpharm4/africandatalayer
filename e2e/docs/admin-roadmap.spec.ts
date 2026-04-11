import { expect, test } from "../fixtures/auth";
import { captureRolePage } from "../fixtures/screenshots";

test("@docs admin roadmap captures review, orchestration, and reporting surfaces", async ({ page, gotoApp, adlRole }) => {
  const mainNavigation = () => page.getByTestId("main-navigation");

  await gotoApp("/");

  await expect(page.getByTestId("screen-home")).toBeVisible();
  await mainNavigation().getByRole("button", { name: /^Impact$/i }).click();
  await expect(page.getByTestId("screen-analytics")).toBeVisible();
  await captureRolePage(page, adlRole, "01-admin-analytics-entry.png");

  await page.getByRole("button", { name: /^Admin$/i }).click();
  await expect(page.getByTestId("screen-admin-queue")).toBeVisible();
  await captureRolePage(page, adlRole, "02-admin-review-queue.png");

  await page.getByRole("tab", { name: /Assignments/i }).click();
  await expect(page.locator("div").filter({ hasText: /^Bonamoussadi Core North$/ }).first()).toBeVisible();
  await captureRolePage(page, adlRole, "03-admin-assignments.png");

  await page.getByRole("tab", { name: /Automation/i }).click();
  await expect(page.getByText(/Candidate Care Pharmacy/i)).toBeVisible();
  await captureRolePage(page, adlRole, "04-admin-automation.png");

  await gotoApp("/");
  await mainNavigation().getByRole("button", { name: /^Impact$/i }).click();
  await expect(page.getByTestId("screen-analytics")).toBeVisible();
  await page.getByRole("button", { name: /Agent Performance/i }).click();
  await expect(page.getByTestId("screen-agent-performance")).toBeVisible();
  await captureRolePage(page, adlRole, "05-admin-agent-performance.png");

  await gotoApp("/");
  await mainNavigation().getByRole("button", { name: /^Impact$/i }).click();
  await expect(page.getByTestId("screen-analytics")).toBeVisible();
  await page.getByRole("button", { name: /Delta Intelligence/i }).click();
  await expect(page.getByTestId("screen-delta-dashboard")).toBeVisible();
  await captureRolePage(page, adlRole, "06-admin-delta-dashboard.png");

  await gotoApp("/");
  await mainNavigation().getByRole("button", { name: /^Impact$/i }).click();
  await expect(page.getByTestId("screen-analytics")).toBeVisible();
  await page.getByRole("button", { name: /Investor Dashboard/i }).click();
  await expect(page.getByTestId("screen-investor-dashboard")).toBeVisible();
  await captureRolePage(page, adlRole, "07-admin-investor-dashboard.png");
});
