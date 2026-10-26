import { Hono } from "hono";
import { ApiError, body, camel, now, uuid } from "./lib";
import type { AppEnv, Ctx } from "./lib";

const campaigns = new Hono<AppEnv>();

const GAME_TYPES = ["SCRATCH_CARD", "SPIN_WHEEL"];
const PRIZE_TYPES = ["PHYSICAL", "DIGITAL"];
const PRIZE_COLUMNS =
  "id, campaign_id, name, description, prize_type, prize_value, probability, validity_days, image_url, active, created_at, updated_at";

type Row = Record<string, unknown>;
type PrizeInput = {
  id?: unknown;
  name: string;
  description?: unknown;
  prizeType: string;
  prizeValue?: unknown;
  probability: number;
  validityDays?: unknown;
  imageUrl?: unknown;
  active?: unknown;
};

const defaultName = (gameType: unknown) => (gameType === "SPIN_WHEEL" ? "Spin Wheel Campaign" : "Scratch Card Campaign");

/** Express threw a 500 on bad types (null prize, non-string name, ...); here they are 400s. */
function validatePrizes(prizes: unknown): PrizeInput[] {
  if (!Array.isArray(prizes) || prizes.length === 0) throw new ApiError(400, "At least one prize is required");
  for (const prize of prizes) {
    if (
      typeof prize !== "object" || prize === null || !prize.name || typeof prize.name !== "string"
      || !prize.prizeType || typeof prize.probability !== "number" || !Number.isInteger(prize.probability)
    ) {
      throw new ApiError(400, "Each prize must have name, prizeType, and probability");
    }
    if (!PRIZE_TYPES.includes(prize.prizeType)) throw new ApiError(400, "prizeType must be PHYSICAL or DIGITAL");
    for (const key of ["description", "prizeValue", "imageUrl"]) {
      if (prize[key] && typeof prize[key] !== "string") throw new ApiError(400, `${key} must be a string`);
    }
    if (prize.validityDays && (!Number.isInteger(prize.validityDays) || prize.validityDays < 1)) {
      throw new ApiError(400, "validityDays must be a positive integer");
    }
    if (prize.active !== undefined && prize.active !== null && typeof prize.active !== "boolean") {
      throw new ApiError(400, "active must be a boolean");
    }
  }
  return prizes as PrizeInput[];
}

/** Falsy → null (as Express); a value that is not a valid date is a 400 instead of a Prisma 500. */
function isoDate(value: unknown, label: string): string | null {
  if (!value) return null;
  const date = new Date(value as string | number);
  if (Number.isNaN(date.getTime())) throw new ApiError(400, `Invalid ${label}`);
  return date.toISOString();
}

function textOrNull(value: unknown, label: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new ApiError(400, `${label} must be a string`);
  return value;
}

const prizeOut = (row: Row) => camel(row);

function loadCampaign(c: Ctx, id: string, merchantId: string, withCount: boolean) {
  return c.env.DB.batch<Row>([
    c.env.DB.prepare(
      `SELECT g.*, (SELECT COUNT(*) FROM prize_wins w WHERE w.campaign_id = g.id) AS wins
         FROM gamification_campaigns g WHERE g.id = ? AND g.merchant_id = ?`
    ).bind(id, merchantId),
    c.env.DB.prepare(`SELECT ${PRIZE_COLUMNS} FROM prizes WHERE campaign_id = ? ORDER BY created_at ASC, rowid ASC`).bind(id),
  ]).then(([campaignRes, prizesRes]) => {
    const row = campaignRes.results[0];
    if (!row) return null;
    const { wins, ...campaign } = row;
    return {
      ...camel(campaign),
      prizes: prizesRes.results.map(prizeOut),
      ...(withCount ? { _count: { prizeWins: wins as number } } : {}),
    };
  });
}

