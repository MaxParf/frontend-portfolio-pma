import type { ProjectReadModel } from "./project.repository.js";
import { publicProjectDtoSchema, type PublicProjectDto } from "./project.schemas.js";

export function mapProjectToPublicDto(project: ProjectReadModel): PublicProjectDto {
  return publicProjectDtoSchema.parse({
    id: project.externalKey,
    slug: project.slug,
    galleryId: project.galleryId,
    status: project.status,
    sortOrder: project.sortOrder,
    type: project.type,
    title: project.title,
    subtitle: project.subtitle,
    description: project.description,
    role: project.role,
    statusLabel: project.statusLabel,
    displayType: project.displayType,
    technologies: project.technologies,
    features: project.features,
    notes: project.notes,
    links: project.links.map((link) => ({ ...link })),
    media: project.media.map((asset) => ({
      id: asset.sourceType === "managed" ? asset.id : asset.externalKey,
      src: asset.sourceType === "managed" ? `/api/v1/media/${asset.id}/display` : asset.path!,
      thumbnailSrc: asset.sourceType === "managed" ? `/api/v1/media/${asset.id}/thumbnail` : null,
      sourceType: asset.sourceType,
      role: asset.role,
      orientation: asset.orientation,
      galleryKind: asset.galleryKind,
      presentation: asset.presentation,
      sortOrder: asset.sortOrder,
      width: asset.width,
      height: asset.height,
      alt: asset.altText,
      ariaLabel: asset.ariaLabel,
    })),
  });
}
