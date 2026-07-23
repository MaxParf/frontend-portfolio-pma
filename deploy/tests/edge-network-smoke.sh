#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
suffix="$(date +%s)-$$"
image="portfolio-edge-network-smoke:$suffix"
edge_container="portfolio-edge-network-smoke-$suffix"
private_container="portfolio-private-network-smoke-$suffix"
private_network="portfolio-private-network-smoke-$suffix"
edge_network="portfolio-edge-network-smoke-$suffix"

cleanup() {
  docker rm -f "$edge_container" "$private_container" >/dev/null 2>&1 || true
  docker network rm "$private_network" "$edge_network" >/dev/null 2>&1 || true
  docker image rm -f "$image" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker build -t "$image" "$ROOT_DIR/cms"
docker network create --internal "$private_network" >/dev/null
docker network create "$edge_network" >/dev/null
docker run -d --name "$private_container" --network "$private_network" nginxinc/nginx-unprivileged:1.29-bookworm >/dev/null
docker run -d --name "$edge_container" --network "$edge_network" \
  --cap-drop ALL --security-opt no-new-privileges:true \
  -p 127.0.0.1::8080 "$image" >/dev/null
docker network connect "$private_network" "$edge_container"

for _ in $(seq 1 20); do
  if docker exec "$edge_container" curl --fail --silent http://127.0.0.1:8080/health | grep -qx ok; then
    host_port="$(docker port "$edge_container" 8080/tcp | sed -n 's/.*:\([0-9][0-9]*\)$/\1/p')"
    [ -n "$host_port" ]
    curl --fail --silent "http://127.0.0.1:$host_port/health" | grep -qx ok
    docker exec "$edge_container" curl --fail --silent http://"$private_container":8080/ > /dev/null
    docker inspect "$edge_container" --format '{{json .NetworkSettings.Ports}}' | grep -Fq '127.0.0.1'
    printf 'edge network smoke passed\n'
    exit 0
  fi
  sleep 1
done

docker logs "$edge_container" >&2
exit 1
