#!/usr/bin/env bash
set -euo pipefail

# Setup wildcard SSL certificate for *.preview.loyali.online
# This uses Let's Encrypt with DNS-01 challenge (manual or via Cloudflare plugin)
#
# Prerequisites:
#   1. DNS: Add a wildcard A record  *.preview.loyali.online -> <server-ip>
#   2. Run this script on the server as root
#
# For automatic renewal with Cloudflare DNS:
#   apt install python3-certbot-dns-cloudflare
#   Create /etc/letsencrypt/cloudflare.ini with:
#     dns_cloudflare_api_token = <your-token>
#   chmod 600 /etc/letsencrypt/cloudflare.ini
#   Then use: certbot certonly --dns-cloudflare ... (see below)

echo "==> Setting up wildcard SSL for *.preview.loyali.online"

# Create previews nginx directory
mkdir -p /etc/nginx/previews

# Check if Cloudflare DNS plugin is available
if command -v certbot >/dev/null 2>&1 && dpkg -l python3-certbot-dns-cloudflare >/dev/null 2>&1; then
  echo "==> Using Cloudflare DNS plugin for automatic validation..."

  if [ ! -f /etc/letsencrypt/cloudflare.ini ]; then
    echo "ERROR: /etc/letsencrypt/cloudflare.ini not found."
    echo "Create it with your Cloudflare API token:"
    echo "  echo 'dns_cloudflare_api_token = YOUR_TOKEN' > /etc/letsencrypt/cloudflare.ini"
    echo "  chmod 600 /etc/letsencrypt/cloudflare.ini"
    exit 1
  fi

  certbot certonly \
    --dns-cloudflare \
    --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
    -d "*.preview.loyali.online" \
    --cert-name preview.loyali.online \
    --agree-tos \
    --non-interactive

else
  echo "==> Using manual DNS challenge (you'll need to create a TXT record)..."
  echo ""
  echo "When prompted, create a DNS TXT record for:"
  echo "  _acme-challenge.preview.loyali.online"
  echo ""

  certbot certonly \
    --manual \
    --preferred-challenges dns \
    -d "*.preview.loyali.online" \
    --cert-name preview.loyali.online \
    --agree-tos
fi

echo ""
echo "==> Wildcard SSL certificate installed!"
echo ""
echo "Certificate files:"
echo "  /etc/letsencrypt/live/preview.loyali.online/fullchain.pem"
echo "  /etc/letsencrypt/live/preview.loyali.online/privkey.pem"
echo ""
echo "Next steps:"
echo "  1. Ensure DNS wildcard record exists: *.preview.loyali.online -> $(curl -s ifconfig.me)"
echo "  2. Open a PR to test: preview will be at pr-N.preview.loyali.online"
