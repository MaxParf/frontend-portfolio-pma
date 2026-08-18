import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DEMO_FIXTURE_MANIFEST_URL, ProjectSourceError, STATIC_PROJECTS_URL, loadProjectState } from "../services/projects-source.js";

const fixture = JSON.parse(readFileSync(new URL("../data/projects.lite.json", import.meta.url), "utf8"));
const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test("public loader reads the sole canonical static JSON source", async () => {
  const requests = [];
  const result = await loadProjectState({ demoStateLoader: async () => null, fetchImpl: async (url, init) => { requests.push({ url, init }); return url === DEMO_FIXTURE_MANIFEST_URL ? response({ fixtureVersion: "fixture-x" }) : response(fixture); } });
  const request = requests.at(-1);
  assert.equal(requests[0].url, DEMO_FIXTURE_MANIFEST_URL);
  assert.equal(requests[0].init.method, "GET");
  assert.equal(request.url, STATIC_PROJECTS_URL);
  assert.equal(request.init.method, "GET");
  assert.equal(result.source, "static-json");
  assert.deepEqual(result.projects.map((project) => project.id), ["construction-management-control-center", "project-bradbury", "foodai"]);
});

test("public loader has no API request or legacy fallback when JSON is unavailable", async () => {
  await assert.rejects(
    loadProjectState({ demoStateLoader: async () => null, fetchImpl: async () => response({}, 503) }),
    (error) => error instanceof ProjectSourceError && error.kind === "http",
  );
  const source = readFileSync(new URL("../services/projects-source.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /api\/v1\/projects|data\/projects\.js|fallbackProjects/);
});

test("a compatible saved Demo state is authoritative and does not fetch the production projection", async () => {
  const demo = { projects: [fixture.projects[1]], source: "demo-indexeddb", dispose() {} };
  const result = await loadProjectState({
    demoFixtureVersionLoader: async () => "demo-fixture-x",
    demoStateLoader: async ({ fixtureVersion }) => { assert.equal(fixtureVersion, "demo-fixture-x"); return demo; },
    fetchImpl: async () => { throw new Error("production projection must not be fetched"); },
  });
  assert.equal(result, demo);
});

test("unavailable Demo storage fails safely to the production projection", async () => {
  const result = await loadProjectState({
    demoFixtureVersionLoader: async () => "demo-fixture-x",
    demoStateLoader: async () => { throw new Error("IndexedDB unavailable"); },
    fetchImpl: async () => response(fixture),
  });
  assert.equal(result.source, "static-json");
});

test("a live production projection revision does not invalidate a compatible Demo fixture", async () => {
  const demo = { projects: [fixture.projects[0]], source: "demo-indexeddb", dispose() {} };
  const changedLiveProjection = structuredClone(fixture); changedLiveProjection.version += 1; changedLiveProjection.projects.push(structuredClone(fixture.projects[0])); changedLiveProjection.projects.at(-1).id = "portfolio-cms"; changedLiveProjection.projects.at(-1).order = 99;
  const result = await loadProjectState({
    demoFixtureVersionLoader: async () => "demo-fixture-x",
    demoStateLoader: async ({ fixtureVersion }) => fixtureVersion === "demo-fixture-x" ? demo : null,
    fetchImpl: async () => { throw new Error("live projection must not be fetched when Demo is compatible"); },
  });
  assert.equal(result, demo);
  assert.equal(changedLiveProjection.projects.some((project) => project.id === "portfolio-cms"), true);
});

test("an incompatible Demo fixture falls back safely to the current static projection", async () => {
  const result = await loadProjectState({
    demoFixtureVersionLoader: async () => "installed-demo-fixture",
    demoStateLoader: async ({ fixtureVersion }) => fixtureVersion === "installed-demo-fixture" ? null : assert.fail("unexpected fixture version"),
    fetchImpl: async (url) => { assert.equal(url, STATIC_PROJECTS_URL); return response(fixture); },
  });
  assert.equal(result.source, "static-json");
});

test("public project dependencies no longer import API or legacy project data", () => {
  for (const file of ["../script.js", "../services/projects-source.js", "../components/project-renderer.js"]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(source, /projects-api|project-api-mapper|data\/projects\.js|api\/v1\/projects/);
  }
});

test("fixture preserves bilingual links, gallery groups, contain behavior, and accessible labels", () => {
  const bradbury = fixture.projects.find((project) => project.id === "project-bradbury");
  assert.equal(bradbury.title.ru, "Project Bradbury");
  assert.equal(bradbury.links[0].target, "_blank");
  assert.deepEqual(bradbury.gallery.desktop.map((item) => item.id), ["desktop-home", "desktop-messages", "desktop-room", "admin-console"]);
  assert.ok(bradbury.gallery.mobile.every((item) => item.presentation === "contain" && item.ariaLabel.en));
  assert.equal(fixture.projects[0].links[1].url, "#contact");
});
