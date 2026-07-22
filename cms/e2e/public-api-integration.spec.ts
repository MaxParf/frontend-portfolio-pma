import { expect, test } from "@playwright/test";

const publicUrl = "http://127.0.0.1:8080";

test("public portfolio renders published API data, preserves gallery behavior, and falls back safely", async ({ browser }) => {
  const apiContext = await browser.newContext();
  const apiPage = await apiContext.newPage();
  const apiErrors: string[] = [];
  const apiFives: string[] = [];
  apiPage.on("console", (message) => { if (message.type() === "error") apiErrors.push(message.text()); });
  apiPage.on("response", (response) => { if (response.status() >= 500) apiFives.push(`${response.status()} ${response.url()}`); });
  await apiPage.goto(publicUrl);
  await expect.poll(() => apiPage.locator("html").getAttribute("data-projects-source")).toBe("api");
  await expect(apiPage.locator(".project-card")).toHaveCount(3);
  await expect(apiPage.locator(".project-card__title").nth(1)).toHaveText("Project Bradbury");
  await apiPage.locator(".language-switcher").getByRole("button", { name: "RU", exact: true }).click();
  await expect.poll(() => apiPage.locator("html").getAttribute("lang")).toBe("ru");
  await expect.poll(() => apiPage.locator("html").getAttribute("data-projects-source")).toBe("api");
  await expect(apiPage.locator(".project-card__title").first()).toHaveText("Центр управления строительством");
  const gallery = apiPage.locator("[data-gallery]").nth(2);
  await gallery.click();
  await expect(apiPage.locator("#projectLightbox")).toHaveClass(/is-open/);
  await apiPage.keyboard.press("Tab");
  await apiPage.keyboard.press("Escape");
  await expect(apiPage.locator("#projectLightbox")).not.toHaveClass(/is-open/);
  await expect(gallery).toBeFocused();
  expect(apiErrors).toEqual([]);
  expect(apiFives).toEqual([]);
  await apiContext.close();

  const fallbackContext = await browser.newContext();
  const fallbackPage = await fallbackContext.newPage();
  const fallbackErrors: string[] = [];
  fallbackPage.on("console", (message) => { if (message.type() === "error") fallbackErrors.push(message.text()); });
  await fallbackPage.route("http://127.0.0.1:3001/api/v1/projects?locale=*", (route) => route.abort("failed"));
  await fallbackPage.goto(publicUrl);
  await expect.poll(() => fallbackPage.locator("html").getAttribute("data-projects-source")).toBe("fallback");
  await expect(fallbackPage.locator(".project-card")).toHaveCount(3);
  await fallbackPage.locator(".language-switcher").getByRole("button", { name: "RU", exact: true }).click();
  await expect.poll(() => fallbackPage.locator("html").getAttribute("lang")).toBe("ru");
  await expect.poll(() => fallbackPage.locator("html").getAttribute("data-projects-source")).toBe("fallback");
  await fallbackPage.locator("[data-gallery]").first().click();
  await expect(fallbackPage.locator("#projectLightbox")).toHaveClass(/is-open/);
  expect(fallbackErrors.filter((message) => !message.includes("net::ERR_FAILED"))).toEqual([]);
  await fallbackContext.close();
});
