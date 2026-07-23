#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"
require_portfolio_path
require_files
"$SCRIPT_DIR/validate-production-env.sh"

BACKUP_DIR="$PORTFOLIO_ROOT/backups"
case "$BACKUP_DIR" in "$PORTFOLIO_ROOT"/*) ;; *) printf 'Unsafe backup directory.\n' >&2; exit 1 ;; esac
mkdir -p "$BACKUP_DIR"
umask 077
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="$BACKUP_DIR/portfolio-postgres-$timestamp.sql.gz"
temporary="$target.tmp"

compose up -d portfolio-db
wait_for_healthy 120 portfolio-db
compose exec -T portfolio-db sh -lc 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges' | gzip -c > "$temporary"
[ -s "$temporary" ] || { rm -f "$temporary"; printf 'Backup is empty.\n' >&2; exit 1; }
mv "$temporary" "$target"
chmod 600 "$target"

if [ -n "${BACKUP_RETENTION_DAYS:-}" ]; then
  case "$BACKUP_RETENTION_DAYS" in *[!0-9]*|"") printf 'BACKUP_RETENTION_DAYS must be a positive integer when set.\n' >&2; exit 1 ;; esac
  find "$BACKUP_DIR" -maxdepth 1 -type f -name 'portfolio-postgres-*.sql.gz' -mtime "+$BACKUP_RETENTION_DAYS" -delete
fi

printf 'Database backup created: %s\n' "$(basename "$target")"
