# Gamification System Implementation

## Overview

Sistema completo di **customer acquisition gamification** per Loyali. Quando il cliente scansiona il QR code del negozio, viene aperta una web app dove può giocare (gratta e vinci o ruota della fortuna), vincere un premio, lasciare i suoi dati di contatto, e salvare il premio nel wallet di Apple o Google.

---

## ✅ Implementazione Completata

### 1. Database Schema

**Nuovi modelli Prisma:**

- **`GamificationCampaign`** — Campagne di gamification per merchant
  - Nome, descrizione, tipo di gioco (SCRATCH_CARD o SPIN_WHEEL)
  - Date di inizio/fine, stato attivo/inattivo

- **`Prize`** — Premi configurabili
  - Nome, descrizione, tipo (PHYSICAL o DIGITAL)
  - Probabilità (peso per selezione casuale)
  - Validità in giorni, immagine

- **`PrizeWin`** — Traccia chi ha vinto cosa
  - Codice di riscatto univoco (8 caratteri)
  - Stato: PENDING, REDEEMED, EXPIRED
  - Unique constraint `[campaignId, customerId]` → **una giocata per email**

**Customer aggiornato:**
- `dateOfBirth` (opzionale) — per premi compleanno
- `lastName` reso opzionale
- `acquisitionSource` — traccia "qr_gamification"

**Migration:** `prisma/migrations/20260406003210_add_gamification_system/migration.sql`

---

### 2. Backend API

#### Routes Pubbliche (`/api/gamification`)

- **`GET /gamification/:merchantId`**
  - Ottiene campagna attiva per il merchant
  - Ritorna: nome, descrizione, gameType, lista premi

- **`POST /gamification/:merchantId/play`**
  - Body: `{ email }`
  - Verifica se l'email ha già giocato
  - Seleziona premio casuale (weighted random basato su `probability`)
  - Ritorna: dettagli premio vinto

- **`POST /gamification/:merchantId/claim`**
  - Body: `{ prizeId, email, firstName, lastName?, phone?, dateOfBirth? }`
  - Crea/trova Customer
  - Crea/trova LoyaltyCard
  - Crea PrizeWin con redemption code univoco
  - Ritorna: prizeWinId, redemptionCode, loyaltyCard, merchant

#### Routes Autenticate (`/api/campaigns`)

- **`GET /campaigns`** — Lista tutte le campagne del merchant
- **`GET /campaigns/:id`** — Dettagli campagna
- **`POST /campaigns`** — Crea nuova campagna con premi
  - `name` opzionale, con fallback automatico basato su `gameType`
- **`PATCH /campaigns/:id`** — Aggiorna campagna
  - supporta update game type
  - supporta edit/add/remove premi
  - se un premio rimosso ha già vincite, viene disattivato invece di essere cancellato
- **`DELETE /campaigns/:id`** — Elimina campagna
- **`GET /campaigns/:id/stats`** — Statistiche campagna (plays, redemptions, distribution)
- **`POST /campaigns/:id/redeem`** — Riscatta premio (merchant scan)

#### Routes Wallet (`/api/wallet`)

- **`GET /wallet/apple/:prizeWinId`** — Genera Apple Wallet pass (placeholder)
- **`GET /wallet/google/:prizeWinId`** — Genera Google Wallet link (placeholder)
- **`GET /wallet/preview/:prizeWinId`** — Anteprima premio

**Files:**
- `src/routes/gamification.ts`
- `src/routes/campaigns.ts`
- `src/routes/wallet.ts`

---

### 3. Dashboard UI

#### Nuove Pagine

**`/dashboard/campaigns`** — `CampaignsPage.tsx`
- Lista tutte le campagne
- Azioni a livello lista: edit, delete, active/pause
- Badge stato, contatori plays
- Link a stats
- Nessun bottone create nell'header della lista

**`/dashboard/campaigns/new`** — `CreateCampaignPage.tsx`
- Configurazione solo gamification
- Game type con default `SCRATCH_CARD`
- Aggiunta premi con probabilità, tipo, validità
- Validità default premio: 15 giorni
- Nessun campo nome/descrizione campagna
- Validazione pesi
- Redirect dopo save: `/dashboard/campaigns`

