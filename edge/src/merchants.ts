import { Hono } from "hono";
import { authenticateMerchant } from "./auth";
import { ApiError, MERCHANT_SAFE_COLUMNS, body, camel, newApiKey, now, requireUuid, sha256Hex, uuid } from "./lib";
import type { AppEnv, Ctx } from "./lib";
import { extractPlaceIdFromUrl } from "./placeId";

const merchants = new Hono<AppEnv>();

const LOCALES = ["en", "it", "es"];
const EDITABLE: Record<string, string> = {
  name: "name",
  phone: "phone",
  address: "address",
  city: "city",
  country: "country",
  settings: "settings",
  preferredLocale: "preferred_locale",
};

async function loadMerchant(c: Ctx, id: string) {
  const row = await c.env.DB.prepare(`SELECT ${MERCHANT_SAFE_COLUMNS} FROM merchants WHERE id = ?`)
    .bind(id)
    .first<Record<string, unknown>>();
  if (!row) throw new ApiError(404, "Merchant not found");
  return camel(row);
}

async function updateMerchant(c: Ctx, id: string) {
  const input = await body(c);
  const sets: string[] = [];
  const binds: unknown[] = [];

  for (const [field, column] of Object.entries(EDITABLE)) {
    let value = input[field];
    if (value === undefined) continue;

    if (field === "preferredLocale" && !LOCALES.includes(String(value))) {
      throw new ApiError(400, `preferredLocale must be one of: ${LOCALES.join(", ")}`);
    }
    if (field === "name" && (typeof value !== "string" || !value.trim())) {
      throw new ApiError(400, "name cannot be empty");
    }
    if (field === "settings" && typeof value === "string") {
      // Re-derive googlePlaceId from googleMapsUrl, clearing the old one first so a stale value
      // cannot survive a URL change whose extraction fails.
      try {
        const settings = JSON.parse(value) as Record<string, unknown>;
        delete settings.googlePlaceId;
        if (typeof settings.googleMapsUrl === "string" && settings.googleMapsUrl) {
          const placeId = await extractPlaceIdFromUrl(settings.googleMapsUrl, c.env.GOOGLE_MAPS_API_KEY);
          if (placeId) settings.googlePlaceId = placeId;
        }
        value = JSON.stringify(settings);
      } catch (err) {
        console.error("Failed to parse settings for Place ID extraction:", err);
      }
    }
    sets.push(`${column} = ?`);
    binds.push(value);
  }

  if (sets.length) {
    sets.push("updated_at = ?");
    binds.push(now(), id);
    await c.env.DB.prepare(`UPDATE merchants SET ${sets.join(", ")} WHERE id = ?`).bind(...binds).run();
  }
  return c.json(await loadMerchant(c, id));
}

// ── Authenticated: own profile ──────────────────────────────

merchants.get("/me", authenticateMerchant, async (c) => c.json(await loadMerchant(c, c.get("merchantId"))));
merchants.patch("/me", authenticateMerchant, (c) => updateMerchant(c, c.get("merchantId")));

// ── API keys ────────────────────────────────────────────────

merchants.post("/me/api-keys", authenticateMerchant, async (c) => {
  const { name } = await body(c);
  if (typeof name !== "string" || !name.trim()) throw new ApiError(400, "API key name is required");

  const apiKey = newApiKey();
  const id = uuid();
  const ts = now();
  await c.env.DB.prepare(
    "INSERT INTO api_keys (id, merchant_id, key_hash, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(id, c.get("merchantId"), await sha256Hex(apiKey), name.trim(), ts, ts)
    .run();

  return c.json(
    { id, name: name.trim(), apiKey, createdAt: ts, message: "Save this API key securely. It will not be shown again." },
    201
  );
});

merchants.get("/me/api-keys", authenticateMerchant, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, name, active, last_used_at, expires_at, created_at, updated_at
       FROM api_keys WHERE merchant_id = ? ORDER BY created_at DESC`
  )
    .bind(c.get("merchantId"))
    .all<Record<string, unknown>>();
  return c.json({ data: results.map((r) => camel(r)) });
});

merchants.delete("/me/api-keys/:id", authenticateMerchant, async (c) => {
  const id = requireUuid(c.req.param("id") ?? "", "id");
  const key = await c.env.DB.prepare("SELECT merchant_id FROM api_keys WHERE id = ?")
    .bind(id)
    .first<{ merchant_id: string }>();
  if (!key) throw new ApiError(404, "API key not found");
  if (key.merchant_id !== c.get("merchantId")) throw new ApiError(403, "You can only revoke your own API keys");

  await c.env.DB.prepare("UPDATE api_keys SET active = 0, updated_at = ? WHERE id = ?").bind(now(), id).run();
  return c.json({ message: "API key revoked successfully" });
});

// ── By id ───────────────────────────────────────────────────

// Only what a customer-facing page needs. The Express route returned the whole row, password hash
// included; there is no password here, and email, phone and settings are not exposed.
merchants.get("/:id", async (c) => {
  const id = requireUuid(c.req.param("id") ?? "", "id");
  const row = await c.env.DB.prepare(
    "SELECT id, name, city, country, preferred_locale, active FROM merchants WHERE id = ?"
  )
    .bind(id)
    .first<Record<string, unknown>>();
  if (!row) throw new ApiError(404, "Merchant not found");
  return c.json(camel(row));
});

merchants.patch("/:id", authenticateMerchant, (c) => {
  const id = requireUuid(c.req.param("id") ?? "", "id");
  if (c.get("merchantId") !== id) throw new ApiError(403, "You can only update your own merchant profile");
  return updateMerchant(c, id);
});

export default merchants;
