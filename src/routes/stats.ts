import { Router, Request, Response, NextFunction } from "express";
import prisma from "../prisma";

const router = Router();

// GET /stats?period=7d|15d|30d — Dashboard stats
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const merchantId = req.merchantId!;
    const period = (req.query.period as string) || "7d";

    const days = period === "30d" ? 30 : period === "15d" ? 15 : 7;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [activeCommunity, newUsers] = await Promise.all([
      prisma.loyaltyCard.count({
        where: { merchantId, status: "ACTIVE" },
      }),
      prisma.loyaltyCard.count({
        where: { merchantId, createdAt: { gte: since } },
      }),
    ]);

    res.json({ activeCommunity, newUsers });
  } catch (err) {
    next(err);
  }
});

export default router;
