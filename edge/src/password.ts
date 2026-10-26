// Password hashing with PBKDF2-SHA256 from Web Crypto. bcrypt in JavaScript costs far more than the
// 10 ms of CPU a Workers Free request gets; the native implementation is much cheaper, and the
// iteration count is stored inside each hash so it can be raised later without invalidating anyone.
// Format: pbkdf2$sha256$<iterations>$<salt b64>$<hash b64>

const ITERATIONS = 20_000;
const HASH_BYTES = 32;

const b64 = (bytes: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = (text: string) => Uint8Array.from(atob(text), (ch) => ch.charCodeAt(0));

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, HASH_BYTES * 8);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$sha256$${ITERATIONS}$${b64(salt)}$${b64(await derive(password, salt, ITERATIONS))}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  const [scheme, algo, iterations, salt, hash] = (stored ?? "").split("$");
  if (scheme !== "pbkdf2" || algo !== "sha256" || !iterations || !salt || !hash) return false;
  const expected = unb64(hash);
  const actual = new Uint8Array(await derive(password, unb64(salt), Number(iterations)));
  return actual.length === expected.length && crypto.subtle.timingSafeEqual(actual, expected);
}

/** A well-formed hash of nothing, verified when the email is unknown so timing does not reveal it. */
export const DUMMY_HASH = `pbkdf2$sha256$${ITERATIONS}$${b64(new Uint8Array(16))}$${b64(new Uint8Array(HASH_BYTES))}`;
