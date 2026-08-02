import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadEnv } from "../src/config/env.js";

async function readTemplate(): Promise<Record<string, string>> {
  const lines = (await readFile(new URL("../.env.example", import.meta.url), "utf8")).split("\n");
  return Object.fromEntries(lines.flatMap((line) => {
    const index = line.indexOf("=");
    return index > 0 && !line.startsWith("#") ? [[line.slice(0, index), line.slice(index + 1)]] : [];
  }));
}

test("local environment template permits the documented public portfolio origin", async () => {
  const template = await readTemplate();
  const env = loadEnv({ ...template, SESSION_TOKEN_SECRET: "a".repeat(32) });
  assert.ok(env.CORS_ORIGINS.includes("http://127.0.0.1:5500"));
});
