import { loadEnv } from "./config/env.js";
import { checkDatabase, createPool } from "./db/client.js";
import { buildApp } from "./app.js";

const env = loadEnv();
const pool = createPool(env.DATABASE_URL);
const app = buildApp(env, pool);

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  app.log.info({ signal }, "Shutdown signal received");
  try {
    await app.close();
    await pool.end();
    process.exit(0);
  } catch (error) {
    app.log.error({ err: error }, "Shutdown failed");
    process.exit(1);
  }
}

process.on("SIGTERM", (signal) => void shutdown(signal));
process.on("SIGINT", (signal) => void shutdown(signal));

try {
  await checkDatabase(pool);
  app.log.info("Database availability check passed");
  await app.listen({ host: env.HOST, port: env.PORT });
  app.log.info({ host: env.HOST, port: env.PORT }, "Portfolio API started");
} catch (error) {
  app.log.error({ err: error }, "Portfolio API failed to start");
  await pool.end();
  process.exit(1);
}
