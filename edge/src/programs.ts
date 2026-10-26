import { Hono } from "hono";
import { ApiError, body, camel, dec, now, uuid } from "./lib";
import type { AppEnv, Ctx } from "./lib";

const programs = new Hono<AppEnv>();

export async function loadProgram(c: Ctx, merchantId: string) {
  const program = await c.env.DB.prepare("SELECT * FROM loyalty_programs WHERE merchant_id = ?")
    .bind(merchantId)
    .first<Record<string, unknown>>();
  if (!program) return null;

  const { results: tiers } = await c.env.DB.prepare(
    "SELECT * FROM reward_tiers WHERE loyalty_program_id = ? ORDER BY sort_order ASC"
  )
    .bind(program.id)
    .all<Record<string, unknown>>();

  return {
    ...camel(program),
    pointsPerCurrency: dec(program.points_per_currency),
    rewardTiers: tiers.map((t) => camel(t)),
  };
}

// POST /api/programs — create the loyalty program with its reward tiers (once per merchant)
programs.post("/", async (c) => {
  const merchantId = c.get("merchantId");
  const { type, goalStamps, welcomeStamps, welcomePoints, pointsPerCurrency, rewardTiers } = await body(c);

  if (type !== "POINTS" && type !== "STAMPS") throw new ApiError(400, "type must be POINTS or STAMPS");

  const existing = await c.env.DB.prepare("SELECT id FROM loyalty_programs WHERE merchant_id = ?").bind(merchantId).first();
  if (existing) throw new ApiError(409, "You already have a loyalty program");

  if (type === "STAMPS" && (typeof goalStamps !== "number" || goalStamps < 1)) {
    throw new ApiError(400, "goalStamps must be a positive number for STAMPS programs");
  }
  if (type === "POINTS" && pointsPerCurrency !== undefined && (typeof pointsPerCurrency !== "number" || pointsPerCurrency <= 0)) {
    throw new ApiError(400, "pointsPerCurrency must be a positive number");
  }
  if (!Array.isArray(rewardTiers) || rewardTiers.length === 0) {
    throw new ApiError(400, "At least one reward tier is required");
  }
  for (const tier of rewardTiers) {
    if (
      typeof tier !== "object" || tier === null
      || typeof tier.threshold !== "number" || tier.threshold <= 0
      || typeof tier.rewardName !== "string" || tier.rewardName.trim().length === 0
    ) {
      throw new ApiError(400, "Each reward tier needs a positive threshold and a non-empty rewardName");
    }
  }

  const programId = uuid();
  const ts = now();
  const stamps = type === "STAMPS";
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO loyalty_programs
         (id, merchant_id, type, goal_stamps, welcome_stamps, welcome_points, points_per_currency, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
    ).bind(
      programId,
      merchantId,
      type,
      stamps ? goalStamps : null,
      stamps ? ((welcomeStamps as number) || 0) : null,
      stamps ? null : ((welcomePoints as number) || 0),
      stamps ? null : ((pointsPerCurrency as number) || 1),
      ts,
      ts
    ),
    ...rewardTiers.map((tier: { name?: string; threshold: number; rewardName: string }, i: number) =>
      c.env.DB.prepare(
        `INSERT INTO reward_tiers (id, loyalty_program_id, name, threshold, reward_name, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(uuid(), programId, tier.name ?? "", tier.threshold, tier.rewardName, i, ts, ts)
    ),
  ]);

  return c.json(await loadProgram(c, merchantId), 201);
});

// GET /api/programs/mine — the merchant's program, or null; hasTransactions locks editing in the UI
programs.get("/mine", async (c) => {
  const merchantId = c.get("merchantId");
  const program = await loadProgram(c, merchantId);
  if (!program) return c.json(null);

  const active = await c.env.DB.prepare(
    "SELECT 1 AS found FROM loyalty_cards WHERE merchant_id = ? AND (total_earned > 0 OR total_redeemed > 0) LIMIT 1"
  )
    .bind(merchantId)
    .first();
  return c.json({ ...program, hasTransactions: Boolean(active) });
});

export default programs;
