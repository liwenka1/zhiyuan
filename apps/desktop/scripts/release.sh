#!/bin/bash
set -e

# Locate desktop project root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$PROJECT_DIR/../.." && pwd)"

PACKAGE_JSON="$PROJECT_DIR/package.json"
CURRENT_VERSION=$(node -p 'require(process.argv[1]).version' "$PACKAGE_JSON")

echo "Current version: $CURRENT_VERSION"
echo ""
echo "Enter new version (e.g. x.x.x or x.x.x-beta):"
read -r NEW_VERSION

if ! [[ "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$ ]]; then
  echo "Error: expected version x.y.z or x.y.z-suffix" >&2
  exit 1
fi

# Update version in package.json
node - "$PACKAGE_JSON" "$NEW_VERSION" <<'JS'
const fs = require("node:fs");
const [, , file, version] = process.argv;
const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
pkg.version = version;
fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
JS

echo ""
echo "Done: $CURRENT_VERSION -> $NEW_VERSION"

# Commit, tag, push
cd "$REPO_ROOT"
git commit --only -m "release: v$NEW_VERSION" -- "$PACKAGE_JSON"
git tag "v$NEW_VERSION"
git push origin main
git push origin "v$NEW_VERSION"

echo ""
echo "Pushed tag v$NEW_VERSION, GitHub Actions will build automatically"
