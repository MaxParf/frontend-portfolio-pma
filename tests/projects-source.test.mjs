import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ProjectSourceError, STATIC_PROJECTS_URL, loadProjectState } from "../services/projects-source.js";

const fixture = JSON.parse(readFileSync(new URL("../data/projects.lite.json", import.meta.url), "utf8"));
const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test("public loader reads the sole canonical static JSON source", async () => {
  let request;
  const result = await loadProjectState({ demoStateLoader: async () => null, fetchImpl: async (url, init) => { request = { url, init }; return response(fixture); } });
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
    demoStateLoader: async () => demo,
    fetchImpl: async () => { throw new Error("production projection must not be fetched"); },
  });
  assert.equal(result, demo);
});

test("unavailable Demo storage fails safely to the production projection", async () => {
  const result = await loadProjectState({
    demoStateLoader: async () => { throw new Error("IndexedDB unavailable"); },
    fetchImpl: async () => response(fixture),
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
