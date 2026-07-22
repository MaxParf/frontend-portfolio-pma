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
import type { Locale } from "./project.schemas.js";

export interface ProjectReadModel {
  externalKey: string;
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
  primaryUrl: string | null;
  primaryLinkType: string | null;
  primaryActionLabel: string | null;
  secondaryUrl: string | null;
  secondaryLinkType: string | null;
  secondaryActionLabel: string | null;
  technologies: string[];
  media: Array<{
    externalKey: string;
    path: string;
    role: string;
    sortOrder: number;
    altText: string;
    ariaLabel: string;
  }>;
}

export class ProjectRepository {
  constructor(private readonly db: PortfolioDatabase) {}

  async findPublished(locale: Locale): Promise<ProjectReadModel[]> {
    const rows = await this.db
      .select()
      .from(projects)
      .innerJoin(projectTranslations, and(eq(projectTranslations.projectId, projects.id), eq(projectTranslations.locale, locale)))
      .where(eq(projects.status, "published"))
      .orderBy(asc(projects.sortOrder));

    return Promise.all(
      rows.map(async (row) => {
        const [technologyRows, mediaRows] = await Promise.all([
          this.db
            .select({ name: technologies.name })
            .from(projectTechnologies)
            .innerJoin(technologies, eq(technologies.id, projectTechnologies.technologyId))
            .where(eq(projectTechnologies.projectId, row.projects.id))
            .orderBy(asc(projectTechnologies.sortOrder)),
          this.db
            .select({
              externalKey: mediaAssets.externalKey,
              path: mediaAssets.path,
              role: mediaAssets.role,
              sortOrder: projectMedia.sortOrder,
              altText: mediaAssetTranslations.altText,
              ariaLabel: mediaAssetTranslations.ariaLabel,
            })
            .from(projectMedia)
            .innerJoin(mediaAssets, eq(mediaAssets.id, projectMedia.mediaAssetId))
            .innerJoin(
              mediaAssetTranslations,
              and(eq(mediaAssetTranslations.mediaAssetId, mediaAssets.id), eq(mediaAssetTranslations.locale, locale)),
            )
            .where(eq(projectMedia.projectId, row.projects.id))
            .orderBy(asc(projectMedia.sortOrder)),
        ]);

        return {
          externalKey: row.projects.externalKey,
          slug: row.projects.slug,
          galleryId: row.projects.galleryId,
          status: "published",
          sortOrder: row.projects.sortOrder,
          type: row.projects.projectType,
          title: row.project_translations.title,
          subtitle: row.project_translations.subtitle,
          description: row.project_translations.description,
          role: row.project_translations.role,
          statusLabel: row.project_translations.statusLabel,
          primaryUrl: row.projects.primaryUrl,
          primaryLinkType: row.projects.primaryLinkType,
          primaryActionLabel: row.project_translations.primaryActionLabel,
          secondaryUrl: row.projects.secondaryUrl,
          secondaryLinkType: row.projects.secondaryLinkType,
          secondaryActionLabel: row.project_translations.secondaryActionLabel,
          technologies: technologyRows.map((technology) => technology.name),
          media: mediaRows,
        };
      }),
    );
  }

  async findPublishedBySlug(slug: string, locale: Locale): Promise<ProjectReadModel | null> {
    const projectsByLocale = await this.findPublished(locale);
    return projectsByLocale.find((project) => project.slug === slug) ?? null;
  }
}
