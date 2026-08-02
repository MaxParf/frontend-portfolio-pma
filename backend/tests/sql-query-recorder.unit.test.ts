import assert from "node:assert/strict";
import test from "node:test";
import { recordSql } from "./helpers/sql-query-recorder.js";
test("SQL recorder normalizes quoted, qualified, CTE and comment/literal references", () => { assert.deepEqual(recordSql('SELECT * FROM public."projects"').referencedTables, ["projects"]); assert.equal(recordSql("WITH x AS (SELECT * FROM projects) SELECT * FROM x").statementType, "with_select"); assert.deepEqual(recordSql("/* project_locale_publications */ select 'project_locale_publications' from projects").referencedTables, ["projects"]); assert.equal(recordSql("UPDATE projects SET status='draft'").statementType, "update"); });
