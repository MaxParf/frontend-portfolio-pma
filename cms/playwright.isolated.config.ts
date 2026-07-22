import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["draft-workflow.spec.ts", "media-workflow.spec.ts"],
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  use: { baseURL: "http://127.0.0.1:5511", channel: "chrome", screenshot: "only-on-failure", trace: "retain-on-failure", video: "off" },
  reporter: "list",
});
