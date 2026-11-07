# Loyali — Loyalty Platform

## What is this?

Loyali is a SaaS platform for physical stores (bars, restaurants, shops) built on three pillars:
1. **Retention** — loyalty programs (points, stamps, tiers, rewards)
2. **Reputation** — public review management, private feedback collection
3. **Customer Intelligence** — behavioral data, satisfaction metrics, segmentation

The MVP focuses on pillar 1 (loyalty) + QR-based customer acquisition.

## Architecture

One Cloudflare Worker (`edge/`) serves the API and the three static apps. Read `README.md` first for routing, auth and the API map.

```
edge/                 → API (Hono + D1) and Worker entry (edge/src/index.ts), D1 migrations in edge/migrations/
dashboard/            → B2B merchant PWA (React 19, Vite, React Router), served at /dashboard/
customer/public/      → B2C static pages: join, loyalty, play, review (plain HTML, no build)
marketing/            → Marketing website (Next.js, static export), served at /
packages/ui/          → Design tokens (@loyali/ui)
cloudflare/           → build-assets.sh: assembles cloudflare/dist, the Worker's static assets
```

## Tech Stack

- **API**: Hono 4 on Cloudflare Workers, D1 (SQLite), Workers Static Assets. Sized for the Workers Free plan (10 ms CPU per request): no bcrypt, no Prisma, Web Crypto only.
- **Dashboard**: React 19 + Vite 8 + React Router 7 + i18next (en/it/es)
- **Marketing**: Next.js 15 with static export (`output: 'export'`)
- **Design System**: `design/design-tokens.json` → `packages/ui/src/tokens.css`

## URLs

| Environment | URL |
|---|---|
| Production | `https://loyali.dot-shopfully.workers.dev` (a custom domain is not recorded in the repo) |
| Local | `http://localhost:8787` (`wrangler dev`) |

