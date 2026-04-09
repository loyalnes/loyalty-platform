# Wallet Pass MVP Plan

Date: 2026-04-06
Scope: loyalty card wallet pass with active prizes, merchant scan flow, private customer web-view

## Session Status

Implemented in this session:
- Prisma wallet domain models and migration
- wallet token services
- wallet summary builder service
- merchant scan resolve API
- customer private loyalty page token flow
- customer private loyalty page UI at `/app/loyalty/:token`
- post-claim `My Loyalty Page` CTA
- Apple Wallet backend integration via WalletWallet
- Apple Wallet CTA visibility on iPhone/Safari
- deploy wiring for WalletWallet env vars in preview/staging/production workflows

Still pending:
- richer pass branding assets replacing placeholders
- final preview validation with live WalletWallet and Google Wallet secrets on real devices (iPhone Safari, Android)
- pass refresh triggers wired into points/prize mutations beyond on-demand generation

## Product Direction

We will build a single persistent wallet pass per `loyaltyCard`.

The pass represents:
- the loyalty card
- current points balance
- current tier
- active temporary prizes linked to the same loyalty card

The merchant redeem flow will be points-first:
- merchant scans the wallet pass barcode
- SaaS shows customer card context
- SaaS shows points balance, active prizes, recent history
- merchant redeems through the SaaS
- when redeeming a points-based reward, points are automatically deducted

Gamification prizes remain attached to the same loyalty card and visible in the SaaS as active prizes.

## Confirmed Decisions

- One persistent pass per loyalty card.
- Show `Add to Wallet` immediately after `claim prize`.
- Show wallet CTA only on compatible device/browser:
  - Apple Wallet on iPhone/Safari
  - Google Wallet on Android-compatible flow
- Customer private page uses a signed one-click stable URL.
- If someone has the valid private URL, access is allowed until revoked.
- Pass front should show:
  - merchant name
  - customer name
  - card number
  - points balance
  - current tier
  - expiration of temporary prizes
- Pass detail should show:
  - redeem instructions
  - terms
- Multiple active prizes per card are allowed.
- Prize expirations are individual.
- Expired or redeemed prizes should disappear from the pass snapshot and remain only in customer history.
- Points updates matter at transaction time.
- MVP can start on WalletWallet free.
- Architecture must remain compatible with a future native Apple Developer implementation.
- No merchant dashboard CTA for wallet pass in MVP.

## Constraint From WalletWallet

Based on public docs reviewed so far, WalletWallet publicly exposes a simple pass-generation API and does not clearly document:
- clickable custom links inside the pass
- back fields / secondary fields / arbitrary pass field control
- stable in-place pass updates with public API semantics

Because of that, MVP will assume:
- wallet pass = compact identification and snapshot artifact
- private customer web-view = rich source of truth

If later we move to native Apple Wallet certificates or a richer provider, the domain model should remain reusable.

## MVP Experience

### Customer

After gamification `claim prize`:
- create or reuse the loyalty card
- create or reuse wallet pass identity for that card
- show:
  - `Add to Apple Wallet` on iPhone/Safari
  - `Add to Google Wallet` on supported Android flow
  - `Open My Loyalty Page`

Current status:
- `Open My Loyalty Page` is implemented
- `Add to Apple Wallet` is implemented through `/api/wallet/access/:token/apple-pass`
- `Add to Google Wallet` is implemented through `/api/wallet/access/:token/google-pass`

Customer private loyalty page shows:
- points balance
- current tier
- active prizes
- prize expiration dates
- recent history
- missions
- future referral/review/share actions

### Merchant

After scanning the wallet pass barcode:
- resolve the scanned token to the loyalty card
- show:
  - points available
  - active prizes
  - recent history
- allow points-first redeem through SaaS

Reward-tier redemption remains points-based:
- if threshold is met, merchant redeems that reward
- points are deducted automatically

Gamification prizes are displayed as active prizes in the same loyalty context.

## Architecture Decisions

### Canonical Pass Identifier

Use a new `walletPassId`, not `loyaltyCard.cardNumber`, as canonical pass identity.

Reason:
- `cardNumber` remains business-facing
- provider migration becomes easier
- pass lifecycle is decoupled from card display value
- barcode token rotation becomes possible without changing business IDs

### Barcode Content

Use a signed merchant scan token, not raw `cardNumber`.

Reason:
- avoids exposing internal card identifier directly
- allows validation and revocation
- supports future expiration or rotation if needed

### Customer Private Access

Use a separate stable signed token for customer private web-view.

Reason:
- merchant scan flow and customer self-service flow are different concerns
- we should not reuse the same token for both

### Provider Strategy

