import { Hono } from "hono";
import { movePoints } from "./ledger";
import { ApiError, body, camel, dec, likeStart, paging, requireUuid } from "./lib";
import type { AppEnv, Ctx } from "./lib";

const customers = new Hono<AppEnv>();

type CardRow = { id: string; points_balance: number; total_earned: number; total_redeemed: number; card_number: string; status: string; created_at: string; customer_id: string };

async function enrolledCard(c: Ctx, customerId: string): Promise<CardRow> {
  const card = await c.env.DB.prepare("SELECT * FROM loyalty_cards WHERE merchant_id = ? AND customer_id = ?")
    .bind(c.get("merchantId"), customerId)
    .first<CardRow>();
  if (!card) throw new ApiError(404, "Customer not found or not enrolled in your program");
  return card;
}

async function tiers(c: Ctx) {
  const { results } = await c.env.DB.prepare(
    `SELECT t.id, t.name, t.reward_name, t.threshold, t.sort_order
       FROM reward_tiers t JOIN loyalty_programs p ON p.id = t.loyalty_program_id
      WHERE p.merchant_id = ? ORDER BY t.sort_order ASC`
  )
    .bind(c.get("merchantId"))
    .all<Record<string, unknown>>();
  return results.map((r) => camel(r) as { id: string; name: string; rewardName: string; threshold: number; sortOrder: number });
}

// GET /api/customers?search=&page=&limit=
// One token: startsWith on first name, last name, email or phone. Several tokens: the first must
// EQUAL the first name, the others startsWith last name, email or phone ("el b" ≠ "elio b").
customers.get("/", async (c) => {
  const merchantId = c.get("merchantId");
  const { page, limit, offset } = paging(c);
  const tokens = (c.req.query("search") ?? "").split(/\s+/).filter(Boolean);

  const conditions = ["l.merchant_id = ?"];
  const binds: unknown[] = [merchantId];
  const anyField = "(c.last_name LIKE ? ESCAPE '\\' OR c.email LIKE ? ESCAPE '\\' OR c.phone LIKE ? ESCAPE '\\')";
  if (tokens.length === 1) {
    const like = likeStart(tokens[0]);
    conditions.push(`(c.first_name LIKE ? ESCAPE '\\' OR ${anyField.slice(1)}`);
    binds.push(like, like, like, like);
  } else if (tokens.length > 1) {
    conditions.push("lower(c.first_name) = lower(?)");
    binds.push(tokens[0]);
    for (const token of tokens.slice(1)) {
      conditions.push(anyField);
      const like = likeStart(token);
      binds.push(like, like, like);
    }
  }
  const where = conditions.join(" AND ");
  const from = "FROM loyalty_cards l JOIN customers c ON c.id = l.customer_id";

  const [rows, count] = await c.env.DB.batch([
    c.env.DB.prepare(
      `SELECT l.id, c.id AS customerId, c.first_name AS firstName, c.last_name AS lastName, c.email, c.phone,
              c.avatar_url AS avatarUrl, l.points_balance AS pointsBalance, l.status,
              COALESCE((SELECT MAX(t.created_at) FROM points_transactions t WHERE t.loyalty_card_id = l.id), l.updated_at) AS lastVisitAt
         ${from} WHERE ${where} ORDER BY l.updated_at DESC LIMIT ? OFFSET ?`
    ).bind(...binds, limit, offset),
    c.env.DB.prepare(`SELECT COUNT(*) AS total ${from} WHERE ${where}`).bind(...binds),
  ]);
  const total = (count.results[0] as { total: number }).total;

  c.header("Cache-Control", "no-store");
  return c.json({ data: rows.results, total, page, limit, hasMore: page * limit < total });
});

