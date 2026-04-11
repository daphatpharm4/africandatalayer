import { expect, test } from "../fixtures/auth";

test("admin can switch map scope and promote another account to admin", async ({ page, gotoApp }) => {
  await gotoApp("/");

  await expect(page.getByTestId("screen-home")).toBeVisible();
  await expect(page.getByTestId("home-map-scope-toggle")).toBeVisible();
  await expect(page.getByTestId("home-map-scope-global")).toHaveAttribute("aria-pressed", "true");

  await page.getByTestId("home-map-scope-bonamoussadi").click();
  await expect(page.getByTestId("home-map-scope-bonamoussadi")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/Zone active - Bonamoussadi/i)).toBeVisible();

  await page.getByTestId("home-map-scope-global").click();
  await expect(page.getByTestId("home-map-scope-global")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/Full access - Worldwide/i)).toBeVisible();

  await page.getByTestId("main-navigation").getByRole("button", { name: /^Profile$/i }).click();
  await expect(page.getByTestId("screen-profile")).toBeVisible();
  await expect(page.getByTestId("profile-admin-access")).toBeVisible();

  await page.getByTestId("admin-account-lookup-input").fill("field.reviewer@adl.test");
  await page.getByTestId("admin-account-lookup-submit").click();

  await expect(page.getByText(/Serge Route Mapper/i)).toBeVisible();
  await expect(page.getByTestId("admin-account-role")).toHaveValue("agent");

  await page.getByTestId("admin-account-role").selectOption("admin");
  await page.getByTestId("admin-account-save").click();

  await expect(page.getByText(/Account access updated\./i)).toBeVisible();
  await expect(page.getByTestId("admin-account-role")).toHaveValue("admin");
  await expect(page.getByTestId("profile-admin-access")).toContainText(/Current access: Admin/i);
  await expect(page.getByTestId("profile-admin-access")).toContainText(/Worldwide/i);
});
