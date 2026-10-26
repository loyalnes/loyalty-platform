-- Gamification plays: the prize the server drew for an (campaign, email) pair.
-- Express returned the drawn prize from /play without storing it and let /claim accept any prizeId,
-- so a client could claim the best prize or re-roll. The Worker stores the draw and /claim must match it.
-- No Express equivalent table; CREATE only.

CREATE TABLE IF NOT EXISTS gamification_plays (
  id          TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES gamification_campaigns(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  prize_id    TEXT NOT NULL REFERENCES prizes(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL,
  UNIQUE (campaign_id, email)
);
CREATE INDEX IF NOT EXISTS idx_gamification_plays_prize ON gamification_plays(prize_id);
