import { randomUUID } from "node:crypto";
import type pg from "pg";
import { assertPublishable, projectDraftContentSchema, type ProjectDraftContent } from "./project-draft.schemas.js";

type Actor = { userId: string; sessionId: string; requestId: string };
type RevisionRow = { id: string; revision_number: number; revision_type: "draft" | "published"; base_revision_id: string | null; content: ProjectDraftContent; created_at: Date; updated_at: Date; published_at: Date | null };

function iso(value: Date | null): string | null { return value?.toISOString() ?? null; }
function revisionDto(row: RevisionRow) { return { revisionId: row.id, revisionNumber: row.revision_number, revisionType: row.revision_type, baseRevisionId: row.base_revision_id, content: row.content, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(), publishedAt: iso(row.published_at) }; }

export class ProjectDraftRepository {
  constructor(private readonly pool: pg.Pool) {}

  async backfill(): Promise<void> {
    const projects = await this.pool.query<{ id: string }>("select id from projects where status = 'published' and current_published_revision_id is null");
    for (const project of projects.rows) await this.pool.query("select pg_advisory_xact_lock(hashtext($1))", [project.id]).catch(() => undefined);
    for (const project of projects.rows) {
      const content = await this.snapshot(project.id);
      const id = randomUUID();
      await this.pool.query("insert into project_revisions (id, project_id, revision_number, revision_type, content, created_at, updated_at, published_at) values ($1,$2,1,'published',$3,now(),now(),now())", [id, project.id, content]);
      await this.pool.query("update projects set current_published_revision_id = $1 where id = $2 and current_published_revision_id is null", [id, project.id]);
    }
  }

  async snapshot(projectId: string): Promise<ProjectDraftContent> {
    const project = await this.pool.query<any>("select * from projects where id = $1", [projectId]);
    if (!project.rows[0]) throw new Error("Project not found.");
    const row = project.rows[0];
    const [translations, technologies, media] = await Promise.all([
      this.pool.query<any>("select locale,title,subtitle,description,role,status_label,primary_action_label,secondary_action_label,technologies_title from project_translations where project_id=$1", [projectId]),
      this.pool.query<any>("select t.slug,t.name,pt.sort_order from project_technologies pt join technologies t on t.id=pt.technology_id where pt.project_id=$1 order by pt.sort_order", [projectId]),
      this.pool.query<any>("select m.id,m.external_key,m.path,m.source_type,m.role,pm.sort_order,mt.locale,mt.alt_text,mt.aria_label from project_media pm join media_assets m on m.id=pm.media_asset_id join media_asset_translations mt on mt.media_asset_id=m.id where pm.project_id=$1 order by pm.sort_order", [projectId]),
    ]);
    const localized = Object.fromEntries(translations.rows.map((item: any) => [item.locale, { title: item.title, subtitle: item.subtitle, description: item.description, role: item.role, statusLabel: item.status_label, primaryActionLabel: item.primary_action_label, secondaryActionLabel: item.secondary_action_label, technologiesTitle: item.technologies_title }]));
    const assets = new Map<string, any>();
    for (const item of media.rows) { const key = item.source_type === "managed" ? item.id : item.external_key; const asset = assets.get(key) ?? (item.source_type === "managed" ? { id: item.id, sourceType: "managed", assetId: item.id, role: item.role, sortOrder: item.sort_order, translations: {} } : { id: item.external_key, sourceType: "legacy", src: item.path, role: item.role, sortOrder: item.sort_order, translations: {} }); asset.translations[item.locale] = { alt: item.alt_text, ariaLabel: item.aria_label }; assets.set(key, asset); }
    return projectDraftContentSchema.parse({ slug: row.slug, galleryId: row.gallery_id, sortOrder: row.sort_order, projectType: row.project_type, dates: { startedAt: row.started_at, endedAt: row.ended_at, ongoing: row.is_ongoing }, translations: localized, technologies: technologies.rows.map((item: any) => ({ slug: item.slug, name: item.name, sortOrder: item.sort_order })), links: { primary: row.primary_url ? { href: row.primary_url, type: row.primary_link_type } : null, secondary: row.secondary_url ? { href: row.secondary_url, type: row.secondary_link_type } : null }, media: [...assets.values()] });
  }

