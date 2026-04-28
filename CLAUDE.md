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
| Production | `https://loyali.online` | Public (basic auth removed in PR #45) |
| Staging | `https://staging.loyali.online` | Behind basic auth |
| Preview | `http://pr-N.preview.loyali.online` | Auto-deployed per PR, behind basic auth |
| Analytics | `https://analytics.loyali.online` | Umami self-hosted (PR #49, awaiting DNS+SSL) |

### URL Paths
- `/` — Marketing website (client-side redirect to `/{locale}` based on cookie / browser language)
- `/en`, `/it`, `/es` — Localized marketing pages (next-intl, PR #44)
- `/{locale}/contact/` — Contact page with WhatsApp + email form (PR #52)
- `/contact/` — Locale-aware redirect to `/{locale}/contact/`
- `/pricing/` — Locale-aware redirect to `/{locale}#pricing`
- `/signup/` — Redirects to `/dashboard/signup`
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

### Marketing Website (Live)

The marketing website (`marketing/`) is live at `https://loyali.online/`.

- **Design**: Luyoa-style (`https://luyoa.com/en/`). Purple `#7750e7`, beige `#f7f4ee`, Helvetica Neue, rounded 40-54px.
- **Tokens**: `marketing/src/app/tokens.css` (Luyoa-inspired, independent from dashboard).
- **i18n**: `next-intl` with `[locale]` routes (`en`, `it`, `es`). Translations in `marketing/messages/`.
- **Components**: `marketing/src/components/` — `LanguageSwitcher`, `FloatingWhatsApp`, `NewsletterSignup`.
- **Contact constants**: `marketing/src/lib/contact.ts` — single source of truth for WhatsApp number, contact email, footer email/phone/location.
- **Documentation**: see `MARKETING_REDESIGN.md` for full design system + post-launch PR log (#42 → #68).

### Dashboard (notable post-launch)

- **Active Program** card lives at the top of the Menu page (PR #55).
- **Language picker** is an expandable item inside Menu → Settings (PR #58). Tap it to switch UI language; persists to localStorage and to `Merchant.preferredLocale` via `PATCH /merchants/me`.
- See `dashboard/src/pages/MenuPage.tsx` and `dashboard/src/AuthContext.tsx` for the wiring.
- **Home (`LoyaltyHubPage`)** redesigned. Full plan & rationale in `HOME_REDESIGN.md`. Top→bottom layout:
  1. **Header**: greeting "Buongiorno, {name}" (Inter sentence-case, no more italic serif on home) + bell with red-dot indicator (replaces numeric badge). Bell tap opens `NotificationsSheet`.
  2. **Today's Activity card** (`HomeTodayStrip`): "TODAY'S ACTIVITY" + "Live" pulsing indicator + 3 stats (`+N New | N Returning | N Reviews`) with vertical dividers. Lavender gradient (matches `app-surface-card-muted` tokens). Tap → `/insights`.
  3. **Secondary row** of 3 lavender-gradient tiles: Show QR (`qr_code_2`), Redeem (`confirmation_number`), Reviews (`star`). The gamepad icon for Reviews has been retired.
  4. **Hero "Add points"**: full-width chartreuse card (`#EFFF74`), olive title + "Reward your customers instantly" sublabel, dark olive circular FAB with white `+` on the right. Tap → `/scan-qr`.
  - The legacy `HomeQuickStats` "Estadísticas" card was removed in PR #69.
- **`NotificationsSheet`** (`dashboard/src/components/NotificationsSheet.tsx`): bottom sheet opened by header bell. Lists operational alerts from `getInsightsNotifications()`. Each alert tappable (deep-link via `actionPath`) and dismissible with 7-day cooldown persisted in `localStorage` (`notifications_dismissed_v1`). Empty state when none.
- **`InsightsKpis`** extended with `returningCustomers` (loyalty cards created before window with ≥1 transaction inside) and `reviewsCount` (count of `MerchantFeedback` in window). See `src/services/statsService.ts` and `dashboard/src/api.ts`.
- **Insights time filter** (`dashboard/src/components/TimeFilter.tsx`) uses presets `24h / 7d / 30d` plus a **Custom** chip that opens a bottom-sheet date range picker (with shortcuts: last 90d, 6m, 1y). State is `InsightsRange = { kind: 'preset', preset } | { kind: 'custom', from, to }` (see `dashboard/src/api.ts`). The backend accepts either `?period=` or `?from=&to=` ISO timestamps via `statsService.parseWindow` (`src/services/statsService.ts`).

### Analytics (in progress)

Self-hosted Umami at `https://analytics.loyali.online` — Phase 1 (infra) shipped in PR #49, awaiting DNS+SSL operator action. See `ANALYTICS_PLAN.md` and `ANALYTICS_SETUP.md`.

## Deploy Pipeline

1. Push to `main` → GitHub Actions builds Docker image → pushes to GHCR → SSHs to server → runs `deploy/deploy.sh production`. A follow-up step then SSHs as `root` (same key) to copy the nginx config and reload (PR #47, needed because the deploy user can't sudo).
2. Push to `staging` → same flow with `deploy/deploy.sh staging`
3. PR opened → `preview.yml` builds image tagged `pr-N` → deploys preview on port 4000+N

### Nginx config split (PR #48)
The combined `deploy/nginx.conf` was split per environment so each host only references its own SSL certificates:
- `deploy/nginx-production.conf` — `loyali.online` + preview subdomains + analytics:80 placeholder
- `deploy/nginx-staging.conf` — `staging.loyali.online` only

### Deploy Script (`deploy/deploy.sh`)
- Selects the right `deploy/nginx-${ENV}.conf` and copies it via `sudo`
- Generates `UMAMI_DB_PASSWORD` and `UMAMI_APP_SECRET` on first run (analytics)
- Backs up database (production only)
- Pulls Docker image from GHCR
- Runs Prisma migrations (falls back to `db push`)
- Starts containers (production also includes `docker-compose.umami.yml`)
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
