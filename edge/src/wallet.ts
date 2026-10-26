// /api/wallet. PUBLIC mount (as in Express); /config and /scan/resolve authenticate themselves with X-API-Key.

import { Hono } from "hono";
import { authenticateMerchant } from "./auth";
import { ApiError, body, requireUuid } from "./lib";
import type { AppEnv, Ctx } from "./lib";
import { clientIp, throttle } from "./ratelimit";
import { generateWalletWalletApplePass } from "./wallet-apple";
import { generateGoogleWalletPass } from "./wallet-google";
import type { WalletEnv } from "./wallet-google";
import { buildWalletSummary } from "./wallet-summary";
import { resolveWalletAccessToken, resolveWalletScanToken } from "./wallet-tokens";

const wallet = new Hono<AppEnv>();

// getOrCreateToken generates 24 random bytes as base64url (32 chars) after a "ws_" / "wa_" prefix.
const SCAN_TOKEN = /^ws_[A-Za-z0-9_-]{32}$/;
const ACCESS_TOKEN = /^wa_[A-Za-z0-9_-]{32}$/;

const env = (c: Ctx) => c.env as WalletEnv;

/** Same budget as Express' generalRateLimiter: 100 requests per minute per IP, for every public wallet route. */
const publicLimit = (c: Ctx) => throttle(c, `wallet:${clientIp(c)}`, 100, 60_000);

async function liveAccessToken(c: Ctx, value: string) {
  const token = ACCESS_TOKEN.test(value) ? await resolveWalletAccessToken(c.env, value) : null;
  if (!token || !token.active || token.revokedAt) throw new ApiError(404, "Wallet access not found");
  return token;
}

// GET /api/wallet/config (X-API-Key)
wallet.get("/config", authenticateMerchant, (c) => {
  const e = env(c);
  return c.json({
    appleWallet: { configured: !!e.WALLETWALLET_API_KEY },
    googleWallet: {
      configured: !!(e.GOOGLE_WALLET_ISSUER_ID && e.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL && e.GOOGLE_WALLET_SERVICE_ACCOUNT_KEY),
    },
  });
});

// POST /api/wallet/scan/resolve { barcodeToken } (X-API-Key)
wallet.post("/scan/resolve", authenticateMerchant, async (c) => {
  const merchantId = c.get("merchantId");
  await throttle(c, `wallet-scan:${merchantId}`, 300, 60_000);
  const { barcodeToken } = await body(c);
  if (!barcodeToken || typeof barcodeToken !== "string") throw new ApiError(400, "barcodeToken is required");

  const scanToken = SCAN_TOKEN.test(barcodeToken) ? await resolveWalletScanToken(c.env, barcodeToken) : null;
  if (!scanToken || !scanToken.active || scanToken.revokedAt) throw new ApiError(404, "Wallet pass not found");

  const loyaltyCard = scanToken.walletPass.loyaltyCard;
  if (loyaltyCard.merchantId !== merchantId) throw new ApiError(403, "Unauthorized");

  const summary = await buildWalletSummary(c.env, loyaltyCard.id as string, scanToken.walletPass.provider);
  if (!summary) throw new ApiError(404, "Wallet summary not found");
  return c.json(summary);
});

// POST /api/wallet/access/:token/marketing-consent { accept } (PUBLIC, the customer acts on their own card)
wallet.post("/access/:token/marketing-consent", async (c) => {
  await publicLimit(c);
  const { accept } = await body(c);
  if (typeof accept !== "boolean") throw new ApiError(400, "accept must be boolean");

  const accessToken = await liveAccessToken(c, c.req.param("token"));
  const cardId = accessToken.walletPass.loyaltyCardId;
  const ts = new Date().toISOString();

  const stmt = accept
    ? c.env.DB.prepare("UPDATE loyalty_cards SET marketing_consent_at = ?1, marketing_revoked_at = NULL, updated_at = ?1 WHERE id = ?2")
    : c.env.DB.prepare("UPDATE loyalty_cards SET marketing_revoked_at = ?1, updated_at = ?1 WHERE id = ?2");
  await stmt.bind(ts, cardId).run();

  return c.json({ success: true, marketingOptedIn: accept });
});

