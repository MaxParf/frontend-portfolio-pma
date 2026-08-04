import { renderProjects } from "../components/project-renderer.js";
import { createEditorState } from "./editor/state.js";
import { createMediaPreviewStore } from "./editor/media-previews.js";
import { CMS_SESSION_KEY, canLeaveCms, clearCmsSession } from "./session.js";
import { validatePasswordChange } from "./password-change.js";
import { CmsApiError, changePassword, logout } from "./api.js";
import { createPhpStorage } from "./storage/php-api.js";

const root = document.getElementById("cms-root");
const previewStore = createMediaPreviewStore();
let editor;
let snapshot;
let errorMessage = "";
let previewLocale = "ru";
let connectionStatus = "CONNECTED";

if (!sessionStorage.getItem(CMS_SESSION_KEY)) location.replace("/login/");

function clone(value) { return structuredClone(value); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]); }
function selectedProject() { return snapshot.workingState.projects.find((project) => project.id === snapshot.selectedProjectId) ?? null; }
function projectTitle(project) { return project?.title.ru || project?.title.en || project?.id || "Новый проект"; }
function localizedField(label, field, value, type = "input") {
  const control = type === "textarea" ? `<textarea data-field="${field}">${escapeHtml(value)}</textarea>` : `<input data-field="${field}" value="${escapeHtml(value)}">`;
  return `<label class="cms-field"><span>${label}</span>${control}</label>`;
}
function selectedMutation(mutator) {
  snapshot = editor.update((state) => {
    const project = state.projects.find((item) => item.id === snapshot.selectedProjectId);
    if (project) mutator(project);
  });
}
function setPath(project, path, value) {
  const parts = path.split("."); let target = project;
  parts.slice(0, -1).forEach((part) => { target = target[part]; });
  target[parts.at(-1)] = value;
}
function mediaById(project, mediaId) { return ["desktop", "mobile"].flatMap((kind) => project.gallery[kind]).find((media) => media.id === mediaId); }
function galleryKindForMedia(project, mediaId) { return ["desktop", "mobile"].find((kind) => project.gallery[kind].some((media) => media.id === mediaId)) ?? pendingMediaById(mediaId)?.galleryKind; }
function pendingMediaById(mediaId) { return snapshot.pendingMedia.get(mediaId) ?? null; }
function galleryItems(project, kind) {
  const canonical = project.gallery[kind].map((media) => ({ ...media, transient: pendingMediaById(media.id) }));
  const additions = [...snapshot.pendingMedia.values()].filter((media) => media.projectId === project.id && media.galleryKind === kind && !media.replacesCanonical);
  return [...canonical, ...additions];
}
function uniqueProjectId() { return `new-project-${crypto.randomUUID().slice(0, 8)}`; }
function addTag(value) {
  const tag = value.trim();
  if (tag) selectedMutation((project) => { if (!project.techStack.includes(tag)) project.techStack.push(tag); });
}
function passwordChangeDialog() {
  return `<dialog class="cms-password-dialog" data-password-dialog aria-labelledby="password-dialog-title"><form data-password-change-form method="post">
    <h2 id="password-dialog-title">Сменить пароль</h2><p data-password-change-message class="cms-password-dialog__message" role="status"></p>
    <label class="cms-field"><span>Текущий пароль</span><input name="currentPassword" type="password" autocomplete="current-password" required></label>
    <label class="cms-field"><span>Новый пароль</span><input name="newPassword" type="password" autocomplete="new-password" required></label>
    <label class="cms-field"><span>Повторите новый пароль</span><input name="confirmPassword" type="password" autocomplete="new-password" required></label>
    <div class="cms-password-dialog__actions"><button class="button button--primary" type="submit">Сменить пароль</button><button data-close-password type="button">Отмена</button></div>
  </form></dialog>`;
}

async function load() {
  const storage = createPhpStorage({ getToken: () => sessionStorage.getItem(CMS_SESSION_KEY) ?? "" });
  editor = createEditorState({ initialState: { version: 1, projects: [] }, storage });
  snapshot = await editor.load();
  connectionStatus = "CONNECTED";
  render();
}

