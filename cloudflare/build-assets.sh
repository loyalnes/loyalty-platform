#!/usr/bin/env bash
# Assemble cloudflare/dist from the three builds. Run after `cd marketing && npm run build`
# and `cd dashboard && npm run build`.
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf cloudflare/dist
mkdir -p cloudflare/dist/dashboard cloudflare/dist/_customer

cp -R marketing/out/. cloudflare/dist/
cp -R dashboard/dist/. cloudflare/dist/dashboard/
cp customer/public/*.html cloudflare/dist/_customer/
cp public/favicon.svg cloudflare/dist/favicon.svg 2>/dev/null || true

echo "cloudflare/dist ready: $(find cloudflare/dist -type f | wc -l | tr -d ' ') files"
