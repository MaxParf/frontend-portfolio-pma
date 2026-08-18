import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DEMO_FIXTURE_VERSION, resolveStaticMediaUrl } from "../demo/cms/sandbox/contract.js";
import { loadSavedDemoSandbox } from "../demo/cms/sandbox/read-state.js";
import { resetDemoSandbox } from "../demo/cms/sandbox/reset-state.js";

const fixture = JSON.parse(readFileSync(new URL("../demo/cms/fixture/projects.fixture.json", import.meta.url), "utf8"));
const manifest = JSON.parse(readFileSync(new URL("../demo/cms/fixture/manifest.json", import.meta.url), "utf8"));

function request(value) {
  const result = { result: value };
  queueMicrotask(() => result.onsuccess?.());
  return result;
}

function fakeIndexedDB(records, version = 1) {
  const stores = new Map(Object.entries(records));
  const db = {
    close() {},
    transaction(names, mode) {
      const transaction = {
        error: null,
        objectStore(name) {
          const store = stores.get(name) ?? new Map();
          stores.set(name, store);
          return {
            get: (key) => request(store.get(key)),
            getAll: () => request([...store.values()]),
            clear: () => { store.clear(); },
          };
        },
      };
      if (mode === "readwrite") queueMicrotask(() => transaction.oncomplete?.());
      return transaction;
    },
  };
  return {
    databases: async () => [{ name: "portfolio-public-demo-cms", version }],
    open: () => request(db),
    stores,
  };
}

function savedRecords(state = fixture, media = []) {
  return {
    metadata: new Map([["fixtureVersion", DEMO_FIXTURE_VERSION]]),
    state: new Map([["saved", state]]),
    media: new Map(media.map((record) => [record.id, record])),
  };
}

test("fixture compatibility constant matches the immutable Demo manifest", () => {
  assert.equal(DEMO_FIXTURE_VERSION, manifest.fixtureVersion);
});

test("read-only loader returns no override for absent or incompatible Demo storage", async () => {
  assert.equal(await loadSavedDemoSandbox({ indexedDBImpl: { databases: async () => [] } }), null);
  assert.equal(await loadSavedDemoSandbox({ indexedDBImpl: fakeIndexedDB(savedRecords(), 2) }), null);
  const incompatible = fakeIndexedDB(savedRecords());
  incompatible.stores.get("metadata").set("fixtureVersion", "old-fixture");
  assert.equal(await loadSavedDemoSandbox({ indexedDBImpl: incompatible }), null);
});

test("saved Demo state preserves public status/order and resolves static and local media for the public entrypoint", async () => {
  const state = structuredClone(fixture);
  state.projects[0].order = 9;
  state.projects[1].order = 1;
  state.projects[2].status = "draft";
  state.projects[1].gallery.desktop[0].src = "images/demo/replaced-image";
  const indexedDBImpl = fakeIndexedDB(savedRecords(state, [{ id: "sandbox:replaced-image", blob: new Blob(["demo"], { type: "image/webp" }) }]));
  const created = [];
  const revoked = [];
  const result = await loadSavedDemoSandbox({
    indexedDBImpl,
    urlApi: { createObjectURL: () => { const url = "blob:demo-image"; created.push(url); return url; }, revokeObjectURL: (url) => revoked.push(url) },
    staticMediaBaseUrl: "https://public.example/",
  });
  assert.equal(result.source, "demo-indexeddb");
  assert.deepEqual(result.projects.map((project) => project.id), ["project-bradbury", "construction-management-control-center"]);
  assert.equal(result.projects[0].gallery.desktop[0].src, "blob:demo-image");
  assert.equal(result.projects[1].gallery.desktop[0].src, "https://public.example/images/projects/cus/cus-dashboard.png");
  assert.equal(state.projects[1].gallery.desktop[0].src, "images/demo/replaced-image");
  assert.deepEqual(created, ["blob:demo-image"]);
  result.dispose();
  assert.deepEqual(revoked, ["blob:demo-image"]);
});

test("missing local Demo Blob omits only that media item and keeps the saved public state", async () => {
  const state = structuredClone(fixture);
  state.projects[1].gallery.desktop[0].src = "images/demo/missing";
  const result = await loadSavedDemoSandbox({ indexedDBImpl: fakeIndexedDB(savedRecords(state)), staticMediaBaseUrl: "https://public.example/" });
  assert.equal(result.source, "demo-indexeddb");
  assert.equal(result.projects[1].gallery.desktop.some((item) => item.src.includes("images/demo/missing")), false);
  assert.equal(result.projects[1].gallery.desktop.length, fixture.projects[1].gallery.desktop.length - 1);
});

test("Demo-only reset clears only the existing Demo-owned stores", async () => {
  const indexedDBImpl = fakeIndexedDB(savedRecords(fixture, [{ id: "sandbox:image", blob: new Blob(["demo"]) }]));
  const db = await new Promise((resolve) => { const request = indexedDBImpl.open(); request.onsuccess = () => resolve(request.result); });
  const media = { disposed: false, dispose() { this.disposed = true; } };
  await resetDemoSandbox({ db, media });
  assert.equal(media.disposed, true);
  for (const store of indexedDBImpl.stores.values()) assert.equal(store.size, 0);
});

test("public Demo modules have no API, authorization, reset, or mutation-network dependency", () => {
  for (const file of ["../services/projects-source.js", "../demo/cms/sandbox/read-state.js", "../script.js"]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(source, /cms-api|Authorization|resetDemoSandbox|readwrite|fetch\s*\([^)]*(?:POST|PUT|PATCH|DELETE)/i, file);
  }
});

test("public UI has no Demo controls and canonical static media is entrypoint-relative only in presentation", () => {
  const source = readFileSync(new URL("../script.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /demo-mode-banner|Back to CMS|Вернуться в CMS|Reset Demo/);
  assert.equal(resolveStaticMediaUrl("images/projects/cus/cus-dashboard.png", "https://public.example/"), "https://public.example/images/projects/cus/cus-dashboard.png");
  assert.equal(resolveStaticMediaUrl("images/projects/cus/cus-dashboard.png", "https://public.example/demo/cms/"), "https://public.example/demo/cms/images/projects/cus/cus-dashboard.png");
});
