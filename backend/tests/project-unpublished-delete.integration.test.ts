import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import pg from "pg";
import { loadEnv } from "../src/config/env.js";
import { assertTestDatabase } from "../src/config/database-identity.js";
import { ProjectDraftRepository } from "../src/modules/admin-projects/project-draft.repository.js";

const env = loadEnv({ ...process.env, NODE_ENV: "test" });
assertTestDatabase(env, "Unpublished project deletion integration test setup");
const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 2 });
let actorId = "";
const actor = () => ({ userId: actorId, sessionId: randomUUID(), requestId: randomUUID() });

before(async () => {
  const owner = await pool.query<{ id: string }>("select id from admin_users limit 1");
  actorId = owner.rows[0]?.id ?? randomUUID();
  if (!owner.rows[0]) await pool.query("insert into admin_users(id,login,password_hash,display_name,role,is_active,failed_login_attempts,created_at,updated_at) values($1,$2,'test','Deletion owner','owner',true,0,now(),now())", [actorId, `@delete-${actorId.slice(0, 8)}`]);
  await new ProjectDraftRepository(pool).backfill();
});
after(async () => { await pool.end(); });

test("deletes a never-published aggregate and only its media reference", async () => {
  const drafts = new ProjectDraftRepository(pool); const created = await drafts.create(actor()); assert.ok(created);
  const assetId = randomUUID();
  await pool.query("insert into project_links(id,project_id,url,sort_order,created_at,updated_at) values($1,$2,'https://example.test',10,now(),now())", [randomUUID(), created.project.id]);
  await pool.query("insert into media_assets(id,external_key,role,sort_order,source_type,storage_driver,storage_key,status,created_by,created_at,updated_at) values($1,$2,'gallery',10,'managed','local','test/delete-kept.webp','draft',$3,now(),now())", [assetId, `delete-asset-${assetId}`, actorId]);
  await pool.query("insert into project_media(project_id,media_asset_id,sort_order,orientation,gallery_kind,presentation) values($1,$2,10,'vertical','mobile','contain')", [created.project.id, assetId]);

  await drafts.deleteUnpublishedProject(created.project.slug);

  const counts = await pool.query<{ projects: string; revisions: string; localeStates: string; links: string; mediaReferences: string; keptAsset: string }>("select (select count(*) from projects where id=$1)::text as projects,(select count(*) from project_revisions where project_id=$1)::text as revisions,(select count(*) from project_locale_publications where project_id=$1)::text as \"localeStates\",(select count(*) from project_links where project_id=$1)::text as links,(select count(*) from project_media where project_id=$1)::text as \"mediaReferences\",(select count(*) from media_assets where id=$2 and storage_key='test/delete-kept.webp')::text as \"keptAsset\"", [created.project.id, assetId]);
  assert.deepEqual(Object.fromEntries(Object.entries(counts.rows[0]!).map(([key, value]) => [key, Number(value)])), { projects: 0, revisions: 0, localeStates: 0, links: 0, mediaReferences: 0, keptAsset: 1 });
  assert.equal(await drafts.editor(created.project.slug), null);
  await pool.query("delete from media_assets where id=$1", [assetId]);
});

test("refuses published and missing projects without changing the published aggregate", async () => {
  const drafts = new ProjectDraftRepository(pool); const created = await drafts.create(actor()); assert.ok(created);
  const template = structuredClone((await drafts.editor("project-bradbury"))!.published!.content);
  template.slug = created.project.slug; template.galleryId = created.project.slug; template.sortOrder = created.draft!.content.sortOrder;
  template.features = template.features.map((item) => ({ ...item, id: randomUUID() })); template.notes = template.notes.map((item) => ({ ...item, id: randomUUID() })); template.links = template.links.map((item) => ({ ...item, id: randomUUID() }));
  const saved = await drafts.save(created.project.slug, { baseRevisionId: null, expectedDraftRevisionId: created.draft!.revisionId, content: template }, actor());
  await drafts.publish(created.project.slug, saved.revisionId, actor());
  const before = await pool.query("select current_published_revision_id,current_draft_revision_id,status from projects where id=$1", [created.project.id]);

  await assert.rejects(() => drafts.deleteUnpublishedProject(created.project.slug), { code: "PUBLISHED_PROJECT_DELETE_FORBIDDEN" });
  await assert.rejects(() => drafts.deleteUnpublishedProject("missing-project"), { code: "PROJECT_NOT_FOUND" });
  assert.deepEqual((await pool.query("select current_published_revision_id,current_draft_revision_id,status from projects where id=$1", [created.project.id])).rows[0], before.rows[0]);
  await pool.query("delete from projects where id=$1", [created.project.id]);
});

test("keeps existing draft-only deletion semantics for a published project", async () => {
  const drafts = new ProjectDraftRepository(pool); const created = await drafts.create(actor()); assert.ok(created);
  const template = structuredClone((await drafts.editor("project-bradbury"))!.published!.content);
  template.slug = created.project.slug; template.galleryId = created.project.slug; template.sortOrder = created.draft!.content.sortOrder;
  template.features = template.features.map((item) => ({ ...item, id: randomUUID() })); template.notes = template.notes.map((item) => ({ ...item, id: randomUUID() })); template.links = template.links.map((item) => ({ ...item, id: randomUUID() }));
  const firstDraft = await drafts.save(created.project.slug, { baseRevisionId: null, expectedDraftRevisionId: created.draft!.revisionId, content: template }, actor());
  const published = await drafts.publish(created.project.slug, firstDraft.revisionId, actor());
  const changed = structuredClone(template); changed.translations.en.title = `${changed.translations.en.title} draft`;
  const draft = await drafts.save(created.project.slug, { baseRevisionId: published.revisionId, expectedDraftRevisionId: null, content: changed }, actor());

  await drafts.deleteDraft(created.project.slug, draft.revisionId, actor());
  const editor = (await drafts.editor(created.project.slug))!;
  assert.equal(editor.published?.revisionId, published.revisionId);
  assert.equal(editor.draft, null);
  await pool.query("delete from projects where id=$1", [created.project.id]);
});

test("rechecks publication state after the project-row lock when publish wins the race", async () => {
  const drafts = new ProjectDraftRepository(pool); const created = await drafts.create(actor()); assert.ok(created);
  const template = structuredClone((await drafts.editor("project-bradbury"))!.published!.content);
  template.slug = created.project.slug; template.galleryId = created.project.slug; template.sortOrder = created.draft!.content.sortOrder;
  template.features = template.features.map((item) => ({ ...item, id: randomUUID() })); template.notes = template.notes.map((item) => ({ ...item, id: randomUUID() })); template.links = template.links.map((item) => ({ ...item, id: randomUUID() }));
  const ready = await drafts.save(created.project.slug, { baseRevisionId: null, expectedDraftRevisionId: created.draft!.revisionId, content: template }, actor());
  let release!: () => void; let locked!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; }); const entered = new Promise<void>((resolve) => { locked = resolve; });
  const publisher = new ProjectDraftRepository(pool, { afterProjectLock: async (operation) => { if (operation === "publish") { locked(); await gate; } } });
  const publishing = publisher.publish(created.project.slug, ready.revisionId, actor()); await entered;
  const deleting = drafts.deleteUnpublishedProject(created.project.slug); await new Promise(setImmediate); release();
  await publishing;
  await assert.rejects(() => deleting, { code: "PUBLISHED_PROJECT_DELETE_FORBIDDEN" });
  assert.equal((await pool.query("select 1 from projects where id=$1", [created.project.id])).rowCount, 1);
  await pool.query("delete from projects where id=$1", [created.project.id]);
});
