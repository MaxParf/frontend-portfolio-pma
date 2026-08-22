import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderProjects } from "../components/project-renderer.js";
import { resolveStaticMediaUrl } from "../demo/cms/sandbox/contract.js";
import { createSandboxMediaRepository } from "../demo/cms/sandbox/media.js";
import { loadSavedDemoSandbox } from "../demo/cms/sandbox/read-state.js";
import { resetDemoSandbox } from "../demo/cms/sandbox/reset-state.js";
import { createSandboxStorage } from "../demo/cms/sandbox/storage.js";
import { loadProjectState } from "../services/projects-source.js";

const fixture = JSON.parse(readFileSync(new URL("../demo/cms/fixture/projects.fixture.json", import.meta.url), "utf8"));
const manifest = JSON.parse(readFileSync(new URL("../demo/cms/fixture/manifest.json", import.meta.url), "utf8"));
const fixtureVersion = manifest.fixtureVersion;

class FakeNode {
  constructor(tagName = "#fragment") { this.tagName = tagName; this.children = []; this.attributes = new Map(); this.dataset = {}; this.className = ""; this.textContent = ""; this.isFragment = tagName === "#fragment"; }
  append(...children) { children.forEach((child) => { if (child.isFragment) this.children.push(...child.children); else this.children.push(child); }); }
  replaceChildren(...children) { this.children = []; this.append(...children); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
}

function descendants(node, predicate, result = []) { node.children.forEach((child) => { if (predicate(child)) result.push(child); descendants(child, predicate, result); }); return result; }

async function withFakeDocument(action) {
  const original = globalThis.document;
  globalThis.document = { createElement: (tagName) => new FakeNode(tagName), createDocumentFragment: () => new FakeNode() };
  try { return await action(); } finally { globalThis.document = original; }
}

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
            put: (value, key) => { store.set(key, value); return request(undefined); },
            delete: (key) => { store.delete(key); return request(undefined); },
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
    metadata: new Map([["fixtureVersion", fixtureVersion]]),
    state: new Map([["saved", state]]),
    media: new Map(media.map((record) => [record.id, record])),
  };
}

test("fixture test helpers derive the installed immutable Demo manifest identity", () => {
  assert.match(fixtureVersion, /^git-[0-9a-f]+-[0-9a-f]{12}$/);
});

test("read-only loader returns no override for absent or incompatible Demo storage", async () => {
  assert.equal(await loadSavedDemoSandbox({ fixtureVersion, indexedDBImpl: { databases: async () => [] } }), null);
  assert.equal(await loadSavedDemoSandbox({ fixtureVersion, indexedDBImpl: fakeIndexedDB(savedRecords(), 2) }), null);
  const incompatible = fakeIndexedDB(savedRecords());
  incompatible.stores.get("metadata").set("fixtureVersion", "old-fixture");
  assert.equal(await loadSavedDemoSandbox({ fixtureVersion, indexedDBImpl: incompatible }), null);
});

test("public source selects a saved Demo state using the installed Demo manifest identity", async () => {
  const installedFixtureVersion = "git-ceb3e6b32748709c9aa0df67292bae37a76cedd5-81cd7429e6c5";
  const state = structuredClone(fixture);
  state.projects[2].gallery.mobile[0].src = "images/demo/74f517e4-8b06-40fb-b50a-daf1404bb8f6";
  const indexedDBImpl = fakeIndexedDB(savedRecords(state, [{ id: "sandbox:74f517e4-8b06-40fb-b50a-daf1404bb8f6", blob: new Blob(["production image"], { type: "image/webp" }) }]));
  indexedDBImpl.stores.get("metadata").set("fixtureVersion", installedFixtureVersion);
  const result = await loadProjectState({
    demoFixtureVersionLoader: async () => installedFixtureVersion,
    demoStateLoader: (options) => loadSavedDemoSandbox({ ...options, indexedDBImpl, urlApi: { createObjectURL: () => "blob:https://www.maxpar.ru/production-image", revokeObjectURL() {} }, staticMediaBaseUrl: "https://www.maxpar.ru/" }),
    fetchImpl: async () => { throw new Error("static production projection must not be selected"); },
  });
  assert.equal(result.source, "demo-indexeddb");
  assert.equal(result.projects.find((project) => project.id === "foodai").gallery.mobile[0].src, "blob:https://www.maxpar.ru/production-image");
  result.dispose();
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
    fixtureVersion,
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
  const result = await loadSavedDemoSandbox({ fixtureVersion, indexedDBImpl: fakeIndexedDB(savedRecords(state)), staticMediaBaseUrl: "https://public.example/" });
  assert.equal(result.source, "demo-indexeddb");
  assert.equal(result.projects[1].gallery.desktop.some((item) => item.src.includes("images/demo/missing")), false);
  assert.equal(result.projects[1].gallery.desktop.length, fixture.projects[1].gallery.desktop.length - 1);
});

