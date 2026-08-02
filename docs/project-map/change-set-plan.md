# Change-set plan

## DOC-BASELINE-01

Scope: `AGENTS.md`, `docs/project-map/**`, `docs/review-package-template/**`. Exclusions: backend/CMS application code, migrations, tests, Docker/compose, package manifests, root frontend runtime, generated artifacts, and database state. Prerequisites: corrected inventory, independent QA approval, `git diff --check`, and owner authorization. Status: **BLOCKED_PENDING_DOCUMENTATION_CORRECTIONS** until repeat QA; then **DOCUMENTATION_CHECKPOINT_CANDIDATE**. No commit is created here.

| Set | Dependencies / evidence | Independent commit? | Risk / order |
|---|---|---|---|
| Migration/runtime foundation | drizzle journal, schema, migrator, isolated DB | no, requires clean rehearsal | high; first |
| Shared contracts | `contracts/`, API/CMS parsers | only with consumers | high; after foundation |
| Locale Model C + verifiers | locale tables/materializer/public readers | no | high; isolated verifier proof |
| Temporary DB/test infrastructure | runners/helpers/integration tests | yes after foundation | medium |
| Projection/media verification | media schema/materializer/verifiers | no | high |
| CMS auth | auth client/screens/tests | yes with manual login | high |
| CMS editor and draft deletion | inspector/API/tests | no, product review | high |
| Published-without-draft read-only | admin routes/contracts/CMS | **not acceptable as finished feature** | critical; corrective review first |
| Docker/build | Dockerfiles/compose/config | yes after source gates | medium |
| Documentation/generated artifacts | READMEs/maps/source maps | docs yes; maps need provenance | low/medium |
| Unknown frontend/config | root styles/config/runtime files | no until analyzed | high |

Existing automated evidence is recorded in prior task ledgers; independent QA and owner manual acceptance are missing for product workflows.
