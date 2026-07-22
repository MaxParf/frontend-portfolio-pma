import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { buildApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";
import { createDatabase } from "../src/db/client.js";
import { loadFrontendProjects, seedProjects } from "../scripts/seed-projects.js";
import { DEFAULT_OWNER_LOGIN, hashLogin, hashPassword, hashSessionToken, normalizeLogin } from "../src/modules/auth/auth.crypto.js";
import { loginRequestSchema } from "../src/modules/auth/auth.schemas.js";
import { AuthRepository } from "../src/modules/auth/auth.repository.js";
import { resolveOwnerPassword } from "../scripts/owner-password-source.js";

const origin = "http://127.0.0.1:5510";
const login = DEFAULT_OWNER_LOGIN;
const password = `Owner${randomUUID().replaceAll("-", "")}123`;
const newPassword = `Owner${randomUUID().replaceAll("-", "")}456`;
const invalidPassword = `Invalid${randomUUID().replaceAll("-", "")}123`;
const invalidLogin = `@unknown-${randomUUID()}.fed`;
const env = loadEnv({ ...process.env, NODE_ENV: "test", LOGIN_RATE_LIMIT: "50" });
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const db = createDatabase(pool);
const app = buildApp(env, pool);
const repository = new AuthRepository(db);

async function clearAuth(): Promise<void> {
  await pool.query("delete from auth_events");
  await pool.query("delete from admin_sessions");
  await pool.query("delete from admin_users");
}

async function resetOwner(ownerPassword = password): Promise<void> {
  await clearAuth();
  await repository.bootstrapOwner({
    id: randomUUID(),
    login,
    displayName: "Maksim",
    passwordHash: await hashPassword(ownerPassword),
    now: new Date(),
  });
}

async function loginRequest(loginInput = login, loginPassword = password) {
  return app.inject({
    method: "POST",
    url: "/api/v1/admin/auth/login",
    headers: { origin },
    payload: { login: loginInput, password: loginPassword },
  });
}

before(async () => {
  await migrate(db, { migrationsFolder: "./drizzle" });
  await seedProjects(pool, await loadFrontendProjects());
  await resetOwner();
});

after(async () => {
  await clearAuth();
  await app.close();
  await pool.end();
});

test("login schema accepts owner login and does not require email", () => {
  const parsed = loginRequestSchema.parse({ login: " @MaxPar.Fed ", password });
  assert.equal(parsed.login, "@MaxPar.Fed");
  assert.equal("email" in parsed, false);
});

test("GET / returns API service status", async () => {
  const response = await app.inject({ method: "GET", url: "/" });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().status, "ok");
});

test("login normalization trims and lowercases without removing @", () => {
  assert.equal(normalizeLogin("  @MaxPar.Fed  "), "@maxpar.fed");
});

test("successful login sets HttpOnly session cookie and returns minimal owner", async () => {
  await resetOwner();
  const response = await loginRequest("  @MaxPar.Fed  ");
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.login, login);
  assert.equal(response.json().data.displayName, "Maksim");
  assert.equal(response.json().data.role, "owner");
  assert.equal("passwordHash" in response.json().data, false);
  assert.equal("tokenHash" in response.json().data, false);

  const setCookie = response.headers["set-cookie"];
  assert.match(String(setCookie), /maxpar_cms_session=/);
  assert.match(String(setCookie), /HttpOnly/);
  assert.match(String(setCookie), /SameSite=Strict/);
  assert.doesNotMatch(response.body, /password/i);
});

test("invalid login and invalid password return the same generic authentication failure", async () => {
  await resetOwner();
  const invalidLoginResponse = await loginRequest(invalidLogin);
  assert.equal(invalidLoginResponse.statusCode, 401);
  assert.equal(invalidLoginResponse.json().error.code, "AUTHENTICATION_FAILED");
  assert.equal(invalidLoginResponse.json().error.message, "Authentication failed.");

  const invalidPasswordResponse = await loginRequest(login, invalidPassword);
  assert.equal(invalidPasswordResponse.statusCode, 401);
  assert.equal(invalidPasswordResponse.json().error.code, "AUTHENTICATION_FAILED");
  assert.equal(invalidPasswordResponse.json().error.message, invalidLoginResponse.json().error.message);
});

test("inactive owner cannot login", async () => {
  await resetOwner();
  await pool.query("update admin_users set is_active = false where login = $1", [login]);
  const response = await loginRequest();
  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, "AUTHENTICATION_FAILED");
});

