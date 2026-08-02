import { legacyProjectContentFixtures } from "./project-content-fixtures.js";
import { convertLegacyProjectLinks, LEGACY_LINK_CONVERSION_ERROR } from "./project-links.js";

export const LEGACY_PROJECT_CONTENT_UNSUPPORTED = "LEGACY_PROJECT_CONTENT_UNSUPPORTED";

export function normalizeLegacyProjectContent({ projectExternalKey, content }: { projectExternalKey: string; content: unknown }): unknown {
  if (!content || typeof content !== "object" || Array.isArray(content)) return content;
  const source = content as Record<string, unknown>;
  const translations = source.translations;
  const hasMissingDisplayType = Boolean(translations && typeof translations === "object" && !Array.isArray(translations) && ["ru", "en"].some((locale) => {
    const translation = (translations as Record<string, unknown>)[locale];
    return translation && typeof translation === "object" && !Array.isArray(translation) && !("displayType" in translation);
  }));
  const normalized = structuredClone(source) as Record<string, unknown>;
  const needsFixture = hasMissingDisplayType || !("features" in source) || !("notes" in source);
  if (needsFixture) {
    const fixture = legacyProjectContentFixtures[projectExternalKey];
    if (!fixture) throw Object.assign(new Error(`Legacy project content cannot be normalized for ${projectExternalKey}.`), { code: LEGACY_PROJECT_CONTENT_UNSUPPORTED });
    if (normalized.translations && typeof normalized.translations === "object" && !Array.isArray(normalized.translations)) {
    const localized = normalized.translations as Record<string, unknown>;
    for (const locale of ["ru", "en"] as const) {
      const value = localized[locale];
      if (value && typeof value === "object" && !Array.isArray(value) && !("displayType" in value)) localized[locale] = { ...(value as Record<string, unknown>), displayType: fixture.displayType[locale] };
    }
    }
    if (!("features" in normalized)) normalized.features = structuredClone(fixture.features);
    if (!("notes" in normalized)) normalized.notes = structuredClone(fixture.notes);
  }
  if (Array.isArray(normalized.links)) {
    if (normalized.translations && typeof normalized.translations === "object" && !Array.isArray(normalized.translations)) for (const locale of ["ru", "en"]) {
      const translation = (normalized.translations as Record<string, unknown>)[locale];
      if (translation && typeof translation === "object" && !Array.isArray(translation)) { delete (translation as Record<string, unknown>).primaryActionLabel; delete (translation as Record<string, unknown>).secondaryActionLabel; }
    }
    return normalized;
  }
  if (!normalized.links || typeof normalized.links !== "object") return normalized;
  const translationsValue = normalized.translations;
  if (!translationsValue || typeof translationsValue !== "object" || Array.isArray(translationsValue)) return normalized;
  try {
    normalized.links = convertLegacyProjectLinks({ projectExternalKey, legacyLinks: normalized.links as { primary?: { href?: string } | null; secondary?: { href?: string } | null }, translations: translationsValue as { ru: { primaryActionLabel?: string | null; secondaryActionLabel?: string | null }; en: { primaryActionLabel?: string | null; secondaryActionLabel?: string | null } } });
    for (const locale of ["ru", "en"]) {
      const translation = (normalized.translations as Record<string, unknown>)[locale];
      if (translation && typeof translation === "object" && !Array.isArray(translation)) {
        delete (translation as Record<string, unknown>).primaryActionLabel;
        delete (translation as Record<string, unknown>).secondaryActionLabel;
      }
    }
  } catch (error) {
    if ((error as { code?: string }).code === LEGACY_LINK_CONVERSION_ERROR) throw error;
    throw error;
  }
  return normalized;
}
