# Wallet Pass Execution Plan

Date: 2026-04-06
Target validation environment: PR preview deployment, e.g. `https://pr-30.preview.loyali.online/dashboard/login`

Note:
- Preview validation for Apple Wallet depends on GitHub Actions secret `WALLETWALLET_API_KEY` being configured.

## Goal

Implement the MVP defined in [WALLET_PASS_MVP_PLAN.md](/Users/eliobencini/loyalty-platform/loyalty-platform/WALLET_PASS_MVP_PLAN.md) so it can be tested end-to-end on a preview environment.

Primary validation target:
- customer claims a prize
- sees the correct wallet CTA for the device
- can open a private loyalty page
- merchant can scan the pass barcode and see loyalty context

## Delivery Strategy

Build in thin vertical slices.

1. Domain and persistence
2. Summary and token services
3. Merchant scan API
4. Customer private page API
5. Wallet provider adapters
6. Gamification page CTA
7. Merchant scan UI
8. Preview validation

## Phase 0: Preconditions

Before implementation:
- confirm preview deploy remains green after recent fixes
- confirm `claim prize` flow works in preview
- confirm current merchant scan flow works in preview

Success criteria:
- `https://pr-30.preview.loyali.online/api/health` returns `200`
- dashboard login works
- gamification page works

## Phase 1: Prisma and Domain Model

### Scope

Add wallet identity and token persistence.

### Files

- [prisma/schema.prisma](/Users/eliobencini/loyalty-platform/loyalty-platform/prisma/schema.prisma)
- new migration under [prisma/migrations](/Users/eliobencini/loyalty-platform/loyalty-platform/prisma/migrations)
- optional seed adjustment in [prisma/seed/seed.ts](/Users/eliobencini/loyalty-platform/loyalty-platform/prisma/seed/seed.ts)

### Changes

Add `WalletPass` model:
- `id`
- `loyaltyCardId`
- `provider`
- `providerPassId`
- `status`
- `lastSnapshotHash`
- `lastIssuedAt`
- `createdAt`
- `updatedAt`

Add `WalletScanToken` model:
- `id`
- `walletPassId`
- `token`
- `active`
- `createdAt`
- `revokedAt`

Add `WalletAccessToken` model:
- `id`
- `walletPassId`
- `token`
- `active`
- `createdAt`
- `revokedAt`

Add relations:
- `LoyaltyCard -> walletPasses`

### Notes

- Keep schema vendor-agnostic.
- Do not store provider-specific payload blobs unless required.
- One active wallet pass per card is enough for MVP.

### Done When

- Prisma schema compiles
- migration applies
- `npx tsc` passes

## Phase 2: Wallet Summary Service

### Scope

Create one canonical summary builder for a loyalty card.

### Files

- new service, suggested:
  - [src/services/walletSummary.ts](/Users/eliobencini/loyalty-platform/loyalty-platform/src/services/walletSummary.ts)
- reuse:
  - [src/routes/customers.ts](/Users/eliobencini/loyalty-platform/loyalty-platform/src/routes/customers.ts)
  - [src/routes/campaigns.ts](/Users/eliobencini/loyalty-platform/loyalty-platform/src/routes/campaigns.ts)

### Responsibilities

For a given `loyaltyCardId`, return:
- merchant
- customer
- card number
- points balance
- current tier
- reward tiers currently redeemable
- active prize wins
- nearest prize expiration
- recent transactions

### Key Design Choice

Current program relation is derived through `merchantId`, not directly from `LoyaltyCard`.
That is acceptable for MVP.

### Done When

- service returns a single typed object
- service is reusable by merchant scan, customer view, and wallet providers

## Phase 3: Token Services

### Scope

Create token generation and resolution for:
- merchant scan token
- customer private access token

### Files

- new utility/service, suggested:
  - [src/services/walletTokens.ts](/Users/eliobencini/loyalty-platform/loyalty-platform/src/services/walletTokens.ts)

### Requirements

- opaque random token, not raw `cardNumber`
- stable token lifecycle for MVP
- revocation support

### API Behavior

- create-or-reuse scan token for wallet pass
- create-or-reuse access token for wallet pass
- resolve token to wallet pass and loyalty card

### Done When

- tokens are persisted
- services are covered by integration-level route checks

## Phase 4: Wallet API

