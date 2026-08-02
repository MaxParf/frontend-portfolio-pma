import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";
import { ProjectDraftRepository } from "../src/modules/admin-projects/project-draft.repository.js";
import { verifyProjectLifecycle } from "../scripts/verify-project-lifecycle.js";
import { loadEnv } from "../src/config/env.js";

const env = loadEnv({ ...process.env, NODE_ENV: "test" });
const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 2 });
const actor = { userId: null as unknown as string, sessionId: randomUUID(), requestId: randomUUID() };
await new ProjectDraftRepository(pool).backfill();

async function preparedDraft() {
  const drafts = new ProjectDraftRepository(pool); const created = await drafts.create(actor); assert.ok(created);
  const content = structuredClone((await drafts.editor("project-bradbury"))!.published!.content);
  content.slug = created.project.slug; content.galleryId = created.project.slug; content.sortOrder = created.draft!.content.sortOrder;
  content.features = content.features.map((item) => ({ ...item, id: randomUUID() })); content.notes = content.notes.map((item) => ({ ...item, id: randomUUID() })); content.links = content.links.map((item) => ({ ...item, id: randomUUID() }));
  const ready = await drafts.save(created.project.slug, { baseRevisionId: null, expectedDraftRevisionId: created.draft!.revisionId, content }, actor);
  const published = await drafts.publish(created.project.slug, ready.revisionId, actor);
  const changed = structuredClone(content); changed.translations.en.title = `${changed.translations.en.title} concurrent`;
  const draft = await drafts.save(created.project.slug, { baseRevisionId: published.revisionId, expectedDraftRevisionId: null, content: changed }, actor);
  return { id: created.project.id, slug: created.project.slug, publishedId: published.revisionId, draftId: draft.revisionId, content: changed };
}

async function gate(operation: "save" | "publish") { let open!: () => void; let entered!: () => void; const release = new Promise<void>((resolve) => { open = resolve; }); const locked = new Promise<void>((resolve) => { entered = resolve; }); return { hooks: { afterProjectLock: async (current: "save" | "publish") => { if (current === operation) { entered(); await release; } } }, locked, open }; }
async function assertGreen() { assert.equal(Object.keys((await verifyProjectLifecycle(pool)).counts).some((key) => key.startsWith("invalid_")), false); }
async function writeCounts(projectId: string) { const result = await pool.query<{ revisions: string; saves: string; publishes: string }>("select (select count(*) from project_revisions where project_id=$1)::text as revisions, (select count(*) from audit_events where entity_id=$1 and event_type='project_draft_saved' and status='success')::text as saves, (select count(*) from audit_events where entity_id=$1 and event_type='project_published' and status='success')::text as publishes", [projectId]); return Object.fromEntries(Object.entries(result.rows[0]).map(([key, value]) => [key, Number(value)])) as { revisions: number; saves: number; publishes: number }; }

test("real PostgreSQL lock serializes save/save and stale retry", async () => {
  const state = await preparedDraft(); const first = await gate("save"); const winner = new ProjectDraftRepository(pool, first.hooks); const loser = new ProjectDraftRepository(pool);
  const before = await writeCounts(state.id);
  const winnerRequest = winner.save(state.slug, { baseRevisionId: state.publishedId, expectedDraftRevisionId: state.draftId, content: state.content }, actor); await first.locked;
  const loserRequest = loser.save(state.slug, { baseRevisionId: state.publishedId, expectedDraftRevisionId: state.draftId, content: state.content }, actor); await new Promise(setImmediate); first.open();
  const [saved, stale] = await Promise.allSettled([winnerRequest, loserRequest]); assert.equal(saved.status, "fulfilled"); assert.equal(stale.status, "rejected"); assert.equal((stale as PromiseRejectedResult).reason.code, "DRAFT_CONFLICT");
  await assert.rejects(() => loser.save(state.slug, { baseRevisionId: state.publishedId, expectedDraftRevisionId: state.draftId, content: state.content }, actor), { code: "DRAFT_CONFLICT" });
  assert.deepEqual(await writeCounts(state.id), { revisions: before.revisions + 1, saves: before.saves + 1, publishes: before.publishes });
  await assertGreen(); await pool.query("delete from projects where id=$1", [state.id]);
});

test("real PostgreSQL lock also permits the second save session to win", async () => {
  const state = await preparedDraft(); const secondSessionGate = await gate("save"); const firstSession = new ProjectDraftRepository(pool); const secondSession = new ProjectDraftRepository(pool, secondSessionGate.hooks); const before = await writeCounts(state.id);
  const secondRequest = secondSession.save(state.slug, { baseRevisionId: state.publishedId, expectedDraftRevisionId: state.draftId, content: state.content }, actor); await secondSessionGate.locked;
  const firstRequest = firstSession.save(state.slug, { baseRevisionId: state.publishedId, expectedDraftRevisionId: state.draftId, content: state.content }, actor); await new Promise(setImmediate); secondSessionGate.open();
  const [second, first] = await Promise.allSettled([secondRequest, firstRequest]); assert.equal(second.status, "fulfilled"); assert.equal(first.status, "rejected"); assert.equal((first as PromiseRejectedResult).reason.code, "DRAFT_CONFLICT");
  assert.deepEqual(await writeCounts(state.id), { revisions: before.revisions + 1, saves: before.saves + 1, publishes: before.publishes });
  await assertGreen(); await pool.query("delete from projects where id=$1", [state.id]);
});

