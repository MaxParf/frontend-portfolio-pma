import { randomUUID } from "node:crypto";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { assertTestDatabaseName, createOwnerBootstrapPolicy } from "../src/config/database-identity.js";
import { loadEnv } from "../src/config/env.js";
import { createDatabase } from "../src/db/client.js";
import { AuthRepository } from "../src/modules/auth/auth.repository.js";
import { hashPassword } from "../src/modules/auth/auth.crypto.js";
import { loadFrontendProjects, seedProjects } from "./seed-projects.js";

const testDatabaseName = process.env.TEST_DATABASE_NAME ?? "portfolio_test";
assertTestDatabaseName(testDatabaseName);
const sourceUrl = process.env.DATABASE_URL;
if (!sourceUrl) throw new Error("DATABASE_URL is required to start isolated E2E.");
const source = new URL(sourceUrl);
if (decodeURIComponent(source.pathname.replace(/^\//, "")) === testDatabaseName) throw new Error("E2E source DATABASE_URL must not already point to the test database.");
const testUrl = new URL(sourceUrl);
testUrl.pathname = `/${encodeURIComponent(testDatabaseName)}`;
const quoteIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`;

const adminPool = new pg.Pool({ connectionString: sourceUrl });
try {
  const existing = await adminPool.query<{ exists: boolean }>("select exists(select 1 from pg_database where datname = $1) as exists", [testDatabaseName]);
  if (!existing.rows[0]?.exists) await adminPool.query(`create database ${quoteIdentifier(testDatabaseName)}`);
} finally {
  await adminPool.end();
}

const password = process.env.TEST_ADMIN_PASSWORD;
if (!password) throw new Error("TEST_ADMIN_PASSWORD is required for isolated E2E.");

const runtimeEnv = {
  ...process.env,
  NODE_ENV: "test",
  PORT: "3002",
  DATABASE_URL: testUrl.toString(),
  DATABASE_PURPOSE: "test",
  TEST_DATABASE_NAME: testDatabaseName,
  ALLOW_TEST_OWNER_BOOTSTRAP: "true",
  ADMIN_PASSWORD: password,
  ADMIN_LOGIN: process.env.TEST_ADMIN_LOGIN ?? "@test-owner.local",
  CORS_ORIGINS: "http://127.0.0.1:5511",
  CMS_ORIGINS: "http://127.0.0.1:5511",
  MEDIA_STORAGE_ROOT: "./storage/project-media-e2e-test",
};
const env = loadEnv(runtimeEnv);
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
try {
  await pool.query("drop schema public cascade");
  await pool.query("drop schema if exists drizzle cascade");
  await pool.query("create schema public");
  const db = createDatabase(pool);
  await migrate(db, { migrationsFolder: "./drizzle" });
  await seedProjects(pool, await loadFrontendProjects());
  await new AuthRepository(db).bootstrapOwner({
    id: randomUUID(),
    login: runtimeEnv.ADMIN_LOGIN,
    displayName: "Test Owner",
    passwordHash: await hashPassword(password),
    now: new Date(),
  }, createOwnerBootstrapPolicy(env));
} finally {
  await pool.end();
}

Object.assign(process.env, runtimeEnv);
await import("../src/server.js");
