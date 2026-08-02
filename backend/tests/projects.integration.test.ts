import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test, { after, before } from "node:test";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { buildApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";
import { assertTestDatabase } from "../src/config/database-identity.js";
import { createDatabase } from "../src/db/client.js";
import { loadFrontendProjects, seedProjects } from "../scripts/seed-projects.js";
import { ProjectDraftRepository } from "../src/modules/admin-projects/project-draft.repository.js";
import { verifySeed } from "../scripts/verify-seed.js";
import { verifyMediaOrientation } from "../scripts/verify-media-orientation.js";
import { ensureNormalizedProjectLinksFixture } from "./helpers/ensure-normalized-project-links-fixture.js";

const env = loadEnv({ ...process.env, NODE_ENV: "test" });
assertTestDatabase(env, "Projects integration test setup");
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const app = buildApp(env, pool);

before(async () => {
  await migrate(createDatabase(pool), { migrationsFolder: "./drizzle" });
  await ensureNormalizedProjectLinksFixture(pool);
  await pool.query("delete from projects where external_key = 'draft-project'");
  const sourceProjects = await loadFrontendProjects();
  await seedProjects(pool, sourceProjects, { mode: "legacy-bootstrap" });
  await seedProjects(pool, sourceProjects, { mode: "legacy-bootstrap" });
  await ensureNormalizedProjectLinksFixture(pool);
});

after(async () => {
  await pool.query("delete from projects where external_key = 'draft-project'");
  await app.close();
  await pool.end();
});

test("GET /health returns ok", async () => {
  const response = await app.inject({ method: "GET", url: "/health" });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().status, "ok");
});

test("GET /api/v1/projects returns English published projects in order", async () => {
  const response = await app.inject({ method: "GET", url: "/api/v1/projects?locale=en" });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.meta.locale, "en");
  assert.equal(body.meta.count, 3);
  assert.deepEqual(
    body.data.map((project: { id: string }) => project.id),
    ["construction-management-control-center", "project-bradbury", "foodai"],
  );
});

test("GET /api/v1/projects returns Russian translations", async () => {
  const response = await app.inject({ method: "GET", url: "/api/v1/projects?locale=ru" });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.meta.locale, "ru");
  assert.equal(body.data[0].title, "Центр управления строительством");
  assert.equal(body.data[0].displayType, "Внутренняя система управления компанией");
  assert.equal(body.data[0].features.length, 9);
  assert.deepEqual(body.data[0].notes, []);
});

test("public project API returns localized normalized content blocks without duplicating existing relations", async () => {
  const [ruResponse, enResponse] = await Promise.all([
    app.inject({ method: "GET", url: "/api/v1/projects?locale=ru" }),
    app.inject({ method: "GET", url: "/api/v1/projects?locale=en" }),
  ]);
  assert.equal(ruResponse.statusCode, 200);
  assert.equal(enResponse.statusCode, 200);
  const ru = new Map(ruResponse.json().data.map((project: any) => [project.id, project]));
  const en = new Map(enResponse.json().data.map((project: any) => [project.id, project]));
  const cmccRu: any = ru.get("construction-management-control-center"); const cmccEn: any = en.get("construction-management-control-center");
  assert.equal(cmccRu.displayType, "Внутренняя система управления компанией");
  assert.equal(cmccEn.displayType, "Internal company management system");
  assert.equal(cmccRu.features.length, 9); assert.equal(cmccEn.features.length, 9);
  assert.deepEqual(cmccRu.notes, []); assert.deepEqual(cmccEn.notes, []);
  const bradburyRu: any = ru.get("project-bradbury"); const bradburyEn: any = en.get("project-bradbury");
  assert.equal(bradburyRu.features.length, 5); assert.equal(bradburyEn.features.length, 5);
  assert.equal(bradburyRu.notes.length, 2); assert.equal(bradburyEn.notes.length, 2);
  assert.notEqual(bradburyRu.features[0], bradburyEn.features[0]);
  assert.notEqual(bradburyRu.notes[0], bradburyEn.notes[0]);
  const foodAiRu: any = ru.get("foodai"); const foodAiEn: any = en.get("foodai");
  assert.equal(foodAiRu.features.length, 5); assert.equal(foodAiEn.features.length, 5);
  assert.deepEqual(foodAiRu.notes, []); assert.deepEqual(foodAiEn.notes, []);
  const expectedLinkCounts = { "construction-management-control-center": 2, "project-bradbury": 1, foodai: 2 };
  for (const [projectId, expectedCount] of Object.entries(expectedLinkCounts)) {
    const ruProject: any = ru.get(projectId); const enProject: any = en.get(projectId);
    assert.equal(ruProject.links.length, expectedCount); assert.equal(enProject.links.length, expectedCount);
    assert.deepEqual(ruProject.links.map((link: any) => link.id), enProject.links.map((link: any) => link.id));
    assert.ok(ruProject.links.every((link: any) => Object.keys(link).sort().join(",") === "id,label,url" && link.url && link.label));
    assert.ok(enProject.links.every((link: any) => Object.keys(link).sort().join(",") === "id,label,url" && link.url && link.label));
  }
  const detailResponses = await Promise.all(Object.keys(expectedLinkCounts).map((projectId) => app.inject({ method: "GET", url: `/api/v1/projects/${projectId}?locale=en` })));
  for (const response of detailResponses) {
    assert.equal(response.statusCode, 200);
    const detail: any = response.json().data;
    assert.deepEqual(detail.links, (en.get(detail.id) as any).links);
  }
  for (const project of [cmccRu, bradburyRu, foodAiRu] as any[]) {
    assert.equal(new Set(project.technologies).size, project.technologies.length);
    assert.equal(new Set(project.media.map((asset: any) => asset.id)).size, project.media.length);
    assert.ok(project.title && project.description && project.role && project.statusLabel);
    assert.ok(project.media.every((asset: any) => asset.presentation && asset.galleryKind));
  }
});

