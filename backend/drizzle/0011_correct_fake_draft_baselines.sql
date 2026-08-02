-- Correct only the never-published baseline pattern created by the old create flow.
-- Revision content and timestamps remain immutable.
do $$
declare unresolved integer;
begin
  update project_revisions r
  set revision_type = 'draft'
  from projects p
  where p.id = r.project_id
    and p.status = 'draft'
    and p.current_draft_revision_id is null
    and p.current_published_revision_id = r.id
    and p.published_at is null
    and r.revision_type = 'published'
    and not exists (select 1 from project_translations t where t.project_id = p.id);

  update projects p
  set current_draft_revision_id = p.current_published_revision_id,
      current_published_revision_id = null
  where p.status = 'draft'
    and p.current_draft_revision_id is null
    and p.current_published_revision_id is not null
    and p.published_at is null
    and not exists (select 1 from project_translations t where t.project_id = p.id)
    and exists (select 1 from project_revisions r where r.id = p.current_published_revision_id and r.project_id = p.id and r.revision_type = 'draft');

  select count(*) into unresolved
  from projects p
  join project_revisions r on r.id = p.current_published_revision_id
  where p.status = 'draft'
    and p.current_draft_revision_id is null
    and p.published_at is null
    and r.revision_type = 'published'
    and not exists (select 1 from project_translations t where t.project_id = p.id);
  if unresolved <> 0 then raise exception 'Unresolved fake draft baselines: %', unresolved; end if;
end $$;
