// /api/feedback (PUBLIC): the review flow behind /app/review/:merchantId.

import { Hono } from "hono";
import { ApiError, body, now, requireUuid, uuid } from "./lib";
import type { AppEnv, Ctx } from "./lib";
import { clientIp, throttle } from "./ratelimit";

const feedback = new Hono<AppEnv>();

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** feedbackRateLimiter: 10 submissions per minute per IP, shared by both POST routes. */
async function feedbackLimit(c: Ctx): Promise<Response | null> {
  try {
    await throttle(c, `feedback:${clientIp(c)}`, 10, 60_000);
    return null;
  } catch (err) {
    if (err instanceof ApiError && err.status === 429) {
      return c.json({ error: "Too many feedback submissions, please slow down.", retryAfter: "1 minute" }, 429);
    }
    throw err;
  }
}

const isRating = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5;

function parseSettings(raw: unknown): Record<string, unknown> {
  try {
    const parsed = typeof raw === "string" && raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

// GET /api/feedback/:merchantId/config
feedback.get("/:merchantId/config", async (c) => {
  const merchantId = requireUuid(c.req.param("merchantId"), "merchant ID");
  const merchant = await c.env.DB.prepare("SELECT id, name, settings, preferred_locale FROM merchants WHERE id = ?")
    .bind(merchantId)
    .first<{ id: string; name: string; settings: string; preferred_locale: string }>();
  if (!merchant) throw new ApiError(404, "Merchant not found");

  const settings = parseSettings(merchant.settings);
  return c.json({
    merchantId: merchant.id,
    merchantName: merchant.name,
    googleMapsUrl: (settings.googleMapsUrl as string) || null,
    googlePlaceId: (settings.googlePlaceId as string) || null,
    reviewFlowEnabled: settings.reviewFlowEnabled !== false,
    locale: merchant.preferred_locale,
  });
});

// POST /api/feedback/:merchantId — detailed feedback (1-5 stars)
feedback.post("/:merchantId", async (c) => {
  const limited = await feedbackLimit(c);
  if (limited) return limited;

  const merchantId = requireUuid(c.req.param("merchantId"), "merchant ID");
  const { rating, foodRating, serviceRating, atmosphereRating, text, email, firstName, lastName } = await body(c);

  if (!isRating(rating)) throw new ApiError(400, "Rating must be between 1 and 5");
  if (email && (typeof email !== "string" || !EMAIL.test(email))) throw new ApiError(400, "Invalid email format");
  for (const r of [foodRating, serviceRating, atmosphereRating]) {
    if (r !== undefined && r !== null && !isRating(r)) throw new ApiError(400, "Detailed ratings must be between 1 and 5");
  }

  const merchant = await c.env.DB.prepare("SELECT id, preferred_locale FROM merchants WHERE id = ?")
    .bind(merchantId)
    .first<{ id: string; preferred_locale: string }>();
  if (!merchant) throw new ApiError(404, "Merchant not found");

  const id = uuid();
  const ts = now();
  const db = c.env.DB;
  const statements: D1PreparedStatement[] = [];
  let cleanEmail: string | null = null;

  // An email plus a first name links (or creates) the customer; an existing customer is left untouched.
  if (typeof email === "string" && email && typeof firstName === "string" && firstName.trim()) {
    cleanEmail = email.trim().toLowerCase();
    statements.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO customers (id, email, first_name, last_name, preferred_locale, acquisition_source, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'review_flow', ?, ?)`
        )
        .bind(uuid(), cleanEmail, firstName.trim(), typeof lastName === "string" && lastName.trim() ? lastName.trim() : null, merchant.preferred_locale, ts, ts)
    );
  }

  statements.push(
    db
      .prepare(
        `INSERT INTO merchant_feedback
           (id, merchant_id, customer_id, rating, text, food_rating, service_rating, atmosphere_rating, source, created_at, updated_at)
         VALUES (?, ?, (SELECT id FROM customers WHERE email = ?), ?, ?, ?, ?, ?, 'DIRECT', ?, ?)`
      )
      .bind(
        id,
        merchantId,
        cleanEmail,
        rating,
        (typeof text === "string" && text.trim()) || "No additional comments",
        foodRating ?? null,
        serviceRating ?? null,
        atmosphereRating ?? null,
        ts,
        ts
      )
  );
  await db.batch(statements);

  return c.json({ success: true, feedbackId: id });
});

// POST /api/feedback/:merchantId/google-redirect — tracks the 5-star redirect to Google Maps
feedback.post("/:merchantId/google-redirect", async (c) => {
  const limited = await feedbackLimit(c);
  if (limited) return limited;

  const merchantId = requireUuid(c.req.param("merchantId"), "merchant ID");
  const { email } = await body(c);

  const merchant = await c.env.DB.prepare("SELECT id, settings FROM merchants WHERE id = ?").bind(merchantId).first<{ id: string; settings: string }>();
  if (!merchant) throw new ApiError(404, "Merchant not found");

  const settings = parseSettings(merchant.settings);
  const placeId = typeof settings.googlePlaceId === "string" && settings.googlePlaceId ? settings.googlePlaceId : null;
  // The merchant-set URL is sent to the browser as a navigation target: http(s) only.
  let mapsUrl: string | null = null;
  if (typeof settings.googleMapsUrl === "string" && settings.googleMapsUrl) {
    try {
      const u = new URL(settings.googleMapsUrl);
      if (u.protocol === "https:" || u.protocol === "http:") mapsUrl = settings.googleMapsUrl;
    } catch {
      /* not a URL */
    }
  }
  if (!placeId && !mapsUrl) return c.json({ error: "Google Maps configuration missing", fallback: true }, 400);

  const redirectUrl = placeId ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}` : (mapsUrl as string);

  const ts = now();
  await c.env.DB.prepare(
    `INSERT INTO merchant_feedback (id, merchant_id, customer_id, rating, text, source, created_at, updated_at)
     VALUES (?, ?, (SELECT id FROM customers WHERE email = ?), 5, 'Redirected to Google Maps for review', 'GOOGLE_MAPS', ?, ?)`
  )
    .bind(uuid(), merchantId, typeof email === "string" && email ? email.trim().toLowerCase() : null, ts, ts)
    .run();

  return c.json({ success: true, redirectUrl });
});

export default feedback;
