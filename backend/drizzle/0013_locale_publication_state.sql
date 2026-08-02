CREATE TABLE "project_locale_publications" (
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "locale" text NOT NULL CHECK ("locale" IN ('ru','en')),
  "current_publication_revision_id" uuid,
  "published_at" timestamp with time zone,
  "publication_generation" integer NOT NULL DEFAULT 0 CHECK ("publication_generation" >= 0),
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "project_locale_publications_pk" PRIMARY KEY ("project_id", "locale"),
  CONSTRAINT "project_locale_publications_pointer_time_ck"
    CHECK (("current_publication_revision_id" IS NULL) = ("published_at" IS NULL)),
  CONSTRAINT "project_locale_publications_pointer_owner_fk"
    FOREIGN KEY ("current_publication_revision_id", "project_id", "locale")
    REFERENCES "project_locale_publication_revisions"("id", "project_id", "locale") ON DELETE RESTRICT
);--> statement-breakpoint
CREATE INDEX "project_locale_publications_current_pointer_idx" ON "project_locale_publications" USING btree ("current_publication_revision_id");
