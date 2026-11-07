-- merchant_feedback: reviews from the public review flow (1-4 stars direct, 5 stars tracked redirect to Google Maps).
-- Mirrors the Prisma model MerchantFeedback; timestamps are ISO-8601 text.

CREATE TABLE IF NOT EXISTS merchant_feedback (
  id                 TEXT PRIMARY KEY,
  merchant_id        TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  customer_id        TEXT REFERENCES customers(id) ON DELETE CASCADE,
  rating             INTEGER NOT NULL,
  text               TEXT NOT NULL,
  food_rating        INTEGER,
  service_rating     INTEGER,
  atmosphere_rating  INTEGER,
  source             TEXT NOT NULL DEFAULT 'DIRECT' CHECK (source IN ('DIRECT','GOOGLE_MAPS','OTHER')),
  read_at            TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_feedback_merchant_created ON merchant_feedback(merchant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_customer ON merchant_feedback(customer_id);
CREATE INDEX IF NOT EXISTS idx_feedback_source ON merchant_feedback(source);
CREATE INDEX IF NOT EXISTS idx_feedback_unread ON merchant_feedback(merchant_id, read_at, created_at DESC);
