# Loyali — Loyalty Platform

## What is this?

Loyali is a SaaS platform for physical stores (bars, restaurants, shops) built on three pillars:
1. **Retention** — loyalty programs (points, stamps, tiers, rewards)
2. **Reputation** — public review management, private feedback collection
3. **Customer Intelligence** — behavioral data, satisfaction metrics, segmentation

The MVP focuses on pillar 1 (loyalty) + QR-based customer acquisition.

## Architecture

**Monorepo** with three frontend apps + one backend:

```
src/                  → Express API server (TypeScript, Prisma, PostgreSQL)
dashboard/            → B2B merchant dashboard (React 19, Vite, React Router)
customer/             → B2C customer web app (planned — not yet built)
marketing/            → Marketing website (Next.js, static export)
packages/ui/          → Shared design system (@loyali/ui)
deploy/               → Server provisioning and deploy scripts
prisma/               → Database schema and migrations
```

## Tech Stack

- **Backend**: Express.js + TypeScript + Prisma v7 + PostgreSQL 16
- **Dashboard**: React 19 + Vite 8 + React Router 7 + i18next (en/it/es)
- **Marketing**: Next.js 15 with static export (`output: 'export'`)
- **Design System**: `packages/ui/` — CSS tokens (from `design/design-tokens.json`), shared React components
- **Database**: PostgreSQL 16 via `@prisma/adapter-pg` (PrismaPg adapter required)
- **Docker**: Multi-stage Dockerfile, docker-compose files for dev/staging/prod
- **CI/CD**: GitHub Actions — ci.yml, deploy.yml, preview.yml
- **Server**: Hetzner VPS (46.224.138.230), Nginx reverse proxy, Let's Encrypt SSL

## URLs

| Environment | URL | Notes |
|---|---|---|
| Production | `https://loyali.online` | Behind basic auth (user: `loyali`) |
| Staging | `https://staging.loyali.online` | Behind basic auth |
| Preview | `http://pr-N.preview.loyali.online` | Auto-deployed per PR |

### URL Paths
- `/` — Marketing website (homepage, pricing, signup)
- `/dashboard/` — B2B merchant dashboard
- `/app/` — B2C customer app (not yet built)
- `/api/` — REST API (all routes under /api/ prefix)
- `/health` — Health check (no auth)

## Development

```bash
# Install dependencies
npm install
cd dashboard && npm install
cd ../marketing && npm install

# Generate Prisma client
npx prisma generate

# Run backend (requires DATABASE_URL in .env)
npm run dev

# Run dashboard dev server (proxies /api to localhost:3000)
npm run dev:dashboard

# Run marketing dev server
cd marketing && npm run dev

# Seed database
npm run db:seed

# Build everything
npm run build
```

### Docker (local dev)
```bash
DB_PASSWORD=devpassword docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```
Note: If port 5432 is in use, change the DB port in docker-compose.dev.yml.

## API Authentication

- **B2B (merchants)**: `X-API-Key` header with merchant UUID
- **B2C (customers)**: Planned — email magic link + JWT Bearer token
- **Nginx**: Basic auth on all environments (pre-launch)

## Database

- Schema: `prisma/schema.prisma`
- Models: Merchant, Customer, LoyaltyCard, CardTemplate, PointsTransaction
- Adapter: Must use `PrismaPg` adapter (not bare `PrismaClient()`)
- Migrations: `prisma/migrations/` — run `npx prisma migrate deploy`
- Seed: `prisma/seed/seed.ts` — creates 2 merchants, 2 customers, 3 cards, 6 transactions

## Design System

- Tokens: `design/design-tokens.json` → `packages/ui/src/tokens.css` (auto-generated)
- Brand: `design/brand-guidelines.md` — Loyali, Indigo primary (#4F46E5), Inter font, Lucide icons
- Generate tokens: `node packages/ui/scripts/generate-tokens.cjs`
- Dashboard imports: `import '../../packages/ui/src/index.css'` in `dashboard/src/main.tsx`
- Marketing imports: tokens copied via `prebuild` script in `marketing/package.json`

### Marketing Website Redesign (In Progress)

The marketing website (`marketing/`) is being redesigned to match the style of https://luyoa.com/en/:

- **Design reference**: `/Users/eliobencini/luyoa.com/en/` (local files) + https://luyoa.com/en/ (live)
- **Documentation**: `MARKETING_REDESIGN.md` — complete design system, task breakdown, progress tracking
- **Key changes**:
  - Font: Helvetica Neue (system font) instead of Inter
  - Colors: Purple primary (#7750e7), beige/cream backgrounds (#f7f4ee)
  - Typography: Large headings (48px) with tight letter-spacing (-0.07em)
  - Border radius: Very rounded (40-54px for cards, pill buttons)
  - Spacing: Generous padding and section spacing
- **Custom tokens**: `marketing/src/app/tokens.css` (Luyoa-inspired, independent from dashboard)
- **Task tracking**: See `MARKETING_REDESIGN.md` for 11-task breakdown and current progress

## Deploy Pipeline

1. Push to `main` → GitHub Actions builds Docker image → pushes to GHCR → SSHs to server → runs `deploy/deploy.sh production`
2. Push to `staging` → same flow with `deploy/deploy.sh staging`
3. PR opened → `preview.yml` builds image tagged `pr-N` → deploys preview on port 4000+N

### Deploy Script (`deploy/deploy.sh`)
- Updates nginx config + basic auth
- Backs up database (production only)
- Pulls Docker image from GHCR
- Runs Prisma migrations (falls back to `db push`)
- Starts containers
- Health check with auto-rollback on failure

## Commit Convention

All commits must include:
```
Co-Authored-By: Paperclip <noreply@paperclip.ing>
```

## Key Files

- `src/index.ts` — Express server entry point, route mounting
- `src/middleware/auth.ts` — Merchant X-API-Key authentication
- `src/routes/` — API route handlers (merchants, cards, points)
- `prisma/schema.prisma` — Database schema (single source of truth)
- `packages/ui/src/tokens.css` — Design tokens (auto-generated, don't edit)
- `design/design-tokens.json` — Design token source (edit this)
- `deploy/deploy.sh` — Main deployment script
- `.github/workflows/` — CI/CD pipelines

## Paperclip Integration

This project is managed in Paperclip. Task identifiers use the `LOY-` prefix.
When creating issues or PRs, reference Paperclip tasks (e.g., LOY-24).
Agents should follow the branch → PR → staging → production workflow.
