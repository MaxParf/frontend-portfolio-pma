import { createPublicProjectState, normalizeProjectState } from "../project-core/project-normalizer.js";
import { validateProjectState } from "../project-core/project-validator.js";

export const STATIC_PROJECTS_URL = "data/projects.lite.json";

export class ProjectSourceError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = "ProjectSourceError";
    this.kind = kind;
  }
}

/** Loads the sole public project source; no API or legacy-data fallback is permitted. */
export async function loadProjectState({ signal, fetchImpl = fetch } = {}) {
  let response;
  try {
    response = await fetchImpl(STATIC_PROJECTS_URL, { method: "GET", headers: { Accept: "application/json" }, signal });
  } catch (error) {
    if (signal?.aborted || error?.name === "AbortError") throw new ProjectSourceError("aborted", "Project JSON request was aborted.");
    throw new ProjectSourceError("network", "Project JSON request failed.");
  }

  if (!response.ok) throw new ProjectSourceError("http", `Project JSON returned HTTP ${response.status}.`);

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ProjectSourceError("parse", "Project JSON is invalid.");
  }

  const validation = validateProjectState(payload);
  if (!validation.valid) throw new ProjectSourceError("contract", "Project JSON does not match the Lite project contract.");

  const state = createPublicProjectState(normalizeProjectState(payload));
  return { state, projects: state.projects, source: "static-json" };
}
