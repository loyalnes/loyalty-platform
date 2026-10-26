// loyali on Cloudflare, one Worker: the static apps from Workers Static Assets and the API on
// Hono + D1. Sized for the Workers Free plan (10 ms CPU per request).
// Phase 1 API: sign-up and sign-in, merchant profile, programs, cards, customers and points.
// Stats, campaigns, feedback, the customer-facing join and card pages, wallet and manual-add
// come in the next phases.

import { Hono } from "hono";
import auth, { authenticateMerchant } from "./auth";
import campaigns from "./campaigns";
import cards from "./cards";
import customers from "./customers";
import feedback from "./feedback";
import gamification from "./gamification";
import { ApiError } from "./lib";
import loyalty from "./loyalty";
import manualAdd from "./manual-add";
import type { AppEnv, Env } from "./lib";
import merchants from "./merchants";
import points from "./points";
import programs from "./programs";
import { harden } from "./security";
import stats from "./stats";
import wallet from "./wallet";

const api = new Hono<AppEnv>();

api.get("/health", (c) => c.json({ status: "ok" }));
api.get("/api/health", (c) => c.json({ status: "ok" }));

// Public: sign-up and sign-in, the customer review flow and the join flow. /api/merchants authenticates its own /me routes.
api.route("/api/auth", auth);
api.route("/api/merchants", merchants);
api.route("/api/feedback", feedback);
api.route("/api/loyalty", loyalty);
api.route("/api/gamification", gamification);
api.route("/api/wallet", wallet);

// Authenticated (X-API-Key)
api.use("/api/campaigns/*", authenticateMerchant);
api.use("/api/cards/*", authenticateMerchant);
api.use("/api/customers/*", authenticateMerchant);
api.use("/api/points/*", authenticateMerchant);
api.use("/api/programs/*", authenticateMerchant);
api.use("/api/stats/*", authenticateMerchant);
api.route("/api/campaigns", campaigns);
api.route("/api/cards", cards);
api.route("/api/customers", manualAdd);
api.route("/api/customers", customers);
api.route("/api/points", points);
api.route("/api/programs", programs);
api.route("/api/stats", stats);
api.all("/api/*", (c) => c.json({ error: "Not found" }, 404));

api.onError((err, c) => {
  if (err instanceof ApiError) return c.json({ error: err.message }, err.status);
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

const CUSTOMER_PAGES = /^\/app\/(play|join|loyalty|review)\/[^/]+\/?$/;

async function route(request: Request, env: Env, ctx: ExecutionContext): Promise<{ response: Response; isApi: boolean }> {
  const url = new URL(request.url);
  const { pathname } = url;

  if (pathname.startsWith("/api/") || pathname === "/health") {
    return { response: await api.fetch(request, env, ctx), isApi: true };
  }

  const page = pathname.match(CUSTOMER_PAGES);
  if (page) return { response: await env.ASSETS.fetch(new URL(`/_customer/${page[1]}.html`, url)), isApi: false };

  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    const asset = await env.ASSETS.fetch(request);
    if (asset.status !== 404) return { response: asset, isApi: false };
    const index = await env.ASSETS.fetch(new URL("/dashboard/index.html", url));
    return {
      response: new Response(index.body, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }),
      isApi: false,
    };
  }

  return { response: await env.ASSETS.fetch(request), isApi: false };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const { response, isApi } = await route(request, env, ctx);
    return harden(response, isApi);
  },
};
