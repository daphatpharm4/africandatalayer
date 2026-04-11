import { expect, test } from "../fixtures/auth";

test("profile help center entry opens the role-specific documentation", async ({ page, gotoApp, adlRole }) => {
  const mainNavigation = () => page.getByTestId("main-navigation");
  const profileLabel = adlRole === "client" ? /^Account$/i : /^Profile$/i;
  const docsHeading =
    adlRole === "client"
      ? /Client docs/i
      : adlRole === "admin"
        ? /Admin docs/i
        : /Agent docs/i;

  await gotoApp("/");
  await mainNavigation().getByRole("button", { name: profileLabel }).click();
  await expect(page.getByTestId("screen-profile")).toBeVisible();

  await page.getByTestId("profile-open-help-center").click();

  await expect(page).toHaveURL(new RegExp(`/docs/${adlRole}$`));
  await expect(page.getByRole("heading", { name: docsHeading })).toBeVisible();
});
