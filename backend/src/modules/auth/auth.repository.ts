import { and, eq, gt, isNull, sql } from "drizzle-orm";
import type { PortfolioDatabase } from "../../db/client.js";
import { adminSessions, adminUsers, authEvents, type AdminUserRow } from "../../db/schema/index.js";
import { normalizeLogin } from "./auth.crypto.js";
import { assertOwnerBootstrapPolicy, type OwnerBootstrapPolicy } from "../../config/database-identity.js";

export type AuthEventType = "login_success" | "login_failure" | "logout" | "session_expired" | "account_locked";

export class AuthRepository {
  constructor(private readonly db: PortfolioDatabase) {}

  findUserByLogin(login: string): Promise<AdminUserRow | undefined> {
    return this.db.query.adminUsers.findFirst({ where: eq(adminUsers.login, login) });
  }

  findOwners(): Promise<AdminUserRow[]> {
    return this.db.query.adminUsers.findMany({ where: eq(adminUsers.role, "owner") });
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
    loginHash: string | null;
    eventType: AuthEventType;
    status: "success" | "failure";
    requestId: string;
    createdAt: Date;
  }): Promise<void> {
    await this.db.insert(authEvents).values(input);
  }

  async bootstrapOwner(input: {
    id: string;
    login: string;
    displayName: string;
    passwordHash: string;
    now: Date;
  }, policy: OwnerBootstrapPolicy): Promise<{ result: "created" | "updated"; ownerId: string; revokedSessionCount: number }> {
    assertOwnerBootstrapPolicy(policy);
    const normalizedLogin = normalizeLogin(input.login);

    return this.db.transaction(async (tx) => {
      const owners = await tx.query.adminUsers.findMany({ where: eq(adminUsers.role, "owner") });
      if (owners.length > 1) {
        throw new Error("Inconsistent admin_users state: multiple owners exist.");
      }

      const existingOwner = owners[0];
      if (existingOwner) {
        await tx
          .update(adminUsers)
          .set({
            login: normalizedLogin,
            displayName: input.displayName,
            passwordHash: input.passwordHash,
            role: "owner",
            isActive: true,
            failedLoginAttempts: 0,
            lockedUntil: null,
            updatedAt: input.now,
          })
          .where(eq(adminUsers.id, existingOwner.id));
        const revokedSessions = await tx
          .update(adminSessions)
          .set({ revokedAt: input.now })
          .where(and(eq(adminSessions.userId, existingOwner.id), isNull(adminSessions.revokedAt)))
          .returning({ id: adminSessions.id });
        return { result: "updated", ownerId: existingOwner.id, revokedSessionCount: revokedSessions.length };
      }

      await tx.insert(adminUsers).values({
        id: input.id,
        login: normalizedLogin,
        displayName: input.displayName,
        passwordHash: input.passwordHash,
        role: "owner",
        isActive: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
        createdAt: input.now,
        updatedAt: input.now,
      });
      return { result: "created", ownerId: input.id, revokedSessionCount: 0 };
    });
  }

  countRawTokenMatches(rawToken: string) {
    return this.db.execute(sql`select count(*)::int as count from admin_sessions where token_hash = ${rawToken}`);
  }
}
