import { boolean, date, index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const projectStatusEnum = pgEnum("project_status", ["draft", "published", "hidden", "archived", "soft_deleted"]);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey(),
    externalKey: text("external_key").notNull().unique(),
    slug: text("slug").notNull().unique(),
    galleryId: text("gallery_id").notNull().unique(),
    status: projectStatusEnum("status").notNull(),
    sortOrder: integer("sort_order").notNull(),
    projectType: text("project_type"),
    startedAt: date("started_at"),
    endedAt: date("ended_at"),
    isOngoing: boolean("is_ongoing").notNull().default(false),
    primaryUrl: text("primary_url"),
    primaryLinkType: text("primary_link_type"),
    secondaryUrl: text("secondary_url"),
    secondaryLinkType: text("secondary_link_type"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (table) => [index("projects_status_sort_order_idx").on(table.status, table.sortOrder)],
);

export type ProjectRow = typeof projects.$inferSelect;
