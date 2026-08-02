# Working rules

This repository is a single-owner public portfolio and its CMS. Before changing an existing file, record a dependency-impact note: importers/imports, exported contract consumers, routes/DTO/tables/migrations/tests/UI flows, and adjacent regression risk. Start from product intent, user flow, UI result, and invariants before choosing an implementation.

Use narrow search/replace patches, local helpers, or new small functions. Do not rewrite a file wholesale without documented structural need and owner approval. Preserve existing signatures, exports, DTOs, route paths, enums, DB semantics, and shared utilities unless a dependency analysis, compatibility plan, regression tests, and explicit rationale support the change.

Internal lifecycle mechanisms (revisions, draft/published pointers, locale publications, projections, generations, locks, backfills) are not user actions. CMS remains an authoring tool: navigation at left, editable form in the centre, preview at right. Product changes require owner manual acceptance; developer status ends at `IMPLEMENTATION_READY_FOR_REVIEW`.

Never reset, stash, restore, clean, rebase, merge, commit, push, deploy, or reorder a dirty worktree without explicit owner approval. Do not delete volumes, run `docker compose down -v`, alter production/VPS/remote DBs, destructive SQL, existing migrations, published revisions, locale publications, or public projections. Every local mutation needs a safety analysis, isolated fixture where applicable, preservation proof, and task report.

Quality gates are: A static (typecheck/build/check/diff-check); B automated unit/integration/API/lifecycle/verifier/concurrency tests; C runtime images, running-image proof, health, source/bundle/API smoke; D owner manual acceptance. Prepare `/tmp/<task-id>-review/` with contract, dependency analysis, changed files, diff, results, manual plan, status, and developer report. Update only affected factual maps in `docs/project-map/` after accepted work.

Comments document invariants, non-obvious lifecycle/concurrency/preservation constraints, or why a tempting option is forbidden; do not narrate syntax. Keep one primary result per task; record neighbouring problems separately.
