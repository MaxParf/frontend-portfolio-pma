import { createPublicProjectState, normalizeProjectState } from "../project-core/project-normalizer.js";
import { validateProjectState } from "../project-core/project-validator.js";
import { loadSavedDemoSandbox } from "../demo/cms/sandbox/read-state.js";

export const STATIC_PROJECTS_URL = "data/projects.lite.json";
export const DEMO_FIXTURE_MANIFEST_URL = "demo/cms/fixture/manifest.json";

export class ProjectSourceError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = "ProjectSourceError";
    this.kind = kind;
  }
}

async function loadDemoFixtureVersion({ signal, fetchImpl }) {
  const response = await fetchImpl(DEMO_FIXTURE_MANIFEST_URL, { method: "GET", headers: { Accept: "application/json" }, signal });
  if (!response.ok) return null;
  const manifest = await response.json();
  return typeof manifest?.fixtureVersion === "string" && manifest.fixtureVersion ? manifest.fixtureVersion : null;
}

/** Chooses a saved browser-local Demo projection before the sole production source. */
export async function loadProjectState({ signal, fetchImpl = fetch, demoStateLoader = loadSavedDemoSandbox, demoFixtureVersionLoader = loadDemoFixtureVersion } = {}) {
  let demoState = null;
  try { const fixtureVersion = await demoFixtureVersionLoader({ signal, fetchImpl }); if (fixtureVersion) demoState = await demoStateLoader({ fixtureVersion }); } catch { /* Browser-local Demo storage must fail safely to production. */ }
  if (demoState) return demoState;

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
