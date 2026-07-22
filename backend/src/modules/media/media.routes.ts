import multipart from "@fastify/multipart";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type pg from "pg";
import type { AppEnv } from "../../config/env.js";
import { HttpError } from "../../middleware/error-handler.js";
import type { AuthService } from "../auth/auth.service.js";
import { LocalMediaStorage } from "../media-storage/media-storage.js";
import { MediaService, MediaValidationError } from "./media.service.js";

export function registerMediaRoutes(app: FastifyInstance, pool: pg.Pool, env: AppEnv, auth: AuthService): void {
  const storage = new LocalMediaStorage(env.MEDIA_STORAGE_ROOT);
  const service = new MediaService(pool, storage, env.MEDIA_MAX_FILE_BYTES);
  app.register(multipart, { limits: { files: env.MEDIA_MAX_FILES_PER_REQUEST, fileSize: env.MEDIA_MAX_FILE_BYTES }, throwFileSizeLimit: true });

  app.post("/api/v1/admin/projects/:slug/media", async (request) => {
    const context = await auth.authenticate(request);
    const { slug } = z.object({ slug: z.string().min(1).max(120) }).parse(request.params);
    try {
      const file = await request.file();
      if (!file) throw new HttpError(400, "MEDIA_VALIDATION_ERROR", "A single image file is required.");
      return { data: await service.upload(slug, { userId: context.user.id, sessionId: context.sessionId, requestId: request.id }, file) };
    } catch (error) { throw mediaError(error); }
  });

  app.get("/api/v1/media/:assetId/:variant", async (request, reply) => {
    const { assetId, variant } = z.object({ assetId: z.string().uuid(), variant: z.enum(["display", "thumbnail"]) }).parse(request.params);
    let authenticated = false;
    try { await auth.authenticate(request); authenticated = true; } catch { authenticated = false; }
    const file = await service.open(assetId, variant, authenticated);
    if (!file) throw new HttpError(404, "MEDIA_NOT_FOUND", "Media asset not found.");
    reply.header("content-type", file.mimeType).header("cache-control", authenticated ? "private, max-age=300" : "public, max-age=86400, immutable").header("etag", `\"${file.etag}-${variant}\"`);
    return reply.send(file.stream);
  });
}

function mediaError(error: unknown): HttpError | unknown {
  if (error instanceof MediaValidationError) return new HttpError(error.message.startsWith("Only ") ? 415 : 400, error.code, error.message);
  const code = (error as { code?: string }).code;
  if (code === "PROJECT_NOT_FOUND") return new HttpError(404, code, "Project not found.");
  if (code === "FST_REQ_FILE_TOO_LARGE") return new HttpError(413, "MEDIA_TOO_LARGE", "Image exceeds the 8 MB limit.");
  return error;
}
