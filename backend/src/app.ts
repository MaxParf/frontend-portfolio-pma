import cors from "@fastify/cors";
import fastify from "fastify";
import type pg from "pg";
import type { AppEnv } from "./config/env.js";
import { createDatabase } from "./db/client.js";
import { registerErrorHandler } from "./middleware/error-handler.js";
import { registerNotFoundHandler } from "./middleware/not-found.js";
import { requestIdHeader } from "./middleware/request-id.js";
import { registerHealthRoutes } from "./routes/health.routes.js";
import { registerPublicRoutes } from "./routes/public.routes.js";

export function buildApp(env: AppEnv, pool: pg.Pool) {
  const app = fastify({
    logger: {
      level: env.LOG_LEVEL,
      redact: ["req.headers.authorization", "req.headers.cookie"],
    },
    genReqId: requestIdHeader,
    bodyLimit: 32 * 1024,
    requestTimeout: 15_000,
  });

  const db = createDatabase(pool);

  app.register(cors, {
    origin: (origin, callback) => {
      if (!origin || env.CORS_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("CORS origin is not allowed"), false);
    },
  });

  registerHealthRoutes(app, pool);
  registerPublicRoutes(app, db);
  registerErrorHandler(app);
  registerNotFoundHandler(app);

  return app;
}
