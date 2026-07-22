import { migrate } from "drizzle-orm/node-postgres/migrator";
import { loadEnv } from "../src/config/env.js";
import { createDatabase, createPool } from "../src/db/client.js";
import { ProjectDraftRepository } from "../src/modules/admin-projects/project-draft.repository.js";

const env = loadEnv();
const pool = createPool(env.DATABASE_URL);

try {
  await migrate(createDatabase(pool), { migrationsFolder: "./drizzle" });
  await new ProjectDraftRepository(pool).backfill();
  console.info({ event: "database_migrations_complete" });
} finally {
  await pool.end();
}
