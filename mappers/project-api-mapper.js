const LOCALES = new Set(["en", "ru"]);

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
  if (href.startsWith("#")) {
    return href;
  }

  let url;
  try {
    url = new URL(href);
  } catch {
    throw new ProjectContractError("link.href must be a valid URL.");
  }

  const isLocalHttp = url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname);
  if (url.protocol !== "https:" && !isLocalHttp) {
    throw new ProjectContractError("link.href uses an unsafe protocol.");
  }

  return url.toString();
}

function safeMediaSrc(value) {
  const src = requiredString(value, "media.src").trim();
  if (src.startsWith("/") || src.startsWith("./") || src.startsWith("../") || !src.includes(":")) {
    return src;
  }

  let url;
  try {
    url = new URL(src);
  } catch {
    throw new ProjectContractError("media.src must be a valid path or URL.");
  }

  const isLocalHttp = url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname);
  if (url.protocol !== "https:" && !isLocalHttp) {
    throw new ProjectContractError("media.src uses an unsafe protocol.");
  }

  return url.toString();
}

function mapLink(link, id) {
  if (link === null || link === undefined) {
    return null;
  }

  if (typeof link !== "object") {
    throw new ProjectContractError("link must be an object or null.");
  }

  const href = safeHref(link.href);
  const label = optionalString(link.label, "link.label");
  if (!href || !label) {
    throw new ProjectContractError("link must include href and label.");
  }

  return { id, href, type: requiredString(link.type, "link.type"), external: !href.startsWith("#"), label };
}

function mapMedia(apiMedia, fallbackMedia, locale) {
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
    return {
      ...(presentation ?? {}),
      id: staticId,
      src: safeMediaSrc(media.src),
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

function mapProject(apiProject, fallbackProject, locale) {
  if (!apiProject || typeof apiProject !== "object") {
    throw new ProjectContractError("project must be an object.");
  }

  if (!fallbackProject) {
    throw new ProjectContractError(`No presentation fallback exists for ${apiProject.slug ?? "an unknown project"}.`);
  }

  const links = [mapLink(apiProject.links?.primary, "primary"), mapLink(apiProject.links?.secondary, "secondary")].filter(Boolean);
  const media = mapMedia(apiProject.media, fallbackProject.media, locale);
  const staticMediaIds = new Set(media.map((item) => item.id));
  const galleryGroups = fallbackProject.galleryGroups.filter((group) => group.mediaIds.every((id) => staticMediaIds.has(id)));

  if (!galleryGroups.length && media.length) {
    galleryGroups.push({ id: "main", className: "project-card__gallery", mediaIds: media.map((item) => item.id) });
  }

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
        links: Object.fromEntries(links.map((link) => [link.id, link.label])),
      },
    },
  };
}

export function mapApiProjectsResponse(payload, { locale, fallbackProjects }) {
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
  const mapped = payload.data.map((project) => mapProject(project, fallbackBySlug.get(project.slug), locale));
  if (new Set(mapped.map((project) => project.slug)).size !== mapped.length) {
    throw new ProjectContractError("Project API response contains duplicate slugs.");
  }

  return mapped.sort((first, second) => first.sortOrder - second.sortOrder);
}
