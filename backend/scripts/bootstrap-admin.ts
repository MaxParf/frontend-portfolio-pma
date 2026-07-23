import { randomUUID } from "node:crypto";
import pg from "pg";
import { loadEnv } from "../src/config/env.js";
import { assertProductionDatabase, createOwnerBootstrapPolicy } from "../src/config/database-identity.js";
import { createDatabase } from "../src/db/client.js";
import { AuthRepository } from "../src/modules/auth/auth.repository.js";
import { DEFAULT_OWNER_LOGIN, hashPassword, normalizeLogin } from "../src/modules/auth/auth.crypto.js";
import { assertNoPasswordCliArgument, resolveOwnerPassword } from "./owner-password-source.js";

async function main(): Promise<void> {
  assertNoPasswordCliArgument(process.argv.slice(2));
  const password = await resolveOwnerPassword();
  const env = loadEnv();
  if (env.NODE_ENV === "production") assertProductionDatabase(env, "Production owner bootstrap");
  const login = normalizeLogin(process.env.ADMIN_LOGIN ?? process.argv[2] ?? DEFAULT_OWNER_LOGIN);
  const displayName = process.env.ADMIN_DISPLAY_NAME ?? process.argv[3] ?? "Maksim";

  if (!login) {
    throw new Error("Owner login is required.");
  }

  const passwordHash = await hashPassword(password);
  const pool = new pg.Pool({ connectionString: env.DATABASE_URL });

  try {
    const repository = new AuthRepository(createDatabase(pool));
    const result = await repository.bootstrapOwner({
      id: randomUUID(),
      login,
      displayName,
      passwordHash,
      now: new Date(),
    }, createOwnerBootstrapPolicy(env));
    console.info({ event: "admin_owner_bootstrapped", ownerId: result.ownerId, result: result.result, databasePurpose: env.DATABASE_PURPOSE ?? "development", revokedSessionCount: result.revokedSessionCount });
  } finally {
    await pool.end();
  }
}

try {
  await main();
  process.exit(0);
} catch (error) {
  console.error({ event: "admin_owner_bootstrap_failed", message: error instanceof Error ? error.message : "Owner bootstrap failed." });
  process.exit(1);
}