// GET /api/campaigns
campaigns.get("/", async (c) => {
  const merchantId = c.get("merchantId");
  const [campaignRes, prizeRes] = await c.env.DB.batch<Row>([
    c.env.DB.prepare(
      `SELECT g.*, (SELECT COUNT(*) FROM prize_wins w WHERE w.campaign_id = g.id) AS wins
         FROM gamification_campaigns g WHERE g.merchant_id = ? ORDER BY g.created_at DESC, g.rowid DESC`
    ).bind(merchantId),
    c.env.DB.prepare(
      `SELECT p.id, p.campaign_id, p.name, p.prize_type, p.probability, p.active
         FROM prizes p JOIN gamification_campaigns g ON g.id = p.campaign_id
        WHERE g.merchant_id = ? ORDER BY p.created_at ASC, p.rowid ASC`
    ).bind(merchantId),
  ]);

  const byCampaign = new Map<string, unknown[]>();
  for (const { campaign_id, ...prize } of prizeRes.results) {
    const list = byCampaign.get(campaign_id as string) ?? [];
    list.push(camel(prize));
    byCampaign.set(campaign_id as string, list);
  }
  return c.json(
    campaignRes.results.map(({ wins, ...campaign }) => ({
      ...camel(campaign),
      prizes: byCampaign.get(campaign.id as string) ?? [],
      _count: { prizeWins: wins as number },
    }))
  );
});

// GET /api/campaigns/:id/stats
campaigns.get("/:id/stats", async (c) => {
  const merchantId = c.get("merchantId");
  const id = c.req.param("id");
  const [campaignRes, statusRes, prizeRes] = await c.env.DB.batch<Row>([
    c.env.DB.prepare("SELECT id, name FROM gamification_campaigns WHERE id = ? AND merchant_id = ?").bind(id, merchantId),
    c.env.DB.prepare("SELECT status, COUNT(*) AS n FROM prize_wins WHERE campaign_id = ? GROUP BY status").bind(id),
    c.env.DB.prepare(
      `SELECT p.name, p.prize_type, p.probability, (SELECT COUNT(*) FROM prize_wins w WHERE w.prize_id = p.id) AS times_won
         FROM prizes p WHERE p.campaign_id = ? ORDER BY p.created_at ASC, p.rowid ASC`
    ).bind(id),
  ]);
  const campaign = campaignRes.results[0];
  if (!campaign) throw new ApiError(404, "Campaign not found");

  const counts: Record<string, number> = {};
  for (const r of statusRes.results) counts[r.status as string] = r.n as number;
  const totalRedeemed = counts.REDEEMED ?? 0;
  const totalExpired = counts.EXPIRED ?? 0;
  const totalPending = counts.PENDING ?? 0;
  const totalPlays = totalRedeemed + totalExpired + totalPending;

  return c.json({
    campaignId: campaign.id,
    campaignName: campaign.name,
    totalPlays,
    totalRedeemed,
    totalExpired,
    totalPending,
    redemptionRate: totalPlays > 0 ? (totalRedeemed / totalPlays) * 100 : 0,
    prizeDistribution: prizeRes.results.map((p) => ({
      prizeName: p.name,
      prizeType: p.prize_type,
      timesWon: p.times_won,
      probability: p.probability,
    })),
  });
});

// GET /api/campaigns/:id
campaigns.get("/:id", async (c) => {
  const campaign = await loadCampaign(c, c.req.param("id"), c.get("merchantId"), true);
  if (!campaign) throw new ApiError(404, "Campaign not found");
  return c.json(campaign);
});

// POST /api/campaigns
campaigns.post("/", async (c) => {
  const merchantId = c.get("merchantId");
  const { name, description, gameType, startDate, endDate, prizes } = await body(c);

  if (!gameType) throw new ApiError(400, "gameType is required");
  if (typeof gameType !== "string" || !GAME_TYPES.includes(gameType)) {
    throw new ApiError(400, "gameType must be SCRATCH_CARD or SPIN_WHEEL");
  }
  const prizeList = validatePrizes(prizes);

  const normalizedName = typeof name === "string" && name.trim().length > 0 ? name.trim() : defaultName(gameType);
  const campaignDescription = textOrNull(description, "description");
  const start = isoDate(startDate, "startDate");
  const end = isoDate(endDate, "endDate");

  const campaignId = uuid();
  const ts = now();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO gamification_campaigns
         (id, merchant_id, name, description, game_type, active, start_date, end_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`
    ).bind(campaignId, merchantId, normalizedName, campaignDescription, gameType, start, end, ts, ts),
    ...prizeList.map((p) =>
      c.env.DB.prepare(
        `INSERT INTO prizes
           (id, campaign_id, name, description, prize_type, prize_value, probability, validity_days, image_url, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
      ).bind(
        uuid(), campaignId, p.name, p.description || null, p.prizeType, p.prizeValue || null,
        p.probability, p.validityDays || 7, p.imageUrl || null, ts, ts
      )
    ),
  ]);

  return c.json(await loadCampaign(c, campaignId, merchantId, false), 201);
});

