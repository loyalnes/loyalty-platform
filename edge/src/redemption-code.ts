const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** 8 characters from a 32-letter alphabet without 0/O/1/I; 256 % 32 = 0, so `b % 32` is unbiased. */
export function generateRedemptionCode(length = 8): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => CHARS[b % CHARS.length]).join("");
}