  async editor(slug: string) {
    const result = await this.pool.query<any>("select id,external_key,slug,status,current_published_revision_id,current_draft_revision_id from projects where slug=$1", [slug]);
    const project = result.rows[0]; if (!project) return null;
    const revisions = await this.pool.query<RevisionRow>("select * from project_revisions where id = any($1::uuid[])", [[project.current_published_revision_id, project.current_draft_revision_id].filter(Boolean)]);
    const byId = new Map(revisions.rows.map((row) => [row.id, row]));
    const published = byId.get(project.current_published_revision_id); if (!published) throw new Error("Published revision is missing.");
    const draft = project.current_draft_revision_id ? byId.get(project.current_draft_revision_id) : undefined;
    return { project: { id: project.id, externalKey: project.external_key, slug: project.slug, status: project.status }, published: revisionDto(published), draft: draft ? revisionDto(draft) : null, meta: { hasUnpublishedChanges: Boolean(draft) } };
  }

  async save(slug: string, input: { baseRevisionId: string; expectedDraftRevisionId: string | null; content: ProjectDraftContent }, actor: Actor) {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const result = await client.query<any>("select * from projects where slug=$1 for update", [slug]); const project = result.rows[0]; if (!project) throw Object.assign(new Error("Project not found."), { code: "PROJECT_NOT_FOUND" });
      if (project.current_published_revision_id !== input.baseRevisionId || project.current_draft_revision_id !== input.expectedDraftRevisionId) throw Object.assign(new Error("The project draft was changed in another session."), { code: "DRAFT_CONFLICT" });
      await this.assertManagedAssets(client, project.id, input.content, actor.userId);
      const number = Number((await client.query<any>("select coalesce(max(revision_number),0)+1 as value from project_revisions where project_id=$1", [project.id])).rows[0].value);
      const id = randomUUID();
      await client.query("insert into project_revisions (id,project_id,revision_number,revision_type,base_revision_id,content,created_by,created_at,updated_at) values ($1,$2,$3,'draft',$4,$5,$6,now(),now())", [id,project.id,number,input.baseRevisionId,input.content,actor.userId]);
      await client.query("update projects set current_draft_revision_id=$1,updated_at=now() where id=$2", [id,project.id]);
      await this.audit(client, actor, "project_draft_saved", project.id, "success", { revisionId: id }, { changedFields: ["content"] });
      await client.query("commit"); return { revisionId: id, revisionNumber: number, updatedAt: new Date().toISOString(), hasUnpublishedChanges: true };
    } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
  }

  async publish(slug: string, expectedDraftRevisionId: string, actor: Actor) {
    const client = await this.pool.connect();
    try {
      await client.query("begin"); const result = await client.query<any>("select * from projects where slug=$1 for update", [slug]); const project = result.rows[0]; if (!project) throw Object.assign(new Error("Project not found."), { code: "PROJECT_NOT_FOUND" });
      if (!project.current_draft_revision_id) throw Object.assign(new Error("Project draft not found."), { code: "DRAFT_NOT_FOUND" });
      if (project.current_draft_revision_id !== expectedDraftRevisionId) throw Object.assign(new Error("The project draft was changed in another session."), { code: "PUBLISH_CONFLICT" });
      const draft = (await client.query<RevisionRow>("select * from project_revisions where id=$1", [expectedDraftRevisionId])).rows[0]; if (!draft) throw Object.assign(new Error("Project draft not found."), { code: "DRAFT_NOT_FOUND" });
      const content = projectDraftContentSchema.parse(draft.content); this.assertPublishable(content); await this.assertManagedAssets(client, project.id, content, actor.userId);
      const number = Number((await client.query<any>("select coalesce(max(revision_number),0)+1 as value from project_revisions where project_id=$1", [project.id])).rows[0].value); const id = randomUUID();
      await client.query("insert into project_revisions (id,project_id,revision_number,revision_type,base_revision_id,content,created_by,created_at,updated_at,published_at) values ($1,$2,$3,'published',$4,$5,$6,now(),now(),now())", [id,project.id,number,draft.id,content,actor.userId]);
      await this.applyPublished(client, project.id, content);
      await client.query("update projects set current_published_revision_id=$1,current_draft_revision_id=null,slug=$2,gallery_id=$3,sort_order=$4,project_type=$5,started_at=$6,ended_at=$7,is_ongoing=$8,published_at=now(),updated_at=now() where id=$9", [id,content.slug,content.galleryId,content.sortOrder,content.projectType,content.dates.startedAt,content.dates.endedAt,content.dates.ongoing,project.id]);
      await this.audit(client, actor, "project_published", project.id, "success", { revisionId: id }, { previousPublishedRevisionId: project.current_published_revision_id, draftRevisionId: draft.id }); await client.query("commit"); return { revisionId: id, revisionNumber: number, publishedAt: new Date().toISOString() };
    } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
  }

  async revisions(slug: string) { const result = await this.pool.query<any>("select r.* from project_revisions r join projects p on p.id=r.project_id where p.slug=$1 order by r.revision_number desc limit 30", [slug]); return result.rows.map(revisionDto); }
  async auditEvents(slug: string) { const result = await this.pool.query<any>("select a.event_type,a.status,a.summary,a.metadata,a.created_at from audit_events a join projects p on p.id=a.entity_id where p.slug=$1 order by a.created_at desc limit 30", [slug]); return result.rows.map((row) => ({ eventType: row.event_type, status: row.status, summary: row.summary, metadata: row.metadata, createdAt: row.created_at.toISOString() })); }
  private assertPublishable(content: ProjectDraftContent) { assertPublishable(content); }
  private async assertManagedAssets(client: pg.PoolClient, projectId: string, content: ProjectDraftContent, userId: string) { const managed = content.media.filter((asset) => asset.sourceType === "managed"); if (!managed.length) return; const ids = managed.map((asset) => asset.assetId); const result = await client.query<any>("select id,status,created_by from media_assets where id=any($1::uuid[]) and source_type='managed' and deleted_at is null", [ids]); if (result.rows.length !== new Set(ids).size || result.rows.some((asset) => !["temporary","draft","active"].includes(asset.status) || asset.created_by !== userId)) throw Object.assign(new Error("Managed media asset is unavailable."), { code: "VALIDATION_ERROR" }); await client.query("update media_assets set status='draft',updated_at=now() where id=any($1::uuid[]) and status='temporary'", [ids]); }
  private async applyPublished(client: pg.PoolClient, projectId: string, content: ProjectDraftContent) { for (const locale of ["en","ru"] as const) { const value=content.translations[locale]; await client.query("update project_translations set title=$1,subtitle=$2,description=$3,role=$4,status_label=$5,primary_action_label=$6,secondary_action_label=$7,technologies_title=$8,updated_at=now() where project_id=$9 and locale=$10", [value.title,value.subtitle,value.description,value.role,value.statusLabel,value.primaryActionLabel,value.secondaryActionLabel,value.technologiesTitle,projectId,locale]); } await client.query("delete from project_technologies where project_id=$1",[projectId]); for (const technology of content.technologies) { const technologyId=(await client.query<any>("select id from technologies where slug=$1 and name=$2 and is_active=true",[technology.slug,technology.name])).rows[0]?.id; if(!technologyId) throw Object.assign(new Error("Technology must exist in the dictionary."),{code:"VALIDATION_ERROR"}); await client.query("insert into project_technologies (project_id,technology_id,sort_order) values ($1,$2,$3)",[projectId,technologyId,technology.sortOrder]); } await client.query("delete from project_media where project_id=$1", [projectId]); for (const asset of content.media) { const assetId = asset.sourceType === "managed" ? asset.assetId : (await client.query<any>("select id from media_assets where external_key=$1", [asset.id])).rows[0]?.id; if (!assetId) throw Object.assign(new Error("Media asset is unavailable."), { code: "VALIDATION_ERROR" }); await client.query("insert into project_media (project_id,media_asset_id,sort_order) values ($1,$2,$3)", [projectId, assetId, asset.sortOrder]); for(const locale of ["en","ru"] as const) await client.query("insert into media_asset_translations (media_asset_id,locale,alt_text,aria_label,created_at,updated_at) values ($1,$2,$3,$4,now(),now()) on conflict (media_asset_id,locale) do update set alt_text=excluded.alt_text,aria_label=excluded.aria_label,updated_at=now()", [assetId,locale,asset.translations[locale].alt,asset.translations[locale].ariaLabel]); } const managed = content.media.filter((asset) => asset.sourceType === "managed").map((asset) => asset.assetId); if (managed.length) { await client.query("update media_assets set status='active',updated_at=now() where id=any($1::uuid[])", [managed]); } }
  private async audit(client: pg.PoolClient, actor: Actor, event: string, entityId: string, status: string, summary: object, metadata: object) { await client.query("insert into audit_events (id,actor_id,session_id,event_type,entity_id,status,summary,metadata,created_at) values ($1,$2,$3,$4::audit_event_type,$5,$6::audit_event_status,$7,$8,now())", [randomUUID(),actor.userId,actor.sessionId,event,entityId,status,summary,metadata]); }
}
