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
    const { firstName, lastName, email, phone, gdprConsent } = req.body ?? {};

    if (!firstName || !email) {
      throw new ApiError(400, "firstName and email are required");
    }
    if (gdprConsent !== true) {
      throw new ApiError(400, "GDPR consent is required");
    }

    const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
    if (!merchant || !merchant.active) {
      throw new ApiError(404, "Merchant not found");
    }

    const program = await prisma.loyaltyProgram.findUnique({ where: { merchantId } });
    if (!program || !program.active) {
      throw new ApiError(400, "This merchant has no active loyalty program");
    }

    const normalizedEmail = String(email).trim().toLowerCase();

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
          gdprConsentAt: new Date(),
        },
      });
    } else if (!customer.gdprConsentAt) {
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: { gdprConsentAt: new Date() },
      });
    }

    let loyaltyCard = await prisma.loyaltyCard.findUnique({
      where: {
        merchantId_customerId: { merchantId, customerId: customer.id },
      },
    });
    const alreadyEnrolled = Boolean(loyaltyCard);

    if (!loyaltyCard) {
      const cardNumber = `LC-${uuidv4().replace(/-/g, "").slice(0, 16).toUpperCase()}`;
      loyaltyCard = await prisma.loyaltyCard.create({
        data: { cardNumber, merchantId, customerId: customer.id },
      });
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
    next(err);
  }
});

export default router;