test("real PostgreSQL lock serializes publish/save and publish/publish", async () => {
  const state = await preparedDraft(); const first = await gate("publish"); const publisher = new ProjectDraftRepository(pool, first.hooks); const saver = new ProjectDraftRepository(pool);
  const before = await writeCounts(state.id);
  const publishRequest = publisher.publish(state.slug, state.draftId, actor); await first.locked;
  const saveRequest = saver.save(state.slug, { baseRevisionId: state.publishedId, expectedDraftRevisionId: state.draftId, content: state.content }, actor); await new Promise(setImmediate); first.open();
  const [published, staleSave] = await Promise.allSettled([publishRequest, saveRequest]); assert.equal(published.status, "fulfilled"); assert.equal(staleSave.status, "rejected"); assert.equal((staleSave as PromiseRejectedResult).reason.code, "DRAFT_CONFLICT");
  await assert.rejects(() => saver.publish(state.slug, state.draftId, actor), { code: "DRAFT_NOT_FOUND" });
  assert.deepEqual(await writeCounts(state.id), { revisions: before.revisions + 1, saves: before.saves, publishes: before.publishes + 1 });
  await assertGreen(); await pool.query("delete from projects where id=$1", [state.id]);
});

test("real PostgreSQL lock serializes save/publish and concurrent publish/publish", async () => {
  const state = await preparedDraft(); const first = await gate("save"); const saver = new ProjectDraftRepository(pool, first.hooks); const publisher = new ProjectDraftRepository(pool);
  const before = await writeCounts(state.id);
  const saveRequest = saver.save(state.slug, { baseRevisionId: state.publishedId, expectedDraftRevisionId: state.draftId, content: state.content }, actor); await first.locked;
  const publishRequest = publisher.publish(state.slug, state.draftId, actor); await new Promise(setImmediate); first.open();
  const [saved, stalePublish] = await Promise.allSettled([saveRequest, publishRequest]); assert.equal(saved.status, "fulfilled"); assert.equal(stalePublish.status, "rejected"); assert.equal((stalePublish as PromiseRejectedResult).reason.code, "PUBLISH_CONFLICT");
  const latest = (await new ProjectDraftRepository(pool).editor(state.slug))!; const second = await gate("publish"); const firstPublisher = new ProjectDraftRepository(pool, second.hooks); const secondPublisher = new ProjectDraftRepository(pool);
  const firstPublish = firstPublisher.publish(state.slug, latest.draft!.revisionId, actor); await second.locked;
  const secondPublish = secondPublisher.publish(state.slug, latest.draft!.revisionId, actor); await new Promise(setImmediate); second.open();
  const [winner, loser] = await Promise.allSettled([firstPublish, secondPublish]); assert.equal(winner.status, "fulfilled"); assert.equal(loser.status, "rejected"); assert.equal((loser as PromiseRejectedResult).reason.code, "DRAFT_NOT_FOUND");
  assert.deepEqual(await writeCounts(state.id), { revisions: before.revisions + 2, saves: before.saves + 1, publishes: before.publishes + 1 });
  await assertGreen(); await pool.query("delete from projects where id=$1", [state.id]);
});

test("first draft race from a published snapshot allows one save only", async () => {
  const state = await preparedDraft(); const clean = await new ProjectDraftRepository(pool).publish(state.slug, state.draftId, actor);
  const first = await gate("save"); const winner = new ProjectDraftRepository(pool, first.hooks); const loser = new ProjectDraftRepository(pool);
  const before = await writeCounts(state.id);
  const firstSave = winner.save(state.slug, { baseRevisionId: clean.revisionId, expectedDraftRevisionId: null, content: state.content }, actor); await first.locked;
  const secondSave = loser.save(state.slug, { baseRevisionId: clean.revisionId, expectedDraftRevisionId: null, content: state.content }, actor); await new Promise(setImmediate); first.open();
  const [saved, stale] = await Promise.allSettled([firstSave, secondSave]); assert.equal(saved.status, "fulfilled"); assert.equal(stale.status, "rejected"); assert.equal((stale as PromiseRejectedResult).reason.code, "DRAFT_CONFLICT");
  assert.deepEqual(await writeCounts(state.id), { revisions: before.revisions + 1, saves: before.saves + 1, publishes: before.publishes });
  await assertGreen(); await pool.query("delete from projects where id=$1", [state.id]);
});

test("save based on a superseded published pointer is rejected without a write", async () => {
  const state = await preparedDraft(); const drafts = new ProjectDraftRepository(pool); const before = await writeCounts(state.id);
  await drafts.publish(state.slug, state.draftId, actor);
  const afterPublish = await writeCounts(state.id);
  await assert.rejects(() => drafts.save(state.slug, { baseRevisionId: state.publishedId, expectedDraftRevisionId: null, content: state.content }, actor), { code: "DRAFT_CONFLICT" });
  assert.deepEqual(await writeCounts(state.id), afterPublish);
  assert.deepEqual(afterPublish, { revisions: before.revisions + 1, saves: before.saves, publishes: before.publishes + 1 });
  await assertGreen(); await pool.query("delete from projects where id=$1", [state.id]);
});
