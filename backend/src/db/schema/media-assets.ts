import { integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const mediaAssets = pgTable("media_assets", {
  id: uuid("id").primaryKey(),
  externalKey: text("external_key").notNull().unique(),
  path: text("path").notNull(),
  role: text("role").notNull(),
  sortOrder: integer("sort_order").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const mediaAssetTranslations = pgTable(
  "media_asset_translations",
  {
    mediaAssetId: uuid("media_asset_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    altText: text("alt_text").notNull(),
    ariaLabel: text("aria_label").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [uniqueIndex("media_asset_translations_asset_locale_uq").on(table.mediaAssetId, table.locale)],
);

export type MediaAssetRow = typeof mediaAssets.$inferSelect;
export type MediaAssetTranslationRow = typeof mediaAssetTranslations.$inferSelect;
