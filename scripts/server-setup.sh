#!/bin/bash
#
# Mautic Platform - Server Setup Script
# Run this on a fresh Ubuntu 22.04 VPS
#
# Usage: sudo ./server-setup.sh yourdomain.com
#
# Phase 3.3 hardening: fail2ban, wildcard SSL, SSH lockdown,
# unattended-upgrades, MySQL caching_sha2_password, postfix, disk alert

set -euo pipefail

DOMAIN=${1:-""}
if [ -z "$DOMAIN" ]; then
  echo "[ERROR] Usage: $0 yourdomain.com"
  exit 1
fi

MYSQL_ROOT_PASSWORD=$(openssl rand -base64 32)
SERVER_IP=$(curl -s https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')

echo "=========================================="
echo "LeadSpot Mautic Platform — Server Setup"
echo "Domain: $DOMAIN"
echo "IP: $SERVER_IP"
echo "=========================================="

# Save credentials
mkdir -p /root/.mautic-platform
cat > /root/.mautic-platform/credentials <<CREDS
DOMAIN=${DOMAIN}
SERVER_IP=${SERVER_IP}
MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}
# Fill in these after setup:
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_DEFAULT_REGION=us-east-1
S3_BACKUP_BUCKET=leadspot-backups
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ZONE_ID=
DASHBOARD_ADMIN_TOKEN=
DASHBOARD_URL=
SES_SMTP_HOST=
SES_SMTP_PORT=587
SES_SMTP_USER=
SES_SMTP_PASS=
SES_FROM_EMAIL=noreply@${DOMAIN}
CREDS
chmod 600 /root/.mautic-platform/credentials
echo "[SETUP] Credentials saved to /root/.mautic-platform/credentials"

echo "[1/10] Updating system..."
apt update && apt upgrade -y

echo "[2/10] Installing LAMP stack + security tools..."
apt install -y \
  apache2 \
  mysql-server \
  php8.1 \
  php8.1-{mysql,xml,curl,zip,intl,mbstring,imap,gd,bcmath,soap} \
  libapache2-mod-php8.1 \
  certbot \
  python3-certbot-dns-cloudflare \
  unzip \
  git \
  curl \
  wget \
  fail2ban \
  unattended-upgrades \
  postfix \
  mailutils \
  libsasl2-modules

echo "[3/10] Configuring MySQL with caching_sha2_password..."
mysql -u root <<MYSQL_CONF
ALTER USER 'root'@'localhost' IDENTIFIED WITH caching_sha2_password BY '${MYSQL_ROOT_PASSWORD}';
DELETE FROM mysql.user WHERE User='';
DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');
DROP DATABASE IF EXISTS test;
DELETE FROM mysql.db WHERE Db='test' OR Db='test\\_%';
FLUSH PRIVILEGES;
MYSQL_CONF

echo "[4/10] Configuring Apache with security headers..."
a2enmod rewrite ssl headers remoteip
a2dismod -q status

# Enable mod_remoteip for Cloudflare IP passthrough
cat > /etc/apache2/conf-available/cloudflare-remoteip.conf <<APACHECONF
# Cloudflare IP ranges — keep in sync with https://www.cloudflare.com/ips/
RemoteIPHeader CF-Connecting-IP
RemoteIPTrustedProxy 173.245.48.0/20
RemoteIPTrustedProxy 103.21.244.0/22
RemoteIPTrustedProxy 103.22.200.0/22
RemoteIPTrustedProxy 103.31.4.0/22
RemoteIPTrustedProxy 141.101.64.0/18
RemoteIPTrustedProxy 108.162.192.0/18
RemoteIPTrustedProxy 190.93.240.0/20
RemoteIPTrustedProxy 188.114.96.0/20
RemoteIPTrustedProxy 197.234.240.0/22
RemoteIPTrustedProxy 198.41.128.0/17
RemoteIPTrustedProxy 162.158.0.0/15
RemoteIPTrustedProxy 104.16.0.0/13
RemoteIPTrustedProxy 104.24.0.0/14
RemoteIPTrustedProxy 172.64.0.0/13
RemoteIPTrustedProxy 131.0.72.0/22
RemoteIPTrustedProxy 2400:cb00::/32
RemoteIPTrustedProxy 2606:4700::/32
RemoteIPTrustedProxy 2803:f800::/32
RemoteIPTrustedProxy 2405:b500::/32
RemoteIPTrustedProxy 2405:8100::/32
RemoteIPTrustedProxy 2a06:98c0::/29
RemoteIPTrustedProxy 2c0f:f248::/32
APACHECONF
a2enconf cloudflare-remoteip

