import { describe, expect, it } from "vitest";
import {
  classifyOwnerSmokeConsole,
  classifyOwnerSmokePageError,
  classifyOwnerSmokeResponse,
} from "./owner-smoke-network-classifier.mjs";

const apiBase = "http://127.0.0.1:3001";
const me = `${apiBase}/api/v1/admin/auth/me`;
const projects = `${apiBase}/api/v1/admin/projects`;

describe("owner browser smoke network classifier", () => {
  it("allows only the initial auth check and explicit post-logout checks", () => {
    expect(classifyOwnerSmokeResponse({ url: me, status: 401, stage: "before_login", apiBase })).toBe("expectedAuth401");
    expect(classifyOwnerSmokeResponse({ url: me, status: 401, stage: "after_logout", apiBase })).toBe("expectedAuth401");
    expect(classifyOwnerSmokeResponse({ url: projects, status: 401, stage: "after_logout", apiBase })).toBe("expectedAuth401");
  });

  it("rejects a 401 during an authenticated stage or on an arbitrary endpoint", () => {
    expect(classifyOwnerSmokeResponse({ url: me, status: 401, stage: "after_login", apiBase })).toBe("unexpectedNetwork4xx");
    expect(classifyOwnerSmokeResponse({ url: `${apiBase}/api/v1/admin/media`, status: 401, stage: "after_logout", apiBase })).toBe("unexpectedNetwork4xx");
  });

  it("rejects non-401 client failures and server failures", () => {
    expect(classifyOwnerSmokeResponse({ url: me, status: 403, stage: "after_logout", apiBase })).toBe("unexpectedNetwork4xx");
    expect(classifyOwnerSmokeResponse({ url: me, status: 500, stage: "after_logout", apiBase })).toBe("network5xx");
  });

  it("suppresses only console errors caused by an expected staged 401", () => {
    const expected = {
      messageType: "error",
      text: "Failed to load resource: the server responded with a status of 401 (Unauthorized)",
      url: me,
      stage: "after_logout",
      apiBase,
    };
    expect(classifyOwnerSmokeConsole(expected)).toBe("expectedAuth401");
    expect(classifyOwnerSmokeConsole({ ...expected, stage: "after_login" })).toBe("unexpectedConsoleErrors");
    expect(classifyOwnerSmokeConsole({ ...expected, url: `${apiBase}/api/v1/admin/media` })).toBe("unexpectedConsoleErrors");
  });

  it("always treats a page error as fatal", () => {
    expect(classifyOwnerSmokePageError()).toBe("pageErrors");
  });
});
