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
import { verifySeed } from "../scripts/verify-seed.js";
import { verifyMediaOrientation } from "../scripts/verify-media-orientation.js";

const env = loadEnv({ ...process.env, NODE_ENV: "test" });
assertTestDatabase(env, "Projects integration test setup");
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const app = buildApp(env, pool);

before(async () => {
  await migrate(createDatabase(pool), { migrationsFolder: "./drizzle" });
  await pool.query("delete from projects where external_key = 'draft-project'");
  const sourceProjects = await loadFrontendProjects();
  await seedProjects(pool, sourceProjects);
  await seedProjects(pool, sourceProjects);
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
