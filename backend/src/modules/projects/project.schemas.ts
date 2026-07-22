import { z } from "zod";

export const localeSchema = z.enum(["en", "ru"]);
export type Locale = z.infer<typeof localeSchema>;

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
  translations: z.object({
    en: z.object({ alt: z.string().min(1), ariaLabel: z.string().min(1) }),
    ru: z.object({ alt: z.string().min(1), ariaLabel: z.string().min(1) }),
  }),
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
  media: z.array(frontendMediaSchema),
});

export const frontendProjectsSchema = z.array(frontendProjectSchema).min(1);
export type FrontendProject = z.infer<typeof frontendProjectSchema>;

export interface PublicProjectDto {
  id: string;
  slug: string;
  galleryId: string;
  status: "published";
  sortOrder: number;
  type: string | null;
  title: string;
  subtitle: string | null;
  description: string;
  role: string;
  statusLabel: string;
  technologies: string[];
  links: {
    primary: { href: string; type: string; label: string | null } | null;
    secondary: { href: string; type: string; label: string | null } | null;
  };
  media: Array<{
    id: string;
    src: string;
    role: string;
    sortOrder: number;
    alt: string;
    ariaLabel: string;
  }>;
}
