import { and, asc, eq } from "drizzle-orm";
import { adminProjectListItemSchema, type AdminProjectListItem } from "../../../../contracts/project-contracts.js";
import type { PortfolioDatabase } from "../../db/client.js";
import {
  mediaAssets,
  mediaAssetTranslations,
  projectMedia,
  projectRevisions,
  projects,
  projectTechnologies,
  projectTranslations,
  technologies,
} from "../../db/schema/index.js";

export class AdminProjectRepository {
  constructor(private readonly db: PortfolioDatabase) {}

  async list(): Promise<AdminProjectListItem[]> {
    const rows = await this.db.select().from(projects).orderBy(asc(projects.sortOrder));
    return Promise.all(rows.map(async (project) => {
      const [translations, revisionRows] = await Promise.all([
        this.db.select().from(projectTranslations).where(eq(projectTranslations.projectId, project.id)),
        project.status === "draft" && (project.currentDraftRevisionId ?? project.currentPublishedRevisionId)
          ? this.db.select({ content: projectRevisions.content }).from(projectRevisions).where(eq(projectRevisions.id, project.currentDraftRevisionId ?? project.currentPublishedRevisionId!)).limit(1)
          : Promise.resolve([]),
      ]);
      const titles = Object.fromEntries(translations.map((item) => [item.locale, { title: item.title }])) as Record<string, { title: string }>;
      const draftTitles = draftTitleTranslations(revisionRows[0]?.content);
      return adminProjectListItemSchema.parse({
        id: project.externalKey, databaseId: project.id, slug: project.slug, galleryId: project.galleryId, status: project.status, sortOrder: project.sortOrder,
        createdAt: project.createdAt.toISOString(), updatedAt: project.updatedAt.toISOString(), publishedAt: project.publishedAt?.toISOString() ?? null,
        isPublished: Boolean(project.currentPublishedRevisionId), hasDraft: Boolean(project.currentDraftRevisionId),
        translations: project.status === "draft" ? { status: "draft", values: Object.keys(titles).length ? titles : draftTitles } : { status: project.status, values: titles },
      });
    }));
  }

  async withRelations(slug: string) {
    const [project] = await this.db.select().from(projects).where(eq(projects.slug, slug)).limit(1);
    if (!project) {
      return null;
    }

    const [translations, technologyRows, mediaRows, revisionRows] = await Promise.all([
      this.db.select().from(projectTranslations).where(eq(projectTranslations.projectId, project.id)),
      this.db
        .select({ name: technologies.name, sortOrder: projectTechnologies.sortOrder })
        .from(projectTechnologies)
        .innerJoin(technologies, eq(technologies.id, projectTechnologies.technologyId))
        .where(eq(projectTechnologies.projectId, project.id))
        .orderBy(asc(projectTechnologies.sortOrder)),
      this.db
        .select({
          externalKey: mediaAssets.externalKey,
          path: mediaAssets.path,
          role: mediaAssets.role,
          sortOrder: projectMedia.sortOrder,
          locale: mediaAssetTranslations.locale,
          altText: mediaAssetTranslations.altText,
          ariaLabel: mediaAssetTranslations.ariaLabel,
        })
        .from(projectMedia)
        .innerJoin(mediaAssets, eq(mediaAssets.id, projectMedia.mediaAssetId))
        .innerJoin(mediaAssetTranslations, eq(mediaAssetTranslations.mediaAssetId, mediaAssets.id))
        .where(eq(projectMedia.projectId, project.id))
        .orderBy(asc(projectMedia.sortOrder)),
      project.status === "draft" && (project.currentDraftRevisionId ?? project.currentPublishedRevisionId)
        ? this.db.select({ content: projectRevisions.content }).from(projectRevisions).where(eq(projectRevisions.id, project.currentDraftRevisionId ?? project.currentPublishedRevisionId!)).limit(1)
        : Promise.resolve([]),
    ]);

    const persistedTranslations = Object.fromEntries(
      translations.map((translation) => [
        translation.locale,
        {
          title: translation.title,
          subtitle: translation.subtitle,
          description: translation.description,
          role: translation.role,
          statusLabel: translation.statusLabel,
          primaryActionLabel: translation.primaryActionLabel,
          secondaryActionLabel: translation.secondaryActionLabel,
          technologiesTitle: translation.technologiesTitle,
        },
      ]),
    );
    const revisionTranslations = project.status === "draft" ? draftTranslations(revisionRows[0]?.content) : {};

    return {
      id: project.externalKey,
      databaseId: project.id,
      slug: project.slug,
      galleryId: project.galleryId,
      status: project.status,
      sortOrder: project.sortOrder,
      type: project.projectType,
      startedAt: project.startedAt,
      endedAt: project.endedAt,
      isOngoing: project.isOngoing,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      publishedAt: project.publishedAt?.toISOString() ?? null,
      links: {
        primary: project.primaryUrl ? { href: project.primaryUrl, type: project.primaryLinkType } : null,
        secondary: project.secondaryUrl ? { href: project.secondaryUrl, type: project.secondaryLinkType } : null,
      },
      translations: translations.length ? persistedTranslations : revisionTranslations,
      technologies: technologyRows.map((technology) => technology.name),
      media: mediaRows.reduce<Array<{ id: string; src: string; role: string; sortOrder: number; translations: Record<string, { alt: string; ariaLabel: string }> }>>(
        (acc, row) => {
          let asset = acc.find((item) => item.id === row.externalKey);
          if (!asset) {
            asset = { id: row.externalKey, src: row.path ?? "", role: row.role, sortOrder: row.sortOrder, translations: {} };
            acc.push(asset);
          }
          asset.translations[row.locale] = { alt: row.altText, ariaLabel: row.ariaLabel };
          return acc;
        },
        [],
      ),
    };
  }
}

function draftTitleTranslations(content: unknown): { en?: { title?: string }; ru?: { title?: string } } {
  if (!content || typeof content !== "object") return {};
  const translations = (content as { translations?: unknown }).translations;
  if (!translations || typeof translations !== "object") return {};
  return Object.fromEntries(["en", "ru"].flatMap((locale) => {
    const value = (translations as Record<string, unknown>)[locale];
    if (!value || typeof value !== "object" || typeof (value as { title?: unknown }).title !== "string") return [];
    return [[locale, { title: (value as { title: string }).title }]];
  }));
}

function draftTranslations(content: unknown): Record<string, { title: string; subtitle: string | null; description: string; role: string; statusLabel: string; technologiesTitle: string | null }> {
  if (!content || typeof content !== "object") return {};
  const translations = (content as { translations?: unknown }).translations;
  if (!translations || typeof translations !== "object") return {};
  const result: Record<string, { title: string; subtitle: string | null; description: string; role: string; statusLabel: string; technologiesTitle: string | null }> = {};
  for (const locale of ["en", "ru"]) {
    const value = (translations as Record<string, unknown>)[locale];
    if (!value || typeof value !== "object") continue;
    const source = value as Record<string, unknown>;
    if (typeof source.title !== "string" || typeof source.description !== "string" || typeof source.role !== "string" || typeof source.statusLabel !== "string") continue;
    result[locale] = {
      title: source.title,
      subtitle: typeof source.subtitle === "string" ? source.subtitle : null,
      description: source.description,
      role: source.role,
      statusLabel: source.statusLabel,
      technologiesTitle: typeof source.technologiesTitle === "string" ? source.technologiesTitle : null,
    };
  }
  return result;
}
