import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { PortfolioDatabase } from "../../db/client.js";
import type pg from "pg";
import { HttpError } from "../../middleware/error-handler.js";
import type { AuthService } from "../auth/auth.service.js";
import { AdminProjectRepository } from "./admin-project.repository.js";
import { ProjectDraftRepository } from "./project-draft.repository.js";
import { publishSchema, saveDraftSchema } from "./project-draft.schemas.js";

export function registerAdminProjectRoutes(app: FastifyInstance, db: PortfolioDatabase, pool: pg.Pool, authService: AuthService): void {
  const repository = new AdminProjectRepository(db);
  const drafts = new ProjectDraftRepository(pool);

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

  app.get("/api/v1/admin/projects/:slug/editor", async (request) => {
    await authService.authenticate(request);
    const { slug } = z.object({ slug: z.string().min(1) }).parse(request.params);
    const editor = await drafts.editor(slug);
    if (!editor) throw new HttpError(404, "PROJECT_NOT_FOUND", "Project not found.");
    return { data: editor };
  });

  app.put("/api/v1/admin/projects/:slug/draft", async (request) => {
    const context = await authService.authenticate(request);
    const { slug } = z.object({ slug: z.string().min(1) }).parse(request.params);
    const body = saveDraftSchema.parse(request.body);
    try {
      return { data: await drafts.save(slug, body, { userId: context.user.id, sessionId: context.sessionId, requestId: request.id }) };
    } catch (error) { throw draftError(error); }
  });

  app.post("/api/v1/admin/projects/:slug/publish", async (request) => {
    const context = await authService.authenticate(request);
    const { slug } = z.object({ slug: z.string().min(1) }).parse(request.params);
    const body = publishSchema.parse(request.body);
    try { return { data: await drafts.publish(slug, body.expectedDraftRevisionId, { userId: context.user.id, sessionId: context.sessionId, requestId: request.id }) }; }
    catch (error) { throw draftError(error); }
  });

  app.get("/api/v1/admin/projects/:slug/revisions", async (request) => {
    await authService.authenticate(request);
    const { slug } = z.object({ slug: z.string().min(1) }).parse(request.params);
    return { data: await drafts.revisions(slug) };
  });

  app.get("/api/v1/admin/audit-events", async (request) => {
    await authService.authenticate(request);
    const { slug } = z.object({ slug: z.string().min(1) }).parse(request.query);
    return { data: await drafts.auditEvents(slug) };
  });
}

function draftError(error: unknown): HttpError {
  const value = error as { code?: string; message?: string };
  const code = value.code;
  if (code === "PROJECT_NOT_FOUND") return new HttpError(404, code, "Project not found.");
  if (code === "DRAFT_NOT_FOUND") return new HttpError(409, code, "Project draft not found.");
  if (code === "DRAFT_CONFLICT" || code === "PUBLISH_CONFLICT") return new HttpError(409, code, "The project draft was changed in another session.");
  if (code === "ORIENTATION_UNRESOLVED") return new HttpError(409, code, value.message ?? "Project media orientation is unresolved.");
  if (code === "VALIDATION_ERROR") return new HttpError(400, code, value.message ?? "Invalid project draft.");
  if (value.message?.startsWith("Missing")) return new HttpError(400, "PUBLISH_VALIDATION_FAILED", value.message);
  throw error;
}
