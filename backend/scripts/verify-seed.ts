import { pathToFileURL } from "node:url";
import pg from "pg";
import { loadEnv } from "../src/config/env.js";

export interface VerifySeedResult {
  publishedProjects: number;
  mediaByProject: Record<string, number>;
  draftProjectsVisible: number;
}

export async function verifySeed(pool: pg.Pool): Promise<VerifySeedResult> {
  const client = await pool.connect();
  try {
    const published = await client.query<{ count: string }>("select count(*) from projects where status = 'published'");
    const draftVisible = await client.query<{ count: string }>(
      "select count(*) from projects where status <> 'published' and published_at is not null",
    );
    const media = await client.query<{ external_key: string; count: string }>(`
      select p.external_key, count(pm.media_asset_id)
      from projects p
      left join project_media pm on pm.project_id = p.id
      where p.status = 'published'
      group by p.external_key, p.sort_order
      order by p.sort_order
    `);

    const result = {
      publishedProjects: Number(published.rows[0]?.count ?? 0),
      draftProjectsVisible: Number(draftVisible.rows[0]?.count ?? 0),
      mediaByProject: Object.fromEntries(media.rows.map((row) => [row.external_key, Number(row.count)])),
    };

    if (result.publishedProjects !== 3) {
      throw new Error(`Expected 3 published projects, got ${result.publishedProjects}`);
    }

    return result;
  } finally {
    client.release();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const env = loadEnv();
  const pool = new pg.Pool({ connectionString: env.DATABASE_URL });

  try {
    const result = await verifySeed(pool);
    console.info({ event: "seed_verify_complete", ...result });
  } finally {
    await pool.end();
  }
}
