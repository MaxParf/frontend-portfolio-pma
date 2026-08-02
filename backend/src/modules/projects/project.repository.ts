import { and, asc, eq } from "drizzle-orm";
import type { PortfolioDatabase } from "../../db/client.js";
import {
  mediaAssets,
  mediaAssetTranslations,
  projectMedia,
  projectFeatures,
  projectFeatureTranslations,
  projectLinks,
  projectLinkTranslations,
  projectNotes,
  projectNoteTranslations,
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
  displayType: string;
  links: Array<{
    id: string;
    url: string;
    label: string;
  }>;
  technologies: string[];
  features: string[];
  notes: string[];
  media: Array<{
    id: string;
    externalKey: string;
    path: string | null;
    sourceType: "legacy" | "managed";
    role: string;
    orientation: "vertical" | "horizontal";
    galleryKind: "mobile" | "desktop";
    presentation: "cover" | "contain";
    sortOrder: number;
    width: number | null;
    height: number | null;
    altText: string;
    ariaLabel: string;
  }>;
}

export class PublishedProjectContentIntegrityError extends Error {
  readonly code = "PUBLISHED_PROJECT_CONTENT_INTEGRITY_ERROR";
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
        const [technologyRows, mediaRows, featureRows, noteRows, linkRows] = await Promise.all([
          this.db
            .select({ name: technologies.name })
            .from(projectTechnologies)
            .innerJoin(technologies, eq(technologies.id, projectTechnologies.technologyId))
            .where(eq(projectTechnologies.projectId, row.projects.id))
            .orderBy(asc(projectTechnologies.sortOrder)),
          this.db
            .select({
              externalKey: mediaAssets.externalKey,
              id: mediaAssets.id,
              path: mediaAssets.path,
              sourceType: mediaAssets.sourceType,
              role: mediaAssets.role,
              orientation: projectMedia.orientation,
              galleryKind: projectMedia.galleryKind,
              presentation: projectMedia.presentation,
              sortOrder: projectMedia.sortOrder,
              width: mediaAssets.width,
              height: mediaAssets.height,
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
          this.db
            .select({ id: projectFeatures.id, sortOrder: projectFeatures.sortOrder, text: projectFeatureTranslations.text })
            .from(projectFeatures)
            .leftJoin(projectFeatureTranslations, and(eq(projectFeatureTranslations.featureId, projectFeatures.id), eq(projectFeatureTranslations.locale, locale)))
            .where(eq(projectFeatures.projectId, row.projects.id))
            .orderBy(asc(projectFeatures.sortOrder)),
          this.db
            .select({ id: projectNotes.id, sortOrder: projectNotes.sortOrder, text: projectNoteTranslations.text })
            .from(projectNotes)
            .leftJoin(projectNoteTranslations, and(eq(projectNoteTranslations.noteId, projectNotes.id), eq(projectNoteTranslations.locale, locale)))
            .where(eq(projectNotes.projectId, row.projects.id))
            .orderBy(asc(projectNotes.sortOrder)),
          this.db
            .select({ id: projectLinks.id, url: projectLinks.url, sortOrder: projectLinks.sortOrder, label: projectLinkTranslations.label })
            .from(projectLinks)
            .leftJoin(projectLinkTranslations, and(eq(projectLinkTranslations.projectLinkId, projectLinks.id), eq(projectLinkTranslations.locale, locale)))
            .where(eq(projectLinks.projectId, row.projects.id))
            .orderBy(asc(projectLinks.sortOrder)),
        ]);

        if (!row.project_translations.displayType.trim()) throw new PublishedProjectContentIntegrityError(`Published project ${row.projects.externalKey} has no ${locale} display type.`);
        if (featureRows.some((feature) => !feature.text)) throw new PublishedProjectContentIntegrityError(`Published project ${row.projects.externalKey} has a feature without ${locale} translation.`);
        if (noteRows.some((note) => !note.text)) throw new PublishedProjectContentIntegrityError(`Published project ${row.projects.externalKey} has a note without ${locale} translation.`);
        if (!linkRows.length) throw new PublishedProjectContentIntegrityError(`Published project ${row.projects.externalKey} has no links.`);
        if (linkRows.some((link) => !link.url.trim())) throw new PublishedProjectContentIntegrityError(`Published project ${row.projects.externalKey} has a link with an empty URL.`);
        if (linkRows.some((link) => !link.label?.trim())) throw new PublishedProjectContentIntegrityError(`Published project ${row.projects.externalKey} has a link without ${locale} label.`);
        if (new Set(linkRows.map((link) => link.sortOrder)).size !== linkRows.length) throw new PublishedProjectContentIntegrityError(`Published project ${row.projects.externalKey} has duplicate link sort orders.`);

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
          displayType: row.project_translations.displayType,
          links: linkRows.map((link) => ({ id: link.id, url: link.url, label: link.label! })),
          technologies: technologyRows.map((technology) => technology.name),
          features: featureRows.map((feature) => feature.text!),
          notes: noteRows.map((note) => note.text!),
          media: mediaRows.map((media) => {
            if (!media.orientation || !media.galleryKind || !media.presentation) throw new Error("Published project media gallery metadata is missing.");
            return { ...media, orientation: media.orientation, galleryKind: media.galleryKind, presentation: media.presentation };
          }),
        };
      }),
    );
  }

  async findPublishedBySlug(slug: string, locale: Locale): Promise<ProjectReadModel | null> {
    const projectsByLocale = await this.findPublished(locale);
    return projectsByLocale.find((project) => project.slug === slug) ?? null;
  }
}
