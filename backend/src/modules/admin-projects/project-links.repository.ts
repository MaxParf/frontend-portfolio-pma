import type pg from "pg";
import type { ProjectLink } from "./project-links.js";

export const PROJECT_LINK_CONTENT_INTEGRITY_ERROR = "PROJECT_LINK_CONTENT_INTEGRITY_ERROR";
export class ProjectLinkContentIntegrityError extends Error { readonly code = PROJECT_LINK_CONTENT_INTEGRITY_ERROR; constructor(message: string) { super(message); } }
type Executor = Pick<pg.Pool, "query"> | Pick<pg.PoolClient, "query">;

export async function readNormalizedProjectLinks(executor: Executor, projectId: string): Promise<ProjectLink[]> {
  const result = await executor.query<{ id: string; url: string; sort_order: number; locale: string | null; label: string | null }>("select l.id,l.url,l.sort_order,t.locale,t.label from project_links l left join project_link_translations t on t.project_link_id=l.id where l.project_id=$1 order by l.sort_order,t.locale", [projectId]);
  const links = new Map<string, ProjectLink>();
  for (const row of result.rows) {
    if (!row.url.trim()) throw new ProjectLinkContentIntegrityError(`Project ${projectId} link ${row.id} has an empty URL.`);
    const current = links.get(row.id) ?? { id: row.id, url: row.url, sortOrder: row.sort_order, label: { ru: "", en: "" } };
    if (current.sortOrder !== row.sort_order || current.url !== row.url || !row.locale || (row.locale !== "ru" && row.locale !== "en") || !row.label?.trim() || current.label[row.locale]) throw new ProjectLinkContentIntegrityError(`Project ${projectId} link ${row.id} has invalid translations.`);
    current.label[row.locale] = row.label; links.set(row.id, current);
  }
  const values = [...links.values()];
  if (new Set(values.map((link) => link.sortOrder)).size !== values.length || values.some((link) => !link.label.ru || !link.label.en)) throw new ProjectLinkContentIntegrityError(`Project ${projectId} links ${values.map((link) => link.id).join(",")} are incomplete or have duplicate sort order.`);
  return values;
}

export async function replaceNormalizedProjectLinks(executor: Executor, projectId: string, links: readonly ProjectLink[]): Promise<void> {
  await executor.query("delete from project_links where project_id=$1", [projectId]);
  for (const link of links) { await executor.query("insert into project_links (id,project_id,url,sort_order,created_at,updated_at) values ($1,$2,$3,$4,now(),now())", [link.id, projectId, link.url, link.sortOrder]); for (const locale of ["ru", "en"] as const) await executor.query("insert into project_link_translations (project_link_id,locale,label) values ($1,$2,$3)", [link.id, locale, link.label[locale]]); }
}
