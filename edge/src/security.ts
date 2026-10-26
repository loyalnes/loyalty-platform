// Headers for everything the Worker serves: not cached by shared caches, not indexable, not framed.

export function harden(response: Response, isApi: boolean): Response {
  const res = new Response(response.body, response);
  const cache = res.headers.get("Cache-Control");
  res.headers.set(
    "Cache-Control",
    isApi ? "private, no-store" : cache ? `private, ${cache.replace(/\b(public|private),?\s*/g, "")}` : "private, max-age=0, must-revalidate"
  );
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "no-referrer");
  res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  return res;
}
