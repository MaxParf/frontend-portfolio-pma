#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"
require_portfolio_path
require_files
"$SCRIPT_DIR/validate-production-env.sh"
[ -t 0 ] && [ -t 1 ] || { printf 'Owner bootstrap requires an interactive terminal.\n' >&2; exit 1; }
compose up -d portfolio-db
wait_for_healthy 120 portfolio-db
printf 'The owner password is requested interactively inside the container and is not stored in the environment file.\n' >&2
compose run --rm --no-deps portfolio-owner-bootstrap