function sidebar(projects) {
  return `<aside class="cms-sidebar"><strong>Проекты</strong><div class="cms-project-list">${projects.map((project) => `
    <div class="cms-project-row"><button class="cms-project-row__select ${project.id === snapshot.selectedProjectId ? "is-selected" : ""}" data-select="${project.id}" type="button">
      ${escapeHtml(projectTitle(project))}<span class="cms-status">${project.status === "published" ? "Опубликован" : "Черновик"}</span></button>
      <button class="cms-delete" data-delete="${project.id}" type="button" aria-label="Удалить ${escapeHtml(projectTitle(project))}">×</button></div>`).join("")}</div>
    <button class="cms-add" data-new-project type="button">+ Новый проект</button></aside>`;
}

function textList(title, property, project) {
  const rowCount = Math.max(project[property].ru.length, project[property].en.length);
  const rows = Array.from({ length: rowCount }, (_, index) => `<div class="cms-list-row">
    ${localizedField("RU", `${property}.ru.${index}`, project[property].ru[index] ?? "", "textarea")}
    ${localizedField("EN", `${property}.en.${index}`, project[property].en[index] ?? "", "textarea")}
    <button class="cms-row-delete" data-remove-list="${property}:${index}" type="button">Удалить</button></div>`).join("");
  return `<fieldset class="cms-fieldset"><legend>${title}</legend>${rows}<button class="cms-add" data-add-list="${property}" type="button">+ Добавить пункт</button></fieldset>`;
}

function tags(project) {
  return `<fieldset class="cms-fieldset"><legend>Технологии</legend><div class="cms-chips">${project.techStack.map((tag, index) => `<span class="cms-chip">${escapeHtml(tag)}<button data-remove-tag="${index}" type="button" aria-label="Удалить ${escapeHtml(tag)}">×</button></span>`).join("")}</div>
    <form data-tag-form><label class="cms-field"><span>Новая технология</span><input name="tag" autocomplete="off"></label><button class="cms-add" type="submit">Добавить</button></form></fieldset>`;
}

function links(project) {
  return `<fieldset class="cms-fieldset"><legend>Ссылки</legend>${project.links.map((link, index) => `<div class="cms-link-row">
    ${localizedField("RU", `link.${index}.label.ru`, link.label.ru)}${localizedField("EN", `link.${index}.label.en`, link.label.en)}
    ${localizedField("URL", `link.${index}.url`, link.url)}
    <label class="cms-field"><span>Target</span><select data-link-target="${index}"><option value="_blank" ${link.target === "_blank" ? "selected" : ""}>_blank</option><option value="_self" ${link.target === "_self" ? "selected" : ""}>_self</option></select></label>
    <button class="cms-row-delete" data-remove-link="${index}" type="button">Удалить</button></div>`).join("")}<button class="cms-add" data-add-link type="button">+ Добавить ссылку</button></fieldset>`;
}

function gallery(title, kind, project) {
  return `<fieldset class="cms-fieldset"><legend>${title}</legend><p>Выбранные файлы показываются только в памяти до PHP-фазы и не получают blob URL в каноническом состоянии.</p>
    <label class="cms-field"><span>Добавить изображение</span><input data-add-media="${kind}" type="file" accept="image/jpeg,image/png,image/webp"></label>
    <div class="cms-gallery">${galleryItems(project, kind).map((media) => {
      const preview = media.objectUrl ?? media.transient?.objectUrl ?? previewStore.get(media.id)?.objectUrl ?? media.src;
      return `<article class="cms-media-card ${kind === "mobile" ? "cms-media-card--mobile" : ""}"><img src="${escapeHtml(preview)}" alt="">
        <p>${escapeHtml(media.id)}</p><label class="cms-field"><span>Replace</span><input data-replace-media="${media.id}" type="file" accept="image/jpeg,image/png,image/webp"></label>
        ${localizedField("Alt RU", `media.${media.id}.alt.ru`, media.alt.ru)}${localizedField("Alt EN", `media.${media.id}.alt.en`, media.alt.en)}
        <label class="cms-field"><span>Presentation</span><select data-media-presentation="${media.id}"><option value="cover" ${media.presentation === "cover" ? "selected" : ""}>cover</option><option value="contain" ${media.presentation === "contain" ? "selected" : ""}>contain</option></select></label>
        <button class="cms-row-delete" data-delete-media="${media.id}" type="button">Удалить</button></article>`;
    }).join("")}</div></fieldset>`;
}

