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

  app.post("/api/v1/admin/projects", async (request, reply) => {
    const context = await authService.authenticate(request);
    const editor = await drafts.create({ userId: context.user.id, sessionId: context.sessionId, requestId: request.id });
    if (!editor) throw new HttpError(500, "PROJECT_CREATE_FAILED", "Project could not be created.");
    return reply.code(201).send({ data: editor });
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

  app.get("/api/v1/admin/projects/:slug/published", async (request) => {
    await authService.authenticate(request);
    const { slug } = z.object({ slug: z.string().min(1) }).parse(request.params);
    try {
      const published = await drafts.published(slug);
      if (!published) throw new HttpError(404, "PROJECT_NOT_FOUND", "Project not found.");
      return { data: published };
    } catch (error) { throw draftError(error); }
  });

  app.post("/api/v1/admin/projects/:slug/draft/from-published", async (request) => {
    const context = await authService.authenticate(request);
    const { slug } = z.object({ slug: z.string().min(1) }).parse(request.params);
    try {
      const editor = await drafts.createDraftFromPublished(slug, { userId: context.user.id, sessionId: context.sessionId, requestId: request.id });
      if (!editor) throw new HttpError(404, "PROJECT_NOT_FOUND", "Project not found.");
      return { data: editor };
    } catch (error) { throw draftError(error); }
  });

  app.put("/api/v1/admin/projects/:slug/draft", async (request) => {
    const context = await authService.authenticate(request);
    const { slug } = z.object({ slug: z.string().min(1) }).parse(request.params);
    const body = saveDraftSchema.parse(request.body);
    try {
      return { data: await drafts.save(slug, body, { userId: context.user.id, sessionId: context.sessionId, requestId: request.id }) };
    } catch (error) { throw draftError(error); }
  });

  app.delete("/api/v1/admin/projects/:slug/draft", async (request, reply) => {
    const context = await authService.authenticate(request);
    const { slug } = z.object({ slug: z.string().min(1) }).parse(request.params);
    const { expectedDraftRevisionId } = z.object({ expectedDraftRevisionId: z.string().uuid() }).parse(request.body);
    try {
      await drafts.deleteDraft(slug, expectedDraftRevisionId, { userId: context.user.id, sessionId: context.sessionId, requestId: request.id });
      return reply.code(204).send();
    } catch (error) { throw draftError(error); }
  });

  app.delete("/api/v1/admin/projects/:slug", async (request, reply) => {
    await authService.authenticate(request);
    const { slug } = z.object({ slug: z.string().min(1) }).parse(request.params);
    try {
      await drafts.deleteUnpublishedProject(slug);
      return reply.code(204).send();
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
  if (code === "PUBLISHED_REVISION_NOT_FOUND") return new HttpError(409, code, "Project has no published revision.");
  if (code === "PUBLISHED_SOURCE_REQUIRED") return new HttpError(409, code, "A published source revision is required to create a draft.");
  if (code === "LAST_DRAFT_DELETE_FORBIDDEN") return new HttpError(409, code, "The last draft of an unpublished project cannot be deleted.");
  if (code === "PUBLISHED_PROJECT_DELETE_FORBIDDEN") return new HttpError(409, code, "A published project cannot be deleted.");
  if (code === "DRAFT_CONFLICT" || code === "PUBLISH_CONFLICT") return new HttpError(409, code, "The project draft was changed in another session.");
  if (code === "ORIENTATION_UNRESOLVED" || code === "GALLERY_KIND_UNRESOLVED") return new HttpError(409, code, value.message ?? "Project media metadata is unresolved.");
  if (code === "VALIDATION_ERROR") return new HttpError(400, code, value.message ?? "Invalid project draft.");
  if (/^(Missing|Invalid|Duplicate) /.test(value.message ?? "")) return new HttpError(400, "PUBLISH_VALIDATION_FAILED", value.message ?? "Invalid project draft.");
  throw error;
}
