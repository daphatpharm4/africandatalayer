import { expect, test } from "../fixtures/auth";

test("client can open delta intelligence and inspect the spatial cluster panel", async ({ page, gotoApp }) => {
  await gotoApp("/");

  await expect(page.getByTestId("screen-delta-dashboard")).toBeVisible();
  await page.getByRole("button", { name: /^Pharmacy$/i }).click();

  await expect(page.getByTestId("delta-spatial-intelligence")).toBeVisible();
  await expect(page.getByTestId("spatial-cell-selector-s0wzm8")).toBeVisible();
  await expect(page.getByText(/Why this vertical clusters where it does/i)).toBeVisible();
});
