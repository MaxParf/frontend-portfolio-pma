#!/usr/bin/env bash
set -Eeuo pipefail

PORTFOLIO_ROOT="/opt/portfolio"
APP_DIR="$PORTFOLIO_ROOT/app"
COMPOSE_FILE="$APP_DIR/compose.portfolio.production.yml"
ENV_FILE="${PORTFOLIO_ENV_FILE:-$PORTFOLIO_ROOT/env/portfolio.production.env}"

require_portfolio_path() {
  local current
  current="$(pwd -P)"
  case "$current" in "$PORTFOLIO_ROOT"|"$PORTFOLIO_ROOT"/*) ;; *) printf 'Refusing to run outside %s.\n' "$PORTFOLIO_ROOT" >&2; exit 1 ;; esac
}

require_files() {
  [ -f "$COMPOSE_FILE" ] || { printf 'Missing production Compose file.\n' >&2; exit 1; }
  [ -f "$ENV_FILE" ] || { printf 'Missing production environment file.\n' >&2; exit 1; }
}

compose() {
  PORTFOLIO_ENV_FILE="$ENV_FILE" docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}
