#!/usr/bin/env bash
set -euo pipefail

# Initial server setup for Hetzner VPS
# Run once on a fresh Ubuntu 22.04+ server as root
# Usage: bash setup-server.sh

echo "==> Updating system..."
apt-get update && apt-get upgrade -y

echo "==> Installing Docker..."
curl -fsSL https://get.docker.com | sh

echo "==> Installing Docker Compose plugin..."
apt-get install -y docker-compose-plugin

echo "==> Creating deploy directory..."
mkdir -p /opt/loyalty-platform/deploy
mkdir -p /opt/loyalty-platform/backups

echo "==> Creating deploy user..."
useradd -m -s /bin/bash deploy || true
usermod -aG docker deploy
chown -R deploy:deploy /opt/loyalty-platform

echo "==> Setting up firewall..."
apt-get install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> Installing fail2ban for SSH protection..."
apt-get install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban

echo "==> Installing Nginx as reverse proxy..."
apt-get install -y nginx certbot python3-certbot-nginx

echo "==> Configuring log rotation for app logs..."
cat > /etc/logrotate.d/loyalty-platform <<'LOGROTATE'
/opt/loyalty-platform/backups/*.log {
    weekly
    rotate 4
    compress
    missingok
    notifempty
}
LOGROTATE

echo "==> Server setup complete!"
echo ""
echo "Next steps:"
echo "  1. Copy project files to /opt/loyalty-platform/"
echo "  2. Copy deploy/.env.{staging|prod}.example to deploy/.env.{staging|prod} and fill in values"
echo "  3. Copy deploy/nginx.conf to /etc/nginx/sites-available/loyalty-platform"
echo "     ln -s /etc/nginx/sites-available/loyalty-platform /etc/nginx/sites-enabled/"
echo "  4. Copy deploy/nginx-rate-limit.conf to /etc/nginx/conf.d/rate-limit.conf"
echo "  5. Set up SSL: certbot --nginx -d your-domain.com"
echo "  6. Add GitHub Actions secrets:"
echo "     - HETZNER_STAGING_HOST / HETZNER_PROD_HOST"
echo "     - HETZNER_SSH_USER (deploy)"
echo "     - HETZNER_SSH_KEY (private key for deploy user)"
echo "  7. Test: nginx -t && systemctl reload nginx"
