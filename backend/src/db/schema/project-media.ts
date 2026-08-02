import { integer, pgEnum, pgTable, primaryKey, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { mediaAssets } from "./media-assets.js";
import { projects } from "./projects.js";
import { MEDIA_ORIENTATIONS } from "../../modules/media/media-orientation.js";
import { MEDIA_PRESENTATIONS } from "../../modules/media/media-presentation.js";
import { projectGalleryKinds } from "../../modules/media/project-gallery-kind.js";

export const mediaOrientationEnum = pgEnum("media_orientation", MEDIA_ORIENTATIONS);
export const mediaPresentationEnum = pgEnum("media_presentation", MEDIA_PRESENTATIONS);
export const projectGalleryKindEnum = pgEnum("project_gallery_kind", projectGalleryKinds);

export const projectMedia = pgTable(
  "project_media",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    mediaAssetId: uuid("media_asset_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull(),
    // This belongs to the project-media presentation reference, not media_assets.
    orientation: mediaOrientationEnum("orientation"),
    presentation: mediaPresentationEnum("presentation").notNull().default("cover"),
    galleryKind: projectGalleryKindEnum("gallery_kind").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.mediaAssetId] }),
    uniqueIndex("project_media_project_gallery_kind_sort_order_uq").on(table.projectId, table.galleryKind, table.sortOrder),
  ],
);
