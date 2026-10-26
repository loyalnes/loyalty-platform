// /api/gamification: PUBLIC mount (the customer play page), no X-API-Key.
// GET /:merchantId, POST /:merchantId/play, POST /:merchantId/claim.

import { Hono } from "hono";
import { ApiError, body, now, requireUuid, uuid } from "./lib";
import type { AppEnv, Ctx } from "./lib";
import { parseEnrollInput } from "./enrollment";
import { clientIp, throttle } from "./ratelimit";
import { generateRedemptionCode } from "./redemption-code";
import { buildWalletSummary } from "./wallet-summary";
import { applyWelcomeBonus } from "./welcome-bonus";

const gamification = new Hono<AppEnv>();

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** gamificationRateLimiter: 10 requests per minute per IP, with the Express body. */
async function playLimit(c: Ctx, scope: string): Promise<Response | null> {
  try {
    await throttle(c, `${scope}:${clientIp(c)}`, 10, 60_000);
    return null;
  } catch (err) {
    if (err instanceof ApiError && err.status === 429) {
      return c.json({ error: "Too many play attempts, please slow down.", retryAfter: "1 minute" }, 429);
    }
    throw err;
  }
}

type CampaignRow = { id: string; name: string; description: string | null; game_type: string; merchant_id: string; merchant_name: string };
type PrizeRow = {
  id: string;
  name: string;
  description: string | null;
  prize_type: string;
  prize_value: string | null;
  probability: number;
  validity_days: number;
  image_url: string | null;
};

/** Active campaign of a merchant whose date window contains now (null bounds are open). */
async function findActiveCampaign(c: Ctx, merchantId: string): Promise<CampaignRow | null> {
  const ts = now();
  return c.env.DB.prepare(
    `SELECT g.id, g.name, g.description, g.game_type, g.merchant_id, m.name AS merchant_name
       FROM gamification_campaigns g JOIN merchants m ON m.id = g.merchant_id
      WHERE g.merchant_id = ?1 AND g.active = 1
        AND (g.start_date IS NULL OR g.start_date <= ?2) AND (g.end_date IS NULL OR g.end_date >= ?2)
      ORDER BY g.created_at ASC, g.id ASC LIMIT 1`
  )
    .bind(merchantId, ts)
    .first<CampaignRow>();
}

const PRIZE_COLS = "id, name, description, prize_type, prize_value, probability, validity_days, image_url";

async function activePrizes(c: Ctx, campaignId: string): Promise<PrizeRow[]> {
  const res = await c.env.DB.prepare(`SELECT ${PRIZE_COLS} FROM prizes WHERE campaign_id = ? AND active = 1 ORDER BY created_at ASC, id ASC`)
    .bind(campaignId)
    .all<PrizeRow>();
  return res.results;
}

/** Uniform integer in [0, max) from Web Crypto, with rejection sampling so no value is favoured. */
function randomBelow(max: number): number {
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return buf[0] % max;
}

/** Weighted draw by `probability` (integer weights; a weight of 0 or less never wins). */
function selectRandomPrize(prizes: PrizeRow[]): PrizeRow | null {
  const weighted = prizes.filter((p) => p.probability > 0);
  const total = weighted.reduce((sum, p) => sum + p.probability, 0);
  if (!weighted.length || total > 0xffff_ffff) return null;
  let roll = randomBelow(total);
  for (const prize of weighted) {
    roll -= prize.probability;
    if (roll < 0) return prize;
  }
  return weighted[0];
}

const prizeJson = (p: PrizeRow) => ({
  prizeId: p.id,
  prizeName: p.name,
  prizeDescription: p.description,
  prizeType: p.prize_type,
  prizeValue: p.prize_value,
  imageUrl: p.image_url,
  validityDays: p.validity_days,
});

// GET /api/gamification/:merchantId
gamification.get("/:merchantId", async (c) => {
  await throttle(c, `gamification-get:${clientIp(c)}`, 100, 60_000);
  const merchantId = requireUuid(c.req.param("merchantId"), "merchant ID");
  const campaign = await findActiveCampaign(c, merchantId);
  if (!campaign) throw new ApiError(404, "No active campaign found for this merchant");

  const prizes = await activePrizes(c, campaign.id);
  return c.json({
    id: campaign.id,
    name: campaign.name,
    description: campaign.description,
    gameType: campaign.game_type,
    merchant: { id: campaign.merchant_id, name: campaign.merchant_name },
    prizes: prizes.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      prizeType: p.prize_type,
      imageUrl: p.image_url,
      probability: p.probability,
    })),
  });
});

