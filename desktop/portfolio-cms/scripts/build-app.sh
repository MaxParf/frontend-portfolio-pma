#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_ROOT="${PORTFOLIO_CMS_BUILD_ROOT:-/tmp/portfolio-cms-desktop-build}"
APP_PATH="$OUTPUT_ROOT/Portfolio CMS.app"
NODE_VERSION="v24.19.0"
case "$(uname -m)" in
  arm64) NODE_ARCH="arm64"; SWIFT_ARCH="arm64"; NODE_SHA256="8294b7aa9b03997481c06babf1e8b270c859358f27da57a11509afe537ac381d" ;;
  x86_64) NODE_ARCH="x64"; SWIFT_ARCH="x86_64"; NODE_SHA256="d1b5e999db158c62fe8f7267a4476b035d8bd93b1a605bac24a3f0dd166e3316" ;;
  *) echo "Unsupported macOS architecture" >&2; exit 64 ;;
esac
[[ "$OUTPUT_ROOT" == /tmp/portfolio-cms-desktop-build ]] || { echo "Refusing app output outside /tmp/portfolio-cms-desktop-build" >&2; exit 65; }
CACHE_DIR="${PORTFOLIO_CMS_NODE_CACHE:-/tmp/portfolio-cms-node-cache}"
ARCHIVE="node-${NODE_VERSION}-darwin-${NODE_ARCH}.tar.gz"
NODE_ARCHIVE="$CACHE_DIR/$ARCHIVE"
STAGE_DIR="$(mktemp -d /tmp/portfolio-cms-app.XXXXXX)"
trap 'rm -rf "$STAGE_DIR"' EXIT
mkdir -p "$CACHE_DIR"
if [[ ! -f "$NODE_ARCHIVE" ]]; then
  curl --fail --location --proto '=https' --tlsv1.2 --output "$NODE_ARCHIVE.part" "https://nodejs.org/dist/${NODE_VERSION}/$ARCHIVE"
  mv "$NODE_ARCHIVE.part" "$NODE_ARCHIVE"
fi
[[ "$(shasum -a 256 "$NODE_ARCHIVE" | awk '{print $1}')" == "$NODE_SHA256" ]] || { echo "Node archive SHA-256 mismatch" >&2; exit 66; }
"$SCRIPT_DIR/build-runtime.sh" "$STAGE_DIR/runtime"
tar -xzf "$NODE_ARCHIVE" -C "$STAGE_DIR"
rm -rf "$APP_PATH"
mkdir -p "$APP_PATH/Contents/MacOS" "$APP_PATH/Contents/Resources/node"
swiftc -O -target "${SWIFT_ARCH}-apple-macosx13.0" -framework AppKit -framework Foundation "$PROJECT_DIR/Sources/PortfolioCMSLauncher/main.swift" -o "$APP_PATH/Contents/MacOS/PortfolioCMSLauncher"
cp "$STAGE_DIR/node-${NODE_VERSION}-darwin-${NODE_ARCH}/bin/node" "$APP_PATH/Contents/Resources/node/node"
cp "$STAGE_DIR/node-${NODE_VERSION}-darwin-${NODE_ARCH}/LICENSE" "$APP_PATH/Contents/Resources/node/LICENSE"
mv "$STAGE_DIR/runtime" "$APP_PATH/Contents/Resources/runtime"
cp "$PROJECT_DIR/resources/Info.plist.template" "$APP_PATH/Contents/Info.plist"
if [[ -f "$PROJECT_DIR/resources/AppIcon.icns" ]]; then
  cp "$PROJECT_DIR/resources/AppIcon.icns" "$APP_PATH/Contents/Resources/AppIcon.icns"
  /usr/libexec/PlistBuddy -c 'Add :CFBundleIconFile string AppIcon' "$APP_PATH/Contents/Info.plist"
fi
plutil -lint "$APP_PATH/Contents/Info.plist" >/dev/null
printf '%s\n' "$NODE_VERSION" > "$APP_PATH/Contents/Resources/NODE_VERSION"
codesign --force --deep --sign - --timestamp=none "$APP_PATH" >/dev/null
codesign --verify --deep --strict "$APP_PATH"
printf 'App created: %s\n' "$APP_PATH"
