import { integer, pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";
import { technologies } from "./technologies.js";

export const projectTechnologies = pgTable(
  "project_technologies",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    technologyId: uuid("technology_id")
      .notNull()
      .references(() => technologies.id, { onDelete: "restrict" }),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [primaryKey({ columns: [table.projectId, table.technologyId] })],
);
