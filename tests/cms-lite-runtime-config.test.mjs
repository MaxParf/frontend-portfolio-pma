import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createCmsLiteServer, resolveCmsLiteRoute } from "../cms-lite/dev-server.mjs";

const runtimeConfig = readFileSync(new URL("../cms-lite/runtime-config.js", import.meta.url), "utf8");
const cmsHtml = readFileSync(new URL("../cms-lite/index.html", import.meta.url), "utf8");
const loginHtml = readFileSync(new URL("../cms-lite/login/index.html", import.meta.url), "utf8");
const apiSource = readFileSync(new URL("../cms-lite/api.js", import.meta.url), "utf8");

test("CMS Lite runtime config exposes only the production API base URL", () => {
  assert.match(runtimeConfig, /globalThis\.__CMS_LITE_CONFIG__\s*=\s*Object\.freeze\(/);
  assert.match(runtimeConfig, /apiBaseUrl:\s*"https:\/\/www\.maxpar\.ru\/cms-api"/);
  assert.doesNotMatch(runtimeConfig, /password|token|username|authorization|private|secret/i);
});

test("CMS Lite entrypoints load runtime config before API consumers", () => {
  for (const [html, consumer] of [[cmsHtml, "/cms.js"], [loginHtml, "/login.js"]]) {
    const configIndex = html.indexOf('src="/runtime-config.js"');
    const consumerIndex = html.indexOf(`src="${consumer}"`);
    assert.notEqual(configIndex, -1, "runtime config script is present");
    assert.notEqual(consumerIndex, -1, `${consumer} script is present`);
    assert.ok(configIndex < consumerIndex, `runtime config precedes ${consumer}`);
  }
});

test("CMS Lite retains the local PHP fallback and serves runtime config", async () => {
  assert.match(apiSource, /\?\.apiBaseUrl\s*\?\?\s*"http:\/\/127\.0\.0\.1:5520\/cms-api"/);
  assert.notEqual(resolveCmsLiteRoute("/runtime-config.js"), null);
  const server = createCmsLiteServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/runtime-config.js`);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), runtimeConfig);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
