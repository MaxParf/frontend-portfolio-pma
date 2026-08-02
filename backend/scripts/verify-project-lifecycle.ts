import pg from "pg";
import { loadEnv } from "../src/config/env.js";

export type ProjectLifecycleRow = { id: string; slug: string; status: "draft" | "published"; draft_id: string | null; published_id: string | null; published_at: Date | null; draft_project_id: string | null; draft_type: "draft" | "published" | null; published_project_id: string | null; published_type: "draft" | "published" | null; projection: boolean };

export function classifyProjectLifecycle(row: ProjectLifecycleRow): string {
  if (row.draft_id && row.draft_project_id !== row.id || row.published_id && row.published_project_id !== row.id) return "invalid_cross_project_pointer";
  if (row.draft_id && !row.draft_type || row.published_id && !row.published_type) return "invalid_missing_revision";
  if (row.draft_id && row.draft_type !== "draft" || row.published_id && row.published_type !== "published") return "invalid_wrong_type";
  if (row.status === "draft" && row.draft_id && !row.published_id && !row.published_at && !row.projection) return "never_published_draft";
  if (row.status === "published" && row.published_id && !row.draft_id && row.projection) return "published_clean";
  if (row.status === "published" && row.published_id && row.draft_id && row.projection) return "published_with_draft";
  if (!row.draft_id && !row.published_id) return "invalid_no_pointer";
  if (row.status === "draft" && (row.published_id || row.published_at || row.projection) || row.status === "published" && (!row.published_id || !row.projection)) return "invalid_status_pointer_mismatch";
  return "invalid_public_projection_mismatch";
}

export async function verifyProjectLifecycle(pool: pg.Pool): Promise<{ projects: number; counts: Record<string, number> }> {
  const result = await pool.query<ProjectLifecycleRow>(`select p.id,p.slug,p.status,p.current_draft_revision_id as draft_id,p.current_published_revision_id as published_id,p.published_at,rd.project_id as draft_project_id,rd.revision_type as draft_type,rp.project_id as published_project_id,rp.revision_type as published_type,exists(select 1 from project_translations t where t.project_id=p.id) as projection from projects p left join project_revisions rd on rd.id=p.current_draft_revision_id left join project_revisions rp on rp.id=p.current_published_revision_id order by p.sort_order`);
  const counts = result.rows.reduce<Record<string, number>>((all, row) => { const state = classifyProjectLifecycle(row); all[state] = (all[state] ?? 0) + 1; return all; }, {});
  return { projects: result.rows.length, counts };
}

const isEntrypoint = process.argv[1]?.endsWith("verify-project-lifecycle.ts");
if (isEntrypoint) {
  const env = loadEnv();
  const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
  try {
    const result = await verifyProjectLifecycle(pool);
    console.info(JSON.stringify({ event: "project_lifecycle_verified", ...result }));
    if (Object.keys(result.counts).some((state) => state.startsWith("invalid_"))) process.exitCode = 1;
  } finally { await pool.end(); }
}
