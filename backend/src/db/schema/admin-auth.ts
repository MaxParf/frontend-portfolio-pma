import { boolean, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const adminRoleEnum = pgEnum("admin_role", ["owner"]);
export const authEventTypeEnum = pgEnum("auth_event_type", [
  "login_success",
  "login_failure",
  "logout",
  "session_expired",
  "account_locked",
]);
export const authEventStatusEnum = pgEnum("auth_event_status", ["success", "failure"]);

export const adminUsers = pgTable(
  "admin_users",
  {
    id: uuid("id").primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    role: adminRoleEnum("role").notNull().default("owner"),
    isActive: boolean("is_active").notNull().default(true),
    failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [uniqueIndex("admin_users_email_uq").on(table.email)],
);

export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    userAgentHash: text("user_agent_hash"),
    ipHash: text("ip_hash"),
  },
  (table) => [
    index("admin_sessions_active_idx").on(table.userId, table.expiresAt, table.revokedAt),
    index("admin_sessions_expires_idx").on(table.expiresAt),
  ],
);

export const authEvents = pgTable(
  "auth_events",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id").references(() => adminUsers.id, { onDelete: "set null" }),
    emailHash: text("email_hash"),
    eventType: authEventTypeEnum("event_type").notNull(),
    status: authEventStatusEnum("status").notNull(),
    requestId: text("request_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("auth_events_user_created_idx").on(table.userId, table.createdAt)],
);

export type AdminUserRow = typeof adminUsers.$inferSelect;
export type AdminSessionRow = typeof adminSessions.$inferSelect;
