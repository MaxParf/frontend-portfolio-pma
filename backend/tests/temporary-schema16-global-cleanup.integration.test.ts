import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";

type DatabaseRow = { datname: string };
type SessionRow = { datname: string; session_count: number };

function runnerTestConnection(): { connectionString: string; expectedDatabase: string } {
  assert.equal(process.env.DATABASE_PURPOSE, "test", "cleanup proof requires DATABASE_PURPOSE=test");
  assert.ok(process.env.DATABASE_URL, "cleanup proof requires runner-provided DATABASE_URL");
  assert.ok(process.env.TEST_DATABASE_NAME, "cleanup proof requires TEST_DATABASE_NAME");

  const url = new URL(process.env.DATABASE_URL);
  const expectedDatabase = process.env.TEST_DATABASE_NAME!;
  const sourceDatabase = decodeURIComponent(url.pathname.replace(/^\//, ""));
  assert.ok(sourceDatabase.endsWith("_test"), "cleanup proof source must be a _test database");
  assert.equal(sourceDatabase, expectedDatabase, "cleanup proof URL must target TEST_DATABASE_NAME");
  assert.ok(!sourceDatabase.startsWith("portfolio_schema16_"), "cleanup proof must not run inside a nested temporary database");

  return { connectionString: url.toString(), expectedDatabase };
}

test("runner-internal schema16 cleanup proof finds no nested databases or sessions", async () => {
  const { connectionString, expectedDatabase } = runnerTestConnection();
  const pool = new pg.Pool({ connectionString });

  try {
    const currentDatabase = (await pool.query<{ datname: string }>("select current_database() as datname")).rows[0]?.datname;
    assert.equal(currentDatabase, expectedDatabase, "cleanup proof must use the runner-managed test database");
    assert.ok(!currentDatabase?.startsWith("portfolio_schema16_"), "runner-managed database must not be a nested temporary database");

    const databases = await pool.query<DatabaseRow>("select datname from pg_database where datname like 'portfolio_schema16_%_test' order by datname");
    const sessions = await pool.query<SessionRow>("select datname, count(*)::int as session_count from pg_stat_activity where datname like 'portfolio_schema16_%_test' group by datname order by datname");

    console.log(`TEMPDB_GLOBAL_CLEANUP database_count=${databases.rowCount ?? 0} session_count=${sessions.rowCount ?? 0} source=${currentDatabase}`);
    assert.deepEqual(databases.rows.map(({ datname }) => datname), [], `unexpected temporary databases: ${databases.rows.map(({ datname }) => datname).join(", ")}`);
    assert.deepEqual(sessions.rows.map(({ datname, session_count }) => ({ datname, session_count })), [], `unexpected temporary sessions: ${sessions.rows.map(({ datname, session_count }) => `${datname}:${session_count}`).join(", ")}`);
    assert.equal((await pool.query("select 1")).command, "SELECT", "runner connection must remain usable after read-only checks");
  } finally {
    await pool.end();
  }
});
