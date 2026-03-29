#!/bin/bash
#
# Create New Tenant from Template
# Clones the template Mautic instance for a new client
#
# Usage: sudo ./create-tenant.sh clientname
#

set -e

# ---------------------------------------------------------------------------
# Rollback state tracking
# ---------------------------------------------------------------------------
TENANT_NAME=""
APACHE_VHOST_CREATED=false
DB_CREATED=false
CF_RECORD_ID=""

cleanup() {
  echo "[ERROR] Provisioning failed — rolling back tenant: $TENANT_NAME"

  # Remove Apache vhost
  if [ "$APACHE_VHOST_CREATED" = "true" ]; then
    rm -f "/etc/apache2/sites-enabled/${TENANT_NAME}.conf"
    rm -f "/etc/apache2/sites-available/${TENANT_NAME}.conf"
    rm -f "/etc/apache2/sites-enabled/mautic-${TENANT_NAME}.conf"
    rm -f "/etc/apache2/sites-available/mautic-${TENANT_NAME}.conf"
    rm -f "/etc/apache2/sites-enabled/mautic-${TENANT_NAME}-ssl.conf"
    rm -f "/etc/apache2/sites-available/mautic-${TENANT_NAME}-ssl.conf"
    systemctl reload apache2 2>/dev/null || true
  fi

  # Drop MySQL database and user
  if [ "$DB_CREATED" = "true" ]; then
    mysql -u root -p"${MYSQL_ROOT_PASSWORD}" \
      -e "DROP DATABASE IF EXISTS ${TENANT_NAME}_db; DROP USER IF EXISTS '${TENANT_NAME}_user'@'localhost';" \
      2>/dev/null || true
  fi

  # Remove Cloudflare DNS record
  if [ -n "$CF_RECORD_ID" ]; then
    local CF_ZONE_ID
    CF_ZONE_ID=$(cat /root/.mautic-platform/cloudflare-zone-id 2>/dev/null || echo "")
    local CF_API_TOKEN
    CF_API_TOKEN=$(cat /root/.mautic-platform/cloudflare-api-token 2>/dev/null || echo "")
    if [ -n "$CF_ZONE_ID" ] && [ -n "$CF_API_TOKEN" ]; then
      curl -s -X DELETE \
        "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records/${CF_RECORD_ID}" \
        -H "Authorization: Bearer ${CF_API_TOKEN}" || true
    fi
  fi

  # Remove Mautic files
  rm -rf "/var/www/mautic-${TENANT_NAME}" 2>/dev/null || true

  # Remove temp CF record id file
  rm -f "/tmp/cf-record-id-${TENANT_NAME}" 2>/dev/null || true

  echo "[ROLLBACK] Cleanup complete."
}

trap cleanup ERR

# ---------------------------------------------------------------------------
# Argument validation
# ---------------------------------------------------------------------------
TENANT_NAME=$1

if [ -z "$TENANT_NAME" ]; then
    echo "Usage: ./create-tenant.sh clientname"
    echo "Example: ./create-tenant.sh acme"
    exit 1
fi

