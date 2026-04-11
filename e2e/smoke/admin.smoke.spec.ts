import { expect, test } from "../fixtures/auth";

test("admin can reach analytics and open the forensics queue", async ({ page, gotoApp }) => {
  await gotoApp("/");

  await expect(page.getByTestId("screen-home")).toBeVisible();
  await page.getByRole("button", { name: /Impact/i }).click();

  await expect(page.getByTestId("screen-analytics")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Admin$/i })).toBeVisible();

  await page.getByRole("button", { name: /^Admin$/i }).click();

  await expect(page.getByTestId("screen-admin-queue")).toBeVisible();
  await expect(page.getByText(/Submission Forensics/i)).toBeVisible();
  await expect(page.getByTestId("admin-review-queue")).toContainText("Bonamoussadi Pharmacy Center");
});
