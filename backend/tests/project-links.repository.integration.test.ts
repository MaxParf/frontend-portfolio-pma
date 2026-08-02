import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { loadEnv } from "../src/config/env.js";
import { assertTestDatabase } from "../src/config/database-identity.js";
import { createDatabase } from "../src/db/client.js";
import { PROJECT_LINK_CONTENT_INTEGRITY_ERROR, ProjectLinkContentIntegrityError, readNormalizedProjectLinks, replaceNormalizedProjectLinks } from "../src/modules/admin-projects/project-links.repository.js";
import type { ProjectLink } from "../src/modules/admin-projects/project-links.js";

const projectAId = "20000000-0000-4000-8000-000000000001";
const projectBId = "20000000-0000-4000-8000-000000000002";
const projectExternalKeys = ["project-links-repository-a", "project-links-repository-b"];
const initialLinks: ProjectLink[] = [
  { id: "21000000-0000-4000-8000-000000000001", url: "https://example.com/a", sortOrder: 10, label: { ru: "Открыть проект", en: "Open project" } },
  { id: "21000000-0000-4000-8000-000000000002", url: "https://example.com/docs", sortOrder: 20, label: { ru: "Документация", en: "Documentation" } },
];
const projectBLinks: ProjectLink[] = [
  { id: "22000000-0000-4000-8000-000000000001", url: "https://example.com/b", sortOrder: 10, label: { ru: "Проект B", en: "Project B" } },
];
const featureId = "23000000-0000-4000-8000-000000000001";
const noteId = "23000000-0000-4000-8000-000000000002";
const technologyId = "23000000-0000-4000-8000-000000000003";
const mediaAssetId = "23000000-0000-4000-8000-000000000004";
const revisionId = "23000000-0000-4000-8000-000000000005";

const env = loadEnv({ ...process.env, NODE_ENV: "test" });
assertTestDatabase(env, "Project links repository integration test setup");
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });

async function linkCounts(projectId: string): Promise<{ structural: number; translations: number }> {
  const result = await pool.query<{ structural: string; translations: string }>(`
    select
      (select count(*)::text from project_links where project_id = $1) as structural,
      (select count(*)::text from project_link_translations translation join project_links link on link.id = translation.project_link_id where link.project_id = $1) as translations
  `, [projectId]);
  return { structural: Number(result.rows[0]!.structural), translations: Number(result.rows[0]!.translations) };
}

