import { bigint, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { adminUsers } from "./admin-auth.js";

export const mediaSourceTypeEnum = pgEnum("media_source_type", ["legacy", "managed"]);
export const mediaAssetStatusEnum = pgEnum("media_asset_status", ["temporary", "draft", "active", "pending_delete", "deleted", "quarantined"]);

export const mediaAssets = pgTable("media_assets", {
  id: uuid("id").primaryKey(),
  externalKey: text("external_key").notNull().unique(),
  path: text("path"),
  role: text("role").notNull(),
  sortOrder: integer("sort_order").notNull(),
  sourceType: mediaSourceTypeEnum("source_type").notNull().default("legacy"),
  storageDriver: text("storage_driver"),
  storageKey: text("storage_key"),
  originalFilename: text("original_filename"),
  safeFilename: text("safe_filename"),
  mimeType: text("mime_type"),
  extension: text("extension"),
  sizeBytes: bigint("size_bytes", { mode: "number" }),
  width: integer("width"),
  height: integer("height"),
  sha256: text("sha256"),
  status: mediaAssetStatusEnum("status").notNull().default("active"),
  createdBy: uuid("created_by").references(() => adminUsers.id, { onDelete: "set null" }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
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

export const mediaAssetVariants = pgTable(
  "media_asset_variants",
  {
    id: uuid("id").primaryKey(),
    mediaAssetId: uuid("media_asset_id").notNull().references(() => mediaAssets.id, { onDelete: "cascade" }),
    variant: text("variant").notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [uniqueIndex("media_asset_variants_asset_variant_uq").on(table.mediaAssetId, table.variant)],
);
