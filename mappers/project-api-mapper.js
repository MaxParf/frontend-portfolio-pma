const LOCALES = new Set(["en", "ru"]);
const MEDIA_PRESENTATIONS = new Set(["cover", "contain"]);
const PROJECT_GALLERY_KINDS = new Set(["mobile", "desktop"]);
const ALLOWED_PROJECT_ANCHORS = new Set(["#hero", "#featured-projects", "#skills", "#services", "#about", "#contact"]);

export class ProjectContractError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProjectContractError";
  }
}

function requiredString(value, field) {
  if (typeof value !== "string" || !value.trim()) {
    throw new ProjectContractError(`${field} must be a non-empty string.`);
  }

  return value;
}

function optionalString(value, field) {
  if (value !== null && value !== undefined && typeof value !== "string") {
    throw new ProjectContractError(`${field} must be a string or null.`);
  }

  return value ?? null;
}

function safeHref(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const href = requiredString(value, "link.href").trim();
  // Keep this allowlist synchronized with CMS and backend; no shared runtime package spans all three builds.
  if (ALLOWED_PROJECT_ANCHORS.has(href)) {
    return href;
  }

  let url;
  try {
    url = new URL(href);
  } catch {
    throw new ProjectContractError("link.href must be a valid URL.");
  }

  if (url.protocol !== "https:") {
    throw new ProjectContractError("link.href uses an unsafe protocol.");
  }

  return url.toString();
}

