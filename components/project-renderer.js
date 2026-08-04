const PUBLIC_STATUSES = new Set(["published"]);
const DEFAULT_LOCALE = "en";

function localized(value, locale, fallback = "") {
  if (!value || typeof value !== "object") return fallback;
  return value[locale] ?? value[DEFAULT_LOCALE] ?? value.ru ?? fallback;
}

function createElement(tagName, className, textContent) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (textContent !== undefined && textContent !== null) element.textContent = textContent;
  return element;
}

function createProjectMeta(project, locale) {
  const meta = createElement("div", "project-card__meta");
  meta.append(
    createElement("span", "project-card__type", localized(project.category, locale)),
    createElement("span", "project-card__status", localized(project.statusLabel, locale)),
  );
  return meta;
}

function createDescription(project, locale) {
  const fragment = document.createDocumentFragment();
  localized(project.description, locale, []).filter(Boolean).forEach((description) => {
    fragment.append(createElement("p", "project-card__description", description));
  });
  return fragment;
}

function createList(items, className) {
  const list = createElement("ul", className);
  items.forEach((item) => list.append(createElement("li", "", item)));
  return list;
}

function createTechnologies(project) {
  return createList(project.techStack, "badge-list");
}

function createNotes(project, locale) {
  const fragment = document.createDocumentFragment();
  localized(project.notes, locale, []).filter(Boolean).forEach((note) => {
    fragment.append(createElement("p", "project-card__note", note));
  });
  return fragment;
}

function createProjectLinks(project, locale) {
  const links = createElement("div", "project-card__links");
  project.links.forEach((linkData) => {
    const label = localized(linkData.label, locale);
    if (!label || !linkData.url) return;
    const link = createElement("a", "", label);
    link.href = linkData.url;
    if (linkData.target === "_blank") {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
    links.append(link);
  });
  return links;
}

function createGalleryButton(project, media, mediaIndex, locale) {
  const button = createElement("button", "project-card__gallery-button");
  const imageClassName = media.presentation === "contain" ? "project-card__image project-card__image--contain" : "project-card__image";
  const image = createElement("img", imageClassName);
  button.type = "button";
  button.dataset.gallery = project.id;
  button.dataset.galleryIndex = String(mediaIndex);
  button.setAttribute("aria-label", localized(media.ariaLabel, locale, localized(media.alt, locale, project.id)));
  image.src = media.src;
  image.alt = localized(media.alt, locale);
  image.loading = "lazy";
  image.decoding = "async";
  button.append(image);
  return button;
}

function createGalleryGroups(project, locale) {
  const fragment = document.createDocumentFragment();
  let mediaIndex = 0;
  ["mobile", "desktop"].forEach((group) => {
    const items = project.gallery[group];
    if (!items.length) return;
    const gallery = createElement("div", `project-card__gallery project-card__gallery--${group}`);
    items.forEach((item) => gallery.append(createGalleryButton(project, item, mediaIndex++, locale)));
    fragment.append(gallery);
  });
  return fragment;
}

function createProjectCard(project, locale) {
  const article = createElement("article", "project-card project-card--featured");
  const content = createElement("div", "project-card__content");
  content.append(
    createProjectMeta(project, locale),
    createElement("h3", "project-card__title", localized(project.title, locale)),
    createElement("p", "project-card__role", localized(project.role, locale)),
    createDescription(project, locale),
    createList(localized(project.features, locale, []), "project-card__features"),
    createTechnologies(project),
    createNotes(project, locale),
    createProjectLinks(project, locale),
    createGalleryGroups(project, locale),
  );
  article.append(content);
  return article;
}

export function validateProjects(projects) {
  const seenIds = new Set();
  return projects.filter((project) => {
    const valid = project && typeof project.id === "string" && project.id && !seenIds.has(project.id)
      && Number.isFinite(project.order) && project.gallery && Array.isArray(project.gallery.desktop) && Array.isArray(project.gallery.mobile);
    if (!valid) return false;
    seenIds.add(project.id);
    return true;
  });
}

export function renderProjects({ root, projects, locale }) {
  if (!root) return [];
  const validProjects = validateProjects(projects)
    .filter((project) => PUBLIC_STATUSES.has(project.status))
    .sort((first, second) => first.order - second.order);
  root.replaceChildren();
  validProjects.forEach((project) => root.append(createProjectCard(project, locale)));
  return validProjects;
}
