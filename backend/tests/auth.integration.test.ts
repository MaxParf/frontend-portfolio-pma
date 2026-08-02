import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test, { after, before } from "node:test";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { buildApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";
import { assertTestDatabase, createOwnerBootstrapPolicy } from "../src/config/database-identity.js";
import { createDatabase } from "../src/db/client.js";
import { loadFrontendProjects, seedProjects } from "../scripts/seed-projects.js";
import { ProjectDraftRepository, type PublishWriteStage } from "../src/modules/admin-projects/project-draft.repository.js";
import { ensureNormalizedProjectLinksFixture } from "./helpers/ensure-normalized-project-links-fixture.js";
import { DEFAULT_OWNER_LOGIN, hashLogin, hashPassword, hashSessionToken, normalizeLogin } from "../src/modules/auth/auth.crypto.js";
import { loginRequestSchema } from "../src/modules/auth/auth.schemas.js";
import { AuthRepository } from "../src/modules/auth/auth.repository.js";
import { resolveOwnerPassword } from "../scripts/owner-password-source.js";
import { verifyProjectLifecycle } from "../scripts/verify-project-lifecycle.js";

const origin = "http://127.0.0.1:5510";
const login = DEFAULT_OWNER_LOGIN;
const password = `Owner${randomUUID().replaceAll("-", "")}123`;
const newPassword = `Owner${randomUUID().replaceAll("-", "")}456`;
const invalidPassword = `Invalid${randomUUID().replaceAll("-", "")}123`;
const invalidLogin = `@unknown-${randomUUID()}.fed`;
const env = loadEnv({ ...process.env, NODE_ENV: "test", LOGIN_RATE_LIMIT: "50" });
assertTestDatabase(env, "Auth integration test setup");
const bootstrapPolicy = createOwnerBootstrapPolicy(env);
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
  }, bootstrapPolicy);
}

async function loginRequest(loginInput = login, loginPassword = password) {
  return app.inject({
    method: "POST",
    url: "/api/v1/admin/auth/login",
    headers: { origin },
    payload: { login: loginInput, password: loginPassword },
  });
}
function localeSavePayload(editor: any, content: unknown) { return { publicationCapability: "legacy", baseRevisionId: editor.published?.revisionId ?? null, expectedDraftRevisionId: editor.draft?.revisionId ?? null, content }; }

