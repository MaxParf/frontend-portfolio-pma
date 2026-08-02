import assert from "node:assert/strict";
import test from "node:test";
import { LEGACY_PROJECT_CONTENT_UNSUPPORTED, normalizeLegacyProjectContent } from "../src/modules/admin-projects/legacy-project-content.js";
import { normalizeStoredProjectDraftContent } from "../src/modules/admin-projects/project-draft.schemas.js";
import { LEGACY_LINK_CONVERSION_ERROR } from "../src/modules/admin-projects/project-links.js";

function legacyContent() {
  return { translations: { ru: { title: "RU" }, en: { title: "EN" } }, media: [] };
}

test("known legacy content is completed without mutating its historical object", () => {
  const content = legacyContent();
  const normalized = normalizeLegacyProjectContent({ projectExternalKey: "project-bradbury", content }) as any;
  assert.equal("features" in content, false);
  assert.equal(normalized.translations.ru.displayType, "Тихая социальная платформа");
  assert.equal(normalized.features.length, 5);
  assert.equal(normalized.notes.length, 2);
});

test("compatibility preserves already saved content and only fills missing fields", () => {
  const content = { ...legacyContent(), translations: { ru: { title: "RU", displayType: "Edited RU" }, en: { title: "EN" } }, features: [{ id: "11111111-1111-4111-a111-111111111111", sortOrder: 10, text: { ru: "Edited", en: "Edited" } }] };
  const normalized = normalizeLegacyProjectContent({ projectExternalKey: "project-bradbury", content }) as any;
  assert.equal(normalized.translations.ru.displayType, "Edited RU");
  assert.equal(normalized.features[0].text.ru, "Edited");
  assert.equal(normalized.notes.length, 2);
});

test("explicit empty arrays are current values and are not treated as legacy omissions", () => {
  const content = { ...legacyContent(), features: [], notes: [] };
  const normalized = normalizeLegacyProjectContent({ projectExternalKey: "foodai", content }) as any;
  assert.deepEqual(normalized.features, []);
  assert.deepEqual(normalized.notes, []);
});

test("unknown legacy project fails with a stable controlled domain code", () => {
  assert.throws(() => normalizeLegacyProjectContent({ projectExternalKey: "unknown-project", content: legacyContent() }), (error: any) => error?.code === LEGACY_PROJECT_CONTENT_UNSUPPORTED);
});

test("legacy fixed slots convert deterministically while arrays and explicit empties remain current values", () => {
  const legacy = { ...legacyContent(), links: { primary: { href: "https://example.com/project" }, secondary: { href: "https://example.com/docs" } }, translations: { ru: { title: "RU", primaryActionLabel: "Открыть", secondaryActionLabel: "Документы" }, en: { title: "EN", primaryActionLabel: "Open", secondaryActionLabel: "Docs" } } };
  const normalized = normalizeLegacyProjectContent({ projectExternalKey: "project-bradbury", content: legacy }) as any;
  assert.deepEqual(normalized.links.map((link: any) => [link.id, link.sortOrder]), [["92000000-0000-4000-8000-000000000001", 10], ["92000000-0000-4000-8000-000000000002", 20]]);
  assert.equal("links" in legacy && Array.isArray((legacy as any).links), false);
  const current = { ...legacyContent(), features: [], notes: [], links: [] };
  assert.deepEqual((normalizeLegacyProjectContent({ projectExternalKey: "foodai", content: current }) as any).links, []);
  const array = [{ id: "40000000-0000-4000-8000-000000000001", url: "https://example.com", sortOrder: 10, label: { ru: "RU", en: "EN" } }];
  assert.deepEqual((normalizeLegacyProjectContent({ projectExternalKey: "foodai", content: { ...current, links: array } }) as any).links, array);
});

test("partial or unknown legacy slots fail with the controlled compatibility error", () => {
  const partial = { ...legacyContent(), links: { primary: { href: "https://example.com" }, secondary: null }, translations: { ru: { title: "RU", primaryActionLabel: "" }, en: { title: "EN", primaryActionLabel: "Open" } } };
  assert.throws(() => normalizeLegacyProjectContent({ projectExternalKey: "project-bradbury", content: partial }), (error: any) => error?.code === LEGACY_LINK_CONVERSION_ERROR);
  const unknown = { ...partial, translations: { ru: { title: "RU", primaryActionLabel: "RU" }, en: { title: "EN", primaryActionLabel: "EN" } } };
  assert.throws(() => normalizeLegacyProjectContent({ projectExternalKey: "unknown-project", content: unknown }), (error: any) => error?.code === LEGACY_LINK_CONVERSION_ERROR || error?.code === LEGACY_PROJECT_CONTENT_UNSUPPORTED);
});

test("stored CMCC revision created before media metadata is normalized for the current editor contract", () => {
  const content = normalizeStoredProjectDraftContent("construction-management-control-center", {
    slug: "construction-management-control-center", galleryId: "cmca", sortOrder: 10, projectType: "internal-company-management-system",
    dates: { startedAt: null, endedAt: null, ongoing: true }, technologies: [],
    translations: {
      ru: { title: "RU", subtitle: null, description: "RU", role: "RU", statusLabel: "RU", technologiesTitle: null, primaryActionLabel: "GitHub", secondaryActionLabel: "Демо" },
      en: { title: "EN", subtitle: null, description: "EN", role: "EN", statusLabel: "EN", technologiesTitle: null, primaryActionLabel: "GitHub", secondaryActionLabel: "Demo" },
    },
    links: { primary: { href: "https://example.test/repository", type: "repository" }, secondary: { href: "#contact", type: "demo-request" } },
    media: [{ id: "construction-management-control-center:dashboard", sourceType: "legacy", src: "images/dashboard.png", role: "gallery", sortOrder: 10, translations: { ru: { alt: "RU", ariaLabel: "RU" }, en: { alt: "EN", ariaLabel: "EN" } } }],
  });

  assert.equal(content.media[0]?.orientation, "horizontal");
  assert.equal(content.media[0]?.galleryKind, "desktop");
  assert.equal(content.media[0]?.presentation, "cover");
  assert.equal(content.translations.en.displayType, "Internal company management system");
  assert.equal(Array.isArray(content.links), true);
  assert.equal(content.features.length, 9);
});