test("missing or empty normalized public links are controlled public content integrity errors", async () => {
  const missingTranslation = await pool.query<{ project_link_id: string; label: string }>(`
    select translation.project_link_id, translation.label
    from project_link_translations translation
    join project_links link on link.id = translation.project_link_id
    join projects p on p.id = link.project_id
    where p.external_key = 'project-bradbury' and translation.locale = 'ru'
    limit 1
  `);
  assert.ok(missingTranslation.rows[0]);
  try {
    await pool.query("delete from project_link_translations where project_link_id=$1 and locale='ru'", [missingTranslation.rows[0]!.project_link_id]);
    const response = await app.inject({ method: "GET", url: "/api/v1/projects/project-bradbury?locale=ru" });
    assert.equal(response.statusCode, 500);
    assert.equal(response.json().error.code, "PUBLISHED_PROJECT_CONTENT_INTEGRITY_ERROR");
  } finally {
    await pool.query("insert into project_link_translations (project_link_id,locale,label) values ($1,'ru',$2)", [missingTranslation.rows[0]!.project_link_id, missingTranslation.rows[0]!.label]);
  }

  const links = await pool.query<{ id: string; project_id: string; url: string; sort_order: number; created_at: Date; updated_at: Date }>(`
    select link.id, link.project_id, link.url, link.sort_order, link.created_at, link.updated_at
    from project_links link join projects p on p.id = link.project_id
    where p.external_key = 'project-bradbury'
  `);
  const translations = await pool.query<{ project_link_id: string; locale: string; label: string }>(`
    select translation.project_link_id, translation.locale, translation.label
    from project_link_translations translation
    join project_links link on link.id = translation.project_link_id
    join projects p on p.id = link.project_id
    where p.external_key = 'project-bradbury'
  `);
  assert.ok(links.rowCount);
  try {
    await pool.query("delete from project_links where project_id=$1", [links.rows[0]!.project_id]);
    const response = await app.inject({ method: "GET", url: "/api/v1/projects/project-bradbury?locale=en" });
    assert.equal(response.statusCode, 500);
    assert.equal(response.json().error.code, "PUBLISHED_PROJECT_CONTENT_INTEGRITY_ERROR");
  } finally {
    for (const link of links.rows) await pool.query(
      "insert into project_links (id,project_id,url,sort_order,created_at,updated_at) values ($1,$2,$3,$4,$5,$6)",
      [link.id, link.project_id, link.url, link.sort_order, link.created_at, link.updated_at],
    );
    for (const translation of translations.rows) await pool.query(
      "insert into project_link_translations (project_link_id,locale,label) values ($1,$2,$3)",
      [translation.project_link_id, translation.locale, translation.label],
    );
  }
});

test("missing normalized locale translation is a controlled public content integrity error", async () => {
  const original = await pool.query<{ feature_id: string; text: string }>(`
    select translation.feature_id, translation.text
    from project_feature_translations translation
    join project_features feature on feature.id = translation.feature_id
    join projects p on p.id = feature.project_id
    where p.external_key = 'project-bradbury' and translation.locale = 'ru'
    order by feature.sort_order limit 1
  `);
  assert.ok(original.rows[0]);
  try {
    await pool.query("delete from project_feature_translations where feature_id=$1 and locale='ru'", [original.rows[0]!.feature_id]);
    const response = await app.inject({ method: "GET", url: "/api/v1/projects/project-bradbury?locale=ru" });
    assert.equal(response.statusCode, 500);
    assert.equal(response.json().error.code, "PUBLISHED_PROJECT_CONTENT_INTEGRITY_ERROR");
  } finally {
    await pool.query("insert into project_feature_translations (feature_id,locale,text) values ($1,'ru',$2)", [original.rows[0]!.feature_id, original.rows[0]!.text]);
  }
});