async function ensureProjectLinksSchema(): Promise<void> {
  await pool.query(`
    create table if not exists project_links (
      id uuid primary key not null,
      project_id uuid not null references projects(id) on delete cascade,
      url text not null check (btrim(url) <> ''),
      sort_order integer not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await pool.query("create unique index if not exists project_links_project_sort_order_uq on project_links(project_id, sort_order)");
  await pool.query(`
    create table if not exists project_link_translations (
      project_link_id uuid not null references project_links(id) on delete cascade,
      locale text not null check (locale in ('ru', 'en')),
      label text not null check (btrim(label) <> ''),
      primary key (project_link_id, locale)
    )
  `);
}

async function clearLinks(): Promise<void> {
  await pool.query("delete from project_links where project_id = any($1::uuid[])", [[projectAId, projectBId]]);
}

async function assertIntegrityError(action: () => Promise<unknown>, projectId: string, linkId: string): Promise<void> {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error instanceof ProjectLinkContentIntegrityError);
    assert.equal(error.code, PROJECT_LINK_CONTENT_INTEGRITY_ERROR);
    assert.match(error.message, new RegExp(projectId));
    assert.match(error.message, new RegExp(linkId));
    assert.doesNotMatch(error.message, /(postgres(?:ql)?|database|connection|:\/\/)/i);
    return true;
  });
}

function rawRowsExecutor(rows: Array<{ id: string; url: string; sort_order: number; locale: string | null; label: string | null }>) {
  return { query: async () => ({ rows, command: "SELECT", rowCount: rows.length, oid: 0, fields: [] }) } as never;
}

async function otherBlocksSnapshot() {
  const [features, featureTranslations, notes, noteTranslations, technologies, media, translations, revisions, pointers] = await Promise.all([
    pool.query("select id,sort_order from project_features where project_id=$1 order by sort_order,id", [projectAId]),
    pool.query("select translation.feature_id,translation.locale,translation.text from project_feature_translations translation join project_features feature on feature.id=translation.feature_id where feature.project_id=$1 order by translation.feature_id,translation.locale", [projectAId]),
    pool.query("select id,sort_order from project_notes where project_id=$1 order by sort_order,id", [projectAId]),
    pool.query("select translation.note_id,translation.locale,translation.text from project_note_translations translation join project_notes note on note.id=translation.note_id where note.project_id=$1 order by translation.note_id,translation.locale", [projectAId]),
    pool.query("select project_id,technology_id,sort_order from project_technologies where project_id=$1 order by sort_order,technology_id", [projectAId]),
    pool.query("select media.id,media.external_key,media.path,media.role,media.sort_order as asset_sort_order,media.source_type,media.status,reference.sort_order,reference.orientation,reference.presentation,reference.gallery_kind from project_media reference join media_assets media on media.id=reference.media_asset_id where reference.project_id=$1 order by reference.gallery_kind,reference.sort_order", [projectAId]),
    pool.query("select locale,title,subtitle,description,role,status_label,primary_action_label,secondary_action_label,technologies_title,display_type from project_translations where project_id=$1 order by locale", [projectAId]),
    pool.query("select id,revision_number,revision_type,base_revision_id,content::text as content,published_at from project_revisions where project_id=$1 order by revision_number,id", [projectAId]),
    pool.query("select current_published_revision_id,current_draft_revision_id from projects where id=$1", [projectAId]),
  ]);
  return { features: features.rows, featureTranslations: featureTranslations.rows, notes: notes.rows, noteTranslations: noteTranslations.rows, technologies: technologies.rows, media: media.rows, translations: translations.rows, revisions: revisions.rows, pointers: pointers.rows };
}

before(async () => {
  await migrate(createDatabase(pool), { migrationsFolder: "./drizzle" });
  await ensureProjectLinksSchema();
  await pool.query("delete from projects where external_key = any($1::text[])", [projectExternalKeys]);
  await pool.query(`
    insert into projects (id, external_key, slug, gallery_id, status, sort_order, is_ongoing, primary_url, primary_link_type, secondary_url, secondary_link_type, created_at, updated_at)
    values
      ($1, $2, $2, $2, 'draft', 9001, false, 'https://legacy.example/a', 'website', 'https://legacy.example/a/docs', 'repository', now(), now()),
      ($3, $4, $4, $4, 'draft', 9002, false, null, null, null, null, now(), now())
  `, [projectAId, projectExternalKeys[0], projectBId, projectExternalKeys[1]]);
  await pool.query(`
    insert into project_translations (id,project_id,locale,title,subtitle,description,role,status_label,primary_action_label,secondary_action_label,technologies_title,display_type,created_at,updated_at)
    values
      ('20000000-0000-4000-8000-000000000011',$1,'ru','Тест A','Подзаголовок A','Описание A','Роль A','Статус A','Открыть legacy A','Документация legacy A','Технологии A','Тип A',now(),now()),
      ('20000000-0000-4000-8000-000000000012',$1,'en','Test A','Subtitle A','Description A','Role A','Status A','Open legacy A','Legacy docs A','Technologies A','Type A',now(),now()),
      ('20000000-0000-4000-8000-000000000013',$2,'ru','Тест B',null,'Описание B','Роль B','Статус B',null,null,null,'Тип B',now(),now()),
      ('20000000-0000-4000-8000-000000000014',$2,'en','Test B',null,'Description B','Role B','Status B',null,null,null,'Type B',now(),now())
  `, [projectAId, projectBId]);
});

after(async () => {
  await pool.query("update projects set current_published_revision_id=null,current_draft_revision_id=null where id = any($1::uuid[])", [[projectAId, projectBId]]);
  await pool.query("delete from project_revisions where project_id = any($1::uuid[])", [[projectAId, projectBId]]);
  await pool.query("delete from projects where external_key = any($1::text[])", [projectExternalKeys]);
  await pool.query("delete from media_assets where id=$1", [mediaAssetId]);
  await pool.query("delete from technologies where id=$1", [technologyId]);
  await pool.end();
});

test("normalized project links repository replaces and reads project-scoped links", async () => {
  assert.deepEqual(await readNormalizedProjectLinks(pool, projectAId), []);

  await replaceNormalizedProjectLinks(pool, projectAId, initialLinks);
  assert.deepEqual(await linkCounts(projectAId), { structural: 2, translations: 4 });
  const initialRows = await pool.query<{ id: string; url: string; sort_order: number; locale: string }>(`
    select link.id, link.url, link.sort_order, translation.locale
    from project_links link join project_link_translations translation on translation.project_link_id = link.id
    where link.project_id = $1 order by link.sort_order, translation.locale
  `, [projectAId]);
  assert.deepEqual(new Set(initialRows.rows.map((row) => row.id)), new Set(initialLinks.map((link) => link.id)));
  assert.deepEqual(new Set(initialRows.rows.map((row) => row.url)), new Set(initialLinks.map((link) => link.url)));
  assert.deepEqual(new Set(initialRows.rows.map((row) => row.sort_order)), new Set([10, 20]));
  assert.deepEqual(new Set(initialRows.rows.map((row) => row.locale)), new Set(["ru", "en"]));
  assert.deepEqual(await readNormalizedProjectLinks(pool, projectAId), initialLinks);

  await replaceNormalizedProjectLinks(pool, projectAId, [...initialLinks].reverse());
  assert.deepEqual(await readNormalizedProjectLinks(pool, projectAId), initialLinks);

  const editedLinks: ProjectLink[] = [
    { ...initialLinks[0]!, url: "https://example.com/a-edited", label: { ...initialLinks[0]!.label, ru: "Открыть изменённый проект" } },
    { ...initialLinks[1]!, label: { ...initialLinks[1]!.label, en: "Documentation updated" } },
    { id: "21000000-0000-4000-8000-000000000003", url: "https://example.com/contact", sortOrder: 30, label: { ru: "Связаться", en: "Contact" } },
  ];
  await replaceNormalizedProjectLinks(pool, projectAId, editedLinks);
  assert.deepEqual(await linkCounts(projectAId), { structural: 3, translations: 6 });
  assert.deepEqual(await readNormalizedProjectLinks(pool, projectAId), editedLinks);
  const oldValues = await pool.query("select 1 from project_links link left join project_link_translations translation on translation.project_link_id = link.id where link.project_id = $1 and (link.url = $2 or translation.label = any($3::text[]))", [projectAId, initialLinks[0]!.url, [initialLinks[0]!.label.ru, initialLinks[1]!.label.en]]);
  assert.equal(oldValues.rowCount, 0);

  const reorderedLinks: ProjectLink[] = [
    { ...editedLinks[1]!, sortOrder: 10 },
    { ...editedLinks[0]!, sortOrder: 20 },
    editedLinks[2]!,
  ];
  await replaceNormalizedProjectLinks(pool, projectAId, reorderedLinks);
  assert.deepEqual(await readNormalizedProjectLinks(pool, projectAId), reorderedLinks);

  const remainingLinks = [reorderedLinks[0]!, reorderedLinks[2]!];
  await replaceNormalizedProjectLinks(pool, projectAId, remainingLinks);
  assert.deepEqual(await linkCounts(projectAId), { structural: 2, translations: 4 });
  assert.equal((await pool.query("select 1 from project_links where id = $1", [reorderedLinks[1]!.id])).rowCount, 0);
  assert.equal((await pool.query("select 1 from project_link_translations where project_link_id = $1", [reorderedLinks[1]!.id])).rowCount, 0);
  assert.deepEqual(await readNormalizedProjectLinks(pool, projectAId), remainingLinks);

  await replaceNormalizedProjectLinks(pool, projectAId, remainingLinks);
  await replaceNormalizedProjectLinks(pool, projectAId, remainingLinks);
  assert.deepEqual(await linkCounts(projectAId), { structural: 2, translations: 4 });
  assert.deepEqual(await readNormalizedProjectLinks(pool, projectAId), remainingLinks);

  await replaceNormalizedProjectLinks(pool, projectBId, projectBLinks);
  await replaceNormalizedProjectLinks(pool, projectAId, remainingLinks);
  assert.deepEqual(await linkCounts(projectBId), { structural: 1, translations: 2 });
  assert.deepEqual(await readNormalizedProjectLinks(pool, projectBId), projectBLinks);

  const duplicateOrders = await pool.query("select project_id, sort_order, count(*) from project_links group by project_id, sort_order having count(*) > 1");
  const duplicateTranslations = await pool.query("select project_link_id, locale, count(*) from project_link_translations group by project_link_id, locale having count(*) > 1");
  assert.equal(duplicateOrders.rowCount, 0);
  assert.equal(duplicateTranslations.rowCount, 0);

  await replaceNormalizedProjectLinks(pool, projectAId, []);
  assert.deepEqual(await linkCounts(projectAId), { structural: 0, translations: 0 });
  assert.deepEqual(await readNormalizedProjectLinks(pool, projectAId), []);
  assert.deepEqual(await linkCounts(projectBId), { structural: 1, translations: 2 });
  assert.deepEqual(await readNormalizedProjectLinks(pool, projectBId), projectBLinks);
});

test("normalized project links read detects persisted missing locale translations", async () => {
  await clearLinks();
  const missingRuId = "24000000-0000-4000-8000-000000000001";
  const missingEnId = "24000000-0000-4000-8000-000000000002";
  await pool.query("insert into project_links (id,project_id,url,sort_order,created_at,updated_at) values ($1,$2,$3,$4,now(),now()),($5,$2,$6,$7,now(),now())", [missingRuId, projectAId, "https://example.com/missing-ru", 10, missingEnId, "https://example.com/missing-en", 20]);
  await pool.query("insert into project_link_translations (project_link_id,locale,label) values ($1,'en','English only'),($2,'ru','Только русский')", [missingRuId, missingEnId]);
  await assertIntegrityError(() => readNormalizedProjectLinks(pool, projectAId), projectAId, missingRuId);
  await pool.query("delete from project_links where id=$1", [missingRuId]);
  await assertIntegrityError(() => readNormalizedProjectLinks(pool, projectAId), projectAId, missingEnId);
});

test("normalized project links read validates corrupt executor rows and preserves infrastructure errors", async () => {
  const linkId = "24000000-0000-4000-8000-000000000003";
  const validRu = { id: linkId, url: "https://example.com/raw", sort_order: 10, locale: "ru", label: "Русский" };
  const validEn = { id: linkId, url: "https://example.com/raw", sort_order: 10, locale: "en", label: "English" };
  for (const rows of [
    [{ ...validRu, url: "" }, validEn],
    [{ ...validRu, label: "" }, validEn],
    [validRu, { ...validEn, label: "" }],
    [validRu, { ...validEn, locale: "fr" }],
    [validRu, { ...validRu }],
    [validRu, validEn, { ...validRu, id: "24000000-0000-4000-8000-000000000004", sort_order: 10 }, { ...validEn, id: "24000000-0000-4000-8000-000000000004", sort_order: 10 }],
  ]) await assertIntegrityError(() => readNormalizedProjectLinks(rawRowsExecutor(rows), projectAId), projectAId, linkId);

  const infrastructureError = new Error("socket reset");
  const failingExecutor = { query: async () => { throw infrastructureError; } };
  await assert.rejects(() => readNormalizedProjectLinks(failingExecutor, projectAId), (error: unknown) => {
    assert.equal(error, infrastructureError);
    assert.equal(error instanceof ProjectLinkContentIntegrityError, false);
    return true;
  });
});

test("normalized project links have no legacy fallback and preserve legacy columns", async () => {
  await clearLinks();
  const legacyBefore = await pool.query(`
    select p.primary_url,p.primary_link_type,p.secondary_url,p.secondary_link_type,t.locale,t.primary_action_label,t.secondary_action_label
    from projects p join project_translations t on t.project_id=p.id where p.id=$1 order by t.locale
  `, [projectAId]);
  assert.deepEqual(await readNormalizedProjectLinks(pool, projectAId), []);

  const editedLinks: ProjectLink[] = [
    { ...initialLinks[0]!, url: "https://example.com/legacy-isolated", label: { ru: "Новая ссылка", en: "New link" } },
    { ...initialLinks[1]!, sortOrder: 30 },
  ];
  await replaceNormalizedProjectLinks(pool, projectAId, initialLinks);
  await replaceNormalizedProjectLinks(pool, projectAId, editedLinks);
  await replaceNormalizedProjectLinks(pool, projectAId, [...editedLinks].reverse());
  await replaceNormalizedProjectLinks(pool, projectAId, [editedLinks[0]!]);
  await replaceNormalizedProjectLinks(pool, projectAId, []);
  const legacyAfter = await pool.query(`
    select p.primary_url,p.primary_link_type,p.secondary_url,p.secondary_link_type,t.locale,t.primary_action_label,t.secondary_action_label
    from projects p join project_translations t on t.project_id=p.id where p.id=$1 order by t.locale
  `, [projectAId]);
  assert.deepEqual(legacyAfter.rows, legacyBefore.rows);
});

test("normalized project links replacement rolls back with caller transaction and leaves other blocks untouched", async () => {
  await clearLinks();
  await pool.query("delete from project_features where project_id=$1", [projectAId]);
  await pool.query("delete from project_notes where project_id=$1", [projectAId]);
  await pool.query("delete from project_technologies where project_id=$1", [projectAId]);
  await pool.query("delete from project_media where project_id=$1", [projectAId]);
  await pool.query("update projects set current_published_revision_id=null,current_draft_revision_id=null where id=$1", [projectAId]);
  await pool.query("delete from project_revisions where project_id=$1", [projectAId]);
  await pool.query("delete from media_assets where id=$1", [mediaAssetId]);
  await pool.query("delete from technologies where id=$1", [technologyId]);
  await pool.query("insert into project_features (id,project_id,sort_order,created_at,updated_at) values ($1,$2,10,now(),now())", [featureId, projectAId]);
  await pool.query("insert into project_feature_translations (feature_id,locale,text) values ($1,'ru','Функция'),($1,'en','Feature')", [featureId]);
  await pool.query("insert into project_notes (id,project_id,sort_order,created_at,updated_at) values ($1,$2,10,now(),now())", [noteId, projectAId]);
  await pool.query("insert into project_note_translations (note_id,locale,text) values ($1,'ru','Заметка'),($1,'en','Note')", [noteId]);
  await pool.query("insert into technologies (id,slug,name,sort_order,is_active,created_at,updated_at) values ($1,'project-links-isolation-tech','Isolation technology',9001,true,now(),now())", [technologyId]);
  await pool.query("insert into project_technologies (project_id,technology_id,sort_order) values ($1,$2,10)", [projectAId, technologyId]);
  await pool.query("insert into media_assets (id,external_key,path,role,sort_order,source_type,status,created_at,updated_at) values ($1,'project-links-isolation-media','images/project-links-isolation.webp','gallery',9001,'legacy','active',now(),now())", [mediaAssetId]);
  await pool.query("insert into project_media (project_id,media_asset_id,sort_order,orientation,presentation,gallery_kind) values ($1,$2,10,'horizontal','contain','desktop')", [projectAId, mediaAssetId]);
  await pool.query("insert into project_revisions (id,project_id,revision_number,revision_type,content,created_at,updated_at) values ($1,$2,1,'published',$3::jsonb,now(),now())", [revisionId, projectAId, JSON.stringify({ kind: "project-links-isolation", value: 1 })]);
  await pool.query("update projects set current_published_revision_id=$2,current_draft_revision_id=$2 where id=$1", [projectAId, revisionId]);
  await replaceNormalizedProjectLinks(pool, projectAId, initialLinks);
  await replaceNormalizedProjectLinks(pool, projectBId, projectBLinks);
  const linksBefore = await pool.query("select link.id,link.url,link.sort_order,translation.locale,translation.label from project_links link join project_link_translations translation on translation.project_link_id=link.id where link.project_id=$1 order by link.sort_order,translation.locale", [projectAId]);
  const readBefore = await readNormalizedProjectLinks(pool, projectAId);
  const blocksBefore = await otherBlocksSnapshot();
  const projectBBefore = await readNormalizedProjectLinks(pool, projectBId);
  const replacementLinks: ProjectLink[] = [{ id: "25000000-0000-4000-8000-000000000001", url: "https://example.com/rollback", sortOrder: 10, label: { ru: "Откат", en: "Rollback" } }];
  const client = await pool.connect();
  try {
    await client.query("begin");
    await replaceNormalizedProjectLinks(client, projectAId, replacementLinks);
    assert.deepEqual(await readNormalizedProjectLinks(client, projectAId), replacementLinks);
    throw new Error("test-only rollback");
  } catch (error) {
    await client.query("rollback");
    assert.equal((error as Error).message, "test-only rollback");
  } finally {
    client.release();
  }
  const linksAfter = await pool.query("select link.id,link.url,link.sort_order,translation.locale,translation.label from project_links link join project_link_translations translation on translation.project_link_id=link.id where link.project_id=$1 order by link.sort_order,translation.locale", [projectAId]);
  assert.deepEqual(linksAfter.rows, linksBefore.rows);
  assert.deepEqual(await readNormalizedProjectLinks(pool, projectAId), readBefore);
  assert.equal((await pool.query("select 1 from project_links where id=$1", [replacementLinks[0]!.id])).rowCount, 0);
  assert.deepEqual(await readNormalizedProjectLinks(pool, projectBId), projectBBefore);
  assert.deepEqual(await otherBlocksSnapshot(), blocksBefore);

  await replaceNormalizedProjectLinks(pool, projectAId, replacementLinks);
  assert.deepEqual(await otherBlocksSnapshot(), blocksBefore);
});