Use an internal wallet snapshot builder plus provider adapters:
- WalletWallet adapter for MVP
- Apple native adapter later
- Google adapter later

This keeps business logic independent from provider payload shape.

## Proposed Data Model

### New Table: `wallet_passes`

Suggested fields:
- `id`
- `loyaltyCardId`
- `provider`
- `providerPassId`
- `status`
- `lastSnapshotHash`
- `lastIssuedAt`
- `createdAt`
- `updatedAt`

Notes:
- one logical pass per loyalty card
- provider-specific metadata stays here
- snapshot hash helps skip unnecessary regeneration

### New Table: `wallet_scan_tokens`

Suggested fields:
- `id`
- `walletPassId`
- `token`
- `active`
- `createdAt`
- `revokedAt`

Notes:
- token encoded in the pass barcode
- resolves scan to loyalty card context

### New Table: `wallet_access_tokens`

Suggested fields:
- `id`
- `walletPassId`
- `token`
- `active`
- `createdAt`
- `revokedAt`

Notes:
- used for private customer loyalty page
- stable and permanent until revoked

### Optional Future Table: `wallet_pass_events`

Suggested use:
- audit updates
- track regeneration reason
- provider failures

## Existing Domain Reuse

Current code already provides relevant building blocks:

- `LoyaltyCard` is the anchor object.
- `PrizeWin.loyaltyCardId` already links gamification prizes to a loyalty card.
- reward-tier redemption already exists via customer reward routes.
- gamification prize redemption already exists via campaign redeem routes.

Important current model note:
- `LoyaltyCard` does not directly point to `LoyaltyProgram`
- `LoyaltyProgram` is currently derived from `merchantId`

That is acceptable for MVP because the card belongs to one merchant and the merchant owns one program.

## Canonical Wallet Snapshot

Define one internal snapshot object used by all providers.

Suggested shape:

```ts
type WalletPassSnapshot = {
  walletPassId: string;
  loyaltyCardId: string;
  merchantId: string;
  merchantName: string;
  customerId: string;
  customerName: string;
  cardNumber: string;
  pointsBalance: number;
  pointsBalanceDisplay: string;
  tierName: string | null;
  activePrizeCount: number;
  activePrizes: Array<{
    id: string;
    name: string;
    expiresAt: string;
    status: "PENDING";
  }>;
  nearestPrizeExpiration: string | null;
  merchantScanToken: string;
  customerWebViewUrl: string;
};
```

## WalletWallet MVP Mapping

Because WalletWallet appears limited, compress the snapshot into a compact pass.

Suggested mapping:
- `title`: merchant name
- `cardLabel`: `LOYALTY`
- `label`: customer name
- `value`: `240 pts · Gold · 2 rewards`
- `barcodeValue`: merchant scan token
- `barcodeFormat`: `QR`
- `expirationDays`: long-lived default
- optional branding:
  - `logoURL`
  - `thumbnailURL`
  - `stripURL`

Current status:
- this compact mapping is implemented in [walletWalletApple.ts](/Users/eliobencini/loyalty-platform/loyalty-platform/src/services/wallet/providers/walletWalletApple.ts)
- `lastSnapshotHash` and `lastIssuedAt` are updated on generation
- branding comes from env vars, with placeholder image URLs currently used in deploy workflows

What will not be assumed for MVP:
- clickable private link inside pass
- rich multi-field prize list inside pass
- reliable push-style in-place updates

## API Contract Proposal

### Customer-Facing

`GET /api/wallet/access/:token`
- serves private customer loyalty web-view
- no merchant auth required

`GET /api/wallet/access/:token/apple-pass`
- generates Apple Wallet pass for the wallet identified by the stable customer access token

`GET /api/wallet/access/:token/google-pass`
- planned Google Wallet equivalent route

### Merchant-Facing

`POST /api/wallet/scan/resolve`
- input: `{ barcodeToken }`
- output:
  - customer identity
  - loyalty card summary
  - available points-based rewards
  - active prizes
  - recent history

Current status:
- implemented as merchant-authenticated [src/routes/wallet.ts](/Users/eliobencini/loyalty-platform/loyalty-platform/src/routes/wallet.ts)
- backed by [walletSummary.ts](/Users/eliobencini/loyalty-platform/loyalty-platform/src/services/walletSummary.ts) and [walletTokens.ts](/Users/eliobencini/loyalty-platform/loyalty-platform/src/services/walletTokens.ts)

### Internal Summary

`GET /api/cards/:id/wallet-summary`
- canonical aggregated source for wallet generation

Current status:
- not exposed yet as a dedicated route
- already available through the internal summary service used by wallet routes

