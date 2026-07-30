# Repository structure

| Path | Purpose / entry point | Runtime responsibility |
|---|---|---|
| `index.html`, `script.js`, `components/`, `services/` | static public frontend | browser public rendering |
| `cms/src/main.tsx`, `cms/src/components/App.tsx` | Vite CMS | owner UI |
| `backend/src/server.ts`, `backend/src/app.ts` | Fastify API | auth, admin/public APIs |
| `backend/src/db/schema/`, `backend/drizzle/` | Drizzle schema and migrations | PostgreSQL model |
| `contracts/` | shared Zod transport contracts | API/CMS boundary |
| `backend/tests/`, `cms/src/**/*.test.tsx`, `tests/` | automated coverage | isolated checks |
| `compose.portfolio.yml`, Dockerfiles | local runtime | API/CMS/DB orchestration |

Excluded from this map: dependency directories, generated `dist`, caches, and `.git`.
