import { migrate } from "drizzle-orm/node-postgres/migrator";
import { assertProductionDatabase } from "../src/config/database-identity.js";
import { loadEnv } from "../src/config/env.js";
import { createDatabase, createPool } from "../src/db/client.js";
import { ProjectDraftRepository } from "../src/modules/admin-projects/project-draft.repository.js";

const env = loadEnv();
assertProductionDatabase(env, "Production migrations");
const pool = createPool(env.DATABASE_URL);

try {
  await migrate(createDatabase(pool), { migrationsFolder: "./drizzle" });
  await new ProjectDraftRepository(pool).backfill();
  console.info({ event: "production_database_migrations_complete" });
} finally {
  await pool.end();
}
