CREATE TABLE "project_locale_publication_projects" (
  "publication_revision_id" uuid PRIMARY KEY,
  "project_id" uuid NOT NULL,
  "locale" text NOT NULL CHECK ("locale" IN ('ru','en')),
  "slug" text NOT NULL,
  "gallery_id" text NOT NULL,
  "sort_order" integer NOT NULL,
  "project_type" text,
  "started_at" date,
  "ended_at" date,
  "is_ongoing" boolean NOT NULL,
  "title" text NOT NULL,
  "subtitle" text,
  "description" text NOT NULL,
  "role" text NOT NULL,
  "status_label" text NOT NULL,
  "display_type" text NOT NULL,
  "technologies_title" text,
  CONSTRAINT "project_locale_publication_projects_owner_fk"
    FOREIGN KEY ("publication_revision_id", "project_id", "locale")
    REFERENCES "project_locale_publication_revisions"("id", "project_id", "locale") ON DELETE CASCADE
);--> statement-breakpoint
CREATE TABLE "project_locale_publication_technologies" (
  "publication_revision_id" uuid NOT NULL REFERENCES "project_locale_publication_projects"("publication_revision_id") ON DELETE CASCADE,
  "technology_slug" text NOT NULL,
  "technology_name" text NOT NULL,
  "sort_order" integer NOT NULL,
  PRIMARY KEY ("publication_revision_id", "technology_slug"),
  CONSTRAINT "project_locale_publication_technologies_order_uq" UNIQUE ("publication_revision_id", "sort_order")
);--> statement-breakpoint
CREATE TABLE "project_locale_publication_features" (
  "publication_revision_id" uuid NOT NULL REFERENCES "project_locale_publication_projects"("publication_revision_id") ON DELETE CASCADE,
  "stable_id" uuid NOT NULL,
  "sort_order" integer NOT NULL,
  "text" text NOT NULL,
  PRIMARY KEY ("publication_revision_id", "stable_id"),
  CONSTRAINT "project_locale_publication_features_order_uq" UNIQUE ("publication_revision_id", "sort_order")
);--> statement-breakpoint
CREATE TABLE "project_locale_publication_notes" (
  "publication_revision_id" uuid NOT NULL REFERENCES "project_locale_publication_projects"("publication_revision_id") ON DELETE CASCADE,
  "stable_id" uuid NOT NULL,
  "sort_order" integer NOT NULL,
  "text" text NOT NULL,
  PRIMARY KEY ("publication_revision_id", "stable_id"),
  CONSTRAINT "project_locale_publication_notes_order_uq" UNIQUE ("publication_revision_id", "sort_order")
);--> statement-breakpoint
CREATE TABLE "project_locale_publication_links" (
  "publication_revision_id" uuid NOT NULL REFERENCES "project_locale_publication_projects"("publication_revision_id") ON DELETE CASCADE,
  "stable_id" uuid NOT NULL,
  "sort_order" integer NOT NULL,
  "url" text NOT NULL,
  "label" text NOT NULL,
  PRIMARY KEY ("publication_revision_id", "stable_id"),
  CONSTRAINT "project_locale_publication_links_order_uq" UNIQUE ("publication_revision_id", "sort_order")
);--> statement-breakpoint
CREATE TABLE "project_locale_publication_media" (
  "publication_revision_id" uuid NOT NULL REFERENCES "project_locale_publication_projects"("publication_revision_id") ON DELETE CASCADE,
  "stable_id" text NOT NULL,
  "media_asset_id" uuid NOT NULL REFERENCES "media_assets"("id") ON DELETE RESTRICT,
  "source_type" text NOT NULL CHECK ("source_type" IN ('legacy','managed')),
  "external_key" text NOT NULL,
  "path" text,
  "role" text NOT NULL,
  "orientation" "media_orientation" NOT NULL,
  "gallery_kind" "project_gallery_kind" NOT NULL,
  "presentation" "media_presentation" NOT NULL,
  "sort_order" integer NOT NULL,
  "width" integer,
  "height" integer,
  "alt_text" text NOT NULL,
  "aria_label" text NOT NULL,
  PRIMARY KEY ("publication_revision_id", "stable_id"),
  CONSTRAINT "project_locale_publication_media_order_uq" UNIQUE ("publication_revision_id", "gallery_kind", "sort_order")
);--> statement-breakpoint
CREATE INDEX "project_locale_publication_projects_locale_sort_idx" ON "project_locale_publication_projects" USING btree ("locale", "sort_order");
