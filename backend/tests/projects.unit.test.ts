import assert from "node:assert/strict";
import test from "node:test";
import { mapProjectToPublicDto } from "../src/modules/projects/project.mapper.js";
import { ProjectService } from "../src/modules/projects/project.service.js";
import { frontendProjectSchema } from "../src/modules/projects/project.schemas.js";
import { loadFrontendProjects } from "../scripts/seed-projects.js";
import { mediaOrientationFromDimensions, MEDIA_ORIENTATIONS } from "../src/modules/media/media-orientation.js";
import { MEDIA_PRESENTATIONS } from "../src/modules/media/media-presentation.js";
import { assertPublishable, projectDraftContentSchema } from "../src/modules/admin-projects/project-draft.schemas.js";

function normalizedDraft(links: unknown) {
  return {
    slug: "links-test", galleryId: "links-test", sortOrder: 10, projectType: null,
    dates: { startedAt: null, endedAt: null, ongoing: false },
    translations: { en: { title: "Test", subtitle: null, description: "Test", role: "Test", statusLabel: "Test", technologiesTitle: null, displayType: "Test" }, ru: { title: "Тест", subtitle: null, description: "Тест", role: "Тест", statusLabel: "Тест", technologiesTitle: null, displayType: "Тест" } },
    technologies: [], features: [{ id: "30000000-0000-4000-8000-000000000001", sortOrder: 10, text: { ru: "Функция", en: "Feature" } }], notes: [], media: [], links,
  };
}

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
    displayType: "Quiet social platform",
    links: [
      { id: "00000000-0000-4000-8000-000000000010", url: "https://prbdbr.com/", label: "Live platform" },
      { id: "00000000-0000-4000-8000-000000000011", url: "https://example.com/case-study", label: "Case study" },
      { id: "00000000-0000-4000-8000-000000000012", url: "https://example.com/docs", label: "Documentation" },
    ],
    technologies: ["React", "TypeScript"],
    features: ["First feature"],
    notes: [],
    media: [
      {
        id: "00000000-0000-4000-8000-000000000001",
        externalKey: "project-bradbury:mobile-home",
        path: "images/projects/bradbury/mobile_home_feed.webp",
        sourceType: "legacy",
        role: "gallery",
        orientation: "vertical",
        galleryKind: "mobile",
        presentation: "contain",
        sortOrder: 10,
        width: 1206,
        height: 2622,
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
    "displayType",
    "technologies",
    "features",
    "notes",
    "links",
    "media",
  ]);
  assert.equal(dto.id, "project-bradbury");
  assert.deepEqual(dto.links, [
    { id: "00000000-0000-4000-8000-000000000010", url: "https://prbdbr.com/", label: "Live platform" },
    { id: "00000000-0000-4000-8000-000000000011", url: "https://example.com/case-study", label: "Case study" },
    { id: "00000000-0000-4000-8000-000000000012", url: "https://example.com/docs", label: "Documentation" },
  ]);
  assert.equal(dto.media[0]?.src, "images/projects/bradbury/mobile_home_feed.webp");
  assert.equal(dto.media[0]?.presentation, "contain");
  assert.deepEqual(dto.features, ["First feature"]);
  assert.deepEqual(dto.notes, []);
});

test("media orientation domain accepts only vertical and horizontal and classifies square as horizontal", () => {
  assert.deepEqual(MEDIA_ORIENTATIONS, ["vertical", "horizontal"]);
  assert.equal(mediaOrientationFromDimensions(600, 1200), "vertical");
  assert.equal(mediaOrientationFromDimensions(1200, 600), "horizontal");
  assert.equal(mediaOrientationFromDimensions(800, 800), "horizontal");
  assert.equal(mediaOrientationFromDimensions(0, 800), null);
});

test("media presentation domain accepts only cover and contain with cover as the draft default", () => {
  assert.deepEqual(MEDIA_PRESENTATIONS, ["cover", "contain"]);
  const content = projectDraftContentSchema.parse({
    slug: "presentation-test", galleryId: "presentation-test", sortOrder: 10, projectType: null,
    dates: { startedAt: null, endedAt: null, ongoing: false },
    translations: { en: { title: "Test", subtitle: null, description: "Test", role: "Test", statusLabel: "Test", technologiesTitle: null }, ru: { title: "Тест", subtitle: null, description: "Тест", role: "Тест", statusLabel: "Тест", technologiesTitle: null } },
    technologies: [], links: [],
    media: [{ id: "legacy-image", sourceType: "legacy", src: "images/test.webp", role: "gallery", orientation: "vertical", galleryKind: "mobile", sortOrder: 10, translations: { en: { alt: "Test", ariaLabel: "Open" }, ru: { alt: "Тест", ariaLabel: "Открыть" } } }],
  });
  assert.equal(content.media[0]?.presentation, "cover");
  assert.throws(() => projectDraftContentSchema.parse({ ...content, media: [{ ...content.media[0]!, presentation: "unsafe" }] }));
});

