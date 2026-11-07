import { now, uuid } from "./lib";
import type { Env } from "./lib";

/**
 * Applies the merchant's welcome bonus to a freshly created loyalty card.
 *
 * Same ledger pattern as ledger.ts (ledger row and balance update in ONE D1 batch), with one guard
 * more: the row is written only when the card has no welcome BONUS yet, and the balance moves only
 * when that row was written. A second call for the same card therefore changes nothing and returns null.
 */
export async function applyWelcomeBonus(
  env: Env,
  args: { merchantId: string; loyaltyCardId: string }
): Promise<{ pointsAdded: number; stampsAdded: number } | null> {
  const { merchantId, loyaltyCardId } = args;

  const program = await env.DB.prepare(
    "SELECT type, welcome_points, welcome_stamps FROM loyalty_programs WHERE merchant_id = ? AND active = 1"
  )
    .bind(merchantId)
    .first<{ type: "POINTS" | "STAMPS"; welcome_points: number | null; welcome_stamps: number | null }>();
  if (!program) return null;

  const welcomePoints = program.type === "POINTS" ? program.welcome_points ?? 0 : 0;
  const welcomeStamps = program.type === "STAMPS" ? program.welcome_stamps ?? 0 : 0;
  if (welcomePoints <= 0 && welcomeStamps <= 0) return null;

  const delta = welcomePoints || welcomeStamps;
  const description = program.type === "POINTS" ? "Welcome bonus" : "Welcome stamp";
  const id = uuid();
  const ts = now();

  const [inserted] = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO points_transactions (id, loyalty_card_id, type, points, balance_after, description, reference_id, created_at)
       SELECT ?1, id, 'BONUS', ?2, points_balance + ?2, ?3, NULL, ?4 FROM loyalty_cards
        WHERE id = ?5 AND merchant_id = ?6 AND status = 'ACTIVE'
          AND NOT EXISTS (SELECT 1 FROM points_transactions
                           WHERE loyalty_card_id = ?5 AND type = 'BONUS' AND description IN ('Welcome bonus', 'Welcome stamp'))`
    ).bind(id, delta, description, ts, loyaltyCardId, merchantId),
    env.DB.prepare(
      `UPDATE loyalty_cards
          SET points_balance = points_balance + ?1, total_earned = total_earned + ?1, updated_at = ?2
        WHERE id = ?3 AND merchant_id = ?4 AND EXISTS (SELECT 1 FROM points_transactions WHERE id = ?5)`
    ).bind(delta, ts, loyaltyCardId, merchantId, id),
  ]);

  if (!inserted.meta.changes) return null;
  return { pointsAdded: welcomePoints, stampsAdded: welcomeStamps };
}