// POST /api/gamification/:merchantId/play { email } → the drawn prize (the win itself is created by /claim)
gamification.post("/:merchantId/play", async (c) => {
  const limited = await playLimit(c, "gamification");
  if (limited) return limited;

  const { email: rawEmail } = await body(c);
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !EMAIL.test(email)) throw new ApiError(400, "Valid email is required");
  const merchantId = requireUuid(c.req.param("merchantId"), "merchant ID");

  const campaign = await findActiveCampaign(c, merchantId);
  if (!campaign) throw new ApiError(404, "No active campaign found");
  const prizes = await activePrizes(c, campaign.id);
  if (prizes.length === 0) throw new ApiError(400, "No prizes available");

  const played = await c.env.DB.prepare(
    `SELECT 1 AS hit FROM prize_wins w JOIN customers cu ON cu.id = w.customer_id WHERE w.campaign_id = ? AND cu.email = ?`
  )
    .bind(campaign.id, email)
    .first();
  if (played) throw new ApiError(409, "You have already played this campaign");

  const drawn = selectRandomPrize(prizes);
  if (!drawn) throw new ApiError(400, "No prizes available");

  // One draw per (campaign, email): a repeated play returns the stored prize instead of re-rolling,
  // unless that prize was deactivated meanwhile. /claim only accepts the stored prize.
  const [, stored] = await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO gamification_plays (id, campaign_id, email, prize_id, created_at) VALUES (?1, ?2, ?3, ?4, ?5)
       ON CONFLICT (campaign_id, email) DO UPDATE SET prize_id = excluded.prize_id, created_at = excluded.created_at
        WHERE (SELECT active FROM prizes WHERE id = gamification_plays.prize_id) = 0`
    ).bind(uuid(), campaign.id, email, drawn.id, now()),
    c.env.DB.prepare(
      `SELECT ${PRIZE_COLS.split(", ").map((col) => `p.${col}`).join(", ")}
         FROM gamification_plays gp JOIN prizes p ON p.id = gp.prize_id WHERE gp.campaign_id = ? AND gp.email = ?`
    ).bind(campaign.id, email),
  ]);
  return c.json(prizeJson(stored.results[0] as PrizeRow));
});

type ClaimPrize = { id: string; campaign_id: string; validity_days: number; merchant_id: string; merchant_name: string; campaign_active: number };

// POST /api/gamification/:merchantId/claim { prizeId, email, firstName, lastName?, phone?, dateOfBirth? }
gamification.post("/:merchantId/claim", async (c) => {
  const limited = await playLimit(c, "gamification-claim");
  if (limited) return limited;

  const merchantId = requireUuid(c.req.param("merchantId"), "merchant ID");
  const raw = await body(c);
  const { prizeId, email, firstName, dateOfBirth } = raw;
  if (!prizeId || !email || !firstName) throw new ApiError(400, "prizeId, email, and firstName are required");
  if (typeof prizeId !== "string" || typeof email !== "string" || typeof firstName !== "string") {
    throw new ApiError(400, "prizeId, email, and firstName are required");
  }
  const input = parseEnrollInput(raw, false);
  const address = input.email.trim().toLowerCase();
  let birth: string | null = null;
  if (dateOfBirth) {
    const parsed = typeof dateOfBirth === "string" ? new Date(dateOfBirth) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) throw new ApiError(400, "dateOfBirth must be a valid date");
    birth = parsed.toISOString();
  }

  const invalid = () => new ApiError(400, "Invalid prize or campaign");
  const prize = UUID_OK(prizeId)
    ? await c.env.DB.prepare(
        `SELECT p.id, p.campaign_id, p.validity_days, g.merchant_id, m.name AS merchant_name, g.active AS campaign_active
           FROM prizes p JOIN gamification_campaigns g ON g.id = p.campaign_id JOIN merchants m ON m.id = g.merchant_id
          WHERE p.id = ?`
      )
        .bind(prizeId)
        .first<ClaimPrize>()
    : null;
  if (!prize || prize.merchant_id !== merchantId || !prize.campaign_active) throw invalid();

  // When /play stored the server's draw for this email, the claim must match it (no re-rolling).
  // customer/public/play.html still draws client-side and calls /claim directly, so with no stored
  // draw the prize is accepted as Express does. Closing that needs the page to draw on the server.
  const drawn = await c.env.DB.prepare("SELECT prize_id FROM gamification_plays WHERE campaign_id = ? AND email = ?")
    .bind(prize.campaign_id, address)
    .first<{ prize_id: string }>();
  if (drawn && drawn.prize_id !== prize.id) throw invalid();

  const ts = now();
  const expiresAt = new Date(Date.now() + prize.validity_days * DAY_MS).toISOString();
  const cardNumber = `LC-${uuid().replace(/-/g, "").slice(0, 16).toUpperCase()}`;

  // One batch = one transaction. Every insert is ON CONFLICT DO NOTHING and meta.changes says what THIS
  // request created. The (campaign_id, customer_id) UNIQUE index lets exactly one racing claim win.
  let results: D1Result[] | null = null;
  for (let attempt = 0; attempt < 3 && !results; attempt++) {
    try {
      results = await c.env.DB.batch([
        c.env.DB.prepare(
          `INSERT INTO customers (id, email, first_name, last_name, phone, date_of_birth, acquisition_source, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'qr_gamification', ?7, ?7) ON CONFLICT (email) DO NOTHING`
        ).bind(uuid(), address, input.firstName.trim(), input.lastName ? input.lastName.trim() : "", input.phone ? input.phone.trim() : null, birth, ts),
        c.env.DB.prepare(
          `INSERT INTO loyalty_cards (id, card_number, merchant_id, customer_id, issued_at, created_at, updated_at)
           SELECT ?1, ?2, ?3, id, ?4, ?4, ?4 FROM customers WHERE email = ?5
           ON CONFLICT (merchant_id, customer_id) DO NOTHING`
        ).bind(uuid(), cardNumber, merchantId, ts, address),
        c.env.DB.prepare(
          `INSERT INTO prize_wins (id, campaign_id, prize_id, customer_id, loyalty_card_id, status, redemption_code, won_at, expires_at, created_at, updated_at)
           SELECT ?1, ?2, ?3, cu.id, l.id, 'PENDING', ?4, ?5, ?6, ?5, ?5
             FROM customers cu JOIN loyalty_cards l ON l.customer_id = cu.id AND l.merchant_id = ?7
            WHERE cu.email = ?8
           ON CONFLICT (campaign_id, customer_id) DO NOTHING`
        ).bind(uuid(), prize.campaign_id, prize.id, generateRedemptionCode(), ts, expiresAt, merchantId, address),
        c.env.DB.prepare(
          `SELECT l.id AS card_id, l.card_number, w.id AS win_id, w.redemption_code, w.expires_at, p.name AS prize_name, p.prize_type
             FROM customers cu
             JOIN loyalty_cards l ON l.customer_id = cu.id AND l.merchant_id = ?1
             JOIN prize_wins w ON w.customer_id = cu.id AND w.campaign_id = ?2
             JOIN prizes p ON p.id = w.prize_id
            WHERE cu.email = ?3`
        ).bind(merchantId, prize.campaign_id, address),
      ]);
    } catch (err) {
      // A redemption-code collision (UNIQUE) rolls the batch back; draw a new code and try again.
      if (!(err instanceof Error && /redemption_code/.test(err.message)) || attempt === 2) throw err;
    }
  }
  const [newCustomer, newCard, newWin, selected] = results!;
  if (!newWin.meta.changes) throw new ApiError(409, "Prize already claimed");

  const row = selected.results[0] as {
    card_id: string;
    card_number: string;
    win_id: string;
    redemption_code: string;
    expires_at: string;
    prize_name: string;
    prize_type: string;
  };

  // Welcome bonus only for the request that created the card; best effort, as in Express.
  if (newCard.meta.changes > 0) {
    await applyWelcomeBonus(c.env, { merchantId, loyaltyCardId: row.card_id }).catch((err) => {
      console.error("Failed to apply welcome bonus:", err);
    });
  }

  const walletSummary = await buildWalletSummary(c.env, row.card_id);
  return c.json({
    prizeWinId: row.win_id,
    redemptionCode: row.redemption_code,
    prizeName: row.prize_name,
    prizeType: row.prize_type,
    expiresAt: row.expires_at,
    loyaltyCard: { id: row.card_id, cardNumber: row.card_number },
    merchant: { id: merchantId, name: prize.merchant_name },
    wallet: walletSummary
      ? {
          loyaltyPagePath: `/app/loyalty/${walletSummary.customerAccessToken}`,
          customerAccessToken: walletSummary.customerAccessToken,
          merchantScanToken: walletSummary.merchantScanToken,
        }
      : null,
    isNewCustomer: newCustomer.meta.changes > 0,
  });
});

function UUID_OK(value: string): boolean {
  try {
    requireUuid(value, "id");
    return true;
  } catch {
    return false;
  }
}

export default gamification;
