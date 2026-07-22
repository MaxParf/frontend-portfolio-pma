# Maxpar Portfolio Backend

Production-oriented backend foundation for the Maxpar portfolio public read API and private CMS shell.

## Scope

Phase 2A implemented the public published-project read model. Phase 3A adds production-oriented owner authentication and protected read-only admin APIs for the CMS shell:

- TypeScript API on Fastify
- PostgreSQL schema managed by Drizzle migrations
- deterministic import from `../data/projects.js`
- public read-only REST endpoints
- protected owner auth endpoints
- protected read-only admin project endpoints
- local Docker Compose isolation for future Selectel deployment

This phase does not include project editing, CMS write APIs, media upload, scheduling, draft live preview, workers, object storage, DNS, TLS, or production deployment.

## Architecture

- `src/config` validates environment variables with Zod and fails startup on invalid config.
- `src/db/schema` defines the Drizzle PostgreSQL schema.
- `src/modules/projects` contains repository, service, mapper, DTO schemas, and routes.
- `src/modules/auth` contains password verification, session handling, owner login/logout, and auth events.
- `src/modules/admin-projects` contains protected read-only project APIs for CMS.
- `scripts/seed-projects.ts` imports the current frontend project model and upserts it into PostgreSQL.
- `scripts/verify-seed.ts` verifies the published read model and media counts.

The public frontend still reads `../data/projects.js`; it is not switched to this API in Phase 3A.

## Environment

Copy `.env.example` to `.env` for local use and replace the local password placeholder.

Required variables:

- `NODE_ENV`
- `HOST`
- `PORT`
- `DATABASE_URL`
- `LOG_LEVEL`
- `CORS_ORIGINS`
- `CMS_ORIGINS`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `SESSION_COOKIE_NAME`
- `SESSION_TTL_SECONDS`
- `SESSION_TOKEN_SECRET`
- `COOKIE_SECURE`
- `LOGIN_RATE_LIMIT`
- `MAX_FAILED_LOGIN_ATTEMPTS`
- `LOGIN_LOCK_SECONDS`

`CORS_ORIGINS` must be an explicit comma-separated allowlist. Do not use `*` as a production default.
`CMS_ORIGINS` is also explicit and is used for credentialed CORS and unsafe-method Origin checks.

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
npm run admin:bootstrap
```

Create or update the local owner without putting credentials in Git:

```bash
ADMIN_LOGIN='@maxpar.fed' ADMIN_DISPLAY_NAME='Maksim' npm run admin:bootstrap
```

With no `ADMIN_PASSWORD`, the command uses an interactive hidden prompt and asks for confirmation. The password must be at least 12 characters and include letters and numbers. Do not pass the password as a command-line argument.

Environment mode for one local bootstrap:

```bash
read -s ADMIN_PASSWORD
echo
export ADMIN_PASSWORD
npm run admin:bootstrap
unset ADMIN_PASSWORD
```

When `ADMIN_PASSWORD` is set, bootstrap uses it directly and does not show the interactive prompt. Keep `ADMIN_PASSWORD` empty in committed examples and remove it from long-running production service environments after the one-time bootstrap. The CMS has exactly one owner. The default owner login is `@maxpar.fed`; `ADMIN_LOGIN` exists only for local recovery and should remain `@maxpar.fed` for the production policy. The password is validated, hashed with bcrypt cost 12, and never printed. Re-running bootstrap updates the single owner and revokes active owner sessions.

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

### Admin Auth

- `POST /api/v1/admin/auth/login`
- `POST /api/v1/admin/auth/logout`
- `GET /api/v1/admin/auth/me`

Login sets an HttpOnly, SameSite=Strict session cookie. `COOKIE_SECURE=true` is required for production HTTPS.

Request body:

```json
{
  "login": "@maxpar.fed",
  "password": "..."
}
```

There is no public registration, signup, password reset, invitation, role selection, or additional admin-user API.

### Admin Projects

- `GET /api/v1/admin/projects`
- `GET /api/v1/admin/projects/:slug`

These endpoints require an active owner session and return read-only PostgreSQL data for the CMS shell.

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
- `admin_users`
- `admin_sessions`
- `auth_events`

Media files remain in the static frontend. The database stores only read metadata and paths.
Raw session tokens are never stored. The database stores only a peppered HMAC hash of the token. Auth events do not store passwords, raw tokens, cookies, full IP addresses, full user agents, or raw login values for unknown users.

## Selectel Readiness

Future topology:

```text
Selectel VPS
└── maxpar-portfolio compose project
    ├── portfolio-api
    ├── portfolio-db
    ├── portfolio-network
    ├── portfolio-cms
    └── portfolio-postgres-data
```

Future components are intentionally not created in Phase 3A:

- `portfolio-worker`
- `portfolio-storage`

Production deployment will still require a separate Linux user or deploy directory, firewall, reverse proxy, TLS, DNS, backup process, monitoring, secret provisioning, resource limits, and database restore testing.

Project Bradbury infrastructure is not referenced or used.
