import { createReadStream } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";

export interface MediaStorage {
  put(key: string, input: Readable): Promise<{ sizeBytes: number }>;
  remove(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  open(key: string): Readable;
  getPublicUrl(assetId: string, variant: "display" | "thumbnail"): string;
  resolveTemporary(key: string): string;
}

export class LocalMediaStorage implements MediaStorage {
  private readonly root: string;

  constructor(root: string) { this.root = resolve(root); }

  async put(key: string, input: Readable): Promise<{ sizeBytes: number }> {
    const target = this.resolveKey(key);
    await mkdir(dirname(target), { recursive: true });
    await pipeline(input, await import("node:fs").then(({ createWriteStream }) => createWriteStream(target, { flags: "wx" })));
    return { sizeBytes: (await stat(target)).size };
  }

  async remove(key: string): Promise<void> { await rm(this.resolveKey(key), { force: true }); }
  async exists(key: string): Promise<boolean> { try { await stat(this.resolveKey(key)); return true; } catch { return false; } }
  open(key: string): Readable { return createReadStream(this.resolveKey(key)); }
  getPublicUrl(assetId: string, variant: "display" | "thumbnail"): string { return `/api/v1/media/${assetId}/${variant}`; }
  resolveTemporary(key: string): string { return this.resolveKey(key); }
  private resolveKey(key: string): string {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9/_-]*\.(?:tmp|webp)$/.test(key)) throw new Error("Invalid media storage key.");
    const target = resolve(this.root, key);
    if (!target.startsWith(`${this.root}/`)) throw new Error("Invalid media storage key.");
    return target;
  }
}
