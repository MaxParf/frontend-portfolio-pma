#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPOSITORY_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SOURCE_COMMIT="${PORTFOLIO_CMS_SOURCE_COMMIT:-$(git -C "$REPOSITORY_ROOT" rev-parse HEAD)}"
OUTPUT_DIR="${1:-/tmp/portfolio-cms-desktop-build/runtime}"
[[ "$OUTPUT_DIR" == /tmp/portfolio-cms-desktop-build/* || "$OUTPUT_DIR" == /tmp/portfolio-cms-app.*/* ]] || { echo "Refusing runtime output outside approved build staging" >&2; exit 64; }
git -C "$REPOSITORY_ROOT" cat-file -e "$SOURCE_COMMIT^{commit}"
STAGE_DIR="$(mktemp -d /tmp/portfolio-cms-runtime.XXXXXX)"
trap 'rm -rf "$STAGE_DIR"' EXIT

# Exact runtime route graph; Git archive prevents dirty-worktree input.
RUNTIME_PATHS=(
  cms-lite/api.js cms-lite/cms.css cms-lite/cms.js cms-lite/dev-server.mjs
  cms-lite/editor/app.js cms-lite/editor/media-previews.js cms-lite/editor/state.js cms-lite/index.html
  cms-lite/login.js cms-lite/login/index.html cms-lite/password-change.js
  cms-lite/runtime-config.js cms-lite/session.js cms-lite/storage/php-api.js
  project-core/plain-text-paragraphs.js project-core/project-model.js project-core/project-normalizer.js project-core/project-validator.js
  components/project-renderer.js services/projects-source.js
  data/projects.lite.json script.js style.css i18n.js analytics.js images
)
mkdir -p "$STAGE_DIR/runtime"
git -C "$REPOSITORY_ROOT" archive --format=tar "$SOURCE_COMMIT" -- "${RUNTIME_PATHS[@]}" | tar -xf - -C "$STAGE_DIR/runtime"
for forbidden in cms cms-api backend tests docs .git node_modules package.json package-lock.json; do
  [[ ! -e "$STAGE_DIR/runtime/$forbidden" ]] || { echo "Forbidden runtime path: $forbidden" >&2; exit 65; }
done
grep -Fq 'https://www.maxpar.ru/cms-api' "$STAGE_DIR/runtime/cms-lite/runtime-config.js" || { echo "Production API runtime config missing" >&2; exit 66; }
grep -Fq 'listen(port, "127.0.0.1"' "$STAGE_DIR/runtime/cms-lite/dev-server.mjs" || { echo "Runtime is not loopback-only" >&2; exit 67; }
printf 'source_commit=%s\napi_base_url=https://www.maxpar.ru/cms-api\n' "$SOURCE_COMMIT" > "$STAGE_DIR/runtime/VERSION"
(cd "$STAGE_DIR/runtime" && find . -type f -print0 | LC_ALL=C sort -z | xargs -0 shasum -a 256) > "$STAGE_DIR/runtime/MANIFEST.sha256"
rm -rf "$OUTPUT_DIR"
mkdir -p "$(dirname "$OUTPUT_DIR")"
mv "$STAGE_DIR/runtime" "$OUTPUT_DIR"
printf 'Runtime created: %s\n' "$OUTPUT_DIR"