### Scope

Replace placeholder wallet behavior with real card-centric routes.

### Files

- [src/routes/wallet.ts](/Users/eliobencini/loyalty-platform/loyalty-platform/src/routes/wallet.ts)
- [src/index.ts](/Users/eliobencini/loyalty-platform/loyalty-platform/src/index.ts)

### New/Updated Endpoints

`POST /api/wallet/card/:loyaltyCardId/apple`
- generate Apple Wallet pass from current snapshot

`POST /api/wallet/card/:loyaltyCardId/google`
- generate Google Wallet output or placeholder contract

`POST /api/wallet/scan/resolve`
- input: `{ barcodeToken }`
- output:
  - customer
  - card
  - points
  - reward tiers
  - active prizes
  - recent history

`GET /api/wallet/access/:token`
- return customer private loyalty page payload

`GET /api/cards/:id/wallet-summary`
- internal or protected merchant API

### Important Refactor

Current wallet routes are prize-win centric.
MVP must become loyalty-card centric.

### Done When

- existing placeholder pass endpoints are no longer the main path
- loyalty card routes work from real data

## Phase 5: Wallet Provider Adapters

### Scope

Create provider abstraction.

### Files

- new files suggested:
  - [src/services/wallet/providers/types.ts](/Users/eliobencini/loyalty-platform/loyalty-platform/src/services/wallet/providers/types.ts)
  - [src/services/wallet/providers/walletWalletApple.ts](/Users/eliobencini/loyalty-platform/loyalty-platform/src/services/wallet/providers/walletWalletApple.ts)
  - [src/services/wallet/providers/googleWallet.ts](/Users/eliobencini/loyalty-platform/loyalty-platform/src/services/wallet/providers/googleWallet.ts)

### WalletWallet Apple MVP Mapping

- `title`: merchant name
- `cardLabel`: `LOYALTY`
- `label`: `POINTS`
- `value`: compact summary like `240 pts · Gold · 2 rewards`
- `barcodeValue`: merchant scan token
- `barcodeFormat`: `QR`

### Open Constraint

Do not assume provider support for:
- clickable links in pass
- multi-field detailed layout
- reliable in-place update semantics

### Config

Add env vars:
- `WALLETWALLET_API_KEY`
- optional branding asset URLs

### Done When

- API can return a valid Apple Wallet artifact
- provider failures surface cleanly

## Phase 6: Customer Private Loyalty Page

### Scope

Add customer-facing page opened through stable tokenized URL.

### Files

- likely new frontend surface under [customer/public/play.html](/Users/eliobencini/loyalty-platform/loyalty-platform/customer/public/play.html) if staying static
- or new server-rendered/SPA surface if desired later
- backend route in [src/routes/wallet.ts](/Users/eliobencini/loyalty-platform/loyalty-platform/src/routes/wallet.ts)

### MVP Content

- points balance
- current tier
- active prizes
- expiry per prize
- recent history
- missions placeholder section

### Notes

- this is the rich experience replacing the unsupported “link inside pass” idea
- URL is stable and token-based

### Done When

- opening the token URL shows personalized loyalty state

## Phase 7: Gamification CTA Integration

### Scope

After `claim prize`, show the right CTA.

### Files

- customer gamification flow:
  - [customer/public/play.html](/Users/eliobencini/loyalty-platform/loyalty-platform/customer/public/play.html)
- related API endpoints in [src/routes/gamification.ts](/Users/eliobencini/loyalty-platform/loyalty-platform/src/routes/gamification.ts)

### Behavior

After successful claim:
- detect Apple Wallet eligible device/browser
- detect Android / Google Wallet eligible flow
- show:
  - `Add to Apple Wallet` or `Add to Google Wallet`
  - `Open My Loyalty Page`

### Device Logic

MVP heuristic:
- iPhone + Safari => Apple CTA
- Android => Google CTA if adapter exists, otherwise only private page CTA

### Done When

- customer can reach wallet or private page immediately after claim

## Phase 8: Merchant Scan UI

### Scope

Extend merchant dashboard scan flow to use wallet scan token resolution.

### Files

