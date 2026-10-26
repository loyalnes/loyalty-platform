// /api/stats (authenticated): dashboard KPIs, recent feedback, sentiment and notifications.
// Every figure is one SQL aggregation; each request is a single DB.batch.

import { Hono } from "hono";
import type { AppEnv, Ctx } from "./lib";

const stats = new Hono<AppEnv>();

const DAY = 24 * 60 * 60 * 1000;
const PERIOD_MS: Record<string, number> = { "24h": DAY, "7d": 7 * DAY, "30d": 30 * DAY };

/** `period` preset, or a custom from/to range whose length (not its end) sets the window, as in Express. */
function parseWindow(c: Ctx): { since: string; previousSince: string } {
  const from = c.req.query("from");
  const to = c.req.query("to");
  let sinceMs: number | null = null;
  let windowMs = 0;
  if (typeof from === "string" && typeof to === "string") {
    const f = new Date(from).getTime();
    const t = new Date(to).getTime();
    if (!Number.isNaN(f) && !Number.isNaN(t) && t > f) {
      sinceMs = f;
      windowMs = t - f;
    }
  }
  if (sinceMs === null) {
    windowMs = PERIOD_MS[c.req.query("period") ?? ""] ?? PERIOD_MS["7d"];
    sinceMs = Date.now() - windowMs;
  }
  return { since: new Date(sinceMs).toISOString(), previousSince: new Date(sinceMs - windowMs).toISOString() };
}