test("content-block migration backfills localized fixture blocks without rewriting historical revisions", async () => {
  const displayTypes = await pool.query<{ external_key: string; locale: string; display_type: string }>(`
    select p.external_key, pt.locale, pt.display_type
    from projects p join project_translations pt on pt.project_id = p.id
    where p.external_key = any($1::text[]) and pt.locale in ('ru', 'en')
    order by p.external_key, pt.locale
  `, [["construction-management-control-center", "project-bradbury", "foodai"]]);
  assert.equal(displayTypes.rowCount, 6);
  assert.ok(displayTypes.rows.every((translation) => translation.display_type.trim().length > 0));

  const featureCounts = await pool.query<{ external_key: string; count: string }>(`
    select p.external_key, count(feature.id)::text as count
    from projects p left join project_features feature on feature.project_id = p.id
    where p.external_key = any($1::text[])
    group by p.external_key order by p.external_key
  `, [["construction-management-control-center", "project-bradbury", "foodai"]]);
  assert.deepEqual(Object.fromEntries(featureCounts.rows.map((row) => [row.external_key, Number(row.count)])), {
    "construction-management-control-center": 9,
    "project-bradbury": 5,
    foodai: 5,
  });

  const noteCounts = await pool.query<{ external_key: string; count: string }>(`
    select p.external_key, count(note.id)::text as count
    from projects p left join project_notes note on note.project_id = p.id
    where p.external_key = any($1::text[])
    group by p.external_key order by p.external_key
  `, [["construction-management-control-center", "project-bradbury", "foodai"]]);
  assert.deepEqual(Object.fromEntries(noteCounts.rows.map((row) => [row.external_key, Number(row.count)])), {
    "construction-management-control-center": 0,
    "project-bradbury": 2,
    foodai: 0,
  });

  const localizationFailures = await pool.query<{ item_type: string; id: string }>(`
    select 'feature' as item_type, feature.id::text as id
    from project_features feature
    join projects p on p.id = feature.project_id
    left join project_feature_translations translation on translation.feature_id = feature.id and translation.locale in ('ru', 'en')
    where p.external_key = any($1::text[])
    group by feature.id having count(translation.locale) <> 2
    union all
    select 'note' as item_type, note.id::text as id
    from project_notes note
    join projects p on p.id = note.project_id
    left join project_note_translations translation on translation.note_id = note.id and translation.locale in ('ru', 'en')
    where p.external_key = any($1::text[])
    group by note.id having count(translation.locale) <> 2
  `, [["construction-management-control-center", "project-bradbury", "foodai"]]);
  assert.equal(localizationFailures.rowCount, 0);

  const duplicateOrders = await pool.query<{ item_type: string; project_id: string; sort_order: number }>(`
    select 'feature' as item_type, project_id::text, sort_order from project_features
    group by project_id, sort_order having count(*) > 1
    union all
    select 'note' as item_type, project_id::text, sort_order from project_notes
    group by project_id, sort_order having count(*) > 1
  `);
  assert.equal(duplicateOrders.rowCount, 0);

  const rawHistory = {
    slug: "project-bradbury", galleryId: "bradbury", sortOrder: 20, projectType: "quiet-social-platform",
    dates: { startedAt: null, endedAt: null, ongoing: true },
    translations: {
      en: { title: "Raw history", subtitle: null, description: "Raw history", role: "Owner", statusLabel: "Archived", primaryActionLabel: "Open", secondaryActionLabel: null, technologiesTitle: null },
      ru: { title: "Сырая история", subtitle: null, description: "Сырая история", role: "Владелец", statusLabel: "Архив", primaryActionLabel: "Открыть", secondaryActionLabel: null, technologiesTitle: null },
    },
    technologies: [], links: { primary: { href: "https://example.com/history" }, secondary: null }, media: [],
  };
  const revisionId = "94000000-0000-4000-8000-000000000001";
  const project = await pool.query<{ id: string }>("select id from projects where external_key='project-bradbury'");
  const projectId = project.rows[0]!.id;
  await pool.query("delete from project_revisions where id=$1", [revisionId]);
  await pool.query("insert into project_revisions (id,project_id,revision_number,revision_type,content,created_at,updated_at) values ($1,$2,9999,'draft',$3,now(),now())", [revisionId, projectId, rawHistory]);
  try {
    const history = await new ProjectDraftRepository(pool).revisions("project-bradbury");
    assert.deepEqual(history[0]?.content.links, [{ id: "92000000-0000-4000-8000-000000000001", url: "https://example.com/history", sortOrder: 10, label: { ru: "Открыть", en: "Open" } }]);
    assert.equal(history[0]?.content.translations.en.displayType, "Quiet social platform");
    assert.equal(history[0]?.content.features.length, 5);
    assert.equal(history[0]?.content.notes.length, 2);
    const stored = await pool.query<{ content: Record<string, unknown> }>("select content from project_revisions where id=$1", [revisionId]);
    assert.deepEqual(stored.rows[0]?.content, rawHistory);
  } finally {
    await pool.query("delete from project_revisions where id=$1", [revisionId]);
  }
});