function editorForm(project) {
  if (!project) return `<section class="cms-editor"><p>Проект не выбран.</p></section>`;
  return `<section class="cms-editor"><div class="cms-editor-heading"><h1>${escapeHtml(projectTitle(project))}</h1><label class="cms-status-control"><span>Статус</span><select data-status><option value="draft" ${project.status === "draft" ? "selected" : ""}>draft</option><option value="published" ${project.status === "published" ? "selected" : ""}>published</option></select></label></div>${project.status === "draft" ? '<span class="cms-draft-preview">Предпросмотр черновика</span>' : ""}
    ${errorMessage ? `<p class="cms-form-error" role="alert">${escapeHtml(errorMessage)}</p>` : ""}
    <fieldset class="cms-fieldset"><legend>Основное</legend><div class="cms-field-grid">
      <label class="cms-field"><span>Stable ID</span><input value="${project.id}" disabled></label>
      <label class="cms-field"><span>Порядок</span><input data-order type="number" min="0" value="${project.order}"></label>
      ${localizedField("Категория RU", "category.ru", project.category.ru)}${localizedField("Категория EN", "category.en", project.category.en)}
      ${localizedField("Название RU", "title.ru", project.title.ru)}${localizedField("Название EN", "title.en", project.title.en)}
      ${localizedField("Роль RU", "role.ru", project.role.ru)}${localizedField("Роль EN", "role.en", project.role.en)}
      ${localizedField("Status label RU", "statusLabel.ru", project.statusLabel.ru)}${localizedField("Status label EN", "statusLabel.en", project.statusLabel.en)}
    </div></fieldset>
    <fieldset class="cms-fieldset"><legend>Описание</legend><div class="cms-field-grid">${localizedField("RU", "description.ru.0", project.description.ru[0] ?? "", "textarea")}${localizedField("EN", "description.en.0", project.description.en[0] ?? "", "textarea")}</div></fieldset>
    ${textList("Функции", "features", project)}${textList("Примечания", "notes", project)}${tags(project)}${links(project)}${gallery("Desktop Gallery", "desktop", project)}${gallery("Mobile Gallery", "mobile", project)}
  </section>`;
}

function previewProject(project) {
  const result = clone(project);
  // The owner preview intentionally renders drafts without making them public.
  result.status = "published";
  ["desktop", "mobile"].forEach((kind) => {
    result.gallery[kind].forEach((media) => {
      const pending = pendingMediaById(media.id); if (pending?.objectUrl) media.src = pending.objectUrl;
    });
    result.gallery[kind].push(...[...snapshot.pendingMedia.values()]
      .filter((media) => media.projectId === project.id && media.galleryKind === kind && !media.replacesCanonical)
      .map((media) => ({ id: media.id, src: media.objectUrl, alt: media.alt, ariaLabel: media.ariaLabel, presentation: media.presentation })));
  });
  return result;
}

function render({ preserveScroll = false } = {}) {
  const previousScrollTop = preserveScroll ? root.querySelector(".cms-editor")?.scrollTop ?? 0 : 0;
  const project = selectedProject();
  root.innerHTML = `<header class="cms-topbar"><span class="cms-topbar__title">Portfolio CMS</span><span data-connection-status class="cms-connection" role="status"></span><span data-save-state class="cms-save-state ${snapshot.dirty ? "is-dirty" : ""}">${snapshot.dirty ? "Есть несохраненные правки" : "Все изменения сохранены"}</span>
    <button data-save-all class="button button--primary" type="button">Save All</button><button data-change-password class="cms-account-action" type="button">Сменить пароль</button><button data-logout class="cms-logout" type="button">Выйти</button></header>
    <div class="cms-layout">${sidebar(snapshot.workingState.projects)}${editorForm(project)}<aside class="cms-preview"><h2>Предпросмотр</h2><div><button data-preview-locale="ru" type="button">RU</button><button data-preview-locale="en" type="button">EN</button></div><div data-preview-root></div></aside></div>${passwordChangeDialog()}`;
  updateChrome();
  renderPreview();
  if (preserveScroll) {
    const editorElement = root.querySelector(".cms-editor");
    if (editorElement) editorElement.scrollTop = previousScrollTop;
  }
}

