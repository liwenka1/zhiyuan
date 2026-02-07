#!/bin/bash
set -e

# Locate desktop project root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$PROJECT_DIR/../.." && pwd)"

PACKAGE_JSON="$PROJECT_DIR/package.json"
CURRENT_VERSION=$(node -p "require('$PACKAGE_JSON').version")

echo "Current version: $CURRENT_VERSION"
echo ""
echo "Enter new version (e.g. x.x.x-beta):"
read -r NEW_VERSION

if [ -z "$NEW_VERSION" ]; then
  echo "Error: version cannot be empty"
  exit 1
fi

# Update version in package.json
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('$PACKAGE_JSON', 'utf8'));
pkg.version = '$NEW_VERSION';
fs.writeFileSync('$PACKAGE_JSON', JSON.stringify(pkg, null, 2) + '\n');
"

echo ""
echo "Done: $CURRENT_VERSION -> $NEW_VERSION"

# Commit, tag, push
cd "$REPO_ROOT"
git add "$PACKAGE_JSON"
git commit -m "release: v$NEW_VERSION"
git tag "v$NEW_VERSION"
git push origin main
git push origin "v$NEW_VERSION"

echo ""
echo "Pushed tag v$NEW_VERSION, GitHub Actions will build automatically"
