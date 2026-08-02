-- State rows are created for both supported locales. Immutable snapshots and their
-- projections are populated by the idempotent canonical backfill runner immediately
-- after Drizzle migration; it validates revision JSON before writing any locale row.
INSERT INTO "project_locale_publications" ("project_id", "locale", "current_publication_revision_id", "published_at", "publication_generation", "created_at", "updated_at")
SELECT p."id", locale."value", NULL, NULL, 0, p."created_at", p."updated_at"
FROM "projects" p
CROSS JOIN (VALUES ('ru'), ('en')) AS locale("value")
ON CONFLICT ("project_id", "locale") DO NOTHING;
