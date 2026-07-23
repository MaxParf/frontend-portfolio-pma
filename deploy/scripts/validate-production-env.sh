#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"
require_portfolio_path
require_files

mode="$(stat -c '%a' "$ENV_FILE")"
[ "$mode" = "600" ] || { printf 'Production environment file must have mode 600.\n' >&2; exit 1; }

set -a
source "$ENV_FILE"
set +a

required=(NODE_ENV DATABASE_PURPOSE PRODUCTION_DATABASE_NAME POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD SESSION_TOKEN_SECRET COOKIE_SECURE CORS_ORIGINS CMS_ORIGINS CMS_API_BASE_URL PUBLIC_API_BASE_URL PUBLIC_CMS_LOGIN_URL ADMIN_LOGIN STORAGE_PROVIDER MEDIA_STORAGE_ROOT MEDIA_PROCESSING_TMP_DIR)
for name in "${required[@]}"; do
  [ -n "${!name:-}" ] || { printf 'Required production environment value is missing.\n' >&2; exit 1; }
done

[ "$NODE_ENV" = "production" ] || { printf 'NODE_ENV must be production.\n' >&2; exit 1; }
[ "$DATABASE_PURPOSE" = "production" ] || { printf 'DATABASE_PURPOSE must be production.\n' >&2; exit 1; }
[ "$PRODUCTION_DATABASE_NAME" = "$POSTGRES_DB" ] || { printf 'Production database identity does not match POSTGRES_DB.\n' >&2; exit 1; }
[ "$COOKIE_SECURE" = "true" ] || { printf 'COOKIE_SECURE must be true.\n' >&2; exit 1; }
[ "$CORS_ORIGINS" = "https://maxpar.ru" ] || { printf 'CORS_ORIGINS must be the public production origin.\n' >&2; exit 1; }
[ "$CMS_ORIGINS" = "https://cms.maxpar.ru" ] || { printf 'CMS_ORIGINS must be the CMS production origin.\n' >&2; exit 1; }
[ "$CMS_API_BASE_URL" = "https://api.maxpar.ru" ] || { printf 'CMS_API_BASE_URL must use the API production origin.\n' >&2; exit 1; }
[ "$PUBLIC_API_BASE_URL" = "https://api.maxpar.ru/api/v1" ] || { printf 'PUBLIC_API_BASE_URL must use the published API base URL.\n' >&2; exit 1; }
[ "$PUBLIC_CMS_LOGIN_URL" = "https://cms.maxpar.ru/login" ] || { printf 'PUBLIC_CMS_LOGIN_URL must use the CMS production login URL.\n' >&2; exit 1; }
[ -z "${TEST_DATABASE_NAME:-}" ] || { printf 'TEST_DATABASE_NAME is forbidden in production.\n' >&2; exit 1; }
[ -z "${ALLOW_TEST_OWNER_BOOTSTRAP:-}" ] || { printf 'Test owner bootstrap is forbidden in production.\n' >&2; exit 1; }
[ -z "${ADMIN_PASSWORD:-}" ] || { printf 'ADMIN_PASSWORD must not be stored in the production environment file.\n' >&2; exit 1; }
[ "${#SESSION_TOKEN_SECRET}" -ge 32 ] || { printf 'SESSION_TOKEN_SECRET is too short.\n' >&2; exit 1; }

case "$POSTGRES_DB" in *_test|test) printf 'Production database name is unsafe.\n' >&2; exit 1 ;; esac
case "$POSTGRES_PASSWORD:$SESSION_TOKEN_SECRET" in *replace-with-*|*localhost*|*127.0.0.1*) printf 'Production environment contains a placeholder or development value.\n' >&2; exit 1 ;; esac

case "$STORAGE_PROVIDER" in
  s3)
    s3_required=(S3_ENDPOINT S3_REGION S3_BUCKET S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY S3_KEY_PREFIX S3_ACCESS_MODEL)
    for name in "${s3_required[@]}"; do
      [ -n "${!name:-}" ] || { printf 'Required S3 production environment value is missing.\n' >&2; exit 1; }
    done
    case "$S3_ENDPOINT" in https://*) ;; *) printf 'S3_ENDPOINT must use HTTPS in production.\n' >&2; exit 1 ;; esac
    case "$S3_ACCESS_MODEL" in private-proxy) [ -z "${S3_PUBLIC_BASE_URL:-}" ] || { printf 'S3_PUBLIC_BASE_URL is not used with private-proxy media.\n' >&2; exit 1; } ;; public-read) case "${S3_PUBLIC_BASE_URL:-}" in https://*) ;; *) printf 'S3_PUBLIC_BASE_URL must use HTTPS for public-read media.\n' >&2; exit 1 ;; esac ;; *) printf 'Unsupported S3_ACCESS_MODEL.\n' >&2; exit 1 ;; esac
    case "$S3_BUCKET" in *"_"*|*..*|""|.*|*.) printf 'S3_BUCKET is invalid.\n' >&2; exit 1 ;; esac
    case "$S3_KEY_PREFIX" in /*|*/|*..*|*//*|"") printf 'S3_KEY_PREFIX must be normalized.\n' >&2; exit 1 ;; esac
    case "$S3_ENDPOINT:$S3_REGION:$S3_BUCKET:$S3_ACCESS_KEY_ID:$S3_SECRET_ACCESS_KEY" in *replace-with*|*localhost*|*127.0.0.1*) printf 'S3 production environment contains a placeholder or development value.\n' >&2; exit 1 ;; esac
    ;;
  local)
    case "$MEDIA_STORAGE_ROOT" in /tmp*|.|*"/src"*) printf 'Production local media root must be an explicit persistent path.\n' >&2; exit 1 ;; esac
    ;;
  *) printf 'Unsupported STORAGE_PROVIDER.\n' >&2; exit 1 ;;
esac

compose config --quiet
printf 'Production environment validation passed.\n'
