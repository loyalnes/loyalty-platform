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
| Production | `https://loyali.online` | Public, no basic auth (removed in PR #45) |
| Staging | `https://staging.loyali.online` | Behind nginx basic auth |
| Preview | `http://pr-N.preview.loyali.online` | Auto-deployed per PR, behind nginx basic auth |
| Analytics | `https://analytics.loyali.online` | Umami self-hosted (PR #49, awaiting DNS+SSL — see `ANALYTICS.md`) |

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
- **Nginx**: basic auth on `staging` + preview subdomains; production (`loyali.online`) is public. Catch-all server (IP/unknown host) requires basic auth.

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
- **Documentation**: `MARKETING_REDESIGN.md` covers the design system. For post-launch history use `git log --grep=marketing`.

### Dashboard (notable post-launch)

One line per shipped feature; details live in the linked doc or in the code.

- **Home redesign** (PR #70) — `LoyaltyHubPage` with Today's Activity card, secondary tile row, chartreuse "Add points" hero, and bell → `NotificationsSheet`. See `HOME_REDESIGN.md` and `dashboard/src/components/NotificationsSheet.tsx`.
- **Insights extensions** — `InsightsKpis` adds `returningCustomers` + `reviewsCount` (`src/services/statsService.ts`). Time filter has a Custom date-range chip; backend accepts `?period=` or `?from=&to=` (`dashboard/src/components/TimeFilter.tsx`).
- **Menu page** — Active Program card at the top (PR #55). Language picker expandable inside Settings (PR #58); persists to `localStorage` and `Merchant.preferredLocale` via `PATCH /merchants/me` (`dashboard/src/pages/MenuPage.tsx`, `dashboard/src/AuthContext.tsx`).

For post-launch dashboard history use `git log --grep=dashboard`.

### Analytics (in progress)

Self-hosted Umami at `https://analytics.loyali.online` — Phase 1 (infra) shipped in PR #49, awaiting DNS+SSL operator action. See `ANALYTICS.md`.

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

## Agent routing

Use these specialized agents proactively without waiting to be asked. Match by topic, then invoke via the Agent tool with the right `subagent_type`:

- **frontend-developer** — React 19 dashboard / Next.js marketing component work, hooks, state management.
- **ui-designer** — visual design critique, design system, spacing, color, typography decisions.
- **ux-researcher** — JTBD analysis, hierarchy critique, behavioral recommendations.
- **product-manager** — scope decisions, prioritization, metric/outcome framing, paid-feature wedges.
- **api-designer** — adding/refactoring `/api/*` endpoints, REST consistency, request/response shapes.
- **postgres-pro** — Prisma schema migrations, advanced PostgreSQL features, indexes, constraints.
- **database-optimizer** — slow queries, execution plan analysis, index strategy.
- **architect-reviewer** — before shipping structural changes (new app, multi-tenancy, breaking infra changes).
- **performance-engineer** — bundle size regressions, API latency, Vite build tuning.
- **debugger** / **error-detective** — diagnosing reproducible bugs / triaging production errors.
- **qa-expert** — defining test strategy, test plans for new features.
- **compliance-auditor** — GDPR/data-handling review (we store customer PII; relevant pre-launch and before any data export feature).
- **documentation-engineer** — when docs grow stale or sprawl (we just had to triage 2200+ lines of doc rot).
- **code-reviewer** — second-opinion review of pending diff before commit on non-trivial changes.
- **security-review** (built-in skill) — when touching auth, payments, PII, or external API surfaces.

Spawn multiple in parallel when their concerns are independent (e.g., `ui-designer` + `ux-researcher` + `product-manager` for any home/feature redesign — that's exactly the cycle that produced HOME_REDESIGN.md).

For multi-step tasks, use `Plan` to design the approach before opening the editor.

## Paperclip Integration

This project is managed in Paperclip. Task identifiers use the `LOY-` prefix.
When creating issues or PRs, reference Paperclip tasks (e.g., LOY-24).
Agents should follow the branch → PR → staging → production workflow.
