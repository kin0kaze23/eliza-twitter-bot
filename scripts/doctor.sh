#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f package.json ]]; then
  echo "[doctor][fail] package.json not found"
  exit 1
fi

node -e '
  const p = require("./package.json");
  const req = ["check", "build"];
  const missing = req.filter((k) => !(p.scripts && p.scripts[k]));
  if (missing.length) {
    console.error("[doctor][fail] missing scripts:", missing.join(", "));
    process.exit(1);
  }
  console.log("[doctor][pass] required scripts present:", req.join(", "));
'

echo "[doctor][pass] ElizaDashboard 2 contract baseline ok"
