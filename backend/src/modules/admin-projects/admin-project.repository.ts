import { and, asc, eq } from "drizzle-orm";
import type { PortfolioDatabase } from "../../db/client.js";
import {
  mediaAssets,
  mediaAssetTranslations,
  projectMedia,
  projects,
  projectTechnologies,
  projectTranslations,
  technologies,
} from "../../db/schema/index.js";

export class AdminProjectRepository {
  constructor(private readonly db: PortfolioDatabase) {}

  async list() {
    const rows = await this.db.select().from(projects).orderBy(asc(projects.sortOrder));
    return Promise.all(rows.map((project) => this.withRelations(project.slug)));
  }

  async withRelations(slug: string) {
    const [project] = await this.db.select().from(projects).where(eq(projects.slug, slug)).limit(1);
    if (!project) {
      return null;
    }

    const [translations, technologyRows, mediaRows] = await Promise.all([
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
    ]);

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
      translations: Object.fromEntries(
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
      ),
      technologies: technologyRows.map((technology) => technology.name),
      media: mediaRows.reduce<Array<{ id: string; src: string; role: string; sortOrder: number; translations: Record<string, { alt: string; ariaLabel: string }> }>>(
        (acc, row) => {
          let asset = acc.find((item) => item.id === row.externalKey);
          if (!asset) {
            asset = { id: row.externalKey, src: row.path, role: row.role, sortOrder: row.sortOrder, translations: {} };
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
