const API_META_NAME = "portfolio-api-base-url";

export function getProjectsApiBaseUrl(documentRef = document) {
  const value = documentRef.querySelector(`meta[name="${API_META_NAME}"]`)?.getAttribute("content")?.trim();

  if (!value) {
    throw new Error("Project API base URL is not configured.");
  }

  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Project API base URL must use HTTP(S).");
  }

  return url.toString().replace(/\/$/, "");
}
