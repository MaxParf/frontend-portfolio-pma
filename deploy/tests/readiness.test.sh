#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/deploy/scripts/lib.sh"

assert_contains() {
  [[ "$1" == *"$2"* ]] || { printf 'Expected output to contain: %s\n' "$2" >&2; exit 1; }
}

assert_not_contains() {
  [[ "$1" != *"$2"* ]] || { printf 'Output unexpectedly contained: %s\n' "$2" >&2; exit 1; }
}

compose() {
  case "$1" in
    ps)
      if [ "${2:-}" = "-q" ]; then printf 'mock-%s\n' "$3"; else printf 'mock ps for %s\n' "$2"; fi
      ;;
    logs) printf 'SESSION_TOKEN_SECRET=diagnostic-secret\n{"S3_SECRET_ACCESS_KEY":"json-secret"}\n' ;;
    *) printf 'Unexpected compose command: %s\n' "$1" >&2; return 1 ;;
  esac
}

docker() {
  [ "$1" = "inspect" ] || { printf 'Unexpected docker command: %s\n' "$1" >&2; return 1; }
  if [[ "$3" == *"State.Status"* ]]; then printf '%s\n' "$MOCK_STATE"; else printf '%s\n' "$MOCK_HEALTH"; fi
}

test_healthy() {
  MOCK_STATE=running MOCK_HEALTH=healthy wait_for_healthy 1 portfolio-db portfolio-api
}

test_failure() {
  local state="$1"
  local health="$2"
  local expected="$3"
  local output
  output="$(MOCK_STATE="$state" MOCK_HEALTH="$health" wait_for_healthy 1 portfolio-db 2>&1 || true)"
  assert_contains "$output" "$expected"
  assert_not_contains "$output" 'diagnostic-secret'
  assert_not_contains "$output" 'json-secret'
  assert_contains "$output" 'SESSION_TOKEN_SECRET=[REDACTED]'
  assert_contains "$output" 'S3_SECRET_ACCESS_KEY":"[REDACTED]'
}

test_healthy
test_failure running unhealthy 'state=running health=unhealthy'
test_failure exited none 'state=exited health=none'
test_failure dead none 'state=dead health=none'

timeout_output="$(MOCK_STATE=running MOCK_HEALTH=starting HEALTH_POLL_INTERVAL_SECONDS=0.01 wait_for_healthy 1 portfolio-db 2>&1 || true)"
assert_contains "$timeout_output" 'timed out after 1s'
assert_not_contains "$timeout_output" 'diagnostic-secret'
assert_not_contains "$timeout_output" 'json-secret'

deploy_script="$(<"$ROOT_DIR/deploy/scripts/deploy.sh")"
assert_not_contains "$deploy_script" 'compose wait'
assert_contains "$deploy_script" 'wait_for_healthy 120 portfolio-db'
assert_contains "$deploy_script" 'wait_for_healthy 120 portfolio-api'
assert_contains "$deploy_script" 'wait_for_healthy 90 portfolio-cms portfolio-public'

printf 'readiness shell tests passed\n'
