import { z } from "zod";

/**
 * Transport contracts shared by the API and CMS.  JSON objects are strict so
 * a legacy payload cannot quietly become an editable CMS value.
 */
export const projectLocaleSchema = z.enum(["en", "ru"]);
export type ProjectLocale = z.infer<typeof projectLocaleSchema>;
/** @deprecated Use ProjectLocale; kept for existing public contracts. */
export const localeSchema = projectLocaleSchema;
export type Locale = ProjectLocale;

export const projectStatusSchema = z.enum(["draft", "published", "hidden", "archived", "soft_deleted"]);
export type ProjectStatus = z.infer<typeof projectStatusSchema>;

const text = z.string().trim().max(20_000);
const requiredText = text.min(1);
const localizedText = z.object({ ru: text, en: text }).strict();
const mediaTranslations = z.object({
  en: z.object({ alt: text, ariaLabel: text }).strict(),
  ru: z.object({ alt: text, ariaLabel: text }).strict(),
}).strict();
const draftLocaleSchema = z.object({
  title: text,
  subtitle: text.nullable(),
  description: text,
  role: text,
  statusLabel: text,
  technologiesTitle: text.nullable(),
  displayType: text.max(240).default(""),
}).strict();

const linkSchema = z.object({
  id: z.string().uuid(),
  url: z.string().trim().max(2048),
  sortOrder: z.number().int().min(0),
  label: localizedText,
}).strict();
const contentItemSchema = z.object({
  id: z.string().uuid(),
  sortOrder: z.number().int().min(0),
  text: localizedText,
}).strict();
const mediaBaseSchema = z.object({
  role: requiredText.max(80),
  orientation: z.enum(["vertical", "horizontal"]),
  galleryKind: z.enum(["mobile", "desktop"]),
  presentation: z.enum(["cover", "contain"]).default("cover"),
  sortOrder: z.number().int().min(0),
  translations: mediaTranslations,
}).strict();

export const projectDraftContentSchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120),
  galleryId: z.string().trim().min(1).max(120),
  sortOrder: z.number().int().min(0).max(10_000),
  projectType: text.nullable(),
  dates: z.object({
    startedAt: z.string().date().nullable(),
    endedAt: z.string().date().nullable(),
    ongoing: z.boolean(),
  }).strict().superRefine((dates, ctx) => {
    if (dates.startedAt && dates.endedAt && dates.startedAt > dates.endedAt) ctx.addIssue({ code: "custom", message: "End date cannot precede start date." });
    if (dates.ongoing && dates.endedAt) ctx.addIssue({ code: "custom", message: "Ongoing projects cannot have an end date." });
  }),
  translations: z.object({ en: draftLocaleSchema, ru: draftLocaleSchema }).strict(),
  technologies: z.array(z.object({ slug: z.string().trim().min(1).max(120), name: requiredText, sortOrder: z.number().int().min(0) }).strict()).max(40),
  links: z.array(linkSchema).max(20),
  features: z.array(contentItemSchema).max(50).default([]),
  notes: z.array(contentItemSchema).max(50).default([]),
  media: z.array(z.discriminatedUnion("sourceType", [
    mediaBaseSchema.extend({ id: z.string().trim().min(1).max(240), sourceType: z.literal("legacy"), src: z.string().trim().min(1).max(1024) }),
    mediaBaseSchema.extend({ id: z.string().uuid(), sourceType: z.literal("managed"), assetId: z.string().uuid(), width: z.number().int().positive().optional(), height: z.number().int().positive().optional() }),
  ])).max(50),
}).strict().superRefine((content, ctx) => {
  const unique = (items: Array<{ id: string; sortOrder: number }>, name: string, within?: (item: typeof items[number]) => string) => {
    const ids = new Set<string>(); const orders = new Set<string>();
    for (const [index, item] of items.entries()) {
      if (ids.has(item.id)) ctx.addIssue({ code: "custom", path: [name, index, "id"], message: `${name} cannot contain duplicate ids.` });
      ids.add(item.id);
      const key = `${within?.(item) ?? ""}:${item.sortOrder}`;
      if (orders.has(key)) ctx.addIssue({ code: "custom", path: [name, index, "sortOrder"], message: `${name} sortOrder must be unique.` });
      orders.add(key);
    }
  };
  unique(content.links, "links"); unique(content.features, "features"); unique(content.notes, "notes");
  const mediaIds = new Set<string>(); const mediaOrders = new Set<string>();
  for (const [index, item] of content.media.entries()) {
    if (mediaIds.has(item.id)) ctx.addIssue({ code: "custom", path: ["media", index, "id"], message: "media cannot contain duplicate ids." });
    mediaIds.add(item.id);
    const key = `${item.galleryKind}:${item.sortOrder}`;
    if (mediaOrders.has(key)) ctx.addIssue({ code: "custom", path: ["media", index, "sortOrder"], message: "media sortOrder must be unique within galleryKind." });
    mediaOrders.add(key);
  }
  if (new Set(content.technologies.map((item) => item.slug)).size !== content.technologies.length) ctx.addIssue({ code: "custom", path: ["technologies"], message: "technologies cannot contain duplicates." });
});
export type ProjectDraftContent = z.infer<typeof projectDraftContentSchema>;

