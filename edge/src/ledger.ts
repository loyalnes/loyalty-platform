import { ApiError, now, uuid } from "./lib";
import type { Ctx } from "./lib";

export type LedgerResult = {
  transaction: { id: string; points: number; balanceAfter: number; createdAt: string };
  pointsBalance: number;
  totalEarned: number;
  totalRedeemed: number;
};

type Movement = {
  merchantId: string;
  cardId: string;
  points: number; // always positive
  type: "EARN" | "REDEEM" | "BONUS";
  description: string | null;
  referenceId?: string | null;
};

/**
 * Moves points and writes the ledger row in ONE D1 batch (a single transaction).
 * The ledger row is inserted first and computes balance_after from the current balance, both
 * statements carry the same guards, so a redemption that would overdraw the card writes
 * nothing at all and the caller gets a clean 400.
 */
export async function movePoints(c: Ctx, m: Movement): Promise<LedgerResult> {
  const redeem = m.type === "REDEEM";
  const id = uuid();
  const ts = now();
  const delta = redeem ? -m.points : m.points;
  const guard = redeem ? "AND points_balance >= ?7" : "";

  const [, updated] = await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO points_transactions (id, loyalty_card_id, type, points, balance_after, description, reference_id, created_at)
       SELECT ?1, id, ?2, ?3, points_balance + ?3, ?4, ?5, ?6 FROM loyalty_cards
        WHERE id = ?8 AND merchant_id = ?9 AND status = 'ACTIVE' ${guard}`
    ).bind(id, m.type, delta, m.description, m.referenceId ?? null, ts, m.points, m.cardId, m.merchantId),
    c.env.DB.prepare(
      `UPDATE loyalty_cards
          SET points_balance = points_balance + ?1,
              total_earned = total_earned + ?2,
              total_redeemed = total_redeemed + ?3,
              updated_at = ?4
        WHERE id = ?8 AND merchant_id = ?9 AND status = 'ACTIVE' ${guard}
        RETURNING points_balance AS pointsBalance, total_earned AS totalEarned, total_redeemed AS totalRedeemed`
    ).bind(delta, redeem ? 0 : m.points, redeem ? m.points : 0, ts, null, null, m.points, m.cardId, m.merchantId),
  ]);

  const row = updated.results[0] as { pointsBalance: number; totalEarned: number; totalRedeemed: number } | undefined;
  if (!row) throw new ApiError(400, redeem ? "Insufficient points balance" : "Card is not active");

  return {
    transaction: { id, points: delta, balanceAfter: row.pointsBalance, createdAt: ts },
    ...row,
  };
}