function trend(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  if (previous === 0) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

const round1 = (v: number | null): number | null => (v === null || v === undefined ? null : Number(v.toFixed(1)));

// Cards of a merchant that are ACTIVE and whose balance is within max(10, 10% of the tier) of the next POINTS tier.
const NEAR_REWARD_SQL = `
  SELECT COUNT(*) AS n
  FROM loyalty_cards c
  JOIN reward_tiers t ON t.id = (
    SELECT rt.id FROM reward_tiers rt
    WHERE rt.loyalty_program_id = (SELECT id FROM loyalty_programs WHERE merchant_id = ?1 AND type = 'POINTS')
      AND rt.threshold > c.points_balance
    ORDER BY rt.threshold ASC LIMIT 1)
  WHERE c.merchant_id = ?1 AND c.status = 'ACTIVE'
    AND t.threshold - c.points_balance <= MAX(10, CAST(t.threshold * 0.1 AS INTEGER))`;

// GET /api/stats
stats.get("/", async (c) => {
  const merchantId = c.get("merchantId");
  const { since, previousSince } = parseWindow(c);
  const db = c.env.DB;

  const [cards, returning, near, feedback] = await db.batch<Record<string, number | null>>([
    db
      .prepare(
        `SELECT
           COALESCE(SUM(status = 'ACTIVE'), 0)                                  AS active,
           COALESCE(SUM(status = 'ACTIVE' AND created_at < ?2), 0)              AS active_before,
           COALESCE(SUM(created_at >= ?2), 0)                                   AS new_members,
           COALESCE(SUM(created_at >= ?3 AND created_at < ?2), 0)               AS previous_new,
           COALESCE(SUM(created_at < ?2), 0)                                    AS existing_before,
           COALESCE(SUM(status = 'ACTIVE' AND created_at < ?3), 0)              AS active_before_previous,
           COALESCE(SUM(created_at < ?3), 0)                                    AS existing_before_previous
         FROM loyalty_cards WHERE merchant_id = ?1`
      )
      .bind(merchantId, since, previousSince),
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM loyalty_cards c
         WHERE c.merchant_id = ?1 AND c.created_at < ?2
           AND EXISTS (SELECT 1 FROM points_transactions t WHERE t.loyalty_card_id = c.id AND t.created_at >= ?2)`
      )
      .bind(merchantId, since),
    db.prepare(NEAR_REWARD_SQL).bind(merchantId),
    db
      .prepare(
        `SELECT COALESCE(SUM(created_at >= ?2), 0) AS reviews,
                AVG(CASE WHEN created_at >= ?2 THEN rating END) AS avg_rating,
                AVG(CASE WHEN created_at < ?2 THEN rating END)  AS previous_avg_rating
         FROM merchant_feedback WHERE merchant_id = ?1 AND created_at >= ?3`
      )
      .bind(merchantId, since, previousSince),
  ]);

  const k = cards.results[0] as Record<string, number>;
  const activeMembers = k.active;
  const newMembers = k.new_members;
  const f = feedback.results[0] as Record<string, number | null>;
  const avgRating = round1(f.avg_rating);
  const previousAvgRating = round1(f.previous_avg_rating);
  const retention = k.existing_before > 0 ? Number(((k.active_before / k.existing_before) * 100).toFixed(1)) : null;
  const previousRetention =
    k.existing_before_previous > 0 ? Number(((k.active_before_previous / k.existing_before_previous) * 100).toFixed(1)) : null;

  c.header("Cache-Control", "private, max-age=300");
  c.header("Last-Modified", new Date().toUTCString());
  return c.json({
    activeCommunity: activeMembers,
    newUsers: newMembers,
    activeMembers,
    newMembers,
    returningCustomers: returning.results[0].n,
    reviewsCount: f.reviews,
    nearRewardCustomers: near.results[0].n,
    avgRating,
    retention,
    trends: {
      activeMembers: trend(activeMembers, k.active_before),
      newMembers: trend(newMembers, k.previous_new),
      nearRewardCustomers: null,
      avgRating: trend(avgRating, previousAvgRating),
      retention: trend(retention, previousRetention),
    },
  });
});

// GET /api/stats/feedback?limit=
stats.get("/feedback", async (c) => {
  const merchantId = c.get("merchantId");
  const { since } = parseWindow(c);
  const requested = Number(c.req.query("limit") || 6);
  const limit = Math.floor(Math.min(Math.max(Number.isFinite(requested) ? requested : 6, 1), 30));

  const { results } = await c.env.DB.prepare(
    `SELECT f.id,
            CASE WHEN cu.id IS NULL THEN 'Anonymous' ELSE TRIM(cu.first_name || COALESCE(' ' || cu.last_name, '')) END AS customer_name,
            f.rating, f.created_at, f.text, f.read_at IS NULL AS is_new,
            f.food_rating, f.service_rating, f.atmosphere_rating, f.source
     FROM merchant_feedback f LEFT JOIN customers cu ON cu.id = f.customer_id
     WHERE f.merchant_id = ? AND f.created_at >= ?
     ORDER BY f.created_at DESC LIMIT ?`
  )
    .bind(merchantId, since, limit)
    .all<Record<string, unknown>>();

  c.header("Cache-Control", "private, max-age=120");
  return c.json({
    feedback: results.map((r) => ({
      id: r.id,
      customerName: r.customer_name,
      rating: r.rating,
      createdAt: r.created_at,
      text: r.text,
      isNew: Boolean(r.is_new),
      foodRating: r.food_rating,
      serviceRating: r.service_rating,
      atmosphereRating: r.atmosphere_rating,
      source: r.source,
    })),
  });
});

// GET /api/stats/sentiment
stats.get("/sentiment", async (c) => {
  const merchantId = c.get("merchantId");
  const { since } = parseWindow(c);

  const { results } = await c.env.DB.prepare(
    `SELECT MAX(1, MIN(5, rating)) AS bucket, COUNT(*) AS n, SUM(rating) AS total_rating
     FROM merchant_feedback WHERE merchant_id = ? AND created_at >= ? GROUP BY bucket`
  )
    .bind(merchantId, since)
    .all<{ bucket: number; n: number; total_rating: number }>();

  const distribution = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  let total = 0;
  let sum = 0;
  for (const r of results) {
    distribution[String(r.bucket) as keyof typeof distribution] = r.n;
    total += r.n;
    sum += r.total_rating;
  }

  c.header("Cache-Control", "private, max-age=300");
  return c.json({ total, average: total > 0 ? Number((sum / total).toFixed(1)) : null, distribution });
});

// GET /api/stats/notifications
stats.get("/notifications", async (c) => {
  const merchantId = c.get("merchantId");
  const staleLimit = new Date(Date.now() - 30 * DAY).toISOString();
  const db = c.env.DB;

  const [near, inactive, ready] = await db.batch<{ n: number }>([
    db.prepare(NEAR_REWARD_SQL).bind(merchantId),
    // No update and no transaction in the last 30 days.
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM loyalty_cards c
         WHERE c.merchant_id = ?1 AND c.status = 'ACTIVE' AND c.updated_at < ?2
           AND NOT EXISTS (SELECT 1 FROM points_transactions t WHERE t.loyalty_card_id = c.id AND t.created_at >= ?2)`
      )
      .bind(merchantId, staleLimit),
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM loyalty_cards
         WHERE merchant_id = ?1 AND status = 'ACTIVE'
           AND points_balance >= (SELECT MIN(t.threshold) FROM reward_tiers t
                                  JOIN loyalty_programs p ON p.id = t.loyalty_program_id
                                  WHERE p.merchant_id = ?1 AND p.type = 'POINTS')`
      )
      .bind(merchantId),
  ]);

  const nearRewardCustomers = near.results[0].n;
  const inactiveCustomers = inactive.results[0].n;
  const rewardReadyCustomers = ready.results[0].n;
  const notifications: Record<string, unknown>[] = [];

  // English fallback strings; clients localise with `type` + `count`.
  if (rewardReadyCustomers > 0) {
    notifications.push({
      id: "reward-ready",
      type: "reward_ready",
      count: rewardReadyCustomers,
      title: "Customers ready to redeem",
      description: `${rewardReadyCustomers} customer${rewardReadyCustomers === 1 ? "" : "s"} can redeem now.`,
      actionPath: "/customers",
      severity: "high",
    });
  }
  if (nearRewardCustomers > 0) {
    notifications.push({
      id: "near-reward",
      type: "near_reward",
      count: nearRewardCustomers,
      title: "Customers close to reward",
      description: `${nearRewardCustomers} customer${nearRewardCustomers === 1 ? " is" : "s are"} close to next tier.`,
      actionPath: "/insights",
      severity: "medium",
    });
  }
  if (inactiveCustomers > 0) {
    notifications.push({
      id: "inactive-customers",
      type: "inactive",
      count: inactiveCustomers,
      title: "Inactive customers over 30 days",
      description: `${inactiveCustomers} customer${inactiveCustomers === 1 ? "" : "s"} need re-engagement.`,
      actionPath: "/customers",
      severity: "high",
    });
  }

  return c.json({ notifications });
});

export default stats;
