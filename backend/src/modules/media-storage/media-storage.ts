import { createReadStream } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, NoSuchKey, PutObjectCommand, S3Client, type S3ClientConfig } from "@aws-sdk/client-s3";
import type { AppEnv } from "../../config/env.js";

export type StorageProviderName = "local" | "s3";
export type MediaVariant = "display" | "thumbnail";
export type StoredMediaObject = {
  provider: StorageProviderName;
  key: string;
  sizeBytes: number;
  contentType?: string;
  etag?: string;
};

export interface MediaStorageProvider {
  readonly name: StorageProviderName;
  put(key: string, input: Readable | Buffer, options?: { contentType?: string; checksumSha256?: string }): Promise<StoredMediaObject>;
  remove(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  open(key: string): Promise<{ stream: Readable; contentType?: string; etag?: string }>;
  getPublicUrl(assetId: string, variant: MediaVariant): string;
}

export class MediaStorageRegistry {
  private readonly providers: Map<StorageProviderName, MediaStorageProvider>;

  constructor(providers: MediaStorageProvider[], public readonly writeProvider: MediaStorageProvider) {
    this.providers = new Map(providers.map((provider) => [provider.name, provider]));
  }

  providerFor(name: string | null | undefined): MediaStorageProvider {
    const provider = this.providers.get(name as StorageProviderName);
    if (!provider) throw Object.assign(new Error("Unsupported media storage provider."), { code: "MEDIA_STORAGE_UNAVAILABLE" });
    return provider;
  }
}

export class LocalMediaStorage implements MediaStorageProvider {
  readonly name = "local" as const;
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  async put(key: string, input: Readable | Buffer, options?: { contentType?: string }): Promise<StoredMediaObject> {
    const target = this.resolveKey(key);
    await mkdir(dirname(target), { recursive: true });
    const source = Buffer.isBuffer(input) ? Readable.from(input) : input;
    await pipeline(source, await import("node:fs").then(({ createWriteStream }) => createWriteStream(target, { flags: "wx" })));
    return { provider: this.name, key, sizeBytes: (await stat(target)).size, contentType: options?.contentType };
  }

  async remove(key: string): Promise<void> {
    await rm(this.resolveKey(key), { force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(this.resolveKey(key));
      return true;
    } catch {
      return false;
    }
  }

  async open(key: string): Promise<{ stream: Readable }> {
    return { stream: createReadStream(this.resolveKey(key)) };
  }

  getPublicUrl(assetId: string, variant: MediaVariant): string {
    return `/api/v1/media/${assetId}/${variant}`;
  }

  resolveKey(key: string): string {
    assertSafeStorageKey(key);
    const target = resolve(this.root, key);
    if (!target.startsWith(`${this.root}/`)) throw new Error("Invalid media storage key.");
    return target;
  }
}

export class S3MediaStorage implements MediaStorageProvider {
  readonly name = "s3" as const;

  constructor(
    private readonly client: Pick<S3Client, "send">,
    private readonly config: { bucket: string; publicBaseUrl?: string },
  ) {}

  async put(key: string, input: Readable | Buffer, options?: { contentType?: string; checksumSha256?: string }): Promise<StoredMediaObject> {
    assertSafeStorageKey(key);
    const body = Buffer.isBuffer(input) ? input : await streamToBuffer(input);
    try {
      const result = await this.client.send(new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: body,
        ContentType: options?.contentType,
        ChecksumSHA256: options?.checksumSha256,
        ContentDisposition: "inline",
      }));
      return { provider: this.name, key, sizeBytes: body.length, contentType: options?.contentType, etag: result.ETag };
    } catch (error) {
      throw normalizeS3Error(error);
    }
  }

  async remove(key: string): Promise<void> {
    assertSafeStorageKey(key);
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }));
    } catch (error) {
      if (error instanceof NoSuchKey || (error as { name?: string }).name === "NoSuchKey" || (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return;
      throw normalizeS3Error(error);
    }
  }

  async exists(key: string): Promise<boolean> {
    assertSafeStorageKey(key);
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.config.bucket, Key: key }));
      return true;
    } catch (error) {
      if ((error as { name?: string }).name === "NotFound" || (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return false;
      throw normalizeS3Error(error);
    }
  }

  async open(key: string): Promise<{ stream: Readable; contentType?: string; etag?: string }> {
    assertSafeStorageKey(key);
    try {
      const result = await this.client.send(new GetObjectCommand({ Bucket: this.config.bucket, Key: key }));
      if (!result.Body || typeof (result.Body as Readable).pipe !== "function") throw new Error("S3 object body is not readable.");
      return { stream: result.Body as Readable, contentType: result.ContentType, etag: result.ETag };
    } catch (error) {
      throw normalizeS3Error(error);
    }
  }

  getPublicUrl(assetId: string, variant: MediaVariant): string {
    return `/api/v1/media/${assetId}/${variant}`;
  }

  getObjectPublicUrl(key: string): string {
    if (!this.config.publicBaseUrl) throw new Error("S3 public base URL is not configured.");
    assertSafeStorageKey(key);
    return `${this.config.publicBaseUrl.replace(/\/+$/, "")}/${key.split("/").map(encodeURIComponent).join("/")}`;
  }
}

export function createMediaStorageRegistry(env: AppEnv): MediaStorageRegistry {
  const local = new LocalMediaStorage(env.MEDIA_STORAGE_ROOT);
  if (env.STORAGE_PROVIDER === "local") return new MediaStorageRegistry([local], local);
  if (env.STORAGE_PROVIDER === "s3") {
    const s3 = new S3MediaStorage(createS3Client(env), { bucket: env.S3_BUCKET!, publicBaseUrl: env.S3_PUBLIC_BASE_URL });
    return new MediaStorageRegistry([local, s3], s3);
  }
  throw Object.assign(new Error("Unsupported media storage provider."), { code: "MEDIA_STORAGE_UNAVAILABLE" });
}

function createS3Client(env: AppEnv): S3Client {
  const requestHandler = { requestTimeout: 7_500, connectionTimeout: 3_000 } as S3ClientConfig["requestHandler"];
  return new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID!, secretAccessKey: env.S3_SECRET_ACCESS_KEY! },
    maxAttempts: 2,
    requestHandler,
  });
}

export function buildMediaStorageKey(prefix: string | undefined, assetId: string, variant: MediaVariant): string {
  const normalizedPrefix = normalizeKeyPrefix(prefix);
  return `${normalizedPrefix ? `${normalizedPrefix}/` : ""}assets/${assetId}/${variant}.webp`;
}

export function normalizeKeyPrefix(prefix: string | undefined): string {
  return (prefix ?? "").trim().replace(/^\/+|\/+$/g, "");
}

export function assertSafeStorageKey(key: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9/_-]*\.(?:webp)$/.test(key) || key.includes("..") || key.includes("//")) {
    throw new Error("Invalid media storage key.");
  }
}

async function streamToBuffer(input: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of input) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function normalizeS3Error(error: unknown): Error {
  const normalized = new Error("S3 media storage operation failed.");
  (normalized as { code?: string; cause?: unknown }).code = "MEDIA_STORAGE_UNAVAILABLE";
  (normalized as { cause?: unknown }).cause = { name: (error as { name?: string }).name, statusCode: (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode };
  return normalized;
}
