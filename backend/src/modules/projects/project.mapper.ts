import type { ProjectReadModel } from "./project.repository.js";
import type { PublicProjectDto } from "./project.schemas.js";

function linkDto(href: string | null, type: string | null, label: string | null) {
  if (!href || !type) {
    return null;
  }

  return { href, type, label };
}

export function mapProjectToPublicDto(project: ProjectReadModel): PublicProjectDto {
  return {
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
    technologies: project.technologies,
    links: {
      primary: linkDto(project.primaryUrl, project.primaryLinkType, project.primaryActionLabel),
      secondary: linkDto(project.secondaryUrl, project.secondaryLinkType, project.secondaryActionLabel),
    },
    media: project.media.map((asset) => ({
      id: asset.sourceType === "managed" ? asset.id : asset.externalKey,
      src: asset.sourceType === "managed" ? `/api/v1/media/${asset.id}/display` : asset.path!,
      thumbnailSrc: asset.sourceType === "managed" ? `/api/v1/media/${asset.id}/thumbnail` : null,
      role: asset.role,
      sortOrder: asset.sortOrder,
      alt: asset.altText,
      ariaLabel: asset.ariaLabel,
    })),
  };
}