const expectedLocalePublicationStateSchema = z.object({ publicationGeneration: z.number().int().nonnegative(), publishedRevisionId: z.string().uuid().nullable() }).strict();
export const legacySaveProjectRequestSchema = z.object({ publicationCapability: z.literal("legacy"), baseRevisionId: z.string().uuid().nullable(), expectedDraftRevisionId: z.string().uuid().nullable(), content: projectDraftContentSchema }).strict();
export const localeSaveProjectRequestSchema = z.object({ publicationCapability: z.literal("locale"), baseRevisionId: z.string().uuid().nullable(), expectedEditorRevisionId: z.string().uuid(), expectedPublicationState: z.object({ ru: expectedLocalePublicationStateSchema, en: expectedLocalePublicationStateSchema }).strict(), content: projectDraftContentSchema }).strict();
export const saveProjectRequestSchema = z.discriminatedUnion("publicationCapability", [legacySaveProjectRequestSchema, localeSaveProjectRequestSchema]);
export type SaveProjectRequest = z.infer<typeof saveProjectRequestSchema>;

/** A self-contained public value for one locale, never a pointer to editor head. */
export const localePublicationSnapshotSchema = z.object({
  locale: localeSchema,
  slug: z.string().min(1), galleryId: z.string().min(1), sortOrder: z.number().int(), projectType: text.nullable(), dates: z.object({ startedAt: z.string().date().nullable(), endedAt: z.string().date().nullable(), ongoing: z.boolean() }).strict(),
  translation: draftLocaleSchema,
  technologies: z.array(z.object({ slug: z.string().min(1), name: requiredText, sortOrder: z.number().int().min(0) }).strict()),
  features: z.array(z.object({ id: z.string().uuid(), sortOrder: z.number().int().min(0), text: requiredText }).strict()),
  notes: z.array(z.object({ id: z.string().uuid(), sortOrder: z.number().int().min(0), text: requiredText }).strict()),
  links: z.array(z.object({ id: z.string().uuid(), url: z.string().min(1), sortOrder: z.number().int().min(0), label: requiredText }).strict()),
  media: z.array(z.object({ id: z.string().min(1), assetId: z.string().uuid(), sourceType: z.enum(["legacy", "managed"]), externalKey: z.string().min(1), path: z.string().nullable(), role: requiredText, orientation: z.enum(["vertical", "horizontal"]), galleryKind: z.enum(["mobile", "desktop"]), presentation: z.enum(["cover", "contain"]), sortOrder: z.number().int().min(0), width: z.number().int().positive().nullable(), height: z.number().int().positive().nullable(), alt: requiredText, ariaLabel: requiredText }).strict()),
}).strict();
export type LocalePublicationSnapshot = z.infer<typeof localePublicationSnapshotSchema>;

