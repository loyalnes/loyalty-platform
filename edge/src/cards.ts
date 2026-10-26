import { Hono } from "hono";
import { ApiError, MERCHANT_SAFE_COLUMNS, body, camel, dec, newCardNumber, now, paging, requireUuid, uuid } from "./lib";
import type { AppEnv, Ctx } from "./lib";

const cards = new Hono<AppEnv>();

const STATUSES = ["ACTIVE", "SUSPENDED", "CANCELLED"];

function template(row: Record<string, unknown> | null) {
  if (!row) return null;
  return {
    ...camel(row),
    pointsPerCurrency: dec(row.points_per_currency),
    redemptionRate: dec(row.redemption_rate),
    bonusMultiplier: dec(row.bonus_multiplier),
  };
}

/** A card with its customer and card template, the shape Prisma returned with include. */
async function loadCard(c: Ctx, cardId: string, withMerchant = false) {
  const card = await c.env.DB.prepare("SELECT * FROM loyalty_cards WHERE id = ?").bind(cardId).first<Record<string, unknown>>();
  if (!card || card.merchant_id !== c.get("merchantId")) throw new ApiError(404, "Card not found");

  const [customer, tpl, merchant] = await Promise.all([
    c.env.DB.prepare("SELECT * FROM customers WHERE id = ?").bind(card.customer_id).first<Record<string, unknown>>(),
    card.card_template_id
      ? c.env.DB.prepare("SELECT * FROM card_templates WHERE id = ?").bind(card.card_template_id).first<Record<string, unknown>>()
      : null,
    withMerchant
      ? c.env.DB.prepare(`SELECT ${MERCHANT_SAFE_COLUMNS} FROM merchants WHERE id = ?`).bind(card.merchant_id).first<Record<string, unknown>>()
      : null,
  ]);
  return {
    ...camel(card),
    customer: customer ? camel(customer) : null,
    cardTemplate: template(tpl),
    ...(withMerchant ? { merchant: merchant ? camel(merchant) : null } : {}),
  };
}

// POST /api/cards — issue a card to an existing customer
cards.post("/", async (c) => {
  const merchantId = c.get("merchantId");
  const { customerId, cardTemplateId } = await body(c);
  if (typeof customerId !== "string" || !customerId) throw new ApiError(400, "customerId is required");

  const customer = await c.env.DB.prepare("SELECT id FROM customers WHERE id = ?").bind(customerId).first();
  if (!customer) throw new ApiError(404, "Customer not found");

  const existing = await c.env.DB.prepare("SELECT id FROM loyalty_cards WHERE merchant_id = ? AND customer_id = ?")
    .bind(merchantId, customerId)
    .first();
  if (existing) throw new ApiError(409, "Customer already has a card with this merchant");

  if (typeof cardTemplateId === "string" && cardTemplateId) {
    const tpl = await c.env.DB.prepare("SELECT merchant_id FROM card_templates WHERE id = ?")
      .bind(cardTemplateId)
      .first<{ merchant_id: string }>();
    if (!tpl || tpl.merchant_id !== merchantId) throw new ApiError(400, "Invalid card template");
  }

  const id = uuid();
  const ts = now();
  await c.env.DB.prepare(
    `INSERT INTO loyalty_cards (id, card_number, merchant_id, customer_id, card_template_id, issued_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, newCardNumber(), merchantId, customerId, typeof cardTemplateId === "string" && cardTemplateId ? cardTemplateId : null, ts, ts, ts)
    .run();
  return c.json(await loadCard(c, id), 201);
});

// GET /api/cards?page=&limit=&status=
cards.get("/", async (c) => {
  const merchantId = c.get("merchantId");
  const { page, limit, offset } = paging(c);
  const status = c.req.query("status");

  const where = status ? "merchant_id = ? AND status = ?" : "merchant_id = ?";
  const binds = status ? [merchantId, status] : [merchantId];
  const [rows, count] = await c.env.DB.batch([
    c.env.DB.prepare(`SELECT id FROM loyalty_cards WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).bind(...binds, limit, offset),
    c.env.DB.prepare(`SELECT COUNT(*) AS total FROM loyalty_cards WHERE ${where}`).bind(...binds),
  ]);
  const data = await Promise.all((rows.results as { id: string }[]).map((r) => loadCard(c, r.id)));
  return c.json({ data, total: (count.results[0] as { total: number }).total, page, limit });
});

cards.get("/:id", async (c) => c.json(await loadCard(c, requireUuid(c.req.param("id"), "id"), true)));

// PATCH /api/cards/:id { status }
cards.patch("/:id", async (c) => {
  const id = requireUuid(c.req.param("id"), "id");
  const { status } = await body(c);
  if (typeof status !== "string" || !STATUSES.includes(status)) {
    throw new ApiError(400, `status must be one of: ${STATUSES.join(", ")}`);
  }
  await loadCard(c, id); // 404 unless it is this merchant's card
  await c.env.DB.prepare("UPDATE loyalty_cards SET status = ?, updated_at = ? WHERE id = ?").bind(status, now(), id).run();
  return c.json(await loadCard(c, id));
});

export default cards;
