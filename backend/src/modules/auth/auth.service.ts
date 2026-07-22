import { randomUUID } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { AppEnv } from "../../config/env.js";
import { HttpError } from "../../middleware/error-handler.js";
import { createSessionToken, hashLogin, hashRequestMetadata, hashSessionToken, normalizeLogin, verifyPassword } from "./auth.crypto.js";
import type { AuthRepository } from "./auth.repository.js";
import type { AdminUserDto } from "./auth.schemas.js";
import type { AdminUserRow } from "../../db/schema/index.js";

export interface AuthContext {
  user: AdminUserDto;
  sessionId: string;
}

function toUserDto(user: AdminUserRow): AdminUserDto {
  return {
    id: user.id,
    login: user.login,
    displayName: user.displayName,
    role: user.role,
  };
}

export class AuthService {
  constructor(
    private readonly env: AppEnv,
    private readonly repository: AuthRepository,
  ) {}

  cookieOptions() {
    return {
      httpOnly: true,
      secure: this.env.COOKIE_SECURE,
      sameSite: "strict" as const,
      path: "/",
      maxAge: this.env.SESSION_TTL_SECONDS,
    };
  }

  clearCookieOptions() {
    return {
      httpOnly: true,
      secure: this.env.COOKIE_SECURE,
      sameSite: "strict" as const,
      path: "/",
      maxAge: 0,
    };
  }

  async login(input: { login: string; password: string; request: FastifyRequest; reply: FastifyReply }): Promise<AdminUserDto> {
    const now = new Date();
    const normalizedLogin = normalizeLogin(input.login);
    const loginHash = hashLogin(normalizedLogin, this.env.SESSION_TOKEN_SECRET);
    const user = await this.repository.findUserByLogin(normalizedLogin);

    if (!user || !user.isActive) {
      await this.repository.createAuthEvent({
        id: randomUUID(),
        userId: null,
        loginHash,
        eventType: "login_failure",
        status: "failure",
        requestId: input.request.id,
        createdAt: now,
      });
      throw new HttpError(401, "AUTHENTICATION_FAILED", "Authentication failed.");
    }

    if (user.lockedUntil && user.lockedUntil > now) {
      await this.repository.createAuthEvent({
        id: randomUUID(),
        userId: user.id,
        loginHash,
        eventType: "account_locked",
        status: "failure",
        requestId: input.request.id,
        createdAt: now,
      });
      throw new HttpError(401, "AUTHENTICATION_FAILED", "Authentication failed.");
    }

    const passwordValid = await verifyPassword(input.password, user.passwordHash);
    if (!passwordValid) {
      const updatedUser = await this.repository.markLoginFailure(user, this.env.MAX_FAILED_LOGIN_ATTEMPTS, this.env.LOGIN_LOCK_SECONDS, now);
      await this.repository.createAuthEvent({
        id: randomUUID(),
        userId: user.id,
        loginHash,
        eventType: updatedUser.lockedUntil && updatedUser.lockedUntil > now ? "account_locked" : "login_failure",
        status: "failure",
        requestId: input.request.id,
        createdAt: now,
      });
      throw new HttpError(401, "AUTHENTICATION_FAILED", "Authentication failed.");
    }

    const rawToken = createSessionToken();
    const tokenHash = hashSessionToken(rawToken, this.env.SESSION_TOKEN_SECRET);
    const expiresAt = new Date(now.getTime() + this.env.SESSION_TTL_SECONDS * 1000);
    const userAgent = input.request.headers["user-agent"];
    const ip = input.request.ip;

    await this.repository.createSession({
      id: randomUUID(),
      userId: user.id,
      tokenHash,
      createdAt: now,
      expiresAt,
      userAgentHash: hashRequestMetadata(typeof userAgent === "string" ? userAgent : undefined, this.env.SESSION_TOKEN_SECRET),
      ipHash: hashRequestMetadata(ip, this.env.SESSION_TOKEN_SECRET),
    });
    await this.repository.markLoginSuccess(user.id, now);
    await this.repository.createAuthEvent({
      id: randomUUID(),
      userId: user.id,
      loginHash,
      eventType: "login_success",
      status: "success",
      requestId: input.request.id,
      createdAt: now,
    });

    input.reply.setCookie(this.env.SESSION_COOKIE_NAME, rawToken, this.cookieOptions());
    return toUserDto(user);
  }

  async authenticate(request: FastifyRequest): Promise<AuthContext> {
    const rawToken = request.cookies[this.env.SESSION_COOKIE_NAME];
    if (!rawToken) {
      throw new HttpError(401, "UNAUTHORIZED", "Authentication required.");
    }

    const tokenHash = hashSessionToken(rawToken, this.env.SESSION_TOKEN_SECRET);
    const now = new Date();
    const [record] = await this.repository.findActiveSession(tokenHash, now);

    if (!record) {
      await this.repository.createAuthEvent({
        id: randomUUID(),
        userId: null,
        loginHash: null,
        eventType: "session_expired",
        status: "failure",
        requestId: request.id,
        createdAt: now,
      });
      throw new HttpError(401, "UNAUTHORIZED", "Authentication required.");
    }

    await this.repository.touchSession(record.session.id, now);
    return {
      user: toUserDto(record.user),
      sessionId: record.session.id,
    };
  }

  async logout(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const rawToken = request.cookies[this.env.SESSION_COOKIE_NAME];
    const now = new Date();
    if (rawToken) {
      await this.repository.revokeSession(hashSessionToken(rawToken, this.env.SESSION_TOKEN_SECRET), now);
    }
    await this.repository.createAuthEvent({
      id: randomUUID(),
      userId: null,
      loginHash: null,
      eventType: "logout",
      status: "success",
      requestId: request.id,
      createdAt: now,
    });
    reply.clearCookie(this.env.SESSION_COOKIE_NAME, this.clearCookieOptions());
  }
}