### URL Paths
- `/` — Marketing website (client-side redirect to `/{locale}` based on cookie / browser language)
- `/en`, `/it`, `/es` — Localized marketing pages (next-intl, PR #44)
- `/{locale}/contact/` — Contact page with WhatsApp + email form (PR #52)
- `/contact/` — Locale-aware redirect to `/{locale}/contact/`
- `/pricing/` — Locale-aware redirect to `/{locale}#pricing`
- `/signup/` — Redirects to `/dashboard/signup`
- `/{locale}/privacy` — Privacy policy (en/it/es), linked from join form
- `/dashboard/` — B2B merchant dashboard (default locale `es` — primary market)
- `/app/join/:merchantId` — B2C join flow (`customer/public/join.html`) — used when merchant has a LoyaltyProgram but no active campaign
- `/app/loyalty/:token` — B2C loyalty card page (`customer/public/loyalty.html`) — chartreuse hero, points + progress to next reward, sticky "Show to earn points" QR overlay, recent activity
- `/app/review/:merchantId` — B2C review redirect flow
- `/api/` — REST API (all routes under /api/ prefix)
- `/health` — Health check (no auth)

Customer pages fall back to `en` when `navigator.language` is not en/it/es.

## Development

```bash
(cd marketing && npm install && npm run build)
(cd dashboard && npm install --legacy-peer-deps && npm run build)
bash cloudflare/build-assets.sh
cd edge && npm install
npx wrangler d1 migrations apply loyali-spike --local
npx wrangler dev                      # http://localhost:8787
```

Dashboard hot reload: `cd dashboard && npm run dev` (port 5173, proxies `/api` to 8787). `npm install --legacy-peer-deps` is needed because `vite-plugin-pwa` 0.20 does not declare Vite 8.
Demo data: `cd edge && LOYALI_EMAIL=... LOYALI_PASSWORD=... LOYALI_URL=http://localhost:8787 npm run seed:demo`.

## API Authentication

- **B2B (merchants)**: `X-API-Key` header, value `loy_live_<64 hex>` issued by `POST /api/auth/signup` or `/login`. Only its SHA-256 is stored (`api_keys.key_hash`).
- **B2C (customers)**: Planned — email magic link + JWT Bearer token
- **Public B2C endpoints** (no auth):
  - `GET  /api/loyalty/:merchantId/public-summary` — feeds the join page
  - `POST /api/loyalty/:merchantId/join` — idempotent enrollment (firstName req, lastName opt, email req, marketing consent opt; GDPR consent is implicit via Art. 6(1)(b))


## Environment Variables

Worker secrets (`wrangler secret put`): `GOOGLE_WALLET_SERVICE_ACCOUNT_KEY`, `WALLETWALLET_API_KEY` (Apple pass), `RESEND_API_KEY` (email; without it the wallet link is only shown in the dashboard), `GOOGLE_MAPS_API_KEY` (optional). `PUBLIC_URL` is a plain var in `edge/wrangler.jsonc`.

## Database

- D1 database `loyali-spike`, binding `DB`. Schema = `edge/migrations/0001..0007_*.sql`. Ids are UUID text, timestamps ISO-8601 text, enums are CHECK constraints.
- Add a migration as the next numbered file, then `npx wrangler d1 migrations apply loyali-spike --remote` before deploying code that needs it.
- Money-moving writes (earn, redeem, prize claim) are single D1 batches.

### Consent model (GDPR)

The merchant is the data controller, Loyali the processor. `gdpr_consent_at` and `marketing_consent_at` live on the per-merchant `loyalty_cards` row, not on `customers`. The marketing consent text on the join form interpolates the merchant name. D1 has no `marketing_revoked_at` column yet.

## Design System

- Tokens: `design/design-tokens.json` → `packages/ui/src/tokens.css` (auto-generated)
- Brand: `design/brand-guidelines.md` — Loyali, Indigo primary (#4F46E5), Inter font, Lucide icons
- Generate tokens: `node packages/ui/scripts/generate-tokens.cjs`
- Dashboard imports: `import '../../packages/ui/src/index.css'` in `dashboard/src/main.tsx`
- Marketing imports: tokens copied via `prebuild` script in `marketing/package.json`

Recent additions (use these instead of ad-hoc Tailwind):
- `.app-status-pill` with `-ok` / `-warn` modifiers — driven by `--success` / `--warning` tokens via `color-mix`. Used on `/review-settings`, `/campaigns`.
- `.stack-md` / `.stack-sm` — gap-driven spacing utilities; intrinsic margins reset.
- `.review-flow-steps` — icon-list pattern reused across Reviews, Campaigns, Settings "how it works" cards.
- `.pwa-prompt-title` (DM Sans bold) — replaces `.title-expressive` (DM Serif italic) on the PWA install prompt h3 to match dashboard style.
- Hub-hero "Add points" button: layered shadow + chartreuse glow + shimmer with `prefers-reduced-motion` fallback.

### Marketing Website (Live)

The marketing website (`marketing/`) is live at `https://loyali.online/`.

- **Design**: Luyoa-style (`https://luyoa.com/en/`). Purple `#7750e7`, beige `#f7f4ee`, Helvetica Neue, rounded 40-54px.
- **Tokens**: `marketing/src/app/tokens.css` (Luyoa-inspired, independent from dashboard).
- **i18n**: `next-intl` with `[locale]` routes (`en`, `it`, `es`). Translations in `marketing/messages/`.
- **Components**: `marketing/src/components/` — `LanguageSwitcher`, `FloatingWhatsApp`, `NewsletterSignup`.
- **Contact constants**: `marketing/src/lib/contact.ts` — single source of truth for WhatsApp number, contact email, footer email/phone/location.
- **Privacy page**: `marketing/src/app/[locale]/privacy/` (en/it/es) — linked from the join form's consent text.
- **Documentation**: `MARKETING_REDESIGN.md` covers the design system. For post-launch history use `git log --grep=marketing`.

### Dashboard (notable post-launch)

One line per shipped feature; details live in the linked doc or in the code.

- **Home redesign** (PR #70) — `LoyaltyHubPage` with Today's Activity card, secondary tile row, chartreuse "Add points" hero, and bell → `NotificationsSheet`. See `HOME_REDESIGN.md` and `dashboard/src/components/NotificationsSheet.tsx`.
- **Insights extensions** — `InsightsKpis` adds `returningCustomers` + `reviewsCount` (`edge/src/stats.ts`). Time filter has a Custom date-range chip; backend accepts `?period=` or `?from=&to=` (`dashboard/src/components/TimeFilter.tsx`).
- **Menu page** — Active Program card at the top (PR #55). Language picker expandable inside Settings (PR #58); persists to `localStorage` and `Merchant.preferredLocale` via `PATCH /merchants/me` (`dashboard/src/pages/MenuPage.tsx`, `dashboard/src/AuthContext.tsx`). Logout moved to SettingsPage "Session" card.
- **Reviews split** — Page split into two URLs:
  - `/review-qr` (`dashboard/src/pages/ReviewQRPage.tsx`) — home tile entry, shows QR + copy/share for `/app/review/:merchantId`.
  - `/review-settings` (`dashboard/src/pages/ReviewSettingsPage.tsx`, ex-`ShowReviewQRPage.tsx`) — Menu entry, configure Google Maps URL, status pill, "How it works" card.
  - Old `/show-review-qr` route removed. Google config no longer lives on the Settings page.
- **Header/nav cleanup** — Global `Header.tsx` uses one big bold `app-header-title-home` style for every route; tab routes show their bottom-nav label. Sub-pages (`/campaigns`, `/settings`, `/review-qr`, `/review-settings`) use `FullPageLayout` with inline `back + title + (optional CTA)` rows — no global header chrome, no duplicate H1/kicker.
- **Customers page fixes** — `customerService.getCustomers` now returns flat `{ data, total, page, limit, hasMore }` matching the dashboard's `PaginatedResponse` (was nested `pagination.*`, hence "0 of 0" counter). Multi-token search: 1 token → `startsWith` on any field; N tokens → first token EQUALS firstName, rest startsWith lastName/email/phone.
- **Scan/redeem flow redesign** — `CustomerProfileModal` split per `LoyaltyProgram.type`: POINTS shows giant `€` input with live points conversion, STAMPS shows `+1 Timbro` hero + secondary `Add more` for custom counts. Header is one inline meta line (`Customer since X · N rewards redeemed` using a real `redemptionsCount` derived from `PointsTransaction(type=REDEEM)` count, NOT `totalRedeemed` which is a points sum). Multi-tier progress bar replaces the 3-stat tile row. Success uses a chartreuse check overlay (`Stamp added!` / `Points added!` / `Card completed`) and the modal stays open after redeem so the merchant can see the updated balance. Scan-page manual lookup replaced by debounced search by email/name/phone via `listCustomers` (`Cache-Control: no-store`). API client has a 5s `AbortController` timeout.
- **Home → redeem entry** — `Riscatta` tile on `LoyaltyHubPage` navigates to `/scan-qr?mode=redeem`; `ScanQRPage` reads the param and passes `initialView` to `CustomerProfileModal` so it lands directly on the redeem view. Empty state when no eligible reward shows `Lock` + `N points/stamps to next reward` + chartreuse fallback to add-points view. The campaign `/redeem-code` flow described in `REDEEM_HOME.md` was de-scoped in favor of this simpler entry. See `REDEEM_HOME.md`.
- **Manual customer add** — `+` button on `CustomersPage` opens `AddCustomerModal` (firstName, lastName, email, marketingConsent). `POST /api/customers/manual-add` (auth merchant) creates `Customer + LoyaltyCard + WalletPass + WalletAccessToken`, mails the wallet link via `edge/src/mailer.ts`. Mailer uses Resend if `RESEND_API_KEY` is set, otherwise logs the link and the modal surfaces it as a copyable URL. Modals (`AddCustomerModal`, `CustomerProfileModal`) live OUTSIDE `PullToRefresh` because its `transform` breaks `position: fixed` on the modal-overlay.
- **Setup wizard merge** — Two steps instead of three: step 1 chooses POINTS/STAMPS, step 2 unifies base rule + welcome bonus + reward tiers. New `LoyaltyProgram.welcomePoints` (migration `20260505000000_add_welcome_points`). Per-tier live calc shows `Spend needed: €X` (POINTS) or `N visits needed` (STAMPS) folding `welcomePoints`/`welcomeStamps` into the math. Validation: ascending thresholds; STAMPS thresholds ≤ `goalStamps`; with a single tier or last tier of multi-tier the threshold MUST equal `goalStamps`. Threshold/order errors render under the row; missing reward name shows as a red border on the input only (so the live calc keeps showing).
- **Program edit lock** — `GET /api/programs/mine` returns `hasTransactions` (true when any of the merchant's cards has `totalEarned > 0` or `totalRedeemed > 0`). The `Edit` button on `MenuPage` Active Program card hides as soon as that flips. Useful because `POST /programs` is create-only (409 on existing) — without the lock the Edit button leads to a dead-end. Active Program card now also lists every `RewardTier` with prize name + threshold.

For post-launch dashboard history use `git log --grep=dashboard`.

### Customer app (`customer/`)

Static HTML pages served from `customer/public/`, no build step.

- `join.html` → `/app/join/:merchantId` — Material 3 floating-label "notched outline" inputs, confetti on submit + on each consent check. No required GDPR checkbox (submission = acceptance under Art. 6(1)(b)); inline note replaces it. Marketing consent line interpolates the merchant name.
- `loyalty.html` → `/app/loyalty/:token` — chartreuse hero with points + progress bar to next reward, sticky "Show to earn points" CTA → fullscreen QR overlay (api.qrserver.com), Recent activity timeline. Backed by `WalletSummary` extended with `nextReward { rewardName, threshold, pointsToGo, progress }` (`edge/src/wallet-summary.ts`).
## Deploy

The Worker is deployed by hand; there is no CI workflow.

```bash
(cd marketing && npm run build)
(cd dashboard && npm run build)
bash cloudflare/build-assets.sh
cd edge && npx wrangler deploy
```

`wrangler deploy` publishes to production immediately. Apply D1 migrations first when the change needs them.


## Commit Convention

All commits must include:
```
Co-Authored-By: Paperclip <noreply@paperclip.ing>
```


## Key Files

- `edge/src/index.ts` — Worker entry: routing, Hono route mounting, auth middleware wiring
- `edge/src/auth.ts` — `authenticateMerchant`, sign-up, login
- `edge/src/<name>.ts` — one file per API area (points, programs, campaigns, wallet, ...)
- `edge/migrations/` — D1 schema
- `edge/wrangler.jsonc` — bindings, assets directory, `PUBLIC_URL`
- `customer/public/join.html`, `loyalty.html`, `play.html`, `review.html` — B2C static pages
- `packages/ui/src/tokens.css` — Design tokens (auto-generated, don't edit)
- `design/design-tokens.json` — Design token source (edit this)
- `cloudflare/build-assets.sh` — assembles the static bundle


## Agent routing

Use these specialized agents proactively without waiting to be asked. Match by topic, then invoke via the Agent tool with the right `subagent_type`:

- **frontend-developer** — React 19 dashboard / Next.js marketing component work, hooks, state management.
- **ui-designer** — visual design critique, design system, spacing, color, typography decisions.
- **ux-researcher** — JTBD analysis, hierarchy critique, behavioral recommendations.
- **product-manager** — scope decisions, prioritization, metric/outcome framing, paid-feature wedges.
- **api-designer** — adding/refactoring `/api/*` endpoints, REST consistency, request/response shapes.
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
