# Maxpar Portfolio Backend

Production-oriented backend foundation for the Maxpar portfolio public read API.

## Scope

Phase 2A implements only the public published-project read model:

- TypeScript API on Fastify
- PostgreSQL schema managed by Drizzle migrations
- deterministic import from `../data/projects.js`
- public read-only REST endpoints
- local Docker Compose isolation for future Selectel deployment

This phase does not include CMS, authentication, sessions, admin CRUD, write APIs, preview, workers, object storage, DNS, TLS, or production deployment.

## Architecture

- `src/config` validates environment variables with Zod and fails startup on invalid config.
- `src/db/schema` defines the Drizzle PostgreSQL schema.
- `src/modules/projects` contains repository, service, mapper, DTO schemas, and routes.
- `scripts/seed-projects.ts` imports the current frontend project model and upserts it into PostgreSQL.
- `scripts/verify-seed.ts` verifies the published read model and media counts.

The public frontend still reads `../data/projects.js`; it is not switched to this API in Phase 2A.

## Environment

Copy `.env.example` to `.env` for local use and replace the local password placeholder.

Required variables:

- `NODE_ENV`
- `HOST`
- `PORT`
- `DATABASE_URL`
- `LOG_LEVEL`
- `CORS_ORIGINS`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`

`CORS_ORIGINS` must be an explicit comma-separated allowlist. Do not use `*` as a production default.

## Local Commands

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run db:generate
npm run db:migrate
npm run db:seed
npm run db:verify
```

## Docker

From the repository root:

```bash
docker compose -f compose.portfolio.yml config
docker compose -f compose.portfolio.yml build
docker compose -f compose.portfolio.yml up -d
docker compose -f compose.portfolio.yml ps
```

Then run migrations and seed from `backend/` against the loopback DB port:

```bash
npm run db:migrate
npm run db:seed
npm run db:verify
```

Smoke test:

```bash
curl -i http://127.0.0.1:3001/health
curl -i "http://127.0.0.1:3001/api/v1/projects?locale=en"
curl -i "http://127.0.0.1:3001/api/v1/projects?locale=ru"
```

Stop containers without deleting the named volume:

```bash
docker compose -f compose.portfolio.yml down
```

## API

### `GET /health`

Returns service health and checks database availability.

### `GET /api/v1/projects`

Query:

- `locale=en|ru`
- default locale: `en`
- invalid locale: `400 VALIDATION_ERROR`

Returns only `status = published`, sorted by `sortOrder ASC`.

### `GET /api/v1/projects/:slug`

Query:

- `locale=en|ru`

Unknown published project slug returns `404 NOT_FOUND`.

## Error Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request.",
    "requestId": "..."
  }
}
```

Production responses do not expose stack traces.

## Database

Tables:

- `projects`
- `project_translations`
- `technologies`
- `project_technologies`
- `media_assets`
- `media_asset_translations`
- `project_media`

Media files remain in the static frontend. The database stores only read metadata and paths.

## Selectel Readiness

Future topology:

```text
Selectel VPS
└── maxpar-portfolio compose project
    ├── portfolio-api
    ├── portfolio-db
    ├── portfolio-network
    └── portfolio-postgres-data
```

Future components are intentionally not created in Phase 2A:

- `portfolio-cms`
- `portfolio-worker`
- `portfolio-storage`

Production deployment will still require a separate Linux user or deploy directory, firewall, reverse proxy, TLS, DNS, backup process, monitoring, secret provisioning, resource limits, and database restore testing.

Project Bradbury infrastructure is not referenced or used.
