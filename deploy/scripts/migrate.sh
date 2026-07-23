#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"
require_portfolio_path
require_files
"$SCRIPT_DIR/validate-production-env.sh"
compose up -d portfolio-db
wait_for_healthy 120 portfolio-db
compose run --rm portfolio-migrate
printf 'Production migrations completed.\n'
