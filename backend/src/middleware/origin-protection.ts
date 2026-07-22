import type { FastifyInstance } from "fastify";
import type { AppEnv } from "../config/env.js";
import { HttpError } from "./error-handler.js";

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function registerOriginProtection(app: FastifyInstance, env: AppEnv): void {
  const allowedOrigins = new Set([...env.CORS_ORIGINS, ...env.CMS_ORIGINS]);

  app.addHook("preHandler", async (request) => {
    if (!unsafeMethods.has(request.method) || !request.url.startsWith("/api/v1/admin/")) {
      return;
    }

    const origin = request.headers.origin;
    if (typeof origin !== "string" || !allowedOrigins.has(origin)) {
      throw new HttpError(403, "FORBIDDEN_ORIGIN", "Request origin is not allowed.");
    }
  });
}
