#!/usr/bin/env bash
set -euo pipefail

# Usage: preview-cleanup.sh <pr-number>
# Tears down a preview environment for a pull request

PR_NUMBER="${1:?Usage: preview-cleanup.sh <pr-number>}"
DEPLOY_DIR="/opt/loyalty-platform"
DB_NAME="loyalty_preview_pr_${PR_NUMBER}"
PROJECT_NAME="loyalty-preview-pr-${PR_NUMBER}"
COMPOSE_OVERRIDE="$DEPLOY_DIR/docker-compose.preview-pr-${PR_NUMBER}.yml"

cd "$DEPLOY_DIR"

# Load production env for shared DB credentials
if [ -f "$DEPLOY_DIR/deploy/.env.prod" ]; then
  set -a
  source "$DEPLOY_DIR/deploy/.env.prod"
  set +a
fi

echo "==> Cleaning up preview for PR #${PR_NUMBER}"

# Stop and remove the preview containers
if [ -f "$COMPOSE_OVERRIDE" ]; then
  COMPOSE_FILE="docker-compose.yml:docker-compose.prod.yml:${COMPOSE_OVERRIDE}" \
    docker compose -p "$PROJECT_NAME" down --remove-orphans -v 2>/dev/null || true
  rm -f "$COMPOSE_OVERRIDE"
  echo "==> Preview containers removed"
else
  echo "==> No compose override found for PR #${PR_NUMBER}"
fi

# Remove nginx preview config and SSL cert
PREVIEW_DOMAIN="pr-${PR_NUMBER}.preview.loyali.online"
NGINX_PREVIEW_CONF="/etc/nginx/previews/pr-${PR_NUMBER}.conf"
if [ -f "$NGINX_PREVIEW_CONF" ]; then
  rm -f "$NGINX_PREVIEW_CONF"
  sudo nginx -t && sudo systemctl reload nginx && echo "==> Nginx config removed for ${PREVIEW_DOMAIN}" || true
else
  echo "==> No nginx preview config found for PR #${PR_NUMBER}"
fi

# Delete the SSL cert (non-blocking)
sudo certbot delete --cert-name "${PREVIEW_DOMAIN}" --non-interactive 2>/dev/null || true

# Clean up dangling images
docker image prune -f 2>/dev/null || true

echo "==> Preview cleanup for PR #${PR_NUMBER} complete!"
