import { randomUUID } from "node:crypto";
import type pg from "pg";
import { adminProjectEditorResponseSchema, adminProjectRevisionDtoSchema, type AdminProjectEditorResponse, type ProjectPublicationState, type SaveProjectRequest } from "../../../../contracts/project-contracts.js";
import { assertPublishable, normalizeStoredProjectDraftContent, projectDraftContentSchema, type ProjectDraftContent } from "./project-draft.schemas.js";
import { readNormalizedProjectLinks, replaceNormalizedProjectLinks } from "./project-links.repository.js";

type Actor = { userId: string; sessionId: string; requestId: string };
type InternalLegacySaveInput = { baseRevisionId: string | null; expectedDraftRevisionId: string | null; content: ProjectDraftContent };
export type PublishWriteStage = "published_revision" | "translations" | "links" | "features" | "notes" | "technologies" | "media" | "project" | "audit";
type PublishHooks = { afterStage?: (stage: PublishWriteStage) => Promise<void> | void; afterProjectLock?: (operation: "save" | "publish") => Promise<void> | void; afterLocaleStateLocks?: () => Promise<void> | void };
type RevisionRow = { id: string; revision_number: number; revision_type: "draft" | "published"; base_revision_id: string | null; content: unknown; created_at: Date; updated_at: Date; published_at: Date | null };

function iso(value: Date | null): string | null { return value?.toISOString() ?? null; }
function operationalRevisionDto(projectExternalKey: string, row: RevisionRow) { return adminProjectRevisionDtoSchema.parse({ revisionId: row.id, revisionNumber: row.revision_number, revisionType: row.revision_type, baseRevisionId: row.base_revision_id, content: normalizeStoredProjectDraftContent(projectExternalKey, row.content), createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(), publishedAt: iso(row.published_at) }); }

export class ProjectDraftRepository {
  constructor(private readonly pool: pg.Pool, private readonly hooks: PublishHooks = {}) {}

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

