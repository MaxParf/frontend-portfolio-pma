import { boolean, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const technologies = pgTable("technologies", {
  id: uuid("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export type TechnologyRow = typeof technologies.$inferSelect;