systemctl restart apache2

echo "[5/10] Configuring firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "[6/10] Hardening SSH..."
# Disable root login and password auth
sed -i \
  -e 's/^#\?PermitRootLogin.*/PermitRootLogin no/' \
  -e 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' \
  -e 's/^#\?ChallengeResponseAuthentication.*/ChallengeResponseAuthentication no/' \
  -e 's/^#\?PubkeyAuthentication.*/PubkeyAuthentication yes/' \
  /etc/ssh/sshd_config
systemctl restart ssh
echo "[SSH] Root login and password auth disabled"

echo "[7/10] Configuring fail2ban..."
cat > /etc/fail2ban/jail.local <<FAIL2BAN
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 5
backend = systemd

[sshd]
enabled = true
port    = ssh
logpath = %(sshd_log)s

[apache-auth]
enabled  = true
port     = http,https
logpath  = %(apache_error_log)s

[apache-badbots]
enabled  = true
port     = http,https
logpath  = %(apache_access_log)s
maxretry = 2

[apache-noscript]
enabled  = true
port     = http,https
logpath  = %(apache_error_log)s
FAIL2BAN
systemctl enable fail2ban
systemctl restart fail2ban
echo "[fail2ban] SSH and Apache jails enabled"

echo "[8/10] Configuring unattended-upgrades..."
cat > /etc/apt/apt.conf.d/50unattended-upgrades <<UNATTENDED
Unattended-Upgrade::Allowed-Origins {
  "\${distro_id}:\${distro_codename}-security";
  "\${distro_id}ESMApps:\${distro_codename}-apps-security";
  "\${distro_id}ESM:\${distro_codename}-infra-security";
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::Mail "root";
Unattended-Upgrade::MailReport "on-change";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
UNATTENDED
dpkg-reconfigure --frontend=noninteractive unattended-upgrades

echo "[9/10] Setting up disk alert cron (75% threshold)..."
cat > /etc/cron.d/disk-alert <<DISKCRON
# Check disk usage every 30 minutes — email root if over 75%
*/30 * * * * root df -h / | awk 'NR==2 {gsub(/%/,""); if(\$5+0 >= 75) print "DISK ALERT: " \$5"% used on " \$1}' | grep -q "DISK ALERT" && df -h / | mail -s "[LeadSpot] Disk usage alert: $(hostname)" root || true
DISKCRON

echo "[10/10] Installing Node.js 20 LTS (for dashboard)..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

echo "[10/10b] Creating directory structure..."
mkdir -p /var/www/{mautic-template,sites,dashboard}
mkdir -p /home/admin/scripts
chown -R www-data:www-data /var/www

# Set up wildcard SSL via Cloudflare DNS plugin (requires CLOUDFLARE_API_TOKEN)
echo ""
echo "[SSL] Wildcard SSL setup (requires Cloudflare token to be set in credentials first)"
echo "      Run manually after filling credentials:"
echo "      certbot certonly --dns-cloudflare \\"
echo "        --dns-cloudflare-credentials /root/.mautic-platform/cloudflare.ini \\"
echo "        -d '*.${DOMAIN}' -d '${DOMAIN}'"
echo ""
echo "      Create /root/.mautic-platform/cloudflare.ini:"
echo "        dns_cloudflare_api_token = YOUR_TOKEN"
echo "        chmod 600 /root/.mautic-platform/cloudflare.ini"

echo ""
echo "=========================================="
echo "Server setup complete!"
echo "=========================================="
echo ""
echo "Credentials saved to: /root/.mautic-platform/credentials"
echo "MySQL root password: $MYSQL_ROOT_PASSWORD"
echo ""
echo "⚠️  REQUIRED NEXT STEPS:"
echo "1. Fill in API keys in /root/.mautic-platform/credentials"
echo "2. Create /root/.mautic-platform/cloudflare.ini with CF token"
echo "3. Run certbot wildcard SSL command (see above)"
echo "4. Run: ./install-mautic-template.sh $DOMAIN"
echo ""