test("account lock/cooldown after repeated failures", async () => {
  await resetOwner();
  for (let index = 0; index < env.MAX_FAILED_LOGIN_ATTEMPTS; index += 1) {
    const response = await loginRequest(login, invalidPassword);
    assert.equal(response.statusCode, 401);
  }

  const lockedResponse = await loginRequest();
  assert.equal(lockedResponse.statusCode, 401);
  assert.equal(lockedResponse.json().error.code, "AUTHENTICATION_FAILED");
});

test("/me accepts valid session, returns login, and rejects missing session", async () => {
  await resetOwner();
  const loginResponse = await loginRequest();
  const cookie = String(loginResponse.headers["set-cookie"]).split(";")[0];

  const valid = await app.inject({ method: "GET", url: "/api/v1/admin/auth/me", headers: { cookie } });
  assert.equal(valid.statusCode, 200);
  assert.equal(valid.json().data.login, login);
  assert.equal(valid.json().data.displayName, "Maksim");
  assert.equal("passwordHash" in valid.json().data, false);

  const missing = await app.inject({ method: "GET", url: "/api/v1/admin/auth/me" });
  assert.equal(missing.statusCode, 401);
});

test("logout revokes session and clears cookie", async () => {
  await resetOwner();
  const loginResponse = await loginRequest();
  const cookie = String(loginResponse.headers["set-cookie"]).split(";")[0];

  const logout = await app.inject({ method: "POST", url: "/api/v1/admin/auth/logout", headers: { origin, cookie } });
  assert.equal(logout.statusCode, 200);
  assert.match(String(logout.headers["set-cookie"]), /Max-Age=0/);

  const afterLogout = await app.inject({ method: "GET", url: "/api/v1/admin/auth/me", headers: { cookie } });
  assert.equal(afterLogout.statusCode, 401);
});

test("expired session is rejected", async () => {
  await resetOwner();
  const user = await pool.query<{ id: string }>("select id from admin_users where login = $1", [login]);
  const rawToken = "expired-token";
  await pool.query(
    `
      insert into admin_sessions (id, user_id, token_hash, created_at, expires_at, last_seen_at)
      values ($1, $2, $3, now() - interval '2 hours', now() - interval '1 hour', now() - interval '1 hour')
    `,
    [randomUUID(), user.rows[0]?.id, hashSessionToken(rawToken, env.SESSION_TOKEN_SECRET)],
  );

  const response = await app.inject({
    method: "GET",
    url: "/api/v1/admin/auth/me",
    headers: { cookie: `${env.SESSION_COOKIE_NAME}=${rawToken}` },
  });
  assert.equal(response.statusCode, 401);
});

test("protected project endpoint requires session and returns data with owner session", async () => {
  await resetOwner();
  const noSession = await app.inject({ method: "GET", url: "/api/v1/admin/projects" });
  assert.equal(noSession.statusCode, 401);

  const loginResponse = await loginRequest();
  const cookie = String(loginResponse.headers["set-cookie"]).split(";")[0];
  const withSession = await app.inject({ method: "GET", url: "/api/v1/admin/projects", headers: { cookie } });
  assert.equal(withSession.statusCode, 200);
  assert.equal(withSession.json().meta.count, 3);
  assert.equal(withSession.json().data[0].translations.en.title, "Construction Management Control Center");
});

test("bootstrap creates one owner and repeat bootstrap updates without a second row", async () => {
  await clearAuth();
  const created = await repository.bootstrapOwner({
    id: randomUUID(),
    login,
    displayName: "Maksim",
    passwordHash: await hashPassword(password),
    now: new Date(),
  });
  assert.equal(created, "created");

  const updated = await repository.bootstrapOwner({
    id: randomUUID(),
    login: " @MaxPar.Fed ",
    displayName: "Maksim",
    passwordHash: await hashPassword(newPassword),
    now: new Date(),
  });
  assert.equal(updated, "updated");

  const owners = await pool.query<{ count: number; login: string }>("select count(*)::int as count, min(login) as login from admin_users where role = 'owner'");
  assert.equal(owners.rows[0]?.count, 1);
  assert.equal(owners.rows[0]?.login, login);
});

