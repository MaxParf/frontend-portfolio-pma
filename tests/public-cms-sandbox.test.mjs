import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { validateProjectState } from "../project-core/project-validator.js";
import { createSandboxMediaRepository } from "../demo/cms/sandbox/media.js";

const root = resolve(new URL("..", import.meta.url).pathname);
const runtimeRoot = resolve(root, "demo/cms");
const forbiddenPaths = ["cms-lite/api.js", "cms-lite/storage/php-api.js", "cms-lite/login.js", "cms-lite/session.js", "cms-lite/runtime-config.js", "cms-lite/password-change.js", "cms-api", "desktop/portfolio-cms"];
const forbiddenLiterals = ["/cms-api", "https://www.maxpar.ru/cms-api", "Authorization", "portfolio-cms-lite-token"];

function importsFrom(file, visited = new Set()) {
  const absolute = resolve(file); if (visited.has(absolute)) return visited; visited.add(absolute);
  const source = readFileSync(absolute, "utf8");
  for (const match of source.matchAll(/(?:from\s+|import\s*\()\s*["']([^"']+)["']/g)) {
    if (!match[1].startsWith(".")) continue;
    const target = resolve(dirname(absolute), match[1]);
    importsFrom(existsSync(target) ? target : `${target}.js`, visited);
  }
  return visited;
}

test("demo fixture is public-only, valid, immutable release input", () => {
  const fixture = JSON.parse(readFileSync(new URL("../demo/cms/fixture/projects.fixture.json", import.meta.url), "utf8"));
  const manifest = JSON.parse(readFileSync(new URL("../demo/cms/fixture/manifest.json", import.meta.url), "utf8"));
  assert.equal(validateProjectState(fixture).valid, true);
  assert.equal(fixture.projects.every((project) => project.status === "published"), true);
  assert.match(manifest.fixtureVersion, /^git-[0-9a-f]+-[0-9a-f]{12}$/);
  for (const media of fixture.projects.flatMap((project) => [...project.gallery.desktop, ...project.gallery.mobile])) assert.equal(existsSync(resolve(root, media.src)), true, media.src);
});

test("demo runtime graph is production-API free", () => {
  const files = [...importsFrom(resolve(runtimeRoot, "demo-entry.js"))];
  const relative = files.map((file) => file.slice(root.length + 1));
  for (const forbidden of forbiddenPaths) assert.equal(relative.some((file) => file.includes(forbidden)), false, forbidden);
  for (const file of files) { const source = readFileSync(file, "utf8"); for (const literal of forbiddenLiterals) assert.equal(source.includes(literal), false, `${file}: ${literal}`); }
});

test("demo entry has no login gate and uses only explicit static GET fixture requests", () => {
  const source = readFileSync(new URL("../demo/cms/demo-entry.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /sessionStorage|login|token|fetch\s*\([^,]+,\s*\{\s*method:\s*["'](?:POST|PUT|PATCH|DELETE)/i);
  assert.match(source, /fetch\("\.\/fixture\/projects\.fixture\.json", \{ method: "GET"/);
  assert.match(source, /fetch\("\.\/fixture\/manifest\.json", \{ method: "GET"/);
});

test("Reset visibility is persisted-state based and always confirmed", () => {
  const source = readFileSync(new URL("../demo/cms/demo-entry.js", import.meta.url), "utf8");
  assert.match(source, /equivalent\(persisted, fixture\) \? "" :/);
  assert.match(source, /data-reset-dialog/);
  assert.match(source, /data-confirm-reset/);
  assert.match(source, /await storage\.reset\(\)/);
});

test("Demo Reset is visually prominent and fixture media is packaged at the Demo entrypoint", async () => {
  const css = readFileSync(new URL("../demo/cms/demo.css", import.meta.url), "utf8");
  const fixture = JSON.parse(readFileSync(new URL("../demo/cms/fixture/projects.fixture.json", import.meta.url), "utf8"));
  assert.match(css, /button\[data-reset-demo\]\.cms-reset-demo \{[^}]*background:\s*#ff5722/i);
  assert.match(css, /button\[data-reset-demo\]\.cms-reset-demo \{[^}]*color:\s*#fff/i);
  assert.match(css, /button\[data-reset-demo\]\.cms-reset-demo:hover \{[^}]*color:\s*#fff/i);
  assert.match(css, /button\[data-reset-demo\]\.cms-reset-demo:focus-visible \{[^}]*color:\s*#fff/i);
  const output = "/tmp/public-cms-sandbox-test-build";
  const { execFileSync } = await import("node:child_process");
  execFileSync(process.execPath, ["scripts/build-public-cms-demo.mjs", output], { cwd: root });
  for (const src of fixture.projects.flatMap((project) => [...project.gallery.desktop, ...project.gallery.mobile]).map((item) => item.src)) assert.equal(existsSync(resolve(output, src)), true, src);
});

test("a newly saved Demo image resolves through a Blob URL before reload", async () => {
  const records = new Map();
  const request = (result) => { const value = { result }; queueMicrotask(() => value.onsuccess?.()); return value; };
  const db = {
    transaction() {
      return { objectStore: () => ({
        getAll: () => request([...records.values()]),
        put: (value, key) => { records.set(key, value); return request(undefined); },
      }) };
    },
  };
  const created = [];
  const media = createSandboxMediaRepository(db, { staticMediaBaseUrl: "https://demo.example/demo/cms/" });
  assert.equal(media.resolve("images/projects/static.webp"), "https://demo.example/demo/cms/images/projects/static.webp");
  const originalUrl = globalThis.URL;
  globalThis.URL = class extends originalUrl { static createObjectURL() { const url = `blob:demo-${created.length}`; created.push(url); return url; } static revokeObjectURL() {} };
  try {
    await media.put("saved-image", new Blob(["image"], { type: "image/webp" }));
    assert.equal(media.resolve("images/demo/saved-image"), "blob:demo-0");
  } finally {
    media.dispose();
    globalThis.URL = originalUrl;
  }
});
