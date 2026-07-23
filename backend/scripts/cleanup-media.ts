import { loadEnv } from "../src/config/env.js";
import { createPool } from "../src/db/client.js";
import { createMediaStorageRegistry } from "../src/modules/media-storage/media-storage.js";

const execute = process.argv.includes("--execute");
const env = loadEnv();
const pool = createPool(env.DATABASE_URL);
const storage = createMediaStorageRegistry(env);

try {
  const result = await pool.query<{ id: string; storage_driver: string | null; storage_key: string }>(`
    select a.id,a.storage_driver,v.storage_key
    from media_assets a
    join media_asset_variants v on v.media_asset_id=a.id
    where a.source_type='managed'
      and a.status in ('temporary','draft')
      and a.created_at < now() - interval '24 hours'
      and not exists (select 1 from project_revisions where content::text like '%' || a.id::text || '%')
    order by a.id
  `);
  const assetIds = new Set(result.rows.map((row) => row.id));
  for (const row of result.rows) {
    if (execute) await storage.providerFor(row.storage_driver).remove(row.storage_key);
    console.info({ event: execute ? "media_cleanup_object_deleted" : "media_cleanup_object_candidate", assetId: row.id, storageProvider: row.storage_driver });
  }
  if (execute && assetIds.size) await pool.query("update media_assets set status='deleted',deleted_at=now(),updated_at=now() where id=any($1::uuid[])", [[...assetIds]]);
  console.info({ event: "media_cleanup_complete", dryRun: !execute, assets: assetIds.size, objects: result.rowCount ?? 0 });
} finally {
  await pool.end();
}
