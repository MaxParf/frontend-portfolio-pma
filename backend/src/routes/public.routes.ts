import type { FastifyInstance } from "fastify";
import type { PortfolioDatabase } from "../db/client.js";
import { registerProjectRoutes } from "../modules/projects/project.routes.js";

export function registerPublicRoutes(app: FastifyInstance, db: PortfolioDatabase): void {
  registerProjectRoutes(app, db);
}
