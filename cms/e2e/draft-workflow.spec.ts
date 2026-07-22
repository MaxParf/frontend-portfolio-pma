import { expect, test } from "@playwright/test";

const login = process.env.CMS_TEST_LOGIN ?? "@maxpar.fed";
const password = process.env.CMS_TEST_PASSWORD;

test("owner can save, publish, restore, and discard local project edits", async ({ page, request }) => {
  test.skip(!password, "CMS_TEST_PASSWORD is required for the local authenticated browser workflow.");
  const baselineResponse = await request.get("http://127.0.0.1:3001/api/v1/projects/project-bradbury?locale=en");
  expect(baselineResponse.ok()).toBeTruthy();
  const baseline = (await baselineResponse.json()).data;
  const canonicalTitle = "Project Bradbury";
  const title = `${baseline.title} browser-${Date.now()}`;
  const errors: string[] = [];
  const fives: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("response", (response) => { if (response.status() >= 500) fives.push(`${response.status()} ${response.url()}`); });

  await page.goto("/login");
  await page.getByLabel("Login").fill(login);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByTestId("cms-shell")).toBeVisible();
  await expect(page.getByText("@maxpar.fed")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("cms-shell")).toBeVisible();

  await page.getByRole("button", { name: "Project Bradbury" }).click();
  const titleInput = page.getByRole("textbox", { name: "title", exact: true });
  await titleInput.fill(title);
  await expect(page.getByText("Unsaved changes")).toBeVisible();
  await expect(page.locator(".preview-card h3")).toHaveText(title);

  const food = page.getByRole("button", { name: /FoodAI/ });
  await food.click();
  const switchDialog = page.getByRole("dialog");
  await expect(switchDialog).toBeVisible();
  await expect(switchDialog.getByRole("button", { name: "Stay and continue editing" })).toBeFocused();
  await page.keyboard.press("Shift+Tab"); await expect(switchDialog.getByRole("button", { name: "Discard changes and switch" })).toBeFocused();
  await page.keyboard.press("Tab"); await expect(switchDialog.getByRole("button", { name: "Stay and continue editing" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(switchDialog).toBeHidden();
  await expect(food).toBeFocused();
  await expect(titleInput).toHaveValue(title);

  await page.getByRole("tab", { name: "Publishing" }).click();
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved")).toBeVisible();
  const beforePublish = await request.get("http://127.0.0.1:3001/api/v1/projects/project-bradbury?locale=en");
  expect((await beforePublish.json()).data.title).toBe(baseline.title);
  await page.reload();
  await page.getByRole("button", { name: "Project Bradbury" }).click();
  await page.getByRole("tab", { name: "Publishing" }).click();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  const dialog = page.getByRole("dialog"); await expect(dialog).toHaveAttribute("aria-modal", "true");
  await page.keyboard.press("Escape"); await page.getByRole("button", { name: "Publish", exact: true }).click();
  await dialog.getByRole("button", { name: "Publish" }).click();
  await expect(dialog).toBeHidden();
  const afterPublish = await request.get("http://127.0.0.1:3001/api/v1/projects/project-bradbury?locale=en");
  expect((await afterPublish.json()).data.title).toBe(title);

  await page.getByRole("tab", { name: "Content" }).click();
  await titleInput.fill(canonicalTitle);
  await page.getByRole("tab", { name: "Publishing" }).click();
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Publish" }).click();
  await expect.poll(async () => (await (await request.get("http://127.0.0.1:3001/api/v1/projects/project-bradbury?locale=en")).json()).data.title).toBe(canonicalTitle);
  const restored = await request.get("http://127.0.0.1:3001/api/v1/projects/project-bradbury?locale=en");
  expect((await restored.json()).data).toEqual({ ...baseline, title: canonicalTitle });

  await page.getByRole("tab", { name: "Content" }).click(); await titleInput.fill(`${baseline.title} local`); await page.getByRole("button", { name: "Logout" }).click();
  await expect(page.getByRole("dialog")).toBeVisible(); await page.keyboard.press("Escape"); await expect(page.getByTestId("cms-shell")).toBeVisible();
  await page.getByRole("button", { name: "Logout" }).click(); await page.getByRole("dialog").getByRole("button", { name: "Discard changes and log out" }).click();
  await expect(page.getByLabel("Login")).toBeVisible();
  expect(await page.evaluate(() => fetch("http://127.0.0.1:3001/api/v1/admin/auth/me", { credentials: "include" }).then((response) => response.status))).toBe(401);
  expect(await page.evaluate(() => fetch("http://127.0.0.1:3001/api/v1/admin/projects", { credentials: "include" }).then((response) => response.status))).toBe(401);
  expect(errors.filter((message) => !message.includes("401 (Unauthorized)"))).toEqual([]); expect(fives).toEqual([]);
});