# Sanitize to lowercase, strip leading/trailing whitespace
TENANT_NAME=$(echo "$TENANT_NAME" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')

# Slug length check
if [ ${#TENANT_NAME} -lt 2 ]; then
  echo "[ERROR] Tenant name must be at least 2 characters"
  exit 1
fi

# Slug character check: must start with a letter, then lowercase alphanumeric or hyphens
if ! echo "$TENANT_NAME" | grep -qE '^[a-z][a-z0-9-]*$'; then
  echo "[ERROR] Tenant name must be lowercase alphanumeric with hyphens only (must start with a letter)"
  exit 1
fi

# Block SQL reserved words
SQL_RESERVED="select|insert|update|delete|drop|create|alter|table|index|view|database|schema|user|grant|revoke|primary|foreign|key|unique|constraint|default|null|not|and|or|where|from|join|order|group|having|union|limit|offset"
if echo "$TENANT_NAME" | grep -qiE "^(${SQL_RESERVED})$"; then
  echo "[ERROR] Tenant name cannot be a SQL reserved word"
  exit 1
fi

# ---------------------------------------------------------------------------
# Load credentials
# ---------------------------------------------------------------------------
if [ ! -f /root/.mautic-platform/credentials ]; then
  echo "[ERROR] /root/.mautic-platform/credentials not found"
  exit 1
fi
source /root/.mautic-platform/credentials
# Expects: DOMAIN, MYSQL_ROOT_PASSWORD, SERVER_IP, DASHBOARD_URL, DASHBOARD_ADMIN_TOKEN
# SES: SES_SMTP_HOST, SES_SMTP_PORT, SES_SMTP_USER, SES_SMTP_PASS, SES_FROM_EMAIL

# Load Cloudflare credentials
CF_ZONE_ID=$(cat /root/.mautic-platform/cloudflare-zone-id 2>/dev/null || echo "")
CF_API_TOKEN=$(cat /root/.mautic-platform/cloudflare-api-token 2>/dev/null || echo "")

TEMPLATE_DIR="/var/www/mautic-template"
TENANT_DIR="/var/www/mautic-$TENANT_NAME"
TENANT_DB="${TENANT_NAME}_db"
TENANT_USER="${TENANT_NAME}_user"
TENANT_PASS=$(openssl rand -base64 16)

echo "=========================================="
echo "Creating Tenant: $TENANT_NAME"
echo "=========================================="

# Check if tenant already exists
if [ -d "$TENANT_DIR" ]; then
    echo "ERROR: Tenant directory already exists: $TENANT_DIR"
    exit 1
fi

# ---------------------------------------------------------------------------
# Step 1: Create Cloudflare DNS record FIRST (propagation takes time)
# ---------------------------------------------------------------------------
echo "[1/7] Creating Cloudflare DNS record..."

if [ -z "$CF_ZONE_ID" ] || [ -z "$CF_API_TOKEN" ]; then
  echo "[ERROR] Cloudflare zone ID or API token not found in /root/.mautic-platform/"
  exit 1
fi

CF_RECORD_ID=$(curl -s -X POST \
  "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data "{\"type\":\"A\",\"name\":\"${TENANT_NAME}.${DOMAIN}\",\"content\":\"${SERVER_IP}\",\"ttl\":300,\"proxied\":false}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result']['id'] if d.get('success') else '')")

if [ -z "$CF_RECORD_ID" ]; then
  echo "[ERROR] Failed to create Cloudflare DNS record"
  exit 1
fi

echo "$CF_RECORD_ID" > "/tmp/cf-record-id-${TENANT_NAME}"
echo "[OK] DNS record created: ${CF_RECORD_ID}"

# ---------------------------------------------------------------------------
# Step 2: Create database and user
# ---------------------------------------------------------------------------
echo "[2/7] Creating database and user..."
mysql -u root -p"$MYSQL_ROOT_PASSWORD" <<EOF
CREATE DATABASE IF NOT EXISTS $TENANT_DB;
CREATE USER IF NOT EXISTS '$TENANT_USER'@'localhost' IDENTIFIED BY '$TENANT_PASS';
GRANT ALL PRIVILEGES ON $TENANT_DB.* TO '$TENANT_USER'@'localhost';
FLUSH PRIVILEGES;
EOF
DB_CREATED=true

echo "[3/7] Cloning template database..."
mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" mautic_template > /tmp/template_dump.sql
mysql -u root -p"$MYSQL_ROOT_PASSWORD" $TENANT_DB < /tmp/template_dump.sql
rm /tmp/template_dump.sql

# Update domain references in database
mysql -u root -p"$MYSQL_ROOT_PASSWORD" $TENANT_DB <<EOF
UPDATE site_parameters SET value = REPLACE(value, 'template.$DOMAIN', '$TENANT_NAME.$DOMAIN') WHERE value LIKE '%template.$DOMAIN%';
UPDATE emails SET custom_html = REPLACE(custom_html, 'template.$DOMAIN', '$TENANT_NAME.$DOMAIN') WHERE custom_html LIKE '%template.$DOMAIN%';
UPDATE pages SET custom_html = REPLACE(custom_html, 'template.$DOMAIN', '$TENANT_NAME.$DOMAIN') WHERE custom_html LIKE '%template.$DOMAIN%';
EOF

# ---------------------------------------------------------------------------
# Step 3: Copy Mautic files
# ---------------------------------------------------------------------------
echo "[4/7] Copying Mautic files..."
cp -r $TEMPLATE_DIR $TENANT_DIR
chown -R www-data:www-data $TENANT_DIR

# ---------------------------------------------------------------------------
# Step 4: Write local.php with SES credentials from secure file
# ---------------------------------------------------------------------------
echo "[5/7] Updating local.php configuration..."
cat > $TENANT_DIR/app/config/local.php <<EOF
<?php
\$parameters = array(
    'db_driver' => 'pdo_mysql',
    'db_host' => 'localhost',
    'db_port' => 3306,
    'db_name' => '$TENANT_DB',
    'db_user' => '$TENANT_USER',
    'db_password' => '$TENANT_PASS',
    'db_table_prefix' => '',
    'db_backup_tables' => true,
    'db_backup_prefix' => 'bak_',
    'site_url' => 'https://$TENANT_NAME.$DOMAIN',
    'secret_key' => '$(openssl rand -hex 32)',
    'mailer_transport' => 'smtp',
    'mailer_host' => '$SES_SMTP_HOST',
    'mailer_port' => $SES_SMTP_PORT,
    'mailer_encryption' => 'tls',
    'mailer_user' => '$SES_SMTP_USER',
    'mailer_password' => '$SES_SMTP_PASS',
    'mailer_from_name' => '$TENANT_NAME',
    'mailer_from_email' => '$SES_FROM_EMAIL',
);
EOF

# ---------------------------------------------------------------------------
# Step 5: Create Apache virtual host
# ---------------------------------------------------------------------------
echo "[6/7] Creating Apache virtual host..."
cat > /etc/apache2/sites-available/mautic-$TENANT_NAME.conf <<EOF
<VirtualHost *:80>
    ServerName $TENANT_NAME.$DOMAIN
    DocumentRoot $TENANT_DIR/docroot

    <Directory $TENANT_DIR/docroot>
        AllowOverride All
        Require all granted
    </Directory>

    ErrorLog \${APACHE_LOG_DIR}/mautic-$TENANT_NAME-error.log
    CustomLog \${APACHE_LOG_DIR}/mautic-$TENANT_NAME-access.log combined
</VirtualHost>
EOF

a2ensite mautic-$TENANT_NAME
systemctl reload apache2
APACHE_VHOST_CREATED=true

# SSL certificate (uses wildcard if available, otherwise individual cert)
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    echo "[6b/7] Using wildcard SSL certificate..."
    cat > /etc/apache2/sites-available/mautic-$TENANT_NAME-ssl.conf <<EOF
<VirtualHost *:443>
    ServerName $TENANT_NAME.$DOMAIN
    DocumentRoot $TENANT_DIR/docroot

    <Directory $TENANT_DIR/docroot>
        AllowOverride All
        Require all granted
    </Directory>

    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/$DOMAIN/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/$DOMAIN/privkey.pem

    ErrorLog \${APACHE_LOG_DIR}/mautic-$TENANT_NAME-error.log
    CustomLog \${APACHE_LOG_DIR}/mautic-$TENANT_NAME-access.log combined
</VirtualHost>
EOF
    a2ensite mautic-$TENANT_NAME-ssl
    systemctl reload apache2
else
    echo "[6b/7] Requesting individual SSL certificate..."
    certbot --apache -d $TENANT_NAME.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN --redirect || {
        echo "WARNING: SSL setup failed. Run manually: certbot --apache -d $TENANT_NAME.$DOMAIN"
    }
fi

# ---------------------------------------------------------------------------
# Step 6: Set up cron jobs (staggered to avoid thundering herd)
# ---------------------------------------------------------------------------
echo "[7a/7] Setting up cron jobs..."

# Stagger cron jobs to avoid thundering herd
TENANT_COUNT=$(find /etc/apache2/sites-enabled/ -name "*.conf" | wc -l)
CRON_OFFSET=$((TENANT_COUNT % 10))

cat >> /etc/cron.d/mautic-tenants <<EOF

# Mautic Tenant: $TENANT_NAME (offset: ${CRON_OFFSET}m)
*/${CRON_OFFSET:-1} * * * * www-data php $TENANT_DIR/bin/console mautic:segments:update --no-interaction >> /var/log/mautic/$TENANT_NAME-segments.log 2>&1
* * * * * www-data php $TENANT_DIR/bin/console mautic:campaigns:update --no-interaction >> /var/log/mautic/$TENANT_NAME-campaigns.log 2>&1
* * * * * www-data php $TENANT_DIR/bin/console mautic:campaigns:trigger --no-interaction >> /var/log/mautic/$TENANT_NAME-trigger.log 2>&1
* * * * * www-data php $TENANT_DIR/bin/console mautic:emails:send --no-interaction >> /var/log/mautic/$TENANT_NAME-emails.log 2>&1
* * * * * www-data php $TENANT_DIR/bin/console mautic:broadcasts:send --no-interaction >> /var/log/mautic/$TENANT_NAME-broadcasts.log 2>&1
*/5 * * * * www-data php $TENANT_DIR/bin/console mautic:import --no-interaction >> /var/log/mautic/$TENANT_NAME-import.log 2>&1
* * * * * www-data php $TENANT_DIR/bin/console mautic:webhooks:process --no-interaction >> /var/log/mautic/$TENANT_NAME-webhooks.log 2>&1
EOF

# Clear cache
cd $TENANT_DIR
php bin/console cache:clear --no-interaction 2>/dev/null || true

# Save tenant credentials locally
cat >> /root/.mautic-platform/tenants.txt <<EOF
--- Tenant: $TENANT_NAME ---
URL: https://$TENANT_NAME.$DOMAIN
Database: $TENANT_DB
DB User: $TENANT_USER
DB Password: $TENANT_PASS
Directory: $TENANT_DIR
CF DNS Record ID: $CF_RECORD_ID
Created: $(date)

EOF

# ---------------------------------------------------------------------------
# Step 7 (FINAL): Register tenant in dashboard database
# ---------------------------------------------------------------------------
echo "[7b/7] Registering tenant in dashboard..."

# Generate OAuth credentials placeholder (admin must set real values in Mautic)
MAUTIC_CLIENT_ID="pending-setup"
MAUTIC_CLIENT_SECRET="pending-setup"

curl -s -X POST \
  "${DASHBOARD_URL}/api/admin/tenants" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${DASHBOARD_ADMIN_TOKEN}" \
  --data "{\"name\":\"${TENANT_NAME}\",\"mauticUrl\":\"https://${TENANT_NAME}.${DOMAIN}\",\"mauticClientId\":\"${MAUTIC_CLIENT_ID}\",\"mauticClientSecret\":\"${MAUTIC_CLIENT_SECRET}\"}" || true

# Clean up temp file
rm -f "/tmp/cf-record-id-${TENANT_NAME}"

echo ""
echo "=========================================="
echo "Tenant Created Successfully!"
echo "=========================================="
echo ""
echo "Tenant: $TENANT_NAME"
echo "URL: https://$TENANT_NAME.$DOMAIN"
echo "Database: $TENANT_DB"
echo "Directory: $TENANT_DIR"
echo "CF DNS Record: $CF_RECORD_ID"
echo ""
echo "Credentials saved to: /root/.mautic-platform/tenants.txt"
echo ""
echo "Next steps:"
echo "1. Create OAuth API credentials in Mautic admin (Settings > API Credentials)"
echo "2. Update tenant OAuth credentials in dashboard"
echo ""
