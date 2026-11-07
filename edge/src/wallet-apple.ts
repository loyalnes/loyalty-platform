// Apple Wallet pass through the WalletWallet HTTP API (port of providers/walletWalletApple.ts).

import { compactSummary, markPassIssued } from "./wallet-google";
import type { WalletEnv } from "./wallet-google";
import type { WalletSummary } from "./wallet-summary";

export async function generateWalletWalletApplePass(env: WalletEnv, summary: WalletSummary): Promise<ArrayBuffer> {
  const apiKey = env.WALLETWALLET_API_KEY;
  if (!apiKey) {
    throw new Error("WALLETWALLET_API_KEY is not configured. Please set the environment variable.");
  }

  const payload: Record<string, unknown> = {
    barcodeValue: summary.merchantScanToken,
    barcodeFormat: "QR",
    title: summary.merchantName,
    cardLabel: "LOYALTY",
    label: summary.customerName,
    value: compactSummary(summary),
    expirationDays: 365, // WalletWallet only accepts: 30, 90, 365
    colorPreset: env.WALLETWALLET_COLOR_PRESET || "dark",
  };

  // Image URLs only when configured and not placeholders.
  const real = (url?: string) => (url && !url.includes("placehold.co") ? url : undefined);
  const logoURL = real(env.WALLETWALLET_LOGO_URL);
  const thumbnailURL = real(env.WALLETWALLET_THUMBNAIL_URL);
  const stripURL = real(env.WALLETWALLET_STRIP_URL);
  if (logoURL) payload.logoURL = logoURL;
  if (thumbnailURL) payload.thumbnailURL = thumbnailURL;
  if (stripURL) payload.stripURL = stripURL;

  const response = await fetch("https://api.walletwallet.dev/api/pkpass", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("WalletWallet API error:", { status: response.status, statusText: response.statusText, body: errorText.slice(0, 500) });
    throw new Error(`WalletWallet API error (${response.status}): ${errorText}`);
  }

  const buffer = await response.arrayBuffer();
  await markPassIssued(env, summary);
  return buffer;
}
