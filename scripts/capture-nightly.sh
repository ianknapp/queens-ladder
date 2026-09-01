#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PATH="/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
mkdir -p "$ROOT/data"
LOG="$ROOT/data/capture.log"

{
  echo "===== $(date '+%Y-%m-%d %H:%M:%S %Z') capture start ====="
  npm run capture -- --headless --kind=scheduled_final
  echo "===== $(date '+%Y-%m-%d %H:%M:%S %Z') capture done ====="
} >>"$LOG" 2>&1
