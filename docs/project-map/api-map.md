# API map

| Method | Path | Auth | Handler / mutation | Consumer |
|---|---|---|---|---|
| GET | `/`, `/health` | no | service/health, none | runtime |
| GET | `/api/v1/projects`, `/api/v1/projects/:slug` | no | public repositories, none | public frontend |
| POST | `/api/v1/admin/auth/login` | origin | session create | CMS |
| POST/GET | `/api/v1/admin/auth/logout`, `/me` | session | revoke/read session | CMS |
| GET/POST | `/api/v1/admin/projects` | session | list/create | CMS |
| GET | `/:slug`, `/:slug/editor`, `/:slug/published`, `/:slug/revisions` | session | admin reads | CMS |
| PUT/DELETE | `/:slug/draft` | session | draft write/discard | CMS |
| POST | `/:slug/draft/from-published`, `/:slug/publish` | session | draft clone/publish | CMS |
| POST | `/:slug/media` | session | media write | CMS |
| GET | `/api/v1/media/:assetId/:variant` | no | variant read | CMS/public |
| GET | `/api/v1/admin/audit-events` | session | audit read | CMS |

Admin project routes are registered in `admin-project.routes.ts`; schemas are in `contracts/project-contracts.ts` and module schemas. Do not treat public projections as editable source.

## Public reader source-of-truth status

**CURRENT IMPLEMENTATION:** public routes are registered by `modules/projects/project.routes.ts`; locale-related public reading code exists under `modules/public-projects/`. **CRITICAL — REQUIRES TARGETED VERIFICATION:** actual public route wiring/source-of-truth cutover is not declared complete. `VERIFY-02-LOCALE-PUBLIC-ROUTE-SOURCE-OF-TRUTH` must inspect handler, repository selection, locale candidate semantics, and HTTP evidence.
