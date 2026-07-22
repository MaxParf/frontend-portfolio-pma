import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { PortfolioDatabase } from "../../db/client.js";
import { HttpError } from "../../middleware/error-handler.js";
import type { AuthService } from "../auth/auth.service.js";
import { AdminProjectRepository } from "./admin-project.repository.js";

export function registerAdminProjectRoutes(app: FastifyInstance, db: PortfolioDatabase, authService: AuthService): void {
  const repository = new AdminProjectRepository(db);

  app.get("/api/v1/admin/projects", async (request) => {
    await authService.authenticate(request);
    const data = await repository.list();
    return { data, meta: { count: data.length } };
  });

  app.get("/api/v1/admin/projects/:slug", async (request) => {
    await authService.authenticate(request);
    const params = z.object({ slug: z.string().min(1) }).parse(request.params);
    const project = await repository.withRelations(params.slug);
    if (!project) {
      throw new HttpError(404, "NOT_FOUND", "Project not found.");
    }
    return { data: project };
  });
}
