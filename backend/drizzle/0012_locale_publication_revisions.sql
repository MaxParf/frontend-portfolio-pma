CREATE UNIQUE INDEX "project_revisions_id_project_uq" ON "project_revisions" USING btree ("id", "project_id");--> statement-breakpoint
CREATE TABLE "project_locale_publication_revisions" (
  "id" uuid PRIMARY KEY NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "locale" text NOT NULL CHECK ("locale" IN ('ru','en')),
  "source_editor_revision_id" uuid NOT NULL,
  "snapshot" jsonb NOT NULL,
  "created_by" uuid REFERENCES "admin_users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL,
  CONSTRAINT "project_locale_publication_revisions_source_project_fk"
    FOREIGN KEY ("source_editor_revision_id", "project_id")
    REFERENCES "project_revisions"("id", "project_id") ON DELETE RESTRICT,
  CONSTRAINT "project_locale_publication_revisions_id_project_locale_uq"
    UNIQUE ("id", "project_id", "locale"),
  CONSTRAINT "project_locale_publication_revisions_source_locale_uq"
    UNIQUE ("project_id", "locale", "source_editor_revision_id")
);--> statement-breakpoint
CREATE INDEX "project_locale_publication_revisions_project_locale_created_idx" ON "project_locale_publication_revisions" USING btree ("project_id", "locale", "created_at");
