import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const testPassword = process.env.TEST_ADMIN_PASSWORD;
if (!testPassword) throw new Error("TEST_ADMIN_PASSWORD is required for isolated E2E.");

function run(command, args, env) {
  return spawn(command, args, { cwd: process.cwd(), env, stdio: "inherit" });
}

async function waitFor(url) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

const shared = { ...process.env, TEST_ADMIN_PASSWORD: testPassword, TEST_ADMIN_LOGIN: process.env.TEST_ADMIN_LOGIN ?? "@test-owner.local" };
const api = run("npm", ["--prefix", "../backend", "run", "test:e2e:server"], shared);
const cms = run("npx", ["vite", "--host", "127.0.0.1", "--port", "5511"], { ...shared, VITE_API_BASE_URL: "http://127.0.0.1:3002" });

try {
  await waitFor("http://127.0.0.1:3002/health");
  await waitFor("http://127.0.0.1:5511/login");
  const tests = run("npx", ["playwright", "test", "--config", "playwright.isolated.config.ts"], { ...shared, CMS_TEST_LOGIN: shared.TEST_ADMIN_LOGIN, CMS_TEST_PASSWORD: testPassword, E2E_API_BASE_URL: "http://127.0.0.1:3002" });
  const code = await new Promise((resolve) => tests.once("exit", (status) => resolve(status ?? 1)));
  process.exitCode = code;
} finally {
  api.kill("SIGTERM");
  cms.kill("SIGTERM");
  await rm(resolve("../backend/storage/project-media-e2e-test"), { recursive: true, force: true });
  await rm(resolve("./test-results"), { recursive: true, force: true });
}
