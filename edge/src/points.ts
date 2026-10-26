import { Hono } from "hono";
import { movePoints } from "./ledger";
import { ApiError, body, camel, paging, requireUuid } from "./lib";
import type { AppEnv, Ctx } from "./lib";

const points = new Hono<AppEnv>();

type Card = { id: string; merchant_id: string; status: string; points_balance: number; card_number: string; total_earned: number; total_redeemed: number; min_redeem: number | null };

async function ownCard(c: Ctx, cardId: string): Promise<Card> {
  const card = await c.env.DB.prepare(
    `SELECT l.*, t.min_redeem_points AS min_redeem
       FROM loyalty_cards l LEFT JOIN card_templates t ON t.id = l.card_template_id
      WHERE l.id = ?`
  )
    .bind(cardId)
    .first<Card>();
  if (!card || card.merchant_id !== c.get("merchantId")) throw new ApiError(404, "Card not found");
  return card;
}

function movementInput(input: Record<string, unknown>) {
  const { loyaltyCardId, points: amount, description, referenceId } = input;
  if (typeof loyaltyCardId !== "string" || !Number.isInteger(amount) || (amount as number) <= 0) {
    throw new ApiError(400, "loyaltyCardId and a positive points value are required");
  }
  return {
    cardId: loyaltyCardId,
    points: amount as number,
    description: typeof description === "string" && description ? description : null,
    referenceId: typeof referenceId === "string" && referenceId ? referenceId : null,
  };
}

// POST /api/points/earn
points.post("/earn", async (c) => {
  const input = movementInput(await body(c));
  const card = await ownCard(c, input.cardId);
  if (card.status !== "ACTIVE") throw new ApiError(400, "Card is not active");

  const result = await movePoints(c, { ...input, merchantId: c.get("merchantId"), type: "EARN" });
  return c.json({ balance: result.pointsBalance }, 201);
});

// POST /api/points/redeem
points.post("/redeem", async (c) => {
  const input = movementInput(await body(c));
  const card = await ownCard(c, input.cardId);
  if (card.status !== "ACTIVE") throw new ApiError(400, "Card is not active");

  const minRedeem = card.min_redeem ?? 0;
  if (input.points < minRedeem) throw new ApiError(400, `Minimum redemption is ${minRedeem} points`);
  if (card.points_balance < input.points) throw new ApiError(400, "Insufficient points balance");

  const result = await movePoints(c, { ...input, merchantId: c.get("merchantId"), type: "REDEEM" });
  return c.json({ balance: result.pointsBalance }, 201);
});

// GET /api/points/balance/:cardId
points.get("/balance/:cardId", async (c) => {
  const card = await ownCard(c, requireUuid(c.req.param("cardId"), "cardId"));
  return c.json({
    id: card.id,
    cardNumber: card.card_number,
    pointsBalance: card.points_balance,
    totalEarned: card.total_earned,
    totalRedeemed: card.total_redeemed,
    status: card.status,
  });
});

// GET /api/points/history/:cardId?page=&limit=&type=
points.get("/history/:cardId", async (c) => {
  const cardId = requireUuid(c.req.param("cardId"), "cardId");
  await ownCard(c, cardId);
  const { page, limit, offset } = paging(c);
  const type = c.req.query("type");

  const where = type ? "loyalty_card_id = ? AND type = ?" : "loyalty_card_id = ?";
  const binds = type ? [cardId, type] : [cardId];
  const [rows, count] = await c.env.DB.batch([
    c.env.DB.prepare(`SELECT * FROM points_transactions WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).bind(...binds, limit, offset),
    c.env.DB.prepare(`SELECT COUNT(*) AS total FROM points_transactions WHERE ${where}`).bind(...binds),
  ]);
  return c.json({
    data: (rows.results as Record<string, unknown>[]).map((r) => camel(r)),
    total: (count.results[0] as { total: number }).total,
    page,
    limit,
  });
});

export default points;
