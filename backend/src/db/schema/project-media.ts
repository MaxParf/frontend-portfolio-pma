import { integer, pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";
import { mediaAssets } from "./media-assets.js";
import { projects } from "./projects.js";

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
  },
  (table) => [primaryKey({ columns: [table.projectId, table.mediaAssetId] })],
);
