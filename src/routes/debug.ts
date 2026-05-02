import { Router, Request, Response, NextFunction } from "express";

const router = Router();

// One-shot diagnostic for the Places API resolution pipeline.
// Protected by a hardcoded token shared with the operator out-of-band;
// remove this whole file once the integration is verified.
const DEBUG_TOKEN = "loyali-debug-2026-05-02";

router.get("/places-resolution", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.query.token !== DEBUG_TOKEN) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const url = (req.query.url as string) || "https://maps.app.goo.gl/WajmL9xepBnDrfjD6?g_st=ipc";
    const out: Record<string, unknown> = { input: url };

    // Step 1: env
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    out.envApiKeyPresent = Boolean(apiKey);
    out.envApiKeyLength = apiKey ? apiKey.length : 0;
    // List all process.env keys starting with GOOGLE so we can spot
    // misnamed secrets without leaking values.
    out.envGoogleKeys = Object.keys(process.env)
      .filter((k) => k.startsWith("GOOGLE"))
      .map((k) => ({ name: k, length: (process.env[k] || "").length }));
    out.composeMarker = process.env.MAPS_DEBUG_MARKER || null;

    // Step 2: redirect resolve
    let finalUrl = url;
    if (url.includes("goo.gl") || url.includes("maps.app.goo.gl")) {
      try {
        const r = await fetch(url, { method: "HEAD", redirect: "follow" });
        finalUrl = r.url;
        out.redirectStatus = r.status;
      } catch (e) {
        out.redirectError = e instanceof Error ? e.message : String(e);
      }
    }
    out.expandedUrl = finalUrl;

    // Step 3: regex
    const hexMatch = finalUrl.match(/(?:!1s|ftid=)0x[0-9a-f]+:0x([0-9a-f]+)/i);
    out.regexMatched = Boolean(hexMatch);
    out.hexCid = hexMatch ? hexMatch[1] : null;

    // Step 4: Places API call
    if (hexMatch && apiKey) {
      try {
        const decimalCid = BigInt("0x" + hexMatch[1]).toString();
        out.decimalCid = decimalCid;
        const apiUrl = `https://maps.googleapis.com/maps/api/place/details/json?cid=${decimalCid}&fields=place_id&key=${apiKey}`;
        const r = await fetch(apiUrl);
        const data = await r.json() as { status: string; result?: { place_id?: string }; error_message?: string };
        out.placesApiHttpStatus = r.status;
        out.placesApiStatus = data.status;
        out.placesApiErrorMessage = data.error_message || null;
        out.resolvedPlaceId = data.result?.place_id || null;
      } catch (e) {
        out.placesApiException = e instanceof Error ? e.message : String(e);
      }
    } else {
      out.skippedPlacesApi = !hexMatch ? "no-regex-match" : "no-api-key";
    }

    res.json(out);
  } catch (err) {
    next(err);
  }
});

export default router;
