-- Gamification: campaigns, their prizes and the prize wins. Mirrors prisma/schema.prisma
-- (ids are UUID text, timestamps ISO-8601 text, enums CHECK constraints, booleans 0/1).
-- Used by src/campaigns.ts (merchant API) and the public play endpoints (gamification).

CREATE TABLE IF NOT EXISTS gamification_campaigns (
  id          TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  game_type   TEXT NOT NULL CHECK (game_type IN ('SCRATCH_CARD','SPIN_WHEEL')),
  active      INTEGER NOT NULL DEFAULT 1,
  start_date  TEXT,
  end_date    TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_campaigns_merchant ON gamification_campaigns(merchant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_active ON gamification_campaigns(active);
CREATE INDEX IF NOT EXISTS idx_campaigns_merchant_active ON gamification_campaigns(merchant_id, active);

CREATE TABLE IF NOT EXISTS prizes (
  id            TEXT PRIMARY KEY,
  campaign_id   TEXT NOT NULL REFERENCES gamification_campaigns(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  prize_type    TEXT NOT NULL CHECK (prize_type IN ('PHYSICAL','DIGITAL')),
  prize_value   TEXT,
  probability   INTEGER NOT NULL,
  validity_days INTEGER NOT NULL DEFAULT 7,
  image_url     TEXT,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_prizes_campaign ON prizes(campaign_id);

-- prize_id has no ON DELETE action (Prisma default): a prize that was won cannot be deleted,
-- only deactivated. Deleting the campaign removes prizes and wins together through the cascades.
CREATE TABLE IF NOT EXISTS prize_wins (
  id               TEXT PRIMARY KEY,
  campaign_id      TEXT NOT NULL REFERENCES gamification_campaigns(id) ON DELETE CASCADE,
  prize_id         TEXT NOT NULL REFERENCES prizes(id),
  customer_id      TEXT NOT NULL REFERENCES customers(id),
  loyalty_card_id  TEXT REFERENCES loyalty_cards(id),
  status           TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','REDEEMED','EXPIRED')),
  redemption_code  TEXT NOT NULL UNIQUE,
  won_at           TEXT NOT NULL,
  redeemed_at      TEXT,
  expires_at       TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  UNIQUE (campaign_id, customer_id)
);
CREATE INDEX IF NOT EXISTS idx_prize_wins_campaign ON prize_wins(campaign_id);
CREATE INDEX IF NOT EXISTS idx_prize_wins_customer ON prize_wins(customer_id);
CREATE INDEX IF NOT EXISTS idx_prize_wins_status ON prize_wins(status);
CREATE INDEX IF NOT EXISTS idx_prize_wins_prize ON prize_wins(prize_id);