// GET /api/wallet/access/:token (PUBLIC)
wallet.get("/access/:token", async (c) => {
  await publicLimit(c);
  const accessToken = await liveAccessToken(c, c.req.param("token"));
  const summary = await buildWalletSummary(c.env, accessToken.walletPass.loyaltyCardId, accessToken.walletPass.provider);
  if (!summary) throw new ApiError(404, "Wallet summary not found");
  return c.json(summary);
});

/** Pass generation errors: ApiErrors keep their status, anything else is a 500 with the Express message. */
function passFailure(c: Ctx, err: unknown, what: string) {
  if (err instanceof ApiError) return c.json({ error: err.message }, err.status);
  console.error(`${what} generation error:`, err instanceof Error ? err.message : err);
  return c.json({ error: err instanceof Error ? `Failed to generate ${what}: ${err.message}` : `Failed to generate ${what}` }, 500);
}

// GET /api/wallet/access/:token/apple-pass (PUBLIC) → .pkpass
wallet.get("/access/:token/apple-pass", async (c) => {
  await publicLimit(c);
  try {
    const accessToken = await liveAccessToken(c, c.req.param("token"));
    const summary = await buildWalletSummary(c.env, accessToken.walletPass.loyaltyCardId, "APPLE_WALLET");
    if (!summary) throw new ApiError(404, "Wallet summary not found");

    const pkpass = await generateWalletWalletApplePass(env(c), summary);
    const safeMerchant = summary.merchantName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "loyalty-card";
    return c.body(pkpass, 200, {
      "Content-Type": "application/vnd.apple.pkpass",
      "Content-Disposition": `attachment; filename="${safeMerchant}.pkpass"`,
    });
  } catch (err) {
    return passFailure(c, err, "Apple Wallet pass");
  }
});

// GET /api/wallet/access/:token/google-pass (PUBLIC) → { saveUrl }
wallet.get("/access/:token/google-pass", async (c) => {
  await publicLimit(c);
  try {
    const accessToken = await liveAccessToken(c, c.req.param("token"));
    const summary = await buildWalletSummary(c.env, accessToken.walletPass.loyaltyCardId, "GOOGLE_WALLET");
    if (!summary) throw new ApiError(404, "Wallet summary not found");
    return c.json({ saveUrl: await generateGoogleWalletPass(env(c), summary) });
  } catch (err) {
    return passFailure(c, err, "Google Wallet pass");
  }
});

type PrizeWinRow = {
  id: string;
  redemption_code: string;
  status: string;
  won_at: string;
  expires_at: string;
  redeemed_at: string | null;
  prize_name: string;
  prize_description: string | null;
  prize_type: string;
  customer_id: string;
  first_name: string;
  last_name: string | null;
  merchant_id: string;
  merchant_name: string;
  card_id: string | null;
  card_number: string | null;
};

async function loadPrizeWin(c: Ctx): Promise<PrizeWinRow> {
  await publicLimit(c);
  const id = requireUuid(c.req.param("prizeWinId") ?? "", "prize win ID");
  const row = await c.env.DB.prepare(
    `SELECT w.id, w.redemption_code, w.status, w.won_at, w.expires_at, w.redeemed_at,
            p.name AS prize_name, p.description AS prize_description, p.prize_type,
            cu.id AS customer_id, cu.first_name, cu.last_name,
            g.merchant_id, m.name AS merchant_name,
            l.id AS card_id, l.card_number
       FROM prize_wins w
       JOIN prizes p ON p.id = w.prize_id
       JOIN customers cu ON cu.id = w.customer_id
       JOIN gamification_campaigns g ON g.id = w.campaign_id
       JOIN merchants m ON m.id = g.merchant_id
       LEFT JOIN loyalty_cards l ON l.id = w.loyalty_card_id
      WHERE w.id = ?`
  )
    .bind(id)
    .first<PrizeWinRow>();
  if (!row) throw new ApiError(404, "Prize not found");
  return row;
}

