import { INTERNAL_PROJECT_ANCHORS, LINK_TARGETS, MEDIA_PRESENTATIONS, PROJECT_STATUSES, SUPPORTED_LOCALES, createEmptyProject } from "./project-model.js";

function clone(value) {
  return structuredClone(value);
}

function normalizedLocalizedText(value, array = false) {
  const source = value && typeof value === "object" ? value : {};
  return Object.fromEntries(SUPPORTED_LOCALES.map((locale) => {
    const item = source[locale];
    return [locale, array ? (Array.isArray(item) ? [...item] : []) : (typeof item === "string" ? item : "")];
  }));
}

function defaultTarget(url, target) {
  if (LINK_TARGETS.includes(target)) return target;
  return INTERNAL_PROJECT_ANCHORS.includes(url) ? "_self" : "_blank";
}

function normalizeGalleryItems(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => ({
    ...(item && typeof item === "object" ? clone(item) : {}),
    id: typeof item?.id === "string" ? item.id : "",
    src: typeof item?.src === "string" ? item.src : "",
    alt: normalizedLocalizedText(item?.alt),
    ariaLabel: normalizedLocalizedText(item?.ariaLabel),
    presentation: MEDIA_PRESENTATIONS.includes(item?.presentation) ? item.presentation : "cover",
  }));
}

export function normalizeProject(project) {
  const source = project && typeof project === "object" ? project : {};
  const base = createEmptyProject(typeof source.id === "string" ? source.id : "");

  return {
    ...base,
    ...clone(source),
    id: typeof source.id === "string" ? source.id : "",
    order: Number.isFinite(source.order) ? source.order : 0,
    status: PROJECT_STATUSES.includes(source.status) ? source.status : "draft",
    category: normalizedLocalizedText(source.category),
    title: normalizedLocalizedText(source.title),
    role: normalizedLocalizedText(source.role),
    description: normalizedLocalizedText(source.description, true),
    statusLabel: normalizedLocalizedText(source.statusLabel),
    features: normalizedLocalizedText(source.features, true),
    notes: normalizedLocalizedText(source.notes, true),
    techStack: Array.isArray(source.techStack) ? [...source.techStack] : [],
    links: Array.isArray(source.links) ? source.links.map((link) => ({
      ...(link && typeof link === "object" ? clone(link) : {}),
      label: normalizedLocalizedText(link?.label),
      url: typeof link?.url === "string" ? link.url : "",
      target: defaultTarget(link?.url, link?.target),
    })) : [],
    gallery: {
      desktop: normalizeGalleryItems(source.gallery?.desktop),
      mobile: normalizeGalleryItems(source.gallery?.mobile),
    },
  };
}

export function normalizeProjectState(state) {
  const source = state && typeof state === "object" ? state : {};
  const projects = Array.isArray(source.projects) ? source.projects.map(normalizeProject) : [];
  projects.sort((first, second) => first.order - second.order || first.id.localeCompare(second.id));
  return {
    version: Number.isInteger(source.version) && source.version >= 1 ? source.version : 1,
    projects,
  };
}

/** Returns the public shape without draft-only owner records. */
export function createPublicProjectState(state) {
  const normalized = normalizeProjectState(state);
  return {
    version: normalized.version,
    projects: normalized.projects.filter((project) => project.status === "published"),
  };
}
