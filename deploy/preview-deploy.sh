#!/usr/bin/env bash
set -euo pipefail

# Usage: preview-deploy.sh <pr-number> <image-tag>
# Deploys a preview environment for a pull request

PR_NUMBER="${1:?Usage: preview-deploy.sh <pr-number> <image-tag>}"
IMAGE_TAG="${2:?Usage: preview-deploy.sh <pr-number> <image-tag>}"
DEPLOY_DIR="/opt/loyalty-platform"
MAX_PREVIEWS=3
PREVIEW_PORT=$((4000 + PR_NUMBER))
DB_NAME="loyalty_preview_pr_${PR_NUMBER}"
PROJECT_NAME="loyalty-preview-pr-${PR_NUMBER}"

cd "$DEPLOY_DIR"

# Load production env for shared DB credentials
if [ -f "$DEPLOY_DIR/deploy/.env.prod" ]; then
  set -a
  source "$DEPLOY_DIR/deploy/.env.prod"
  set +a
fi

echo "==> Deploying preview for PR #${PR_NUMBER} on port ${PREVIEW_PORT}"

# Enforce max concurrent previews
ACTIVE_PREVIEWS=$(docker compose ls --format json 2>/dev/null | grep -c "loyalty-preview-pr-" || echo "0")
if [ "$ACTIVE_PREVIEWS" -ge "$MAX_PREVIEWS" ]; then
  echo "==> Max ${MAX_PREVIEWS} previews reached. Cleaning oldest..."
  OLDEST=$(docker compose ls --format json 2>/dev/null | grep "loyalty-preview-pr-" | head -1 | grep -o '"Name":"[^"]*"' | cut -d'"' -f4 || true)
  if [ -n "$OLDEST" ]; then
    OLD_PR=$(echo "$OLDEST" | grep -o '[0-9]*$')
    echo "==> Removing preview PR #${OLD_PR}"
    bash "$DEPLOY_DIR/deploy/preview-cleanup.sh" "$OLD_PR" || true
  fi
fi

# Generate docker-compose override for this preview
COMPOSE_OVERRIDE="$DEPLOY_DIR/docker-compose.preview-pr-${PR_NUMBER}.yml"
cat > "$COMPOSE_OVERRIDE" <<COMPOSEEOF
# Auto-generated preview for PR #${PR_NUMBER} — do not edit
services:
  db:
    environment:
      POSTGRES_DB: ${DB_NAME}
  app:
    image: ${DOCKER_REGISTRY:-ghcr.io}/${DOCKER_IMAGE}:${IMAGE_TAG}
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://${DB_USER:-loyalty}:${DB_PASSWORD}@db:5432/${DB_NAME}?schema=public
      PORT: 3000
      NODE_ENV: preview
    ports:
      !override
      - "${PREVIEW_PORT}:3000"
    depends_on:
      db:
        condition: service_healthy
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: "0.5"
COMPOSEEOF

# Pull the image
echo "==> Pulling preview image..."
docker pull "${DOCKER_REGISTRY:-ghcr.io}/${DOCKER_IMAGE}:${IMAGE_TAG}"

# Start the preview database first
echo "==> Starting preview database..."
COMPOSE_FILE="docker-compose.yml:docker-compose.prod.yml:${COMPOSE_OVERRIDE}" \
  docker compose -p "$PROJECT_NAME" up -d db

# Create the preview database inside the preview project's Postgres service if it doesn't exist
echo "==> Ensuring preview database ${DB_NAME} exists..."
COMPOSE_FILE="docker-compose.yml:docker-compose.prod.yml:${COMPOSE_OVERRIDE}" \
  docker compose -p "$PROJECT_NAME" exec -T db \
  psql -U "${DB_USER:-loyalty}" -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" | grep -q 1 || \
  COMPOSE_FILE="docker-compose.yml:docker-compose.prod.yml:${COMPOSE_OVERRIDE}" \
  docker compose -p "$PROJECT_NAME" exec -T db \
  psql -U "${DB_USER:-loyalty}" -d postgres -c "CREATE DATABASE ${DB_NAME};" 2>/dev/null || true

