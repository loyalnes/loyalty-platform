import { Hono } from "hono";
import type { Next } from "hono";
import { DEFAULT_SETTINGS } from "./defaults";
import { ApiError, body, camel, newApiKey, now, sha256Hex, uuid } from "./lib";
import type { AppEnv, Ctx } from "./lib";
import { DUMMY_HASH, hashPassword, verifyPassword } from "./password";
import { clientIp, throttle } from "./ratelimit";

const API_KEY_FORMAT = /^loy_(live|test)_[0-9a-f]{64}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 200;

/** X-API-Key → merchantId, through an indexed SHA-256 lookup (one comparison, not one per key). */
export async function authenticateMerchant(c: Ctx, next: Next) {
  const apiKey = c.req.header("X-API-Key");
  if (!apiKey) throw new ApiError(401, "Missing X-API-Key header");
  if (!API_KEY_FORMAT.test(apiKey)) throw new ApiError(401, "Invalid API key format");

  const row = await c.env.DB.prepare(
    `SELECT k.id AS keyId, k.merchant_id AS merchantId
       FROM api_keys k JOIN merchants m ON m.id = k.merchant_id
      WHERE k.key_hash = ? AND k.active = 1 AND m.active = 1
        AND (k.expires_at IS NULL OR k.expires_at > ?)`
  )
    .bind(await sha256Hex(apiKey), now())
    .first<{ keyId: string; merchantId: string }>();
  if (!row) throw new ApiError(401, "Invalid or inactive API key");

  c.executionCtx.waitUntil(
    c.env.DB.prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?").bind(now(), row.keyId).run()
  );
  c.set("merchantId", row.merchantId);
  await next();
}

async function issueSessionApiKey(c: Ctx, merchantId: string, label: string): Promise<string> {
  const apiKey = newApiKey();
  const ts = now();
  await c.env.DB.prepare(
    "INSERT INTO api_keys (id, merchant_id, key_hash, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(uuid(), merchantId, await sha256Hex(apiKey), label, ts, ts)
    .run();
  return apiKey;
}

const SESSION_MERCHANT = "id, name, email, plan, preferred_locale, active, created_at";

const auth = new Hono<AppEnv>();

// POST /api/auth/signup { name, email, password } → { merchant, apiKey }
auth.post("/signup", async (c) => {
  await throttle(c, `signup:${clientIp(c)}`, 5, 60 * 60 * 1000);
  const { name, email, password } = await body(c);
  if (typeof name !== "string" || !name.trim() || typeof email !== "string" || typeof password !== "string") {
    throw new ApiError(400, "name, email, and password are required");
  }
  const address = email.trim().toLowerCase();
  if (!EMAIL.test(address)) throw new ApiError(400, "A valid email is required");
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    throw new ApiError(400, `Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters`);
  }

  const existing = await c.env.DB.prepare("SELECT id FROM merchants WHERE email = ?").bind(address).first();
  if (existing) throw new ApiError(409, "A merchant with this email already exists");

  const id = uuid();
  const ts = now();
  await c.env.DB.prepare(
    `INSERT INTO merchants (id, name, email, plan, preferred_locale, active, password_hash, settings, created_at, updated_at)
     VALUES (?, ?, ?, 'FREE', 'en', 1, ?, ?, ?, ?)`
  )
    .bind(id, name.trim(), address, await hashPassword(password), DEFAULT_SETTINGS, ts, ts)
    .run();

  const merchant = await c.env.DB.prepare(`SELECT ${SESSION_MERCHANT} FROM merchants WHERE id = ?`).bind(id).first<Record<string, unknown>>();
  return c.json({ merchant: camel(merchant ?? {}), apiKey: await issueSessionApiKey(c, id, "Initial signup") }, 201);
});

// POST /api/auth/login { email, password } → { merchant, apiKey }
auth.post("/login", async (c) => {
  const { email, password } = await body(c);
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    throw new ApiError(400, "email and password are required");
  }
  const address = email.trim().toLowerCase();
  const throttleKey = `login:${address}|${clientIp(c)}`;
  await throttle(c, throttleKey, 5, 15 * 60 * 1000);

  const merchant = await c.env.DB.prepare(`SELECT ${SESSION_MERCHANT}, password_hash FROM merchants WHERE email = ? AND active = 1`)
    .bind(address)
    .first<Record<string, unknown> & { password_hash: string | null }>();

  // Verify against a dummy hash when the account is unknown, so the response time does not tell
  // which emails are registered.
  const valid = await verifyPassword(password.slice(0, MAX_PASSWORD_LENGTH), merchant?.password_hash ?? DUMMY_HASH);
  if (!merchant || !merchant.password_hash || !valid) throw new ApiError(401, "Invalid email or password");

  c.executionCtx.waitUntil(c.env.DB.prepare("DELETE FROM auth_throttle WHERE key = ?").bind(throttleKey).run());
  const { password_hash: _omit, ...safe } = merchant;
  return c.json({ merchant: camel(safe), apiKey: await issueSessionApiKey(c, String(merchant.id), `Login ${now().slice(0, 10)}`) });
});

export default auth;
