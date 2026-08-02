import { z } from "zod";
import { localeSchema as sharedLocaleSchema, publicProjectDtoSchema, type Locale, type PublicProjectDto } from "../../../../contracts/project-contracts.js";

export const localeSchema = sharedLocaleSchema;
export type { Locale, PublicProjectDto };

export const projectStatusSchema = z.enum(["draft", "published", "hidden", "archived", "soft_deleted"]);

const localizedProjectTextSchema = z.object({
  type: z.string().min(1).optional(),
  title: z.string().min(1),
  subtitle: z.string().min(1).optional(),
  role: z.string().min(1),
  description: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  statusLabel: z.string().min(1),
  links: z.record(z.string(), z.string().min(1)).default({}),
  technologiesAriaLabel: z.string().min(1).optional(),
});

const frontendMediaSchema = z.object({
  id: z.string().min(1),
  src: z.string().min(1),
  role: z.string().min(1),
  sortOrder: z.number().int(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  translations: z.object({
    en: z.object({ alt: z.string().min(1), ariaLabel: z.string().min(1) }),
    ru: z.object({ alt: z.string().min(1), ariaLabel: z.string().min(1) }),
  }),
});

const frontendGalleryGroupSchema = z.object({
  id: z.string().min(1),
  className: z.string().min(1),
  mediaIds: z.array(z.string().min(1)),
});

const frontendLinkSchema = z.object({
  id: z.string().min(1),
  href: z.string().min(1),
  type: z.string().min(1),
});

export const frontendProjectSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  galleryId: z.string().min(1),
  status: projectStatusSchema,
  sortOrder: z.number().int(),
  meta: z.object({
    type: z.string().min(1).nullable().optional(),
    startedAt: z.string().nullable().optional(),
    endedAt: z.string().nullable().optional(),
    ongoing: z.boolean().default(false),
  }),
  translations: z.object({
    en: localizedProjectTextSchema,
    ru: localizedProjectTextSchema,
  }),
  technologies: z.array(z.string().min(1)).min(1),
  links: z.array(frontendLinkSchema).default([]),
  galleryGroups: z.array(frontendGalleryGroupSchema).default([]),
  media: z.array(frontendMediaSchema),
});

export const frontendProjectsSchema = z.array(frontendProjectSchema).min(1);
export type FrontendProject = z.infer<typeof frontendProjectSchema>;

export { publicProjectDtoSchema };
