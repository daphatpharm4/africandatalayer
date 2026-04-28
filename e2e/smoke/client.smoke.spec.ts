import { expect, test } from "../fixtures/auth";

test("client can open delta intelligence and inspect the spatial cluster panel", async ({ page, gotoApp }) => {
  await gotoApp("/");

  await expect(page.getByTestId("screen-delta-dashboard")).toBeVisible();
  await page.getByRole("button", { name: /^Pharmacy$/i }).click();

  await expect(page.getByTestId("delta-spatial-intelligence")).toBeVisible();
  await expect(page.getByTestId("spatial-cell-selector-s0wzm8")).toBeVisible();
  await expect(page.getByText(/Why this vertical clusters where it does/i)).toBeVisible();
});

test("client account nav keeps delta intelligence one tap away", async ({ page, gotoApp }) => {
  const mainNavigation = () => page.getByTestId("main-navigation");

  await gotoApp("/");

  await expect(mainNavigation().getByRole("button", { name: /Delta Intelligence/i })).toBeVisible();
  await expect(mainNavigation().getByRole("button", { name: /^Dashboard$/i })).toBeVisible();
  await expect(mainNavigation().getByRole("button", { name: /^Map$/i })).toBeVisible();
  await expect(mainNavigation().getByRole("button", { name: /^Insights$/i })).toBeVisible();
  await expect(mainNavigation().getByRole("button", { name: /^Account$/i })).toBeVisible();

  await mainNavigation().getByRole("button", { name: /^Dashboard$/i }).click();
  await expect(page.getByTestId("screen-investor-dashboard")).toBeVisible();

  await mainNavigation().getByRole("button", { name: /^Insights$/i }).click();
  await expect(page.getByTestId("screen-client-insights")).toBeVisible();

  await mainNavigation().getByRole("button", { name: /^Account$/i }).click();
  await expect(page.getByTestId("screen-profile")).toBeVisible();

  await mainNavigation().getByRole("button", { name: /Delta Intelligence/i }).click();
  await expect(page.getByTestId("screen-delta-dashboard")).toBeVisible();
});
