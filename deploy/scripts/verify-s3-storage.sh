#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"
require_portfolio_path
require_files
"$SCRIPT_DIR/validate-production-env.sh"

compose --profile operations run --rm --no-deps portfolio-s3-probe
