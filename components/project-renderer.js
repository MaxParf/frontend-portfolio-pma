const PUBLIC_STATUSES = new Set(["published"]);
const DEFAULT_LOCALE = "en";

function getProjectTranslation(project, locale) {
  return project.translations?.[locale] || project.translations?.[DEFAULT_LOCALE] || {};
}

function getMediaTranslation(media, locale) {
  return media.translations?.[locale] || media.translations?.[DEFAULT_LOCALE] || {};
}

function createElement(tagName, className, textContent) {
  const element = document.createElement(tagName);

  if (className) {
    element.className = className;
  }

  if (textContent !== undefined && textContent !== null) {
    element.textContent = textContent;
  }

  return element;
}

function createProjectMeta(projectText) {
  const meta = createElement("div", "project-card__meta");
  meta.append(
    createElement("span", "project-card__type", projectText.type),
    createElement("span", "project-card__status", projectText.statusLabel)
  );

  return meta;
}

function createDescription(projectText) {
  const fragment = document.createDocumentFragment();
  const descriptions = Array.isArray(projectText.description) ? projectText.description : [projectText.description];

  descriptions.filter(Boolean).forEach((description) => {
    fragment.append(createElement("p", "project-card__description", description));
  });

  return fragment;
}

function createList(items, className) {
  const list = createElement("ul", className);

  items.forEach((item) => {
    list.append(createElement("li", "", item));
  });

  return list;
}

function createTechnologies(project, projectText) {
  const list = createList(project.technologies, "badge-list");

  if (projectText.technologiesAriaLabel) {
    list.setAttribute("aria-label", projectText.technologiesAriaLabel);
  }

  return list;
}

function createNotes(projectText) {
  const fragment = document.createDocumentFragment();
  const notes = projectText.notes || (projectText.demoNote ? [projectText.demoNote] : []);

  notes.filter(Boolean).forEach((note) => {
    fragment.append(createElement("p", "project-card__note", note));
  });

  return fragment;
}

function createProjectLinks(project, projectText) {
  const links = createElement("div", "project-card__links");

  project.links.forEach((linkData) => {
    const label = projectText.links?.[linkData.id];

    if (!label || !linkData.href) {
      return;
    }

    const link = createElement("a", "", label);
    link.href = linkData.href;

    if (linkData.external) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }

    links.append(link);
  });

  return links;
}

function createGalleryButton(project, media, mediaIndex, locale) {
  const mediaText = getMediaTranslation(media, locale);
  const button = createElement("button", "project-card__gallery-button");
  const image = createElement("img", media.imageClassName || "project-card__image");

  button.type = "button";
  button.dataset.gallery = project.galleryId;
  button.dataset.galleryIndex = String(mediaIndex);
  button.setAttribute("aria-label", mediaText.ariaLabel || mediaText.alt || project.id);

  image.src = media.src;
  image.alt = mediaText.alt || "";
  image.loading = "lazy";
  image.decoding = "async";

  if (media.width) {
    image.width = media.width;
  }

  if (media.height) {
    image.height = media.height;
  }

  button.append(image);
  return button;
}

function createGalleryGroups(project, locale) {
  const fragment = document.createDocumentFragment();
  const mediaById = new Map(project.media.map((media) => [media.id, media]));
  const sortedMedia = [...project.media].sort((first, second) => first.sortOrder - second.sortOrder);
  const mediaIndexById = new Map(sortedMedia.map((media, index) => [media.id, index]));

  project.galleryGroups.forEach((group) => {
    const gallery = createElement("div", group.className);

    group.mediaIds.forEach((mediaId) => {
      const media = mediaById.get(mediaId);
      const mediaIndex = mediaIndexById.get(mediaId);

      if (!media || mediaIndex === undefined) {
        return;
      }

      gallery.append(createGalleryButton(project, media, mediaIndex, locale));
    });

    fragment.append(gallery);
  });

  return fragment;
}

function createProjectCard(project, locale) {
  const projectText = getProjectTranslation(project, locale);
  const article = createElement("article", "project-card project-card--featured");
  const content = createElement("div", "project-card__content");
  const title = createElement("h3", "project-card__title", projectText.title);
  const role = createElement("p", "project-card__role", projectText.role);

  content.append(
    createProjectMeta(projectText),
    title,
    role,
    createDescription(projectText),
    createList(projectText.features || [], "project-card__features"),
    createTechnologies(project, projectText),
    createNotes(projectText),
    createProjectLinks(project, projectText),
    createGalleryGroups(project, locale)
  );

  article.append(content);
  return article;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateProjects(projects) {
  const seenIds = new Set();
  const seenSlugs = new Set();
  const seenGalleryIds = new Set();

  return projects.filter((project) => {
    try {
      if (!isNonEmptyString(project.id) || seenIds.has(project.id)) {
        throw new Error("Project id is missing or duplicated.");
      }

      if (!isNonEmptyString(project.slug) || seenSlugs.has(project.slug)) {
        throw new Error("Project slug is missing or duplicated.");
      }

      if (!isNonEmptyString(project.galleryId) || seenGalleryIds.has(project.galleryId)) {
        throw new Error("Project galleryId is missing or duplicated.");
      }

      if (!Number.isFinite(project.sortOrder)) {
        throw new Error("Project sortOrder must be a finite number.");
      }

      if (!project.translations?.en || !project.translations?.ru) {
        throw new Error("Project must include en and ru translations.");
      }

      if (!isNonEmptyString(project.translations.en.title) || !isNonEmptyString(project.translations.ru.title)) {
        throw new Error("Project translations must include non-empty titles.");
      }

      const mediaIds = new Set();
      project.media.forEach((media) => {
        if (!isNonEmptyString(media.id) || mediaIds.has(media.id)) {
          throw new Error("Project media id is missing or duplicated.");
        }

        if (!isNonEmptyString(media.src)) {
          throw new Error("Project media src is missing.");
        }

        mediaIds.add(media.id);
      });

      project.links.forEach((link) => {
        if (link.href !== null && typeof link.href !== "string") {
          throw new Error("Project link href must be a string or null.");
        }
      });

      seenIds.add(project.id);
      seenSlugs.add(project.slug);
      seenGalleryIds.add(project.galleryId);
      return true;
    } catch (error) {
      console.error(`Skipping invalid project "${project.id || "unknown"}":`, error);
      return false;
    }
  });
}

export function renderProjects({ root, projects, locale }) {
  if (!root) {
    return [];
  }

  const validProjects = validateProjects(projects)
    .filter((project) => PUBLIC_STATUSES.has(project.status))
    .sort((first, second) => first.sortOrder - second.sortOrder);

  root.replaceChildren();
  validProjects.forEach((project) => {
    root.append(createProjectCard(project, locale));
  });

  return validProjects;
}
