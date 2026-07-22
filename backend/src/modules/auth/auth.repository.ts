import { and, eq, gt, isNull, sql } from "drizzle-orm";
import type { PortfolioDatabase } from "../../db/client.js";
import { adminSessions, adminUsers, authEvents, type AdminUserRow } from "../../db/schema/index.js";

export type AuthEventType = "login_success" | "login_failure" | "logout" | "session_expired" | "account_locked";

export class AuthRepository {
  constructor(private readonly db: PortfolioDatabase) {}

  findUserByEmail(email: string): Promise<AdminUserRow | undefined> {
    return this.db.query.adminUsers.findFirst({ where: eq(adminUsers.email, email) });
  }

  findActiveSession(tokenHash: string, now: Date) {
    return this.db
      .select({ user: adminUsers, session: adminSessions })
      .from(adminSessions)
      .innerJoin(adminUsers, eq(adminUsers.id, adminSessions.userId))
      .where(and(eq(adminSessions.tokenHash, tokenHash), isNull(adminSessions.revokedAt), gt(adminSessions.expiresAt, now), eq(adminUsers.isActive, true)))
      .limit(1);
  }

  async createSession(input: {
    id: string;
    userId: string;
    tokenHash: string;
    createdAt: Date;
    expiresAt: Date;
    userAgentHash: string | null;
    ipHash: string | null;
  }): Promise<void> {
    await this.db.insert(adminSessions).values({
      id: input.id,
      userId: input.userId,
      tokenHash: input.tokenHash,
      createdAt: input.createdAt,
      expiresAt: input.expiresAt,
      lastSeenAt: input.createdAt,
      userAgentHash: input.userAgentHash,
      ipHash: input.ipHash,
    });
  }

  async touchSession(id: string, now: Date): Promise<void> {
    await this.db.update(adminSessions).set({ lastSeenAt: now }).where(eq(adminSessions.id, id));
  }

  async revokeSession(tokenHash: string, now: Date): Promise<void> {
    await this.db.update(adminSessions).set({ revokedAt: now }).where(eq(adminSessions.tokenHash, tokenHash));
  }

  async markLoginSuccess(userId: string, now: Date): Promise<void> {
    await this.db
      .update(adminUsers)
      .set({ failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: now, updatedAt: now })
      .where(eq(adminUsers.id, userId));
  }

  async markLoginFailure(user: AdminUserRow, maxAttempts: number, lockSeconds: number, now: Date): Promise<AdminUserRow> {
    const nextAttempts = user.failedLoginAttempts + 1;
    const lockedUntil = nextAttempts >= maxAttempts ? new Date(now.getTime() + lockSeconds * 1000) : user.lockedUntil;

    await this.db
      .update(adminUsers)
      .set({ failedLoginAttempts: nextAttempts, lockedUntil, updatedAt: now })
      .where(eq(adminUsers.id, user.id));

    return { ...user, failedLoginAttempts: nextAttempts, lockedUntil };
  }

  async createAuthEvent(input: {
    id: string;
    userId: string | null;
    emailHash: string | null;
    eventType: AuthEventType;
    status: "success" | "failure";
    requestId: string;
    createdAt: Date;
  }): Promise<void> {
    await this.db.insert(authEvents).values(input);
  }

  async bootstrapOwner(input: {
    id: string;
    email: string;
    displayName: string;
    passwordHash: string;
    now: Date;
  }): Promise<void> {
    await this.db
      .insert(adminUsers)
      .values({
        id: input.id,
        email: input.email,
        displayName: input.displayName,
        passwordHash: input.passwordHash,
        role: "owner",
        isActive: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
        createdAt: input.now,
        updatedAt: input.now,
      })
      .onConflictDoUpdate({
        target: adminUsers.email,
        set: {
          displayName: input.displayName,
          passwordHash: input.passwordHash,
          role: "owner",
          isActive: true,
          failedLoginAttempts: 0,
          lockedUntil: null,
          updatedAt: input.now,
        },
      });
  }

  countRawTokenMatches(rawToken: string) {
    return this.db.execute(sql`select count(*)::int as count from admin_sessions where token_hash = ${rawToken}`);
  }
}
