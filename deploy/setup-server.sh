#!/usr/bin/env bash
set -euo pipefail

# Initial server setup for Hetzner VPS
# Run once on a fresh Ubuntu 22.04+ server
# Usage: bash setup-server.sh

echo "==> Updating system..."
apt-get update && apt-get upgrade -y

echo "==> Installing Docker..."
curl -fsSL https://get.docker.com | sh

echo "==> Installing Docker Compose plugin..."
apt-get install -y docker-compose-plugin

echo "==> Creating deploy directory..."
mkdir -p /opt/loyalty-platform/deploy

echo "==> Creating deploy user..."
useradd -m -s /bin/bash deploy || true
usermod -aG docker deploy

echo "==> Setting up firewall..."
apt-get install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> Installing Nginx as reverse proxy..."
apt-get install -y nginx certbot python3-certbot-nginx

echo "==> Server setup complete!"
echo ""
echo "Next steps:"
echo "  1. Copy project files to /opt/loyalty-platform/"
echo "  2. Copy deploy/.env.{staging|prod}.example to deploy/.env.{staging|prod} and fill in values"
echo "  3. Configure Nginx (see deploy/nginx.conf)"
echo "  4. Set up SSL: certbot --nginx -d your-domain.com"
echo "  5. Add GitHub Actions secrets for SSH access"
