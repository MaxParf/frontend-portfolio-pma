import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import sharp from "sharp";
import type { FastifyBaseLogger } from "fastify";
import type pg from "pg";
import type { MediaStorageRegistry, MediaVariant } from "../media-storage/media-storage.js";
import { buildMediaStorageKey } from "../media-storage/media-storage.js";
import type { MediaOrientation } from "./media-orientation.js";

const accepted = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]);
const signatures: Record<string, number[]> = {
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  "image/webp": [0x52, 0x49, 0x46, 0x46],
};

export class MediaValidationError extends Error { code = "MEDIA_VALIDATION_ERROR"; }
export class MediaOrientationMismatchError extends Error {
  code = "MEDIA_ORIENTATION_MISMATCH";
  constructor(readonly details: { selectedOrientation: MediaOrientation; detectedWidth: number; detectedHeight: number; confirmationRequired: true }) { super("Image dimensions do not match the selected orientation."); }
}
export type Actor = { userId: string; sessionId: string; requestId: string };

export class MediaService {
  constructor(
    private readonly pool: pg.Pool,
    private readonly storage: MediaStorageRegistry,
    private readonly maxBytes: number,
    private readonly processingTmpDir: string,
    private readonly keyPrefix: string | undefined,
    private readonly logger?: FastifyBaseLogger,
  ) {}

  async upload(projectSlug: string, actor: Actor, file: { filename: string; mimetype: string; file: NodeJS.ReadableStream }, orientation: MediaOrientation = "horizontal", confirmOrientationMismatch = false): Promise<object> {
    if (!accepted.has(file.mimetype)) throw new MediaValidationError("Only JPEG, PNG, and WebP images are allowed.");
    const project = (await this.pool.query<{ id: string }>("select id from projects where slug=$1", [projectSlug])).rows[0];
    if (!project) throw Object.assign(new Error("Project not found."), { code: "PROJECT_NOT_FOUND" });
    const assetId = randomUUID();
    const tmpPath = resolve(this.processingTmpDir, `${assetId}.upload`);
    const uploadedKeys: string[] = [];

    try {
      await mkdir(dirname(tmpPath), { recursive: true });
      await pipeline(file.file as never, await import("node:fs").then(({ createWriteStream }) => createWriteStream(tmpPath, { flags: "wx" })));
      const uploadedStat = await stat(tmpPath);
      if (uploadedStat.size > this.maxBytes) throw new MediaValidationError("Image exceeds the 8 MB limit.");
      if (!(await BunlessMagic.inspect(tmpPath, file.mimetype))) throw new MediaValidationError("Image content does not match its declared type.");

      const metadata = await sharp(tmpPath, { limitInputPixels: 40_000_000, failOn: "error" }).metadata();
      if (!metadata.width || !metadata.height || metadata.width > 8000 || metadata.height > 8000 || metadata.width * metadata.height > 40_000_000) throw new MediaValidationError("Image dimensions exceed allowed limits.");
      const digest = await BunlessMagic.sha256(tmpPath);
      const displayKey = buildMediaStorageKey(this.keyPrefix, assetId, "display");
      const thumbnailKey = buildMediaStorageKey(this.keyPrefix, assetId, "thumbnail");
      const display = await sharp(tmpPath, { limitInputPixels: 40_000_000, failOn: "error" }).rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
      const thumbnail = await sharp(tmpPath, { limitInputPixels: 40_000_000, failOn: "error" }).rotate().resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true }).webp({ quality: 76 }).toBuffer({ resolveWithObject: true });
      const mismatch = (orientation === "vertical" && display.info.width >= display.info.height) || (orientation === "horizontal" && display.info.height > display.info.width);
      if (mismatch && !confirmOrientationMismatch) throw new MediaOrientationMismatchError({ selectedOrientation: orientation, detectedWidth: display.info.width, detectedHeight: display.info.height, confirmationRequired: true });

      await this.putStoredObject(displayKey, display.data, { contentType: "image/webp", checksumSha256: sha256Base64(display.data) });
      uploadedKeys.push(displayKey);
      await this.putStoredObject(thumbnailKey, thumbnail.data, { contentType: "image/webp", checksumSha256: sha256Base64(thumbnail.data) });
      uploadedKeys.push(thumbnailKey);

