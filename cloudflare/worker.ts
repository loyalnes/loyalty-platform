// Front door for loyali on Cloudflare: static apps from Workers Static Assets,
// /api/* and /health served by the Express app in src/app.ts.
// Mirrors the route table that used to live in src/index.ts, so the three apps keep a single origin.

import { httpServerHandler } from "cloudflare:node";
import app from "../src/app";
import { withRequestPool } from "../src/prisma";

interface Env {
  ASSETS: Fetcher;
  HYPERDRIVE: Hyperdrive;
}

const EXPRESS_PORT = 3000;
app.listen(EXPRESS_PORT);
const api = httpServerHandler({ port: EXPRESS_PORT });

const CUSTOMER_PAGES = /^\/app\/(play|join|loyalty|review)\/[^/]+\/?$/;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname.startsWith("/api/") || pathname === "/health") {
      const headers = new Headers(request.headers);
      const ip = request.headers.get("CF-Connecting-IP");
      if (ip) headers.set("X-Forwarded-For", ip);
      headers.set("X-Forwarded-Proto", "https");
      const forwarded = new Request(request, { headers });

      const { result, close } = await withRequestPool(env.HYPERDRIVE.connectionString, () =>
        api.fetch(forwarded, env, ctx)
      );
      ctx.waitUntil(close());
      return result;
    }

    const page = pathname.match(CUSTOMER_PAGES);
    if (page) {
      return env.ASSETS.fetch(new URL(`/_customer/${page[1]}.html`, url));
    }

    if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
      const asset = await env.ASSETS.fetch(request);
      if (asset.status !== 404) return asset;
      const index = await env.ASSETS.fetch(new URL("/dashboard/index.html", url));
      return new Response(index.body, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
      });
    }

    return env.ASSETS.fetch(request);
  },
};