export const localePublicationStateSchema = z.object({
  status: z.enum(["not_published", "published"]),
  publishedRevisionId: z.string().uuid().nullable(), publishedAt: z.string().datetime().nullable(), publicationGeneration: z.number().int().nonnegative(),
  hasUnpublishedChanges: z.boolean(), isPublishable: z.boolean(),
}).strict().superRefine((value, context) => {
  if (value.status === "published" && (!value.publishedRevisionId || !value.publishedAt)) context.addIssue({ code: "custom", message: "Published locale requires a revision and timestamp." });
  if (value.status === "not_published" && (value.publishedRevisionId || value.publishedAt)) context.addIssue({ code: "custom", message: "Unpublished locale cannot have publication metadata." });
});
export type LocalePublicationState = z.infer<typeof localePublicationStateSchema>;
export const projectPublicationStateSchema = z.object({ ru: localePublicationStateSchema, en: localePublicationStateSchema }).strict();
export type ProjectPublicationState = z.infer<typeof projectPublicationStateSchema>;
export const publishProjectLocaleRequestSchema = z.object({ locale: projectLocaleSchema, expectedEditorRevisionId: z.string().uuid(), expectedLocalePublishedRevisionId: z.string().uuid().nullable(), expectedPublicationGeneration: z.number().int().nonnegative() }).strict();
export type PublishProjectLocaleRequest = z.infer<typeof publishProjectLocaleRequestSchema>;

/** The save shape remains intentionally more permissive than publication. */
export const projectPublishableContentSchema = projectDraftContentSchema.superRefine((content, ctx) => {
  for (const locale of ["ru", "en"] as const) {
    const value = content.translations[locale];
    for (const key of ["title", "description", "role", "statusLabel", "displayType"] as const) if (!value[key]) ctx.addIssue({ code: "custom", path: ["translations", locale, key], message: "Required for publication." });
  }
  if (!content.links.length) ctx.addIssue({ code: "custom", path: ["links"], message: "At least one link is required for publication." });
  if (!content.features.length) ctx.addIssue({ code: "custom", path: ["features"], message: "At least one feature is required for publication." });
  for (const [index, item] of content.links.entries()) if (!item.url || !item.label.ru || !item.label.en) ctx.addIssue({ code: "custom", path: ["links", index], message: "Complete localized link is required for publication." });
  for (const collection of ["features", "notes"] as const) for (const [index, item] of content[collection].entries()) if (!item.text.ru || !item.text.en) ctx.addIssue({ code: "custom", path: [collection, index], message: "Complete localized content is required for publication." });
  for (const [index, item] of content.media.entries()) for (const locale of ["ru", "en"] as const) if (!item.translations[locale].alt || !item.translations[locale].ariaLabel) ctx.addIssue({ code: "custom", path: ["media", index, "translations", locale], message: "Media accessibility text is required for publication." });
});

export const adminProjectListItemSchema = z.object({
  id: z.string().min(1), databaseId: z.string().uuid(), slug: z.string().min(1), galleryId: z.string().min(1),
  status: projectStatusSchema, sortOrder: z.number().int(), createdAt: z.string().datetime(), updatedAt: z.string().datetime(), publishedAt: z.string().datetime().nullable(),
  isPublished: z.boolean(), hasDraft: z.boolean(),
  translations: z.discriminatedUnion("status", [
    z.object({ status: z.literal("draft"), values: z.object({ en: z.object({ title: text }).partial(), ru: z.object({ title: text }).partial() }).partial() }).strict(),
    z.object({ status: z.enum(["published", "hidden", "archived", "soft_deleted"]), values: z.object({ en: z.object({ title: requiredText }).strict(), ru: z.object({ title: requiredText }).strict() }).strict() }).strict(),
  ]),
}).strict();
export type AdminProjectListItem = z.infer<typeof adminProjectListItemSchema>;

