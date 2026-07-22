import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { basename } from "node:path";
import { Readable } from "node:stream";
import sharp from "sharp";
import type pg from "pg";
import type { MediaStorage } from "../media-storage/media-storage.js";

const accepted = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]);
const signatures: Record<string, number[]> = {
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  "image/webp": [0x52, 0x49, 0x46, 0x46],
};

export class MediaValidationError extends Error { code = "MEDIA_VALIDATION_ERROR"; }
export type Actor = { userId: string; sessionId: string; requestId: string };

export class MediaService {
  constructor(private readonly pool: pg.Pool, private readonly storage: MediaStorage, private readonly maxBytes: number) {}

  async upload(projectSlug: string, actor: Actor, file: { filename: string; mimetype: string; file: NodeJS.ReadableStream }): Promise<object> {
    if (!accepted.has(file.mimetype)) throw new MediaValidationError("Only JPEG, PNG, and WebP images are allowed.");
    const project = (await this.pool.query<{ id: string }>("select id from projects where slug=$1", [projectSlug])).rows[0];
    if (!project) throw Object.assign(new Error("Project not found."), { code: "PROJECT_NOT_FOUND" });
    const assetId = randomUUID(); const temporaryKey = `tmp/${assetId}.tmp`;
    try {
      const stored = await this.storage.put(temporaryKey, file.file as never);
      if (stored.sizeBytes > this.maxBytes) throw new MediaValidationError("Image exceeds the 8 MB limit.");
      const sourcePath = this.storage.resolveTemporary(temporaryKey);
      const first = await BunlessMagic.inspect(sourcePath, file.mimetype);
      if (!first) throw new MediaValidationError("Image content does not match its declared type.");
      const metadata = await sharp(sourcePath, { limitInputPixels: 40_000_000, failOn: "error" }).metadata();
      if (!metadata.width || !metadata.height || metadata.width > 8000 || metadata.height > 8000 || metadata.width * metadata.height > 40_000_000) throw new MediaValidationError("Image dimensions exceed allowed limits.");
      const digest = await BunlessMagic.sha256(sourcePath);
      const displayKey = `assets/${assetId}/display.webp`; const thumbnailKey = `assets/${assetId}/thumbnail.webp`;
      const display = await sharp(sourcePath, { limitInputPixels: 40_000_000, failOn: "error" }).rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
      const thumbnail = await sharp(sourcePath, { limitInputPixels: 40_000_000, failOn: "error" }).rotate().resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true }).webp({ quality: 76 }).toBuffer({ resolveWithObject: true });
      await this.storage.put(displayKey, bufferStream(display.data)); await this.storage.put(thumbnailKey, bufferStream(thumbnail.data));
      const safeFilename = `${basename(file.filename || "image").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "image"}.${accepted.get(file.mimetype)}`;
      const client = await this.pool.connect();
      try { await client.query("begin");
        await client.query(`insert into media_assets (id,external_key,path,role,sort_order,source_type,storage_driver,storage_key,original_filename,safe_filename,mime_type,extension,size_bytes,width,height,sha256,status,created_by,created_at,updated_at) values ($1,$2,null,'gallery',0,'managed','local',$3,$4,$5,$6,$7,$8,$9,$10,$11,'temporary',$12,now(),now())`, [assetId, `managed:${assetId}`, displayKey, file.filename || "image", safeFilename, file.mimetype, accepted.get(file.mimetype), stored.sizeBytes, display.info.width, display.info.height, digest, actor.userId]);
        for (const [variant, key, data] of [["display", displayKey, display], ["thumbnail", thumbnailKey, thumbnail]] as const) await client.query("insert into media_asset_variants (id,media_asset_id,variant,storage_key,mime_type,width,height,size_bytes,created_at) values ($1,$2,$3,$4,'image/webp',$5,$6,$7,now())", [randomUUID(), assetId, variant, key, data.info.width, data.info.height, data.data.length]);
        await audit(client, actor, "media_upload_succeeded", project.id, "success", { assetId }, { sizeBytes: stored.sizeBytes, mimeType: file.mimetype }); await client.query("commit");
      } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
      return { assetId, sourceType: "managed", role: "gallery", previewUrl: this.storage.getPublicUrl(assetId, "display"), thumbnailUrl: this.storage.getPublicUrl(assetId, "thumbnail"), width: display.info.width, height: display.info.height };
    } catch (error) { await this.storage.remove(temporaryKey); await this.storage.remove(`assets/${assetId}/display.webp`); await this.storage.remove(`assets/${assetId}/thumbnail.webp`); throw error; }
    finally { await this.storage.remove(temporaryKey); }
  }

  async open(assetId: string, variant: "display" | "thumbnail", authenticated: boolean) {
    const result = await this.pool.query<{ status: string; storage_key: string; mime_type: string; sha256: string }>("select a.status,v.storage_key,v.mime_type,a.sha256 from media_assets a join media_asset_variants v on v.media_asset_id=a.id and v.variant=$2 where a.id=$1 and a.source_type='managed' and a.deleted_at is null", [assetId, variant]);
    const row = result.rows[0]; if (!row || (row.status !== "active" && !authenticated)) return null;
    if (!(await this.storage.exists(row.storage_key))) return null;
    return { stream: this.storage.open(row.storage_key), mimeType: row.mime_type, etag: row.sha256 };
  }
}

function bufferStream(buffer: Buffer): Readable { return Readable.from(buffer); }

const BunlessMagic = {
  async inspect(path: string, mime: string) { const { open } = await import("node:fs/promises"); const handle = await open(path, "r"); try { const buffer = Buffer.alloc(12); await handle.read(buffer, 0, 12, 0); const signature = signatures[mime]; return Boolean(signature && signature.every((value, index) => buffer[index] === value) && (mime !== "image/webp" || buffer.subarray(8, 12).toString() === "WEBP")); } finally { await handle.close(); } },
  async sha256(path: string) { const hash = createHash("sha256"); for await (const chunk of createReadStream(path)) hash.update(chunk); return hash.digest("hex"); },
};

async function audit(client: pg.PoolClient, actor: Actor, event: string, entityId: string, status: string, summary: object, metadata: object) { await client.query("insert into audit_events (id,actor_id,session_id,request_id,event_type,entity_id,status,summary,metadata,created_at) values ($1,$2,$3,$4,$5::audit_event_type,$6,$7::audit_event_status,$8,$9,now())", [randomUUID(), actor.userId, actor.sessionId, actor.requestId, event, entityId, status, summary, metadata]); }