test("database blocks a second owner", async () => {
  await resetOwner();
  await assert.rejects(
    pool.query(
      `
        insert into admin_users (
          id, login, password_hash, display_name, role, is_active,
          failed_login_attempts, created_at, updated_at
        )
        values ($1, $2, $3, 'Second', 'owner', true, 0, now(), now())
      `,
      [randomUUID(), "@second-owner.fed", await hashPassword(newPassword)],
    ),
  );
});

test("password update revokes active sessions and old password no longer works", async () => {
  await resetOwner();
  const loginResponse = await loginRequest();
  const cookie = String(loginResponse.headers["set-cookie"]).split(";")[0];
  const beforeHash = await pool.query<{ password_hash: string }>("select password_hash from admin_users where login = $1", [login]);

  const beforeBootstrap = await app.inject({ method: "GET", url: "/api/v1/admin/auth/me", headers: { cookie } });
  assert.equal(beforeBootstrap.statusCode, 200);
  await pool.query("update admin_users set failed_login_attempts = 4, locked_until = now() + interval '15 minutes' where login = $1", [login]);

  await repository.bootstrapOwner({
    id: randomUUID(),
    login,
    displayName: "Maksim",
    passwordHash: await hashPassword(newPassword),
    now: new Date(),
  });

  const afterBootstrap = await app.inject({ method: "GET", url: "/api/v1/admin/auth/me", headers: { cookie } });
  assert.equal(afterBootstrap.statusCode, 401);

  const afterOwner = await pool.query<{ password_hash: string; failed_login_attempts: number; locked_until: Date | null }>(
    "select password_hash, failed_login_attempts, locked_until from admin_users where login = $1",
    [login],
  );
  assert.notEqual(afterOwner.rows[0]?.password_hash, beforeHash.rows[0]?.password_hash);
  assert.equal(afterOwner.rows[0]?.failed_login_attempts, 0);
  assert.equal(afterOwner.rows[0]?.locked_until, null);

  const oldPassword = await loginRequest(login, password);
  assert.equal(oldPassword.statusCode, 401);

  const updatedPassword = await loginRequest(login, newPassword);
  assert.equal(updatedPassword.statusCode, 200);
});

test("password policy failure does not change owner hash or revoke sessions", async () => {
  await resetOwner();
  const loginResponse = await loginRequest();
  const beforeHash = await pool.query<{ password_hash: string }>("select password_hash from admin_users where login = $1", [login]);
  const activeBefore = await pool.query<{ count: number }>("select count(*)::int as count from admin_sessions where revoked_at is null");

  await assert.rejects(hashPassword("short1"), /Password must be at least 12 characters/);

  const afterHash = await pool.query<{ password_hash: string }>("select password_hash from admin_users where login = $1", [login]);
  const activeAfter = await pool.query<{ count: number }>("select count(*)::int as count from admin_sessions where revoked_at is null");
  assert.equal(afterHash.rows[0]?.password_hash, beforeHash.rows[0]?.password_hash);
  assert.equal(activeBefore.rows[0]?.count, 1);
  assert.equal(activeAfter.rows[0]?.count, 1);
  assert.equal(loginResponse.statusCode, 200);
});

test("password confirmation mismatch happens before owner state changes", async () => {
  await resetOwner();
  const loginResponse = await loginRequest();
  await pool.query("update admin_users set failed_login_attempts = 3, locked_until = now() + interval '15 minutes' where login = $1", [login]);
  const before = await pool.query<{ password_hash: string; failed_login_attempts: number; locked_until: Date | null }>(
    "select password_hash, failed_login_attempts, locked_until from admin_users where login = $1",
    [login],
  );

  const responses = ["FirstPassword123", "SecondPassword123"];
  await assert.rejects(
    resolveOwnerPassword({
      env: {},
      input: { isTTY: true } as NodeJS.ReadStream,
      promptPassword: async () => responses.shift() ?? "",
    }),
    /confirmation does not match/,
  );

  const after = await pool.query<{ password_hash: string; failed_login_attempts: number; locked_until: Date | null }>(
    "select password_hash, failed_login_attempts, locked_until from admin_users where login = $1",
    [login],
  );
  const activeAfter = await pool.query<{ count: number }>("select count(*)::int as count from admin_sessions where revoked_at is null");
  assert.equal(after.rows[0]?.password_hash, before.rows[0]?.password_hash);
  assert.equal(after.rows[0]?.failed_login_attempts, before.rows[0]?.failed_login_attempts);
  assert.equal(after.rows[0]?.locked_until?.getTime(), before.rows[0]?.locked_until?.getTime());
  assert.equal(activeAfter.rows[0]?.count, 1);
  assert.equal(loginResponse.statusCode, 200);
});

