import { expect, test } from "../fixtures/auth";
import { captureRolePage } from "../fixtures/screenshots";

test("@docs agent roadmap captures the full field journey", async ({ page, gotoApp, adlRole }) => {
  const mainNavigation = () => page.getByTestId("main-navigation");

  await gotoApp("/");

  await expect(page.getByTestId("screen-home")).toBeVisible();
  await expect(page.getByTestId("home-list-view")).toBeVisible();
  await captureRolePage(page, adlRole, "01-agent-home-list.png");

  await page.getByRole("button", { name: /^Map$/i }).click();
  await expect(page.getByTestId("home-map-view")).toBeVisible();
  await captureRolePage(page, adlRole, "02-agent-home-map.png");

  await gotoApp("/");
  const pharmacyPoint = page.getByRole("button", { name: /Bonamoussadi Pharmacy Center/i });
  await pharmacyPoint.evaluate((element: HTMLElement) => {
    element.scrollIntoView({ block: "center", inline: "nearest" });
  });
  await pharmacyPoint.click();
  await expect(page.getByTestId("screen-details")).toBeVisible();
  await captureRolePage(page, adlRole, "03-agent-point-detail.png");

  await page.getByRole("button", { name: /Enrich this point|Update this point/i }).click();
  await expect(page.getByTestId("screen-contribution-flow")).toBeVisible();
  await captureRolePage(page, adlRole, "04-agent-contribution-entry.png");

  await gotoApp("/");
  await mainNavigation().getByRole("button", { name: /^Profile$/i }).click();
  await expect(page.getByTestId("screen-profile")).toBeVisible();
  await page.getByRole("button", { name: /Pending Uploads/i }).click();
  await expect(page.getByTestId("screen-submission-queue")).toBeVisible();
  await captureRolePage(page, adlRole, "05-agent-submission-queue.png");

  await gotoApp("/");
  await mainNavigation().getByRole("button", { name: /^Profile$/i }).click();
  await expect(page.getByTestId("screen-profile")).toBeVisible();
  await captureRolePage(page, adlRole, "06-agent-profile-dashboard.png");

  await page.getByRole("button", { name: /Redeem XP/i }).click();
  await expect(page.getByTestId("screen-rewards")).toBeVisible();
  await captureRolePage(page, adlRole, "07-agent-rewards-catalog.png");

  await gotoApp("/");
  await mainNavigation().getByRole("button", { name: /^Profile$/i }).click();
  await expect(page.getByTestId("screen-profile")).toBeVisible();
  await page.getByLabel(/Open settings/i).click();
  await expect(page.getByTestId("screen-settings")).toBeVisible();
  await captureRolePage(page, adlRole, "08-agent-settings-profile.png");

  await gotoApp("/");
  await mainNavigation().getByRole("button", { name: /^Leaderboard$/i }).click();
  await expect(page.getByTestId("screen-analytics")).toBeVisible();
  await captureRolePage(page, adlRole, "09-agent-leaderboard.png");
});
