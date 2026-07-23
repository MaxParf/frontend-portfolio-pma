import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import test from "node:test";
import sharp from "sharp";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { loadEnv } from "../src/config/env.js";
import { LocalMediaStorage, MediaStorageRegistry, S3MediaStorage, buildMediaStorageKey, createS3Client, type MediaStorageProvider } from "../src/modules/media-storage/media-storage.js";
import { MediaService } from "../src/modules/media/media.service.js";

const baseEnv = {
  HOST: "127.0.0.1",
  PORT: "3001",
  DATABASE_URL: "postgres://portfolio_app:password@127.0.0.1:5432/portfolio_test",
  CORS_ORIGINS: "http://127.0.0.1:8080",
  CMS_ORIGINS: "http://127.0.0.1:5510",
  SESSION_TOKEN_SECRET: "x".repeat(40),
};

test("env selects local outside production and rejects missing production provider", () => {
  assert.equal(loadEnv({ ...baseEnv, NODE_ENV: "test" }).STORAGE_PROVIDER, "local");
  assert.throws(() => loadEnv({ ...baseEnv, NODE_ENV: "production" }), /STORAGE_PROVIDER/);
});

test("env validates S3 requirements without leaking secret values", () => {
  assert.throws(() => loadEnv({ ...baseEnv, NODE_ENV: "production", STORAGE_PROVIDER: "s3", S3_SECRET_ACCESS_KEY: "super-secret-value" }), (error: unknown) => {
    const message = (error as Error).message;
    assert.match(message, /S3_ENDPOINT/);
    assert.doesNotMatch(message, /super-secret-value/);
    return true;
  });
  assert.throws(() => loadEnv({ ...baseEnv, NODE_ENV: "production", STORAGE_PROVIDER: "s3", S3_ENDPOINT: "http://object.example", S3_REGION: "ru-1", S3_BUCKET: "bucket-name", S3_ACCESS_KEY_ID: "access", S3_SECRET_ACCESS_KEY: "secret" }), /S3_ENDPOINT must use HTTPS/);
  assert.throws(() => loadEnv({ ...baseEnv, NODE_ENV: "production", STORAGE_PROVIDER: "s3", S3_ENDPOINT: "https://object.example", S3_REGION: "ru-1", S3_BUCKET: "bad_bucket", S3_ACCESS_KEY_ID: "access", S3_SECRET_ACCESS_KEY: "secret" }), /S3_BUCKET/);
  assert.throws(() => loadEnv({ ...baseEnv, NODE_ENV: "production", STORAGE_PROVIDER: "s3", S3_ENDPOINT: "https://object.example", S3_REGION: "ru-1", S3_BUCKET: "bucket-name", S3_ACCESS_KEY_ID: "access", S3_SECRET_ACCESS_KEY: "secret", S3_SIGNED_URL_TTL_SECONDS: "99999" }), /S3_SIGNED_URL_TTL_SECONDS/);
});

test("S3 client factory creates a Node HTTP handler with bounded timeouts", async () => {
  const client = createS3Client(loadEnv({
    ...baseEnv,
    NODE_ENV: "production",
    STORAGE_PROVIDER: "s3",
    S3_ENDPOINT: "https://object.example",
    S3_REGION: "ru-1",
    S3_BUCKET: "portfolio-media",
    S3_ACCESS_KEY_ID: "test-access-key",
    S3_SECRET_ACCESS_KEY: "test-secret-key",
  }));
  const handler = client.config.requestHandler;
  assert.ok(handler instanceof NodeHttpHandler);
  const options = await Reflect.get(handler, "configProvider");
  assert.equal(options.connectionTimeout, 3_000);
  assert.equal(options.requestTimeout, 7_500);
  client.destroy();
});

