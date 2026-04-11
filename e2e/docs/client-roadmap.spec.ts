import { expect, test } from "../fixtures/auth";
import { captureRolePage } from "../fixtures/screenshots";

test("@docs client roadmap captures reporting, drilldown, and account surfaces", async ({ page, gotoApp, adlRole }) => {
  const mainNavigation = () => page.getByTestId("main-navigation");

  await gotoApp("/");

  await expect(page.getByTestId("screen-delta-dashboard")).toBeVisible();
  await captureRolePage(page, adlRole, "01-client-dashboard-overview.png");

  await page.getByRole("button", { name: /^Pharmacy$/i }).click();
  await expect(page.getByTestId("delta-spatial-intelligence")).toBeVisible();
  await captureRolePage(page, adlRole, "02-client-pharmacy-story.png");

  await page.getByTestId("spatial-cell-selector-s0wzm8").click();
  await expect(page.getByText(/Focused cell s0wzm8/i)).toBeVisible();
  await captureRolePage(page, adlRole, "03-client-top-cell-map.png");

  await expect(page.getByLabel(/Export current view/i)).toBeVisible();
  await captureRolePage(page, adlRole, "04-client-export-surface.png");

  await mainNavigation().getByRole("button", { name: /^Map$/i }).click();
  await expect(page.getByTestId("screen-home")).toBeVisible();
  await expect(page.getByTestId("home-map-view")).toBeVisible();
  await captureRolePage(page, adlRole, "05-client-map-explorer.png");

  await mainNavigation().getByRole("button", { name: /^Insights$/i }).click();
  await expect(page.getByTestId("screen-analytics")).toBeVisible();
  await captureRolePage(page, adlRole, "06-client-insights.png");

  await page.getByRole("button", { name: /Investor Dashboard/i }).click();
  await expect(page.getByTestId("screen-investor-dashboard")).toBeVisible();
  await captureRolePage(page, adlRole, "07-client-investor-dashboard.png");

  await gotoApp("/");
  await mainNavigation().getByRole("button", { name: /^Account$/i }).click();
  await expect(page.getByTestId("screen-profile")).toBeVisible();
  await captureRolePage(page, adlRole, "08-client-profile-dashboard.png");

  await page.getByLabel(/Open settings/i).click();
  await expect(page.getByTestId("screen-settings")).toBeVisible();
  await captureRolePage(page, adlRole, "09-client-settings-profile.png");
});
