import { Router, Request, Response, NextFunction } from "express";
import prisma from "../prisma";
import { ApiError } from "../middleware/errorHandler";

const router = Router();

// POST /programs — Create a loyalty program with reward tiers
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const merchantId = req.merchantId!;
    const { type, goalStamps, welcomeStamps, welcomePoints, pointsPerCurrency, rewardTiers } = req.body;

    if (!type || !["POINTS", "STAMPS"].includes(type)) {
      throw new ApiError(400, "type must be POINTS or STAMPS");
    }

    const existing = await prisma.loyaltyProgram.findUnique({ where: { merchantId } });
    if (existing) {
      throw new ApiError(409, "You already have a loyalty program");
    }

    if (type === "STAMPS" && (!goalStamps || goalStamps < 1)) {
      throw new ApiError(400, "goalStamps is required for STAMPS programs");
    }

    if (!rewardTiers || !Array.isArray(rewardTiers) || rewardTiers.length === 0) {
      throw new ApiError(400, "At least one reward tier is required");
    }

    const program = await prisma.loyaltyProgram.create({
      data: {
        merchantId,
        type,
        goalStamps: type === "STAMPS" ? goalStamps : null,
        welcomeStamps: type === "STAMPS" ? (welcomeStamps || 0) : null,
        welcomePoints: type === "POINTS" ? (welcomePoints || 0) : null,
        pointsPerCurrency: type === "POINTS" ? (pointsPerCurrency || 1) : null,
        rewardTiers: {
          create: rewardTiers.map((tier: { name: string; threshold: number; rewardName: string }, i: number) => ({
            name: tier.name,
            threshold: tier.threshold,
            rewardName: tier.rewardName,
            sortOrder: i,
          })),
        },
      },
      include: { rewardTiers: { orderBy: { sortOrder: "asc" } } },
    });

    res.status(201).json(program);
  } catch (err) {
    next(err);
  }
});

// GET /programs/mine — Get current merchant's loyalty program
router.get("/mine", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const merchantId = req.merchantId!;

    const program = await prisma.loyaltyProgram.findUnique({
      where: { merchantId },
      include: { rewardTiers: { orderBy: { sortOrder: "asc" } } },
    });

    if (!program) {
      res.json(null);
      return;
    }

    const cardWithActivity = await prisma.loyaltyCard.findFirst({
      where: { merchantId, OR: [{ totalEarned: { gt: 0 } }, { totalRedeemed: { gt: 0 } }] },
      select: { id: true },
    });

    res.json({ ...program, hasTransactions: Boolean(cardWithActivity) });
  } catch (err) {
    next(err);
  }
});

export default router;