before(async () => {
  await migrate(db, { migrationsFolder: "./drizzle" });
  await ensureNormalizedProjectLinksFixture(pool);
  await seedProjects(pool, await loadFrontendProjects(), { mode: "legacy-bootstrap" });
  await ensureNormalizedProjectLinksFixture(pool);
  await pool.query("update projects set current_published_revision_id=null,current_draft_revision_id=null where external_key in ('construction-management-control-center','project-bradbury','foodai')");
  await pool.query("delete from project_revisions where project_id in (select id from projects where external_key in ('construction-management-control-center','project-bradbury','foodai'))");
  await new ProjectDraftRepository(pool).backfill();
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

test("CORS permits credentials only for the configured CMS origin", async () => {
  const cmsResponse = await app.inject({ method: "GET", url: "/health", headers: { origin } });
  assert.equal(cmsResponse.headers["access-control-allow-origin"], origin);
  assert.equal(cmsResponse.headers["access-control-allow-credentials"], "true");

  const publicOrigin = env.CORS_ORIGINS.find((candidate) => !env.CMS_ORIGINS.includes(candidate));
  assert.ok(publicOrigin);
  const publicResponse = await app.inject({ method: "GET", url: "/health", headers: { origin: publicOrigin } });
  assert.equal(publicResponse.headers["access-control-allow-origin"], publicOrigin);
  assert.equal(publicResponse.headers["access-control-allow-credentials"], undefined);

  const localPublicOrigin = "http://127.0.0.1:5500";
  const localPublicResponse = await app.inject({ method: "GET", url: "/health", headers: { origin: localPublicOrigin } });
  assert.equal(localPublicResponse.headers["access-control-allow-origin"], localPublicOrigin);
  assert.equal(localPublicResponse.headers["access-control-allow-credentials"], undefined);
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
  assert.equal(withSession.json().data[0].translations.values.en.title, "Construction Management Control Center");
});

test("published-without-draft detail is read-only and clone/delete preserves public publication", async () => {
  await resetOwner();
  const session = await loginRequest(); const cookie = String(session.headers["set-cookie"]).split(";")[0];
  const unauthorized = await app.inject({ method: "GET", url: "/api/v1/admin/projects/project-bradbury/published" });
  assert.equal(unauthorized.statusCode, 401);
  const before = await pool.query<any>("select current_published_revision_id,current_draft_revision_id from projects where slug='project-bradbury'");
  assert.equal(before.rows[0].current_draft_revision_id, null);
  const publicBefore = await app.inject({ method: "GET", url: "/api/v1/projects/project-bradbury?locale=en" });
  const detail = await app.inject({ method: "GET", url: "/api/v1/admin/projects/project-bradbury/published", headers: { cookie } });
  assert.equal(detail.statusCode, 200, detail.body);
  assert.equal(detail.json().data.draft, null);
  assert.equal(detail.json().data.editable.source, "published");
  assert.equal(detail.json().data.published.revisionId, before.rows[0].current_published_revision_id);
  const create = await app.inject({ method: "POST", url: "/api/v1/admin/projects/project-bradbury/draft/from-published", headers: { cookie, origin } });
  assert.equal(create.statusCode, 200, create.body);
  const draft = create.json().data.draft;
  assert.ok(draft);
  assert.notEqual(draft.revisionId, before.rows[0].current_published_revision_id);
  assert.equal(draft.baseRevisionId, before.rows[0].current_published_revision_id);
  assert.deepEqual(draft.content, detail.json().data.published.content);
  const duplicate = await app.inject({ method: "POST", url: "/api/v1/admin/projects/project-bradbury/draft/from-published", headers: { cookie, origin } });
  assert.equal(duplicate.statusCode, 200);
  assert.equal(duplicate.json().data.draft.revisionId, draft.revisionId);
  const during = await pool.query<any>("select current_published_revision_id,current_draft_revision_id from projects where slug='project-bradbury'");
  assert.equal(during.rows[0].current_published_revision_id, before.rows[0].current_published_revision_id);
  assert.equal(during.rows[0].current_draft_revision_id, draft.revisionId);
  const removed = await app.inject({ method: "DELETE", url: "/api/v1/admin/projects/project-bradbury/draft", headers: { cookie, origin }, payload: { expectedDraftRevisionId: draft.revisionId } });
  assert.equal(removed.statusCode, 204, removed.body);
  const after = await pool.query<any>("select current_published_revision_id,current_draft_revision_id from projects where slug='project-bradbury'");
  assert.deepEqual(after.rows[0], before.rows[0]);
  const publicAfter = await app.inject({ method: "GET", url: "/api/v1/projects/project-bradbury?locale=en" });
  assert.equal(publicAfter.body, publicBefore.body);
});

test("owner creates an unpublished project draft with automatic technical fields", async () => {
  await resetOwner();
  const loginResponse = await loginRequest();
  const cookie = String(loginResponse.headers["set-cookie"]).split(";")[0];
  const response = await app.inject({ method: "POST", url: "/api/v1/admin/projects", headers: { cookie, origin } });
  assert.equal(response.statusCode, 201);
  const editor = response.json().data;
  assert.equal(editor.project.status, "draft");
  assert.match(editor.project.slug, /^new-project-[a-f0-9]{8}$/);
  assert.equal(editor.published, null);
  assert.equal(editor.draft.revisionType, "draft");
  assert.equal(editor.draft.content.sortOrder % 10, 0);
  assert.equal(editor.draft.content.translations.ru.title, "");
  assert.equal(editor.editable.source, "draft");
  const listResponse = await app.inject({ method: "GET", url: "/api/v1/admin/projects", headers: { cookie } });
  assert.equal(listResponse.statusCode, 200);
  const listedDraft = listResponse.json().data.find((project: { id: string }) => project.id === editor.project.externalKey);
  assert.equal(listedDraft.status, "draft");
  assert.equal(listedDraft.translations.values.ru.title, "");
  const publicResponse = await app.inject({ method: "GET", url: `/api/v1/projects/${editor.project.slug}?locale=en` });
  assert.equal(publicResponse.statusCode, 404);
  await pool.query("delete from projects where id=$1", [editor.project.id]);
});

test("owner-only project deletion removes an unpublished aggregate and refuses a published project", async () => {
  await resetOwner();
  const session = await loginRequest();
  const cookie = String(session.headers["set-cookie"]).split(";")[0];
  const created = await app.inject({ method: "POST", url: "/api/v1/admin/projects", headers: { cookie, origin } });
  assert.equal(created.statusCode, 201);
  const editor = created.json().data;
  const unauthenticated = await app.inject({ method: "DELETE", url: `/api/v1/admin/projects/${editor.project.slug}`, headers: { origin } });
  assert.equal(unauthenticated.statusCode, 401);
  const removed = await app.inject({ method: "DELETE", url: `/api/v1/admin/projects/${editor.project.slug}`, headers: { cookie, origin } });
  assert.equal(removed.statusCode, 204, removed.body);
  assert.equal((await app.inject({ method: "GET", url: `/api/v1/admin/projects/${editor.project.slug}/editor`, headers: { cookie } })).statusCode, 404);
  const published = await app.inject({ method: "DELETE", url: "/api/v1/admin/projects/project-bradbury", headers: { cookie, origin } });
  assert.equal(published.statusCode, 409);
  assert.equal(published.json().error.code, "PUBLISHED_PROJECT_DELETE_FORBIDDEN");
  assert.equal((await app.inject({ method: "GET", url: "/api/v1/admin/projects/project-bradbury/editor", headers: { cookie } })).statusCode, 200);
});

test("isolated lifecycle keeps drafts private, republishes atomically, and rolls back a failed materialization", async () => {
  await resetOwner();
  const actor = {
    userId: (await pool.query<{ id: string }>("select id from admin_users where login=$1", [login])).rows[0]!.id,
    sessionId: randomUUID(),
    requestId: randomUUID(),
  };
  const drafts = new ProjectDraftRepository(pool);
  const before = await verifyProjectLifecycle(pool);
  assert.equal(Object.keys(before.counts).some((state) => state.startsWith("invalid_")), false);

  const created = await drafts.create(actor);
  assert.ok(created);
  const slug = created.project.slug;
  assert.equal(created.project.status, "draft");
  assert.equal(created.published, null);
  assert.equal(created.draft?.revisionType, "draft");
  const initialDraftId = created.draft!.revisionId;
  const initialRow = await pool.query<any>("select status,current_draft_revision_id,current_published_revision_id,published_at from projects where id=$1", [created.project.id]);
  assert.equal(initialRow.rows[0].status, "draft");
  assert.equal(initialRow.rows[0].current_draft_revision_id, initialDraftId);
  assert.equal(initialRow.rows[0].current_published_revision_id, null);
  assert.equal(initialRow.rows[0].published_at, null);
  assert.equal((await app.inject({ method: "GET", url: `/api/v1/projects/${slug}?locale=en` })).statusCode, 404);

  const incomplete = structuredClone(created.draft!.content);
  incomplete.translations.en.description = "Saved but incomplete draft.";
  const savedIncomplete = await drafts.save(slug, { baseRevisionId: null, expectedDraftRevisionId: initialDraftId, content: incomplete }, actor);
  assert.notEqual(savedIncomplete.revisionId, initialDraftId);
  assert.equal((await drafts.revisions(slug)).filter((revision) => revision.revisionType === "draft").length, 2);

  const publishedTemplate = (await drafts.editor("project-bradbury"))!.published!.content;
  const publishable = structuredClone(publishedTemplate);
  publishable.slug = slug;
  publishable.galleryId = slug;
  publishable.sortOrder = created.draft!.content.sortOrder;
  publishable.features = publishable.features.map((feature) => ({ ...feature, id: randomUUID() }));
  publishable.notes = publishable.notes.map((note) => ({ ...note, id: randomUUID() }));
  publishable.links = publishable.links.map((link) => ({ ...link, id: randomUUID() }));
  const savedPublishable = await drafts.save(slug, { baseRevisionId: null, expectedDraftRevisionId: savedIncomplete.revisionId, content: publishable }, actor);
  const firstPublish = await drafts.publish(slug, savedPublishable.revisionId, actor);
  const afterFirstPublish = await drafts.editor(slug);
  assert.equal(afterFirstPublish?.project.status, "published");
  assert.equal(afterFirstPublish?.editable.source, "published");
  assert.equal(afterFirstPublish?.draft, null);
  assert.equal(afterFirstPublish?.published?.revisionId, firstPublish.revisionId);
  const firstPublic = await app.inject({ method: "GET", url: `/api/v1/projects/${slug}?locale=en` });
  assert.equal(firstPublic.statusCode, 200);
  const firstPublicTitle = firstPublic.json().data.title;

  const edited = structuredClone(afterFirstPublish!.published!.content);
  edited.translations.en.title = `${edited.translations.en.title} revised`;
  const savedEdit = await drafts.save(slug, { baseRevisionId: firstPublish.revisionId, expectedDraftRevisionId: null, content: edited }, actor);
  const duringEdit = await drafts.editor(slug);
  assert.equal(duringEdit?.editable.source, "draft");
  assert.equal(duringEdit?.published?.revisionId, firstPublish.revisionId);
  assert.equal(duringEdit?.draft?.revisionId, savedEdit.revisionId);
  assert.equal((await app.inject({ method: "GET", url: `/api/v1/projects/${slug}?locale=en` })).json().data.title, firstPublicTitle);

  const republished = await drafts.publish(slug, savedEdit.revisionId, actor);
  const afterRepublish = await drafts.editor(slug);
  assert.equal(afterRepublish?.published?.revisionId, republished.revisionId);
  assert.equal(afterRepublish?.draft, null);
  assert.equal((await app.inject({ method: "GET", url: `/api/v1/projects/${slug}?locale=en` })).json().data.title, edited.translations.en.title);

  const invalidMaterialization = structuredClone(afterRepublish!.published!.content);
  invalidMaterialization.technologies = [{ slug: "missing-lifecycle-technology", name: "Missing lifecycle technology", sortOrder: 10 }];
  const savedInvalid = await drafts.save(slug, { baseRevisionId: republished.revisionId, expectedDraftRevisionId: null, content: invalidMaterialization }, actor);
  const beforeFailure = await pool.query<any>("select status,current_draft_revision_id,current_published_revision_id,published_at from projects where id=$1", [created.project.id]);
  const projectionBeforeFailure = await app.inject({ method: "GET", url: `/api/v1/projects/${slug}?locale=en` });
  const revisionCountBeforeFailure = await pool.query<{ count: string }>("select count(*)::text as count from project_revisions where project_id=$1", [created.project.id]);
  await assert.rejects(() => drafts.publish(slug, savedInvalid.revisionId, actor), { code: "VALIDATION_ERROR" });
  const afterFailure = await pool.query<any>("select status,current_draft_revision_id,current_published_revision_id,published_at from projects where id=$1", [created.project.id]);
  const projectionAfterFailure = await app.inject({ method: "GET", url: `/api/v1/projects/${slug}?locale=en` });
  const revisionCountAfterFailure = await pool.query<{ count: string }>("select count(*)::text as count from project_revisions where project_id=$1", [created.project.id]);
  assert.deepEqual(afterFailure.rows[0], beforeFailure.rows[0]);
  assert.equal(projectionAfterFailure.json().data.title, projectionBeforeFailure.json().data.title);
  assert.equal(revisionCountAfterFailure.rows[0].count, revisionCountBeforeFailure.rows[0].count);
  const history = await drafts.revisions(slug);
  assert.deepEqual(history.map((revision) => revision.revisionType), ["draft", "published", "draft", "published", "draft", "draft", "draft"]);
  assert.equal(history.filter((revision) => revision.revisionType === "published").length, 2);
  assert.equal(history.some((revision) => revision.revisionId === firstPublish.revisionId), true);
  assert.equal(history.some((revision) => revision.revisionId === republished.revisionId), true);
  const after = await verifyProjectLifecycle(pool);
  assert.equal(Object.keys(after.counts).some((state) => state.startsWith("invalid_")), false);
  await pool.query("delete from projects where id=$1", [created.project.id]);
});

test("every publish materialization stage rolls back revision, projection, pointers, and success audit", async () => {
  await resetOwner();
  const actor = { userId: (await pool.query<{ id: string }>("select id from admin_users where login=$1", [login])).rows[0]!.id, sessionId: randomUUID(), requestId: randomUUID() };
  const drafts = new ProjectDraftRepository(pool);
  const created = await drafts.create(actor); assert.ok(created);
  const template = structuredClone((await drafts.editor("project-bradbury"))!.published!.content);
  template.slug = created.project.slug; template.galleryId = created.project.slug; template.sortOrder = created.draft!.content.sortOrder;
  template.features = template.features.map((item) => ({ ...item, id: randomUUID() })); template.notes = template.notes.map((item) => ({ ...item, id: randomUUID() })); template.links = template.links.map((item) => ({ ...item, id: randomUUID() }));
  const ready = await drafts.save(created.project.slug, { baseRevisionId: null, expectedDraftRevisionId: created.draft!.revisionId, content: template }, actor);
  const first = await drafts.publish(created.project.slug, ready.revisionId, actor);
  const changed = structuredClone(template); changed.translations.en.title = `${changed.translations.en.title} failure matrix`;
  const pending = await drafts.save(created.project.slug, { baseRevisionId: first.revisionId, expectedDraftRevisionId: null, content: changed }, actor);
  const before = await pool.query<any>("select status,current_published_revision_id,current_draft_revision_id,published_at from projects where id=$1", [created.project.id]);
  const beforePublic = (await app.inject({ method: "GET", url: `/api/v1/projects/${created.project.slug}?locale=en` })).json().data.title;
  const beforeRevisionCount = await pool.query<{ count: string }>("select count(*)::text as count from project_revisions where project_id=$1", [created.project.id]);
  const beforeAuditCount = await pool.query<{ count: string }>("select count(*)::text as count from audit_events where entity_id=$1 and event_type='project_published'", [created.project.id]);
  const stages: PublishWriteStage[] = ["published_revision", "translations", "links", "features", "notes", "technologies", "media", "project", "audit"];
  for (const stage of stages) {
    const failing = new ProjectDraftRepository(pool, { afterStage: (current) => { if (current === stage) throw Object.assign(new Error("Injected publish failure."), { code: "INJECTED_FAILURE" }); } });
    await assert.rejects(() => failing.publish(created.project.slug, pending.revisionId, actor), { code: "INJECTED_FAILURE" });
    assert.deepEqual((await pool.query<any>("select status,current_published_revision_id,current_draft_revision_id,published_at from projects where id=$1", [created.project.id])).rows[0], before.rows[0]);
    assert.equal((await app.inject({ method: "GET", url: `/api/v1/projects/${created.project.slug}?locale=en` })).json().data.title, beforePublic);
    assert.equal((await pool.query<{ count: string }>("select count(*)::text as count from project_revisions where project_id=$1", [created.project.id])).rows[0].count, beforeRevisionCount.rows[0].count);
    assert.equal((await pool.query<{ count: string }>("select count(*)::text as count from audit_events where entity_id=$1 and event_type='project_published'", [created.project.id])).rows[0].count, beforeAuditCount.rows[0].count);
  }
  await pool.query("delete from projects where id=$1", [created.project.id]);
});

test("bootstrap creates one owner and repeat bootstrap updates without a second row", async () => {
  await clearAuth();
  const created = await repository.bootstrapOwner({
    id: randomUUID(),
    login,
    displayName: "Maksim",
    passwordHash: await hashPassword(password),
    now: new Date(),
  }, bootstrapPolicy);
  assert.equal(created.result, "created");

  const updated = await repository.bootstrapOwner({
    id: randomUUID(),
    login: " @MaxPar.Fed ",
    displayName: "Maksim",
    passwordHash: await hashPassword(newPassword),
    now: new Date(),
  }, bootstrapPolicy);
  assert.equal(updated.result, "updated");

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
  }, bootstrapPolicy);

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

test("owner upload stays private until publish, produces managed variants, and preserves legacy media", async () => {
  await resetOwner();
  const session = await loginRequest(); const cookie = String(session.headers["set-cookie"]).split(";")[0];
  const boundary = `----media-${randomUUID()}`;
  const image = await readFile("../images/projects/cus/cus-dashboard.png");
  const payload = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name=\"orientation\"\r\n\r\nhorizontal\r\n--${boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"sample.png\"\r\nContent-Type: image/png\r\n\r\n`), image, Buffer.from(`\r\n--${boundary}--\r\n`)]);
  const response = await app.inject({ method: "POST", url: "/api/v1/admin/projects/project-bradbury/media", headers: { cookie, origin, "content-type": `multipart/form-data; boundary=${boundary}` }, payload });
  assert.equal(response.statusCode, 200);
  const uploaded = response.json().data as { assetId: string };
  assert.match(uploaded.assetId, /^[0-9a-f-]{36}$/);
  assert.equal((await app.inject({ method: "GET", url: `/api/v1/media/${uploaded.assetId}/display` })).statusCode, 404);

  const editor = (await app.inject({ method: "GET", url: "/api/v1/admin/projects/project-bradbury/editor", headers: { cookie } })).json().data;
  const content = structuredClone(editor.published.content);
  content.media.push({ id: randomUUID(), sourceType: "managed", assetId: uploaded.assetId, role: "gallery", orientation: "horizontal", galleryKind: "desktop", presentation: "contain", sortOrder: 999, translations: { en: { alt: "Managed image", ariaLabel: "Open managed image" }, ru: { alt: "Управляемое изображение", ariaLabel: "Открыть управляемое изображение" } } });
  const saved = await app.inject({ method: "PUT", url: "/api/v1/admin/projects/project-bradbury/draft", headers: { cookie, origin }, payload: localeSavePayload(editor, content) });
  assert.equal(saved.statusCode, 200, saved.body);
  const published = await app.inject({ method: "POST", url: "/api/v1/admin/projects/project-bradbury/publish", headers: { cookie, origin }, payload: { expectedDraftRevisionId: saved.json().data.revisionId, confirmation: true } });
  assert.equal(published.statusCode, 200, published.body);
  const display = await app.inject({ method: "GET", url: `/api/v1/media/${uploaded.assetId}/display` });
  assert.equal(display.statusCode, 200); assert.equal(display.headers["content-type"], "image/webp");
  const publicProject = (await app.inject({ method: "GET", url: "/api/v1/projects/project-bradbury?locale=en" })).json().data;
  assert.ok(publicProject.media.some((asset: { src: string; presentation: string }) => asset.src === `/api/v1/media/${uploaded.assetId}/display` && asset.presentation === "contain"));

  const restoreEditor = (await app.inject({ method: "GET", url: "/api/v1/admin/projects/project-bradbury/editor", headers: { cookie } })).json().data;
  assert.equal(restoreEditor.published.content.media.find((asset: { assetId?: string }) => asset.assetId === uploaded.assetId)?.presentation, "contain");
  const restore = structuredClone(restoreEditor.published.content); restore.media = restore.media.filter((asset: { sourceType: string }) => asset.sourceType === "legacy");
  const restoreDraft = await app.inject({ method: "PUT", url: "/api/v1/admin/projects/project-bradbury/draft", headers: { cookie, origin }, payload: localeSavePayload(restoreEditor, restore) });
  assert.equal(restoreDraft.statusCode, 200);
  assert.equal((await app.inject({ method: "POST", url: "/api/v1/admin/projects/project-bradbury/publish", headers: { cookie, origin }, payload: { expectedDraftRevisionId: restoreDraft.json().data.revisionId, confirmation: true } })).statusCode, 200);
});

test("unavailable managed media remains fail closed for a current draft", async () => {
  await resetOwner();
  const session = await loginRequest(); const cookie = String(session.headers["set-cookie"]).split(";")[0];
  const editor = (await app.inject({ method: "GET", url: "/api/v1/admin/projects/project-bradbury/editor", headers: { cookie } })).json().data;
  const content = structuredClone(editor.published.content);
  content.media.push({ id: randomUUID(), sourceType: "managed", assetId: randomUUID(), role: "gallery", orientation: "horizontal", galleryKind: "desktop", presentation: "contain", sortOrder: 999, translations: { en: { alt: "Unavailable managed image", ariaLabel: "Unavailable managed image" }, ru: { alt: "Недоступное управляемое изображение", ariaLabel: "Недоступное управляемое изображение" } } });
  const response = await app.inject({ method: "PUT", url: "/api/v1/admin/projects/project-bradbury/draft", headers: { cookie, origin }, payload: localeSavePayload(editor, content) });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, "VALIDATION_ERROR");
  const current = (await app.inject({ method: "GET", url: "/api/v1/admin/projects/project-bradbury/editor", headers: { cookie } })).json().data;
  assert.equal(current.draft, null);
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
    const invalidOrigin = await app.inject({ method: "PUT", url: "/api/v1/admin/projects/project-bradbury/draft", headers: { cookie, origin: "http://invalid.local" }, payload: localeSavePayload(initialEditor, baseline) });
    assert.equal(invalidOrigin.statusCode, 403);

    const invalidContent = structuredClone(baseline); invalidContent.slug = "invalid slug";
    const invalidDraft = await app.inject({ method: "PUT", url: "/api/v1/admin/projects/project-bradbury/draft", headers, payload: localeSavePayload(initialEditor, invalidContent) });
    assert.equal(invalidDraft.statusCode, 400);

    const firstContent = structuredClone(baseline); firstContent.translations.en.title = `${baseline.translations.en.title} draft test`;
    const firstDraft = await app.inject({ method: "PUT", url: "/api/v1/admin/projects/project-bradbury/draft", headers, payload: localeSavePayload(initialEditor, firstContent) });
    assert.equal(firstDraft.statusCode, 200);
    const firstRevisionId = firstDraft.json().data.revisionId;
    assert.equal((await app.inject({ method: "GET", url: "/api/v1/projects/project-bradbury?locale=en" })).json().data.title, baselinePublic.title);

    const staleSave = await app.inject({ method: "PUT", url: "/api/v1/admin/projects/project-bradbury/draft", headers, payload: localeSavePayload(initialEditor, firstContent) });
    assert.equal(staleSave.statusCode, 409);
    assert.equal(staleSave.json().error.code, "DRAFT_CONFLICT");

    const secondContent = structuredClone(firstContent); secondContent.translations.en.title = `${baseline.translations.en.title} published test`;
    const secondDraft = await app.inject({ method: "PUT", url: "/api/v1/admin/projects/project-bradbury/draft", headers, payload: localeSavePayload((await app.inject({ method: "GET", url: "/api/v1/admin/projects/project-bradbury/editor", headers })).json().data, secondContent) });
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
    const incompleteDraft = await app.inject({ method: "PUT", url: "/api/v1/admin/projects/project-bradbury/draft", headers, payload: localeSavePayload((await app.inject({ method: "GET", url: "/api/v1/admin/projects/project-bradbury/editor", headers })).json().data, incomplete) });
    assert.equal(incompleteDraft.statusCode, 200);
    const rejectedPublish = await app.inject({ method: "POST", url: "/api/v1/admin/projects/project-bradbury/publish", headers, payload: { expectedDraftRevisionId: incompleteDraft.json().data.revisionId, confirmation: true } });
    assert.equal(rejectedPublish.statusCode, 400);
    assert.equal((await app.inject({ method: "GET", url: "/api/v1/projects/project-bradbury?locale=en" })).json().data.title, secondContent.translations.en.title);
  } finally {
    const current = (await app.inject({ method: "GET", url: "/api/v1/admin/projects/project-bradbury/editor", headers: { cookie } })).json().data;
    const restore = await app.inject({ method: "PUT", url: "/api/v1/admin/projects/project-bradbury/draft", headers, payload: localeSavePayload(current, baseline) });
    assert.equal(restore.statusCode, 200, restore.body);
    const restored = await app.inject({ method: "POST", url: "/api/v1/admin/projects/project-bradbury/publish", headers, payload: { expectedDraftRevisionId: restore.json().data.revisionId, confirmation: true } });
    assert.equal(restored.statusCode, 200);
    assert.deepEqual((await app.inject({ method: "GET", url: "/api/v1/projects/project-bradbury?locale=en" })).json().data, baselinePublic);
  }
});

