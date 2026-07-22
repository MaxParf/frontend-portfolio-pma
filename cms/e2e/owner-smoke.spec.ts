import { expect, test } from "@playwright/test";

const login = process.env.CMS_TEST_LOGIN ?? "@maxpar.fed";
const password = process.env.CMS_TEST_PASSWORD;

test("existing owner can sign in, retain a session after refresh, and sign out", async ({ page }) => {
  test.skip(!password, "CMS_TEST_PASSWORD is required for the owner smoke test.");
  const fives: string[] = [];
  page.on("response", (response) => { if (response.status() >= 500) fives.push(`${response.status()} ${response.url()}`); });
  await page.goto("/login");
  await page.getByLabel("Login").fill(login);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByTestId("cms-shell")).toBeVisible();
  await expect(page.getByText(login)).toBeVisible();
  await page.getByRole("tab", { name: "Media" }).click();
  await expect(page.getByLabel("Upload image")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("cms-shell")).toBeVisible();
  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page.getByLabel("Login")).toBeVisible();
  expect(fives).toEqual([]);
});
