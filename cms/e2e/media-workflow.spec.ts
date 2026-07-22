import { expect, test } from "@playwright/test";

const login = process.env.CMS_TEST_LOGIN ?? "@maxpar.fed";
const password = process.env.CMS_TEST_PASSWORD;

test("owner can upload a managed project image into a local draft", async ({ page }) => {
  test.skip(!password, "CMS_TEST_PASSWORD is required for the local authenticated browser workflow.");
  const errors: string[] = []; const fives: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("response", (response) => { if (response.status() >= 500) fives.push(`${response.status()} ${response.url()}`); });
  await page.goto("/login");
  await page.getByLabel("Login").fill(login); await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click(); await expect(page.getByTestId("cms-shell")).toBeVisible();
  await page.getByRole("button", { name: "Project Bradbury" }).click(); await page.getByRole("tab", { name: "Media" }).click();
  await page.getByLabel("Upload image").setInputFiles("../images/projects/cus/cus-dashboard.png");
  await expect(page.getByText("Managed image")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("tab", { name: "Publishing" }).click(); await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved")).toBeVisible();
  expect(errors.filter((message) => !message.includes("401 (Unauthorized)"))).toEqual([]); expect(fives).toEqual([]);
});
