#!/usr/bin/env bash
set -euo pipefail

LABEL="io.queensladder.capture"
DEST="$HOME/Library/LaunchAgents/${LABEL}.plist"
UID_NUM="$(id -u)"

launchctl bootout "gui/${UID_NUM}/${LABEL}" 2>/dev/null || true
rm -f "$DEST"
echo "Removed LaunchAgent ${LABEL}"