**`/dashboard/campaigns/:id/edit`** — `EditCampaignPage.tsx`
- Modifica game type
- Modifica premi esistenti
- Aggiunta/rimozione premi
- Redirect dopo save: `/dashboard/campaigns`

**`/dashboard/campaigns/:id`** — `CampaignDetailPage.tsx`
- Overview statistiche (plays, redeemed, pending, redemption rate)
- Distribuzione premi
- Mostra QR code per condivisione
- Nessuna azione edit in questa view; edit/delete stanno nella lista campagne

#### API Client

**`dashboard/src/api.ts`** — Aggiunti:
- Tipi: `Campaign`, `Prize`, `CampaignStats`, `GameType`, `PrizeType`
- Funzioni: `listCampaigns()`, `createCampaign()`, `updateCampaign()`, `deleteCampaign()`, `getCampaignStats()`, `redeemPrize()`

**Routes aggiornate in `App.tsx`:**
```tsx
<Route path="/campaigns" element={<CampaignsPage />} />
<Route path="/campaigns/new" element={<CreateCampaignPage />} />
<Route path="/campaigns/:id/edit" element={<EditCampaignPage />} />
<Route path="/campaigns/:id" element={<CampaignDetailPage />} />
```

#### Design System Alignment

Il design system del tab **Today** è stato esteso alle principali pagine dashboard:
- Menu
- Campaigns
- Create/Edit Campaign
- Campaign Detail
- Customers
- Show QR
- Scan QR
- Insights
- Customer Detail
- Setup Wizard

L'allineamento è stato fatto introducendo shared surfaces e pattern in `dashboard/src/index.css`
e riducendo gli inline styles nelle nuove pagine.

---

### 4. Customer Gamification App

**`customer/public/play.html`** — Single-page app standalone

#### Flusso:
1. **Load Campaign** — GET `/api/gamification/:merchantId`
2. **Scratch Card Game** — Canvas HTML5 con scratch meccanica
   - Utente "gratta" con mouse/touch
   - Quando > 50% grattato → chiede email e chiama `/play`
3. **Form Raccolta Dati** — Email*, firstName*, lastName, phone, dateOfBirth
4. **Claim Prize** — POST `/api/gamification/:merchantId/claim`
5. **Success Screen** — Mostra redemption code + bottoni wallet

#### Features:
- Responsive, mobile-first
- Stati: loading, error, game, form, success
- Animazioni smooth
- Placeholder per Apple/Google Wallet

**Backend routing:**
```typescript
app.get("/app/play/:merchantId", (_req, res) => {
  res.sendFile(path.join(customerPath, "play.html"));
});
```

**URL:** `https://loyali.online/app/play/{merchantId}`

---

### 5. Wallet Integration (Placeholder)

**Status:** API routes implementate, necessita configurazione certificati

#### Apple Wallet
- Richiede: Apple Developer account, certificati Pass Type ID
- Libreria suggerita: `passkit-generator`
- Formato: PKPass file con barcode QR (redemption code)

#### Google Wallet
- Richiede: Google Cloud service account, Wallet API abilitata
- Libreria suggerita: `@google-pay/passes-rest-client`
- Formato: JWT signed + save link

**Next Steps:**
1. Ottenere certificati Apple Developer
2. Configurare Google Cloud project
3. Implementare generazione pass effettiva
4. Aggiornare `customer/public/play.html` con link reali

---

## 🎯 Decisioni Chiave

1. **Tutti vincono sempre** → Ogni giocata garantisce un premio (migliore conversione)
2. **QR univoco per merchant** → Usa il merchant ID esistente in `/app/play/:merchantId`
3. **Premi fisici + digitali** → `prizeType: PHYSICAL | DIGITAL`
4. **Una giocata per email** → Unique constraint `[campaignId, customerId]`
5. **Redemption via scan** → Merchant scansiona QR/barcode dal wallet

---