- [dashboard/src/pages/ScanQRPage.tsx](/Users/eliobencini/loyalty-platform/loyalty-platform/dashboard/src/pages/ScanQRPage.tsx)
- [dashboard/src/components/CustomerProfileModal.tsx](/Users/eliobencini/loyalty-platform/loyalty-platform/dashboard/src/components/CustomerProfileModal.tsx)
- [dashboard/src/api.ts](/Users/eliobencini/loyalty-platform/loyalty-platform/dashboard/src/api.ts)

### Behavior

After scan:
- resolve token
- show:
  - points balance
  - redeemable reward tiers
  - active prizes
  - recent history

Merchant actions:
- add points
- redeem tier reward
- redeem active prize

### Done When

- merchant can use one scan flow for loyalty context

## Phase 9: Update Strategy

### Scope

Decide how pass freshness works in MVP.

### MVP Strategy

Do not assume push updates to installed pass.

Instead:
- regenerate pass on demand
- expose latest version whenever customer taps wallet CTA again
- keep customer private page always current

### Refresh Triggers

- points added
- points redeemed
- prize claimed
- prize redeemed
- prize expired

### Future

If provider or native Apple implementation supports proper updates:
- reuse same snapshot builder
- reuse same wallet pass identity

## File-Level Task List

### Prisma

- update [prisma/schema.prisma](/Users/eliobencini/loyalty-platform/loyalty-platform/prisma/schema.prisma)
- create migration

### Backend Services

- add `walletSummary.ts`
- add `walletTokens.ts`
- add provider adapters

### Backend Routes

- refactor [src/routes/wallet.ts](/Users/eliobencini/loyalty-platform/loyalty-platform/src/routes/wallet.ts)
- possibly add route helpers for card-centric queries

### Dashboard

- update [dashboard/src/api.ts](/Users/eliobencini/loyalty-platform/loyalty-platform/dashboard/src/api.ts)
- update [dashboard/src/pages/ScanQRPage.tsx](/Users/eliobencini/loyalty-platform/loyalty-platform/dashboard/src/pages/ScanQRPage.tsx)
- update [dashboard/src/components/CustomerProfileModal.tsx](/Users/eliobencini/loyalty-platform/loyalty-platform/dashboard/src/components/CustomerProfileModal.tsx)

### Customer Flow

- update [customer/public/play.html](/Users/eliobencini/loyalty-platform/loyalty-platform/customer/public/play.html)
- add post-claim wallet CTAs
- add private loyalty page UI or token route integration

### Deployment

- inject `WALLETWALLET_API_KEY` into preview and production deployment environments
- ensure preview can hit provider API

## Test Plan

### Local Validation

1. `npx prisma generate`
2. `npx prisma migrate deploy` or dev migration flow
3. `npx tsc`
4. `cd dashboard && npm run build`
5. claim prize locally
6. verify wallet CTA visibility by user agent branch
7. verify merchant scan resolve API

### Preview Validation

Target example:
- `https://pr-30.preview.loyali.online/dashboard/login`

Checklist:
1. Preview deploy succeeds.
2. Dashboard login works.
3. Merchant can reach scan screen.
4. Customer can open gamification page.
5. After claim, correct CTA appears.
6. Customer private page opens from stable token URL.
7. Merchant scan resolves wallet token.
8. Merchant sees points, active prizes, recent history.
9. Tier reward redeem deducts points correctly.
10. Prize redeem updates active prize state correctly.

### Device Validation

Apple:
- iPhone Safari
- Add to Apple Wallet flow

Google:
- Android Chrome
- Google Wallet flow if included in same delivery slice

### Regression Checks

- existing QR claim flow still works
- existing reward tier redeem flow still works
- existing prize redeem flow still works
- preview deployment remains healthy

## Suggested Implementation PR Breakdown

### PR A

Wallet domain and Prisma migration

### PR B

Wallet summary service + token services + scan resolve API

### PR C

Customer private loyalty page + gamification CTA integration

### PR D

WalletWallet Apple adapter + Google adapter stub

### PR E

Merchant scan UI integration

## Risks

- WalletWallet may not support the exact update semantics we want for a persistent pass.
- Google Wallet scope may increase delivery time if done fully in the same slice.
- Customer private page may grow into a larger product surface if missions are started too early.

## Recommendation

For the first implementation pass:
- complete PR A + PR B + PR C
- validate preview on `pr-30`
- then add Apple Wallet provider integration

This reduces the amount of provider uncertainty before the core wallet domain is stable.
