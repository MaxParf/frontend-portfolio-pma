DO $$ BEGIN CREATE TYPE "project_revision_type" AS ENUM ('draft', 'published'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "audit_event_type" AS ENUM ('project_draft_saved', 'project_published', 'project_draft_conflict', 'project_publish_failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "audit_entity_type" AS ENUM ('project'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "audit_event_status" AS ENUM ('success', 'failure'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_revisions" (
  "id" uuid PRIMARY KEY NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "revision_number" integer NOT NULL,
  "revision_type" "project_revision_type" NOT NULL,
  "base_revision_id" uuid,
  "content" jsonb NOT NULL,
  "created_by" uuid REFERENCES "admin_users"("id") ON DELETE set null,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "published_at" timestamp with time zone,
  CONSTRAINT "project_revisions_project_number_uq" UNIQUE("project_id", "revision_number")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_revisions_project_created_idx" ON "project_revisions" USING btree ("project_id", "created_at");--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "current_published_revision_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "current_draft_revision_id" uuid;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "projects" ADD CONSTRAINT "projects_current_published_revision_id_project_revisions_id_fk" FOREIGN KEY ("current_published_revision_id") REFERENCES "project_revisions"("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "projects" ADD CONSTRAINT "projects_current_draft_revision_id_project_revisions_id_fk" FOREIGN KEY ("current_draft_revision_id") REFERENCES "project_revisions"("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_events" (
  "id" uuid PRIMARY KEY NOT NULL,
  "actor_id" uuid REFERENCES "admin_users"("id") ON DELETE set null,
  "session_id" uuid,
  "request_id" uuid,
  "trace_id" uuid,
  "event_type" "audit_event_type" NOT NULL,
  "entity_type" "audit_entity_type" DEFAULT 'project' NOT NULL,
  "entity_id" uuid NOT NULL,
  "status" "audit_event_status" NOT NULL,
  "summary" jsonb NOT NULL,
  "metadata" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_events_entity_created_idx" ON "audit_events" USING btree ("entity_id", "created_at");
