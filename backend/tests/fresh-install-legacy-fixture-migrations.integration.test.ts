import assert from "node:assert/strict";
import test from "node:test";
const { createTemporarySchema16Database } = await import(new URL("./helpers/temporary-schema16-database.ts", import.meta.url).href) as typeof import("./helpers/temporary-schema16-database.js");

test("fresh migration chain does not require legacy CMCC, Bradbury, or FoodAI fixtures", async () => {
  const handle = await createTemporarySchema16Database({ namePrefix: "portfolio_fresh", seedLegacy: false });
  try {
    const count = async (table: string) => Number((await handle.pool.query<{ count: string }>(`select count(*)::text as count from ${table}`)).rows[0]?.count ?? 0);
    assert.equal(handle.migrationTrackingCount, 16);
    assert.equal(Number((await handle.pool.query<{ count: string }>("select count(*)::text as count from projects where external_key in ('construction-management-control-center','project-bradbury','foodai')")).rows[0]?.count ?? 0), 0);
    assert.equal(await count("project_features"), 0);
    assert.equal(await count("project_links"), 0);
    assert.equal(await count("project_locale_publications"), 0);
  } finally {
    assert.equal((await handle.cleanup()).databaseAbsentAfterDrop, true);
  }
});

test("legacy fixture upgrade preserves the known project content and links", async () => {
  const handle = await createTemporarySchema16Database({ namePrefix: "portfolio_legacy" });
  try {
    const result = await handle.pool.query<{ projects: string; features: string; notes: string; links: string }>("select (select count(*)::text from projects) as projects,(select count(*)::text from project_features) as features,(select count(*)::text from project_notes) as notes,(select count(*)::text from project_links) as links");
    assert.deepEqual(result.rows[0], { projects: "3", features: "19", notes: "2", links: "5" });
  } finally {
    assert.equal((await handle.cleanup()).databaseAbsentAfterDrop, true);
  }
});

test("partial legacy fixture baseline fails deterministically", async () => {
  await assert.rejects(
    () => createTemporarySchema16Database({
      namePrefix: "portfolio_partial",
      beforeFullMigration: async (pool) => {
        await pool.query("delete from projects where external_key in ('project-bradbury','foodai')");
      },
    }),
    /partial CMCC, Project Bradbury, and FoodAI legacy baseline/,
  );
});