test("draft media requires a valid orientation, gallery kind, and unique order within its gallery", () => {
  const base = {
    slug: "orientation-test", galleryId: "orientation-test", sortOrder: 10, projectType: null,
    dates: { startedAt: null, endedAt: null, ongoing: false },
    translations: { en: { title: "Test", subtitle: null, description: "Test", role: "Test", statusLabel: "Test", technologiesTitle: null }, ru: { title: "Тест", subtitle: null, description: "Тест", role: "Тест", statusLabel: "Тест", technologiesTitle: null } },
    technologies: [], links: [],
    media: [{ id: "legacy-image", sourceType: "legacy", src: "images/test.webp", role: "gallery", orientation: "vertical", galleryKind: "mobile", sortOrder: 10, translations: { en: { alt: "Test", ariaLabel: "Open" }, ru: { alt: "Тест", ariaLabel: "Открыть" } } }],
  };
  assert.equal(projectDraftContentSchema.parse(base).media[0]?.orientation, "vertical");
  assert.throws(() => projectDraftContentSchema.parse({ ...base, media: [{ ...base.media[0], orientation: "square" }] }));
  assert.throws(() => projectDraftContentSchema.parse({ ...base, media: [{ ...base.media[0], orientation: undefined }] }));
  assert.throws(() => projectDraftContentSchema.parse({ ...base, media: [{ ...base.media[0], galleryKind: "tablet" }] }));
  assert.doesNotThrow(() => projectDraftContentSchema.parse({ ...base, media: [...base.media, { ...base.media[0], id: "second", orientation: "horizontal", galleryKind: "desktop" }] }));
  assert.throws(() => projectDraftContentSchema.parse({ ...base, media: [...base.media, { ...base.media[0], id: "second" }] }));
});

test("current draft schema accepts normalized permissive links and rejects fixed slots with exact paths", () => {
  const links = [{ id: "30000000-0000-4000-8000-000000000010", url: "not-yet-a-url", sortOrder: 10, label: { ru: "", en: "" } }, { id: "30000000-0000-4000-8000-000000000011", url: "", sortOrder: 20, label: { ru: "RU", en: "" } }];
  assert.deepEqual(projectDraftContentSchema.parse(normalizedDraft(links)).links, links);
  const fixed = projectDraftContentSchema.safeParse(normalizedDraft({ primary: null, secondary: null }));
  assert.equal(fixed.success, false); if (!fixed.success) assert.deepEqual(fixed.error.issues[0]?.path, ["links"]);
  const duplicateId = projectDraftContentSchema.safeParse(normalizedDraft([links[0], { ...links[0], sortOrder: 20 }]));
  assert.equal(duplicateId.success, false); if (!duplicateId.success) assert.deepEqual(duplicateId.error.issues.at(-1)?.path, ["links", 1, "id"]);
  const duplicateOrder = projectDraftContentSchema.safeParse(normalizedDraft([links[0], { ...links[1], id: "30000000-0000-4000-8000-000000000012", sortOrder: 10 }]));
  assert.equal(duplicateOrder.success, false); if (!duplicateOrder.success) assert.deepEqual(duplicateOrder.error.issues.at(-1)?.path, ["links", 1, "sortOrder"]);
});

test("publish validation accepts arbitrary normalized links and reports link paths", () => {
  const links = [
    { id: "30000000-0000-4000-8000-000000000020", url: "https://example.com/a", sortOrder: 10, label: { ru: "Открыть", en: "Open" } },
    { id: "30000000-0000-4000-8000-000000000021", url: "https://example.com/b", sortOrder: 20, label: { ru: "Документы", en: "Docs" } },
    { id: "30000000-0000-4000-8000-000000000022", url: "https://example.com/c", sortOrder: 30, label: { ru: "Ещё", en: "More" } },
  ];
  assert.doesNotThrow(() => assertPublishable(projectDraftContentSchema.parse(normalizedDraft(links))));
  for (const [value, message] of [
    [[], "Missing required links"],
    [[{ ...links[0], url: " " }], "links.0.url"],
    [[{ ...links[0], url: "not a url" }], "links.0.url"],
    [[{ ...links[0], url: "ftp://example.com" }], "links.0.url"],
    [[{ ...links[0], label: { ...links[0].label, ru: "" } }], "links.0.label.ru"],
    [[{ ...links[0], label: { ...links[0].label, en: "" } }], "links.0.label.en"],
    [[links[0], { ...links[1], url: links[0].url }], "links.1.url"],
  ] as const) assert.throws(() => assertPublishable(projectDraftContentSchema.parse(normalizedDraft(value))), new RegExp(message));
});

test("an empty title is valid while editing a draft but is rejected for publication", () => {
  const links = [{ id: "30000000-0000-4000-8000-000000000099", url: "https://example.com", sortOrder: 10, label: { ru: "Открыть", en: "Open" } }];
  const draft = projectDraftContentSchema.parse({
    ...normalizedDraft(links),
    translations: {
      en: { ...normalizedDraft(links).translations.en, title: "" },
      ru: { ...normalizedDraft(links).translations.ru, title: "" },
    },
  });
  assert.throws(() => assertPublishable(draft), /Missing required EN publication content/);
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
