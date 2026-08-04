import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createEditorState, createMemoryStorage } from "../cms-lite/editor/state.js";

const fixture = JSON.parse(readFileSync(new URL("../data/projects.lite.json", import.meta.url), "utf8"));
const cmsSource = readFileSync(new URL("../cms-lite/cms.js", import.meta.url), "utf8");
const loginSource = readFileSync(new URL("../cms-lite/login.js", import.meta.url), "utf8");
const loginHtml = readFileSync(new URL("../cms-lite/login/index.html", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../cms-lite/cms.css", import.meta.url), "utf8");

test("ordinary input mutation remains continuous without a structural editor render", async () => {
  const editor = createEditorState({ initialState: fixture, storage: createMemoryStorage(fixture) });
  await editor.load();
  for (const value of ["П", "По", "Пол", "Полное предложение"]) editor.update((state) => { state.projects[0].title.ru = value; });
  assert.equal(editor.snapshot().workingState.projects[0].title.ru, "Полное предложение");
  const inputHandler = cmsSource.slice(cmsSource.indexOf('root.addEventListener("input"'), cmsSource.indexOf('root.addEventListener("change"'));
  assert.match(inputHandler, /refreshLiveUi\(\)/);
  assert.doesNotMatch(inputHandler, /render\(\)/);
});

test("paired Features and Notes add and remove RU/EN values together", async () => {
  const editor = createEditorState({ initialState: fixture, storage: createMemoryStorage(fixture) });
  await editor.load();
  const beforeFeatures = editor.snapshot().workingState.projects[0].features.ru.length;
  const beforeNotes = editor.snapshot().workingState.projects[0].notes.ru.length;
  editor.update((state) => { const project = state.projects[0]; project.features.ru.push(""); project.features.en.push(""); project.notes.ru.push(""); project.notes.en.push(""); });
  editor.update((state) => { const project = state.projects[0]; project.features.ru.splice(beforeFeatures, 1); project.features.en.splice(beforeFeatures, 1); project.notes.ru.splice(beforeNotes, 1); project.notes.en.splice(beforeNotes, 1); });
  const project = editor.snapshot().workingState.projects[0];
  assert.equal(project.features.ru.length, project.features.en.length);
  assert.equal(project.notes.ru.length, project.notes.en.length);
  assert.match(cmsSource, /data-remove-list="\$\{property\}:\$\{index\}"/);
});

test("pending media remains transient while canonical gallery editing remains stable", async () => {
  const editor = createEditorState({ initialState: fixture, storage: createMemoryStorage(fixture) });
  await editor.load();
  const existingId = editor.snapshot().workingState.projects[0].gallery.desktop[0].id;
  editor.setPendingMedia({ id: existingId, projectId: fixture.projects[0].id, galleryKind: "desktop", file: { name: "replacement.png" }, objectUrl: "blob:replacement", replacesCanonical: true, alt: { ru: "Замена", en: "Replacement" }, ariaLabel: { ru: "", en: "" }, presentation: "cover" });
  assert.equal(editor.snapshot().pendingMedia.get(existingId).file.name, "replacement.png");
  assert.equal(editor.snapshot().workingState.projects[0].gallery.desktop[0].src.startsWith("blob:"), false);
  editor.update((state) => { const project = state.projects[0]; project.gallery.desktop[0].presentation = "contain"; project.gallery.mobile.push({ id: "mobile-new", src: "", alt: { ru: "", en: "" }, ariaLabel: { ru: "", en: "" }, presentation: "contain" }); });
  let project = editor.snapshot().workingState.projects[0];
  assert.equal(project.gallery.desktop[0].id, existingId);
  assert.equal(project.gallery.desktop[0].presentation, "contain");
  assert.equal(project.gallery.mobile.at(-1).id, "mobile-new");
  editor.update((state) => { state.projects[0].gallery.mobile = state.projects[0].gallery.mobile.filter((media) => media.id !== "mobile-new"); });
  project = editor.snapshot().workingState.projects[0];
  assert.equal(project.gallery.mobile.some((media) => media.id === "mobile-new"), false);
});

test("login/header/status and editor scroll contracts match the corrective UX", () => {
  assert.match(loginHtml, /name="login"/);
  assert.match(loginHtml, /name="password"/);
  assert.match(loginHtml, /<button class="button button--primary" type="submit">Login<\/button>/);
  assert.doesNotMatch(loginHtml, /cms-login__eyebrow|Подключено|безопасност|debug/i);
  assert.doesNotMatch(loginSource, /memory-only|security claim|PHP will verify/i);
  assert.doesNotMatch(cmsSource, /Bearer Token/);
  assert.match(cmsSource, /CONNECTED: "Подключено: память"/);
  assert.match(cmsSource, /BUSY: "Сохранение в памяти"/);
  assert.match(cmsSource, /DISCONNECTED: "Хранилище недоступно"/);
  assert.match(cmsSource, /aria-label/);
  assert.match(cssSource, /\.cms-editor \{ min-height: 0; overflow-y: auto;/);
  assert.match(cmsSource, /const previousScrollTop = preserveScroll \? root\.querySelector\("\.cms-editor"\)\?\.scrollTop \?\? 0 : 0/);
  assert.match(cmsSource, /editorElement\.scrollTop = previousScrollTop/);
});

test("tag Add button creates a chip through the same operation as Enter", () => {
  assert.match(cmsSource, /<form data-tag-form>/);
  assert.match(cmsSource, /<button class="cms-add" type="submit">Добавить<\/button>/);
  assert.match(cmsSource, /function addTag\(value\)/);
  assert.match(cmsSource, /if \(tag\) selectedMutation\(\(project\) => \{ if \(!project\.techStack\.includes\(tag\)\) project\.techStack\.push\(tag\); \}\);/);
  assert.match(cmsSource, /root\.addEventListener\("submit"/);
  assert.match(cmsSource, /addTag\(String\(new FormData\(event\.target\)\.get\("tag"\) \?\? ""\)\)/);
});

test("Save All excludes pending object URLs while keeping local previews after save", async () => {
  const editor = createEditorState({ initialState: fixture, storage: createMemoryStorage(fixture) });
  await editor.load();
  const project = editor.snapshot().workingState.projects[0];
  const desktopReplacement = project.gallery.desktop[0];
  editor.setPendingMedia({ id: desktopReplacement.id, projectId: project.id, galleryKind: "desktop", file: { name: "replacement.webp" }, objectUrl: "blob:replace", replacesCanonical: true, alt: desktopReplacement.alt, ariaLabel: desktopReplacement.ariaLabel, presentation: desktopReplacement.presentation });
  editor.setPendingMedia({ id: "desktop-local", projectId: project.id, galleryKind: "desktop", file: { name: "desktop.webp" }, objectUrl: "blob:desktop", replacesCanonical: false, alt: { ru: "Локальный desktop", en: "Local desktop" }, ariaLabel: { ru: "", en: "" }, presentation: "cover" });
  editor.setPendingMedia({ id: "mobile-local", projectId: project.id, galleryKind: "mobile", file: { name: "mobile.webp" }, objectUrl: "blob:mobile", replacesCanonical: false, alt: { ru: "Локальный mobile", en: "Local mobile" }, ariaLabel: { ru: "", en: "" }, presentation: "contain" });

  const saved = await editor.save();
  assert.equal(saved.saved, true);
  assert.equal(saved.snapshot.dirty, false);
  assert.equal(saved.snapshot.pendingMedia.get(desktopReplacement.id).objectUrl, "blob:replace");
  assert.equal(saved.snapshot.pendingMedia.get("desktop-local").objectUrl, "blob:desktop");
  assert.equal(saved.snapshot.pendingMedia.get("mobile-local").objectUrl, "blob:mobile");
  const canonical = JSON.stringify(saved.snapshot.serverState);
  assert.doesNotMatch(canonical, /blob:|data:/);
  assert.equal(canonical.includes("desktop-local"), false);
  assert.equal(canonical.includes("mobile-local"), false);
  assert.equal(saved.snapshot.serverState.projects[0].gallery.desktop[0].src, desktopReplacement.src);
});

test("locally added media receives accessible project-title defaults", () => {
  assert.match(cmsSource, /const fallbackLabel = project\.title;/);
  assert.match(cmsSource, /ariaLabel: existing\?\.ariaLabel \?\? fallbackLabel/);
  const rendererSource = readFileSync(new URL("../components/project-renderer.js", import.meta.url), "utf8");
  assert.match(rendererSource, /localized\(media\.ariaLabel, locale, localized\(media\.alt, locale, project\.id\)\)/);
});

test("structural actions preserve editor scroll while project navigation may reset it", () => {
  const clickHandler = cmsSource.slice(cmsSource.indexOf('root.addEventListener("click"'), cmsSource.indexOf('root.addEventListener("submit"'));
  assert.match(clickHandler, /let preserveScroll = true/);
  assert.match(clickHandler, /target\.dataset\.select\) \{ snapshot = editor\.select\(target\.dataset\.select\); preserveScroll = false;/);
  assert.match(clickHandler, /target\.dataset\.newProject !== undefined\) \{ snapshot = editor\.createProject\(uniqueProjectId\(\)\); preserveScroll = false;/);
  assert.match(clickHandler, /target\.dataset\.delete\) \{ snapshot = editor\.deleteProject\(target\.dataset\.delete\); preserveScroll = false;/);
  for (const action of ["addList", "removeList", "addLink", "removeLink", "deleteMedia", "saveAll"]) assert.match(clickHandler, new RegExp(`target\\.dataset\\.${action}`));
  assert.match(cmsSource, /target\.matches\("\[data-add-media\]"\)\) render\(\{ preserveScroll: true \}\)/);
});
