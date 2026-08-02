import { legacySaveProjectRequestSchema, projectDraftContentSchema, projectPublishableContentSchema, type ProjectDraftContent } from "../../../../contracts/project-contracts.js";
import { z } from "zod";
import { legacyGalleryKindByMediaId, legacyMediaOrientationByMediaId, projectGalleryKinds } from "../media/project-gallery-kind.js";
import { normalizeLegacyProjectContent } from "./legacy-project-content.js";
import { assertPublishableProjectLinks } from "./project-links.js";

export { projectDraftContentSchema, type ProjectDraftContent };

export function normalizeStoredProjectDraftContent(projectExternalKey: string, value: unknown): ProjectDraftContent {
  if (!value || typeof value !== "object" || !Array.isArray((value as { media?: unknown }).media)) return projectDraftContentSchema.parse(value);
  const content = normalizeLegacyProjectContent({ projectExternalKey, content: value }) as { media: Array<Record<string, unknown>> };
  for (const media of content.media) {
    if (media.galleryKind === undefined && media.sourceType === "legacy" && typeof media.id === "string") {
      const galleryKind = legacyGalleryKindByMediaId(media.id);
      if (galleryKind) media.galleryKind = galleryKind;
    }
    if (media.orientation === undefined && media.sourceType === "legacy" && typeof media.id === "string") {
      const orientation = legacyMediaOrientationByMediaId(media.id);
      if (orientation) media.orientation = orientation;
    }
  }
  try { return projectDraftContentSchema.parse(content); }
  catch (error) { throw Object.assign(error instanceof Error ? error : new Error("Stored project draft is invalid."), { code: "GALLERY_KIND_UNRESOLVED" }); }
}

// MVP publishes one bilingual project revision; locale-publication transport remains a future capability.
export const saveDraftSchema = legacySaveProjectRequestSchema;
export const publishSchema = z.object({ expectedDraftRevisionId: z.string().uuid(), confirmation: z.literal(true) });

export function assertPublishable(content: ProjectDraftContent): void {
  assertPublishableProjectLinks(content.links);
  if (!content.translations.ru.displayType) throw new Error("Missing required translations.ru.displayType publication content.");
  if (!content.translations.en.displayType) throw new Error("Missing required translations.en.displayType publication content.");
  if (!content.features.length) throw new Error("Missing required features publication content.");
  for (const [index, feature] of content.features.entries()) for (const localeName of ["ru", "en"] as const) if (!feature.text[localeName]) throw new Error(`Missing required features.${index}.text.${localeName} publication content.`);
  for (const [index, note] of content.notes.entries()) for (const localeName of ["ru", "en"] as const) if (!note.text[localeName]) throw new Error(`Missing required notes.${index}.text.${localeName} publication content.`);
  for (const localeName of ["en", "ru"] as const) {
    const value = content.translations[localeName];
    if (!value.title || !value.description || !value.role || !value.statusLabel) throw new Error(`Missing required ${localeName.toUpperCase()} publication content.`);
  }
  for (const asset of content.media) {
    for (const localeName of ["en", "ru"] as const) {
      if (!asset.translations[localeName].alt || !asset.translations[localeName].ariaLabel) throw new Error(`Missing ${localeName.toUpperCase()} media accessibility text.`);
    }
  }
  projectPublishableContentSchema.parse(content);
}
