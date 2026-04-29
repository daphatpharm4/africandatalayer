import { expect, test } from "../fixtures/auth";

test("admin can switch map scope and promote another account to admin", async ({ page, gotoApp }) => {
  await gotoApp("/");

  await expect(page.getByTestId("screen-home")).toBeVisible();
  await expect(page.getByTestId("home-map-scope-toggle")).toBeVisible();
  await expect(page.getByTestId("home-map-scope-bonamoussadi")).toHaveAttribute("aria-pressed", "true");

  await page.getByTestId("home-map-scope-global").click();
  await expect(page.getByTestId("home-map-scope-global")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/Full access\s*·\s*Worldwide/i)).toBeVisible();

  await page.getByTestId("home-map-scope-bonamoussadi").click();
  await expect(page.getByTestId("home-map-scope-bonamoussadi")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/Zone active\s*·\s*Bonamoussadi/i)).toBeVisible();

  await page.getByTestId("home-map-scope-global").click();
  await expect(page.getByTestId("home-map-scope-global")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/Full access\s*·\s*Worldwide/i)).toBeVisible();

  await page.getByTestId("main-navigation").getByRole("button", { name: /^Profile$/i }).click();
  await expect(page.getByTestId("screen-profile")).toBeVisible();
  await expect(page.getByTestId("profile-admin-access")).toBeVisible();

  await page.getByTestId("admin-account-create-identifier").fill("new.client@adl.test");
  await page.getByTestId("admin-account-create-name").fill("New Client Buyer");
  await page.getByTestId("admin-account-create-role").selectOption("client");
  await page.getByTestId("admin-account-create-password").fill("ClientPass123!");
  await page.getByTestId("admin-account-create-submit").click();

  await expect(page.getByTestId("admin-account-create-success")).toContainText(/Account created/i);
  await expect(page.getByText(/New Client Buyer/i)).toBeVisible();
  await expect(page.getByTestId("admin-account-role")).toHaveValue("client");
  await expect(page.getByTestId("profile-admin-access")).toContainText(/Current access: Client/i);

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
