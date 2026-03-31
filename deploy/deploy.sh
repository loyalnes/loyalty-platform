#!/usr/bin/env bash
set -euo pipefail

# Usage: deploy.sh <environment>
# Environments: staging, production

ENV="${1:?Usage: deploy.sh <staging|production>}"
DEPLOY_DIR="/opt/loyalty-platform"

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
for i in $(seq 1 30); do
  if docker compose exec app wget -qO- http://localhost:3000/health 2>/dev/null | grep -q '"ok"'; then
    echo "==> Health check passed!"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "==> Health check failed after 30 attempts"
    docker compose logs --tail=50 app
    exit 1
  fi
  sleep 2
done

# Clean up old images
echo "==> Cleaning up old images..."
docker image prune -f

echo "==> $ENV deployment complete!"
