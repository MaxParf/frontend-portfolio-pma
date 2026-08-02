import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import "dotenv/config";
import { assertTestDatabaseName } from "../src/config/database-identity.js";
import { createDatabase } from "../src/db/client.js";
import { loadFrontendProjects, seedProjects } from "./seed-projects.js";

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
const bootstrapTags = [
  "0000_round_marvex", "0001_nostalgic_toad_men", "0002_useful_toxin", "0003_project_draft_revisions",
  "0004_project_media_management", "0005_project_media_orientation", "0006_project_media_presentation", "0007_project_media_gallery_kind",
] as const;

async function createBootstrapMigrationFolder(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-drizzle-test-bootstrap-"));
  const meta = join(directory, "meta");
  await mkdir(meta);
  const journal = JSON.parse(await readFile(resolve("./drizzle/meta/_journal.json"), "utf8")) as { version: string; dialect: string; entries: Array<{ idx: number; version: string; when: number; tag: string; breakpoints: boolean }> };
  const entries = journal.entries.filter((entry) => bootstrapTags.includes(entry.tag as (typeof bootstrapTags)[number]));
  await writeFile(join(meta, "_journal.json"), `${JSON.stringify({ version: journal.version, dialect: journal.dialect, entries }, null, 2)}\n`);
  for (const tag of bootstrapTags) await writeFile(join(directory, `${tag}.sql`), await readFile(resolve("./drizzle", `${tag}.sql`), "utf8"));
  return directory;
}

const adminPool = new pg.Pool({ connectionString: sourceUrl });
let bootstrapDirectory: string | undefined;
try {
  await adminPool.query(`drop database if exists ${quoteIdentifier(testDatabaseName)} with (force)`);
  await adminPool.query(`create database ${quoteIdentifier(testDatabaseName)}`);
  const testPool = new pg.Pool({ connectionString: testUrl.toString() });
  try {
    bootstrapDirectory = await createBootstrapMigrationFolder();
    await migrate(createDatabase(testPool), { migrationsFolder: bootstrapDirectory });
    await seedProjects(testPool, await loadFrontendProjects(), { mode: "legacy-bootstrap" });
    await migrate(createDatabase(testPool), { migrationsFolder: resolve("./drizzle") });
  } finally {
    await testPool.end();
  }
} finally {
  await adminPool.end();
  if (bootstrapDirectory) await rm(bootstrapDirectory, { recursive: true, force: true });
}

const testFiles = process.env.TEST_FILES?.split(",").filter(Boolean) ?? ["tests/**/*.test.ts"];
const child = spawn(process.execPath, ["--test", "--test-concurrency=1", "--import", "tsx", ...testFiles], {
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
