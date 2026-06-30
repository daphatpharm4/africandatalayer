import { expect, test, type Page } from "@playwright/test";
import { installAdlMocks } from "../fixtures/mockApi";
import { getBrowserSeedState } from "../fixtures/roles";

async function signInAsAdmin(page: Page) {
  await installAdlMocks(page, "admin");
  await page.addInitScript((state) => {
    for (const [key, value] of Object.entries(state.localStorage)) {
      window.localStorage.setItem(key, value);
    }
  }, getBrowserSeedState("admin"));
  await page.goto("/", { waitUntil: "domcontentloaded" });
}

test("admin can switch map scope and promote another account to admin", async ({ page }) => {
  await signInAsAdmin(page);

  await page.getByTestId("main-navigation").getByRole("button", { name: /^Map$/i }).click();
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

test("admin creates and links a point operator", async ({ page }) => {
  await signInAsAdmin(page);
  await page.getByTestId("main-navigation").getByRole("button", { name: /profile|profil/i }).click();
  await page.getByRole("button", { name: /point operator|opérateur du point/i }).click();
  const card = page.getByTestId("profile-point-operator-access");
  await card.getByLabel(/email or phone|email ou téléphone/i).fill("new.operator@adl.test");
  await card.getByLabel(/display name|nom affiché/i).fill("Market Operator");
  await card.getByLabel(/temporary password|mot de passe temporaire/i).fill("OperatorPass123!");
  await card.getByLabel(/search verified point|rechercher un point vérifié/i).fill("Bonamoussadi Pharmacy Center");
  await card.getByRole("option", { name: /Bonamoussadi Pharmacy Center/ }).click();
  await card.getByRole("button", { name: /^(create and link|créer et lier)$/i }).click();
  await expect(card.getByText(/operator linked\./i)).toBeVisible();
});