Contents:
- merchant
- customer
- loyalty card
- current tier
- points balance
- active rewards from reward tiers
- active prize wins
- recent history

## Merchant Scan Screen Requirements

After scan, merchant sees:
- customer name
- loyalty card number
- points balance
- tier
- active prizes with expiration
- recent history

Merchant actions:
- redeem points-based reward
- add points

For points-based rewards:
- selecting a reward automatically deducts threshold points

Active prizes remain visible to inform the merchant loyalty context, but MVP wallet scan flow is centered on points-based redemption.

## Customer Private Web-View Requirements

The private page is the rich product surface, not the pass itself.

Required modules:
- loyalty summary
- points balance
- current tier
- active prizes
- prize history
- recent activity
- missions

Future mission examples:
- leave merchant review
- share loyalty program
- referral reward after referred customer reaches first qualifying purchase

## Epics

### Epic 1: Wallet Identity Layer

Goal:
- create wallet pass domain independent from provider

Stories:
- As a system, I want one wallet identity per loyalty card.
- As a system, I want stable merchant scan tokens.
- As a system, I want stable customer access tokens.
- As a system, I want wallet payload generation to be provider-agnostic.

### Epic 2: Customer Wallet Pass Delivery

Goal:
- issue wallet CTA after claim prize

Stories:
- As an iPhone user, I want to add my loyalty card to Apple Wallet after claiming a prize.
- As an Android user, I want the equivalent Google Wallet CTA when supported.
- As a customer, I want the pass to represent my current loyalty card snapshot.

### Epic 3: Merchant Scan + Redeem Console

Goal:
- make pass scan useful inside merchant SaaS

Stories:
- As a merchant, I want scanning a pass to open the customer loyalty context.
- As a merchant, I want to see points, active prizes, and recent history after scan.
- As a merchant, I want to redeem points-based rewards directly from that screen.

### Epic 4: Private Customer Loyalty Page

Goal:
- give the customer a persistent personalized view outside the pass

Stories:
- As a customer, I want a stable private loyalty page.
- As a customer, I want to see my points, prizes, history, and missions.
- As a customer, I want expired or redeemed prizes to disappear from active view but remain in history.

### Epic 5: Pass Refresh Strategy

Goal:
- keep wallet state aligned with business state

Stories:
- As a system, I want wallet payloads refreshed when points change.
- As a system, I want wallet payloads refreshed when prizes are won, redeemed, or expired.
- As a system, I want to avoid unnecessary regeneration if the snapshot did not change.

### Epic 6: Google Wallet Parity

Goal:
- support equivalent Android experience

Stories:
- As an Android customer, I want to add my loyalty card to Google Wallet.
- As a platform, I want a shared summary model used by Apple and Google adapters.

## MVP vs Phase 2

### MVP

- wallet identity model
- merchant scan token
- customer private page token
- wallet summary service and APIs
- Apple Wallet via WalletWallet
- CTA after claim prize
- customer private loyalty page
- merchant scan resolve API
- deploy wiring for WalletWallet configuration across preview/staging/production
- Google Wallet initial adapter if practical
- pass snapshot regeneration endpoint

### Phase 2

- native Apple Wallet implementation with Apple Developer account
- richer pass field control
- in-place pass updates
- deeper Google Wallet support
- mission engine
- referral rewards workflow
- customer notification strategy
- merchant dashboard scan UI integration
- automated refresh triggers after earn/redeem/mutation events

## Technical Tasks In Current Repo

### Backend

- add wallet pass tables to Prisma schema
- add wallet token utilities
- add wallet summary service
- add merchant scan resolve endpoint
- add customer private web-view endpoint
- replace placeholder wallet routes with real provider adapters
- add prize + reward aggregation by loyalty card
- switch runtime database client to PostgreSQL-compatible Prisma path

### Dashboard / Customer Flow

- extend claim-prize success state with wallet CTA logic
- device detection for Apple vs Google wallet CTA
- add customer private page route and UI
- add merchant scan result page / modal integration

### Provider Integration

- create `WalletProvider` interface
- implement `WalletWalletAppleProvider`
- implement `GoogleWalletProvider` placeholder or MVP adapter

## Implemented Repo Changes

### Wallet Domain

- [prisma/schema.prisma](/Users/eliobencini/loyalty-platform/loyalty-platform/prisma/schema.prisma) now includes `WalletPass`, `WalletScanToken`, `WalletAccessToken`, `WalletProvider`, and `WalletPassStatus`
- migration created at [prisma/migrations/20260406100000_add_wallet_passes/migration.sql](/Users/eliobencini/loyalty-platform/loyalty-platform/prisma/migrations/20260406100000_add_wallet_passes/migration.sql)

