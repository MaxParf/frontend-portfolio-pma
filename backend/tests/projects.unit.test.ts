import assert from "node:assert/strict";
import test from "node:test";
import { mapProjectToPublicDto } from "../src/modules/projects/project.mapper.js";
import { ProjectService } from "../src/modules/projects/project.service.js";
import { frontendProjectSchema } from "../src/modules/projects/project.schemas.js";
import { loadFrontendProjects } from "../scripts/seed-projects.js";
import { mediaOrientationFromDimensions, MEDIA_ORIENTATIONS } from "../src/modules/media/media-orientation.js";
import { projectDraftContentSchema } from "../src/modules/admin-projects/project-draft.schemas.js";

test("locale validation accepts en and ru with en default", () => {
  const service = new ProjectService({
    findPublished: async () => [],
    findPublishedBySlug: async () => null,
  });

  assert.equal(service.parseLocale(undefined), "en");
  assert.equal(service.parseLocale("ru"), "ru");
  assert.throws(() => service.parseLocale("de"));
});

test("project DTO mapper hides database fields and preserves public contract", () => {
  const dto = mapProjectToPublicDto({
    externalKey: "project-bradbury",
    slug: "project-bradbury",
    galleryId: "bradbury",
    status: "published",
    sortOrder: 20,
    type: "quiet-social-platform",
    title: "Project Bradbury",
    subtitle: null,
    description: "Description",
    role: "Developer",
    statusLabel: "Closed Alpha",
    primaryUrl: "https://prbdbr.com/",
    primaryLinkType: "website",
    primaryActionLabel: "Live platform",
    secondaryUrl: null,
    secondaryLinkType: null,
    secondaryActionLabel: null,
    technologies: ["React", "TypeScript"],
    media: [
      {
        id: "00000000-0000-4000-8000-000000000001",
        externalKey: "project-bradbury:mobile-home",
        path: "images/projects/bradbury/mobile_home_feed.webp",
        sourceType: "legacy",
        role: "gallery",
        sortOrder: 10,
        altText: "Mobile feed",
        ariaLabel: "Open screenshot",
      },
    ],
  });

  assert.deepEqual(Object.keys(dto), [
    "id",
    "slug",
    "galleryId",
    "status",
    "sortOrder",
    "type",
    "title",
    "subtitle",
    "description",
    "role",
    "statusLabel",
    "technologies",
    "links",
    "media",
  ]);
  assert.equal(dto.id, "project-bradbury");
  assert.equal(dto.links.primary?.label, "Live platform");
  assert.equal(dto.links.secondary, null);
  assert.equal(dto.media[0]?.src, "images/projects/bradbury/mobile_home_feed.webp");
});

test("media orientation domain accepts only vertical and horizontal and classifies square as horizontal", () => {
  assert.deepEqual(MEDIA_ORIENTATIONS, ["vertical", "horizontal"]);
  assert.equal(mediaOrientationFromDimensions(600, 1200), "vertical");
  assert.equal(mediaOrientationFromDimensions(1200, 600), "horizontal");
  assert.equal(mediaOrientationFromDimensions(800, 800), "horizontal");
  assert.equal(mediaOrientationFromDimensions(0, 800), null);
});

test("draft media requires a valid orientation and unique order within it", () => {
  const base = {
    slug: "orientation-test", galleryId: "orientation-test", sortOrder: 10, projectType: null,
    dates: { startedAt: null, endedAt: null, ongoing: false },
    translations: { en: { title: "Test", subtitle: null, description: "Test", role: "Test", statusLabel: "Test", primaryActionLabel: null, secondaryActionLabel: null, technologiesTitle: null }, ru: { title: "Тест", subtitle: null, description: "Тест", role: "Тест", statusLabel: "Тест", primaryActionLabel: null, secondaryActionLabel: null, technologiesTitle: null } },
    technologies: [], links: { primary: null, secondary: null },
    media: [{ id: "legacy-image", sourceType: "legacy", src: "images/test.webp", role: "gallery", orientation: "vertical", sortOrder: 10, translations: { en: { alt: "Test", ariaLabel: "Open" }, ru: { alt: "Тест", ariaLabel: "Открыть" } } }],
  };
  assert.equal(projectDraftContentSchema.parse(base).media[0]?.orientation, "vertical");
  assert.throws(() => projectDraftContentSchema.parse({ ...base, media: [{ ...base.media[0], orientation: "square" }] }));
  assert.throws(() => projectDraftContentSchema.parse({ ...base, media: [{ ...base.media[0], orientation: undefined }] }));
  assert.doesNotThrow(() => projectDraftContentSchema.parse({ ...base, media: [...base.media, { ...base.media[0], id: "second", orientation: "horizontal" }] }));
  assert.throws(() => projectDraftContentSchema.parse({ ...base, media: [...base.media, { ...base.media[0], id: "second" }] }));
});

test("seed adapter validates current frontend project model", async () => {
  const projects = await loadFrontendProjects();
  assert.equal(projects.length, 3);
  assert.deepEqual(
    projects.map((project) => project.id),
    ["construction-management-control-center", "project-bradbury", "foodai"],
  );
});

test("invalid frontend project data is rejected", () => {
  const invalidProject = {
    id: "",
    slug: "broken",
    galleryId: "broken",
    status: "published",
    sortOrder: 10,
    meta: { ongoing: true },
    translations: {},
    technologies: [],
    links: [],
    media: [],
  };

  assert.throws(() => frontendProjectSchema.parse(invalidProject));
});
