#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"
require_portfolio_path
require_files
"$SCRIPT_DIR/validate-production-env.sh"

[ "$#" -eq 1 ] || { printf 'Usage: RESTORE_CONFIRM=RESTORE_PORTFOLIO_PRODUCTION %s <backup-file>\n' "$0" >&2; exit 2; }
[ "${RESTORE_CONFIRM:-}" = "RESTORE_PORTFOLIO_PRODUCTION" ] || { printf 'Explicit restore confirmation is required.\n' >&2; exit 1; }
backup="$1"
case "$backup" in "$PORTFOLIO_ROOT"/backups/portfolio-postgres-*.sql.gz) ;; *) printf 'Backup must be a portfolio backup under /opt/portfolio/backups.\n' >&2; exit 1 ;; esac
[ -s "$backup" ] || { printf 'Backup file is missing or empty.\n' >&2; exit 1; }

compose up -d portfolio-db
compose wait portfolio-db
gzip -cd "$backup" | compose exec -T portfolio-db sh -lc 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
printf 'Database restore completed. Restart application services and run smoke manually.\n'