async function saveThenReadFromIndependentPublicContext({ pendingMedia }) {
  const indexedDBImpl = fakeIndexedDB(savedRecords());
  const dbA = await new Promise((resolve) => { const request = indexedDBImpl.open(); request.onsuccess = () => resolve(request.result); });
  const mediaA = createSandboxMediaRepository(dbA);
  const storage = createSandboxStorage({ db: dbA, fixture, fixtureVersion, media: mediaA });
  const saved = await storage.save(structuredClone(fixture), pendingMedia);
  mediaA.dispose();

  const canonicalMedia = saved.projects.flatMap((project) => [...project.gallery.desktop, ...project.gallery.mobile]).filter((item) => item.src.startsWith("images/demo/"));
  const mediaStore = indexedDBImpl.stores.get("media");
  const dbB = await new Promise((resolve) => { const request = indexedDBImpl.open(); request.onsuccess = () => resolve(request.result); });
  const mediaB = createSandboxMediaRepository(dbB);
  await mediaB.hydrate();
  const cmsUrls = canonicalMedia.map((media) => mediaB.resolve(media.src));
  mediaB.dispose();
  const urls = [];
  const publicResult = await loadSavedDemoSandbox({
    fixtureVersion,
    indexedDBImpl,
    urlApi: { createObjectURL: (blob) => { assert.ok(blob instanceof Blob); const url = `blob:https://www.maxpar.ru/public-${urls.length}`; urls.push(url); return url; }, revokeObjectURL() {} },
    staticMediaBaseUrl: "https://www.maxpar.ru/",
  });
  return { canonicalMedia, mediaStore, publicResult, urls, cmsUrls };
}

test("an independent public context reconstructs newly saved Demo media from IndexedDB", async () => {
  const blob = new Blob(["new Demo image"], { type: "image/webp" });
  const { canonicalMedia, mediaStore, publicResult, urls, cmsUrls } = await saveThenReadFromIndependentPublicContext({
    pendingMedia: [{ id: "pending-new", projectId: fixture.projects[0].id, galleryKind: "desktop", file: blob, replacesCanonical: false, alt: fixture.projects[0].title, ariaLabel: fixture.projects[0].title, presentation: "cover" }],
  });
  assert.equal(canonicalMedia.length, 1);
  const canonical = canonicalMedia[0];
  assert.match(canonical.src, /^images\/demo\/[0-9a-f-]{36}$/);
  assert.equal(canonical.src.includes("blob:"), false);
  assert.equal(canonical.src.includes("base64"), false);
  const id = canonical.src.slice("images/demo/".length);
  const record = mediaStore.get(`sandbox:${id}`);
  assert.equal(record.id, `sandbox:${id}`);
  assert.ok(record.blob instanceof Blob);
  assert.equal(record.blob.size, blob.size);
  assert.equal(record.blob.type, "image/webp");
  assert.match(cmsUrls[0], /^blob:/);
  assert.equal(publicResult.source, "demo-indexeddb");
  const publicMedia = publicResult.projects.find((project) => project.id === fixture.projects[0].id).gallery.desktop.at(-1);
  assert.equal(publicMedia.id, canonical.id);
  assert.match(publicMedia.src, /^blob:https:\/\/www\.maxpar\.ru\/public-0$/);
  assert.deepEqual(urls, [publicMedia.src]);
  publicResult.dispose();
});

