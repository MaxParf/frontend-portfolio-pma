import { integer, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";

export const projectLinks = pgTable("project_links", { id: uuid("id").primaryKey(), projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }), url: text("url").notNull(), sortOrder: integer("sort_order").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull() }, (table) => [uniqueIndex("project_links_project_sort_order_uq").on(table.projectId, table.sortOrder)]);
export const projectLinkTranslations = pgTable("project_link_translations", { projectLinkId: uuid("project_link_id").notNull().references(() => projectLinks.id, { onDelete: "cascade" }), locale: text("locale").notNull(), label: text("label").notNull() }, (table) => [primaryKey({ columns: [table.projectLinkId, table.locale] })]);
