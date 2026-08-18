export const SUPPORTED_LOCALES = Object.freeze(["ru", "en"]);
export const PROJECT_STATUSES = Object.freeze(["draft", "published"]);
export const MEDIA_PRESENTATIONS = Object.freeze(["cover", "contain"]);
export const LINK_TARGETS = Object.freeze(["_blank", "_self"]);
export const INTERNAL_PROJECT_ANCHORS = Object.freeze([
  "#hero",
  "#featured-projects",
  "#skills",
  "#services",
  "#about",
  "#contact",
]);

export const PROJECT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function createEmptyLocalizedText() {
  return { ru: "", en: "" };
}

export function createEmptyProject(id = "") {
  return {
    id,
    order: 0,
    status: "draft",
    category: createEmptyLocalizedText(),
    title: createEmptyLocalizedText(),
    role: createEmptyLocalizedText(),
    description: { ru: [], en: [] },
    statusLabel: createEmptyLocalizedText(),
    features: { ru: [], en: [] },
    notes: { ru: [], en: [] },
    techStack: [],
    links: [],
    gallery: { desktop: [], mobile: [] },
  };
}