function updateChrome() {
  const saved = root.querySelector("[data-save-state]");
  if (saved) { saved.classList.toggle("is-dirty", snapshot.dirty); saved.textContent = snapshot.dirty ? "Есть несохраненные правки" : "Все изменения сохранены"; }
  const connection = root.querySelector("[data-connection-status]");
  if (connection) {
    const copy = { CONNECTED: "Подключено: память", BUSY: "Сохранение в памяти", DISCONNECTED: "Хранилище недоступно" };
    connection.className = `cms-connection ${connectionStatus === "BUSY" ? "is-busy" : connectionStatus === "DISCONNECTED" ? "is-disconnected" : ""}`;
    connection.textContent = copy[connectionStatus]; connection.setAttribute("aria-label", copy[connectionStatus]);
  }
}

function renderPreview() {
  const previewRoot = root.querySelector("[data-preview-root]");
  const project = selectedProject();
  if (previewRoot && project) renderProjects({ root: previewRoot, projects: [previewProject(project)], locale: previewLocale });
}

function refreshLiveUi() { updateChrome(); renderPreview(); }

root.addEventListener("input", (event) => {
  const target = event.target;
  if (target.matches("[data-field]")) selectedMutation((project) => {
    const [scope, ...path] = target.dataset.field.split(".");
    if (scope === "link") setPath(project.links[Number(path.shift())], path.join("."), target.value);
    else if (scope === "media") {
      const mediaId = path.shift(); const pending = pendingMediaById(mediaId);
      if (pending) snapshot = editor.updatePendingMedia(mediaId, (media) => setPath(media, path.join("."), target.value));
      else setPath(mediaById(project, mediaId), path.join("."), target.value);
    }
    else setPath(project, target.dataset.field, target.value);
  });
  else if (target.matches("[data-order]")) selectedMutation((project) => { project.order = Number(target.value); });
  else return;
  refreshLiveUi();
});

root.addEventListener("change", (event) => {
  const target = event.target;
  if (target.matches("[data-status]")) selectedMutation((project) => { project.status = target.value; });
  else if (target.matches("[data-link-target]")) selectedMutation((project) => { project.links[Number(target.dataset.linkTarget)].target = target.value; });
  else if (target.matches("[data-media-presentation]")) {
    const pending = pendingMediaById(target.dataset.mediaPresentation);
    if (pending) snapshot = editor.updatePendingMedia(target.dataset.mediaPresentation, (media) => { media.presentation = target.value; });
    else selectedMutation((project) => { mediaById(project, target.dataset.mediaPresentation).presentation = target.value; });
  }
  else if (target.matches("[data-replace-media], [data-add-media]")) {
    const file = target.files?.[0]; if (!file) return;
    let mediaId = target.dataset.replaceMedia; const adding = !mediaId; const project = selectedProject(); const kind = target.dataset.addMedia ?? galleryKindForMedia(project, mediaId);
    const existing = mediaById(project, mediaId) ?? pendingMediaById(mediaId);
    if (!mediaId) mediaId = `${kind}-${crypto.randomUUID().slice(0, 8)}`;
    const objectUrl = previewStore.replace(mediaId, file);
    const fallbackLabel = project.title;
    snapshot = editor.setPendingMedia({ id: mediaId, projectId: project.id, galleryKind: kind, file, objectUrl, replacesCanonical: Boolean(existing && mediaById(project, mediaId)), alt: existing?.alt ?? fallbackLabel, ariaLabel: existing?.ariaLabel ?? fallbackLabel, presentation: existing?.presentation ?? (kind === "mobile" ? "contain" : "cover") });
    if (!adding) target.closest(".cms-media-card")?.querySelector("img")?.setAttribute("src", objectUrl);
  }
  else return;
  if (target.matches("[data-add-media]")) render({ preserveScroll: true });
  else refreshLiveUi();
});

