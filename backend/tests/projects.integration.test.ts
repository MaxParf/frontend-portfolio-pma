import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { buildApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";
import { createDatabase } from "../src/db/client.js";
import { loadFrontendProjects, seedProjects } from "../scripts/seed-projects.js";
import { verifySeed } from "../scripts/verify-seed.js";

const env = loadEnv({ ...process.env, NODE_ENV: "test" });
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
    union all select 'media_assets', count(*) from media_assets
  `);
  assert.deepEqual(Object.fromEntries(counts.rows.map((row) => [row.table_name, Number(row.count)])), {
    projects: 3,
    technologies: 16,
    media_assets: 12,
  });
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