# Run migrations against the preview database
echo "==> Running migrations for preview..."
COMPOSE_FILE="docker-compose.yml:docker-compose.prod.yml:${COMPOSE_OVERRIDE}" \
  docker compose -p "$PROJECT_NAME" run --rm app npx prisma migrate deploy 2>/dev/null || \
  COMPOSE_FILE="docker-compose.yml:docker-compose.prod.yml:${COMPOSE_OVERRIDE}" \
  docker compose -p "$PROJECT_NAME" run --rm app npx prisma db push --accept-data-loss 2>/dev/null || true

# Start the preview
echo "==> Starting preview..."
COMPOSE_FILE="docker-compose.yml:docker-compose.prod.yml:${COMPOSE_OVERRIDE}" \
  docker compose -p "$PROJECT_NAME" up -d app

# Seed if empty (first deploy)
echo "==> Seeding preview database..."
COMPOSE_FILE="docker-compose.yml:docker-compose.prod.yml:${COMPOSE_OVERRIDE}" \
  docker compose -p "$PROJECT_NAME" exec -T app node -e "
    const { PrismaClient } = require('@prisma/client');
    const { PrismaPg } = require('@prisma/adapter-pg');
    const a = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    const p = new PrismaClient({ adapter: a });
    p.merchant.count().then(c => {
      if (c === 0) { console.log('DB empty — run seed manually if needed'); }
      else { console.log('DB already has data (' + c + ' merchants)'); }
      p.\$disconnect();
    });
  " 2>/dev/null || true

# Wait for health check
echo "==> Waiting for health check..."
HEALTH_PASSED=false
for i in $(seq 1 15); do
  if curl -sf "http://127.0.0.1:${PREVIEW_PORT}/health" >/dev/null 2>&1; then
    HEALTH_PASSED=true
    break
  fi
  sleep 2
done

if [ "$HEALTH_PASSED" = true ]; then
  echo "==> Preview for PR #${PR_NUMBER} is live at port ${PREVIEW_PORT}"
else
  echo "==> Preview app did not pass health check"
  COMPOSE_FILE="docker-compose.yml:docker-compose.prod.yml:${COMPOSE_OVERRIDE}" \
    docker compose -p "$PROJECT_NAME" logs --tail=100 app db || true
  exit 1
fi

# Generate nginx config for subdomain routing
PREVIEW_DOMAIN="pr-${PR_NUMBER}.preview.loyali.online"
NGINX_PREVIEW_DIR="/etc/nginx/previews"
NGINX_PREVIEW_CONF="${NGINX_PREVIEW_DIR}/pr-${PR_NUMBER}.conf"

mkdir -p "$NGINX_PREVIEW_DIR"

echo "==> Configuring nginx for ${PREVIEW_DOMAIN}..."

# Start with HTTP-only server block so certbot can verify the domain
cat > "$NGINX_PREVIEW_CONF" <<NGINXEOF
# Auto-generated preview for PR #${PR_NUMBER} — do not edit
server {
    listen 80;
    server_name ${PREVIEW_DOMAIN};

    auth_basic "Loyali Preview PR #${PR_NUMBER}";
    auth_basic_user_file /etc/nginx/.htpasswd;

    location / {
        proxy_pass http://127.0.0.1:${PREVIEW_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /api/ {
        auth_basic off;
        proxy_pass http://127.0.0.1:${PREVIEW_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location = /health {
        auth_basic off;
        proxy_pass http://127.0.0.1:${PREVIEW_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }
}
NGINXEOF

sudo nginx -t && sudo systemctl reload nginx && echo "==> Nginx reloaded for ${PREVIEW_DOMAIN}" || \
  echo "==> Warning: nginx reload failed — preview still accessible on port ${PREVIEW_PORT}"

# Issue SSL cert via standard HTTP challenge (DNS already points here)
echo "==> Requesting SSL certificate for ${PREVIEW_DOMAIN}..."
sudo certbot --nginx -d "${PREVIEW_DOMAIN}" --non-interactive --agree-tos --redirect \
  --register-unsafely-without-email 2>&1 || \
  echo "==> Warning: SSL cert failed — preview available over HTTP"

echo "==> Preview deployment complete!"