test("FoodAI mobile gallery media crosses the normal public source and renderer pipeline", async () => {
  const foodai = fixture.projects.find((project) => project.id === "foodai");
  const { publicResult } = await saveThenReadFromIndependentPublicContext({
    pendingMedia: [{ id: "pending-foodai-mobile", projectId: foodai.id, galleryKind: "mobile", file: new Blob(["FoodAI"], { type: "image/webp" }), replacesCanonical: false, alt: foodai.title, ariaLabel: foodai.title, presentation: "contain" }],
  });
  const source = await loadProjectState({ demoFixtureVersionLoader: async () => fixtureVersion, demoStateLoader: async ({ fixtureVersion: loadedFixtureVersion }) => { assert.equal(loadedFixtureVersion, fixtureVersion); return publicResult; }, fetchImpl: async () => { throw new Error("sandbox state must be authoritative"); } });
  const resolvedFoodai = source.projects.find((project) => project.id === "foodai");
  const added = resolvedFoodai.gallery.mobile.at(-1);
  assert.match(added.src, /^blob:https:\/\/www\.maxpar\.ru\/public-/);
  await withFakeDocument(async () => {
    const root = new FakeNode("div");
    const rendered = renderProjects({ root, projects: source.projects, locale: "en" });
    assert.ok(rendered.some((project) => project.id === "foodai"));
    assert.ok(descendants(root, (node) => node.tagName === "img" && node.src === added.src));
  });
  publicResult.dispose();
});

test("independent public readers preserve replacement and fifth/sixth Demo images without a count limit", async () => {
  const project = fixture.projects[0];
  const replacement = project.gallery.desktop[0];
  const blobs = ["replacement", "fifth", "sixth"].map((value) => new Blob([value], { type: "image/webp" }));
  const { canonicalMedia, mediaStore, publicResult } = await saveThenReadFromIndependentPublicContext({
    pendingMedia: [
      { id: replacement.id, projectId: project.id, galleryKind: "desktop", file: blobs[0], replacesCanonical: true, alt: replacement.alt, ariaLabel: replacement.ariaLabel, presentation: replacement.presentation },
      { id: "pending-fifth", projectId: project.id, galleryKind: "desktop", file: blobs[1], replacesCanonical: false, alt: project.title, ariaLabel: project.title, presentation: "cover" },
      { id: "pending-sixth", projectId: project.id, galleryKind: "desktop", file: blobs[2], replacesCanonical: false, alt: project.title, ariaLabel: project.title, presentation: "cover" },
    ],
  });
  assert.equal(canonicalMedia.length, 3);
  for (const media of canonicalMedia) {
    const id = media.src.slice("images/demo/".length);
    assert.ok(mediaStore.get(`sandbox:${id}`)?.blob instanceof Blob);
  }
  const publicProject = publicResult.projects.find((candidate) => candidate.id === project.id);
  assert.equal(publicProject.gallery.desktop.length, project.gallery.desktop.length + 2);
  assert.equal(publicProject.gallery.desktop[0].src.startsWith("blob:"), true);
  assert.equal(publicProject.gallery.desktop.slice(-2).every((media) => media.src.startsWith("blob:")), true);
  publicResult.dispose();
});

test("saving a deleted Demo image prunes only its matching persisted Blob", async () => {
  const indexedDBImpl = fakeIndexedDB(savedRecords());
  const db = await new Promise((resolve) => { const request = indexedDBImpl.open(); request.onsuccess = () => resolve(request.result); });
  const media = createSandboxMediaRepository(db);
  const storage = createSandboxStorage({ db, fixture, fixtureVersion, media });
  const saved = await storage.save(structuredClone(fixture), [{ id: "pending-delete", projectId: fixture.projects[0].id, galleryKind: "desktop", file: new Blob(["delete"], { type: "image/webp" }), replacesCanonical: false, alt: fixture.projects[0].title, ariaLabel: fixture.projects[0].title, presentation: "cover" }]);
  const added = saved.projects.find((project) => project.id === fixture.projects[0].id).gallery.desktop.at(-1);
  const id = added.src.slice("images/demo/".length);
  const withoutAdded = structuredClone(saved);
  withoutAdded.projects.find((project) => project.id === fixture.projects[0].id).gallery.desktop.pop();
  await storage.save(withoutAdded, []);
  assert.equal(indexedDBImpl.stores.get("media").has(`sandbox:${id}`), false);
  media.dispose();
});

test("Demo reset removes the saved override and media but preserves fixture metadata", async () => {
  const indexedDBImpl = fakeIndexedDB(savedRecords(fixture, [{ id: "sandbox:image", blob: new Blob(["demo"]) }]));
  const db = await new Promise((resolve) => { const request = indexedDBImpl.open(); request.onsuccess = () => resolve(request.result); });
  const media = { disposed: false, dispose() { this.disposed = true; } };
  await resetDemoSandbox({ db, media });
  assert.equal(media.disposed, true);
  assert.equal(indexedDBImpl.stores.get("state").size, 0);
  assert.equal(indexedDBImpl.stores.get("media").size, 0);
  assert.deepEqual([...indexedDBImpl.stores.get("metadata").entries()], [["fixtureVersion", fixtureVersion]]);
  await resetDemoSandbox({ db, media });
  assert.equal(indexedDBImpl.stores.get("state").size, 0);
  assert.equal(indexedDBImpl.stores.get("media").size, 0);
});