      const safeFilename = `${basename(file.filename || "image").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "image"}.${accepted.get(file.mimetype)}`;
      const client = await this.pool.connect();
      try {
        await client.query("begin");
        await client.query(`insert into media_assets (id,external_key,path,role,sort_order,source_type,storage_driver,storage_key,original_filename,safe_filename,mime_type,extension,size_bytes,width,height,sha256,status,created_by,created_at,updated_at) values ($1,$2,null,'gallery',0,'managed',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'temporary',$13,now(),now())`, [assetId, `managed:${assetId}`, this.storage.writeProvider.name, displayKey, file.filename || "image", safeFilename, file.mimetype, accepted.get(file.mimetype), uploadedStat.size, display.info.width, display.info.height, digest, actor.userId]);
        for (const [variant, key, data] of [["display", displayKey, display], ["thumbnail", thumbnailKey, thumbnail]] as const) await client.query("insert into media_asset_variants (id,media_asset_id,variant,storage_key,mime_type,width,height,size_bytes,created_at) values ($1,$2,$3,$4,'image/webp',$5,$6,$7,now())", [randomUUID(), assetId, variant, key, data.info.width, data.info.height, data.data.length]);
        await audit(client, actor, "media_upload_succeeded", project.id, "success", { assetId }, { sizeBytes: uploadedStat.size, mimeType: file.mimetype, storageProvider: this.storage.writeProvider.name });
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        await this.cleanupUploadedObjects(uploadedKeys, error);
        uploadedKeys.length = 0;
        throw error;
      } finally {
        client.release();
      }
      return { assetId, sourceType: "managed", role: "gallery", orientation, previewUrl: this.storage.writeProvider.getPublicUrl(assetId, "display"), thumbnailUrl: this.storage.writeProvider.getPublicUrl(assetId, "thumbnail"), width: display.info.width, height: display.info.height };
    } catch (error) {
      await this.cleanupUploadedObjects(uploadedKeys, error);
      throw error;
    } finally {
      await rm(tmpPath, { force: true });
    }
  }

  async open(assetId: string, variant: MediaVariant, authenticated: boolean) {
    const result = await this.pool.query<{ status: string; storage_driver: string | null; storage_key: string; mime_type: string; sha256: string }>("select a.status,a.storage_driver,v.storage_key,v.mime_type,a.sha256 from media_assets a join media_asset_variants v on v.media_asset_id=a.id and v.variant=$2 where a.id=$1 and a.source_type='managed' and a.deleted_at is null", [assetId, variant]);
    const row = result.rows[0]; if (!row || (row.status !== "active" && !authenticated)) return null;
    const provider = this.storage.providerFor(row.storage_driver);
    if (!(await provider.exists(row.storage_key))) return null;
    const opened = await provider.open(row.storage_key);
    return { stream: opened.stream, mimeType: row.mime_type, etag: row.sha256 };
  }

  private async putStoredObject(key: string, data: Buffer, options: { contentType: string; checksumSha256: string }) {
    const started = Date.now();
    try {
      const result = await this.storage.writeProvider.put(key, data, options);
      this.logger?.info({ provider: result.provider, operation: "put", result: "success", durationMs: Date.now() - started, keyPrefix: key.split("/").slice(0, -1).join("/") }, "Media storage operation completed");
      return result;
    } catch (error) {
      this.logger?.error({ provider: this.storage.writeProvider.name, operation: "put", result: "failure", durationMs: Date.now() - started, keyPrefix: key.split("/").slice(0, -1).join("/"), errorClass: (error as { code?: string; name?: string }).code ?? (error as { name?: string }).name }, "Media storage operation failed");
      throw error;
    }
  }

  private async cleanupUploadedObjects(keys: string[], originalError: unknown): Promise<void> {
    for (const key of keys) {
      try {
        await this.storage.writeProvider.remove(key);
        this.logger?.warn({ provider: this.storage.writeProvider.name, operation: "cleanup_delete", result: "success", keyPrefix: key.split("/").slice(0, -1).join("/") }, "Cleaned up uploaded media object after failed workflow");
      } catch (cleanupError) {
        this.logger?.error({ provider: this.storage.writeProvider.name, operation: "cleanup_delete", result: "failure", keyPrefix: key.split("/").slice(0, -1).join("/"), errorClass: (cleanupError as { code?: string; name?: string }).code ?? (cleanupError as { name?: string }).name, originalErrorClass: (originalError as { code?: string; name?: string }).code ?? (originalError as { name?: string }).name }, "Failed to clean up uploaded media object after failed workflow");
      }
    }
  }
}

function sha256Base64(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("base64");
}

const BunlessMagic = {
  async inspect(path: string, mime: string) { const { open } = await import("node:fs/promises"); const handle = await open(path, "r"); try { const buffer = Buffer.alloc(12); await handle.read(buffer, 0, 12, 0); const signature = signatures[mime]; return Boolean(signature && signature.every((value, index) => buffer[index] === value) && (mime !== "image/webp" || buffer.subarray(8, 12).toString() === "WEBP")); } finally { await handle.close(); } },
  async sha256(path: string) { const hash = createHash("sha256"); for await (const chunk of createReadStream(path)) hash.update(chunk); return hash.digest("hex"); },
};

async function audit(client: pg.PoolClient, actor: Actor, event: string, entityId: string, status: string, summary: object, metadata: object) { await client.query("insert into audit_events (id,actor_id,session_id,request_id,event_type,entity_id,status,summary,metadata,created_at) values ($1,$2,$3,$4,$5::audit_event_type,$6,$7::audit_event_status,$8,$9,now())", [randomUUID(), actor.userId, actor.sessionId, actor.requestId, event, entityId, status, summary, metadata]); }
