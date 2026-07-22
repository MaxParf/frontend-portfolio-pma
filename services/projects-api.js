export class ProjectApiError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = "ProjectApiError";
    this.kind = kind;
  }
}

export async function fetchPublishedProjects({ apiBaseUrl, locale, signal, timeoutMs = 3500, fetchImpl = fetch }) {
  if (locale !== "en" && locale !== "ru") {
    throw new ProjectApiError("contract", "Unsupported project locale.");
  }

  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort("timeout"), timeoutMs);
  const abort = () => controller.abort("aborted");
  if (signal?.aborted) {
    abort();
  } else {
    signal?.addEventListener("abort", abort, { once: true });
  }

  try {
    const response = await fetchImpl(`${apiBaseUrl}/projects?locale=${encodeURIComponent(locale)}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "omit",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new ProjectApiError("http", `Project API returned HTTP ${response.status}.`);
    }

    try {
      return await response.json();
    } catch {
      throw new ProjectApiError("parse", "Project API returned invalid JSON.");
    }
  } catch (error) {
    if (error instanceof ProjectApiError) {
      throw error;
    }
    if (controller.signal.aborted) {
      throw new ProjectApiError(signal?.aborted ? "aborted" : "timeout", "Project API request was aborted.");
    }
    throw new ProjectApiError("network", "Project API request failed.");
  } finally {
    globalThis.clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
