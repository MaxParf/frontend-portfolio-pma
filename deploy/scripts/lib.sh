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

wait_for_healthy() {
  local timeout_seconds="$1"
  shift

  [[ "$timeout_seconds" =~ ^[1-9][0-9]*$ ]] || { printf 'Health wait timeout must be a positive integer.\n' >&2; return 1; }
  [ "$#" -gt 0 ] || { printf 'At least one service is required for a health wait.\n' >&2; return 1; }

  local service
  for service in "$@"; do
    wait_for_service_healthy "$service" "$timeout_seconds" || return 1
  done
}

wait_for_service_healthy() {
  local service="$1"
  local timeout_seconds="$2"
  local deadline=$(( $(date +%s) + timeout_seconds ))
  local container_id state health

  while :; do
    container_id="$(compose ps -q "$service" 2>/dev/null || true)"
    if [ -z "$container_id" ]; then
      print_health_diagnostics "$service" "container was not found"
      return 1
    fi

    state="$(docker inspect --format '{{.State.Status}}' "$container_id" 2>/dev/null || true)"
    health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_id" 2>/dev/null || true)"
    case "$state:$health" in
      running:healthy) return 0 ;;
      exited:*|dead:*|*:unhealthy|:*)
        print_health_diagnostics "$service" "state=$state health=$health"
        return 1
        ;;
    esac

    if [ "$(date +%s)" -ge "$deadline" ]; then
      print_health_diagnostics "$service" "timed out after ${timeout_seconds}s (state=$state health=$health)"
      return 1
    fi
    sleep "${HEALTH_POLL_INTERVAL_SECONDS:-2}"
  done
}

print_health_diagnostics() {
  local service="$1"
  local reason="$2"
  printf 'Service %s did not become healthy: %s\n' "$service" "$reason" >&2
  compose ps "$service" >&2 || true
  { compose logs --tail 50 "$service" 2>&1 || true; } | redact_diagnostic_secrets >&2
}

redact_diagnostic_secrets() {
  sed -E 's/((PASSWORD|SECRET|TOKEN|KEY|DATABASE_URL)[A-Za-z0-9_]*"?[[:space:]]*[:=][[:space:]]*"?)[^[:space:],}"]+/\1[REDACTED]/g'
}
