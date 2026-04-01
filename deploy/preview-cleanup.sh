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
    docker compose -p "$PROJECT_NAME" down --remove-orphans 2>/dev/null || true
  rm -f "$COMPOSE_OVERRIDE"
  echo "==> Preview containers removed"
else
  echo "==> No compose override found for PR #${PR_NUMBER}"
fi

# Drop the preview database
echo "==> Dropping preview database ${DB_NAME}..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T db \
  psql -U "${DB_USER:-loyalty}" -c "DROP DATABASE IF EXISTS ${DB_NAME};" 2>/dev/null || true

# Clean up dangling images
docker image prune -f 2>/dev/null || true

echo "==> Preview cleanup for PR #${PR_NUMBER} complete!"
