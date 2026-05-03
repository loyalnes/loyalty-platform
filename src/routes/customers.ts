import { Router, Request, Response, NextFunction } from "express";
import * as customerService from "../services/customerService";

const router = Router();

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
