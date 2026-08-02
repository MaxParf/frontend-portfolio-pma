import { integer, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";

function itemTable(name: "project_features" | "project_notes") {
  return pgTable(name, { id: uuid("id").primaryKey(), projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }), sortOrder: integer("sort_order").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull() }, (table) => [uniqueIndex(`${name}_project_sort_order_uq`).on(table.projectId, table.sortOrder)]);
}
export const projectFeatures = itemTable("project_features");
export const projectNotes = itemTable("project_notes");
export const projectFeatureTranslations = pgTable("project_feature_translations", { featureId: uuid("feature_id").notNull().references(() => projectFeatures.id, { onDelete: "cascade" }), locale: text("locale").notNull(), text: text("text").notNull() }, (table) => [primaryKey({ columns: [table.featureId, table.locale] })]);
export const projectNoteTranslations = pgTable("project_note_translations", { noteId: uuid("note_id").notNull().references(() => projectNotes.id, { onDelete: "cascade" }), locale: text("locale").notNull(), text: text("text").notNull() }, (table) => [primaryKey({ columns: [table.noteId, table.locale] })]);