test("local provider writes, reads, deletes idempotently, and rejects traversal", async () => {
  const root = await mkdtemp(join(tmpdir(), "portfolio-media-local-"));
  try {
    const storage = new LocalMediaStorage(root);
    const key = `assets/${randomUUID()}/display.webp`;
    await storage.put(key, Buffer.from("image"), { contentType: "image/webp" });
    assert.equal(await storage.exists(key), true);
    const opened = await storage.open(key);
    const chunks: Buffer[] = [];
    for await (const chunk of opened.stream) chunks.push(Buffer.from(chunk));
    assert.equal(Buffer.concat(chunks).toString(), "image");
    await storage.remove(key);
    await storage.remove(key);
    assert.equal(await storage.exists(key), false);
    assert.throws(() => storage.resolveKey("../secret.webp"), /Invalid media storage key/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("S3 provider sends bounded object commands and encodes public URLs", async () => {
  const sent: Array<{ name: string; input: Record<string, unknown> }> = [];
  const client = { send: async (command: { constructor: { name: string }; input: Record<string, unknown> }) => { sent.push({ name: command.constructor.name, input: command.input }); return command.constructor.name === "GetObjectCommand" ? { Body: Readable.from("ok"), ContentType: "image/webp", ETag: "etag" } : { ETag: "etag" }; } };
  const storage = new S3MediaStorage(client as never, { bucket: "portfolio-media", publicBaseUrl: "https://cdn.example.test/media" });
  const key = "portfolio/media/assets/asset-id/display.webp";
  await storage.put(key, Buffer.from("image"), { contentType: "image/webp", checksumSha256: "checksum" });
  await storage.exists(key);
  await storage.open(key);
  await storage.remove(key);
  assert.deepEqual(sent.map((item) => item.name), ["PutObjectCommand", "HeadObjectCommand", "GetObjectCommand", "DeleteObjectCommand"]);
  assert.equal(sent[0]?.input.Bucket, "portfolio-media");
  assert.equal(sent[0]?.input.Key, key);
  assert.equal(sent[0]?.input.ContentDisposition, "inline");
  assert.equal(storage.getObjectPublicUrl(key), "https://cdn.example.test/media/portfolio/media/assets/asset-id/display.webp");
});

test("S3 provider treats missing delete as idempotent and normalizes SDK errors", async () => {
  const missing = new S3MediaStorage({ send: async () => { throw Object.assign(new Error("missing"), { name: "NoSuchKey", $metadata: { httpStatusCode: 404 } }); } } as never, { bucket: "portfolio-media" });
  await assert.doesNotReject(() => missing.remove("portfolio/media/assets/asset-id/display.webp"));

  const failing = new S3MediaStorage({ send: async () => { throw Object.assign(new Error("raw sdk details"), { name: "CredentialsProviderError", $metadata: { httpStatusCode: 403 } }); } } as never, { bucket: "portfolio-media" });
  await assert.rejects(() => failing.put("portfolio/media/assets/asset-id/display.webp", Buffer.from("image")), (error: unknown) => {
    assert.equal((error as { code?: string }).code, "MEDIA_STORAGE_UNAVAILABLE");
    assert.equal((error as Error).message, "S3 media storage operation failed.");
    assert.doesNotMatch((error as Error).message, /raw sdk details/);
    return true;
  });
});

test("upload DB failure cleans up uploaded objects and preserves original failure", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "portfolio-media-service-"));
  const provider = new FakeProvider();
  const storage = new MediaStorageRegistry([provider], provider);
  const pool = {
    query: async () => ({ rows: [{ id: randomUUID() }] }),
    connect: async () => ({
      query: async (sql: string) => {
        if (sql === "begin" || sql === "rollback") return {};
        throw Object.assign(new Error("db insert failed"), { code: "DB_FAILURE" });
      },
      release() {},
    }),
  };
  try {
    const service = new MediaService(pool as never, storage, 8 * 1024 * 1024, tempRoot, "portfolio/media");
    const image = await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } }).png().toBuffer();
    await assert.rejects(() => service.upload("project", { userId: randomUUID(), sessionId: randomUUID(), requestId: randomUUID() }, { filename: "bad/../sample.png", mimetype: "image/png", file: Readable.from(image) }), /db insert failed/);
    assert.equal(provider.putKeys.length, 2);
    assert.deepEqual(provider.removedKeys.sort(), provider.putKeys.sort());
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("storage keys include normalized prefix and do not rely on timestamps", () => {
  const assetId = randomUUID();
  assert.equal(buildMediaStorageKey("/portfolio/media/", assetId, "thumbnail"), `portfolio/media/assets/${assetId}/thumbnail.webp`);
});

class FakeProvider implements MediaStorageProvider {
  readonly name = "s3" as const;
  readonly putKeys: string[] = [];
  readonly removedKeys: string[] = [];
  async put(key: string, input: Readable | Buffer) { this.putKeys.push(key); const body = Buffer.isBuffer(input) ? input : Buffer.alloc(0); return { provider: this.name, key, sizeBytes: body.length }; }
  async remove(key: string) { this.removedKeys.push(key); }
  async exists() { return true; }
  async open() { return { stream: Readable.from("ok") }; }
  getPublicUrl(assetId: string, variant: "display" | "thumbnail") { return `/api/v1/media/${assetId}/${variant}`; }
}
