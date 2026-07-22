import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { buildApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";
import { createDatabase } from "../src/db/client.js";
import { loadFrontendProjects, seedProjects } from "../scripts/seed-projects.js";
import { hashPassword, hashSessionToken } from "../src/modules/auth/auth.crypto.js";

const origin = "http://127.0.0.1:5510";
const email = `owner-${randomUUID()}@example.test`;
const password = `Owner${randomUUID().replaceAll("-", "")}123`;
const invalidPassword = `Invalid${randomUUID().replaceAll("-", "")}123`;
const env = loadEnv({ ...process.env, NODE_ENV: "test", LOGIN_RATE_LIMIT: "50" });
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const app = buildApp(env, pool);

async function resetOwner(): Promise<void> {
  await pool.query("delete from auth_events");
  await pool.query("delete from admin_sessions");
  await pool.query("delete from admin_users where email = $1", [email]);
  await pool.query(
    `
      insert into admin_users (
        id, email, password_hash, display_name, role, is_active,
        failed_login_attempts, created_at, updated_at
      )
      values ($1, $2, $3, 'Maksim', 'owner', true, 0, now(), now())
    `,
    [randomUUID(), email, await hashPassword(password)],
  );
}

async function login(loginPassword = password) {
  return app.inject({
    method: "POST",
    url: "/api/v1/admin/auth/login",
    headers: { origin },
    payload: { email, password: loginPassword },
  });
}

before(async () => {
  await migrate(createDatabase(pool), { migrationsFolder: "./drizzle" });
  await seedProjects(pool, await loadFrontendProjects());
  await resetOwner();
});

after(async () => {
  await pool.query("delete from auth_events");
  await pool.query("delete from admin_sessions");
  await pool.query("delete from admin_users where email = $1", [email]);
  await app.close();
  await pool.end();
});

test("successful login sets HttpOnly session cookie and returns minimal user", async () => {
  await resetOwner();
  const response = await login();
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.displayName, "Maksim");
  assert.equal(response.json().data.role, "owner");
  assert.equal("passwordHash" in response.json().data, false);

  const setCookie = response.headers["set-cookie"];
  assert.match(String(setCookie), /maxpar_cms_session=/);
  assert.match(String(setCookie), /HttpOnly/);
  assert.match(String(setCookie), /SameSite=Strict/);
  assert.doesNotMatch(response.body, /password/i);
});

test("invalid password and unknown email return generic authentication failure", async () => {
  await resetOwner();
  const invalidPasswordResponse = await login(invalidPassword);
  assert.equal(invalidPasswordResponse.statusCode, 401);
  assert.equal(invalidPasswordResponse.json().error.code, "AUTHENTICATION_FAILED");

  const unknownEmail = await app.inject({
    method: "POST",
    url: "/api/v1/admin/auth/login",
    headers: { origin },
    payload: { email: "unknown@example.test", password },
  });
  assert.equal(unknownEmail.statusCode, 401);
  assert.equal(unknownEmail.json().error.code, "AUTHENTICATION_FAILED");
});

test("inactive account cannot login", async () => {
  await resetOwner();
  await pool.query("update admin_users set is_active = false where email = $1", [email]);
  const response = await login();
  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, "AUTHENTICATION_FAILED");
});

test("account lock/cooldown after repeated failures", async () => {
  await resetOwner();
  for (let index = 0; index < env.MAX_FAILED_LOGIN_ATTEMPTS; index += 1) {
    const response = await login(invalidPassword);
    assert.equal(response.statusCode, 401);
  }

  const lockedResponse = await login();
  assert.equal(lockedResponse.statusCode, 401);
  assert.equal(lockedResponse.json().error.code, "AUTHENTICATION_FAILED");
});

test("/me accepts valid session and rejects missing session", async () => {
  await resetOwner();
  const loginResponse = await login();
  const cookie = String(loginResponse.headers["set-cookie"]).split(";")[0];

  const valid = await app.inject({ method: "GET", url: "/api/v1/admin/auth/me", headers: { cookie } });
  assert.equal(valid.statusCode, 200);
  assert.equal(valid.json().data.displayName, "Maksim");

  const missing = await app.inject({ method: "GET", url: "/api/v1/admin/auth/me" });
  assert.equal(missing.statusCode, 401);
});

test("logout revokes session and clears cookie", async () => {
  await resetOwner();
  const loginResponse = await login();
  const cookie = String(loginResponse.headers["set-cookie"]).split(";")[0];

  const logout = await app.inject({ method: "POST", url: "/api/v1/admin/auth/logout", headers: { origin, cookie } });
  assert.equal(logout.statusCode, 200);
  assert.match(String(logout.headers["set-cookie"]), /Max-Age=0/);

  const afterLogout = await app.inject({ method: "GET", url: "/api/v1/admin/auth/me", headers: { cookie } });
  assert.equal(afterLogout.statusCode, 401);
});

test("expired session is rejected", async () => {
  await resetOwner();
  const user = await pool.query<{ id: string }>("select id from admin_users where email = $1", [email]);
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

  const loginResponse = await login();
  const cookie = String(loginResponse.headers["set-cookie"]).split(";")[0];
  const withSession = await app.inject({ method: "GET", url: "/api/v1/admin/projects", headers: { cookie } });
  assert.equal(withSession.statusCode, 200);
  assert.equal(withSession.json().meta.count, 3);
  assert.equal(withSession.json().data[0].translations.en.title, "Construction Management Control Center");
});

test("raw session token is not stored in DB and auth events are created", async () => {
  await resetOwner();
  const loginResponse = await login();
  const rawToken = String(loginResponse.headers["set-cookie"]).match(/maxpar_cms_session=([^;]+)/)?.[1] ?? "";
  assert.ok(rawToken.length > 0);

  const storedRaw = await pool.query<{ count: number }>("select count(*)::int as count from admin_sessions where token_hash = $1", [rawToken]);
  assert.equal(storedRaw.rows[0]?.count, 0);

  const events = await pool.query<{ event_type: string }>("select event_type from auth_events order by created_at desc limit 1");
  assert.equal(events.rows[0]?.event_type, "login_success");
});

test("admin unsafe methods reject missing origin", async () => {
  await resetOwner();
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/admin/auth/login",
    payload: { email, password },
  });
  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error.code, "FORBIDDEN_ORIGIN");
});
