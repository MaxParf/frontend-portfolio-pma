import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { checkDatabase } from "../db/client.js";

export function registerHealthRoutes(app: FastifyInstance, pool: pg.Pool): void {
  app.get("/health", async () => {
    await checkDatabase(pool);
    return {
      status: "ok",
      service: "maxpar-portfolio-api",
    };
  });
}
