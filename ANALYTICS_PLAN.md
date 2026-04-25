# Analytics Plan — Umami Self-Hosted

**Goal**: measure marketing site traffic on `loyali.online` with a free, GDPR-friendly, self-hosted tool. Data stays on our Hetzner server. No cookie banner required.

**Tool**: [Umami](https://umami.is/) — open-source, lightweight (~2KB script), privacy-first by design (no cookies, no PII, no fingerprinting).

---

## 🎯 What we'll measure

### Out of the box (zero config)
- Monthly / daily visits + unique visitors
- Top pages (which page gets most traffic — homepage vs `/en` vs `/it` vs `/es`)
- Top referrers (Google, LinkedIn, direct, etc.)
- Geography (country / city)
- Devices (mobile vs desktop)
- Browsers and operating systems (relevant: iOS for Apple Wallet vs Android for Google Wallet)
- Bounce rate, session duration, pages per session

### Custom events to add later (CTA conversion tracking)
- Click on **"Start the magic"** (primary signup CTA)
- Click on **"Let's talk"** (sales CTA)
- Click on pricing CTAs (Core/Grow → /dashboard/signup)
- Language switch (which locales get switched between)
- Scroll-depth to pricing section

These build the funnel: **visits → engaged readers → CTA clicks → signups**.

---

## 🏗️ Architecture

### Where it runs
Same Hetzner VPS (`46.224.138.230`) as the rest of the platform. Adds one Docker container for Umami; reuses the existing PostgreSQL instance.

```
┌─────────────────────────────────────────┐
│  Hetzner VPS                             │
│                                          │
│  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │ marketing│  │ dashboard│  │ umami  │ │
│  │   /api   │  │          │  │ :3000  │ │
│  │  :3000   │  │  static  │  │        │ │
│  └────┬─────┘  └──────────┘  └───┬────┘ │
│       │                          │      │
│       └────────┬─────────────────┘      │
│                │                         │
│         ┌──────▼──────┐                  │
│         │ PostgreSQL  │                  │
│         │  - loyalty  │                  │
│         │  - umami    │  ← new database  │
│         └─────────────┘                  │
│                                          │
│  ┌──────────────── nginx ──────────────┐│
│  │  loyali.online           → app:3000 ││
│  │  analytics.loyali.online → umami    ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

### Database
- New database `umami` on the same Postgres 16 container
- Created automatically on first startup via init script
- Isolated from the main `loyalty_platform` DB (own schema, own user)

### Domain
- **`analytics.loyali.online`** (subdomain) — clean URL, dedicated SSL cert
- DNS: A record `analytics` → `46.224.138.230`
- SSL: Let's Encrypt via certbot (one-time setup)

### Resources
- Memory: ~150-200MB (umami container)
- Storage: minimal (~10MB/month for typical traffic)
- CPU: negligible (idle most of the time)

---

## 📦 What gets added to the repo

### 1. `docker-compose.umami.yml` (new override file)
Defines the umami service. Composed alongside existing files:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.umami.yml up -d
```

### 2. `deploy/init-umami-db.sql` (new)
Postgres init script that creates the `umami` database + dedicated user with limited privileges. Runs once on first Postgres startup; idempotent on subsequent runs.

### 3. `deploy/nginx-production.conf` (modified)
Adds an extra server block for `analytics.loyali.online` proxying to `umami:3000`.

### 4. `marketing/src/app/[locale]/layout.tsx` (modified, after Umami is live)
Adds the Umami tracking script:
```html
<script defer src="https://analytics.loyali.online/script.js"
        data-website-id="<provided-by-umami-after-first-setup>"></script>
```

### 5. `ANALYTICS.md` (new, docs)
How to use the dashboard, how to add custom events, who has access.

---

## 🚀 Rollout plan (4 phases)

### Phase 1 — Infra setup (PR scope)
**Branch**: `feat/analytics-umami`

- [ ] Add `docker-compose.umami.yml` with Umami service
- [ ] Add `deploy/init-umami-db.sql` for database/user creation
- [ ] Update `deploy/nginx-production.conf` with `analytics.loyali.online` server block
- [ ] Update `.github/workflows/deploy.yml` so `docker compose up` includes the new file
- [ ] PR + review + merge → deploy

**Outcome after merge**: Umami container running, but not yet reachable until DNS + SSL configured.

### Phase 2 — DNS + SSL (your action, 5 min)
- [ ] Add DNS A record: `analytics.loyali.online` → `46.224.138.230` (via your domain registrar)
- [ ] SSH to server (as root, one-time):
  ```bash
  sudo certbot --nginx -d analytics.loyali.online
  ```
  → Let's Encrypt issues cert + nginx auto-reloads.
- [ ] Verify: `curl -I https://analytics.loyali.online/` returns 200 (Umami login page)

### Phase 3 — Initial Umami setup (your action, 5 min)
- [ ] Visit `https://analytics.loyali.online/`
- [ ] Login with default admin (`admin` / `umami`) → **immediately change password**
- [ ] **Settings → Websites → Add website**:
  - Name: `Loyali Marketing`
  - Domain: `loyali.online`
- [ ] Copy the **Tracking code website ID** (UUID)
- [ ] Send me the website ID

### Phase 4 — Wire up tracking (PR scope)
**Branch**: `feat/analytics-tracking-script`

- [ ] Add Umami script to `marketing/src/app/[locale]/layout.tsx` with the website ID
- [ ] (Optional) Wire custom events on CTAs using `umami.track('cta_signup_click')`
- [ ] PR + merge + deploy
- [ ] Verify: visit `loyali.online`, check Umami dashboard shows the visit

**Outcome**: full analytics live and capturing data.

---

## 🔐 Security & privacy

### What Umami collects
- Anonymized session info (no IP stored, no cookies, no fingerprinting beyond user-agent)
- URL paths visited
- Referrer (where the visitor came from)
- Country (derived from IP, then IP discarded)
- Device class (mobile/desktop) and browser

### What Umami does NOT collect
- Personal identifiers (no email, no name, no IP retained)
- Cross-site tracking
- User profiles or behavioral profiling

### GDPR posture
- No personal data → **no cookie consent banner needed**
- No privacy policy update strictly required for analytics alone
- If/when you add a sitewide privacy policy (e.g., when signup form goes live), mention "we use a privacy-first analytics tool that does not store personal data"

### Access control
- Admin password: rotate immediately after first login (default `admin/umami` is well known)
- Public dashboard: NOT enabled by default (only logged-in admins see data)
- Optional: enable read-only public dashboard later if you want to share metrics with stakeholders

### Network exposure
- `umami` container exposed only on the docker network (not bound to host port)
- Reached only via nginx (which terminates TLS and proxies)
- Default `auth_basic` is removed in production nginx, so analytics dashboard is reachable but requires Umami login

---

## 📊 Dashboard examples (what you'll see)

### Daily traffic chart
Line chart showing pageviews + unique visitors per day for the last 30 days. Spot trends, campaign spikes, week-over-week growth.

### Top pages
```
/en              1,240 views   320 visitors
/it                 850 views   210 visitors
/es                 430 views   115 visitors
/pricing/           180 views    95 visitors  (mostly redirected to /{locale}#pricing)
/dashboard/        120 views    78 visitors  (signup intent)
```

### Top referrers
```
google             62%
direct             24%
linkedin.com       8%
twitter.com        3%
others             3%
```

### Geography
Countries map with click-through to city-level (Milano, Roma, Madrid, Barcelona, etc.).

### Real-time visitors
"X people on the site right now" — useful when launching campaigns or sharing on social.

---

## 💰 Costs

| Item | Cost |
|------|------|
| Umami software | Free (MIT license) |
| Hosting (uses existing Hetzner VPS) | €0 incremental |
| PostgreSQL (uses existing instance) | €0 incremental |
| SSL cert (Let's Encrypt) | Free |
| **Total** | **€0/month** |

Compare with paid alternatives:
- Plausible: $9/mo (Growth, 10K pageviews)
- Fathom: $15/mo
- Simple Analytics: $19/mo
- GA4: free but requires cookie banner + GDPR friction

---

## 📅 Timeline

| Phase | Duration | Owner |
|-------|----------|-------|
| 1. Infra PR | 30 min | Me (code) + you (review/merge) |
| 2. DNS + SSL | 5 min | You (DNS registrar + 1 SSH command) |
| 3. Umami setup | 5 min | You (web UI) |
| 4. Tracking PR | 15 min | Me (code) + you (review/merge) |
| **Total** | **~1 hour** | Mostly waiting on deploys |

---

## ❓ Open decisions before we start

Confirm or adjust:

- [ ] **Subdomain `analytics.loyali.online`** — OK or prefer something else (`stats.`, `data.`)?
- [ ] **Shared Postgres** — fine to use the same DB instance with isolated database `umami`, or want a fully separate Postgres container (more isolated, more resources)?
- [ ] **Public dashboard** — keep private (admin login only) or share read-only metrics publicly later?
- [ ] **Custom events** — want them on day 1 (CTAs, scroll, lang switch) or after we see basic traffic data first?

Once you confirm, I open `feat/analytics-umami` and start Phase 1.
