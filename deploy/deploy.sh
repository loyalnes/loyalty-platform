#!/usr/bin/env bash
set -euo pipefail

# Usage: deploy.sh <environment>
# Environments: staging, production

ENV="${1:?Usage: deploy.sh <staging|production>}"
DEPLOY_DIR="/opt/loyalty-platform"
ROLLBACK_TAG=""

case "$ENV" in
  staging)
    COMPOSE_FILE="docker-compose.yml:docker-compose.staging.yml"
    ENV_FILE="$DEPLOY_DIR/deploy/.env.staging"
    ;;
  production)
    COMPOSE_FILE="docker-compose.yml:docker-compose.prod.yml"
    ENV_FILE="$DEPLOY_DIR/deploy/.env.prod"
    ;;
  *)
    echo "Unknown environment: $ENV. Use 'staging' or 'production'."
    exit 1
    ;;
esac

cd "$DEPLOY_DIR"

echo "==> Deploying $ENV environment"

# Load env file if present
if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

export COMPOSE_FILE

# Capture current running image for rollback
ROLLBACK_TAG=$(docker compose images app --format json 2>/dev/null | grep -o '"Tag":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
if [ -n "$ROLLBACK_TAG" ]; then
  echo "==> Current image tag (for rollback): $ROLLBACK_TAG"
fi

# Backup database before migrations (production only)
if [ "$ENV" = "production" ]; then
  echo "==> Backing up database before migration..."
  BACKUP_FILE="$DEPLOY_DIR/backups/db-$(date +%Y%m%d-%H%M%S).sql.gz"
  mkdir -p "$DEPLOY_DIR/backups"
  docker compose exec -T db pg_dumpall -U "${POSTGRES_USER:-loyalty}" | gzip > "$BACKUP_FILE" 2>/dev/null && \
    echo "==> Database backup saved to $BACKUP_FILE" || \
    echo "==> Warning: database backup failed (may be first deploy)"
  # Keep only last 10 backups
  ls -t "$DEPLOY_DIR/backups"/db-*.sql.gz 2>/dev/null | tail -n +11 | xargs rm -f 2>/dev/null || true
fi

# Ensure the target database exists (staging uses a separate DB)
if [ "$ENV" = "staging" ]; then
  echo "==> Ensuring staging database exists..."
  docker compose exec -T db psql -U "${DB_USER:-loyalty}" -tc \
    "SELECT 1 FROM pg_database WHERE datname = 'loyalty_staging'" | grep -q 1 || \
    docker compose exec -T db psql -U "${DB_USER:-loyalty}" -c "CREATE DATABASE loyalty_staging;" 2>/dev/null || true
fi

# Pull latest image
echo "==> Pulling images..."
docker compose pull app

# Run database migrations
echo "==> Running database migrations..."
docker compose run --rm app npx prisma migrate deploy

# Restart services
echo "==> Starting services..."
docker compose up -d --remove-orphans

# Wait for health check
echo "==> Waiting for health check..."
HEALTH_PASSED=false
for i in $(seq 1 30); do
  if docker compose exec -T app wget -qO- http://localhost:3000/health 2>/dev/null | grep -q '"ok"'; then
    echo "==> Health check passed!"
    HEALTH_PASSED=true
    break
  fi
  sleep 2
done

if [ "$HEALTH_PASSED" = false ]; then
  echo "==> Health check failed after 30 attempts!"
  echo "==> Container logs:"
  docker compose logs --tail=50 app

  # Attempt rollback if we have a previous image
  if [ -n "$ROLLBACK_TAG" ]; then
    echo "==> Rolling back to previous image: $ROLLBACK_TAG"
    export IMAGE_TAG="$ROLLBACK_TAG"
    docker compose up -d --remove-orphans
    echo "==> Rollback initiated. Check service status manually."
  fi

  exit 1
fi

# Clean up old images
echo "==> Cleaning up old images..."
docker image prune -f

echo "==> $ENV deployment complete!"