test("publish persists localized content blocks, supports reorder/removal, and keeps media metadata", async () => {
  await resetOwner();
  const session = await loginRequest();
  const cookie = String(session.headers["set-cookie"]).split(";")[0];
  const headers = { cookie, origin };
  const editor = (await app.inject({ method: "GET", url: "/api/v1/admin/projects/project-bradbury/editor", headers: { cookie } })).json().data;
  const baseline = structuredClone(editor.published.content);
  try {
    const changed = structuredClone(baseline);
    changed.translations.en.displayType = "Edited display type";
    changed.features = [...changed.features].reverse();
    changed.features[0].text.ru = "Изменённая возможность";
    changed.notes = [changed.notes[0]];
    const saved = await app.inject({ method: "PUT", url: "/api/v1/admin/projects/project-bradbury/draft", headers, payload: localeSavePayload(editor, changed) });
    assert.equal(saved.statusCode, 200, saved.body);
    const published = await app.inject({ method: "POST", url: "/api/v1/admin/projects/project-bradbury/publish", headers, payload: { expectedDraftRevisionId: saved.json().data.revisionId, confirmation: true } });
    assert.equal(published.statusCode, 200, published.body);
    const stored = await pool.query<{ locale: string; display_type: string; feature_count: string; note_count: string }>(`
      select pt.locale, pt.display_type,
        (select count(*)::text from project_features where project_id = p.id) as feature_count,
        (select count(*)::text from project_notes where project_id = p.id) as note_count
      from projects p join project_translations pt on pt.project_id = p.id
      where p.external_key = 'project-bradbury' order by pt.locale
    `);
    assert.equal(stored.rows.find((row) => row.locale === "en")?.display_type, "Edited display type");
    assert.deepEqual(new Set(stored.rows.map((row) => row.feature_count)), new Set(["5"]));
    assert.deepEqual(new Set(stored.rows.map((row) => row.note_count)), new Set(["1"]));
    const firstFeature = await pool.query<{ text: string }>("select translation.text from project_features feature join project_feature_translations translation on translation.feature_id=feature.id where feature.project_id=(select id from projects where external_key='project-bradbury') and feature.sort_order=$1 and translation.locale='ru'", [changed.features[0].sortOrder]);
    assert.equal(firstFeature.rows[0]?.text, "Изменённая возможность");

    const afterFirstPublish = (await app.inject({ method: "GET", url: "/api/v1/admin/projects/project-bradbury/editor", headers: { cookie } })).json().data;
    const removeNotes = structuredClone(afterFirstPublish.published.content); removeNotes.notes = [];
    const savedAgain = await app.inject({ method: "PUT", url: "/api/v1/admin/projects/project-bradbury/draft", headers, payload: localeSavePayload(afterFirstPublish, removeNotes) });
    assert.equal(savedAgain.statusCode, 200, savedAgain.body);
    assert.equal((await app.inject({ method: "POST", url: "/api/v1/admin/projects/project-bradbury/publish", headers, payload: { expectedDraftRevisionId: savedAgain.json().data.revisionId, confirmation: true } })).statusCode, 200);
    assert.equal((await pool.query("select 1 from project_notes where project_id=(select id from projects where external_key='project-bradbury')")).rowCount, 0);
    const media = await pool.query("select gallery_kind,presentation from project_media where project_id=(select id from projects where external_key='project-bradbury')");
    assert.ok(media.rows.every((row: any) => row.gallery_kind && row.presentation));
  } finally {
    const current = (await app.inject({ method: "GET", url: "/api/v1/admin/projects/project-bradbury/editor", headers: { cookie } })).json().data;
    const restore = await app.inject({ method: "PUT", url: "/api/v1/admin/projects/project-bradbury/draft", headers, payload: localeSavePayload(current, baseline) });
    assert.equal(restore.statusCode, 200, restore.body);
    assert.equal((await app.inject({ method: "POST", url: "/api/v1/admin/projects/project-bradbury/publish", headers, payload: { expectedDraftRevisionId: restore.json().data.revisionId, confirmation: true } })).statusCode, 200);
  }
});