test("raw password, raw session token, and raw login are not stored in auth events", async () => {
  await resetOwner();
  const loginResponse = await loginRequest();
  const rawToken = String(loginResponse.headers["set-cookie"]).match(/maxpar_cms_session=([^;]+)/)?.[1] ?? "";
  assert.ok(rawToken.length > 0);

  const storedRaw = await pool.query<{ count: number }>("select count(*)::int as count from admin_sessions where token_hash = $1", [rawToken]);
  assert.equal(storedRaw.rows[0]?.count, 0);

  const storedPassword = await pool.query<{ count: number }>("select count(*)::int as count from admin_users where password_hash = $1", [password]);
  assert.equal(storedPassword.rows[0]?.count, 0);

  await loginRequest(invalidLogin);
  const events = await pool.query<{ event_type: string; login_hash: string | null }>("select event_type, login_hash from auth_events order by created_at desc limit 1");
  assert.equal(events.rows[0]?.event_type, "login_failure");
  assert.equal(events.rows[0]?.login_hash, hashLogin(invalidLogin, env.SESSION_TOKEN_SECRET));
  assert.notEqual(events.rows[0]?.login_hash, invalidLogin);
  assert.notEqual(events.rows[0]?.login_hash, password);
});

test("admin unsafe methods reject missing origin", async () => {
  await resetOwner();
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/admin/auth/login",
    payload: { login, password },
  });
  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error.code, "FORBIDDEN_ORIGIN");
});

