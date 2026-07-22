import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ProjectRepository } from "./project.repository.js";
import { ProjectService } from "./project.service.js";
import type { PortfolioDatabase } from "../../db/client.js";

const localeQuerySchema = z.object({
  locale: z.string().optional(),
});

export function registerProjectRoutes(app: FastifyInstance, db: PortfolioDatabase): void {
  const service = new ProjectService(new ProjectRepository(db));

  app.get("/api/v1/projects", async (request) => {
    const query = localeQuerySchema.parse(request.query);
    return service.list(query.locale);
  });

  app.get("/api/v1/projects/:slug", async (request) => {
    const params = z.object({ slug: z.string().min(1) }).parse(request.params);
    const query = localeQuerySchema.parse(request.query);
    return service.getBySlug(params.slug, query.locale);
  });
}
