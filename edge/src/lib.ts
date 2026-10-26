import type { Context } from "hono";

export type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
  GOOGLE_MAPS_API_KEY?: string;
};
export type Vars = { merchantId: string };
export type AppEnv = { Bindings: Env; Variables: Vars };
export type Ctx = Context<AppEnv>;

export class ApiError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 429,
    message: string
  ) {
    super(message);
  }
}

export const now = () => new Date().toISOString();
export const uuid = () => crypto.randomUUID();

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomHex(bytes: number): string {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function newApiKey(): string {
  return `loy_live_${randomHex(32)}`;
}

export function newCardNumber(): string {
  const d = uuid().replace(/-/g, "").slice(0, 16).toUpperCase();
  return `LC-${d.slice(0, 4)}-${d.slice(4, 8)}-${d.slice(8, 12)}-${d.slice(12, 16)}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function requireUuid(value: string, label: string): string {
  if (!UUID.test(value)) throw new ApiError(400, `Invalid ${label} format`);
  return value;
}

/** Parsed JSON body, or {} when it is missing or not an object. */
export async function body(c: Ctx): Promise<Record<string, unknown>> {
  const parsed = await c.req.json().catch(() => null);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
}

const toCamel = (key: string) => key.replace(/_([a-z])/g, (_, l: string) => l.toUpperCase());

/** snake_case row → camelCase object, with the listed columns turned into booleans. */
export function camel<T = Record<string, unknown>>(row: Record<string, unknown>, bools: string[] = ["active"]): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const name = toCamel(key);
    out[name] = bools.includes(name) ? Boolean(value) : value;
  }
  return out as T;
}

/** Prisma serialised Decimal columns as strings; the dashboard types expect that. */
export const dec = (value: unknown): string | null => (value === null || value === undefined ? null : String(value));

export function paging(c: Ctx, defaultLimit = 20) {
  const page = Math.max(1, parseInt(c.req.query("page") ?? "", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query("limit") ?? "", 10) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
}

/** Escape LIKE wildcards so user input is matched literally (use with ESCAPE '\'). */
export const likeStart = (token: string) => `${token.replace(/[\\%_]/g, "\\$&")}%`;

export const MERCHANT_SAFE_COLUMNS =
  "id, name, email, phone, address, city, country, plan, settings, preferred_locale, active, created_at, updated_at";