test("invalid locale returns 400", async () => {
  const response = await app.inject({ method: "GET", url: "/api/v1/projects?locale=de" });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, "VALIDATION_ERROR");
});

test("unknown slug returns 404", async () => {
  const response = await app.inject({ method: "GET", url: "/api/v1/projects/unknown?locale=en" });
  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, "NOT_FOUND");
});

test("media counts and seed idempotency are correct", async () => {
  const verification = await verifySeed(pool);
  assert.deepEqual(verification.mediaByProject, {
    "construction-management-control-center": 2,
    "project-bradbury": 8,
    foodai: 2,
  });

  const counts = await pool.query<{ table_name: string; count: string }>(`
    select 'projects' as table_name, count(*) from projects
    union all select 'technologies', count(*) from technologies
    union all select 'legacy_media_assets', count(*) from media_assets where source_type = 'legacy'
  `);
  assert.deepEqual(Object.fromEntries(counts.rows.map((row) => [row.table_name, Number(row.count)])), {
    projects: 3,
    technologies: 16,
    legacy_media_assets: 12,
  });
});

test("seed materializes orientation on project references without changing media assets", async () => {
  assert.deepEqual(await verifyMediaOrientation(pool), { vertical: 6, horizontal: 6, unresolved: 0 });
  const assetOrientation = await pool.query("select column_name from information_schema.columns where table_name='media_assets' and column_name='orientation'");
  assert.equal(assetOrientation.rowCount, 0);
  const ordered = await pool.query<{ orientation: string; sort_order: number }>("select orientation,sort_order from project_media where project_id=(select id from projects where external_key='project-bradbury') order by orientation,sort_order");
  assert.deepEqual(ordered.rows.filter((row) => row.orientation === "vertical").map((row) => row.sort_order), [10, 20, 30, 40]);
  assert.deepEqual(ordered.rows.filter((row) => row.orientation === "horizontal").map((row) => row.sort_order), [50, 60, 70, 80]);
});

test("orientation migration backfills portrait, landscape, square, and reports unresolved references", async () => {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("update project_media set orientation=null where media_asset_id=(select id from media_assets where external_key='project-bradbury:mobile-home')");
    await client.query("update project_media set orientation=null where media_asset_id=(select id from media_assets where external_key='construction-management-control-center:dashboard')");
    await client.query("update media_assets set width=800,height=800 where external_key='construction-management-control-center:dashboard'");
    await client.query("update project_media set orientation=null where media_asset_id=(select id from media_assets where external_key='foodai:meal-plan')");
    await client.query("update media_assets set width=null,height=null where external_key='foodai:meal-plan'");
    const migration = await readFile(fileURLToPath(new URL("../drizzle/0005_project_media_orientation.sql", import.meta.url)), "utf8");
    for (const statement of migration.split("--> statement-breakpoint").map((item) => item.trim()).filter(Boolean)) await client.query(statement);
    const orientations = await client.query<{ external_key: string; orientation: string | null }>("select m.external_key,pm.orientation from project_media pm join media_assets m on m.id=pm.media_asset_id where m.external_key = any($1::text[]) order by m.external_key", [["project-bradbury:mobile-home", "construction-management-control-center:dashboard", "foodai:meal-plan"]]);
    assert.deepEqual(orientations.rows, [
      { external_key: "construction-management-control-center:dashboard", orientation: "horizontal" },
      { external_key: "foodai:meal-plan", orientation: null },
      { external_key: "project-bradbury:mobile-home", orientation: "vertical" },
    ]);
    await client.query("rollback");
  } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
});

test("non-published records are not returned", async () => {
  await pool.query(`
    insert into projects (
      id, external_key, slug, gallery_id, status, sort_order, is_ongoing, created_at, updated_at
    )
    values ('11111111-1111-4111-a111-111111111111', 'draft-project', 'draft-project', 'draft', 'draft', 999, false, now(), now())
    on conflict (external_key) do update set status = 'draft', updated_at = now()
  `);

  const response = await app.inject({ method: "GET", url: "/api/v1/projects?locale=en" });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().meta.count, 3);
});
