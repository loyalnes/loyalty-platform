-- Phase 1: merchant profile, programs and reward tiers, card templates, customer and card columns
-- that the dashboard reads. Decimal columns are REAL and serialised as strings by the API, as Prisma did.

ALTER TABLE merchants ADD COLUMN phone TEXT;
ALTER TABLE merchants ADD COLUMN address TEXT;
ALTER TABLE merchants ADD COLUMN city TEXT;
ALTER TABLE merchants ADD COLUMN country TEXT;
ALTER TABLE merchants ADD COLUMN settings TEXT NOT NULL DEFAULT '{}';

ALTER TABLE customers ADD COLUMN phone TEXT;
ALTER TABLE customers ADD COLUMN date_of_birth TEXT;
ALTER TABLE customers ADD COLUMN avatar_url TEXT;
ALTER TABLE customers ADD COLUMN acquisition_source TEXT;
ALTER TABLE customers ADD COLUMN preferred_locale TEXT NOT NULL DEFAULT 'en';

ALTER TABLE loyalty_cards ADD COLUMN card_template_id TEXT;
ALTER TABLE loyalty_cards ADD COLUMN expires_at TEXT;
ALTER TABLE loyalty_cards ADD COLUMN gdpr_consent_at TEXT;
ALTER TABLE loyalty_cards ADD COLUMN marketing_consent_at TEXT;
ALTER TABLE loyalty_cards ADD COLUMN marketing_revoked_at TEXT;
ALTER TABLE loyalty_cards ADD COLUMN enrollment_source TEXT NOT NULL DEFAULT 'SELF_JOIN' CHECK (enrollment_source IN ('SELF_JOIN','MERCHANT_MANUAL'));

ALTER TABLE api_keys ADD COLUMN updated_at TEXT;

CREATE TABLE IF NOT EXISTS card_templates (
  id                  TEXT PRIMARY KEY,
  merchant_id         TEXT NOT NULL REFERENCES merchants(id),
  name                TEXT NOT NULL,
  description         TEXT,
  tier                TEXT NOT NULL DEFAULT 'STANDARD' CHECK (tier IN ('STANDARD','SILVER','GOLD','PLATINUM')),
  points_per_currency REAL NOT NULL DEFAULT 1,
  redemption_rate     REAL NOT NULL DEFAULT 0.01,
  min_redeem_points   INTEGER NOT NULL DEFAULT 100,
  bonus_multiplier    REAL NOT NULL DEFAULT 1,
  validity_days       INTEGER,
  active              INTEGER NOT NULL DEFAULT 1,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_templates_merchant ON card_templates(merchant_id);

CREATE TABLE IF NOT EXISTS loyalty_programs (
  id                  TEXT PRIMARY KEY,
  merchant_id         TEXT NOT NULL UNIQUE REFERENCES merchants(id),
  type                TEXT NOT NULL CHECK (type IN ('POINTS','STAMPS')),
  goal_stamps         INTEGER,
  welcome_stamps      INTEGER,
  welcome_points      INTEGER,
  points_per_currency REAL,
  active              INTEGER NOT NULL DEFAULT 1,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reward_tiers (
  id                 TEXT PRIMARY KEY,
  loyalty_program_id TEXT NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  threshold          INTEGER NOT NULL,
  reward_name        TEXT NOT NULL,
  sort_order         INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tiers_program ON reward_tiers(loyalty_program_id);
