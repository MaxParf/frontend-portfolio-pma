import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { loadEnv } from "../src/config/env.js";
import { createMediaStorageRegistry } from "../src/modules/media-storage/media-storage.js";

const env = loadEnv();
if (env.STORAGE_PROVIDER !== "s3") throw new Error("verify-s3-storage requires STORAGE_PROVIDER=s3.");

const storage = createMediaStorageRegistry(env).writeProvider;
const key = `${env.S3_KEY_PREFIX.replace(/^\/+|\/+$/g, "")}/probes/${randomUUID()}.webp`;
const probeBody = Buffer.from("RIFF\u001a\u0000\u0000\u0000WEBPVP8 \u000e\u0000\u0000\u0000", "binary");

try {
  await storage.put(key, Readable.from(probeBody), { contentType: "image/webp" });
  const exists = await storage.exists(key);
  if (!exists) throw new Error("S3 probe object was not visible after upload.");
  await storage.remove(key);
  console.info({ event: "s3_storage_probe_complete", result: "success", keyPrefix: `${env.S3_KEY_PREFIX}/probes` });
} catch (error) {
  try {
    await storage.remove(key);
  } catch {
    console.error({ event: "s3_storage_probe_cleanup_failed", keyPrefix: `${env.S3_KEY_PREFIX}/probes` });
  }
  console.error({ event: "s3_storage_probe_complete", result: "failure", errorClass: (error as { code?: string; name?: string }).code ?? (error as { name?: string }).name });
  process.exitCode = 1;
}
