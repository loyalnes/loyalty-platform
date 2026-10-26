// Google Wallet save-link generation (port of services/wallet/providers/googleWallet.ts), Web Crypto only.
// Every key is optional: a missing one makes generateGoogleWalletPass throw the Express "incomplete" error.

import type { Env } from "./lib";
import { now, sha256Hex } from "./lib";
import type { WalletSummary } from "./wallet-summary";

export type WalletEnv = Env & {
  WALLETWALLET_API_KEY?: string;
  WALLETWALLET_COLOR_PRESET?: string;
  WALLETWALLET_LOGO_URL?: string;
  WALLETWALLET_THUMBNAIL_URL?: string;
  WALLETWALLET_STRIP_URL?: string;
  GOOGLE_WALLET_ISSUER_ID?: string;
  GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_WALLET_SERVICE_ACCOUNT_KEY?: string;
  PUBLIC_URL?: string;
};

export function compactSummary(summary: WalletSummary): string {
  const parts = [summary.pointsBalanceDisplay];
  if (summary.tierName) parts.push(summary.tierName);
  if (summary.activePrizeCount > 0) parts.push(`${summary.activePrizeCount} rewards`);
  if (summary.nearestPrizeExpiration) parts.push(`exp ${new Date(summary.nearestPrizeExpiration).toISOString().slice(0, 10)}`);
  return parts.join(" · ");
}

/** Records that a pass was issued for this snapshot (same fields Express updated). */
export async function markPassIssued(env: Env, summary: WalletSummary): Promise<void> {
  const hash = await sha256Hex(
    JSON.stringify({
      pointsBalance: summary.pointsBalance,
      tierName: summary.tierName,
      activePrizeCount: summary.activePrizeCount,
      activePrizes: summary.activePrizes.map((prize) => ({ id: prize.id, expiresAt: prize.expiresAt })),
    })
  );
  const ts = now();
  await env.DB.prepare(
    "UPDATE wallet_passes SET last_snapshot_hash = ?1, last_issued_at = ?2, status = 'ACTIVE', updated_at = ?2 WHERE id = ?3"
  )
    .bind(hash, ts, summary.walletPassId)
    .run();
}

const b64url = (bytes: Uint8Array): string => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const textB64url = (text: string) => b64url(new TextEncoder().encode(text));

function derLength(len: number): number[] {
  if (len < 128) return [len];
  if (len < 256) return [0x81, len];
  return [0x82, len >> 8, len & 0xff];
}

/** Wraps a PKCS#1 RSA key in a PKCS#8 envelope (Node accepted both PEM flavours; Web Crypto wants PKCS#8). */
function pkcs1ToPkcs8(pkcs1: Uint8Array): Uint8Array {
  const algorithm = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];
  const octet = [0x04, ...derLength(pkcs1.length)];
  const inner = [0x02, 0x01, 0x00, ...algorithm, ...octet];
  const total = inner.length + pkcs1.length;
  return new Uint8Array([0x30, ...derLength(total), ...inner, ...pkcs1]);
}

const keyCache = new Map<string, Promise<CryptoKey>>();

function importSigningKey(pem: string): Promise<CryptoKey> {
  // Env files and secrets usually hold the PEM with literal `\n` instead of real newlines.
  const normalized = pem.replace(/\\n/g, "\n");
  let cached = keyCache.get(normalized);
  if (!cached) {
    cached = (async () => {
      const match = normalized.match(/-----BEGIN ((?:RSA )?PRIVATE KEY)-----([\s\S]+?)-----END (?:RSA )?PRIVATE KEY-----/);
      if (!match) throw new Error("Private key is not a PEM");
      const raw = Uint8Array.from(atob(match[2].replace(/\s+/g, "")), (ch) => ch.charCodeAt(0));
      const der = match[1] === "RSA PRIVATE KEY" ? pkcs1ToPkcs8(raw) : raw;
      return crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
    })();
    keyCache.set(normalized, cached);
    cached.catch(() => keyCache.delete(normalized));
  }
  return cached;
}

/** Google Wallet save URL for the loyalty object behind this summary. */
export async function generateGoogleWalletPass(env: WalletEnv, summary: WalletSummary): Promise<string> {
  const serviceAccountEmail = env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL;
  const serviceAccountKey = env.GOOGLE_WALLET_SERVICE_ACCOUNT_KEY;
  const issuerId = env.GOOGLE_WALLET_ISSUER_ID;

  if (!serviceAccountEmail || !serviceAccountKey || !issuerId) {
    const missing = [];
    if (!serviceAccountEmail) missing.push("GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL");
    if (!serviceAccountKey) missing.push("GOOGLE_WALLET_SERVICE_ACCOUNT_KEY");
    if (!issuerId) missing.push("GOOGLE_WALLET_ISSUER_ID");
    throw new Error(`Google Wallet configuration incomplete. Missing: ${missing.join(", ")}`);
  }

  const loyaltyObject = {
    id: `${issuerId}.${summary.walletPassId}`,
    classId: `${issuerId}.loyalty-card-class`,
    state: "ACTIVE",
    barcode: { type: "QR_CODE", value: summary.merchantScanToken },
    accountName: summary.customerName,
    accountId: summary.loyaltyCardId,
    loyaltyPoints: { label: summary.tierName || "Points", balance: { int: summary.pointsBalance } },
    textModulesData: [
      { header: "Card Number", body: summary.cardNumber },
      { header: "Status", body: compactSummary(summary) },
    ],
    linksModuleData: {
      uris: [
        {
          uri: `${env.PUBLIC_URL || "https://loyali.online"}/app/loyalty/${summary.customerAccessToken}`,
          description: "View Loyalty Details",
        },
      ],
    },
  };
  const claims = {
    iss: serviceAccountEmail,
    aud: "google",
    origins: [],
    typ: "savetowallet",
    payload: { loyaltyObjects: [loyaltyObject] },
  };

  const header = textB64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = textB64url(JSON.stringify(claims));

  let signature: string;
  try {
    const key = await importSigningKey(serviceAccountKey);
    const signed = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${payload}`));
    signature = b64url(new Uint8Array(signed));
  } catch (err) {
    console.error("Google Wallet JWT signing error:", err instanceof Error ? err.message : err);
    throw new Error(`Failed to sign JWT: ${err instanceof Error ? err.message : "Unknown error"}`);
  }

  await markPassIssued(env, summary);
  return `https://pay.google.com/gp/v/save/${header}.${payload}.${signature}`;
}
