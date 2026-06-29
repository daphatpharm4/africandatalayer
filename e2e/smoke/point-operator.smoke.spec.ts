import { expect, test, type Page } from "@playwright/test";
import { installAdlMocks } from "../fixtures/mockApi";
import { getMockSession, type MockAuthSession } from "../fixtures/roles";

async function seedPointOperator(page: Page, session?: MockAuthSession | null, revoked = false) {
  await installAdlMocks(page, "point_operator", {
    initialSession: session === undefined ? getMockSession("point_operator") : session,
    pointOperatorRevoked: revoked,
  });
  await page.addInitScript(() => {
    window.localStorage.setItem("adl_splash_seen", "true");
    window.localStorage.setItem("adl_has_authenticated", "true");
    window.localStorage.setItem("adl_language", "en");
    window.localStorage.setItem("adl_e2e_role", "point_operator");
  });
}

test("point operator completes password gate and works assigned point workflow", async ({ page }) => {
  const forcedPasswordSession: MockAuthSession = {
    ...getMockSession("point_operator"),
    user: {
      ...getMockSession("point_operator").user,
      mustChangePassword: true,
    },
  };

  await seedPointOperator(page, forcedPasswordSession);
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.getByTestId("screen-point-operator-password")).toBeVisible();
  await page.getByLabel(/current password/i).fill("OperatorPass123!");
  await page.getByRole("textbox", { name: "New password", exact: true }).fill("OperatorPass456!");
  await page.getByLabel(/confirm new password/i).fill("OperatorPass456!");
  await page.getByRole("button", { name: /^change password$/i }).click();
  await expect(page.getByTestId("screen-auth")).toBeVisible();

  await seedPointOperator(page);
  let successfulStatusPosts = 0;
  page.on("requestfinished", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/user" && url.searchParams.get("view") === "po_status") {
      successfulStatusPosts += 1;
    }
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("screen-point-operator-status")).toBeVisible();

  const operatorNav = page.getByTestId("point-operator-navigation");
  await expect(operatorNav.getByRole("button")).toHaveCount(2);
  await expect(page.getByTestId("screen-point-operator-status").locator("article")).toHaveCount(3);
  await expect(page.getByText("Open now")).toBeVisible();
  await expect(page.getByText("On guard")).toBeVisible();
  await expect(page.getByText("Essential medicines available")).toBeVisible();

  let blockStatusPost = true;
  await page.route("**/api/user?view=po_status", async (route) => {
    if (blockStatusPost) {
      await route.abort("internetdisconnected");
      return;
    }
    await route.fallback();
  });
  await page.context().setOffline(true);
  await page.getByRole("button", { name: /^off$/i }).first().click();
  await expect(page.getByText(/pending sync/i).first()).toBeVisible();

  blockStatusPost = false;
  await page.context().setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => successfulStatusPosts, { timeout: 10_000 }).toBe(1);

  await operatorNav.getByRole("button", { name: /profile/i }).click();
  await expect(page.getByTestId("screen-point-operator-profile")).toBeVisible();
  await expect(page.getByText(/Point ID/i)).toBeVisible();
  await expect(page.getByText(/Locality/i)).toBeVisible();
  await expect(page.getByTestId("screen-point-operator-profile").getByRole("textbox")).toHaveCount(0);

  await page.locator('input[type="file"]').setInputFiles({
    name: "operator-photo.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
  });
  await expect(page.getByText(/saved|pending sync/i).first()).toBeVisible();
  const photoProvenance = await page.evaluate(async () => {
    const response = await fetch("/api/user?view=po_me");
    const payload = await response.json();
    return payload.point.details.operatorSignal;
  });
  expect(photoProvenance).toMatchObject({
    field: "photoUrl",
    reviewState: "pending_review",
  });

  await seedPointOperator(page, getMockSession("point_operator"), true);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("screen-point-operator-status")).toBeVisible();
  await expect(page.getByText(/No active point operator assignment found/i)).toBeVisible();
});
