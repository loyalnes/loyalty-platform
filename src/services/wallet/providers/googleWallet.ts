import crypto from "crypto";
import prisma from "../../../prisma";
import type { WalletSummary } from "../../walletSummary";

function compactSummary(summary: WalletSummary): string {
  const parts = [summary.pointsBalanceDisplay];

  if (summary.tierName) {
    parts.push(summary.tierName);
  }

  if (summary.activePrizeCount > 0) {
    parts.push(`${summary.activePrizeCount} rewards`);
  }

  if (summary.nearestPrizeExpiration) {
    const date = new Date(summary.nearestPrizeExpiration).toLocaleDateString("en-CA");
    parts.push(`exp ${date}`);
  }

  return parts.join(" · ");
}

function buildSnapshotHash(summary: WalletSummary): string {
  return crypto.createHash("sha256").update(JSON.stringify({
    pointsBalance: summary.pointsBalance,
    tierName: summary.tierName,
    activePrizeCount: summary.activePrizeCount,
    activePrizes: summary.activePrizes.map((prize) => ({
      id: prize.id,
      expiresAt: prize.expiresAt,
    })),
  })).digest("hex");
}

/**
 * Generate Google Wallet pass save URL
 * Uses Google Wallet REST API to create a loyalty object
 */
export async function generateGoogleWalletPass(summary: WalletSummary): Promise<string> {
  const serviceAccountEmail = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL;
  const serviceAccountKey = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_KEY;
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;

  if (!serviceAccountEmail || !serviceAccountKey || !issuerId) {
    throw new Error("Google Wallet configuration incomplete. Required: GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL, GOOGLE_WALLET_SERVICE_ACCOUNT_KEY, GOOGLE_WALLET_ISSUER_ID");
  }

  // Build the loyalty class ID and object ID
  const classId = `${issuerId}.loyalty-card-class`;
  const objectId = `${issuerId}.${summary.walletPassId}`;

  // Create loyalty object payload
  const loyaltyObject = {
    id: objectId,
    classId,
    state: "ACTIVE",
    barcode: {
      type: "QR_CODE",
      value: summary.merchantScanToken,
    },
    accountName: summary.customerName,
    accountId: summary.loyaltyCardId,
    loyaltyPoints: {
      label: summary.tierName || "Points",
      balance: {
        int: summary.pointsBalance,
      },
    },
    textModulesData: [
      {
        header: "Card Number",
        body: summary.cardNumber,
      },
      {
        header: "Status",
        body: compactSummary(summary),
      },
    ],
    linksModuleData: {
      uris: [
        {
          uri: `${process.env.PUBLIC_URL || "https://loyali.online"}/app/loyalty/${summary.customerAccessToken}`,
          description: "View Loyalty Details",
        },
      ],
    },
  };

  // Sign JWT for Google Wallet
  const claims = {
    iss: serviceAccountEmail,
    aud: "google",
    origins: [],
    typ: "savetowallet",
    payload: {
      loyaltyObjects: [loyaltyObject],
    },
  };

  // Create JWT token (simplified - in production use proper JWT library)
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");

  // Sign with RSA private key
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(`${header}.${payload}`);
  const signature = sign.sign(serviceAccountKey, "base64url");

  const jwt = `${header}.${payload}.${signature}`;

  // Update wallet pass metadata
  await prisma.walletPass.update({
    where: { id: summary.walletPassId },
    data: {
      lastSnapshotHash: buildSnapshotHash(summary),
      lastIssuedAt: new Date(),
      status: "ACTIVE",
    },
  });

  // Return Google Wallet save URL
  return `https://pay.google.com/gp/v/save/${jwt}`;
}
