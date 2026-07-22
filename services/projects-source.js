import { projects as fallbackProjects } from "../data/projects.js";
import { getProjectsApiBaseUrl } from "../config/projects-config.js";
import { mapApiProjectsResponse, ProjectContractError } from "../mappers/project-api-mapper.js";
import { fetchPublishedProjects, ProjectApiError } from "./projects-api.js";

export async function loadProjects({ locale, signal, apiBaseUrl, fetchImpl, timeoutMs } = {}) {
  try {
    const payload = await fetchPublishedProjects({ apiBaseUrl: apiBaseUrl ?? getProjectsApiBaseUrl(), locale, signal, fetchImpl, timeoutMs });
    return { projects: mapApiProjectsResponse(payload, { locale, fallbackProjects }), source: "api" };
  } catch (error) {
    if (error instanceof ProjectApiError && error.kind === "aborted") {
      throw error;
    }

    const reason = error instanceof ProjectApiError ? error.kind : error instanceof ProjectContractError ? "contract" : "mapping";
    return { projects: structuredClone(fallbackProjects), source: "fallback", reason };
  }
}
