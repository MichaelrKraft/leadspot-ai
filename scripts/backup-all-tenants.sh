#!/usr/bin/env bash
# backup-all-tenants.sh — Nightly S3 backup for all Mautic tenant databases
#
# Enumerate tenants from PostgreSQL dashboard DB (not tenants.txt which may be stale).
# For each tenant: mysqldump | gzip → verify integrity → upload to S3 → verify size.
# Non-zero exit on any failure to trigger cron email alert.
#
# Required env (read from /root/.mautic-platform/credentials):
#   MYSQL_ROOT_PASSWORD    — MySQL root password
#   AWS_ACCESS_KEY_ID      — IAM key for S3 backup bucket
#   AWS_SECRET_ACCESS_KEY  — IAM secret for S3 backup bucket
#   AWS_DEFAULT_REGION     — AWS region (e.g. us-east-1)
#   S3_BACKUP_BUCKET       — Bucket name (e.g. leadspot-backups)
#   DASHBOARD_DB_URL       — PostgreSQL URL for dashboard DB

set -euo pipefail

CREDENTIALS_FILE="/root/.mautic-platform/credentials"
BACKUP_DIR="/tmp/mautic-backups/$(date +%Y%m%d)"
TIMESTAMP=$(date +%Y-%m-%dT%H-%M-%S)
FAILURES=0

# ─── Load credentials ───────────────────────────────────────────────────────
if [ ! -f "$CREDENTIALS_FILE" ]; then
  echo "[ERROR] Credentials file not found: $CREDENTIALS_FILE"
  exit 1
fi
# shellcheck disable=SC1090
source "$CREDENTIALS_FILE"

# Verify required variables are set
for var in MYSQL_ROOT_PASSWORD AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_DEFAULT_REGION S3_BACKUP_BUCKET DASHBOARD_DB_URL; do
  if [ -z "${!var:-}" ]; then
    echo "[ERROR] Required variable not set: $var"
    exit 1
  fi
done

export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_DEFAULT_REGION

# ─── Setup ──────────────────────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"
echo "[INFO] Backup started at $(date)"
echo "[INFO] Backup directory: $BACKUP_DIR"

# ─── Enumerate tenants from dashboard DB ────────────────────────────────────
# Query the Tenant table to get all tenant names (slug = MySQL DB name prefix)
TENANT_SLUGS=$(psql "$DASHBOARD_DB_URL" -At -c "SELECT name FROM \"Tenant\" ORDER BY name;" 2>&1)

if [ -z "$TENANT_SLUGS" ]; then
  echo "[WARN] No tenants found in dashboard DB — checking tenants.txt fallback"
  if [ -f /root/.mautic-platform/tenants.txt ]; then
    TENANT_SLUGS=$(awk -F: '{print $1}' /root/.mautic-platform/tenants.txt | sort -u)
    echo "[INFO] Using tenants.txt fallback: $(echo "$TENANT_SLUGS" | wc -w) tenants"
  else
    echo "[ERROR] No tenant source available"
    exit 1
  fi
fi

TENANT_COUNT=$(echo "$TENANT_SLUGS" | wc -w)
echo "[INFO] Backing up $TENANT_COUNT tenant(s)"

# ─── Backup loop ────────────────────────────────────────────────────────────
for TENANT in $TENANT_SLUGS; do
  DB_NAME="${TENANT}_db"
  BACKUP_FILE="$BACKUP_DIR/${TENANT}-${TIMESTAMP}.sql.gz"
  S3_KEY="tenants/${TENANT}/${TIMESTAMP}.sql.gz"

  echo "[INFO] → Backing up tenant: $TENANT (DB: $DB_NAME)"

  # 1. Verify DB exists
  if ! mysql -u root -p"${MYSQL_ROOT_PASSWORD}" -e "USE \`${DB_NAME}\`;" 2>/dev/null; then
    echo "[WARN] Database not found: $DB_NAME — skipping"
    FAILURES=$((FAILURES + 1))
    continue
  fi

  # 2. Dump and compress atomically
  if ! mysqldump \
    -u root -p"${MYSQL_ROOT_PASSWORD}" \
    --single-transaction \
    --routines \
    --triggers \
    --add-drop-table \
    --default-character-set=utf8mb4 \
    "${DB_NAME}" | gzip -9 > "${BACKUP_FILE}"; then
    echo "[ERROR] mysqldump failed for $TENANT"
    FAILURES=$((FAILURES + 1))
    continue
  fi

  # 3. Verify gzip integrity before uploading
  if ! gzip -t "${BACKUP_FILE}" 2>/dev/null; then
    echo "[ERROR] Corrupt backup file for $TENANT: $BACKUP_FILE"
    rm -f "${BACKUP_FILE}"
    FAILURES=$((FAILURES + 1))
    continue
  fi

  LOCAL_SIZE=$(stat -c%s "${BACKUP_FILE}" 2>/dev/null || stat -f%z "${BACKUP_FILE}" 2>/dev/null || echo 0)
  echo "[INFO] Local backup size: $LOCAL_SIZE bytes"

  # 4. Upload to S3
  if ! aws s3 cp "${BACKUP_FILE}" "s3://${S3_BACKUP_BUCKET}/${S3_KEY}" \
    --storage-class STANDARD_IA \
    --no-progress; then
    echo "[ERROR] S3 upload failed for $TENANT"
    FAILURES=$((FAILURES + 1))
    continue
  fi

  # 5. Verify S3 object size matches local
  S3_SIZE=$(aws s3api head-object \
    --bucket "${S3_BACKUP_BUCKET}" \
    --key "${S3_KEY}" \
    --query ContentLength \
    --output text 2>/dev/null || echo 0)

  if [ "$LOCAL_SIZE" != "$S3_SIZE" ]; then
    echo "[ERROR] Size mismatch for $TENANT: local=$LOCAL_SIZE S3=$S3_SIZE"
    FAILURES=$((FAILURES + 1))
    continue
  fi

  echo "[OK] $TENANT backed up and verified (${LOCAL_SIZE} bytes → s3://${S3_BACKUP_BUCKET}/${S3_KEY})"

  # 6. Clean up local file
  rm -f "${BACKUP_FILE}"
done

# ─── Cleanup temp dir ────────────────────────────────────────────────────────
rmdir "${BACKUP_DIR}" 2>/dev/null || true

# ─── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo "[INFO] Backup completed at $(date)"
echo "[INFO] Tenants: $TENANT_COUNT | Failures: $FAILURES"

if [ "$FAILURES" -gt 0 ]; then
  echo "[FAIL] $FAILURES backup(s) failed — cron email alert should fire"
  exit 1
fi

echo "[SUCCESS] All $TENANT_COUNT tenants backed up successfully"
exit 0
