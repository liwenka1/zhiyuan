#!/bin/bash
set -e

# 定位到 desktop 项目根目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$PROJECT_DIR/../.." && pwd)"

PACKAGE_JSON="$PROJECT_DIR/package.json"
CURRENT_VERSION=$(node -p "require('$PACKAGE_JSON').version")

echo "当前版本: $CURRENT_VERSION"
echo ""
echo "请输入新版本号 (例如 x.x.x-beta):"
read -r NEW_VERSION

if [ -z "$NEW_VERSION" ]; then
  echo "版本号不能为空"
  exit 1
fi

# 更新 package.json 中的版本号
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('$PACKAGE_JSON', 'utf8'));
pkg.version = '$NEW_VERSION';
fs.writeFileSync('$PACKAGE_JSON', JSON.stringify(pkg, null, 2) + '\n');
"

echo ""
echo "✓ 版本号已更新: $CURRENT_VERSION → $NEW_VERSION"

# 提交、打 tag、推送
cd "$REPO_ROOT"
git add "$PACKAGE_JSON"
git commit -m "release: v$NEW_VERSION"
git tag "v$NEW_VERSION"
git push origin main
git push origin "v$NEW_VERSION"

echo ""
echo "✓ 已推送 tag v$NEW_VERSION，GitHub Actions 将自动构建"
