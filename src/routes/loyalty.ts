import { Router, Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import prisma from "../prisma";
import { ApiError } from "../middleware/errorHandler";
import { getOrCreateWalletPass, getOrCreateWalletAccessToken } from "../services/walletTokens";

const router = Router();

// GET /loyalty/:merchantId/public-summary — Public merchant info for the join page
router.get("/:merchantId/public-summary", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { merchantId } = req.params;

    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { id: true, name: true, active: true },
    });

    if (!merchant || !merchant.active) {
      throw new ApiError(404, "Merchant not found");
    }

    const program = await prisma.loyaltyProgram.findUnique({
      where: { merchantId },
      select: { id: true, type: true, active: true },
    });

    res.json({
      id: merchant.id,
      name: merchant.name,
      hasLoyaltyProgram: Boolean(program?.active),
      programType: program?.type ?? null,
    });
  } catch (err) {
    next(err);
  }
});

// POST /loyalty/:merchantId/join — Public customer enrollment (no game)
router.post("/:merchantId/join", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { merchantId } = req.params;
    const { firstName, lastName, email, phone, marketingConsent } = req.body ?? {};

    if (!firstName || !email) {
      throw new ApiError(400, "firstName and email are required");
    }
    // Submitting the form is itself the acceptance of Terms + Privacy
    // (Art. 6(1)(b) GDPR — necessary for the contract). We log it implicitly
    // by setting gdprConsentAt when the card is created.

    const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
    if (!merchant || !merchant.active) {
      throw new ApiError(404, "Merchant not found");
    }

    const program = await prisma.loyaltyProgram.findUnique({ where: { merchantId } });
    if (!program || !program.active) {
      throw new ApiError(400, "This merchant has no active loyalty program");
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const now = new Date();

    let customer = await prisma.customer.findUnique({ where: { email: normalizedEmail } });
    const isNewCustomer = !customer;

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          email: normalizedEmail,
          firstName: String(firstName).trim(),
          lastName: lastName ? String(lastName).trim() : "",
          phone: phone ? String(phone).trim() : null,
          acquisitionSource: "qr_join",
        },
      });
    }

    // Consents are PER-MERCHANT (live on LoyaltyCard) because the merchant is
    // the data controller; Loyali is processor and never sends marketing.
    let loyaltyCard = await prisma.loyaltyCard.findUnique({
      where: {
        merchantId_customerId: { merchantId, customerId: customer.id },
      },
    });
    const alreadyEnrolled = Boolean(loyaltyCard);

    if (!loyaltyCard) {
      const cardNumber = `LC-${uuidv4().replace(/-/g, "").slice(0, 16).toUpperCase()}`;
      loyaltyCard = await prisma.loyaltyCard.create({
        data: {
          cardNumber,
          merchantId,
          customerId: customer.id,
          gdprConsentAt: now,
          marketingConsentAt: marketingConsent === true ? now : null,
        },
      });
    } else {
      const update: { gdprConsentAt?: Date; marketingConsentAt?: Date | null; marketingRevokedAt?: Date | null } = {};
      if (!loyaltyCard.gdprConsentAt) update.gdprConsentAt = now;
      if (marketingConsent === true && !loyaltyCard.marketingConsentAt) {
        update.marketingConsentAt = now;
        update.marketingRevokedAt = null;
      }
      if (marketingConsent === false && loyaltyCard.marketingConsentAt && !loyaltyCard.marketingRevokedAt) {
        update.marketingRevokedAt = now;
      }
      if (Object.keys(update).length > 0) {
        loyaltyCard = await prisma.loyaltyCard.update({
          where: { id: loyaltyCard.id },
          data: update,
        });
      }
    }

    const applePass = await getOrCreateWalletPass(loyaltyCard.id, "APPLE_WALLET");
    await getOrCreateWalletPass(loyaltyCard.id, "GOOGLE_WALLET");
    const accessToken = await getOrCreateWalletAccessToken(applePass.id);

    const origin = `${req.protocol}://${req.get("host")}`;

    res.status(isNewCustomer ? 201 : 200).json({
      alreadyEnrolled,
      accessToken: accessToken.token,
      applePassUrl: `${origin}/api/wallet/access/${accessToken.token}/apple-pass`,
      googleSaveUrl: `${origin}/api/wallet/access/${accessToken.token}/google-pass`,
      loyaltyUrl: `${origin}/app/loyalty/${accessToken.token}`,
      merchant: { id: merchant.id, name: merchant.name },
    });
  } catch (err) {
    console.error("loyalty/join failed:", err);
    next(err);
  }
});

export default router;