// PATCH /api/campaigns/:id — prizes, when sent, replace the list: matched ids are updated, new
// ones created, missing ones deleted (or deactivated when they already have wins), in one batch.
campaigns.patch("/:id", async (c) => {
  const merchantId = c.get("merchantId");
  const id = c.req.param("id");
  const { name, description, gameType, active, startDate, endDate, prizes } = await body(c);

  const [campaignRes, prizeIdsRes] = await c.env.DB.batch<Row>([
    c.env.DB.prepare("SELECT id, game_type FROM gamification_campaigns WHERE id = ? AND merchant_id = ?").bind(id, merchantId),
    c.env.DB.prepare("SELECT id FROM prizes WHERE campaign_id = ?").bind(id),
  ]);
  const existing = campaignRes.results[0];
  if (!existing) throw new ApiError(404, "Campaign not found");

  if (gameType !== undefined && (typeof gameType !== "string" || !GAME_TYPES.includes(gameType))) {
    throw new ApiError(400, "gameType must be SCRATCH_CARD or SPIN_WHEEL");
  }
  const prizeList = prizes !== undefined ? validatePrizes(prizes) : null;
  if (active !== undefined && typeof active !== "boolean") throw new ApiError(400, "active must be a boolean");
  if (description !== undefined && description !== null && typeof description !== "string") {
    throw new ApiError(400, "description must be a string");
  }

  const ts = now();
  const sets = ["updated_at = ?"];
  const binds: unknown[] = [ts];
  if (name !== undefined) {
    sets.push("name = ?");
    binds.push(
      typeof name === "string" && name.trim().length > 0 ? name.trim() : defaultName(gameType ?? existing.game_type)
    );
  }
  if (description !== undefined) { sets.push("description = ?"); binds.push(description); }
  if (gameType !== undefined) { sets.push("game_type = ?"); binds.push(gameType); }
  if (active !== undefined) { sets.push("active = ?"); binds.push(active ? 1 : 0); }
  if (startDate !== undefined) { sets.push("start_date = ?"); binds.push(isoDate(startDate, "startDate")); }
  if (endDate !== undefined) { sets.push("end_date = ?"); binds.push(isoDate(endDate, "endDate")); }

  const statements: D1PreparedStatement[] = [];
  if (prizeList) {
    const existingIds = new Set(prizeIdsRes.results.map((r) => r.id as string));
    const keptIds = new Set<string>();
    for (const p of prizeList) {
      const values = [
        p.name.trim(), p.description || null, p.prizeType, p.prizeValue || null, p.probability,
        p.validityDays || 15, p.imageUrl || null, p.active === false ? 0 : 1,
      ];
      if (typeof p.id === "string" && existingIds.has(p.id)) {
        keptIds.add(p.id);
        statements.push(
          c.env.DB.prepare(
            `UPDATE prizes SET name = ?, description = ?, prize_type = ?, prize_value = ?, probability = ?,
                    validity_days = ?, image_url = ?, active = ?, updated_at = ?
              WHERE id = ? AND campaign_id = ?`
          ).bind(...values, ts, p.id, id)
        );
      } else {
        statements.push(
          c.env.DB.prepare(
            `INSERT INTO prizes
               (id, campaign_id, name, description, prize_type, prize_value, probability, validity_days, image_url, active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(uuid(), id, ...values, ts, ts)
        );
      }
    }
    for (const prizeId of existingIds) {
      if (keptIds.has(prizeId)) continue;
      // Evaluated inside the batch, so a win recorded meanwhile cannot break the delete.
      statements.push(
        c.env.DB.prepare(
          "UPDATE prizes SET active = 0, updated_at = ? WHERE id = ? AND EXISTS (SELECT 1 FROM prize_wins WHERE prize_id = prizes.id)"
        ).bind(ts, prizeId),
        c.env.DB.prepare(
          "DELETE FROM prizes WHERE id = ? AND NOT EXISTS (SELECT 1 FROM prize_wins WHERE prize_id = prizes.id)"
        ).bind(prizeId)
      );
    }
  }
  statements.push(
    c.env.DB.prepare(`UPDATE gamification_campaigns SET ${sets.join(", ")} WHERE id = ? AND merchant_id = ?`).bind(...binds, id, merchantId)
  );
  await c.env.DB.batch(statements);

  return c.json(await loadCampaign(c, id, merchantId, false));
});

// DELETE /api/campaigns/:id — prizes and wins go with it (ON DELETE CASCADE)
campaigns.delete("/:id", async (c) => {
  const result = await c.env.DB.prepare("DELETE FROM gamification_campaigns WHERE id = ? AND merchant_id = ?")
    .bind(c.req.param("id"), c.get("merchantId"))
    .run();
  if (!result.meta.changes) throw new ApiError(404, "Campaign not found");
  return c.json({ success: true });
});

// POST /api/campaigns/:id/redeem — the merchant scans the customer's redemption code
campaigns.post("/:id/redeem", async (c) => {
  const merchantId = c.get("merchantId");
  const campaignId = c.req.param("id");
  const { redemptionCode } = await body(c);
  if (!redemptionCode || typeof redemptionCode !== "string") throw new ApiError(400, "redemptionCode is required");

  const win = await c.env.DB.prepare(
    `SELECT w.id, w.status, w.expires_at, g.merchant_id
       FROM prize_wins w JOIN gamification_campaigns g ON g.id = w.campaign_id
      WHERE w.redemption_code = ? AND w.campaign_id = ?`
  )
    .bind(redemptionCode, campaignId)
    .first<Row>();
  if (!win) throw new ApiError(404, "Prize not found");
  if (win.merchant_id !== merchantId) throw new ApiError(403, "Unauthorized");
  if (win.status === "REDEEMED") throw new ApiError(400, "Prize already redeemed");
  const ts = now();
  if (win.status === "EXPIRED" || ts > (win.expires_at as string)) throw new ApiError(400, "Prize has expired");

  // Only one concurrent scan can flip PENDING to REDEEMED.
  const update = await c.env.DB.prepare(
    "UPDATE prize_wins SET status = 'REDEEMED', redeemed_at = ?, updated_at = ? WHERE id = ? AND status = 'PENDING' AND expires_at >= ?"
  )
    .bind(ts, ts, win.id, ts)
    .run();
  if (!update.meta.changes) throw new ApiError(400, "Prize already redeemed");

  const row = await c.env.DB.prepare(
    `SELECT w.*, ${PRIZE_COLUMNS.split(", ").map((k) => `p.${k} AS p_${k}`).join(", ")},
            u.id AS u_id, u.email AS u_email, u.first_name AS u_first_name, u.last_name AS u_last_name,
            u.phone AS u_phone, u.date_of_birth AS u_date_of_birth, u.avatar_url AS u_avatar_url,
            u.acquisition_source AS u_acquisition_source, u.preferred_locale AS u_preferred_locale,
            u.created_at AS u_created_at, u.updated_at AS u_updated_at
       FROM prize_wins w JOIN prizes p ON p.id = w.prize_id JOIN customers u ON u.id = w.customer_id
      WHERE w.id = ?`
  )
    .bind(win.id)
    .first<Row>();
  if (!row) throw new ApiError(404, "Prize not found");

  const win_: Row = {};
  const prize: Row = {};
  const customer: Row = {};
  for (const [key, value] of Object.entries(row)) {
    if (key.startsWith("p_")) prize[key.slice(2)] = value;
    else if (key.startsWith("u_")) customer[key.slice(2)] = value;
    else win_[key] = value;
  }

  return c.json({
    success: true,
    prizeWin: { ...camel<Row>(win_), prize: camel<Row>(prize), customer: camel<Row>(customer) },
    customerName: `${customer.first_name} ${customer.last_name ?? ""}`,
    prizeName: prize.name,
    redeemedAt: win_.redeemed_at,
  });
});

export default campaigns;
