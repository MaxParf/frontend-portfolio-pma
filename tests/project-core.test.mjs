import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { projects as legacyProjects } from "../data/projects.js";
import { createPublicProjectState, normalizeProjectState } from "../project-core/project-normalizer.js";
import { validateProjectState } from "../project-core/project-validator.js";

const fixture = JSON.parse(await readFile(new URL("../data/projects.lite.json", import.meta.url), "utf8"));

function clone(value) {
  return structuredClone(value);
}

function findProject(state, id) {
  return state.projects.find((project) => project.id === id);
}

test("canonical Lite fixture validates and preserves the accepted project set", () => {
  assert.deepEqual(validateProjectState(fixture), { valid: true, issues: [] });
  assert.deepEqual(fixture.projects.map((project) => project.id), legacyProjects.map((project) => project.id));
  assert.equal(new Set(fixture.projects.map((project) => project.id)).size, fixture.projects.length);
});

test("fixture preserves selected content, links, gallery membership, and presentation", () => {
  const bradbury = findProject(fixture, "project-bradbury");
  const legacyBradbury = legacyProjects.find((project) => project.id === "project-bradbury");
  assert.equal(bradbury.description.en[0], legacyBradbury.translations.en.description[0]);
  assert.equal(bradbury.description.ru[2], legacyBradbury.translations.ru.description[2]);
  assert.deepEqual(bradbury.techStack, legacyBradbury.technologies);
  assert.equal(bradbury.gallery.desktop[0].ariaLabel.en, legacyBradbury.media.find((item) => item.id === "desktop-home").translations.en.ariaLabel);
  assert.deepEqual(bradbury.gallery.mobile.map((item) => item.id), ["mobile-home", "mobile-profile", "mobile-messages", "mobile-stories"]);
  assert.ok(bradbury.gallery.mobile.every((item) => item.presentation === "contain"));
  assert.deepEqual(findProject(fixture, "foodai").notes, { ru: [], en: [] });
  assert.equal(findProject(fixture, "construction-management-control-center").links[1].url, "#contact");
});

test("published projects require complete RU and EN public content while drafts may be incomplete", () => {
  const published = clone(fixture);
  published.projects[0].title.ru = "";
  assert.equal(validateProjectState(published).valid, false);

  const draft = { version: 1, projects: [{ id: "new-project", order: 40, status: "draft" }] };
  assert.deepEqual(validateProjectState(normalizeProjectState(draft)), { valid: true, issues: [] });
});

test("public projection excludes drafts and preserves the state version", () => {
  const state = clone(fixture);
  state.version = 4;
  state.projects.push({ ...clone(state.projects[0]), id: "private-draft", order: 40, status: "draft" });
  const projected = createPublicProjectState(state);
  assert.equal(projected.version, 4);
  assert.deepEqual(projected.projects.map((project) => project.id), fixture.projects.map((project) => project.id));
});

test("normalization applies only Lite defaults and keeps projects ordered", () => {
  const normalized = normalizeProjectState({
    version: 1,
    projects: [
      { id: "later", order: 20, status: "draft", links: [{ label: {}, url: "https://example.com" }], gallery: {} },
      { id: "earlier", order: 10, status: "draft", links: [{ label: {}, url: "#contact" }], gallery: {} },
    ],
  });
  assert.deepEqual(normalized.projects.map((project) => project.id), ["earlier", "later"]);
  assert.equal(normalized.projects[0].links[0].target, "_self");
  assert.equal(normalized.projects[1].links[0].target, "_blank");
  assert.equal(normalized.projects[0].gallery.desktop.length, 0);
});

test("validator rejects duplicate media, unsafe links, and malformed galleries", () => {
  const duplicateMedia = clone(fixture);
  duplicateMedia.projects[0].gallery.mobile.push(clone(duplicateMedia.projects[0].gallery.desktop[0]));
  assert.equal(validateProjectState(duplicateMedia).valid, false);

  const unsafe = clone(fixture);
  unsafe.projects[0].links[0].url = "javascript:alert(1)";
  assert.equal(validateProjectState(unsafe).valid, false);

  const malformedGallery = clone(fixture);
  malformedGallery.projects[0].gallery.mobile = {};
  assert.equal(validateProjectState(malformedGallery).valid, false);
});
