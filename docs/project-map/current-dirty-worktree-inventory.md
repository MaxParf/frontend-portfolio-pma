# Current dirty worktree inventory

**Application worktree baseline before STABILIZATION-01:** 130 entries (54 modified tracked, 76 untracked, 0 staged). **Current worktree after documentation additions:** 133 entries (54 modified tracked, 79 untracked, 0 staged). Source manifests: `/tmp/stabilization-01-inventory/` and `/tmp/stabilization-01a-doc-corrections/`.

Each current `git status --short` entry appears once below; untracked directories are represented once, matching Git output rather than expanding contained files. No entry is accepted or approved for commit by this inventory.

| Path | Status | Layer | Likely change set | Dependencies / runtime-data impact | Recommended action |
|---|---|---|---|---|---|
| `.gitignore` | M | frontend/config | Existing root ignore policy | no runtime change in this task | UNKNOWN_REQUIRES_ANALYSIS |
| `README.md` | M | frontend/config | Frontend/config | public runtime | UNKNOWN_REQUIRES_ANALYSIS |
| `backend/.env.example` | M | backend | Backend/locale lifecycle | DB/API consumers | NEEDS_INDEPENDENT_QA |
| `backend/Dockerfile` | M | backend | Backend/locale lifecycle | DB/API consumers | NEEDS_INDEPENDENT_QA |
| `backend/README.md` | M | backend | Backend/locale lifecycle | DB/API consumers | NEEDS_INDEPENDENT_QA |
| `backend/drizzle/meta/_journal.json` | M | database | Migration/runtime foundation | schema/migration/verifier dependency | NEEDS_INDEPENDENT_QA |
| `backend/package-lock.json` | M | backend | Backend/locale lifecycle | DB/API consumers | NEEDS_INDEPENDENT_QA |
| `backend/package.json` | M | backend | Backend/locale lifecycle | DB/API consumers | NEEDS_INDEPENDENT_QA |
| `backend/scripts/migrate.ts` | M | backend | Backend/locale lifecycle | DB/API consumers | NEEDS_INDEPENDENT_QA |
| `backend/scripts/run-isolated-tests.ts` | M | backend | Backend/locale lifecycle | DB/API consumers | NEEDS_INDEPENDENT_QA |
| `backend/scripts/seed-projects.ts` | M | backend | Backend/locale lifecycle | DB/API consumers | NEEDS_INDEPENDENT_QA |
| `backend/src/db/schema/index.ts` | M | database | Migration/runtime foundation | schema/migration/verifier dependency | NEEDS_INDEPENDENT_QA |
| `backend/src/db/schema/project-media.ts` | M | database | Migration/runtime foundation | schema/migration/verifier dependency | NEEDS_INDEPENDENT_QA |
| `backend/src/db/schema/project-translations.ts` | M | database | Migration/runtime foundation | schema/migration/verifier dependency | NEEDS_INDEPENDENT_QA |
| `backend/src/modules/admin-projects/admin-project.repository.ts` | M | backend | Backend/locale lifecycle | DB/API consumers | NEEDS_INDEPENDENT_QA |
| `backend/src/modules/admin-projects/admin-project.routes.ts` | M | backend | Backend/locale lifecycle | DB/API consumers | NEEDS_INDEPENDENT_QA |
| `backend/src/modules/admin-projects/project-draft.repository.ts` | M | backend | Backend/locale lifecycle | DB/API consumers | NEEDS_INDEPENDENT_QA |
| `backend/src/modules/admin-projects/project-draft.schemas.ts` | M | backend | Backend/locale lifecycle | DB/API consumers | NEEDS_INDEPENDENT_QA |
| `backend/src/modules/projects/project.mapper.ts` | M | backend | Backend/locale lifecycle | DB/API consumers | NEEDS_INDEPENDENT_QA |
| `backend/src/modules/projects/project.repository.ts` | M | backend | Backend/locale lifecycle | DB/API consumers | NEEDS_INDEPENDENT_QA |
| `backend/src/modules/projects/project.schemas.ts` | M | backend | Backend/locale lifecycle | DB/API consumers | NEEDS_INDEPENDENT_QA |
| `backend/src/modules/projects/project.service.ts` | M | backend | Backend/locale lifecycle | DB/API consumers | NEEDS_INDEPENDENT_QA |
| `backend/tests/auth.integration.test.ts` | M | test | Test infrastructure | source contracts | KEEP_PENDING_REVIEW |
| `backend/tests/production-compose.unit.test.ts` | M | test | Test infrastructure | source contracts | KEEP_PENDING_REVIEW |
| `backend/tests/projects.integration.test.ts` | M | test | Test infrastructure | source contracts | KEEP_PENDING_REVIEW |
| `backend/tests/projects.unit.test.ts` | M | test | Test infrastructure | source contracts | KEEP_PENDING_REVIEW |
| `backend/tsconfig.json` | M | backend | Backend/locale lifecycle | DB/API consumers | NEEDS_INDEPENDENT_QA |
| `cms/Dockerfile` | M | CMS | CMS authoring/auth | browser/manual acceptance | NEEDS_INDEPENDENT_QA |
| `cms/README.md` | M | CMS | CMS authoring/auth | browser/manual acceptance | NEEDS_INDEPENDENT_QA |
| `cms/package.json` | M | CMS | CMS authoring/auth | browser/manual acceptance | NEEDS_INDEPENDENT_QA |
| `cms/src/api/client.ts` | M | CMS | CMS authoring/auth | browser/manual acceptance | NEEDS_INDEPENDENT_QA |
| `cms/src/api/projects.ts` | M | CMS | CMS authoring/auth | browser/manual acceptance | NEEDS_INDEPENDENT_QA |
| `cms/src/api/types.ts` | M | CMS | CMS authoring/auth | browser/manual acceptance | NEEDS_INDEPENDENT_QA |
| `cms/src/components/AccessibleDialog.tsx` | M | CMS | CMS authoring/auth | browser/manual acceptance | NEEDS_INDEPENDENT_QA |
| `cms/src/components/ActivityPanel.tsx` | M | CMS | CMS authoring/auth | browser/manual acceptance | NEEDS_INDEPENDENT_QA |
| `cms/src/components/App.test.tsx` | M | CMS | CMS authoring/auth | browser/manual acceptance | NEEDS_INDEPENDENT_QA |
| `cms/src/components/App.tsx` | M | CMS | CMS authoring/auth | browser/manual acceptance | NEEDS_INDEPENDENT_QA |
| `cms/src/components/CmsShell.tsx` | M | CMS | CMS authoring/auth | browser/manual acceptance | NEEDS_INDEPENDENT_QA |
| `cms/src/components/DesktopGate.tsx` | M | CMS | CMS authoring/auth | browser/manual acceptance | NEEDS_INDEPENDENT_QA |
| `cms/src/components/LoginScreen.tsx` | M | CMS | CMS authoring/auth | browser/manual acceptance | NEEDS_INDEPENDENT_QA |
| `cms/src/components/ProjectInspector.tsx` | M | CMS | CMS authoring/auth | browser/manual acceptance | NEEDS_INDEPENDENT_QA |
| `cms/src/components/ProjectTree.tsx` | M | CMS | CMS authoring/auth | browser/manual acceptance | NEEDS_INDEPENDENT_QA |
| `cms/src/components/PublishedPreview.tsx` | M | CMS | CMS authoring/auth | browser/manual acceptance | NEEDS_INDEPENDENT_QA |
| `cms/src/styles/cms.css` | M | CMS | CMS authoring/auth | browser/manual acceptance | NEEDS_INDEPENDENT_QA |
| `cms/tsconfig.json` | M | CMS | CMS authoring/auth | browser/manual acceptance | NEEDS_INDEPENDENT_QA |
| `cms/vite.config.ts` | M | CMS | CMS authoring/auth | browser/manual acceptance | NEEDS_INDEPENDENT_QA |
| `compose.portfolio.production.yml` | M | frontend/config | Frontend/config | public runtime | UNKNOWN_REQUIRES_ANALYSIS |
| `compose.portfolio.yml` | M | frontend/config | Frontend/config | public runtime | UNKNOWN_REQUIRES_ANALYSIS |
| `mappers/project-api-mapper.js` | M | frontend/config | Frontend/config | public runtime | UNKNOWN_REQUIRES_ANALYSIS |
| `package.json` | M | frontend/config | Frontend/config | public runtime | UNKNOWN_REQUIRES_ANALYSIS |
| `runtime-config.js` | M | frontend/config | Frontend/config | public runtime | UNKNOWN_REQUIRES_ANALYSIS |
| `style.css` | M | frontend/config | Frontend/config | public runtime | UNKNOWN_REQUIRES_ANALYSIS |
| `style.scss` | M | frontend/config | Frontend/config | public runtime | UNKNOWN_REQUIRES_ANALYSIS |
| `tests/projects-source.test.mjs` | M | test | Test infrastructure | source contracts | KEEP_PENDING_REVIEW |
| `AGENTS.md` | ?? | documentation/process | DOC-BASELINE-01 | no runtime or DB impact | DOCUMENTATION_ONLY |
| `backend/drizzle/0006_project_media_presentation.sql` | ?? | database | Migration/runtime foundation | schema/migration/verifier dependency | NEEDS_INDEPENDENT_QA |
| `backend/drizzle/0007_project_media_gallery_kind.sql` | ?? | database | Migration/runtime foundation | schema/migration/verifier dependency | NEEDS_INDEPENDENT_QA |
| `backend/drizzle/0008_project_content_blocks.sql` | ?? | database | Migration/runtime foundation | schema/migration/verifier dependency | NEEDS_INDEPENDENT_QA |
| `backend/drizzle/0009_project_links.sql` | ?? | database | Migration/runtime foundation | schema/migration/verifier dependency | NEEDS_INDEPENDENT_QA |
| `backend/drizzle/0010_backfill_legacy_project_media_orientation.sql` | ?? | database | Migration/runtime foundation | schema/migration/verifier dependency | NEEDS_INDEPENDENT_QA |
| `backend/drizzle/0011_correct_fake_draft_baselines.sql` | ?? | database | Migration/runtime foundation | schema/migration/verifier dependency | NEEDS_INDEPENDENT_QA |
| `backend/drizzle/0012_locale_publication_revisions.sql` | ?? | database | Migration/runtime foundation | schema/migration/verifier dependency | NEEDS_INDEPENDENT_QA |
| `backend/drizzle/0013_locale_publication_state.sql` | ?? | database | Migration/runtime foundation | schema/migration/verifier dependency | NEEDS_INDEPENDENT_QA |
| `backend/drizzle/0014_locale_public_projection.sql` | ?? | database | Migration/runtime foundation | schema/migration/verifier dependency | NEEDS_INDEPENDENT_QA |
| `backend/drizzle/0015_locale_publication_state_backfill.sql` | ?? | database | Migration/runtime foundation | schema/migration/verifier dependency | NEEDS_INDEPENDENT_QA |
| `backend/scripts/verify-clean-content-links-migrations.ts` | ?? | backend | Backend/locale lifecycle | DB/API consumers | NEEDS_INDEPENDENT_QA |
| `backend/scripts/verify-locale-publication-lifecycle.ts` | ?? | backend | Backend/locale lifecycle | DB/API consumers | NEEDS_INDEPENDENT_QA |
| `backend/scripts/verify-locale-publication-projections.ts` | ?? | backend | Backend/locale lifecycle | DB/API consumers | NEEDS_INDEPENDENT_QA |
| `backend/scripts/verify-locale-publications.ts` | ?? | backend | Backend/locale lifecycle | DB/API consumers | NEEDS_INDEPENDENT_QA |
| `backend/scripts/verify-media-orphans.ts` | ?? | backend | Backend/locale lifecycle | DB/API consumers | NEEDS_INDEPENDENT_QA |
| `backend/scripts/verify-project-lifecycle.ts` | ?? | backend | Backend/locale lifecycle | DB/API consumers | NEEDS_INDEPENDENT_QA |
| `backend/scripts/verify-published-projections.ts` | ?? | backend | Backend/locale lifecycle | DB/API consumers | NEEDS_INDEPENDENT_QA |
| `backend/scripts/verify-s5-locale-migration-rehearsal.ts` | ?? | backend | Backend/locale lifecycle | DB/API consumers | NEEDS_INDEPENDENT_QA |
| `backend/src/db/schema/project-content-items.ts` | ?? | database | Migration/runtime foundation | schema/migration/verifier dependency | NEEDS_INDEPENDENT_QA |
| `backend/src/db/schema/project-links.ts` | ?? | database | Migration/runtime foundation | schema/migration/verifier dependency | NEEDS_INDEPENDENT_QA |
| `backend/src/db/schema/project-locale-publications.ts` | ?? | database | Migration/runtime foundation | schema/migration/verifier dependency | NEEDS_INDEPENDENT_QA |
| `backend/src/modules/admin-projects/legacy-project-content.ts` | ?? | backend | Backend/locale lifecycle | DB/API consumers | NEEDS_INDEPENDENT_QA |
| `backend/src/modules/admin-projects/locale-project-publish.service.ts` | ?? | backend | Backend/locale lifecycle | DB/API consumers | NEEDS_INDEPENDENT_QA |
| `backend/src/modules/admin-projects/locale-publication-backfill.ts` | ?? | backend | Backend/locale lifecycle | DB/API consumers | NEEDS_INDEPENDENT_QA |
| `backend/src/modules/admin-projects/locale-publication-domain.ts` | ?? | backend | Backend/locale lifecycle | DB/API consumers | NEEDS_INDEPENDENT_QA |
| `backend/src/modules/admin-projects/locale-publication-materializer.ts` | ?? | backend | Backend/locale lifecycle | DB/API consumers | NEEDS_INDEPENDENT_QA |
| `backend/src/modules/admin-projects/locale-publication-state.repository.ts` | ?? | backend | Backend/locale lifecycle | DB/API consumers | NEEDS_INDEPENDENT_QA |
| `backend/src/modules/admin-projects/project-content-fixtures.ts` | ?? | backend | Backend/locale lifecycle | DB/API consumers | NEEDS_INDEPENDENT_QA |
| `backend/src/modules/admin-projects/project-links.repository.ts` | ?? | backend | Backend/locale lifecycle | DB/API consumers | NEEDS_INDEPENDENT_QA |
| `backend/src/modules/admin-projects/project-links.ts` | ?? | backend | Backend/locale lifecycle | DB/API consumers | NEEDS_INDEPENDENT_QA |
| `backend/src/modules/admin-projects/published-projection-verifier.ts` | ?? | backend | Backend/locale lifecycle | DB/API consumers | NEEDS_INDEPENDENT_QA |
| `backend/src/modules/admin-projects/verifiers/` | ?? | backend | Backend/locale lifecycle | DB/API consumers | NEEDS_INDEPENDENT_QA |
| `backend/src/modules/media/media-presentation.ts` | ?? | backend | Backend/locale lifecycle | DB/API consumers | NEEDS_INDEPENDENT_QA |
| `backend/src/modules/media/project-gallery-kind.ts` | ?? | backend | Backend/locale lifecycle | DB/API consumers | NEEDS_INDEPENDENT_QA |
| `backend/src/modules/projects/project-content.types.ts` | ?? | backend | Backend/locale lifecycle | DB/API consumers | NEEDS_INDEPENDENT_QA |
| `backend/src/modules/public-projects/` | ?? | backend | Backend/locale lifecycle | DB/API consumers | NEEDS_INDEPENDENT_QA |
| `backend/tests/helpers/` | ?? | test | Test infrastructure | source contracts | KEEP_PENDING_REVIEW |
| `backend/tests/legacy-project-content.unit.test.ts` | ?? | test | Test infrastructure | source contracts | KEEP_PENDING_REVIEW |
| `backend/tests/locale-corruption-feasibility.unit.test.ts` | ?? | test | Test infrastructure | source contracts | KEEP_PENDING_REVIEW |
| `backend/tests/locale-inspector-import-boundary.unit.test.ts` | ?? | test | Test infrastructure | source contracts | KEEP_PENDING_REVIEW |
| `backend/tests/locale-project-publish.integration.test.ts` | ?? | test | Test infrastructure | source contracts | KEEP_PENDING_REVIEW |
| `backend/tests/locale-projection-deletion-lifecycle.integration.test.ts` | ?? | test | Test infrastructure | source contracts | KEEP_PENDING_REVIEW |
| `backend/tests/locale-projection-feasibility-registry.unit.test.ts` | ?? | test | Test infrastructure | source contracts | KEEP_PENDING_REVIEW |
| `backend/tests/locale-projection-fixture.integration.test.ts` | ?? | test | Test infrastructure | source contracts | KEEP_PENDING_REVIEW |
| `backend/tests/locale-projection-header-child-ownership.integration.test.ts` | ?? | test | Test infrastructure | source contracts | KEEP_PENDING_REVIEW |
| `backend/tests/locale-projection-links-matrix.integration.test.ts` | ?? | test | Test infrastructure | source contracts | KEEP_PENDING_REVIEW |
| `backend/tests/locale-projection-media-basic-matrix.integration.test.ts` | ?? | test | Test infrastructure | source contracts | KEEP_PENDING_REVIEW |
| `backend/tests/locale-projection-media-constraints.integration.test.ts` | ?? | test | Test infrastructure | source contracts | KEEP_PENDING_REVIEW |
| `backend/tests/locale-projection-media-order-dimensions-matrix.integration.test.ts` | ?? | test | Test infrastructure | source contracts | KEEP_PENDING_REVIEW |
| `backend/tests/locale-projection-verifier-matrix.integration.test.ts` | ?? | test | Test infrastructure | source contracts | KEEP_PENDING_REVIEW |
| `backend/tests/locale-public-project.repository.integration.test.ts` | ?? | test | Test infrastructure | source contracts | KEEP_PENDING_REVIEW |
| `backend/tests/locale-publication-domain.unit.test.ts` | ?? | test | Test infrastructure | source contracts | KEEP_PENDING_REVIEW |
| `backend/tests/locale-publication-semantic-diff.unit.test.ts` | ?? | test | Test infrastructure | source contracts | KEEP_PENDING_REVIEW |
| `backend/tests/locale-publication-state-revision-ownership.integration.test.ts` | ?? | test | Test infrastructure | source contracts | KEEP_PENDING_REVIEW |
| `backend/tests/locale-state-lifecycle-feasibility-registry.unit.test.ts` | ?? | test | Test infrastructure | source contracts | KEEP_PENDING_REVIEW |
| `backend/tests/locale-state-lifecycle-feasibility.integration.test.ts` | ?? | test | Test infrastructure | source contracts | KEEP_PENDING_REVIEW |
| `backend/tests/locale-verifier-media-checksum.unit.test.ts` | ?? | test | Test infrastructure | source contracts | KEEP_PENDING_REVIEW |
| `backend/tests/locale-verifier-media-diff.unit.test.ts` | ?? | test | Test infrastructure | source contracts | KEEP_PENDING_REVIEW |
| `backend/tests/locale-verifier-media-mapper.unit.test.ts` | ?? | test | Test infrastructure | source contracts | KEEP_PENDING_REVIEW |
| `backend/tests/locale-verifier-media-repeated-asset.integration.test.ts` | ?? | test | Test infrastructure | source contracts | KEEP_PENDING_REVIEW |
| `backend/tests/project-links.repository.integration.test.ts` | ?? | test | Test infrastructure | source contracts | KEEP_PENDING_REVIEW |
| `backend/tests/project-locale-publish-concurrency.integration.test.ts` | ?? | test | Test infrastructure | source contracts | KEEP_PENDING_REVIEW |
| `backend/tests/project-save-locale-publication-concurrency.integration.test.ts` | ?? | test | Test infrastructure | source contracts | KEEP_PENDING_REVIEW |
| `backend/tests/project-write-concurrency.integration.test.ts` | ?? | test | Test infrastructure | source contracts | KEEP_PENDING_REVIEW |
| `backend/tests/schema12-save-http.integration.test.ts` | ?? | test | Test infrastructure | source contracts | KEEP_PENDING_REVIEW |
| `backend/tests/sql-query-recorder.unit.test.ts` | ?? | test | Test infrastructure | source contracts | KEEP_PENDING_REVIEW |
| `backend/tests/temporary-schema16-database.integration.test.ts` | ?? | test | Test infrastructure | source contracts | KEEP_PENDING_REVIEW |
| `backend/tests/temporary-schema16-database.unit.test.ts` | ?? | test | Test infrastructure | source contracts | KEEP_PENDING_REVIEW |
| `backend/tests/temporary-schema16-global-cleanup.integration.test.ts` | ?? | test | Test infrastructure | source contracts | KEEP_PENDING_REVIEW |
| `cms/src/components/ProjectInspector.test.tsx` | ?? | CMS | CMS authoring/auth | browser/manual acceptance | NEEDS_INDEPENDENT_QA |
| `cms/src/components/ProjectTree.test.tsx` | ?? | CMS | CMS authoring/auth | browser/manual acceptance | NEEDS_INDEPENDENT_QA |
| `cms/src/components/PublishedPreview.test.tsx` | ?? | CMS | CMS authoring/auth | browser/manual acceptance | NEEDS_INDEPENDENT_QA |
| `cms/src/components/project-display-title.ts` | ?? | CMS | CMS authoring/auth | browser/manual acceptance | NEEDS_INDEPENDENT_QA |
| `contracts/` | ?? | frontend/config | Frontend/config | public runtime | UNKNOWN_REQUIRES_ANALYSIS |
| `docs/project-map/` | ?? | documentation/process | DOC-BASELINE-01 | no runtime or DB impact | DOCUMENTATION_ONLY |
| `docs/review-package-template/` | ?? | documentation/process | Review package template | no runtime or DB impact; independent QA and owner authorization before docs checkpoint | DOCUMENTATION_ONLY |
| `package-lock.json` | ?? | frontend/config | Frontend/config | public runtime | UNKNOWN_REQUIRES_ANALYSIS |
| `style.css.map` | ?? | frontend/config | Frontend/config | public runtime | UNKNOWN_REQUIRES_ANALYSIS |
