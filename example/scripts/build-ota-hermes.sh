#!/bin/bash

# ============================================
# Build OTA Bundle với Hermes Bytecode
# ============================================
# Usage: ./scripts/build-ota-hermes.sh 1.0.8
# ============================================

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check version argument
if [ -z "$1" ]; then
  echo -e "${RED}Error: Version number required${NC}"
  echo "Usage: ./scripts/build-ota-hermes.sh <version>"
  echo "Example: ./scripts/build-ota-hermes.sh 3.1.2"
  exit 1
fi

VERSION=$1
PLATFORM=${2:-"android"}  # Default: android. Options: android | ios

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Building OTA Bundle với Hermes${NC}"
echo -e "${BLUE}Version: ${VERSION}${NC}"
echo -e "${BLUE}Platform: ${PLATFORM}${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Setup NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use v20.19.4

# Create build directory
BUILD_DIR="ota-builds/${VERSION}"
mkdir -p "$BUILD_DIR"

# ============================================
# Step 1: Build JS Bundle
# ============================================
echo -e "${YELLOW}Step 1: Building JS bundle...${NC}"

BUNDLE_OUTPUT="$BUILD_DIR/temp.bundle"
ASSETS_OUTPUT="$BUILD_DIR/assets"

npx react-native bundle \
  --platform ${PLATFORM} \
  --dev false \
  --entry-file index.js \
  --bundle-output "$BUNDLE_OUTPUT" \
  --assets-dest "$ASSETS_OUTPUT" \
  --minify true \
  --reset-cache

echo -e "${GREEN}✓ JS bundle created${NC}"
ls -lh "$BUNDLE_OUTPUT"
echo ""

# ============================================
# Step 2: Compile to Hermes Bytecode
# ============================================
echo -e "${YELLOW}Step 2: Compiling to Hermes bytecode...${NC}"

# Find hermesc binary
# iOS: MUST use hermesc from CocoaPods (matches the hermesc in the IPA)
# Android: use hermesc from node_modules/hermes-engine/linux64-bin/
HERMESC_PATH=""

if [ "$PLATFORM" = "ios" ]; then
  # iOS hermesc - from CocoaPods after pod install
  if [ -f "ios/Pods/hermes-engine/destroot/bin/hermesc" ]; then
    HERMESC_PATH="ios/Pods/hermes-engine/destroot/bin/hermesc"
  elif [ -f "node_modules/hermes-engine/osx-bin/hermesc" ]; then
    HERMESC_PATH="node_modules/hermes-engine/osx-bin/hermesc"
    echo -e "${YELLOW}⚠️  Warning: Using osx-bin hermesc. Prefer ios/Pods/hermes-engine/destroot/bin/hermesc${NC}"
    echo -e "${YELLOW}   Run 'cd ios && pod install' first to get the correct hermesc version${NC}"
  else
    echo -e "${RED}Error: iOS hermesc not found!${NC}"
    echo "Please run: cd ios && pod install"
    echo "Then retry: ./scripts/build-ota-hermes.sh ${VERSION} ios"
    exit 1
  fi
else
  # Android hermesc - from npm package (linux64 for CI/Linux, osx for Mac)
  if [ -f "node_modules/hermes-engine/linux64-bin/hermesc" ]; then
    HERMESC_PATH="node_modules/hermes-engine/linux64-bin/hermesc"
  elif [ -f "node_modules/hermes-engine/osx-bin/hermesc" ]; then
    HERMESC_PATH="node_modules/hermes-engine/osx-bin/hermesc"
  elif [ -f "node_modules/hermes-compiler/hermesc/linux64-bin/hermesc" ]; then
    HERMESC_PATH="node_modules/hermes-compiler/hermesc/linux64-bin/hermesc"
  elif [ -f "node_modules/react-native/sdks/hermesc/linux64-bin/hermesc" ]; then
    HERMESC_PATH="node_modules/react-native/sdks/hermesc/linux64-bin/hermesc"
  else
    echo -e "${RED}Error: Android hermesc not found!${NC}"
    exit 1
  fi
fi

echo "Using hermesc: $HERMESC_PATH"

# iOS bundle name is 'main.jsbundle', Android is 'index.bundle'
if [ "$PLATFORM" = "ios" ]; then
  BYTECODE_OUTPUT="$BUILD_DIR/main.jsbundle"
else
  BYTECODE_OUTPUT="$BUILD_DIR/index.bundle"
fi

$HERMESC_PATH \
  -emit-binary \
  -out "$BYTECODE_OUTPUT" \
  "$BUNDLE_OUTPUT"

echo -e "${GREEN}✓ Hermes bytecode created${NC}"
ls -lh "$BYTECODE_OUTPUT"
echo ""

# Remove temp JS bundle
rm "$BUNDLE_OUTPUT"

# ============================================
# Step 3: Package into ZIP
# ============================================
echo -e "${YELLOW}Step 3: Packaging into ZIP...${NC}"

cd "$BUILD_DIR"
ZIP_NAME="${PLATFORM}-${VERSION}.zip"

BUNDLE_FILE=$(basename "$BYTECODE_OUTPUT")

# Zip bytecode + assets
if [ -d "assets" ]; then
  zip -r "$ZIP_NAME" "$BUNDLE_FILE" assets/
else
  zip "$ZIP_NAME" "$BUNDLE_FILE"
fi

cd - > /dev/null

ZIP_PATH="$BUILD_DIR/$ZIP_NAME"
ZIP_SIZE=$(du -h "$ZIP_PATH" | cut -f1)

echo -e "${GREEN}✓ ZIP created: $ZIP_SIZE${NC}"
echo ""

# ============================================
# Step 4: Generate bundle info
# ============================================
cat > "$BUILD_DIR/bundle-info.json" <<EOF
{
  "version": "${VERSION}",
  "platform": "${PLATFORM}",
  "buildDate": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "bundleType": "hermes-bytecode",
  "zipFile": "${ZIP_NAME}",
  "zipSize": "${ZIP_SIZE}",
  "gitCommit": "$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")",
  "hermesVersion": "$($HERMESC_PATH --version 2>/dev/null || echo "unknown")"
}
EOF

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Build Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Bundle location: $BUILD_DIR"
echo "ZIP file: $ZIP_NAME"
echo "Size: $ZIP_SIZE"
echo ""
cat "$BUILD_DIR/bundle-info.json"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Test bundle locally first"
echo "2. Upload to server:"
echo "3. Update backend config:"
if [ "$PLATFORM" = "ios" ]; then
  echo "   {\"version\": \"${VERSION}\", \"downloadUrl\": \"https://du-lich.chudu24.com/upgradeapp/ios/${ZIP_NAME}\"}"
else
  echo "   {\"version\": \"${VERSION}\", \"downloadUrl\": \"https://du-lich.chudu24.com/upgradeapp/android/${ZIP_NAME}\"}"
fi
echo "4. Test OTA update on device"
echo ""
echo -e "${BLUE}Important: Bundle này chứa Hermes bytecode, tương thích với hermesEnabled=true${NC}"
