import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";
import "dotenv/config";
import { assertTestDatabaseName } from "../src/config/database-identity.js";

const testDatabaseName = process.env.TEST_DATABASE_NAME ?? "portfolio_test";
assertTestDatabaseName(testDatabaseName);
const testMediaRoot = resolve("./storage/project-media-test");
await rm(testMediaRoot, { recursive: true, force: true });
const sourceUrl = process.env.DATABASE_URL;

if (!sourceUrl) throw new Error("DATABASE_URL is required to prepare the isolated test database.");

const source = new URL(sourceUrl);
const sourceDatabaseName = decodeURIComponent(source.pathname.replace(/^\//, ""));
if (!sourceDatabaseName || sourceDatabaseName === testDatabaseName) {
  throw new Error("DATABASE_URL must point to a non-test database before deriving the isolated test database.");
}

const testUrl = new URL(sourceUrl);
testUrl.pathname = `/${encodeURIComponent(testDatabaseName)}`;
const quoteIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`;

const adminPool = new pg.Pool({ connectionString: sourceUrl });
try {
  const exists = await adminPool.query<{ exists: boolean }>("select exists(select 1 from pg_database where datname = $1) as exists", [testDatabaseName]);
  if (!exists.rows[0]?.exists) await adminPool.query(`create database ${quoteIdentifier(testDatabaseName)}`);
} finally {
  await adminPool.end();
}

const child = spawn(process.execPath, ["--test", "--test-concurrency=1", "--import", "tsx", "tests/**/*.test.ts"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    NODE_ENV: "test",
    DATABASE_PURPOSE: "test",
    TEST_DATABASE_NAME: testDatabaseName,
    DATABASE_URL: testUrl.toString(),
    ALLOW_TEST_OWNER_BOOTSTRAP: "true",
    MEDIA_STORAGE_ROOT: testMediaRoot,
  },
  stdio: "inherit",
});

child.once("exit", async (code, signal) => {
  await rm(testMediaRoot, { recursive: true, force: true });
  process.exitCode = code ?? (signal ? 1 : 0);
});
