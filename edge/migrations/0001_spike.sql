-- Spike schema: the tables behind login, points and stats. Mirrors prisma/schema.prisma
-- (ids are UUID text, timestamps are ISO-8601 text, enums are CHECK constraints).

CREATE TABLE IF NOT EXISTS merchants (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  plan       TEXT NOT NULL DEFAULT 'FREE' CHECK (plan IN ('FREE','STARTER','PROFESSIONAL','ENTERPRISE')),
  preferred_locale TEXT NOT NULL DEFAULT 'en' CHECK (preferred_locale IN ('en','it','es')),
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name  TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS loyalty_cards (
  id             TEXT PRIMARY KEY,
  card_number    TEXT NOT NULL UNIQUE,
  merchant_id    TEXT NOT NULL REFERENCES merchants(id),
  customer_id    TEXT NOT NULL REFERENCES customers(id),
  status         TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED','EXPIRED','CANCELLED')),
  points_balance INTEGER NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
  total_earned   INTEGER NOT NULL DEFAULT 0,
  total_redeemed INTEGER NOT NULL DEFAULT 0,
  issued_at      TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  UNIQUE (merchant_id, customer_id)
);
CREATE INDEX IF NOT EXISTS idx_cards_merchant ON loyalty_cards(merchant_id);

CREATE TABLE IF NOT EXISTS points_transactions (
  id              TEXT PRIMARY KEY,
  loyalty_card_id TEXT NOT NULL REFERENCES loyalty_cards(id),
  type            TEXT NOT NULL CHECK (type IN ('EARN','REDEEM','ADJUST','EXPIRE','BONUS')),
  points          INTEGER NOT NULL,
  balance_after   INTEGER NOT NULL,
  description     TEXT,
  reference_id    TEXT,
  created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tx_card_created ON points_transactions(loyalty_card_id, created_at DESC);

-- API keys are 256 random bits, so a SHA-256 digest is enough and allows an indexed lookup
-- (the Express app compared against every bcrypt hash on each request).
CREATE TABLE IF NOT EXISTS api_keys (
  id           TEXT PRIMARY KEY,
  merchant_id  TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  key_hash     TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL DEFAULT 'Default API Key',
  active       INTEGER NOT NULL DEFAULT 1,
  last_used_at TEXT,
  expires_at   TEXT,
  created_at   TEXT NOT NULL
);

-- Passwordless sign-in: single-use token, only its hash is stored.
CREATE TABLE IF NOT EXISTS magic_tokens (
  token_hash  TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  expires_at  TEXT NOT NULL,
  used_at     TEXT
);
