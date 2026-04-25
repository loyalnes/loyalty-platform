# Analytics Setup — Operational Runbook

What you (the operator) need to do **after Phase 1 PR is merged** to bring Umami online. ~10 minutes total.

---

## Phase 2 — DNS + SSL (5 min)

### 2.1 Add DNS A record
On your DNS registrar / Cloudflare DNS for `loyali.online`:

| Type | Name       | Value             | TTL  |
|------|------------|-------------------|------|
| A    | analytics  | 46.224.138.230    | Auto |

(`analytics` is the subdomain prefix; FQDN becomes `analytics.loyali.online`.)

Wait ~1-2 minutes for DNS to propagate, then verify:
```bash
dig +short analytics.loyali.online
# Should output: 46.224.138.230
```

### 2.2 Issue SSL certificate (one-time)
SSH to the production server **as root** (same key you use for GitHub Actions deploys):
```bash
ssh root@46.224.138.230
```

Then run certbot to issue the cert and auto-update nginx:
```bash
sudo certbot --nginx -d analytics.loyali.online
```

When prompted:
- Email: your email (for renewal notices)
- Terms: agree
- Optional EFF newsletter: choose
- Redirect HTTP to HTTPS: **2** (redirect)

Verify:
```bash
curl -I https://analytics.loyali.online/
# Should return HTTP 200 (Umami login page)
```

If it returns 502 / 503: the umami container isn't up yet. Run:
```bash
cd /opt/loyalty-platform
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.umami.yml ps
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.umami.yml logs umami --tail 50
```

---

## Phase 3 — Umami initial setup (5 min)

### 3.1 First login
1. Open `https://analytics.loyali.online/`
2. Login with the **default admin credentials**:
   - Username: `admin`
   - Password: `umami`
3. **Immediately go to top-right avatar → Profile → Change password**
   Set a strong password and save it (1Password / Bitwarden / your manager).

### 3.2 Add the marketing site as a tracked website
1. **Settings → Websites → Add website**
2. Fill in:
   - Name: `Loyali Marketing`
   - Domain: `loyali.online`
3. Click **Save**

### 3.3 Get the tracking ID
After saving, the website appears in the list. Click on it, then **Edit**:
- You'll see a **Website ID** (UUID format like `abc12345-def6-7890-1234-567890abcdef`)

Copy that UUID and **send it to me** — I'll wire up Phase 4 (tracking script + custom events) in a follow-up PR.

### 3.4 (Optional) Add team members
If others need dashboard access:
- **Settings → Users → Create user**
- Send them their credentials separately
- Default role is `viewer` (read-only). Use `admin` only for trusted operators.

---

## Phase 4 — Tracking integration (after you send me the Website ID)

Once you give me the Website ID, I'll open `feat/analytics-tracking-script` PR with:

- `<script>` tag in `marketing/src/app/[locale]/layout.tsx` pointing at your domain:
  ```html
  <script defer src="https://analytics.loyali.online/script.js"
          data-website-id="<YOUR-UUID>"></script>
  ```

- Custom events on key interactions:
  - `cta_signup_click` — primary "Start the magic" button (hero, pricing, final CTA)
  - `cta_sales_click` — "Let's talk" button
  - `lang_switch` — language switcher (with `from` and `to` data)
  - `pricing_view` — when pricing section enters viewport

After merge + deploy, wait ~5 minutes, refresh the Umami dashboard, and you should see your first visit data.

---

## Maintenance

### Backups
Umami data lives in the `umami` Postgres database, which is included in the existing `pg_dumpall` backup that `deploy/deploy.sh` runs before each production migration. Backups are kept in `/opt/loyalty-platform/backups/db-*.sql.gz` (last 10 retained).

### Updates
To update Umami to the latest release, the next production deploy will pull `docker.umami.is/umami-software/umami:postgresql-latest` and recreate the container. To pin a specific version, change the `image:` tag in `docker-compose.umami.yml`.

### Disabling temporarily
```bash
cd /opt/loyalty-platform
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.umami.yml stop umami umami-db-init
```

### Log inspection
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.umami.yml logs -f umami
```

---

## Cost summary

- Umami: free (MIT license)
- Hosting: €0 incremental (uses existing Hetzner VPS)
- Postgres: €0 incremental (uses existing instance)
- SSL: free (Let's Encrypt, auto-renewing)

**Total: €0/month.**