  async create(actor: Actor) {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const id = randomUUID();
      const suffix = id.slice(0, 8);
      const slug = `new-project-${suffix}`;
      const sortOrder = Number((await client.query<{ value: string }>("select coalesce(max(sort_order), 0) + 10 as value from projects")).rows[0]?.value ?? 10);
      const content = projectDraftContentSchema.parse({
        slug, galleryId: slug, sortOrder, projectType: null,
        dates: { startedAt: null, endedAt: null, ongoing: false },
        translations: {
          ru: { title: "", subtitle: null, description: "", role: "", statusLabel: "", technologiesTitle: null, displayType: "" },
          en: { title: "", subtitle: null, description: "", role: "", statusLabel: "", technologiesTitle: null, displayType: "" },
        },
        technologies: [], features: [], notes: [], links: [], media: [],
      });
      const revisionId = randomUUID();
      await client.query("insert into projects (id,external_key,slug,gallery_id,status,sort_order,is_ongoing,created_at,updated_at) values ($1,$2,$3,$4,'draft',$5,false,now(),now())", [id, `draft:${id}`, slug, slug, sortOrder]);
      await client.query("insert into project_revisions (id,project_id,revision_number,revision_type,content,created_by,created_at,updated_at) values ($1,$2,1,'draft',$3,$4,now(),now())", [revisionId, id, content, actor.userId]);
      await client.query("update projects set current_draft_revision_id=$1 where id=$2", [revisionId, id]);
      await client.query("commit");
      return await this.editor(slug);
    } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
  }

  async snapshot(projectId: string): Promise<ProjectDraftContent> {
    const project = await this.pool.query<any>("select * from projects where id = $1", [projectId]);
    if (!project.rows[0]) throw new Error("Project not found.");
    const row = project.rows[0];
    const [translations, technologies, media, features, notes, links] = await Promise.all([
      this.pool.query<any>("select locale,title,subtitle,description,role,status_label,technologies_title,display_type from project_translations where project_id=$1", [projectId]),
      this.pool.query<any>("select t.slug,t.name,pt.sort_order from project_technologies pt join technologies t on t.id=pt.technology_id where pt.project_id=$1 order by pt.sort_order", [projectId]),
      this.pool.query<any>("select m.id,m.external_key,m.path,m.source_type,m.role,m.width,m.height,pm.orientation,pm.gallery_kind,pm.presentation,pm.sort_order,mt.locale,mt.alt_text,mt.aria_label from project_media pm join media_assets m on m.id=pm.media_asset_id join media_asset_translations mt on mt.media_asset_id=m.id where pm.project_id=$1 order by pm.gallery_kind,pm.sort_order", [projectId]),
      this.pool.query<any>("select feature.id,feature.sort_order,translation.locale,translation.text from project_features feature join project_feature_translations translation on translation.feature_id=feature.id where feature.project_id=$1 order by feature.sort_order", [projectId]),
      this.pool.query<any>("select note.id,note.sort_order,translation.locale,translation.text from project_notes note join project_note_translations translation on translation.note_id=note.id where note.project_id=$1 order by note.sort_order", [projectId]),
      readNormalizedProjectLinks(this.pool, projectId),
    ]);
    const localized = Object.fromEntries(translations.rows.map((item: any) => [item.locale, { title: item.title, subtitle: item.subtitle, description: item.description, role: item.role, statusLabel: item.status_label, technologiesTitle: item.technologies_title, displayType: item.display_type }]));
    const assets = new Map<string, any>();
    for (const item of media.rows) { if (!item.orientation || !item.gallery_kind) throw Object.assign(new Error("Project media gallery metadata is unresolved; run the gallery-kind migration before editing this project."), { code: "GALLERY_KIND_UNRESOLVED" }); const key = item.source_type === "managed" ? item.id : item.external_key; const asset = assets.get(key) ?? (item.source_type === "managed" ? { id: item.id, sourceType: "managed", assetId: item.id, role: item.role, orientation: item.orientation, galleryKind: item.gallery_kind, presentation: item.presentation ?? "cover", sortOrder: item.sort_order, width: item.width ?? undefined, height: item.height ?? undefined, translations: {} } : { id: item.external_key, sourceType: "legacy", src: item.path, role: item.role, orientation: item.orientation, galleryKind: item.gallery_kind, presentation: item.presentation ?? "cover", sortOrder: item.sort_order, translations: {} }); asset.translations[item.locale] = { alt: item.alt_text, ariaLabel: item.aria_label }; assets.set(key, asset); }
    const contentItems = (items: any[]) => [...items.reduce((result, item) => { const value = result.get(item.id) ?? { id: item.id, sortOrder: item.sort_order, text: {} }; value.text[item.locale] = item.text; result.set(item.id, value); return result; }, new Map<string, any>()).values()];
    return projectDraftContentSchema.parse({ slug: row.slug, galleryId: row.gallery_id, sortOrder: row.sort_order, projectType: row.project_type, dates: { startedAt: row.started_at, endedAt: row.ended_at, ongoing: row.is_ongoing }, translations: localized, technologies: technologies.rows.map((item: any) => ({ slug: item.slug, name: item.name, sortOrder: item.sort_order })), links, features: contentItems(features.rows), notes: contentItems(notes.rows), media: [...assets.values()] });
  }

  async editor(slug: string): Promise<AdminProjectEditorResponse | null> {
    const result = await this.pool.query<any>("select id,external_key,slug,status,current_published_revision_id,current_draft_revision_id from projects where slug=$1", [slug]);
    const project = result.rows[0]; if (!project) return null;
    const revisions = await this.pool.query<RevisionRow>("select * from project_revisions where id = any($1::uuid[])", [[project.current_published_revision_id, project.current_draft_revision_id].filter(Boolean)]);
    const byId = new Map(revisions.rows.map((row) => [row.id, row]));
    const published = project.current_published_revision_id ? byId.get(project.current_published_revision_id) : undefined;
    if (project.current_published_revision_id && !published) throw Object.assign(new Error("Published revision is missing."), { code: "PROJECT_POINTER_INVALID" });
    const draft = project.current_draft_revision_id ? byId.get(project.current_draft_revision_id) : undefined;
    const publishedDto = published ? operationalRevisionDto(project.external_key, published) : null;
    const draftDto = draft ? operationalRevisionDto(project.external_key, draft) : null;
    const editable = draftDto ?? publishedDto;
    if (!editable) throw Object.assign(new Error("Project has no editable revision."), { code: "PROJECT_POINTER_INVALID" });
    const publicationState = this.legacyPublicationState(project, editable.content, Boolean(draftDto), publishedDto?.publishedAt ?? null);
    return adminProjectEditorResponseSchema.parse({ project: { id: project.id, externalKey: project.external_key, slug: project.slug, status: project.status }, published: publishedDto, draft: draftDto, editable: { source: draftDto ? "draft" : "published", revisionId: editable.revisionId, content: editable.content }, meta: { hasUnpublishedChanges: Boolean(draftDto) }, readOnly: false, localePublicationCapability: "legacy", publicationState });
  }

  /** Read-only admin view of the immutable published source.  It never creates an editor head. */
  async published(slug: string): Promise<AdminProjectEditorResponse | null> {
    const editor = await this.editor(slug);
    if (!editor) return null;
    if (!editor.published) throw Object.assign(new Error("Project has no published revision."), { code: "PUBLISHED_REVISION_NOT_FOUND" });
    return adminProjectEditorResponseSchema.parse({
      ...editor,
      draft: null,
      editable: { source: "published", revisionId: editor.published.revisionId, content: editor.published.content },
      meta: { hasUnpublishedChanges: false },
      readOnly: true,
    });
  }

  /**
   * Makes a new mutable editor head from the immutable published revision.
   * The project-row lock makes double requests converge on one active draft.
   */
  async createDraftFromPublished(slug: string, actor: Actor): Promise<AdminProjectEditorResponse | null> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const result = await client.query<any>("select * from projects where slug=$1 for update", [slug]);
      const project = result.rows[0];
      if (!project) throw Object.assign(new Error("Project not found."), { code: "PROJECT_NOT_FOUND" });
      if (!project.current_published_revision_id || project.status !== "published") throw Object.assign(new Error("Only a published project can create a draft from publication."), { code: "PUBLISHED_SOURCE_REQUIRED" });
      if (project.current_draft_revision_id) { await client.query("commit"); return await this.editor(slug); }
      const sourceResult = await client.query<RevisionRow>("select * from project_revisions where id=$1 and project_id=$2", [project.current_published_revision_id, project.id]);
      const source = sourceResult.rows[0];
      if (!source || source.revision_type !== "published") throw Object.assign(new Error("Published revision is missing."), { code: "PROJECT_POINTER_INVALID" });
      const number = Number((await client.query<any>("select coalesce(max(revision_number),0)+1 as value from project_revisions where project_id=$1", [project.id])).rows[0].value);
      const draftId = randomUUID();
      await client.query("insert into project_revisions (id,project_id,revision_number,revision_type,base_revision_id,content,created_by,created_at,updated_at) values ($1,$2,$3,'draft',$4,$5,$6,now(),now())", [draftId, project.id, number, source.id, source.content, actor.userId]);
      await client.query("update projects set current_draft_revision_id=$1,updated_at=now() where id=$2", [draftId, project.id]);
      await this.audit(client, actor, "project_draft_conflict", project.id, "success", { operation: "draft_created_from_published", draftRevisionId: draftId }, { sourcePublishedRevisionId: source.id, requestId: actor.requestId });
      await client.query("commit");
      return await this.editor(slug);
    } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
  }

  /** Clears only the mutable editor pointer. Revisions deliberately remain immutable history. */
  async deleteDraft(slug: string, expectedDraftRevisionId: string, actor: Actor): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const result = await client.query<any>("select * from projects where slug=$1 for update", [slug]);
      const project = result.rows[0];
      if (!project) throw Object.assign(new Error("Project not found."), { code: "PROJECT_NOT_FOUND" });
      if (!project.current_draft_revision_id) throw Object.assign(new Error("Project draft not found."), { code: "DRAFT_NOT_FOUND" });
      if (project.current_draft_revision_id !== expectedDraftRevisionId) throw Object.assign(new Error("The project draft was changed in another session."), { code: "DRAFT_CONFLICT" });
      // A never-published project has no safe editor fallback; deleting its last draft is a separate project-lifecycle operation.
      if (!project.current_published_revision_id) throw Object.assign(new Error("The last draft of an unpublished project cannot be deleted."), { code: "LAST_DRAFT_DELETE_FORBIDDEN" });
      await client.query("update projects set current_draft_revision_id=null,updated_at=now() where id=$1", [project.id]);
      await this.audit(client, actor, "project_draft_conflict", project.id, "success", { operation: "draft_deleted", revisionId: expectedDraftRevisionId }, { preservedPublishedRevisionId: project.current_published_revision_id });
      await client.query("commit");
    } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
  }

  /** Deletes only an aggregate that has never acquired a published projection. Media assets stay owned by media cleanup. */
  async deleteUnpublishedProject(slug: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const result = await client.query<any>("select * from projects where slug=$1 for update", [slug]);
      const project = result.rows[0];
      if (!project) throw Object.assign(new Error("Project not found."), { code: "PROJECT_NOT_FOUND" });
      const localePublished = await this.hasPublishedLocalePointer(client, project.id);
      if (project.current_published_revision_id || project.status === "published" || localePublished) throw Object.assign(new Error("A published project cannot be deleted."), { code: "PUBLISHED_PROJECT_DELETE_FORBIDDEN" });
      // The project row points at its immutable draft revision; clear that cycle before cascading the aggregate.
      await client.query("update projects set current_draft_revision_id=null,current_published_revision_id=null where id=$1", [project.id]);
      await client.query("delete from projects where id=$1", [project.id]);
      await client.query("commit");
    } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
  }

  private legacyPublicationState(project: { current_published_revision_id: string | null }, content: ProjectDraftContent, hasDraft: boolean, publishedAt: string | null): ProjectPublicationState {
    const published = Boolean(project.current_published_revision_id);
    let isPublishable = true;
    try { this.assertPublishable(content); } catch { isPublishable = false; }
    return Object.fromEntries((["ru", "en"] as const).map((locale) => [locale, { status: published ? "published" : "not_published", publishedRevisionId: project.current_published_revision_id, publishedAt: published ? publishedAt : null, publicationGeneration: 0, hasUnpublishedChanges: hasDraft, isPublishable }])) as ProjectPublicationState;
  }

  private async hasPublishedLocalePointer(client: pg.PoolClient, projectId: string): Promise<boolean> {
    const table = await client.query<{ table_name: string | null }>("select to_regclass('public.project_locale_publications')::text as table_name");
    if (!table.rows[0]?.table_name) return false;
    return Boolean((await client.query<{ exists: boolean }>("select exists(select 1 from project_locale_publications where project_id=$1 and current_publication_revision_id is not null) as exists", [projectId])).rows[0]?.exists);
  }

  async save(slug: string, input: SaveProjectRequest | InternalLegacySaveInput, actor: Actor) {
    // The untagged shape is retained only for direct repository callers from the pre-route test contour.
    // HTTP always parses the strict discriminated transport schema below before it reaches this method.
    const expectedDraftRevisionId = "expectedDraftRevisionId" in input ? input.expectedDraftRevisionId : "expectedEditorRevisionId" in input ? input.expectedEditorRevisionId : null;
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const result = await client.query<any>("select * from projects where slug=$1 for update", [slug]); const project = result.rows[0]; if (!project) throw Object.assign(new Error("Project not found."), { code: "PROJECT_NOT_FOUND" }); await this.hooks.afterProjectLock?.("save");
      if (project.current_published_revision_id !== input.baseRevisionId || project.current_draft_revision_id !== expectedDraftRevisionId) throw Object.assign(new Error("The project draft was changed in another session."), { code: "DRAFT_CONFLICT" });
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
      await client.query("begin"); const result = await client.query<any>("select * from projects where slug=$1 for update", [slug]); const project = result.rows[0]; if (!project) throw Object.assign(new Error("Project not found."), { code: "PROJECT_NOT_FOUND" }); await this.hooks.afterProjectLock?.("publish");
      if (!project.current_draft_revision_id) throw Object.assign(new Error("Project draft not found."), { code: "DRAFT_NOT_FOUND" });
      if (project.current_draft_revision_id !== expectedDraftRevisionId) throw Object.assign(new Error("The project draft was changed in another session."), { code: "PUBLISH_CONFLICT" });
      const draft = (await client.query<RevisionRow>("select * from project_revisions where id=$1", [expectedDraftRevisionId])).rows[0]; if (!draft) throw Object.assign(new Error("Project draft not found."), { code: "DRAFT_NOT_FOUND" });
      const content = normalizeStoredProjectDraftContent(project.external_key, draft.content); this.assertPublishable(content); await this.assertManagedAssets(client, project.id, content, actor.userId);
      const number = Number((await client.query<any>("select coalesce(max(revision_number),0)+1 as value from project_revisions where project_id=$1", [project.id])).rows[0].value); const id = randomUUID();
      await client.query("insert into project_revisions (id,project_id,revision_number,revision_type,base_revision_id,content,created_by,created_at,updated_at,published_at) values ($1,$2,$3,'published',$4,$5,$6,now(),now(),now())", [id,project.id,number,draft.id,content,actor.userId]); await this.afterStage("published_revision");
      await this.applyPublished(client, project.id, content);
      await client.query("update projects set status='published',current_published_revision_id=$1,current_draft_revision_id=null,slug=$2,gallery_id=$3,sort_order=$4,project_type=$5,started_at=$6,ended_at=$7,is_ongoing=$8,published_at=now(),updated_at=now() where id=$9", [id,content.slug,content.galleryId,content.sortOrder,content.projectType,content.dates.startedAt,content.dates.endedAt,content.dates.ongoing,project.id]); await this.afterStage("project");
      await this.audit(client, actor, "project_published", project.id, "success", { revisionId: id }, { previousPublishedRevisionId: project.current_published_revision_id, draftRevisionId: draft.id }); await this.afterStage("audit"); await client.query("commit"); return { revisionId: id, revisionNumber: number, publishedAt: new Date().toISOString() };
    } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
  }

  async revisions(slug: string) {
    const result = await this.pool.query<RevisionRow & { external_key: string }>("select r.*, p.external_key from project_revisions r join projects p on p.id=r.project_id where p.slug=$1 order by r.revision_number desc limit 30", [slug]);
    return result.rows.map((row) => operationalRevisionDto(row.external_key, row));
  }
  async auditEvents(slug: string) { const result = await this.pool.query<any>("select a.event_type,a.status,a.summary,a.metadata,a.created_at from audit_events a join projects p on p.id=a.entity_id where p.slug=$1 order by a.created_at desc limit 30", [slug]); return result.rows.map((row) => ({ eventType: row.event_type, status: row.status, summary: row.summary, metadata: row.metadata, createdAt: row.created_at.toISOString() })); }
  private assertPublishable(content: ProjectDraftContent) { assertPublishable(content); }
  private async assertManagedAssets(client: pg.PoolClient, projectId: string, content: ProjectDraftContent, userId: string) { const managed = content.media.filter((asset) => asset.sourceType === "managed"); if (!managed.length) return; const ids = managed.map((asset) => asset.assetId); const result = await client.query<any>("select id,status,created_by from media_assets where id=any($1::uuid[]) and source_type='managed' and deleted_at is null", [ids]); if (result.rows.length !== new Set(ids).size || result.rows.some((asset) => !["temporary","draft","active"].includes(asset.status) || asset.created_by !== userId)) throw Object.assign(new Error("Managed media asset is unavailable."), { code: "VALIDATION_ERROR" }); await client.query("update media_assets set status='draft',updated_at=now() where id=any($1::uuid[]) and status='temporary'", [ids]); }
  private async applyPublished(client: pg.PoolClient, projectId: string, content: ProjectDraftContent) {
    for (const locale of ["en", "ru"] as const) {
      const value = content.translations[locale];
      await client.query("insert into project_translations (id,project_id,locale,title,subtitle,description,role,status_label,technologies_title,display_type,created_at,updated_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),now()) on conflict (project_id,locale) do update set title=excluded.title,subtitle=excluded.subtitle,description=excluded.description,role=excluded.role,status_label=excluded.status_label,technologies_title=excluded.technologies_title,display_type=excluded.display_type,updated_at=now()", [randomUUID(), projectId, locale, value.title, value.subtitle, value.description, value.role, value.statusLabel, value.technologiesTitle, value.displayType]);
    } await this.afterStage("translations");
    await replaceNormalizedProjectLinks(client, projectId, content.links); await this.afterStage("links");
    await client.query("delete from project_features where project_id=$1", [projectId]);
    for (const feature of content.features) {
      await client.query("insert into project_features (id,project_id,sort_order,created_at,updated_at) values ($1,$2,$3,now(),now())", [feature.id, projectId, feature.sortOrder]);
      for (const locale of ["en", "ru"] as const) await client.query("insert into project_feature_translations (feature_id,locale,text) values ($1,$2,$3)", [feature.id, locale, feature.text[locale]]);
    } await this.afterStage("features");
    await client.query("delete from project_notes where project_id=$1", [projectId]);
    for (const note of content.notes) {
      await client.query("insert into project_notes (id,project_id,sort_order,created_at,updated_at) values ($1,$2,$3,now(),now())", [note.id, projectId, note.sortOrder]);
      for (const locale of ["en", "ru"] as const) await client.query("insert into project_note_translations (note_id,locale,text) values ($1,$2,$3)", [note.id, locale, note.text[locale]]);
    } await this.afterStage("notes");
    await client.query("delete from project_technologies where project_id=$1", [projectId]);
    for (const technology of content.technologies) {
      const technologyId = (await client.query<any>("select id from technologies where slug=$1 and name=$2 and is_active=true", [technology.slug, technology.name])).rows[0]?.id;
      if (!technologyId) throw Object.assign(new Error("Technology must exist in the dictionary."), { code: "VALIDATION_ERROR" });
      await client.query("insert into project_technologies (project_id,technology_id,sort_order) values ($1,$2,$3)", [projectId, technologyId, technology.sortOrder]);
    } await this.afterStage("technologies");
    await client.query("delete from project_media where project_id=$1", [projectId]);
    for (const asset of content.media) {
      const assetId = asset.sourceType === "managed" ? asset.assetId : (await client.query<any>("select id from media_assets where external_key=$1", [asset.id])).rows[0]?.id;
      if (!assetId) throw Object.assign(new Error("Media asset is unavailable."), { code: "VALIDATION_ERROR" });
      await client.query("insert into project_media (project_id,media_asset_id,orientation,gallery_kind,presentation,sort_order) values ($1,$2,$3::media_orientation,$4::project_gallery_kind,$5::media_presentation,$6)", [projectId, assetId, asset.orientation, asset.galleryKind, asset.presentation, asset.sortOrder]);
      for (const locale of ["en", "ru"] as const) await client.query("insert into media_asset_translations (media_asset_id,locale,alt_text,aria_label,created_at,updated_at) values ($1,$2,$3,$4,now(),now()) on conflict (media_asset_id,locale) do update set alt_text=excluded.alt_text,aria_label=excluded.aria_label,updated_at=now()", [assetId, locale, asset.translations[locale].alt, asset.translations[locale].ariaLabel]);
    }
    const managed = content.media.filter((asset) => asset.sourceType === "managed").map((asset) => asset.assetId);
    if (managed.length) await client.query("update media_assets set status='active',updated_at=now() where id=any($1::uuid[])", [managed]); await this.afterStage("media");
  }
  private async afterStage(stage: PublishWriteStage) { await this.hooks.afterStage?.(stage); }
  private async audit(client: pg.PoolClient, actor: Actor, event: string, entityId: string, status: string, summary: object, metadata: object) { await client.query("insert into audit_events (id,actor_id,session_id,event_type,entity_id,status,summary,metadata,created_at) values ($1,$2,$3,$4::audit_event_type,$5,$6::audit_event_status,$7,$8,now())", [randomUUID(),actor.userId,actor.sessionId,event,entityId,status,summary,metadata]); }
}
