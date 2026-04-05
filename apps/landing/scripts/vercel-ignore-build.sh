#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT_DIR"

CURRENT_SHA="${VERCEL_GIT_COMMIT_SHA:-}"
PREVIOUS_SHA="${VERCEL_GIT_PREVIOUS_SHA:-}"

if [[ -z "$CURRENT_SHA" || -z "$PREVIOUS_SHA" ]]; then
  echo "Missing Vercel git SHA metadata, proceeding with build."
  exit 1
fi

if ! git rev-parse --verify "$CURRENT_SHA" >/dev/null 2>&1 || ! git rev-parse --verify "$PREVIOUS_SHA" >/dev/null 2>&1; then
  echo "Unable to resolve commit range, proceeding with build."
  exit 1
fi

if ! git diff --quiet "$PREVIOUS_SHA" "$CURRENT_SHA" -- \
  apps/landing \
  package.json \
  pnpm-lock.yaml \
  pnpm-workspace.yaml; then
  echo "Landing-related files changed, proceeding with build."
  exit 1
fi

echo "Only non-landing files changed, skipping build."
exit 0