const isoDay = (iso: string) => new Date(iso).toISOString().split("T")[0];
const customerName = (w: PrizeWinRow) => `${w.first_name} ${w.last_name ?? ""}`;

// GET /api/wallet/apple/:prizeWinId (PUBLIC) placeholder JSON, as in Express
wallet.get("/apple/:prizeWinId", async (c) => {
  const w = await loadPrizeWin(c);
  const passData = {
    formatVersion: 1,
    passTypeIdentifier: "pass.com.loyali.prize",
    serialNumber: w.id,
    teamIdentifier: "TEAM_ID",
    organizationName: w.merchant_name,
    description: `${w.prize_name} - ${w.merchant_name}`,
    logoText: w.merchant_name,
    foregroundColor: "rgb(255, 255, 255)",
    backgroundColor: "rgb(79, 70, 229)",
    labelColor: "rgb(255, 255, 255)",
    barcode: { message: w.redemption_code, format: "PKBarcodeFormatQR", messageEncoding: "iso-8859-1" },
    storeCard: {
      headerFields: [{ key: "expires", label: "EXPIRES", value: isoDay(w.expires_at) }],
      primaryFields: [{ key: "prize", label: "PRIZE", value: w.prize_name }],
      secondaryFields: [{ key: "merchant", label: "MERCHANT", value: w.merchant_name }],
      auxiliaryFields: [{ key: "customer", label: "CUSTOMER", value: customerName(w) }],
      backFields: [
        { key: "redemption", label: "REDEMPTION CODE", value: w.redemption_code },
        { key: "instructions", label: "HOW TO REDEEM", value: `Show this code at ${w.merchant_name} to redeem your prize.` },
      ],
    },
    expirationDate: new Date(w.expires_at).toISOString(),
    relevantDate: new Date(w.won_at).toISOString(),
  };
  return c.json({
    message: "Apple Wallet integration requires Apple Developer certificates",
    passData,
    todo: "Implement PKPass generation with passkit-generator library",
  });
});

// GET /api/wallet/google/:prizeWinId (PUBLIC) placeholder JSON, as in Express
wallet.get("/google/:prizeWinId", async (c) => {
  const w = await loadPrizeWin(c);
  const walletObject = {
    id: `${w.merchant_id}.${w.id}`,
    classId: `${w.merchant_id}.loyalty`,
    state: "ACTIVE",
    barcode: { type: "QR_CODE", value: w.redemption_code },
    accountName: customerName(w),
    accountId: w.customer_id,
    loyaltyPoints: { label: "Prize", balance: { string: w.prize_name } },
    validTimeInterval: { start: { date: isoDay(w.won_at) }, end: { date: isoDay(w.expires_at) } },
  };
  return c.json({
    message: "Google Wallet integration requires Google Cloud service account",
    walletObject,
    todo: "Implement JWT signing and Google Wallet save link generation",
    saveUrl: `https://pay.google.com/gp/v/save/${encodeURIComponent(JSON.stringify(walletObject))}`,
  });
});

// GET /api/wallet/preview/:prizeWinId (PUBLIC)
wallet.get("/preview/:prizeWinId", async (c) => {
  const w = await loadPrizeWin(c);
  return c.json({
    id: w.id,
    prizeName: w.prize_name,
    prizeDescription: w.prize_description,
    prizeType: w.prize_type,
    merchantName: w.merchant_name,
    redemptionCode: w.redemption_code,
    status: w.status,
    wonAt: w.won_at,
    expiresAt: w.expires_at,
    redeemedAt: w.redeemed_at,
    loyaltyCard: { id: w.card_id ?? undefined, cardNumber: w.card_number ?? undefined },
  });
});

export default wallet;
