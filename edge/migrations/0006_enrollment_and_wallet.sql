-- Enrollment and wallet: pass records and their tokens, plus merchant push subscriptions.
-- Mirrors WalletPass, WalletScanToken, WalletAccessToken and PushSubscription in prisma/schema.prisma
-- (ids are UUID text, timestamps are ISO-8601 text, enums are CHECK constraints, Json is TEXT).

CREATE TABLE IF NOT EXISTS wallet_passes (
  id                 TEXT PRIMARY KEY,
  loyalty_card_id    TEXT NOT NULL REFERENCES loyalty_cards(id) ON DELETE CASCADE,
  provider           TEXT NOT NULL CHECK (provider IN ('APPLE_WALLET','GOOGLE_WALLET')),
  provider_pass_id   TEXT,
  status             TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE','REVOKED')),
  last_snapshot_hash TEXT,
  last_issued_at     TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  UNIQUE (loyalty_card_id, provider)
);
CREATE INDEX IF NOT EXISTS idx_wallet_passes_card ON wallet_passes(loyalty_card_id);
CREATE INDEX IF NOT EXISTS idx_wallet_passes_status ON wallet_passes(status);

CREATE TABLE IF NOT EXISTS wallet_scan_tokens (
  id             TEXT PRIMARY KEY,
  wallet_pass_id TEXT NOT NULL REFERENCES wallet_passes(id) ON DELETE CASCADE,
  token          TEXT NOT NULL UNIQUE,
  active         INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL,
  revoked_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_wallet_scan_tokens_pass ON wallet_scan_tokens(wallet_pass_id);
CREATE INDEX IF NOT EXISTS idx_wallet_scan_tokens_active ON wallet_scan_tokens(active);

CREATE TABLE IF NOT EXISTS wallet_access_tokens (
  id             TEXT PRIMARY KEY,
  wallet_pass_id TEXT NOT NULL REFERENCES wallet_passes(id) ON DELETE CASCADE,
  token          TEXT NOT NULL UNIQUE,
  active         INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL,
  revoked_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_wallet_access_tokens_pass ON wallet_access_tokens(wallet_pass_id);
CREATE INDEX IF NOT EXISTS idx_wallet_access_tokens_active ON wallet_access_tokens(active);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           TEXT PRIMARY KEY,
  merchant_id  TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  endpoint     TEXT NOT NULL UNIQUE,
  keys         TEXT NOT NULL,
  active       INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL,
  last_used_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_merchant ON push_subscriptions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_merchant_active ON push_subscriptions(merchant_id, active);
