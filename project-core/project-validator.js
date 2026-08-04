import { INTERNAL_PROJECT_ANCHORS, LINK_TARGETS, MEDIA_PRESENTATIONS, PROJECT_ID_PATTERN, PROJECT_STATUSES, SUPPORTED_LOCALES } from "./project-model.js";

function issue(issues, path, message) {
  issues.push({ path, message });
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateLocalizedText(value, path, issues, { required, array = false } = {}) {
  if (!isPlainObject(value)) {
    issue(issues, path, "must be a localized object");
    return;
  }
  for (const locale of SUPPORTED_LOCALES) {
    const item = value[locale];
    if (array) {
      if (!Array.isArray(item)) {
        issue(issues, `${path}.${locale}`, "must be an array");
      } else if (required && item.some((entry) => !isNonEmptyString(entry))) {
        issue(issues, `${path}.${locale}`, "must contain non-empty strings");
      }
    } else if (required ? !isNonEmptyString(item) : typeof item !== "string") {
      issue(issues, `${path}.${locale}`, required ? "is required" : "must be a string");
    }
  }
}

function isSafeImageSrc(value) {
  if (!isNonEmptyString(value) || value.startsWith("//") || value.includes("\\")) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return false;
  return !value.split("/").includes("..");
}

function isApprovedUrl(value) {
  if (!isNonEmptyString(value)) return false;
  if (INTERNAL_PROJECT_ANCHORS.includes(value)) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function validateProject(project, index, issues) {
  const path = `projects[${index}]`;
  if (!isPlainObject(project)) {
    issue(issues, path, "must be an object");
    return;
  }

  if (!isNonEmptyString(project.id) || !PROJECT_ID_PATTERN.test(project.id)) issue(issues, `${path}.id`, "must be a lowercase URL-safe id");
  if (!Number.isInteger(project.order) || project.order < 0) issue(issues, `${path}.order`, "must be a non-negative integer");
  if (!PROJECT_STATUSES.includes(project.status)) issue(issues, `${path}.status`, "must be draft or published");

  const published = project.status === "published";
  for (const field of ["category", "title", "role", "statusLabel"]) validateLocalizedText(project[field], `${path}.${field}`, issues, { required: published });
  for (const field of ["description", "features", "notes"]) validateLocalizedText(project[field], `${path}.${field}`, issues, { required: published, array: true });

  if (!Array.isArray(project.techStack)) issue(issues, `${path}.techStack`, "must be an array");
  else if (project.techStack.some((technology) => !isNonEmptyString(technology))) issue(issues, `${path}.techStack`, "must contain non-empty strings");

  if (!Array.isArray(project.links)) {
    issue(issues, `${path}.links`, "must be an array");
  } else {
    project.links.forEach((link, linkIndex) => {
      const linkPath = `${path}.links[${linkIndex}]`;
      if (!isPlainObject(link)) return issue(issues, linkPath, "must be an object");
      validateLocalizedText(link.label, `${linkPath}.label`, issues, { required: published });
      if (!isApprovedUrl(link.url)) issue(issues, `${linkPath}.url`, "must be HTTPS or an approved internal anchor");
      if (!LINK_TARGETS.includes(link.target)) issue(issues, `${linkPath}.target`, "must be _blank or _self");
    });
  }

  if (!isPlainObject(project.gallery)) {
    issue(issues, `${path}.gallery`, "must be an object with desktop and mobile arrays");
    return;
  }

  const mediaIds = new Set();
  for (const group of ["desktop", "mobile"]) {
    const media = project.gallery[group];
    if (!Array.isArray(media)) {
      issue(issues, `${path}.gallery.${group}`, "must be an array");
      continue;
    }
    media.forEach((item, mediaIndex) => {
      const mediaPath = `${path}.gallery.${group}[${mediaIndex}]`;
      if (!isPlainObject(item)) return issue(issues, mediaPath, "must be an object");
      if (!isNonEmptyString(item.id)) issue(issues, `${mediaPath}.id`, "is required");
      else if (mediaIds.has(item.id)) issue(issues, `${mediaPath}.id`, "must be unique within a project");
      else mediaIds.add(item.id);
      if ((published && !isSafeImageSrc(item.src)) || (!published && item.src && !isSafeImageSrc(item.src))) issue(issues, `${mediaPath}.src`, "must be a safe relative image path");
      validateLocalizedText(item.alt, `${mediaPath}.alt`, issues, { required: published });
      validateLocalizedText(item.ariaLabel, `${mediaPath}.ariaLabel`, issues, { required: published });
      if (!MEDIA_PRESENTATIONS.includes(item.presentation)) issue(issues, `${mediaPath}.presentation`, "must be cover or contain");
    });
  }
}

export function validateProjectState(state) {
  const issues = [];
  if (!isPlainObject(state)) return { valid: false, issues: [{ path: "state", message: "must be an object" }] };
  if (!Number.isInteger(state.version) || state.version < 1) issue(issues, "version", "must be a positive integer");
  if (!Array.isArray(state.projects)) {
    issue(issues, "projects", "must be an array");
    return { valid: false, issues };
  }

  const ids = new Set();
  state.projects.forEach((project, index) => {
    validateProject(project, index, issues);
    if (isPlainObject(project) && typeof project.id === "string") {
      if (ids.has(project.id)) issue(issues, `projects[${index}].id`, "must be unique");
      ids.add(project.id);
    }
  });
  return { valid: issues.length === 0, issues };
}

export function assertValidProjectState(state) {
  const result = validateProjectState(state);
  if (!result.valid) throw new Error(`Invalid Lite project state: ${result.issues.map((entry) => `${entry.path} ${entry.message}`).join("; ")}`);
  return state;
}
