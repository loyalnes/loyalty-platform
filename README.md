# Loyali

Digital loyalty for physical stores (bars, restaurants, shops). A merchant signs up, defines a points or stamps program, and awards points by scanning a customer's QR code. Customers join from a QR code, get a wallet card (Apple or Google Wallet link, or a web page), and can play prize games or leave a review. Everything is multi-tenant: one merchant sees only its own customers.

Three pillars: retention (programs, rewards), reputation (Google review flow, private feedback), customer intelligence (stats, sentiment). The MVP covers retention plus QR-based acquisition.

## Components

| Path | What |
|---|---|
| `edge/` | Hono + Cloudflare D1 API, and the one Worker that also serves the static apps. Built for the Workers Free plan (10 ms CPU per request). Deployed with `wrangler deploy` to `loyali.dot-shopfully.workers.dev`. |
| `dashboard/` | Merchant PWA (React 19, Vite, React Router 7, i18next en/it/es), served at `/dashboard/`. |
| `marketing/` | Marketing site (Next.js 15, static export, next-intl en/it/es), served at `/`. |
| `customer/public/` | Customer pages: `join.html`, `loyalty.html`, `play.html`, `review.html`. Plain HTML, no build step. Served at `/app/{join,loyalty,play,review}/:id`. |
| `packages/ui/` | Design tokens (`tokens.css`, generated from `design/design-tokens.json`). |
| `cloudflare/build-assets.sh` | Assembles `cloudflare/dist`, the Worker's static assets, from the three builds. |

The earlier Express + Prisma + PostgreSQL backend, its Docker and Hetzner deploy and the Express-on-Workers experiment were removed from the tree. They are in git history up to `6bd5799`.

## How a request is routed (edge/)

```
Browser ──> Worker (edge/src/index.ts)
              ├─ /api/*, /health        -> Hono app -> D1 (SQLite)
              ├─ /app/{join|loyalty|play|review}/:id -> static /_customer/<page>.html
              ├─ /dashboard/*           -> static dashboard build (SPA fallback to index.html)
              └─ everything else        -> static marketing build
```

Every response goes through `edge/src/security.ts` (`harden`), which sets security headers. Static files come from Workers Static Assets (`cloudflare/dist`, built by `cloudflare/build-assets.sh`).

## Auth model

- **Merchants**: `POST /api/auth/signup` or `/login` (email + password, PBKDF2 through Web Crypto) returns `{ merchant, apiKey }`. The key looks like `loy_live_<64 hex>`. Send it as `X-API-Key`. Only its SHA-256 is stored (`api_keys.key_hash`, unique index), so a request costs one indexed lookup. Each login issues a new key; keys can be listed and revoked under `/api/merchants/me/api-keys`.
- **Brute force**: sign-up is limited to 5 per hour per IP, login to 5 per 15 minutes per email and IP, counted in the `auth_throttle` table. Unknown emails are verified against a dummy hash so timing does not reveal registered emails.
- **Customers** have no account. They reach their card through an opaque wallet access token (`wallet_access_tokens`, link sent by email or shown to the merchant).
- **Public endpoints** (no key): join, public program summary, review flow, gamification play, wallet access links. Everything under `cards`, `customers`, `points`, `programs`, `stats`, `campaigns` requires the key and is scoped to the key's merchant.

## API surface

All paths are under `/api`. Source: `edge/src/<name>.ts`, mounted in `edge/src/index.ts`.

| Prefix | Auth | Does |
|---|---|---|
| `/auth` | public | sign-up, login |
| `/merchants` | key on `/me*` | own profile, settings, locale, Google review link, API keys |
| `/programs` | key | create (create-only, 409 if one exists) and read the merchant's program with its reward tiers |
| `/cards`, `/customers` | key | list, read, update cards and customers; `POST /customers/manual-add` creates a customer, card and wallet link and emails it |
| `/points` | key | `POST /earn`, `POST /redeem`, `GET /balance/:card`, `GET /history/:card` |
| `/campaigns` | key | prize-game campaigns and prizes |
| `/stats` | key | KPIs, sentiment, feedback, notifications for the dashboard |
| `/loyalty` | public | `GET /:merchantId/public-summary`, `POST /:merchantId/join` (idempotent) |
| `/feedback` | public | customer review flow and private feedback |
| `/gamification` | public | play a campaign, claim a prize |
| `/wallet` | mixed | scan-token resolve (key), customer card data and Apple and Google Wallet passes (token) |

