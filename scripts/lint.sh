#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if node -e 'const p=require("./package.json"); process.exit(p.scripts && p.scripts.lint ? 0 : 1)'; then
  npm run lint
else
  npm run check
fi
