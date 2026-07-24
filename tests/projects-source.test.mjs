import assert from "node:assert/strict";
import test from "node:test";
import { projects as fallbackProjects } from "../data/projects.js";
import { mapApiProjectsResponse, ProjectContractError } from "../mappers/project-api-mapper.js";
import { ProjectApiError } from "../services/projects-api.js";
import { loadProjects } from "../services/projects-source.js";
import { getProjectsApiBaseUrl } from "../config/projects-config.js";

const locale = "en";
const productionApiBaseUrl = "https://api.maxpar.ru/api/v1";
const apiProject = {
  id: "project-bradbury",
  slug: "project-bradbury",
  galleryId: "bradbury",
  status: "published",
  sortOrder: 20,
  type: "quiet-social-platform",
  title: "Project Bradbury from API",
  subtitle: null,
  description: "Published API description.",
  role: "Founder",
  statusLabel: "Published",
  technologies: ["React", "TypeScript"],
  links: { primary: { href: "https://prbdbr.com/", type: "website", label: "Live platform" }, secondary: null },
  media: [{ id: "project-bradbury:mobile-home", src: "images/projects/bradbury/mobile_home_feed.webp", role: "gallery", sortOrder: 10, alt: "API alt", ariaLabel: "API gallery label" }],
};

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

test("API DTO maps published content into the existing frontend model", () => {
  const [project] = mapApiProjectsResponse({ data: [apiProject], meta: { locale, count: 1 } }, { locale, fallbackProjects, apiBaseUrl: productionApiBaseUrl });
  assert.equal(project.translations.en.title, apiProject.title);
  assert.equal(project.translations.en.description, apiProject.description);
  assert.deepEqual(project.technologies, apiProject.technologies);
  assert.equal(project.media[0].translations.en.alt, "API alt");
  assert.equal(project.media[0].translations.en.ariaLabel, "API gallery label");
  assert.equal(project.links[0].external, true);
  assert.equal(project.galleryGroups[0].className, "project-card__gallery");
});

test("mapper preserves deterministic API sort order and rejects unsafe links", () => {
  const earlier = { ...apiProject, id: "foodai", slug: "foodai", galleryId: "foodai", sortOrder: 10, title: "FoodAI", media: [{ ...apiProject.media[0], id: "foodai:meal-plan", src: "images/projects/foodai/foodai-meal-plan.png" }] };
  const mapped = mapApiProjectsResponse({ data: [apiProject, earlier], meta: { locale } }, { locale, fallbackProjects, apiBaseUrl: productionApiBaseUrl });
  assert.deepEqual(mapped.map((project) => project.slug), ["foodai", "project-bradbury"]);
  assert.throws(() => mapApiProjectsResponse({ data: [{ ...apiProject, links: { primary: { ...apiProject.links.primary, href: "javascript:alert(1)" } } }], meta: { locale } }, { locale, fallbackProjects, apiBaseUrl: productionApiBaseUrl }), ProjectContractError);
  assert.throws(() => mapApiProjectsResponse({ data: [{ ...apiProject, media: [{ ...apiProject.media[0], src: "data:text/html,unsafe" }] }], meta: { locale } }, { locale, fallbackProjects, apiBaseUrl: productionApiBaseUrl }), ProjectContractError);
});

test("mapper resolves managed media through the configured API base and preserves safe static sources", () => {
  const managedMedia = [
    { ...apiProject.media[0], src: "/api/v1/media/example/display", thumbnailSrc: "/api/v1/media/example/thumbnail" },
    { ...apiProject.media[0], id: "project-bradbury:mobile-detail", src: "./images/projects/bradbury/mobile_detail.webp", thumbnailSrc: "https://cdn.example.test/detail.webp" },
  ];
  const [project] = mapApiProjectsResponse({ data: [{ ...apiProject, media: managedMedia }], meta: { locale } }, { locale, fallbackProjects, apiBaseUrl: productionApiBaseUrl });
  assert.equal(project.media[0].src, "https://api.maxpar.ru/api/v1/media/example/display");
  assert.equal(project.media[0].thumbnailSrc, "https://api.maxpar.ru/api/v1/media/example/thumbnail");
  assert.equal(project.media[1].src, "./images/projects/bradbury/mobile_detail.webp");
  assert.equal(project.media[1].thumbnailSrc, "https://cdn.example.test/detail.webp");
});

test("mapper rejects unsafe or malformed media URLs and managed media without an API base URL", () => {
  for (const src of ["javascript:alert(1)", "https://["]) {
    assert.throws(() => mapApiProjectsResponse({ data: [{ ...apiProject, media: [{ ...apiProject.media[0], src }] }], meta: { locale } }, { locale, fallbackProjects, apiBaseUrl: productionApiBaseUrl }), ProjectContractError);
  }
  assert.throws(() => mapApiProjectsResponse({ data: [{ ...apiProject, media: [{ ...apiProject.media[0], src: "/api/v1/media/example/display" }] }], meta: { locale } }, { locale, fallbackProjects }), ProjectContractError);
});

test("API success selects API source without credentials", async () => {
  let request;
  const result = await loadProjects({ locale, apiBaseUrl: "http://127.0.0.1:3001/api/v1", fetchImpl: async (url, init) => { request = { url, init }; return response({ data: [apiProject], meta: { locale } }); } });
  assert.equal(result.source, "api");
  assert.match(request.url, /projects\?locale=en/);
  assert.equal(request.init.credentials, "omit");
});

test("missing API configuration is not hidden by the static fallback", () => {
  assert.throws(() => getProjectsApiBaseUrl({ querySelector: () => null }), /not configured/);
});

test("network, HTTP, parse, and contract failures select static fallback", async () => {
  for (const fetchImpl of [
    async () => { throw new Error("offline"); },
    async () => response({}, 500),
    async () => ({ ok: true, status: 200, json: async () => { throw new Error("bad json"); } }),
    async () => response({ data: [{ ...apiProject, title: "" }], meta: { locale } }),
  ]) {
    const result = await loadProjects({ locale, apiBaseUrl: "http://127.0.0.1:3001/api/v1", fetchImpl });
    assert.equal(result.source, "fallback");
    assert.equal(result.projects.length, 3);
  }
});

test("aborted requests do not select fallback", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    loadProjects({ locale, signal: controller.signal, apiBaseUrl: "http://127.0.0.1:3001/api/v1", fetchImpl: async () => { throw new DOMException("Aborted", "AbortError"); } }),
    (error) => error instanceof ProjectApiError && error.kind === "aborted",
  );
});

test("fallback remains locale-safe because the renderer receives both translations", async () => {
  const result = await loadProjects({ locale: "ru", apiBaseUrl: "http://127.0.0.1:3001/api/v1", fetchImpl: async () => { throw new Error("offline"); } });
  assert.equal(result.source, "fallback");
  assert.equal(result.projects.find((project) => project.slug === "foodai").translations.ru.title, "FoodAI");
});