## 📊 Flow Completo

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. MERCHANT SETUP (Dashboard)                                   │
│    - Crea campagna                                              │
│    - Configura premi + probabilità                              │
│    - Mostra QR code                                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. CUSTOMER SCANS QR                                            │
│    - Apre /app/play/:merchantId                                 │
│    - Vede landing page con brand merchant                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. GIOCA (Scratch Card / Spin Wheel)                            │
│    - Animazione interattiva                                     │
│    - POST /api/gamification/:merchantId/play                    │
│    - Backend seleziona premio (weighted random)                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. FORM DATI                                                    │
│    - Email*, firstName*, lastName, phone, dateOfBirth           │
│    - POST /api/gamification/:merchantId/claim                   │
│    - Backend crea Customer + LoyaltyCard + PrizeWin            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. PREMIO VINTO                                                 │
│    - Mostra redemption code (es: "A3K9QZ7W")                    │
│    - Bottoni: Apple Wallet | Google Pay                         │
│    - Salva card con premio embedded                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. REDEMPTION (In-store)                                        │
│    - Customer mostra wallet pass                                │
│    - Merchant scansiona QR code                                 │
│    - Dashboard: POST /api/campaigns/:id/redeem                  │
│    - Status → REDEEMED                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Deploy

### Migration
La migration verrà applicata automaticamente dal deployment script:
```bash
npx prisma migrate deploy
```

### Build
```bash
# Backend
npm run build

# Dashboard (già incluso)
cd dashboard && npm run build
```

### Environment Variables
Nessuna nuova variabile richiesta. Sistema usa DB esistente.

---

## 📝 TODO / Future Enhancements

### High Priority
- [ ] Implementare generazione Apple Wallet PKPass
- [ ] Implementare generazione Google Wallet pass
- [ ] Aggiungere Spin Wheel game UI (attualmente solo Scratch Card)
- [ ] Add Scan Redemption UI per merchant
- [ ] Email automation (welcome, reminder premio, compleanno)

### Medium Priority
- [ ] Analytics dashboard (conversion funnel, A/B test campagne)
- [ ] Immagini personalizzate premi
- [ ] Notifiche push per premi in scadenza
- [ ] Limite giocate giornaliere per campagna (anti-abuse)

### Low Priority
- [ ] Social sharing del premio vinto
- [ ] Leaderboard premi più vinti
- [ ] Multi-language customer app (attualmente solo EN)

---

## 📚 Testing Checklist

### Backend
- [ ] GET `/api/gamification/:merchantId` ritorna campagna attiva
- [ ] POST `/api/gamification/:merchantId/play` verifica email duplicata
- [ ] POST `/api/gamification/:merchantId/claim` crea customer + card + prize win
- [ ] POST `/api/campaigns/:id/redeem` marca premio come REDEEMED

### Dashboard
- [ ] Creazione campagna con premi
- [ ] Toggle attiva/pausa campagna
- [ ] Visualizzazione stats (plays, redemptions)
- [ ] QR code generation

### Customer App
- [ ] Load campagna da URL
- [ ] Scratch card funziona su mobile touch
- [ ] Form validation (email required)
- [ ] Success screen mostra redemption code

---

## 🎨 Design Notes

- **Brand Colors:** Gradient viola (#667eea → #764ba2)
- **Typography:** System fonts (-apple-system, Roboto)
- **Icons:** Lucide React (dashboard), emoji (customer app)
- **Responsive:** Mobile-first, funziona su tutti i device
- **Accessibility:** Labels, ARIA attributes, keyboard navigation

---

## 📖 Documentation

### For Merchants
1. Vai su `/dashboard/campaigns`
2. Click "Create Campaign"
3. Configura nome, tipo di gioco, premi
4. Click "View Stats" per vedere QR code
5. Stampa QR o mostra su tablet in-store

### For Customers
1. Scansiona QR code
2. Gioca grattando la card
3. Compila form con email
4. Salva premio nel wallet
5. Mostra codice al merchant per riscattare

---

**Implementation Date:** 2026-04-06  
**Status:** ✅ Complete (pending wallet certificates)  
**Migration:** `20260406003210_add_gamification_system`
