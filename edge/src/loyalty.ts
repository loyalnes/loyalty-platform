import { Hono } from "hono";
import { enrollCustomer, parseEnrollInput } from "./enrollment";
import { ApiError, body, requireUuid } from "./lib";
import type { AppEnv } from "./lib";
import { clientIp, throttle } from "./ratelimit";

// PUBLIC (mounted at /api/loyalty, no X-API-Key).
const loyalty = new Hono<AppEnv>();

// Limits of src/middleware/rateLimiter.ts: 100 requests/min/IP for public reads (generalRateLimiter),
// 10/min/IP for public writes (the gamification and feedback limiters).
const READ_LIMIT = { limit: 100, windowMs: 60_000 };
const JOIN_LIMIT = { limit: 10, windowMs: 60_000 };

// GET /api/loyalty/:merchantId/public-summary — Public merchant info for the join page
loyalty.get("/:merchantId/public-summary", async (c) => {
  await throttle(c, `loyalty-summary:${clientIp(c)}`, READ_LIMIT.limit, READ_LIMIT.windowMs);
  const merchantId = requireUuid(c.req.param("merchantId"), "merchantId");

  const merchant = await c.env.DB.prepare("SELECT id, name, active FROM merchants WHERE id = ?")
    .bind(merchantId)
    .first<{ id: string; name: string; active: number }>();
  if (!merchant || !merchant.active) throw new ApiError(404, "Merchant not found");

  const program = await c.env.DB.prepare("SELECT type, active FROM loyalty_programs WHERE merchant_id = ?")
    .bind(merchantId)
    .first<{ type: string; active: number }>();

  return c.json({
    id: merchant.id,
    name: merchant.name,
    hasLoyaltyProgram: Boolean(program?.active),
    programType: program?.type ?? null,
  });
});

// POST /api/loyalty/:merchantId/join — Public customer enrollment (no game).
// Submitting the form is itself the acceptance of Terms + Privacy (Art. 6(1)(b) GDPR); enrollCustomer
// stamps gdpr_consent_at for SELF_JOIN.
loyalty.post("/:merchantId/join", async (c) => {
  await throttle(c, `loyalty-join:${clientIp(c)}`, JOIN_LIMIT.limit, JOIN_LIMIT.windowMs);
  const merchantId = requireUuid(c.req.param("merchantId"), "merchantId");
  const input = parseEnrollInput(await body(c), true);

  const merchant = await c.env.DB.prepare("SELECT id, name FROM merchants WHERE id = ?")
    .bind(merchantId)
    .first<{ id: string; name: string }>();
  if (!merchant) throw new ApiError(404, "Merchant not found");

  const result = await enrollCustomer(c.env, merchantId, input, "SELF_JOIN");

  const origin = (c.env as { PUBLIC_URL?: string }).PUBLIC_URL || new URL(c.req.url).origin;

  return c.json(
    {
      alreadyEnrolled: result.alreadyEnrolled,
      accessToken: result.accessToken,
      applePassUrl: `${origin}/api/wallet/access/${result.accessToken}/apple-pass`,
      googleSaveUrl: `${origin}/api/wallet/access/${result.accessToken}/google-pass`,
      loyaltyUrl: `${origin}/app/loyalty/${result.accessToken}`,
      merchant: { id: merchant.id, name: merchant.name },
    },
    result.isNewCustomer ? 201 : 200
  );
});

export default loyalty;