Money-moving writes (earn, redeem, prize claim) run as a single D1 batch, so a failed redemption writes nothing.

## Data model

Schema source of truth: `edge/migrations/0001..0007_*.sql` (D1, ids are UUID text, timestamps ISO-8601 text, enums are CHECK constraints).

Tables: `merchants`, `api_keys`, `magic_tokens`, `auth_throttle`, `customers`, `loyalty_cards`, `points_transactions` (ledger, `balance_after` stored), `loyalty_programs`, `reward_tiers`, `card_templates`, `gamification_campaigns`, `prizes`, `prize_wins`, `gamification_plays`, `merchant_feedback`, `wallet_passes`, `wallet_scan_tokens`, `wallet_access_tokens`, `push_subscriptions`.

GDPR: the merchant is the data controller and Loyali the processor, so `gdpr_consent_at` and `marketing_consent_at` live on the per-merchant `loyalty_cards` row. The `customers` row holds no consent fields. D1 has no marketing-revocation column yet.

## Run it locally

Needs Node 20+. `wrangler dev` runs D1 locally.

```bash
(cd marketing && npm install && npm run build)                        # writes marketing/out
(cd dashboard && npm install --legacy-peer-deps && npm run build)     # writes dashboard/dist
bash cloudflare/build-assets.sh                                       # assembles cloudflare/dist

cd edge && npm install
npx wrangler d1 migrations apply loyali-spike --local
npx wrangler dev                                                      # http://localhost:8787
```

`--legacy-peer-deps` is needed because `vite-plugin-pwa` 0.20 does not declare Vite 8.

Dashboard hot reload: `cd dashboard && npm run dev` (port 5173, proxies `/api` to 8787).

Optional: `LOYALI_EMAIL=... LOYALI_PASSWORD=... LOYALI_URL=http://localhost:8787 npm run seed:demo` (in `edge/`) fills an existing merchant with a program, 23 customers, purchases, redemptions, campaigns and reviews through the public API.

Secrets and vars (`wrangler secret put`): `GOOGLE_WALLET_SERVICE_ACCOUNT_KEY`, `WALLETWALLET_API_KEY` (Apple pass), `RESEND_API_KEY` (email; without it the link is only shown in the dashboard), `GOOGLE_MAPS_API_KEY` (optional). `PUBLIC_URL` is a plain var in `edge/wrangler.jsonc`.

## Deploy

Manual, no CI workflow. `wrangler deploy` publishes to production immediately; apply D1 migrations first when the change needs them (`npx wrangler d1 migrations apply loyali-spike --remote`).

```bash
(cd marketing && npm run build)
(cd dashboard && npm run build)
bash cloudflare/build-assets.sh
cd edge && npx wrangler deploy
```

## Tests and checks

There is almost no automated coverage. The only unit tests are in the dashboard (`cd dashboard && npm test`, vitest, `src/lib/setupValidation.test.ts`). `edge/` has no tests. There is no CI.

## Repo map

```
edge/              API + Worker entry (src/index.ts), D1 migrations, demo seed
cloudflare/        build-assets.sh
dashboard/         merchant PWA (offline queue in IndexedDB, service worker)
customer/public/   static customer pages
marketing/         Next.js site and privacy pages
packages/ui/       design tokens and shared CSS
design/            design system docs (design/README.md is the index)
legal/             privacy policy, cookie consent, terms (it, es)
docs/              PWA PRD; docs/archive holds old plans
CLAUDE.md          context file for AI coding agents
```

Feature write-ups: `HOME_REDESIGN.md`, `REDEEM_HOME.md`, `MARKETING_REDESIGN.md`, `PWA_INSTALL_PROMPT_BEHAVIOR.md`.

## License

Proprietary. All rights reserved.
