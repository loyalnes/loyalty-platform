import type { Env } from "./lib";
import { getOrCreateWalletAccessToken, getOrCreateWalletPass, getOrCreateWalletScanToken } from "./wallet-tokens";

export interface WalletSummary {
  walletPassId: string;
  loyaltyCardId: string;
  merchantId: string;
  merchantName: string;
  customerId: string;
  customerName: string;
  cardNumber: string;
  pointsBalance: number;
  pointsBalanceDisplay: string;
  tierName: string | null;
  activePrizeCount: number;
  activePrizes: Array<{
    id: string;
    prizeWinId: string;
    name: string;
    prizeType: string;
    expiresAt: string;
    redemptionCode: string;
    campaignId: string;
    campaignName: string;
    wonAt: string;
  }>;
  availableRewards: Array<{
    id: string;
    name: string;
    rewardName: string;
    threshold: number;
    sortOrder: number;
  }>;
  recentHistory: Array<{
    id: string;
    type: "POINTS" | "PRIZE";
    event: string;
    description: string;
    pointsDelta: number | null;
    createdAt: string;
  }>;
  nearestPrizeExpiration: string | null;
  merchantScanToken: string;
  customerAccessToken: string;
  nextReward: {
    name: string;
    rewardName: string;
    threshold: number;
    pointsToGo: number;
    progress: number;
  } | null;
  marketingOptedIn: boolean;
}

type CardRow = {
  id: string;
  merchant_id: string;
  customer_id: string;
  card_number: string;
  points_balance: number;
  marketing_consent_at: string | null;
  marketing_revoked_at: string | null;
  merchant_name: string;
  first_name: string;
  last_name: string | null;
  template_tier: string | null;
};
type TierRow = { id: string; name: string; reward_name: string; threshold: number; sort_order: number };

// The prize tables (prizes, prize_wins, gamification_campaigns) belong to the gamification migration.
export async function buildWalletSummary(
  env: Env,
  loyaltyCardId: string,
  provider: "APPLE_WALLET" | "GOOGLE_WALLET" = "APPLE_WALLET"
): Promise<WalletSummary | null> {
  const ts = new Date().toISOString();

  const card = await env.DB.prepare(
    `SELECT l.id, l.merchant_id, l.customer_id, l.card_number, l.points_balance, l.marketing_consent_at, l.marketing_revoked_at,
            m.name AS merchant_name, c.first_name, c.last_name, t.tier AS template_tier
       FROM loyalty_cards l
       JOIN merchants m ON m.id = l.merchant_id
       JOIN customers c ON c.id = l.customer_id
       LEFT JOIN card_templates t ON t.id = l.card_template_id
      WHERE l.id = ?`
  )
    .bind(loyaltyCardId)
    .first<CardRow>();
  if (!card) return null;

  const [tiersRes, txRes, activeRes, prizeEventsRes] = await env.DB.batch([
    env.DB.prepare(
      `SELECT r.id, r.name, r.reward_name, r.threshold, r.sort_order
         FROM reward_tiers r JOIN loyalty_programs p ON p.id = r.loyalty_program_id
        WHERE p.merchant_id = ? ORDER BY r.threshold ASC, r.sort_order ASC`
    ).bind(card.merchant_id),
    env.DB.prepare(
      "SELECT id, type, points, description, created_at FROM points_transactions WHERE loyalty_card_id = ? ORDER BY created_at DESC LIMIT 10"
    ).bind(card.id),
    env.DB.prepare(
      `SELECT w.id, w.prize_id, w.campaign_id, w.redemption_code, w.won_at, w.expires_at, p.name AS prize_name,
              p.prize_type, g.name AS campaign_name
         FROM prize_wins w
         JOIN prizes p ON p.id = w.prize_id
         JOIN gamification_campaigns g ON g.id = w.campaign_id
        WHERE w.loyalty_card_id = ? AND w.status = 'PENDING' AND w.expires_at > ?
        ORDER BY w.expires_at ASC`
    ).bind(card.id, ts),
    env.DB.prepare(
      `SELECT w.id, w.status, w.created_at, p.name AS prize_name
         FROM prize_wins w JOIN prizes p ON p.id = w.prize_id
        WHERE w.loyalty_card_id = ? ORDER BY w.created_at DESC LIMIT 10`
    ).bind(card.id),
  ]);

  const tiers = tiersRes.results as TierRow[];
  const balance = card.points_balance;

  const availableRewards = tiers
    .filter((t) => balance >= t.threshold)
    .map((t) => ({ id: t.id, name: t.name, rewardName: t.reward_name, threshold: t.threshold, sortOrder: t.sort_order }));
  const currentTier = tiers.filter((t) => balance >= t.threshold).sort((a, b) => b.threshold - a.threshold)[0] ?? null;
  const nextTier = tiers.filter((t) => balance < t.threshold).sort((a, b) => a.threshold - b.threshold)[0] ?? null;
  const nextReward = nextTier
    ? {
        name: nextTier.name,
        rewardName: nextTier.reward_name,
        threshold: nextTier.threshold,
        pointsToGo: Math.max(0, nextTier.threshold - balance),
        progress: nextTier.threshold > 0 ? Math.min(1, balance / nextTier.threshold) : 0,
      }
    : null;

  const walletPass = await getOrCreateWalletPass(env, card.id, provider);
  const [scanToken, accessToken] = await Promise.all([
    getOrCreateWalletScanToken(env, walletPass.id),
    getOrCreateWalletAccessToken(env, walletPass.id),
  ]);

  const pointEvents = (txRes.results as Array<{ id: string; type: string; points: number; description: string | null; created_at: string }>).map((tx) => ({
    id: tx.id,
    type: "POINTS" as const,
    event: tx.type,
    description: tx.description ?? tx.type,
    pointsDelta: tx.points,
    createdAt: tx.created_at,
  }));
  const prizeHistory = (prizeEventsRes.results as Array<{ id: string; status: string; created_at: string; prize_name: string }>).map((w) => ({
    id: w.id,
    type: "PRIZE" as const,
    event: w.status,
    description: w.prize_name,
    pointsDelta: null,
    createdAt: w.created_at,
  }));
  const recentHistory = [...pointEvents, ...prizeHistory].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10);

  const activePrizes = (activeRes.results as Array<Record<string, string>>).map((w) => ({
    id: w.prize_id,
    prizeWinId: w.id,
    name: w.prize_name,
    prizeType: w.prize_type,
    expiresAt: w.expires_at,
    redemptionCode: w.redemption_code,
    campaignId: w.campaign_id,
    campaignName: w.campaign_name,
    wonAt: w.won_at,
  }));

  return {
    walletPassId: walletPass.id,
    loyaltyCardId: card.id,
    merchantId: card.merchant_id,
    merchantName: card.merchant_name,
    customerId: card.customer_id,
    customerName: `${card.first_name} ${card.last_name ?? ""}`.trim(),
    cardNumber: card.card_number,
    pointsBalance: balance,
    pointsBalanceDisplay: `${balance} pts`,
    tierName: currentTier?.name ?? card.template_tier ?? null,
    activePrizeCount: activePrizes.length,
    activePrizes,
    availableRewards,
    recentHistory,
    nearestPrizeExpiration: activePrizes[0]?.expiresAt ?? null,
    merchantScanToken: scanToken.token,
    customerAccessToken: accessToken.token,
    nextReward,
    marketingOptedIn: Boolean(card.marketing_consent_at && !card.marketing_revoked_at),
  };
}