// GET /api/customers/:customerId/card
customers.get("/:customerId/card", async (c) => {
  const merchantId = c.get("merchantId");
  const customerId = requireUuid(c.req.param("customerId"), "customerId");
  const card = await c.env.DB.prepare("SELECT * FROM loyalty_cards WHERE merchant_id = ? AND customer_id = ?")
    .bind(merchantId, customerId)
    .first<CardRow>();
  if (!card) return c.json({ error: "Customer not found or not enrolled in your program" }, 404);

  const [customer, recent, redemptions, program] = await Promise.all([
    c.env.DB.prepare("SELECT id, first_name, last_name, email, phone, avatar_url FROM customers WHERE id = ?")
      .bind(customerId)
      .first<Record<string, unknown>>(),
    c.env.DB.prepare(
      "SELECT id, type, points, balance_after, description, created_at FROM points_transactions WHERE loyalty_card_id = ? ORDER BY created_at DESC LIMIT 5"
    )
      .bind(card.id)
      .all<Record<string, unknown>>(),
    c.env.DB.prepare("SELECT COUNT(*) AS n FROM points_transactions WHERE loyalty_card_id = ? AND type = 'REDEEM'")
      .bind(card.id)
      .first<{ n: number }>(),
    c.env.DB.prepare("SELECT type, goal_stamps, points_per_currency FROM loyalty_programs WHERE merchant_id = ?")
      .bind(merchantId)
      .first<{ type: "POINTS" | "STAMPS"; goal_stamps: number | null; points_per_currency: number | null }>(),
  ]);
  const rewardTiers = program ? await tiers(c) : [];

  return c.json({
    id: card.id,
    cardNumber: card.card_number,
    customerId,
    firstName: customer?.first_name,
    lastName: customer?.last_name ?? null,
    email: customer?.email,
    phone: customer?.phone ?? null,
    avatarUrl: customer?.avatar_url ?? null,
    pointsBalance: card.points_balance,
    totalEarned: card.total_earned,
    totalRedeemed: card.total_redeemed,
    redemptionsCount: redemptions?.n ?? 0,
    status: card.status,
    recentTransactions: recent.results.map((r) => camel(r)),
    enrolledAt: card.created_at,
    program: program
      ? {
          type: program.type,
          goalStamps: program.goal_stamps,
          pointsPerCurrency: program.points_per_currency === null ? null : Number(program.points_per_currency),
          rewardTiers,
        }
      : null,
  });
});

// POST /api/customers/:customerId/points { points, description }
customers.post("/:customerId/points", async (c) => {
  const customerId = requireUuid(c.req.param("customerId"), "customerId");
  const { points, description } = await body(c);
  if (typeof points !== "number" || !Number.isInteger(points) || points <= 0) {
    return c.json({ error: "Points must be a positive number" }, 400);
  }
  const card = await enrolledCard(c, customerId);
  const result = await movePoints(c, {
    merchantId: c.get("merchantId"),
    cardId: card.id,
    points,
    type: "EARN",
    description: typeof description === "string" && description ? description : "Points added by merchant",
  });
  return c.json({
    success: true,
    transaction: result.transaction,
    card: { pointsBalance: result.pointsBalance, totalEarned: result.totalEarned },
  });
});

// GET /api/customers/:customerId/available-rewards
customers.get("/:customerId/available-rewards", async (c) => {
  const card = await enrolledCard(c, requireUuid(c.req.param("customerId"), "customerId"));
  const allRewards = await tiers(c);
  return c.json({
    availableRewards: allRewards.filter((t) => card.points_balance >= t.threshold),
    allRewards,
    currentPoints: card.points_balance,
  });
});

// POST /api/customers/:customerId/redeem { rewardTierId }
customers.post("/:customerId/redeem", async (c) => {
  const customerId = requireUuid(c.req.param("customerId"), "customerId");
  const { rewardTierId } = await body(c);
  if (typeof rewardTierId !== "string" || !rewardTierId) return c.json({ error: "rewardTierId is required" }, 400);

  const card = await enrolledCard(c, customerId);
  const tier = (await tiers(c)).find((t) => t.id === rewardTierId);
  if (!tier) throw new ApiError(404, "Reward tier not found");
  if (card.points_balance < tier.threshold) {
    throw new ApiError(400, `Insufficient points. Need ${tier.threshold}, have ${card.points_balance}`);
  }

  const result = await movePoints(c, {
    merchantId: c.get("merchantId"),
    cardId: card.id,
    points: tier.threshold,
    type: "REDEEM",
    description: `Redeemed: ${tier.rewardName}`,
  });
  return c.json({
    success: true,
    transaction: result.transaction,
    card: { pointsBalance: result.pointsBalance, totalRedeemed: result.totalRedeemed },
    reward: { name: tier.name, rewardName: tier.rewardName, threshold: tier.threshold },
  });
});

export default customers;
