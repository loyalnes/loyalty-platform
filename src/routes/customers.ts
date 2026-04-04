import { Router, Request, Response, NextFunction } from "express";
import prisma from "../prisma";

const router = Router();

// GET /customers?search=&page=1&limit=20
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const merchantId = req.merchantId!;
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || "20", 10)));
    const skip = (page - 1) * limit;
    const search = ((req.query.search as string) || "").trim();

    const where = {
      merchantId,
      ...(search
        ? {
            customer: {
              OR: [
                { firstName: { contains: search, mode: "insensitive" as const } },
                { lastName: { contains: search, mode: "insensitive" as const } },
                { email: { contains: search, mode: "insensitive" as const } },
                { phone: { contains: search, mode: "insensitive" as const } },
              ],
            },
          }
        : {}),
    };

    const [cards, total] = await Promise.all([
      prisma.loyaltyCard.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: "desc" },
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              avatarUrl: true,
            },
          },
          transactions: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true },
          },
        },
      }),
      prisma.loyaltyCard.count({ where }),
    ]);

    const data = cards.map((card) => ({
      id: card.id,
      customerId: card.customer.id,
      firstName: card.customer.firstName,
      lastName: card.customer.lastName,
      email: card.customer.email,
      phone: card.customer.phone,
      avatarUrl: card.customer.avatarUrl,
      pointsBalance: card.pointsBalance,
      status: card.status,
      lastVisitAt: card.transactions[0]?.createdAt ?? card.updatedAt,
    }));

    res.json({ data, total, page, limit });
  } catch (err) {
    next(err);
  }
});

// GET /customers/:customerId/card - Get customer loyalty card details
router.get("/:customerId/card", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const merchantId = req.merchantId!;
    const { customerId } = req.params;

    const card = await prisma.loyaltyCard.findFirst({
      where: {
        merchantId,
        customerId,
      },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatarUrl: true,
          },
        },
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            type: true,
            points: true,
            balanceAfter: true,
            description: true,
            createdAt: true,
          },
        },
      },
    });

    if (!card) {
      return res.status(404).json({ error: "Customer not found or not enrolled in your program" });
    }

    res.json({
      id: card.id,
      cardNumber: card.cardNumber,
      customerId: card.customer.id,
      firstName: card.customer.firstName,
      lastName: card.customer.lastName,
      email: card.customer.email,
      phone: card.customer.phone,
      avatarUrl: card.customer.avatarUrl,
      pointsBalance: card.pointsBalance,
      totalEarned: card.totalEarned,
      totalRedeemed: card.totalRedeemed,
      status: card.status,
      recentTransactions: card.transactions,
    });
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

    const card = await prisma.loyaltyCard.findFirst({
      where: {
        merchantId,
        customerId,
      },
    });

    if (!card) {
      return res.status(404).json({ error: "Customer not found or not enrolled in your program" });
    }

    const newBalance = card.pointsBalance + points;

    // Create transaction and update card in a transaction
    const [transaction, updatedCard] = await prisma.$transaction([
      prisma.pointsTransaction.create({
        data: {
          loyaltyCardId: card.id,
          type: "EARN",
          points,
          balanceAfter: newBalance,
          description: description || `Points added by merchant`,
        },
      }),
      prisma.loyaltyCard.update({
        where: { id: card.id },
        data: {
          pointsBalance: newBalance,
          totalEarned: card.totalEarned + points,
        },
      }),
    ]);

    res.json({
      success: true,
      transaction: {
        id: transaction.id,
        points: transaction.points,
        balanceAfter: transaction.balanceAfter,
        createdAt: transaction.createdAt,
      },
      card: {
        pointsBalance: updatedCard.pointsBalance,
        totalEarned: updatedCard.totalEarned,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /customers/:customerId/available-rewards - Get rewards customer can redeem
router.get("/:customerId/available-rewards", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const merchantId = req.merchantId!;
    const { customerId } = req.params;

    // Get customer's loyalty card
    const card = await prisma.loyaltyCard.findFirst({
      where: {
        merchantId,
        customerId,
      },
    });

    if (!card) {
      return res.status(404).json({ error: "Customer not found or not enrolled in your program" });
    }

    // Get merchant's loyalty program with reward tiers
    const program = await prisma.loyaltyProgram.findUnique({
      where: { merchantId },
      include: {
        rewardTiers: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!program || !program.rewardTiers.length) {
      return res.json({ availableRewards: [], allRewards: [] });
    }

    const currentPoints = card.pointsBalance;

    // Filter rewards that customer can afford
    const availableRewards = program.rewardTiers.filter((tier) => currentPoints >= tier.threshold);

    // Return both available and all rewards for context
    res.json({
      availableRewards: availableRewards.map((tier) => ({
        id: tier.id,
        name: tier.name,
        rewardName: tier.rewardName,
        threshold: tier.threshold,
        sortOrder: tier.sortOrder,
      })),
      allRewards: program.rewardTiers.map((tier) => ({
        id: tier.id,
        name: tier.name,
        rewardName: tier.rewardName,
        threshold: tier.threshold,
        sortOrder: tier.sortOrder,
      })),
      currentPoints,
    });
  } catch (err) {
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

    // Get customer's loyalty card
    const card = await prisma.loyaltyCard.findFirst({
      where: {
        merchantId,
        customerId,
      },
    });

    if (!card) {
      return res.status(404).json({ error: "Customer not found or not enrolled in your program" });
    }

    // Get the reward tier
    const rewardTier = await prisma.rewardTier.findUnique({
      where: { id: rewardTierId },
      include: { loyaltyProgram: true },
    });

    if (!rewardTier || rewardTier.loyaltyProgram.merchantId !== merchantId) {
      return res.status(404).json({ error: "Reward tier not found" });
    }

    // Check if customer has enough points
    if (card.pointsBalance < rewardTier.threshold) {
      return res.status(400).json({
        error: `Insufficient points. Need ${rewardTier.threshold}, have ${card.pointsBalance}`,
      });
    }

    const newBalance = card.pointsBalance - rewardTier.threshold;

    // Create REDEEM transaction and update card
    const [transaction, updatedCard] = await prisma.$transaction([
      prisma.pointsTransaction.create({
        data: {
          loyaltyCardId: card.id,
          type: "REDEEM",
          points: -rewardTier.threshold,
          balanceAfter: newBalance,
          description: `Redeemed: ${rewardTier.rewardName}`,
        },
      }),
      prisma.loyaltyCard.update({
        where: { id: card.id },
        data: {
          pointsBalance: newBalance,
          totalRedeemed: card.totalRedeemed + rewardTier.threshold,
        },
      }),
    ]);

    res.json({
      success: true,
      transaction: {
        id: transaction.id,
        points: transaction.points,
        balanceAfter: transaction.balanceAfter,
        createdAt: transaction.createdAt,
      },
      card: {
        pointsBalance: updatedCard.pointsBalance,
        totalRedeemed: updatedCard.totalRedeemed,
      },
      reward: {
        name: rewardTier.name,
        rewardName: rewardTier.rewardName,
        threshold: rewardTier.threshold,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