test("reset discards every saved Demo scenario and returns a fresh public reader to static JSON", async () => {
  const replacement = fixture.projects[0].gallery.desktop[0];
  const scenarios = [
    { name: "text", mutate: (state) => { state.projects[0].title.en = "Changed title"; }, pending: [] },
    { name: "created project", mutate: (state) => { const project = structuredClone(state.projects[0]); project.id = "created-project"; project.order = 99; state.projects.push(project); }, pending: [] },
    { name: "deleted project", mutate: (state) => { state.projects = state.projects.filter((project) => project.id !== fixture.projects[1].id); }, pending: [] },
    { name: "replacement", mutate: () => {}, pending: [{ id: replacement.id, projectId: fixture.projects[0].id, galleryKind: "desktop", file: new Blob(["replacement"], { type: "image/webp" }), replacesCanonical: true, alt: replacement.alt, ariaLabel: replacement.ariaLabel, presentation: replacement.presentation }] },
    { name: "multiple images", mutate: () => {}, pending: ["one", "two"].map((id) => ({ id, projectId: fixture.projects[0].id, galleryKind: "desktop", file: new Blob([id], { type: "image/webp" }), replacesCanonical: false, alt: fixture.projects[0].title, ariaLabel: fixture.projects[0].title, presentation: "cover" })) },
  ];
  for (const scenario of scenarios) {
    const indexedDBImpl = fakeIndexedDB({ state: new Map(), media: new Map(), metadata: new Map([["fixtureVersion", fixtureVersion]]) });
    const db = await new Promise((resolve) => { const request = indexedDBImpl.open(); request.onsuccess = () => resolve(request.result); });
    const media = createSandboxMediaRepository(db);
    const storage = createSandboxStorage({ db, fixture, fixtureVersion, media });
    const modified = structuredClone(fixture); scenario.mutate(modified);
    await storage.save(modified, scenario.pending);
    assert.equal(indexedDBImpl.stores.get("state").has("saved"), true, scenario.name);
    const beforeReset = await loadSavedDemoSandbox({ fixtureVersion, indexedDBImpl });
    assert.equal(beforeReset.source, "demo-indexeddb", scenario.name);
    beforeReset.dispose();
    await storage.reset();
    assert.equal(indexedDBImpl.stores.get("state").has("saved"), false, scenario.name);
    assert.equal(indexedDBImpl.stores.get("media").size, 0, scenario.name);
    assert.equal(indexedDBImpl.stores.get("metadata").get("fixtureVersion"), fixtureVersion, scenario.name);
    assert.deepEqual(await storage.load(), fixture, scenario.name);
    assert.equal(await loadSavedDemoSandbox({ fixtureVersion, indexedDBImpl }), null, scenario.name);
    const source = await loadProjectState({ demoFixtureVersionLoader: async () => fixtureVersion, demoStateLoader: (options) => loadSavedDemoSandbox({ ...options, indexedDBImpl }), fetchImpl: async () => ({ ok: true, status: 200, json: async () => fixture }) });
    assert.equal(source.source, "static-json", scenario.name);
    media.dispose();
  }
});

test("a failed reset transaction does not report a pristine editor state", async () => {
  const transaction = { error: new Error("reset failed"), objectStore: () => ({ delete() {}, clear() {} }) };
  const db = { transaction: () => { queueMicrotask(() => transaction.onabort?.()); return transaction; } };
  const media = { disposed: false, dispose() { this.disposed = true; } };
  await assert.rejects(resetDemoSandbox({ db, media }), /reset failed/);
  assert.equal(media.disposed, false);
});

test("cancelling Reset Demo does not reach the persistence reset action", () => {
  const source = readFileSync(new URL("../demo/cms/demo-entry.js", import.meta.url), "utf8");
  const cancelBranch = source.match(/if \(action\.cancelReset[^\n]+/);
  assert.ok(cancelBranch);
  assert.match(cancelBranch[0], /\.close\(\).*return true/);
  assert.doesNotMatch(cancelBranch[0], /storage\.reset/);
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
