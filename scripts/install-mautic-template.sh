#!/bin/bash
#
# Install Mautic Template Instance
# This creates the "golden" template that will be cloned for each tenant
#
# Usage: sudo ./install-mautic-template.sh yourdomain.com
#

set -e

DOMAIN=${1:-"ploink.site"}
MAUTIC_VERSION="5.1.1"  # Check https://github.com/mautic/mautic/releases for latest
MAUTIC_DIR="/var/www/mautic-template"

# Load credentials
source /root/.mautic-platform/credentials

echo "=========================================="
echo "Installing Mautic Template Instance"
echo "Domain: $DOMAIN"
echo "=========================================="

echo "[1/8] Creating template database..."
mysql -u root -p"$MYSQL_ROOT_PASSWORD" <<EOF
CREATE DATABASE IF NOT EXISTS mautic_template;
CREATE USER IF NOT EXISTS 'mautic_template'@'localhost' IDENTIFIED BY 'template_$(openssl rand -hex 8)';
GRANT ALL PRIVILEGES ON mautic_template.* TO 'mautic_template'@'localhost';
FLUSH PRIVILEGES;
EOF

# Get the generated password
TEMPLATE_DB_PASS=$(mysql -u root -p"$MYSQL_ROOT_PASSWORD" -N -e "SELECT authentication_string FROM mysql.user WHERE user='mautic_template'" 2>/dev/null || echo "template_password")

echo "[2/8] Downloading Mautic $MAUTIC_VERSION..."
cd /var/www
wget -q "https://github.com/mautic/mautic/releases/download/$MAUTIC_VERSION/$MAUTIC_VERSION.zip" -O mautic.zip
unzip -q mautic.zip -d mautic-template
rm mautic.zip

echo "[3/8] Setting permissions..."
chown -R www-data:www-data $MAUTIC_DIR
chmod -R 755 $MAUTIC_DIR

echo "[4/8] Creating Apache virtual host..."
cat > /etc/apache2/sites-available/mautic-template.conf <<EOF
<VirtualHost *:80>
    ServerName template.$DOMAIN
    DocumentRoot $MAUTIC_DIR/docroot

    <Directory $MAUTIC_DIR/docroot>
        AllowOverride All
        Require all granted
    </Directory>

    ErrorLog \${APACHE_LOG_DIR}/mautic-template-error.log
    CustomLog \${APACHE_LOG_DIR}/mautic-template-access.log combined
</VirtualHost>
EOF

a2ensite mautic-template
systemctl reload apache2

echo "[5/8] Setting up SSL certificate..."
certbot --apache -d template.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN --redirect || {
    echo "WARNING: SSL setup failed. You may need to run certbot manually."
    echo "Run: certbot --apache -d template.$DOMAIN"
}

echo "[6/8] Creating Mautic local.php config..."
cat > $MAUTIC_DIR/app/config/local.php <<EOF
<?php
\$parameters = array(
    'db_driver' => 'pdo_mysql',
    'db_host' => 'localhost',
    'db_port' => 3306,
    'db_name' => 'mautic_template',
    'db_user' => 'mautic_template',
    'db_password' => 'REPLACE_WITH_ACTUAL_PASSWORD',
    'db_table_prefix' => '',
    'db_backup_tables' => true,
    'db_backup_prefix' => 'bak_',
    'site_url' => 'https://template.$DOMAIN',
    'secret_key' => '$(openssl rand -hex 32)',
    'mailer_transport' => 'smtp',
    'mailer_host' => 'email-smtp.us-east-1.amazonaws.com',
    'mailer_port' => 587,
    'mailer_encryption' => 'tls',
    'mailer_user' => 'REPLACE_WITH_SES_USER',
    'mailer_password' => 'REPLACE_WITH_SES_PASSWORD',
    'mailer_from_name' => 'Your Platform',
    'mailer_from_email' => 'noreply@$DOMAIN',
);
EOF

echo "[7/8] Setting up cron jobs..."
cat > /etc/cron.d/mautic-template <<EOF
# Mautic Template Instance Cron Jobs
# Run every minute for real-time automation

* * * * * www-data php $MAUTIC_DIR/bin/console mautic:segments:update --no-interaction >> /var/log/mautic/template-segments.log 2>&1
* * * * * www-data php $MAUTIC_DIR/bin/console mautic:campaigns:update --no-interaction >> /var/log/mautic/template-campaigns.log 2>&1
* * * * * www-data php $MAUTIC_DIR/bin/console mautic:campaigns:trigger --no-interaction >> /var/log/mautic/template-trigger.log 2>&1
* * * * * www-data php $MAUTIC_DIR/bin/console mautic:emails:send --no-interaction >> /var/log/mautic/template-emails.log 2>&1
* * * * * www-data php $MAUTIC_DIR/bin/console mautic:broadcasts:send --no-interaction >> /var/log/mautic/template-broadcasts.log 2>&1
*/5 * * * * www-data php $MAUTIC_DIR/bin/console mautic:import --no-interaction >> /var/log/mautic/template-import.log 2>&1
* * * * * www-data php $MAUTIC_DIR/bin/console mautic:webhooks:process --no-interaction >> /var/log/mautic/template-webhooks.log 2>&1
EOF

mkdir -p /var/log/mautic
chown www-data:www-data /var/log/mautic

echo "[8/8] Final setup..."
# Clear cache
cd $MAUTIC_DIR
php bin/console cache:clear --no-interaction || true

echo ""
echo "=========================================="
echo "Mautic Template Installation Complete!"
echo "=========================================="
echo ""
echo "IMPORTANT: Complete the web installer at:"
echo "https://template.$DOMAIN"
echo ""
echo "You'll need to:"
echo "1. Complete the web-based installation wizard"
echo "2. Update local.php with SES credentials"
echo "3. Configure Twilio plugin"
echo "4. Build your template campaigns/automations"
echo ""
echo "Template database: mautic_template"
echo "Template directory: $MAUTIC_DIR"
echo ""
