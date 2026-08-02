import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
  displayType: "API display type",
  technologies: ["React", "TypeScript"],
  features: ["API feature one", "API feature two"],
  notes: ["API note"],
  links: [{ id: "live", url: "https://prbdbr.com/", label: "Live platform" }],
  media: [{ id: "project-bradbury:mobile-home", src: "images/projects/bradbury/mobile_home_feed.webp", role: "gallery", galleryKind: "mobile", sortOrder: 10, alt: "API alt", ariaLabel: "API gallery label" }],
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
  assert.deepEqual(project.links, [{ id: "live", href: "https://prbdbr.com/", external: true, label: "Live platform" }]);
  assert.equal(project.galleryGroups[0].className, "project-card__gallery project-card__gallery--mobile");
  assert.equal(project.translations[locale].type, "API display type");
  assert.deepEqual(project.translations[locale].features, ["API feature one", "API feature two"]);
  assert.deepEqual(project.translations[locale].notes, ["API note"]);
});

test("API links replace static links without fixed slots and preserve arbitrary order", () => {
  for (const links of [
    [{ id: "one", url: "https://example.test/one", label: "One" }],
    [{ id: "one", url: "https://example.test/one", label: "One" }, { id: "two", url: "https://example.test/two", label: "Two" }],
    [{ id: "three", url: "https://example.test/three", label: "Three" }, { id: "one", url: "https://example.test/one", label: "One" }, { id: "two", url: "https://example.test/two", label: "Two" }],
  ]) {
    const [project] = mapApiProjectsResponse({ data: [{ ...apiProject, links }], meta: { locale } }, { locale, fallbackProjects, apiBaseUrl: productionApiBaseUrl });
    assert.deepEqual(project.links.map(({ id, href, label }) => ({ id, href, label })), links.map(({ id, url, label }) => ({ id, href: url, label })));
    assert.equal(project.links.some((link) => "type" in link || link.id === "primary" || link.id === "secondary"), false);
    assert.notDeepEqual(project.links, fallbackProjects[0].links);
  }
});

test("mapper rejects invalid normalized API links while static projects remain usable", () => {
  for (const links of [[], [{ id: "", url: "https://example.test", label: "Label" }], [{ id: "id", url: 42, label: "Label" }], [{ id: "id", url: "https://example.test", label: " " }]]) {
    assert.throws(() => mapApiProjectsResponse({ data: [{ ...apiProject, links }], meta: { locale } }, { locale, fallbackProjects, apiBaseUrl: productionApiBaseUrl }), ProjectContractError);
  }
  assert.equal(fallbackProjects[0].links.length > 0, true);
});

test("API content blocks replace static content and empty API notes do not retain fixture notes", () => {
  const [project] = mapApiProjectsResponse({ data: [{ ...apiProject, notes: [], features: ["Second", "First"] }], meta: { locale } }, { locale, fallbackProjects, apiBaseUrl: productionApiBaseUrl });
  assert.deepEqual(project.translations[locale].features, ["Second", "First"]);
  assert.deepEqual(project.translations[locale].notes, []);
  assert.notEqual(project.translations[locale].type, fallbackProjects[0].translations[locale].type);
});

test("mapper rejects malformed API content blocks instead of mixing fixture values", () => {
  for (const invalid of [{ displayType: "" }, { features: ["safe", 4] }, { notes: {} }]) {
    assert.throws(() => mapApiProjectsResponse({ data: [{ ...apiProject, ...invalid }], meta: { locale } }, { locale, fallbackProjects, apiBaseUrl: productionApiBaseUrl }), ProjectContractError);
  }
});

test("mapper preserves deterministic API sort order and rejects unsafe links", () => {
  const earlier = { ...apiProject, id: "foodai", slug: "foodai", galleryId: "foodai", sortOrder: 10, title: "FoodAI", media: [{ ...apiProject.media[0], id: "foodai:meal-plan", src: "images/projects/foodai/foodai-meal-plan.png" }] };
  const mapped = mapApiProjectsResponse({ data: [apiProject, earlier], meta: { locale } }, { locale, fallbackProjects, apiBaseUrl: productionApiBaseUrl });
  assert.deepEqual(mapped.map((project) => project.slug), ["foodai", "project-bradbury"]);
  assert.throws(() => mapApiProjectsResponse({ data: [{ ...apiProject, links: [{ ...apiProject.links[0], url: "javascript:alert(1)" }] }], meta: { locale } }, { locale, fallbackProjects, apiBaseUrl: productionApiBaseUrl }), ProjectContractError);
  assert.throws(() => mapApiProjectsResponse({ data: [{ ...apiProject, media: [{ ...apiProject.media[0], src: "data:text/html,unsafe" }] }], meta: { locale } }, { locale, fallbackProjects, apiBaseUrl: productionApiBaseUrl }), ProjectContractError);
});

