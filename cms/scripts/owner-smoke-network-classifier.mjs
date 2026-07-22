const EXPECTED_AUTH_STAGES = new Set(["before_login", "after_logout"]);

function endpointPath(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return "";
  }
}

function isApiUrl(url, apiBase) {
  try {
    return new URL(url).origin === new URL(apiBase).origin;
  } catch {
    return false;
  }
}

export function isExpectedOwnerSmokeAuth401({ url, status, stage, apiBase }) {
  if (status !== 401 || !EXPECTED_AUTH_STAGES.has(stage) || !isApiUrl(url, apiBase)) return false;

  const path = endpointPath(url);
  if (stage === "before_login") return path === "/api/v1/admin/auth/me";
  return path === "/api/v1/admin/auth/me" || path === "/api/v1/admin/projects";
}

export function classifyOwnerSmokeResponse(event) {
  if (isExpectedOwnerSmokeAuth401(event)) return "expectedAuth401";
  if (event.status >= 500) return "network5xx";
  if (event.status >= 400) return "unexpectedNetwork4xx";
  return null;
}

export function classifyOwnerSmokeConsole({ messageType, text, url, stage, apiBase }) {
  if (messageType !== "error") return null;

  if (isExpectedOwnerSmokeAuth401({ url, status: 401, stage, apiBase }) && /status of 401 \(Unauthorized\)/.test(text)) {
    return "expectedAuth401";
  }

  return "unexpectedConsoleErrors";
}

export function classifyOwnerSmokePageError() {
  return "pageErrors";
}
