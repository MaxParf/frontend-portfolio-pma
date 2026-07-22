import { loadEnv } from "../src/config/env.js";
import { createPool } from "../src/db/client.js";
import { LocalMediaStorage } from "../src/modules/media-storage/media-storage.js";

const execute = process.argv.includes("--execute");
const env = loadEnv(); const pool = createPool(env.DATABASE_URL); const storage = new LocalMediaStorage(env.MEDIA_STORAGE_ROOT);
try {
  const result = await pool.query<{ id: string; storage_key: string }>(`select id,storage_key from media_assets where source_type='managed' and status in ('temporary','draft') and created_at < now() - interval '24 hours' and not exists (select 1 from project_revisions where content::text like '%' || media_assets.id::text || '%')`);
  for (const asset of result.rows) {
    if (execute) { await storage.remove(asset.storage_key); await storage.remove(`assets/${asset.id}/thumbnail.webp`); await pool.query("update media_assets set status='deleted',deleted_at=now(),updated_at=now() where id=$1", [asset.id]); }
    console.info({ event: execute ? "media_cleanup_deleted" : "media_cleanup_candidate", assetId: asset.id });
  }
  console.info({ event: "media_cleanup_complete", dryRun: !execute, count: result.rowCount ?? 0 });
} finally { await pool.end(); }
