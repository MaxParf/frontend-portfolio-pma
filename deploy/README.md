# Portfolio Production Deployment

Phase 3E.1 prepares a deployment contour only. It does not connect to a VPS, edit Caddy, change DNS, or deploy a release.

## Isolation

On the VPS, place the checked-out release under `/opt/portfolio/app` and the real production environment file at `/opt/portfolio/env/portfolio.production.env` with owner `deploy:deploy` and mode `600`. The Compose project uses only `portfolio-production-*` containers, volumes, and an internal Docker network. It never references Project Bradbury resources.

PostgreSQL has no host port. API, CMS, and public frontend bind only to `127.0.0.1:3101`, `127.0.0.1:3102`, and `127.0.0.1:3103`; Caddy is the only public TLS edge.

## Environment and Secrets

Copy `.env.production.example` to the VPS environment directory and replace placeholders there only. Do not store `ADMIN_PASSWORD` in the file. The manual owner bootstrap command opens its own hidden terminal prompt.

`COOKIE_SECURE=true`, `DATABASE_PURPOSE=production`, the exact production origins, and a matching `PRODUCTION_DATABASE_NAME` are mandatory. The production validator rejects test markers, placeholder values, and development loopback URLs.

## Operational Commands

Run these commands on the VPS from `/opt/portfolio/app`:

```bash
deploy/scripts/validate-production-env.sh
deploy/scripts/deploy.sh
deploy/scripts/bootstrap-owner.sh
deploy/scripts/backup-db.sh
deploy/scripts/smoke-production.sh
```

Migrations are never part of API startup. `deploy.sh` runs them through the explicit `portfolio-migrate` job after the database healthcheck. Owner bootstrap is a separate interactive operation and must not be repeated casually because updating the owner revokes active sessions.

`restore-db.sh` requires `RESTORE_CONFIRM=RESTORE_PORTFOLIO_PRODUCTION` and accepts only a non-empty backup from `/opt/portfolio/backups`. It does not restart services automatically.

## Backup and Media

Database backups are logical `pg_dump` archives compressed under `/opt/portfolio/backups` with mode `600`. Retention is disabled unless `BACKUP_RETENTION_DAYS` is explicitly set.

Production media is configured through `STORAGE_PROVIDER`. Use `STORAGE_PROVIDER=s3` for Selectel Object Storage. `STORAGE_PROVIDER=local` remains an explicit temporary fallback only, with the `portfolio-production-media-data` volume mounted for compatibility and migration. The API does not silently fall back from S3 to local storage.

S3 media objects are not included in DB backups. A DB restore without matching objects can create broken media references. See `deploy/selectel-s3.md` for Selectel setup, optional connectivity probe, migration inventory, and recovery guidance.

## Caddy

Review `deploy/caddy/portfolio.Caddyfile`, make a dated backup of `/etc/caddy/Caddyfile`, merge only the portfolio sites, then validate and reload manually:

```bash
sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.backup-$(date -u +%Y%m%dT%H%M%SZ)
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

To roll back a Caddy edit, restore the dated backup, validate it, and reload Caddy. The fragment must not modify `api.prbdbr.com`, `studio.prbdbr.com`, or any Bradbury route.
