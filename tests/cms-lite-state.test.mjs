import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createEditorState, createMemoryStorage } from "../cms-lite/editor/state.js";
import { createMediaPreviewStore } from "../cms-lite/editor/media-previews.js";

const fixture = JSON.parse(readFileSync(new URL("../data/projects.lite.json", import.meta.url), "utf8"));
const clone = (value) => structuredClone(value);

test("memory storage loads and saves canonical state without a network adapter", async () => {
  const storage = createMemoryStorage(fixture);
  const loaded = await storage.load();
  loaded.version = 2;
  const saved = await storage.save(loaded);
  assert.equal(saved.version, 2);
  assert.notEqual(saved, loaded);
});

test("editor dirty state follows normalized state, new/delete remain local until save", async () => {
  const editor = createEditorState({ initialState: fixture, storage: createMemoryStorage(fixture) });
  assert.equal((await editor.load()).dirty, false);
  let state = editor.update((next) => { next.projects[0].title.ru = "Изменено"; });
  assert.equal(state.dirty, true);
  state = editor.createProject("new-project");
  assert.equal(state.workingState.projects.find((project) => project.id === "new-project").status, "draft");
  state = editor.deleteProject("new-project");
  assert.equal(state.serverState.projects.some((project) => project.id === "new-project"), false);
  assert.equal(state.workingState.projects.some((project) => project.id === "new-project"), false);
  const saved = await editor.save();
  assert.equal(saved.saved, true);
  assert.equal(saved.snapshot.dirty, false);
});

test("Save All blocks incomplete published content while incomplete drafts remain valid", async () => {
  const editor = createEditorState({ initialState: fixture, storage: createMemoryStorage(fixture) });
  await editor.load();
  editor.update((next) => { next.projects[0].title.en = ""; });
  const invalid = await editor.save();
  assert.equal(invalid.saved, false);
  editor.createProject("empty-draft");
  editor.select("empty-draft");
  const draft = editor.snapshot().workingState.projects.find((project) => project.id === "empty-draft");
  assert.equal(draft.status, "draft");
});

test("media preview lifecycle revokes owned URLs and preserves stable media id on replacement", () => {
  const revoked = []; let counter = 0;
  const previews = createMediaPreviewStore({ createObjectURL: () => `blob:test-${++counter}`, revokeObjectURL: (url) => revoked.push(url) });
  assert.equal(previews.replace("desktop-home", { name: "first" }), "blob:test-1");
  assert.equal(previews.replace("desktop-home", { name: "second" }), "blob:test-2");
  assert.deepEqual(revoked, ["blob:test-1"]);
  assert.equal(previews.get("desktop-home").objectUrl, "blob:test-2");
  previews.remove("desktop-home");
  assert.deepEqual(revoked, ["blob:test-1", "blob:test-2"]);
});

test("Lite CMS is token-gated and uses the isolated PHP storage adapter", () => {
  const login = readFileSync(new URL("../cms-lite/login.js", import.meta.url), "utf8");
  const cms = readFileSync(new URL("../cms-lite/cms.js", import.meta.url), "utf8");
  assert.match(login, /sessionStorage\.setItem/);
  assert.match(cms, /sessionStorage\.getItem/);
  assert.match(cms, /createPhpStorage/);
  assert.match(login, /loginRequest/);
  for (const source of [login, cms]) assert.doesNotMatch(source, /api\/v1|backend\//);
});