test("public mapper accepts only approved anchors and classifies them as same-tab links", () => {
  for (const url of ["#hero", "#featured-projects", "#skills", "#services", "#about", "#contact"]) {
    const [project] = mapApiProjectsResponse({ data: [{ ...apiProject, links: [{ id: "anchor", url, label: "Anchor" }] }], meta: { locale } }, { locale, fallbackProjects, apiBaseUrl: productionApiBaseUrl });
    assert.deepEqual(project.links, [{ id: "anchor", href: url, external: false, label: "Anchor" }]);
  }
  for (const url of ["#", "#unknown", "#CONTACT", "#contact/", "#contact?x=1", "#contact#other", "%23contact", "http://example.com", "//example.com", "/example", "./example", "mailto:test@example.com", "tel:+123", "javascript:alert(1)", "data:text/html,unsafe"]) {
    assert.throws(() => mapApiProjectsResponse({ data: [{ ...apiProject, links: [{ id: "invalid", url, label: "Invalid" }] }], meta: { locale } }, { locale, fallbackProjects, apiBaseUrl: productionApiBaseUrl }), ProjectContractError);
  }
  const [external] = mapApiProjectsResponse({ data: [{ ...apiProject, links: [{ id: "external", url: "https://example.com", label: "External" }] }], meta: { locale } }, { locale, fallbackProjects, apiBaseUrl: productionApiBaseUrl });
  assert.deepEqual(external.links, [{ id: "external", href: "https://example.com/", external: true, label: "External" }]);
});

test("root HTML contains each approved project anchor exactly once", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  for (const id of ["hero", "featured-projects", "skills", "services", "about", "contact"]) assert.equal((html.match(new RegExp(`id="${id}"`, "g")) ?? []).length, 1);
});

test("contain media keeps its border reset after the mobile gallery rule while cover keeps the gallery border", () => {
  const css = readFileSync(new URL("../style.css", import.meta.url), "utf8");
  const mobile = css.slice(css.indexOf("@media (max-width: 640px)"));
  const galleryRule = mobile.indexOf(".project-card__gallery .project-card__image {");
  const containRule = mobile.indexOf(".project-card__gallery .project-card__image--contain {");
  assert.ok(galleryRule >= 0 && containRule > galleryRule);
  assert.match(mobile.slice(galleryRule, containRule), /border:\s*1px solid var\(--color-border\)/);
  assert.match(mobile.slice(containRule), /^\.project-card__gallery \.project-card__image--contain \{\s*border:\s*0;/m);
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

test("mapper defaults missing presentation to cover and maps managed contain media to a safe modifier", () => {
  const managedContain = { ...apiProject.media[0], id: "managed-contain", sourceType: "managed", src: "/api/v1/media/example/display", presentation: "contain" };
  const managedDefault = { ...apiProject.media[0], id: "managed-default", sourceType: "managed", src: "/api/v1/media/another/display" };
  const [project] = mapApiProjectsResponse({ data: [{ ...apiProject, media: [managedContain, managedDefault] }], meta: { locale } }, { locale, fallbackProjects, apiBaseUrl: productionApiBaseUrl });
  assert.equal(project.media[0].presentation, "contain");
  assert.equal(project.media[0].imageClassName, "project-card__image project-card__image--contain");
  assert.equal(project.media[1].presentation, "cover");
  assert.equal(project.media[1].imageClassName, "project-card__image");
});

test("mapper rejects unknown presentation metadata before it can become a CSS class", () => {
  assert.throws(
    () => mapApiProjectsResponse({ data: [{ ...apiProject, media: [{ ...apiProject.media[0], presentation: "foodai-only" }] }], meta: { locale } }, { locale, fallbackProjects, apiBaseUrl: productionApiBaseUrl }),
    ProjectContractError,
  );
});

test("mapper groups API media by explicit galleryKind without static Bradbury ids", () => {
  const desktop = { ...apiProject.media[0], id: "managed-desktop", galleryKind: "desktop", sortOrder: 10 };
  const [project] = mapApiProjectsResponse({ data: [{ ...apiProject, media: [desktop, apiProject.media[0]] }], meta: { locale } }, { locale, fallbackProjects, apiBaseUrl: productionApiBaseUrl });
  assert.deepEqual(project.galleryGroups.map((group) => group.id), ["mobile", "desktop"]);
  assert.throws(() => mapApiProjectsResponse({ data: [{ ...apiProject, media: [{ ...apiProject.media[0], galleryKind: "other" }] }], meta: { locale } }, { locale, fallbackProjects, apiBaseUrl: productionApiBaseUrl }), ProjectContractError);
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
