#!/bin/bash
# Build macOS .pkg installer for CodeOllie CLI
# Requires: pkgbuild, productbuild (built-in on macOS)

set -e

APP_NAME="CodeOllie"
VERSION="1.0.0"
BINARY="../CodeOllie-macos"
PKG_ROOT="../dist-pkg-root"
PKG_OUTPUT="../CodeOllie-$VERSION.pkg"

if [ ! -f "$BINARY" ]; then
  echo "Error: $BINARY not found. Run 'npm run build:macos' first."
  exit 1
fi

echo "Creating package root..."
rm -rf "$PKG_ROOT"
mkdir -p "$PKG_ROOT/usr/local/bin"
mkdir -p "$PKG_ROOT/usr/local/share/codeollie"

cp "$BINARY" "$PKG_ROOT/usr/local/bin/codeollie"
chmod +x "$PKG_ROOT/usr/local/bin/codeollie"

echo "Building component package..."
pkgbuild --root "$PKG_ROOT" \
         --identifier "com.concord.codeollie" \
         --version "$VERSION" \
         --install-location "/" \
         "${PKG_ROOT}/Components/CodeOllie.pkg"

echo "Building distribution package..."
productbuild --package "${PKG_ROOT}/Components/CodeOllie.pkg" \
             --identifier "com.concord.codeollie" \
             --version "$VERSION" \
             "$PKG_OUTPUT"

echo "Successfully created $PKG_OUTPUT"

# Cleanup
rm -rf "$PKG_ROOT"
