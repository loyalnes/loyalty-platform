import { ApiError, now, uuid } from "./lib";
import type { Env } from "./lib";
import { getOrCreateWalletAccessToken, getOrCreateWalletPass } from "./wallet-tokens";
import { applyWelcomeBonus } from "./welcome-bonus";

export interface EnrollInput {
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string;
  marketingConsent?: boolean; // honoured only for SELF_JOIN
}

export interface EnrollResult {
  customer: { id: string; firstName: string; lastName: string | null; email: string };
  card: { id: string; cardNumber: string };
  alreadyEnrolled: boolean;
  isNewCustomer: boolean;
  accessToken: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates the fields of the join / manual-add forms. Express only checked that firstName and
 * email are strings; here every field is also bounded, because the join form is open to anyone.
 */
export function parseEnrollInput(raw: Record<string, unknown>, withConsent: boolean): EnrollInput {
  const { firstName, lastName, email, phone, marketingConsent } = raw;
  if (typeof firstName !== "string" || typeof email !== "string") {
    throw new ApiError(400, "firstName and email are required strings");
  }
  if (!firstName.trim() || firstName.trim().length > 100) throw new ApiError(400, "firstName must be 1-100 characters");
  if (typeof lastName === "string" && lastName.trim().length > 100) throw new ApiError(400, "lastName must be at most 100 characters");
  const mail = email.trim();
  if (mail.length > 254 || !EMAIL.test(mail)) throw new ApiError(400, "email is not a valid email address");
  if (typeof phone === "string" && phone.trim().length > 30) throw new ApiError(400, "phone must be at most 30 characters");

  return {
    firstName,
    lastName: typeof lastName === "string" ? lastName : undefined,
    email,
    phone: typeof phone === "string" ? phone : undefined,
    marketingConsent: withConsent ? (marketingConsent === true ? true : marketingConsent === false ? false : undefined) : undefined,
  };
}

/**
 * Single source of truth for customer enrolment. Both the public
 * /loyalty/:merchantId/join (SELF_JOIN — customer fills the form) and the
 * dashboard /customers/manual-add (MERCHANT_MANUAL — merchant fills it for
 * them) go through here so welcome bonus crediting, consent semantics
 * and wallet pass / token generation never drift between the two paths.
 *
 * GDPR notes per source:
 *   SELF_JOIN — customer's own affirmative action submits the form, so we
 *     stamp gdprConsentAt and honour marketingConsent (Art. 6(1)(b) + Art. 7).
 *   MERCHANT_MANUAL — the merchant inserts the customer; the customer hasn't
 *     done anything yet, so neither consent is recorded (Art. 6(1)(f)).
 */
export async function enrollCustomer(
  env: Env,
  merchantId: string,
  input: EnrollInput,
  source: "SELF_JOIN" | "MERCHANT_MANUAL"
): Promise<EnrollResult> {
  const merchant = await env.DB.prepare("SELECT id, active FROM merchants WHERE id = ?")
    .bind(merchantId)
    .first<{ id: string; active: number }>();
  if (!merchant || (source === "SELF_JOIN" && !merchant.active)) throw new ApiError(404, "Merchant not found");

  const program = await env.DB.prepare("SELECT active FROM loyalty_programs WHERE merchant_id = ?")
    .bind(merchantId)
    .first<{ active: number }>();
  if (!program || !program.active) {
    throw new ApiError(400, source === "SELF_JOIN" ? "This merchant has no active loyalty program" : "No active loyalty program");
  }

  const email = input.email.trim().toLowerCase();
  const ts = now();
  const self = source === "SELF_JOIN";
  const marketing = self && input.marketingConsent !== undefined ? (input.marketingConsent ? 1 : 0) : null;
  const cardNumber = `LC-${uuid().replace(/-/g, "").slice(0, 16).toUpperCase()}`;

  // One batch = one transaction. Both inserts are ON CONFLICT DO NOTHING, so two simultaneous
  // requests for the same customer and merchant end with one customer and one card, and
  // meta.changes tells each request whether IT created the row.
  const [newCustomer, newCard, , customerRow, cardRow] = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO customers (id, email, first_name, last_name, phone, acquisition_source, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7) ON CONFLICT (email) DO NOTHING`
    ).bind(
      uuid(),
      email,
      input.firstName.trim(),
      input.lastName ? input.lastName.trim() : "",
      input.phone ? input.phone.trim() : null,
      self ? "qr_join" : "merchant_manual",
      ts
    ),
    env.DB.prepare(
      `INSERT INTO loyalty_cards (id, card_number, merchant_id, customer_id, enrollment_source, gdpr_consent_at,
                                  marketing_consent_at, issued_at, created_at, updated_at)
       SELECT ?1, ?2, ?3, id, ?4, ?5, ?6, ?7, ?7, ?7 FROM customers WHERE email = ?8
       ON CONFLICT (merchant_id, customer_id) DO NOTHING`
    ).bind(
      uuid(),
      cardNumber,
      merchantId,
      source,
      self ? ts : null,
      self && input.marketingConsent === true ? ts : null,
      ts,
      email
    ),
    // Consent on a card that already existed (SELF_JOIN only): stamp the GDPR consent once, record a
    // first marketing opt-in, or revoke an active one. A no-op for a card created just above.
    env.DB.prepare(
      `UPDATE loyalty_cards
          SET gdpr_consent_at = COALESCE(gdpr_consent_at, ?1),
              marketing_consent_at = CASE WHEN ?2 = 1 AND marketing_consent_at IS NULL THEN ?1 ELSE marketing_consent_at END,
              marketing_revoked_at = CASE
                WHEN ?2 = 1 AND marketing_consent_at IS NULL THEN NULL
                WHEN ?2 = 0 AND marketing_consent_at IS NOT NULL AND marketing_revoked_at IS NULL THEN ?1
                ELSE marketing_revoked_at END,
              updated_at = ?1
        WHERE merchant_id = ?3 AND customer_id = (SELECT id FROM customers WHERE email = ?4) AND ?5 = 1
          AND (gdpr_consent_at IS NULL
               OR (?2 = 1 AND marketing_consent_at IS NULL)
               OR (?2 = 0 AND marketing_consent_at IS NOT NULL AND marketing_revoked_at IS NULL))`
    ).bind(ts, marketing, merchantId, email, self ? 1 : 0),
    env.DB.prepare("SELECT id, first_name, last_name, email FROM customers WHERE email = ?").bind(email),
    env.DB.prepare(
      `SELECT l.id, l.card_number FROM loyalty_cards l JOIN customers c ON c.id = l.customer_id
        WHERE l.merchant_id = ? AND c.email = ?`
    ).bind(merchantId, email),
  ]);

  const customer = customerRow.results[0] as { id: string; first_name: string; last_name: string | null; email: string };
  const card = cardRow.results[0] as { id: string; card_number: string };
  const isNewCustomer = newCustomer.meta.changes > 0;
  const alreadyEnrolled = newCard.meta.changes === 0;

  // Welcome bonus: only for the request that created the card. Best-effort — a transient DB error
  // must not undo the enrolment.
  if (!alreadyEnrolled) {
    await applyWelcomeBonus(env, { merchantId, loyaltyCardId: card.id }).catch((err) => {
      console.error("Failed to apply welcome bonus:", err);
    });
  }

  // Wallet pass / token generation is idempotent.
  const [applePass] = await Promise.all([
    getOrCreateWalletPass(env, card.id, "APPLE_WALLET"),
    getOrCreateWalletPass(env, card.id, "GOOGLE_WALLET"),
  ]);
  const accessToken = await getOrCreateWalletAccessToken(env, applePass.id);

  return {
    customer: { id: customer.id, firstName: customer.first_name, lastName: customer.last_name, email: customer.email },
    card: { id: card.id, cardNumber: card.card_number },
    alreadyEnrolled,
    isNewCustomer,
    accessToken: accessToken.token,
  };
}
