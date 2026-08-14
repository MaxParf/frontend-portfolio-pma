import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createEditorState, createMemoryStorage } from "../cms-lite/editor/state.js";
import { descriptionToEditorText, editorTextToDescription } from "../cms-lite/editor/app.js";

const fixture = JSON.parse(readFileSync(new URL("../data/projects.lite.json", import.meta.url), "utf8"));
const cmsSource = `${readFileSync(new URL("../cms-lite/cms.js", import.meta.url), "utf8")}\n${readFileSync(new URL("../cms-lite/editor/app.js", import.meta.url), "utf8")}`;
const appSource = readFileSync(new URL("../cms-lite/editor/app.js", import.meta.url), "utf8");
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
  assert.doesNotMatch(inputHandler, /\brefresh\(\)/);
  const livePath = appSource.slice(appSource.indexOf("const refreshLiveUi"), appSource.indexOf("const refresh ="));
  assert.match(livePath, /updateChrome\(\); renderPreview\(\);/);
  assert.doesNotMatch(livePath, /innerHTML|render\(\)/);
});

test("description editor joins and restores every RU/EN paragraph without changing the array contract", () => {
  const ru = ["Первый абзац.", "Второй абзац.", "Третий абзац."];
  const en = ["First paragraph.", "Second paragraph.", "Third paragraph."];
  assert.equal(descriptionToEditorText(ru), "Первый абзац.\n\nВторой абзац.\n\nТретий абзац.");
  assert.equal(descriptionToEditorText(en), "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.");
  assert.deepEqual(editorTextToDescription(descriptionToEditorText(ru)), ru);
  assert.deepEqual(editorTextToDescription(descriptionToEditorText(en)), en);
  assert.deepEqual(editorTextToDescription("Один абзац"), ["Один абзац"]);
  assert.match(appSource, /"description\.ru", descriptionToEditorText\(project\.description\.ru\)/);
  assert.match(appSource, /project\.description\[path\[0\]\] = editorTextToDescription\(target\.value\)/);
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
  assert.match(cmsSource, /chrome\.connectionLabel \?\? "Подключено: память"/);
  assert.match(cmsSource, /connectionStatus === "BUSY" \? "Сохранение"/);
  assert.match(cmsSource, /connectionStatus === "DISCONNECTED" \? "Хранилище недоступно"/);
  assert.match(cssSource, /\.cms-editor \{ min-height: 0; overflow-y: auto;/);
  assert.match(cmsSource, /const render = \(\) =>/);
});

test("tag Add button creates a chip through the same operation as Enter", () => {
  assert.match(cmsSource, /<form data-tag-form>/);
  assert.match(cmsSource, /<button class="cms-add" type="submit">Добавить<\/button>/);
  assert.match(cmsSource, /if \(value\) mutate\(\(project\) => \{ if \(!project\.techStack\.includes\(value\)\) project\.techStack\.push\(value\); \}\);/);
  assert.match(cmsSource, /root\.addEventListener\("submit"/);
  assert.match(cmsSource, /const value = String\(new FormData\(event\.target\)\.get\("tag"\) \?\? ""\)\.trim\(\)/);
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
  assert.match(cmsSource, /alt: existing\?\.alt \?\? project\.title/);
  assert.match(cmsSource, /ariaLabel: existing\?\.ariaLabel \?\? project\.title/);
  const rendererSource = readFileSync(new URL("../components/project-renderer.js", import.meta.url), "utf8");
  assert.match(rendererSource, /localized\(media\.ariaLabel, locale, localized\(media\.alt, locale, project\.id\)\)/);
});

test("structural actions preserve editor scroll while project navigation may reset it", () => {
  const clickHandler = appSource.slice(appSource.indexOf('root.addEventListener("click"'), appSource.indexOf('root.addEventListener("submit"'));
  assert.match(clickHandler, /target\.dataset\.select\) snapshot = editor\.select/);
  assert.match(clickHandler, /target\.dataset\.newProject !== undefined\) snapshot = editor\.createProject/);
  assert.match(clickHandler, /target\.dataset\.delete\) snapshot = editor\.deleteProject/);
  for (const action of ["addList", "removeList", "addLink", "removeLink", "deleteMedia", "saveAll"]) assert.match(clickHandler, new RegExp(`target\\.dataset\\.${action}`));
  assert.match(cmsSource, /target\.matches\("\[data-replace-media\], \[data-add-media\]"\)/);
});
