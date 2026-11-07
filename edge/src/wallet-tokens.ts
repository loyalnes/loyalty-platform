import { camel, dec, now, uuid } from "./lib";
import type { Env } from "./lib";

export type WalletProvider = "APPLE_WALLET" | "GOOGLE_WALLET";

export type WalletPass = {
  id: string;
  loyaltyCardId: string;
  provider: WalletProvider;
  providerPassId: string | null;
  status: "ACTIVE" | "INACTIVE" | "REVOKED";
  lastSnapshotHash: string | null;
  lastIssuedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WalletToken = {
  id: string;
  walletPassId: string;
  token: string;
  active: boolean;
  createdAt: string;
  revokedAt: string | null;
};

/** `${prefix}_` plus 24 random bytes as base64url (same shape as the Express tokens). */
function randomToken(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${prefix}_${b64}`;
}

export async function getOrCreateWalletPass(env: Env, loyaltyCardId: string, provider: WalletProvider): Promise<WalletPass> {
  const ts = now();
  // The UNIQUE (loyalty_card_id, provider) index makes concurrent callers end with one row.
  const [, selected] = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO wallet_passes (id, loyalty_card_id, provider, status, created_at, updated_at)
       VALUES (?1, ?2, ?3, 'ACTIVE', ?4, ?4) ON CONFLICT (loyalty_card_id, provider) DO NOTHING`
    ).bind(uuid(), loyaltyCardId, provider, ts),
    env.DB.prepare("SELECT * FROM wallet_passes WHERE loyalty_card_id = ? AND provider = ?").bind(loyaltyCardId, provider),
  ]);
  return camel<WalletPass>(selected.results[0] as Record<string, unknown>, []);
}

async function getOrCreateToken(env: Env, table: "wallet_scan_tokens" | "wallet_access_tokens", prefix: string, walletPassId: string): Promise<WalletToken> {
  const ts = now();
  // Insert only when the pass has no live token, then read the newest live one, all in one batch.
  const [, selected] = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO ${table} (id, wallet_pass_id, token, active, created_at)
       SELECT ?1, ?2, ?3, 1, ?4
        WHERE NOT EXISTS (SELECT 1 FROM ${table} WHERE wallet_pass_id = ?2 AND active = 1 AND revoked_at IS NULL)`
    ).bind(uuid(), walletPassId, randomToken(prefix), ts),
    env.DB.prepare(
      `SELECT * FROM ${table} WHERE wallet_pass_id = ? AND active = 1 AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1`
    ).bind(walletPassId),
  ]);
  return camel<WalletToken>(selected.results[0] as Record<string, unknown>, ["active"]);
}

export function getOrCreateWalletScanToken(env: Env, walletPassId: string): Promise<WalletToken> {
  return getOrCreateToken(env, "wallet_scan_tokens", "ws", walletPassId);
}

export function getOrCreateWalletAccessToken(env: Env, walletPassId: string): Promise<WalletToken> {
  return getOrCreateToken(env, "wallet_access_tokens", "wa", walletPassId);
}

// Columns of each joined table, aliased with a prefix so one SELECT returns all of them.
const TOKEN_COLS = ["id", "wallet_pass_id", "token", "active", "created_at", "revoked_at"];
const PASS_COLS = ["id", "loyalty_card_id", "provider", "provider_pass_id", "status", "last_snapshot_hash", "last_issued_at", "created_at", "updated_at"];
const CARD_COLS = [
  "id", "card_number", "merchant_id", "customer_id", "card_template_id", "status", "points_balance", "total_earned",
  "total_redeemed", "issued_at", "expires_at", "gdpr_consent_at", "marketing_consent_at", "marketing_revoked_at",
  "enrollment_source", "created_at", "updated_at",
];
const CUSTOMER_COLS = [
  "id", "email", "first_name", "last_name", "phone", "date_of_birth", "avatar_url", "acquisition_source",
  "preferred_locale", "created_at", "updated_at",
];
// No password hash: only the columns the API may show.
const MERCHANT_COLS = ["id", "name", "email", "phone", "address", "city", "country", "plan", "settings", "preferred_locale", "active", "created_at", "updated_at"];
const TEMPLATE_COLS = [
  "id", "merchant_id", "name", "description", "tier", "points_per_currency", "redemption_rate", "min_redeem_points",
  "bonus_multiplier", "validity_days", "active", "created_at", "updated_at",
];

const select = (alias: string, cols: string[]) => cols.map((col) => `${alias}.${col} AS ${alias}__${col}`).join(", ");

function slice(row: Record<string, unknown>, alias: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key.startsWith(`${alias}__`)) out[key.slice(alias.length + 2)] = value;
  }
  return out;
}

export type ResolvedWalletToken = WalletToken & {
  walletPass: WalletPass & {
    loyaltyCard: Record<string, unknown> & {
      customer: Record<string, unknown>;
      merchant: Record<string, unknown>;
      cardTemplate: Record<string, unknown> | null;
    };
  };
};

async function resolveToken(env: Env, table: "wallet_scan_tokens" | "wallet_access_tokens", token: string): Promise<ResolvedWalletToken | null> {
  const row = await env.DB.prepare(
    `SELECT ${select("t", TOKEN_COLS)}, ${select("p", PASS_COLS)}, ${select("l", CARD_COLS)},
            ${select("c", CUSTOMER_COLS)}, ${select("m", MERCHANT_COLS)}, ${select("x", TEMPLATE_COLS)}
       FROM ${table} t
       JOIN wallet_passes p ON p.id = t.wallet_pass_id
       JOIN loyalty_cards l ON l.id = p.loyalty_card_id
       JOIN customers c ON c.id = l.customer_id
       JOIN merchants m ON m.id = l.merchant_id
       LEFT JOIN card_templates x ON x.id = l.card_template_id
      WHERE t.token = ?`
  )
    .bind(token)
    .first<Record<string, unknown>>();
  if (!row) return null;

  const merchant = camel(slice(row, "m")) as Record<string, unknown>;
  if (typeof merchant.settings === "string") {
    try {
      merchant.settings = JSON.parse(merchant.settings);
    } catch {
      /* keep the raw text */
    }
  }
  const tpl = slice(row, "x");
  const cardTemplate = tpl.id
    ? {
        ...camel(tpl),
        pointsPerCurrency: dec(tpl.points_per_currency),
        redemptionRate: dec(tpl.redemption_rate),
        bonusMultiplier: dec(tpl.bonus_multiplier),
      }
    : null;

  return {
    ...camel<WalletToken>(slice(row, "t"), ["active"]),
    walletPass: {
      ...camel<WalletPass>(slice(row, "p"), []),
      loyaltyCard: {
        ...camel(slice(row, "l"), []),
        customer: camel(slice(row, "c"), []),
        merchant,
        cardTemplate,
      },
    },
  } as ResolvedWalletToken;
}

export const resolveWalletScanToken = (env: Env, token: string) => resolveToken(env, "wallet_scan_tokens", token);
export const resolveWalletAccessToken = (env: Env, token: string) => resolveToken(env, "wallet_access_tokens", token);