test("draft and publish routes preserve public isolation, revisions, conflicts, and audit history", async () => {
  await resetOwner();
  const unauthorized = await app.inject({ method: "GET", url: "/api/v1/admin/projects/project-bradbury/editor" });
  assert.equal(unauthorized.statusCode, 401);

  const session = await loginRequest();
  const cookie = String(session.headers["set-cookie"]).split(";")[0];
  const headers = { cookie, origin };
  const editorResponse = await app.inject({ method: "GET", url: "/api/v1/admin/projects/project-bradbury/editor", headers: { cookie } });
  assert.equal(editorResponse.statusCode, 200);
  const initialEditor = editorResponse.json().data;
  const baseline = structuredClone(initialEditor.published.content);
  const publicBefore = await app.inject({ method: "GET", url: "/api/v1/projects/project-bradbury?locale=en" });
  const baselinePublic = publicBefore.json().data;

  try {
    const invalidOrigin = await app.inject({ method: "PUT", url: "/api/v1/admin/projects/project-bradbury/draft", headers: { cookie, origin: "http://invalid.local" }, payload: { baseRevisionId: initialEditor.published.revisionId, expectedDraftRevisionId: initialEditor.draft?.revisionId ?? null, content: baseline } });
    assert.equal(invalidOrigin.statusCode, 403);

    const invalidContent = structuredClone(baseline); invalidContent.slug = "invalid slug";
    const invalidDraft = await app.inject({ method: "PUT", url: "/api/v1/admin/projects/project-bradbury/draft", headers, payload: { baseRevisionId: initialEditor.published.revisionId, expectedDraftRevisionId: initialEditor.draft?.revisionId ?? null, content: invalidContent } });
    assert.equal(invalidDraft.statusCode, 400);

    const firstContent = structuredClone(baseline); firstContent.translations.en.title = `${baseline.translations.en.title} draft test`;
    const firstDraft = await app.inject({ method: "PUT", url: "/api/v1/admin/projects/project-bradbury/draft", headers, payload: { baseRevisionId: initialEditor.published.revisionId, expectedDraftRevisionId: initialEditor.draft?.revisionId ?? null, content: firstContent } });
    assert.equal(firstDraft.statusCode, 200);
    const firstRevisionId = firstDraft.json().data.revisionId;
    assert.equal((await app.inject({ method: "GET", url: "/api/v1/projects/project-bradbury?locale=en" })).json().data.title, baselinePublic.title);

    const staleSave = await app.inject({ method: "PUT", url: "/api/v1/admin/projects/project-bradbury/draft", headers, payload: { baseRevisionId: initialEditor.published.revisionId, expectedDraftRevisionId: initialEditor.draft?.revisionId ?? null, content: firstContent } });
    assert.equal(staleSave.statusCode, 409);
    assert.equal(staleSave.json().error.code, "DRAFT_CONFLICT");

    const secondContent = structuredClone(firstContent); secondContent.translations.en.title = `${baseline.translations.en.title} published test`;
    const secondDraft = await app.inject({ method: "PUT", url: "/api/v1/admin/projects/project-bradbury/draft", headers, payload: { baseRevisionId: initialEditor.published.revisionId, expectedDraftRevisionId: firstRevisionId, content: secondContent } });
    assert.equal(secondDraft.statusCode, 200);
    const secondRevisionId = secondDraft.json().data.revisionId;
    const pointersBeforePublish = await pool.query<{ current_published_revision_id: string; current_draft_revision_id: string }>("select current_published_revision_id,current_draft_revision_id from projects where slug='project-bradbury'");
    assert.equal(pointersBeforePublish.rows[0]?.current_published_revision_id, initialEditor.published.revisionId);
    assert.equal(pointersBeforePublish.rows[0]?.current_draft_revision_id, secondRevisionId);

    const stalePublish = await app.inject({ method: "POST", url: "/api/v1/admin/projects/project-bradbury/publish", headers, payload: { expectedDraftRevisionId: firstRevisionId, confirmation: true } });
    assert.equal(stalePublish.statusCode, 409);
    assert.equal(stalePublish.json().error.code, "PUBLISH_CONFLICT");
    const published = await app.inject({ method: "POST", url: "/api/v1/admin/projects/project-bradbury/publish", headers, payload: { expectedDraftRevisionId: secondRevisionId, confirmation: true } });
    assert.equal(published.statusCode, 200);
    assert.equal((await app.inject({ method: "GET", url: "/api/v1/projects/project-bradbury?locale=en" })).json().data.title, secondContent.translations.en.title);
    const pointersAfterPublish = await pool.query<{ current_published_revision_id: string; current_draft_revision_id: string | null }>("select current_published_revision_id,current_draft_revision_id from projects where slug='project-bradbury'");
    assert.equal(pointersAfterPublish.rows[0]?.current_published_revision_id, published.json().data.revisionId);
    assert.equal(pointersAfterPublish.rows[0]?.current_draft_revision_id, null);
    const audit = await app.inject({ method: "GET", url: "/api/v1/admin/audit-events?slug=project-bradbury", headers: { cookie } });
    assert.equal(audit.statusCode, 200);
    assert.ok(audit.json().data.some((event: { eventType: string }) => event.eventType === "project_draft_saved"));
    assert.ok(audit.json().data.some((event: { eventType: string }) => event.eventType === "project_published"));

    const incomplete = structuredClone(secondContent); incomplete.translations.en.description = "";
    const incompleteDraft = await app.inject({ method: "PUT", url: "/api/v1/admin/projects/project-bradbury/draft", headers, payload: { baseRevisionId: published.json().data.revisionId, expectedDraftRevisionId: null, content: incomplete } });
    assert.equal(incompleteDraft.statusCode, 200);
    const rejectedPublish = await app.inject({ method: "POST", url: "/api/v1/admin/projects/project-bradbury/publish", headers, payload: { expectedDraftRevisionId: incompleteDraft.json().data.revisionId, confirmation: true } });
    assert.equal(rejectedPublish.statusCode, 400);
    assert.equal((await app.inject({ method: "GET", url: "/api/v1/projects/project-bradbury?locale=en" })).json().data.title, secondContent.translations.en.title);
  } finally {
    const current = (await app.inject({ method: "GET", url: "/api/v1/admin/projects/project-bradbury/editor", headers: { cookie } })).json().data;
    const restore = await app.inject({ method: "PUT", url: "/api/v1/admin/projects/project-bradbury/draft", headers, payload: { baseRevisionId: current.published.revisionId, expectedDraftRevisionId: current.draft?.revisionId ?? null, content: baseline } });
    assert.equal(restore.statusCode, 200);
    const restored = await app.inject({ method: "POST", url: "/api/v1/admin/projects/project-bradbury/publish", headers, payload: { expectedDraftRevisionId: restore.json().data.revisionId, confirmation: true } });
    assert.equal(restored.statusCode, 200);
    assert.deepEqual((await app.inject({ method: "GET", url: "/api/v1/projects/project-bradbury?locale=en" })).json().data, baselinePublic);
  }
});
