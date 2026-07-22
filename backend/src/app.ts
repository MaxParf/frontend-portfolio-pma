import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import fastify from "fastify";
import type pg from "pg";
import type { AppEnv } from "./config/env.js";
import { createDatabase } from "./db/client.js";
import { registerErrorHandler } from "./middleware/error-handler.js";
import { registerNotFoundHandler } from "./middleware/not-found.js";
import { registerOriginProtection } from "./middleware/origin-protection.js";
import { requestIdHeader } from "./middleware/request-id.js";
import { registerAdminProjectRoutes } from "./modules/admin-projects/admin-project.routes.js";
import { registerAuthRoutes } from "./modules/auth/auth.routes.js";
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

  app.register(cookie);
  app.register(rateLimit, {
    global: false,
  });

  app.register(cors, {
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    origin: (origin, callback) => {
      const allowedOrigins = [...env.CORS_ORIGINS, ...env.CMS_ORIGINS];
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
  });

  registerOriginProtection(app, env);
  app.get("/", async () => ({ service: "maxpar-portfolio-api", status: "ok" }));
  registerHealthRoutes(app, pool);
  registerPublicRoutes(app, db);
  const authService = registerAuthRoutes(app, env, db);
  registerAdminProjectRoutes(app, db, pool, authService);
  registerErrorHandler(app);
  registerNotFoundHandler(app);

  return app;
}
