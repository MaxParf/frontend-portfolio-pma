#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"
require_portfolio_path
require_files
"$SCRIPT_DIR/validate-production-env.sh"

if docker volume inspect portfolio-production-postgres-data >/dev/null 2>&1; then
  "$SCRIPT_DIR/backup-db.sh"
fi

compose build portfolio-api portfolio-cms portfolio-public
compose up -d portfolio-db
wait_for_healthy 120 portfolio-db
"$SCRIPT_DIR/migrate.sh"
compose up -d portfolio-api
wait_for_healthy 120 portfolio-api
compose up -d portfolio-cms portfolio-public
wait_for_healthy 90 portfolio-cms portfolio-public
"$SCRIPT_DIR/smoke-production.sh"
printf 'Deployment completed. Validate the Caddy fragment and reload Caddy manually; this script never changes Caddy.\n'
