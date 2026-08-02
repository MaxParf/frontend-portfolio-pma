# Docker runtime map

`compose.portfolio.yml` runs `portfolio-db`, `portfolio-api` (127.0.0.1:3001), and `portfolio-cms` (127.0.0.1:5510). API and CMS use their respective Dockerfiles with repository-root build contexts; health checks gate startup. Safe targeted refresh: `docker compose -f compose.portfolio.yml up -d --build portfolio-api portfolio-cms`. Never use `down -v`.

Runtime proof compares image IDs with container `.Image`, checks health, and hashes local `cms/dist/assets` against `/usr/share/nginx/html/assets`; API proof checks compiled route literals. A recreated container without build can preserve stale output.

**CRITICAL — REQUIRES TARGETED VERIFICATION:** Docker runtime proof does not establish production locale backfill entry point, invocation, idempotency, preservation, or recovery.
