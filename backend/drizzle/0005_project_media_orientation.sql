DO $$ BEGIN
  CREATE TYPE "media_orientation" AS ENUM ('vertical', 'horizontal');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

ALTER TABLE "project_media" ADD COLUMN IF NOT EXISTS "orientation" "media_orientation";--> statement-breakpoint

-- Orientation is presentation metadata of project_media. Never write it to media_assets.
UPDATE "project_media" pm
SET "orientation" = CASE WHEN m."height" > m."width" THEN 'vertical'::"media_orientation" ELSE 'horizontal'::"media_orientation" END
FROM "media_assets" m
WHERE pm."media_asset_id" = m."id"
  AND pm."orientation" IS NULL
  AND m."width" > 0
  AND m."height" > 0;--> statement-breakpoint

-- Backfill immutable snapshots only where the referenced asset has usable dimensions.
UPDATE "project_revisions" r
SET "content" = jsonb_set(r."content", '{media}', (
  SELECT jsonb_agg(
    CASE
      WHEN item ? 'orientation' THEN item
      WHEN m."width" > 0 AND m."height" > 0 THEN jsonb_set(item, '{orientation}', to_jsonb(CASE WHEN m."height" > m."width" THEN 'vertical' ELSE 'horizontal' END))
      ELSE item
    END
    ORDER BY ordinal
  ) AS media
  FROM jsonb_array_elements(r."content"->'media') WITH ORDINALITY AS entries(item, ordinal)
  LEFT JOIN "media_assets" m ON (
    (item->>'sourceType' = 'managed' AND m."id"::text = item->>'assetId')
    OR (coalesce(item->>'sourceType', 'legacy') = 'legacy' AND m."external_key" = (SELECT p."external_key" FROM "projects" p WHERE p."id" = r."project_id") || ':' || (item->>'id'))
  )
))
WHERE jsonb_typeof(r."content"->'media') = 'array';--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "project_media"
    WHERE "orientation" IS NOT NULL
    GROUP BY "project_id", "orientation", "sort_order"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add project_media orientation ordering uniqueness: duplicate project/orientation/sort_order rows exist';
  END IF;
END $$;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "project_media_project_orientation_sort_order_uq"
  ON "project_media" ("project_id", "orientation", "sort_order")
  WHERE "orientation" IS NOT NULL;--> statement-breakpoint

-- Do not make orientation NOT NULL here. Rows with missing/zero dimensions are intentionally
-- left unresolved and must be repaired by a controlled follow-up migration.
