#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"
require_portfolio_path
require_files
"$SCRIPT_DIR/validate-production-env.sh"

temporary_dir="$(mktemp -d)"
trap 'rm -rf "$temporary_dir"' EXIT
check_ok() { curl --fail --silent --show-error "$1" > /dev/null; }
check_status() { [ "$(curl --silent --output /dev/null --write-out '%{http_code}' "$1")" = "$2" ]; }

check_ok http://127.0.0.1:3103/health
check_ok http://127.0.0.1:3102/health
check_ok http://127.0.0.1:3101/health
check_ok 'http://127.0.0.1:3101/api/v1/projects?locale=en'
check_status http://127.0.0.1:3101/api/v1/admin/auth/me 401

curl --fail --silent --show-error http://127.0.0.1:3103/ > "$temporary_dir/public.html"
curl --fail --silent --show-error http://127.0.0.1:3102/login > "$temporary_dir/cms.html"
grep -Fq 'https://api.maxpar.ru/api/v1' <(curl --fail --silent --show-error http://127.0.0.1:3103/runtime-config.js)
grep -Fq 'https://cms.maxpar.ru/login' <(curl --fail --silent --show-error http://127.0.0.1:3103/runtime-config.js)
if grep -REq '127\.0\.0\.1:(3001|5510|8080)|localhost:(3001|5510|8080)' "$temporary_dir"; then
  printf 'Development URL found in production HTML.\n' >&2
  exit 1
fi

cms_asset="$(sed -n 's/.*src="\([^" ]*\/assets\/[^" ]*\.js\)".*/\1/p' "$temporary_dir/cms.html" | head -n 1)"
[ -n "$cms_asset" ] || { printf 'CMS JavaScript asset was not found.\n' >&2; exit 1; }
curl --fail --silent --show-error "http://127.0.0.1:3102$cms_asset" > "$temporary_dir/cms.js"
grep -Fq 'https://api.maxpar.ru' "$temporary_dir/cms.js"
if grep -REq '127\.0\.0\.1:(3001|5510|8080)|localhost:(3001|5510|8080)' "$temporary_dir"; then
  printf 'Development URL found in production assets.\n' >&2
  exit 1
fi
printf 'Production loopback smoke passed.\n'
