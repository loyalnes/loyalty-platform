import { ApiError, now } from "./lib";
import type { Ctx } from "./lib";

/** Counts this attempt and rejects with 429 once `limit` is exceeded inside the window (state lives in D1). */
export async function throttle(c: Ctx, key: string, limit: number, windowMs: number): Promise<void> {
  const ts = now();
  const row = await c.env.DB.prepare(
    `INSERT INTO auth_throttle (key, count, reset_at) VALUES (?1, 1, ?3)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN reset_at <= ?2 THEN 1 ELSE count + 1 END,
       reset_at = CASE WHEN reset_at <= ?2 THEN ?3 ELSE reset_at END
     RETURNING count`
  )
    .bind(key, ts, new Date(Date.now() + windowMs).toISOString())
    .first<{ count: number }>();
  if (row && row.count > limit) throw new ApiError(429, "Too many attempts, try again later");
}

export const clientIp = (c: Ctx): string => c.req.header("CF-Connecting-IP") ?? "unknown";
