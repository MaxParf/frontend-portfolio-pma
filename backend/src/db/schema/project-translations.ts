import { integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";

export const projectTranslations = pgTable(
  "project_translations",
  {
    id: uuid("id").primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    description: text("description").notNull(),
    role: text("role").notNull(),
    statusLabel: text("status_label").notNull(),
    primaryActionLabel: text("primary_action_label"),
    secondaryActionLabel: text("secondary_action_label"),
    technologiesTitle: text("technologies_title"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [uniqueIndex("project_translations_project_locale_uq").on(table.projectId, table.locale)],
);

export type ProjectTranslationRow = typeof projectTranslations.$inferSelect;
