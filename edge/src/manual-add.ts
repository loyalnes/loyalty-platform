import { Hono } from "hono";
import { enrollCustomer, parseEnrollInput } from "./enrollment";
import { ApiError, body } from "./lib";
import type { AppEnv } from "./lib";
import { sendWalletLinkEmail } from "./mailer";

// AUTHENTICATED (X-API-Key). Mount at /api/customers BEFORE the customers sub-app; only POST /manual-add.
const manualAdd = new Hono<AppEnv>();

// POST /api/customers/manual-add — Merchant manually enrolls a customer + emails wallet link
manualAdd.post("/manual-add", async (c) => {
  const merchantId = c.get("merchantId");
  const input = parseEnrollInput(await body(c), false);

  const merchant = await c.env.DB.prepare("SELECT name, email FROM merchants WHERE id = ?")
    .bind(merchantId)
    .first<{ name: string; email: string }>();
  if (!merchant) throw new ApiError(404, "Merchant not found");

  const result = await enrollCustomer(c.env, merchantId, input, "MERCHANT_MANUAL");

  const origin = (c.env as { PUBLIC_URL?: string }).PUBLIC_URL || new URL(c.req.url).origin;
  const loyaltyUrl = `${origin}/app/loyalty/${result.accessToken}`;

  const emailSent = await sendWalletLinkEmail(c.env, {
    to: result.customer.email,
    merchantName: merchant.name,
    merchantEmail: merchant.email,
    customerFirstName: result.customer.firstName,
    loyaltyUrl,
  });

  return c.json(
    { alreadyEnrolled: result.alreadyEnrolled, loyaltyUrl, emailSent, customer: result.customer },
    result.alreadyEnrolled ? 200 : 201
  );
});

export default manualAdd;
