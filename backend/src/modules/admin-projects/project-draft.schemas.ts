import { z } from "zod";
import { MEDIA_ORIENTATIONS } from "../media/media-orientation.js";

const text = z.string().trim().max(20_000);
const requiredText = text.min(1);
const nullableText = text.nullable();
const mediaOrientation = z.enum(MEDIA_ORIENTATIONS);
const mediaReferenceBase = z.object({
  role: requiredText.max(80),
  orientation: mediaOrientation,
  sortOrder: z.number().int().min(0),
  translations: z.object({ en: z.object({ alt: text, ariaLabel: text }), ru: z.object({ alt: text, ariaLabel: text }) }),
});
const locale = z.object({
  title: requiredText,
  subtitle: nullableText,
  description: text,
  role: text,
  statusLabel: text,
  primaryActionLabel: nullableText,
  secondaryActionLabel: nullableText,
  technologiesTitle: nullableText,
});

const safeUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => value.startsWith("#") || /^https?:\/\//i.test(value), "URL must use http(s) or an in-page anchor.")
  .refine((value) => !/^javascript:/i.test(value), "Unsafe URL protocol.");

export const projectDraftContentSchema = z
  .object({
    slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120),
    galleryId: z.string().trim().min(1).max(120),
    sortOrder: z.number().int().min(0).max(10_000),
    projectType: nullableText,
    dates: z
      .object({ startedAt: z.string().date().nullable(), endedAt: z.string().date().nullable(), ongoing: z.boolean() })
      .superRefine((dates, ctx) => {
        if (dates.startedAt && dates.endedAt && dates.endedAt < dates.startedAt) ctx.addIssue({ code: "custom", message: "End date cannot precede start date." });
        if (dates.ongoing && dates.endedAt) ctx.addIssue({ code: "custom", message: "Ongoing projects cannot have an end date." });
      }),
    translations: z.object({ en: locale, ru: locale }),
    technologies: z.array(z.object({ slug: z.string().trim().min(1).max(120), name: requiredText, sortOrder: z.number().int().min(0) })).max(40),
    links: z.object({
      primary: z.object({ href: safeUrl, type: requiredText.max(80) }).nullable(),
      secondary: z.object({ href: safeUrl, type: requiredText.max(80) }).nullable(),
    }),
    media: z.array(z.discriminatedUnion("sourceType", [
      mediaReferenceBase.extend({ id: z.string().trim().min(1).max(240), sourceType: z.literal("legacy"), src: z.string().trim().min(1).max(1024) }),
      mediaReferenceBase.extend({ id: z.string().uuid(), sourceType: z.literal("managed"), assetId: z.string().uuid() }),
    ])).max(50),
  })
  .superRefine((content, ctx) => {
    const technologySlugs = content.technologies.map((item) => item.slug);
    const mediaIds = content.media.map((item) => item.id);
    const mediaOrders = content.media.map((item) => `${item.orientation}:${item.sortOrder}`);
    if (new Set(technologySlugs).size !== technologySlugs.length) ctx.addIssue({ code: "custom", message: "technologies cannot contain duplicates." });
    if (new Set(mediaIds).size !== mediaIds.length) ctx.addIssue({ code: "custom", message: "media cannot contain duplicates." });
    if (new Set(mediaOrders).size !== mediaOrders.length) ctx.addIssue({ code: "custom", message: "media sortOrder must be unique within orientation." });
  });

export type ProjectDraftContent = z.infer<typeof projectDraftContentSchema>;

export const saveDraftSchema = z.object({ baseRevisionId: z.string().uuid(), expectedDraftRevisionId: z.string().uuid().nullable(), content: projectDraftContentSchema });
export const publishSchema = z.object({ expectedDraftRevisionId: z.string().uuid(), confirmation: z.literal(true) });

export function assertPublishable(content: ProjectDraftContent): void {
  for (const localeName of ["en", "ru"] as const) {
    const value = content.translations[localeName];
    if (!value.title || !value.description || !value.role || !value.statusLabel) throw new Error(`Missing required ${localeName.toUpperCase()} publication content.`);
  }
  for (const asset of content.media) {
    for (const localeName of ["en", "ru"] as const) {
      if (!asset.translations[localeName].alt || !asset.translations[localeName].ariaLabel) throw new Error(`Missing ${localeName.toUpperCase()} media accessibility text.`);
    }
  }
}
