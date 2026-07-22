import { index, integer, jsonb, pgEnum, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { adminUsers } from "./admin-auth.js";

export const projectRevisionTypeEnum = pgEnum("project_revision_type", ["draft", "published"]);

export const projectRevisions = pgTable(
  "project_revisions",
  {
    id: uuid("id").primaryKey(),
    projectId: uuid("project_id").notNull(),
    revisionNumber: integer("revision_number").notNull(),
    revisionType: projectRevisionTypeEnum("revision_type").notNull(),
    baseRevisionId: uuid("base_revision_id"),
    content: jsonb("content").notNull(),
    createdBy: uuid("created_by").references(() => adminUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("project_revisions_project_number_uq").on(table.projectId, table.revisionNumber),
    index("project_revisions_project_created_idx").on(table.projectId, table.createdAt),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey(),
    actorId: uuid("actor_id").references(() => adminUsers.id, { onDelete: "set null" }),
    sessionId: uuid("session_id"),
    requestId: uuid("request_id"),
    traceId: uuid("trace_id"),
    eventType: pgEnum("audit_event_type", ["project_draft_saved", "project_published", "project_draft_conflict", "project_publish_failed", "media_upload_succeeded", "media_upload_rejected", "media_publish_activated", "media_cleanup_deleted"])("event_type").notNull(),
    entityType: pgEnum("audit_entity_type", ["project"])("entity_type").notNull().default("project"),
    entityId: uuid("entity_id").notNull(),
    status: pgEnum("audit_event_status", ["success", "failure"])("status").notNull(),
    summary: jsonb("summary").notNull(),
    metadata: jsonb("metadata").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("audit_events_entity_created_idx").on(table.entityId, table.createdAt)],
);
