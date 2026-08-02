-- 0005 intentionally left rows without usable dimensions unresolved. These historical
-- fixture keys have an explicit, source-controlled gallery mapping; never infer them
-- from filenames or from the gallery kind alone.
UPDATE "project_media" pm
SET "orientation" = mapping."orientation"::"media_orientation"
FROM "media_assets" asset
JOIN (VALUES
  ('construction-management-control-center:dashboard', 'horizontal'),
  ('construction-management-control-center:files', 'horizontal'),
  ('project-bradbury:mobile-home', 'vertical'),
  ('project-bradbury:mobile-profile', 'vertical'),
  ('project-bradbury:mobile-messages', 'vertical'),
  ('project-bradbury:mobile-stories', 'vertical'),
  ('project-bradbury:desktop-home', 'horizontal'),
  ('project-bradbury:desktop-messages', 'horizontal'),
  ('project-bradbury:desktop-room', 'horizontal'),
  ('project-bradbury:admin-console', 'horizontal'),
  ('foodai:meal-plan', 'vertical'),
  ('foodai:grocery-split', 'vertical')
) AS mapping("external_key", "orientation") ON mapping."external_key" = asset."external_key"
WHERE pm."media_asset_id" = asset."id"
  AND pm."orientation" IS NULL;--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "project_media" pm
    JOIN "projects" p ON p."id" = pm."project_id"
    WHERE p."status" = 'published' AND pm."orientation" IS NULL
  ) THEN
    RAISE EXCEPTION 'published project media orientation remains unresolved; add an explicit corrective mapping';
  END IF;
END $$;