test("editor upgrades a legacy links revision on draft save while publish persists only normalized links", async () => {
  await resetOwner();
  const session = await loginRequest();
  const cookie = String(session.headers["set-cookie"]).split(";")[0];
  const headers = { cookie, origin };
  const original = (await app.inject({ method: "GET", url: "/api/v1/admin/projects/project-bradbury/editor", headers: { cookie } })).json().data;
  const project = await pool.query<{ id: string; current_published_revision_id: string; current_draft_revision_id: string | null }>("select id,current_published_revision_id,current_draft_revision_id from projects where slug='project-bradbury'");
  const projectRow = project.rows[0]!;
  const legacyRevisionId = randomUUID();
  const legacyContent = structuredClone(original.published.content);
  legacyContent.links = { primary: { href: "https://prbdbr.com/", type: "website" }, secondary: null };
  legacyContent.translations.ru.primaryActionLabel = "Открыть проект";
  legacyContent.translations.ru.secondaryActionLabel = null;
  legacyContent.translations.en.primaryActionLabel = "Open project";
  legacyContent.translations.en.secondaryActionLabel = null;
  try {
    await pool.query("insert into project_revisions (id,project_id,revision_number,revision_type,base_revision_id,content,created_at,updated_at,published_at) values ($1,$2,(select max(revision_number)+1 from project_revisions where project_id=$2),'published',$3,$4,now(),now(),now())", [legacyRevisionId, projectRow.id, projectRow.current_published_revision_id, legacyContent]);
    await pool.query("update projects set current_published_revision_id=$1,current_draft_revision_id=null where id=$2", [legacyRevisionId, projectRow.id]);
    const editor = (await app.inject({ method: "GET", url: "/api/v1/admin/projects/project-bradbury/editor", headers: { cookie } })).json().data;
    assert.ok(Array.isArray(editor.published.content.links));
    assert.equal(editor.published.content.links[0].sortOrder, 10);
    const saved = await app.inject({ method: "PUT", url: "/api/v1/admin/projects/project-bradbury/draft", headers, payload: localeSavePayload(editor, editor.published.content) });
    assert.equal(saved.statusCode, 200, saved.body);
    const stored = await pool.query<{ content: any }>("select content from project_revisions where id=$1", [saved.json().data.revisionId]);
    assert.ok(Array.isArray(stored.rows[0]!.content.links));
    assert.equal("primary" in stored.rows[0]!.content.links, false);
    assert.deepEqual((await pool.query<{ content: any }>("select content from project_revisions where id=$1", [legacyRevisionId])).rows[0]!.content, legacyContent);
    assert.ok(Array.isArray((await app.inject({ method: "GET", url: "/api/v1/admin/projects/project-bradbury/editor", headers: { cookie } })).json().data.draft.content.links));
  } finally {
    await pool.query("update projects set current_published_revision_id=$1,current_draft_revision_id=$2 where id=$3", [projectRow.current_published_revision_id, projectRow.current_draft_revision_id, projectRow.id]);
    await pool.query("delete from project_revisions where id=$1 or base_revision_id=$1", [legacyRevisionId]);
  }
});
