# Backend map

`src/server.ts` starts Fastify built by `src/app.ts`; configuration is under `src/config`, database connection/schema under `src/db`. `modules/auth` owns owner sessions. `modules/admin-projects` owns admin list/detail, drafts/revisions, locale publication state/materialization, normalized links, audit and verifiers. `modules/projects` and `modules/public-projects` own published public reads. `modules/media` owns upload/variants. Scripts include migrations, seed/bootstrap, isolated tests, lifecycle/projection/locale/media verifiers.

**CURRENT IMPLEMENTATION:** locale tables, repositories, materializer, services, verifiers, migrations, and route-side contracts exist. **CRITICAL — REQUIRES TARGETED VERIFICATION:** public reader cutover/source-of-truth and production backfill invocation are not established by this map.