function safeApiBaseUrl(value) {
  const apiBaseUrl = requiredString(value, "apiBaseUrl").trim();
  let url;
  try {
    url = new URL(apiBaseUrl);
  } catch {
    throw new ProjectContractError("apiBaseUrl must be a valid URL.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ProjectContractError("apiBaseUrl must use HTTP(S).");
  }

  return url.toString().replace(/\/$/, "");
}

function resolveManagedMediaSrc(src, apiBaseUrl) {
  const normalizedApiBaseUrl = safeApiBaseUrl(apiBaseUrl);
  const apiBasePath = new URL(normalizedApiBaseUrl).pathname.replace(/\/$/, "");
  const relativePath = apiBasePath && (src === apiBasePath || src.startsWith(`${apiBasePath}/`))
    ? src.slice(apiBasePath.length).replace(/^\//, "")
    : src.replace(/^\//, "");
  return new URL(relativePath, `${normalizedApiBaseUrl}/`).toString();
}

function safeMediaSrc(value, apiBaseUrl) {
  const src = requiredString(value, "media.src").trim();
  if (src.startsWith("/api/")) {
    return resolveManagedMediaSrc(src, apiBaseUrl);
  }

  if (src.startsWith("/") || src.startsWith("./") || src.startsWith("../") || !src.includes(":")) {
    return src;
  }

  let url;
  try {
    url = new URL(src);
  } catch {
    throw new ProjectContractError("media.src must be a valid path or URL.");
  }

  if (url.protocol !== "https:") {
    throw new ProjectContractError("media.src uses an unsafe protocol.");
  }

  return url.toString();
}

function safeMediaPresentation(value) {
  if (value === null || value === undefined) {
    return "cover";
  }

  if (!MEDIA_PRESENTATIONS.has(value)) {
    throw new ProjectContractError("media.presentation must be cover or contain.");
  }

  return value;
}

function safeGalleryKind(value) {
  if (!PROJECT_GALLERY_KINDS.has(value)) {
    throw new ProjectContractError("media.galleryKind must be mobile or desktop.");
  }
  return value;
}

function mapApiLinks(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ProjectContractError("project.links must be a non-empty array.");
  }

  return value.map((link) => {
    if (!link || typeof link !== "object") {
      throw new ProjectContractError("link must be an object.");
    }

    const id = requiredString(link.id, "link.id");
    const href = safeHref(link.url);
    const label = requiredString(link.label, "link.label");
    if (!href) {
      throw new ProjectContractError("link.url must be a non-empty string.");
    }
    return { id, href, external: !href.startsWith("#"), label };
  });
}

function mapMedia(apiMedia, fallbackMedia, locale, apiBaseUrl) {
  if (!Array.isArray(apiMedia)) {
    throw new ProjectContractError("media must be an array.");
  }

  return apiMedia.map((media) => {
    if (!media || typeof media !== "object") {
      throw new ProjectContractError("media item must be an object.");
    }

    const apiId = requiredString(media.id, "media.id");
    const staticId = apiId.includes(":") ? apiId.split(":").at(-1) : apiId;
    const presentation = fallbackMedia.find((item) => item.id === staticId);
    const presentationMode = safeMediaPresentation(media.presentation);
    const galleryKind = safeGalleryKind(media.galleryKind);
    const sourceType = media.sourceType ?? "legacy";
    if (sourceType !== "legacy" && sourceType !== "managed") {
      throw new ProjectContractError("media.sourceType must be legacy or managed.");
    }
    return {
      ...(presentation ?? {}),
      id: staticId,
      src: safeMediaSrc(media.src, apiBaseUrl),
      thumbnailSrc: media.thumbnailSrc ? safeMediaSrc(media.thumbnailSrc, apiBaseUrl) : null,
      sourceType,
      presentation: presentationMode,
      galleryKind,
      imageClassName: presentationMode === "contain" ? "project-card__image project-card__image--contain" : presentation?.imageClassName ?? "project-card__image",
      role: requiredString(media.role, "media.role"),
      sortOrder: Number.isFinite(media.sortOrder) ? media.sortOrder : 0,
      translations: {
        ...(presentation?.translations ?? {}),
        [locale]: {
          alt: requiredString(media.alt, "media.alt"),
          ariaLabel: requiredString(media.ariaLabel, "media.ariaLabel"),
        },
      },
    };
  });
}

function mapProject(apiProject, fallbackProject, locale, apiBaseUrl) {
  if (!apiProject || typeof apiProject !== "object") {
    throw new ProjectContractError("project must be an object.");
  }

  if (!fallbackProject) {
    throw new ProjectContractError(`No presentation fallback exists for ${apiProject.slug ?? "an unknown project"}.`);
  }

  const links = mapApiLinks(apiProject.links);
  const media = mapMedia(apiProject.media, fallbackProject.media, locale, apiBaseUrl);
  const contentStrings = (value, field) => {
    if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) throw new ProjectContractError(`${field} must be a string array.`);
    return value;
  };
  const displayType = requiredString(apiProject.displayType, "project.displayType");
  const features = contentStrings(apiProject.features, "project.features");
  const notes = contentStrings(apiProject.notes, "project.notes");
  const galleryGroups = [
    { id: "mobile", className: "project-card__gallery project-card__gallery--mobile", mediaIds: media.filter((item) => item.galleryKind === "mobile").sort((a, b) => a.sortOrder - b.sortOrder).map((item) => item.id) },
    { id: "desktop", className: "project-card__gallery project-card__gallery--desktop", mediaIds: media.filter((item) => item.galleryKind === "desktop").sort((a, b) => a.sortOrder - b.sortOrder).map((item) => item.id) },
  ].filter((group) => group.mediaIds.length);

  return {
    ...structuredClone(fallbackProject),
    id: requiredString(apiProject.id, "project.id"),
    slug: requiredString(apiProject.slug, "project.slug"),
    galleryId: requiredString(apiProject.galleryId, "project.galleryId"),
    status: requiredString(apiProject.status, "project.status"),
    sortOrder: Number.isFinite(apiProject.sortOrder) ? apiProject.sortOrder : (() => { throw new ProjectContractError("project.sortOrder must be a number."); })(),
    meta: { ...fallbackProject.meta, type: optionalString(apiProject.type, "project.type") },
    technologies: Array.isArray(apiProject.technologies) && apiProject.technologies.every((item) => typeof item === "string") ? apiProject.technologies : (() => { throw new ProjectContractError("project.technologies must be a string array."); })(),
    links,
    galleryGroups,
    media,
    translations: {
      ...structuredClone(fallbackProject.translations),
      [locale]: {
        ...fallbackProject.translations[locale],
        title: requiredString(apiProject.title, "project.title"),
        subtitle: optionalString(apiProject.subtitle, "project.subtitle"),
        description: requiredString(apiProject.description, "project.description"),
        role: requiredString(apiProject.role, "project.role"),
        statusLabel: requiredString(apiProject.statusLabel, "project.statusLabel"),
        type: displayType,
        features,
        notes,
        links: Object.fromEntries(links.map((link) => [link.id, link.label])),
      },
    },
  };
}

export function mapApiProjectsResponse(payload, { locale, fallbackProjects, apiBaseUrl }) {
  if (!LOCALES.has(locale)) {
    throw new ProjectContractError("Unsupported locale.");
  }

  if (!payload || !Array.isArray(payload.data) || payload.data.length === 0) {
    throw new ProjectContractError("Project API response must include a non-empty data array.");
  }

  if (payload.meta?.locale && payload.meta.locale !== locale) {
    throw new ProjectContractError("Project API response locale does not match the request.");
  }

  const fallbackBySlug = new Map(fallbackProjects.map((project) => [project.slug, project]));
  const mapped = payload.data.map((project) => mapProject(project, fallbackBySlug.get(project.slug), locale, apiBaseUrl));
  if (new Set(mapped.map((project) => project.slug)).size !== mapped.length) {
    throw new ProjectContractError("Project API response contains duplicate slugs.");
  }

  return mapped.sort((first, second) => first.sortOrder - second.sortOrder);
}
