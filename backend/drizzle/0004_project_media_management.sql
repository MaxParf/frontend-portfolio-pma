DO $$ BEGIN CREATE TYPE "media_source_type" AS ENUM ('legacy', 'managed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "media_asset_status" AS ENUM ('temporary', 'draft', 'active', 'pending_delete', 'deleted', 'quarantined'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
ALTER TABLE "media_assets" ALTER COLUMN "path" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "source_type" "media_source_type" NOT NULL DEFAULT 'legacy';--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "storage_driver" text;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "storage_key" text;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "original_filename" text;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "safe_filename" text;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "mime_type" text;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "extension" text;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "size_bytes" bigint;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "width" integer;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "height" integer;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "sha256" text;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "status" "media_asset_status" NOT NULL DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "created_by" uuid REFERENCES "admin_users"("id") ON DELETE set null;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "media_asset_variants" (
  "id" uuid PRIMARY KEY NOT NULL,
  "media_asset_id" uuid NOT NULL REFERENCES "media_assets"("id") ON DELETE cascade,
  "variant" text NOT NULL,
  "storage_key" text NOT NULL,
  "mime_type" text NOT NULL,
  "width" integer NOT NULL,
  "height" integer NOT NULL,
  "size_bytes" bigint NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  CONSTRAINT "media_asset_variants_asset_variant_uq" UNIQUE("media_asset_id", "variant")
);--> statement-breakpoint
ALTER TYPE "audit_event_type" ADD VALUE IF NOT EXISTS 'media_upload_succeeded';--> statement-breakpoint
ALTER TYPE "audit_event_type" ADD VALUE IF NOT EXISTS 'media_upload_rejected';--> statement-breakpoint
ALTER TYPE "audit_event_type" ADD VALUE IF NOT EXISTS 'media_publish_activated';--> statement-breakpoint
ALTER TYPE "audit_event_type" ADD VALUE IF NOT EXISTS 'media_cleanup_deleted';--> statement-breakpoint
UPDATE "project_revisions"
SET "content" = jsonb_set(
  "content", '{media}',
  (SELECT jsonb_agg(CASE WHEN item ? 'sourceType' THEN item ELSE jsonb_set(item, '{sourceType}', '"legacy"'::jsonb) END)
   FROM jsonb_array_elements("content"->'media') AS item)
)
WHERE jsonb_typeof("content"->'media') = 'array';
