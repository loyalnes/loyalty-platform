import { Router, Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import prisma from "../prisma";
import * as customerService from "../services/customerService";
import { getOrCreateWalletPass, getOrCreateWalletAccessToken } from "../services/walletTokens";
import { sendWalletLinkEmail } from "../services/mailer";
import { ApiError } from "../middleware/errorHandler";

const router = Router();

// POST /customers/manual-add — Merchant manually enrolls a customer + emails wallet link
router.post("/manual-add", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const merchantId = req.merchantId!;
    const { firstName, lastName, email, marketingConsent } = req.body ?? {};

    if (!firstName || !email) {
      throw new ApiError(400, "firstName and email are required");
    }

    const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
    if (!merchant) throw new ApiError(404, "Merchant not found");

    const program = await prisma.loyaltyProgram.findUnique({ where: { merchantId } });
    if (!program || !program.active) {
      throw new ApiError(400, "No active loyalty program");
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const now = new Date();

    let customer = await prisma.customer.findUnique({ where: { email: normalizedEmail } });
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          email: normalizedEmail,
          firstName: String(firstName).trim(),
          lastName: lastName ? String(lastName).trim() : "",
          acquisitionSource: "merchant_manual",
        },
      });
    }

    let card = await prisma.loyaltyCard.findUnique({
      where: { merchantId_customerId: { merchantId, customerId: customer.id } },
    });
    const alreadyEnrolled = Boolean(card);

    if (!card) {
      const cardNumber = `LC-${uuidv4().replace(/-/g, "").slice(0, 16).toUpperCase()}`;
      card = await prisma.loyaltyCard.create({
        data: {
          cardNumber,
          merchantId,
          customerId: customer.id,
          gdprConsentAt: now,
          marketingConsentAt: marketingConsent === true ? now : null,
        },
      });
    }

    const applePass = await getOrCreateWalletPass(card.id, "APPLE_WALLET");
    await getOrCreateWalletPass(card.id, "GOOGLE_WALLET");
    const accessToken = await getOrCreateWalletAccessToken(applePass.id);

    const origin = `${req.protocol}://${req.get("host")}`;
    const loyaltyUrl = `${origin}/app/loyalty/${accessToken.token}`;

    const emailSent = await sendWalletLinkEmail({
      to: customer.email,
      merchantName: merchant.name,
      customerFirstName: customer.firstName,
      loyaltyUrl,
    });

    res.status(alreadyEnrolled ? 200 : 201).json({
      alreadyEnrolled,
      loyaltyUrl,
      emailSent,
      customer: {
        id: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /customers?search=&page=1&limit=20
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const merchantId = req.merchantId!;
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || "20", 10)));
    const search = ((req.query.search as string) || "").trim();

    const result = await customerService.getCustomers(merchantId, {
      page,
      limit,
      search: search || undefined,
    });

    res.set('Cache-Control', 'no-store');
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /customers/:customerId/card - Get customer loyalty card details
router.get("/:customerId/card", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const merchantId = req.merchantId!;
    const { customerId } = req.params;

    const card = await customerService.getCustomerCard(merchantId, customerId);

    if (!card) {
      return res.status(404).json({ error: "Customer not found or not enrolled in your program" });
    }

    res.json(card);
  } catch (err) {
    next(err);
  }
});

// POST /customers/:customerId/points - Add points to customer card
router.post("/:customerId/points", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const merchantId = req.merchantId!;
    const { customerId } = req.params;
    const { points, description } = req.body;

    if (!points || points <= 0) {
      return res.status(400).json({ error: "Points must be a positive number" });
    }

    const result = await customerService.addPointsToCustomer(merchantId, customerId, points, description);

    res.json(result);
  } catch (err) {
    if (err instanceof Error && err.message.includes("not found")) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
});

// GET /customers/:customerId/available-rewards - Get rewards customer can redeem
router.get("/:customerId/available-rewards", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const merchantId = req.merchantId!;
    const { customerId } = req.params;

    const result = await customerService.getAvailableRewards(merchantId, customerId);

    res.json(result);
  } catch (err) {
    if (err instanceof Error && err.message.includes("not found")) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
});

// POST /customers/:customerId/redeem - Redeem a reward
router.post("/:customerId/redeem", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const merchantId = req.merchantId!;
    const { customerId } = req.params;
    const { rewardTierId } = req.body;

    if (!rewardTierId) {
      return res.status(400).json({ error: "rewardTierId is required" });
    }

    const result = await customerService.redeemReward(merchantId, customerId, rewardTierId);

    res.json(result);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message.includes("not found")) {
        return res.status(404).json({ error: err.message });
      }
      if (err.message.includes("Insufficient points")) {
        return res.status(400).json({ error: err.message });
      }
    }
    next(err);
  }
});

export default router;
