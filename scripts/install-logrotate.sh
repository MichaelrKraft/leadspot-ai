#!/bin/bash
#
# Install Mautic Logrotate Configuration
# Copies the logrotate config to /etc/logrotate.d/ on the server
#
# Usage: sudo ./install-logrotate.sh
#

set -e

LOGROTATE_DEST="/etc/logrotate.d/mautic-tenants"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_SRC="/tmp/mautic-logrotate-config"

if [ "$(id -u)" -ne 0 ]; then
  echo "[ERROR] This script must be run as root"
  exit 1
fi

if [ ! -f "$CONFIG_SRC" ]; then
  echo "[ERROR] Logrotate config not found at: $CONFIG_SRC"
  exit 1
fi

cp "$CONFIG_SRC" "$LOGROTATE_DEST"
chmod 644 "$LOGROTATE_DEST"

echo "[OK] Logrotate config installed to $LOGROTATE_DEST"
echo "[OK] Configuration: daily rotation, 14-day retention, compressed"

# Verify the config is valid
if logrotate --debug "$LOGROTATE_DEST" > /dev/null 2>&1; then
  echo "[OK] Logrotate config syntax is valid"
else
  echo "[WARN] Logrotate config debug check returned non-zero (may be no matching log files yet)"
fi
