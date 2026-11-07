-- Email + password sign-in: PBKDF2 hash on the merchant, and a counter that limits attempts.
ALTER TABLE merchants ADD COLUMN password_hash TEXT;

CREATE TABLE IF NOT EXISTS auth_throttle (
  key      TEXT PRIMARY KEY,
  count    INTEGER NOT NULL,
  reset_at TEXT NOT NULL
);
