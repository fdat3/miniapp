#!/bin/bash
# Build OTA bundle cho iOS (plain JS - compatible với JSC engine)
# Usage: ./scripts/build-ota-ios.sh <version>
# Example: ./scripts/build-ota-ios.sh 4.2.0

set -e

if [ -z "$1" ]; then
  echo "Error: Cần version number"
  echo "Usage: ./scripts/build-ota-ios.sh <version>"
  exit 1
fi

VERSION=$1
BUILD_DIR="ota-builds/${VERSION}"

echo "Building OTA bundle iOS v${VERSION}..."

# Setup NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use v20.19.4

mkdir -p "$BUILD_DIR"

# Build JS bundle
npx react-native bundle \
  --platform ios \
  --dev false \
  --entry-file index.js \
  --bundle-output "$BUILD_DIR/main.jsbundle" \
  --assets-dest "$BUILD_DIR/assets" \
  --minify true \
  --reset-cache

# Verify bundle
BUNDLE_SIZE=$(wc -c < "$BUILD_DIR/main.jsbundle")
if [ "$BUNDLE_SIZE" -lt 100000 ]; then
  echo "Error: Bundle quá nhỏ ($BUNDLE_SIZE bytes), có thể bị lỗi"
  exit 1
fi

# Package ZIP
cd "$BUILD_DIR"
rm -f "ios-${VERSION}.zip"
zip "ios-${VERSION}.zip" main.jsbundle
cd - > /dev/null

echo "Done! File: $BUILD_DIR/ios-${VERSION}.zip ($(du -h "$BUILD_DIR/ios-${VERSION}.zip" | cut -f1))"
