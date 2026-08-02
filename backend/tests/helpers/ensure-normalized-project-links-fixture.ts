import type pg from "pg";

export async function ensureNormalizedProjectLinksFixture(pool: pg.Pool): Promise<void> {
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
  await pool.query(`
    delete from project_links
    where project_id in (
      select id from projects where external_key in ('construction-management-control-center', 'project-bradbury', 'foodai')
    )
  `);
  await pool.query(`
    with mapping(external_key, slot, id, sort_order) as (values
      ('construction-management-control-center', 'primary', '91000000-0000-4000-8000-000000000001'::uuid, 10),
      ('construction-management-control-center', 'secondary', '91000000-0000-4000-8000-000000000002'::uuid, 20),
      ('project-bradbury', 'primary', '92000000-0000-4000-8000-000000000001'::uuid, 10),
      ('project-bradbury', 'secondary', '92000000-0000-4000-8000-000000000002'::uuid, 20),
      ('foodai', 'primary', '93000000-0000-4000-8000-000000000001'::uuid, 10),
      ('foodai', 'secondary', '93000000-0000-4000-8000-000000000002'::uuid, 20)
    )
    insert into project_links (id, project_id, url, sort_order)
    select mapping.id, project.id,
      case mapping.slot when 'primary' then project.primary_url else project.secondary_url end,
      mapping.sort_order
    from mapping join projects project on project.external_key = mapping.external_key
    where nullif(btrim(case mapping.slot when 'primary' then project.primary_url else project.secondary_url end), '') is not null
  `);
  await pool.query(`
    with mapping(external_key, slot, id) as (values
      ('construction-management-control-center', 'primary', '91000000-0000-4000-8000-000000000001'::uuid),
      ('construction-management-control-center', 'secondary', '91000000-0000-4000-8000-000000000002'::uuid),
      ('project-bradbury', 'primary', '92000000-0000-4000-8000-000000000001'::uuid),
      ('project-bradbury', 'secondary', '92000000-0000-4000-8000-000000000002'::uuid),
      ('foodai', 'primary', '93000000-0000-4000-8000-000000000001'::uuid),
      ('foodai', 'secondary', '93000000-0000-4000-8000-000000000002'::uuid)
    )
    insert into project_link_translations (project_link_id, locale, label)
    select link.id, translation.locale,
      case mapping.slot when 'primary' then translation.primary_action_label else translation.secondary_action_label end
    from mapping
    join projects project on project.external_key = mapping.external_key
    join project_links link on link.id = mapping.id and link.project_id = project.id
    join project_translations translation on translation.project_id = project.id
  `);
}
