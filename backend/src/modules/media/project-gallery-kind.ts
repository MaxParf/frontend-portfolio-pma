export const projectGalleryKinds = ["mobile", "desktop"] as const;

export type ProjectGalleryKind = (typeof projectGalleryKinds)[number];

import type { MediaOrientation } from "./media-orientation.js";

// Explicit compatibility metadata for snapshots created before gallery metadata
// existed. Do not infer it from a filename or a gallery kind: unknown assets must
// keep failing schema validation until they have an explicit mapping.
const legacyMediaMetadata: Record<string, { galleryKind: ProjectGalleryKind; orientation: MediaOrientation }> = {
  "construction-management-control-center:dashboard": { galleryKind: "desktop", orientation: "horizontal" },
  "construction-management-control-center:files": { galleryKind: "desktop", orientation: "horizontal" },
  "project-bradbury:mobile-home": { galleryKind: "mobile", orientation: "vertical" },
  "project-bradbury:mobile-profile": { galleryKind: "mobile", orientation: "vertical" },
  "project-bradbury:mobile-messages": { galleryKind: "mobile", orientation: "vertical" },
  "project-bradbury:mobile-stories": { galleryKind: "mobile", orientation: "vertical" },
  "project-bradbury:desktop-home": { galleryKind: "desktop", orientation: "horizontal" },
  "project-bradbury:desktop-messages": { galleryKind: "desktop", orientation: "horizontal" },
  "project-bradbury:desktop-room": { galleryKind: "desktop", orientation: "horizontal" },
  "project-bradbury:admin-console": { galleryKind: "desktop", orientation: "horizontal" },
  "foodai:meal-plan": { galleryKind: "mobile", orientation: "vertical" },
  "foodai:grocery-split": { galleryKind: "mobile", orientation: "vertical" },
};

export function legacyGalleryKindByMediaId(id: string): ProjectGalleryKind | undefined {
  return legacyMediaMetadata[id]?.galleryKind;
}

export function legacyMediaOrientationByMediaId(id: string): MediaOrientation | undefined {
  return legacyMediaMetadata[id]?.orientation;
}
