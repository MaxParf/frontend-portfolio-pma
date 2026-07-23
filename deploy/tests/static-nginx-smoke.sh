#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
suffix="$(date +%s)-$$"
cms_image="portfolio-cms-static-smoke:$suffix"
public_image="portfolio-public-static-smoke:$suffix"
cms_container="portfolio-cms-static-smoke-$suffix"
public_container="portfolio-public-static-smoke-$suffix"

cleanup() {
  docker rm -f "$cms_container" "$public_container" >/dev/null 2>&1 || true
  docker image rm -f "$cms_image" "$public_image" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker build -t "$cms_image" "$ROOT_DIR/cms"
docker build \
  --build-arg PUBLIC_API_BASE_URL=https://api.maxpar.ru/api/v1 \
  --build-arg PUBLIC_CMS_LOGIN_URL=https://cms.maxpar.ru/login \
  -f "$ROOT_DIR/Dockerfile.public" \
  -t "$public_image" "$ROOT_DIR"

check_image() {
  local image="$1"
  local container="$2"
  local fallback_path="$3"
  [ "$(docker image inspect "$image" --format '{{.Config.User}}')" = "101" ]
  docker run --rm --cap-drop ALL --security-opt no-new-privileges:true "$image" nginx -t
  docker run -d --name "$container" --network none --cap-drop ALL --security-opt no-new-privileges:true "$image" >/dev/null
  for _ in $(seq 1 20); do
    if docker exec "$container" curl --fail --silent http://127.0.0.1:8080/health | grep -qx ok; then
      docker exec "$container" sh -ec 'test "$(id -u)" = 101; test -r /etc/nginx/conf.d/default.conf; test "$(curl --fail --silent http://127.0.0.1:8080/)" = "$(curl --fail --silent http://127.0.0.1:8080'"$fallback_path"')"'
      return 0
    fi
    sleep 1
  done
  docker logs "$container" >&2
  return 1
}

check_image "$cms_image" "$cms_container" /login
check_image "$public_image" "$public_container" /missing-route
printf 'static nginx smoke passed\n'
