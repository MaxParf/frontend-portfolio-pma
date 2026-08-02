DO $$ BEGIN
  CREATE TYPE "media_presentation" AS ENUM ('cover', 'contain');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

ALTER TABLE "project_media"
  ADD COLUMN IF NOT EXISTS "presentation" "media_presentation" NOT NULL DEFAULT 'cover';--> statement-breakpoint

-- Existing project references retain the historical cropped-card presentation.
-- New values are only selected explicitly per project-media reference in the CMS.
