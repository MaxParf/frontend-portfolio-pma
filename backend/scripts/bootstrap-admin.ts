import { randomUUID } from "node:crypto";
import { stdin as input, stdout as output } from "node:process";
import readline from "node:readline/promises";
import pg from "pg";
import { loadEnv } from "../src/config/env.js";
import { createDatabase } from "../src/db/client.js";
import { AuthRepository } from "../src/modules/auth/auth.repository.js";
import { DEFAULT_OWNER_LOGIN, hashPassword, normalizeLogin } from "../src/modules/auth/auth.crypto.js";

async function readPassword(): Promise<string> {
  if (process.env.ADMIN_PASSWORD) {
    return process.env.ADMIN_PASSWORD;
  }

  const rl = readline.createInterface({ input, output });
  const shouldHide = input.isTTY && process.platform !== "win32";

  if (input.isTTY) {
    input.setRawMode?.(false);
  }

  if (shouldHide) {
    const { execFileSync } = await import("node:child_process");
    execFileSync("stty", ["-echo"], { stdio: ["inherit", "ignore", "ignore"] });
  }

  try {
    const password = await rl.question("Owner password: ");
    output.write("\n");
    return password;
  } finally {
    rl.close();
    if (shouldHide) {
      const { execFileSync } = await import("node:child_process");
      execFileSync("stty", ["echo"], { stdio: ["inherit", "ignore", "ignore"] });
    }
  }
}

async function main(): Promise<void> {
  const env = loadEnv();
  const login = normalizeLogin(process.env.ADMIN_LOGIN ?? process.argv[2] ?? DEFAULT_OWNER_LOGIN);
  const displayName = process.env.ADMIN_DISPLAY_NAME ?? process.argv[3] ?? "Maksim";

  if (!login) {
    throw new Error("Owner login is required.");
  }

  const password = await readPassword();
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
    });
    console.info({ event: "admin_owner_bootstrapped", login, displayName, result });
  } finally {
    await pool.end();
  }
}

await main();
