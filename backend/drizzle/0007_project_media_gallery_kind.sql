DO $$ BEGIN
  CREATE TYPE "project_gallery_kind" AS ENUM ('mobile', 'desktop');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

ALTER TABLE "project_media" ADD COLUMN IF NOT EXISTS "gallery_kind" "project_gallery_kind";--> statement-breakpoint

-- Stable fixture/seed keys, never image dimensions or filenames alone.
UPDATE "project_media" pm SET "gallery_kind" = 'desktop'::"project_gallery_kind"
FROM "media_assets" m
WHERE pm."media_asset_id" = m."id"
  AND m."external_key" IN (
    'construction-management-control-center:dashboard',
    'construction-management-control-center:files',
    'project-bradbury:desktop-home',
    'project-bradbury:desktop-messages',
    'project-bradbury:desktop-room',
    'project-bradbury:admin-console'
  );--> statement-breakpoint

UPDATE "project_media" pm SET "gallery_kind" = 'mobile'::"project_gallery_kind"
FROM "media_assets" m
WHERE pm."media_asset_id" = m."id"
  AND m."external_key" IN (
    'project-bradbury:mobile-home',
    'project-bradbury:mobile-profile',
    'project-bradbury:mobile-messages',
    'project-bradbury:mobile-stories',
    'foodai:meal-plan',
    'foodai:grocery-split'
  );--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "project_media" WHERE "gallery_kind" IS NULL) THEN
    RAISE EXCEPTION 'Cannot assign project_media.gallery_kind: unmatched project-media references require explicit mapping';
  END IF;
END $$;--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "project_media") AND EXISTS (
    SELECT 1
    FROM (VALUES
      ('construction-management-control-center:dashboard'), ('construction-management-control-center:files'),
      ('project-bradbury:mobile-home'), ('project-bradbury:mobile-profile'), ('project-bradbury:mobile-messages'), ('project-bradbury:mobile-stories'),
      ('project-bradbury:desktop-home'), ('project-bradbury:desktop-messages'), ('project-bradbury:desktop-room'), ('project-bradbury:admin-console'),
      ('foodai:meal-plan'), ('foodai:grocery-split')
    ) AS fixture(external_key)
    LEFT JOIN "media_assets" AS media ON media."external_key" = fixture.external_key
    LEFT JOIN "project_media" AS reference ON reference."media_asset_id" = media."id"
    WHERE reference."media_asset_id" IS NULL
  ) THEN
    RAISE EXCEPTION 'gallery_kind fixture mapping has no matching project_media reference';
  END IF;
END $$;--> statement-breakpoint

ALTER TABLE "project_media" ALTER COLUMN "gallery_kind" SET NOT NULL;--> statement-breakpoint

DROP INDEX IF EXISTS "project_media_project_orientation_sort_order_uq";--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "project_media_project_gallery_kind_sort_order_uq"
  ON "project_media" ("project_id", "gallery_kind", "sort_order");