root.addEventListener("click", async (event) => {
  const target = event.target.closest("button"); if (!target) return;
  if (target.closest("[data-tag-form]")) return;
  let preserveScroll = true;
  if (target.dataset.select) { snapshot = editor.select(target.dataset.select); preserveScroll = false; }
  else if (target.dataset.newProject !== undefined) { snapshot = editor.createProject(uniqueProjectId()); preserveScroll = false; }
  else if (target.dataset.delete) { snapshot = editor.deleteProject(target.dataset.delete); preserveScroll = false; }
  else if (target.dataset.addList) selectedMutation((project) => { project[target.dataset.addList].ru.push(""); project[target.dataset.addList].en.push(""); });
  else if (target.dataset.removeList) { const [property, index] = target.dataset.removeList.split(":"); selectedMutation((project) => { project[property].ru.splice(Number(index), 1); project[property].en.splice(Number(index), 1); }); }
  else if (target.dataset.removeTag) selectedMutation((project) => project.techStack.splice(Number(target.dataset.removeTag), 1));
  else if (target.dataset.addLink !== undefined) selectedMutation((project) => project.links.push({ label: { ru: "", en: "" }, url: "", target: "_blank" }));
  else if (target.dataset.removeLink) selectedMutation((project) => project.links.splice(Number(target.dataset.removeLink), 1));
  else if (target.dataset.deleteMedia) { previewStore.remove(target.dataset.deleteMedia); snapshot = editor.clearPendingMedia(target.dataset.deleteMedia); selectedMutation((project) => ["desktop", "mobile"].forEach((kind) => { project.gallery[kind] = project.gallery[kind].filter((media) => media.id !== target.dataset.deleteMedia); })); }
  else if (target.dataset.previewLocale) { previewLocale = target.dataset.previewLocale; refreshLiveUi(); return; }
  else if (target.dataset.changePassword !== undefined) {
    const dialog = root.querySelector("[data-password-dialog]");
    dialog?.showModal();
    dialog?.querySelector("[name=currentPassword]")?.focus();
    return;
  }
  else if (target.dataset.closePassword !== undefined) { root.querySelector("[data-password-dialog]")?.close(); return; }
  else if (target.dataset.logout !== undefined) {
    if (!canLeaveCms({ dirty: snapshot.dirty, confirmLeave: (message) => window.confirm(message) })) return;
    previewStore.dispose();
    logout(sessionStorage.getItem(CMS_SESSION_KEY) ?? "").catch(() => {});
    clearCmsSession(sessionStorage);
    location.assign("/login/");
    return;
  }
  else if (target.dataset.saveAll !== undefined) {
    connectionStatus = "BUSY"; updateChrome();
    try { const result = await editor.save(); snapshot = result.snapshot; errorMessage = result.saved ? "" : result.validation.issues.map((issue) => `${issue.path}: ${issue.message}`).slice(0, 4).join("; "); connectionStatus = "CONNECTED"; }
    catch (saveError) {
      const applicationError = saveError instanceof CmsApiError && saveError.status >= 400 && saveError.status < 500;
      errorMessage = saveError instanceof CmsApiError && saveError.status === 409 ? "Состояние изменилось в другой вкладке. Перезагрузите CMS перед сохранением."
        : saveError instanceof CmsApiError && saveError.status === 401 ? "Сессия истекла. Войдите в CMS снова."
        : applicationError ? "Не удалось сохранить изображение. Проверьте данные изображения и повторите попытку."
        : "Хранилище временно недоступно.";
      connectionStatus = applicationError ? "CONNECTED" : "DISCONNECTED";
    }
  }
  else return;
  render({ preserveScroll });
});

root.addEventListener("submit", (event) => {
  if (event.target.matches("[data-tag-form]")) {
    event.preventDefault();
    addTag(String(new FormData(event.target).get("tag") ?? ""));
    render({ preserveScroll: true });
    root.querySelector("[data-tag-form] [name=tag]")?.focus();
  } else if (event.target.matches("[data-password-change-form]")) {
    event.preventDefault();
    const form = event.target;
    const credentials = Object.fromEntries(new FormData(form));
    const validation = validatePasswordChange(credentials);
    const message = form.querySelector("[data-password-change-message]");
    if (!validation.valid) { message.textContent = validation.message; return; }
    const token = sessionStorage.getItem(CMS_SESSION_KEY) ?? "";
    changePassword(token, { currentPassword: credentials.currentPassword, newPassword: credentials.newPassword }).then(() => {
      form.reset();
      clearCmsSession(sessionStorage);
      location.assign("/login/");
    }).catch((requestError) => {
      form.reset();
      message.textContent = requestError instanceof CmsApiError ? "Не удалось сменить пароль." : "Сервис временно недоступен.";
    });
  }
});

root.addEventListener("close", (event) => {
  if (event.target.matches("[data-password-dialog]")) event.target.querySelector("form")?.reset();
}, true);

window.addEventListener("beforeunload", (event) => { if (snapshot?.dirty) { event.preventDefault(); event.returnValue = ""; } });
window.addEventListener("pagehide", () => previewStore.dispose(), { once: true });

load().catch((error) => { root.innerHTML = `<p class="cms-form-error" role="alert">${error.message}</p>`; });