### Backend Services and Routes

- [src/services/walletTokens.ts](/Users/eliobencini/loyalty-platform/loyalty-platform/src/services/walletTokens.ts) handles pass creation, scan token creation, access token creation, and token resolution
- [src/services/walletSummary.ts](/Users/eliobencini/loyalty-platform/loyalty-platform/src/services/walletSummary.ts) builds the canonical card snapshot with merchant, customer, points, tier, active prizes, redeemable rewards, and recent history
- [src/routes/wallet.ts](/Users/eliobencini/loyalty-platform/loyalty-platform/src/routes/wallet.ts) now exposes:
  - `POST /api/wallet/scan/resolve`
  - `GET /api/wallet/access/:token`
  - `GET /api/wallet/access/:token/apple-pass`
- [src/routes/gamification.ts](/Users/eliobencini/loyalty-platform/loyalty-platform/src/routes/gamification.ts) returns wallet context after successful claim

### Customer Surfaces

- [customer/public/loyalty.html](/Users/eliobencini/loyalty-platform/loyalty-platform/customer/public/loyalty.html) provides the private loyalty page with summary, active prizes, redeemable rewards, recent history, and missions placeholder
- [customer/public/play.html](/Users/eliobencini/loyalty-platform/loyalty-platform/customer/public/play.html) now shows:
  - `My Loyalty Page`
  - `Add to Apple Wallet` on iPhone Safari
  - hidden Google Wallet placeholder until adapter exists
- [src/index.ts](/Users/eliobencini/loyalty-platform/loyalty-platform/src/index.ts) serves `/app/loyalty/:token`

### Wallet Provider and Deploy Wiring

- [src/services/wallet/providers/walletWalletApple.ts](/Users/eliobencini/loyalty-platform/loyalty-platform/src/services/wallet/providers/walletWalletApple.ts) implements the WalletWallet Apple adapter
- [src/services/wallet/providers/googleWallet.ts](/Users/eliobencini/loyalty-platform/loyalty-platform/src/services/wallet/providers/googleWallet.ts) implements the Google Wallet adapter
- [docker-compose.yml](/Users/eliobencini/loyalty-platform/loyalty-platform/docker-compose.yml) passes wallet provider env vars into the app container
- [.github/workflows/preview.yml](/Users/eliobencini/loyalty-platform/loyalty-platform/.github/workflows/preview.yml) exports wallet provider config for previews
- [.github/workflows/deploy.yml](/Users/eliobencini/loyalty-platform/loyalty-platform/.github/workflows/deploy.yml) exports wallet provider config for staging and production
- [deploy/.env.prod.example](/Users/eliobencini/loyalty-platform/loyalty-platform/deploy/.env.prod.example) and [deploy/.env.staging.example](/Users/eliobencini/loyalty-platform/loyalty-platform/deploy/.env.staging.example) document the required variables

### Related Platform Fixes Completed In The Same Session

- preview deploy database wiring fixed in [deploy/preview-deploy.sh](/Users/eliobencini/loyalty-platform/loyalty-platform/deploy/preview-deploy.sh) and [deploy/preview-cleanup.sh](/Users/eliobencini/loyalty-platform/loyalty-platform/deploy/preview-cleanup.sh)
- runtime DB client fixed in [src/prisma.ts](/Users/eliobencini/loyalty-platform/loyalty-platform/src/prisma.ts)
- customer static assets are copied in runtime image via [Dockerfile](/Users/eliobencini/loyalty-platform/loyalty-platform/Dockerfile)
- QR landing static path fixed in [src/index.ts](/Users/eliobencini/loyalty-platform/loyalty-platform/src/index.ts)

## Open Questions To Validate During Implementation

- Whether WalletWallet supports any hidden or undocumented richer fields.
- Whether WalletWallet can support pass update semantics suitable for one persistent pass.
- Whether Google Wallet should launch in the same delivery scope or immediately after Apple MVP.
- Whether mission data needs a first schema now or can remain stubbed in customer web-view.

## Recommended Implementation Order

1. wallet domain model
2. wallet summary builder
3. merchant scan token flow
4. private customer web-view token flow
5. Apple Wallet MVP integration
6. claim-prize CTA integration
7. merchant scan result UI
8. Google Wallet parity

## MVP Success Criteria

- Customer can claim a prize and add a loyalty pass from supported device.
- Merchant can scan the pass and see card context in SaaS.
- Merchant can redeem a points-based reward from the scan flow.
- Active prizes are visible in SaaS and tied to the same loyalty card.
- Customer has a stable private page with points, prizes, history, and mission placeholders.
- Architecture remains portable to native Apple Wallet later.