export const adminProjectRevisionDtoSchema = z.object({
  revisionId: z.string().uuid(), revisionNumber: z.number().int().positive(), revisionType: z.enum(["draft", "published"]), baseRevisionId: z.string().uuid().nullable(),
  content: projectDraftContentSchema, createdAt: z.string().datetime(), updatedAt: z.string().datetime(), publishedAt: z.string().datetime().nullable(),
}).strict();
export type AdminProjectRevisionDto = z.infer<typeof adminProjectRevisionDtoSchema>;

export const adminProjectEditorResponseSchema = z.object({
  project: z.object({ id: z.string().uuid(), externalKey: z.string().min(1), slug: z.string().min(1), status: projectStatusSchema }).strict(),
  published: adminProjectRevisionDtoSchema.nullable(),
  draft: adminProjectRevisionDtoSchema.nullable(),
  editable: z.object({ source: z.enum(["draft", "published"]), revisionId: z.string().uuid(), content: projectDraftContentSchema }).strict(),
  meta: z.object({ hasUnpublishedChanges: z.boolean() }).strict(),
  /** Only the explicit admin /published route may set this mode. */
  readOnly: z.boolean().optional(),
  localePublicationCapability: z.enum(["legacy", "locale"]),
  publicationState: projectPublicationStateSchema,
}).strict();
export type AdminProjectEditorResponse = z.infer<typeof adminProjectEditorResponseSchema>;
export const publishProjectLocaleResponseSchema = z.object({ editor: adminProjectEditorResponseSchema, publishedLocale: projectLocaleSchema, publicationRevisionId: z.string().uuid(), publicationGeneration: z.number().int().positive() }).strict();
export type PublishProjectLocaleResponse = z.infer<typeof publishProjectLocaleResponseSchema>;

export const publicProjectDtoSchema = z.object({
  id: z.string().min(1), slug: z.string().min(1), galleryId: z.string().min(1), status: z.literal("published"), sortOrder: z.number().int(), type: text.nullable(),
  title: requiredText, subtitle: text.nullable(), description: requiredText, role: requiredText, statusLabel: requiredText, displayType: requiredText,
  technologies: z.array(requiredText), features: z.array(requiredText), notes: z.array(requiredText),
  links: z.array(z.object({ id: z.string().uuid(), url: requiredText, label: requiredText }).strict()),
  media: z.array(z.object({ id: z.string().min(1), src: requiredText, thumbnailSrc: z.string().min(1).nullable(), sourceType: z.enum(["legacy", "managed"]), role: requiredText, orientation: z.enum(["vertical", "horizontal"]), galleryKind: z.enum(["mobile", "desktop"]), presentation: z.enum(["cover", "contain"]), sortOrder: z.number().int(), width: z.number().int().positive().nullable(), height: z.number().int().positive().nullable(), alt: requiredText, ariaLabel: requiredText }).strict()),
}).strict();
export type PublicProjectDto = z.infer<typeof publicProjectDtoSchema>;

export const publicProjectsResponseSchema = z.object({ data: z.array(publicProjectDtoSchema), meta: z.object({ locale: localeSchema, count: z.number().int() }).strict() }).strict();
export const publicProjectResponseSchema = z.object({ data: publicProjectDtoSchema, meta: z.object({ locale: localeSchema }).strict() }).strict();
export const adminProjectListResponseSchema = z.object({ data: z.array(adminProjectListItemSchema), meta: z.object({ count: z.number().int() }).strict() }).strict();
export const adminProjectEditorEnvelopeSchema = z.object({ data: adminProjectEditorResponseSchema }).strict();
export const adminProjectRevisionsEnvelopeSchema = z.object({ data: z.array(adminProjectRevisionDtoSchema) }).strict();
