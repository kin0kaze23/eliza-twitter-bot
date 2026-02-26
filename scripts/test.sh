#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if node -e 'const p=require("./package.json"); process.exit(p.scripts && p.scripts.test ? 0 : 1)'; then
  CI=1 npm run test -- --run
else
  echo "[test] no package test script; falling back to typecheck gate"
  npm run check
fi
