CREATE TYPE "public"."project_status" AS ENUM('draft', 'published', 'hidden', 'archived', 'soft_deleted');--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY NOT NULL,
	"external_key" text NOT NULL,
	"slug" text NOT NULL,
	"gallery_id" text NOT NULL,
	"status" "project_status" NOT NULL,
	"sort_order" integer NOT NULL,
	"project_type" text,
	"started_at" date,
	"ended_at" date,
	"is_ongoing" boolean DEFAULT false NOT NULL,
	"primary_url" text,
	"primary_link_type" text,
	"secondary_url" text,
	"secondary_link_type" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "projects_external_key_unique" UNIQUE("external_key"),
	CONSTRAINT "projects_slug_unique" UNIQUE("slug"),
	CONSTRAINT "projects_gallery_id_unique" UNIQUE("gallery_id")
);
--> statement-breakpoint
CREATE TABLE "project_translations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"description" text NOT NULL,
	"role" text NOT NULL,
	"status_label" text NOT NULL,
	"primary_action_label" text,
	"secondary_action_label" text,
	"technologies_title" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "technologies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "technologies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "project_technologies" (
	"project_id" uuid NOT NULL,
	"technology_id" uuid NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "project_technologies_project_id_technology_id_pk" PRIMARY KEY("project_id","technology_id")
);
--> statement-breakpoint
CREATE TABLE "media_asset_translations" (
	"media_asset_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"alt_text" text NOT NULL,
	"aria_label" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"external_key" text NOT NULL,
	"path" text NOT NULL,
	"role" text NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "media_assets_external_key_unique" UNIQUE("external_key")
);
--> statement-breakpoint
CREATE TABLE "project_media" (
	"project_id" uuid NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "project_media_project_id_media_asset_id_pk" PRIMARY KEY("project_id","media_asset_id")
);
--> statement-breakpoint
ALTER TABLE "project_translations" ADD CONSTRAINT "project_translations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_technologies" ADD CONSTRAINT "project_technologies_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_technologies" ADD CONSTRAINT "project_technologies_technology_id_technologies_id_fk" FOREIGN KEY ("technology_id") REFERENCES "public"."technologies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_asset_translations" ADD CONSTRAINT "media_asset_translations_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_media" ADD CONSTRAINT "project_media_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_media" ADD CONSTRAINT "project_media_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "projects_status_sort_order_idx" ON "projects" USING btree ("status","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "project_translations_project_locale_uq" ON "project_translations" USING btree ("project_id","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "media_asset_translations_asset_locale_uq" ON "media_asset_translations" USING btree ("media_asset_id","locale");