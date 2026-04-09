import { Router, Request, Response, NextFunction } from "express";
import prisma from "../prisma";
import { ApiError } from "../middleware/errorHandler";
import { validateUuid } from "../middleware/validateUuid";

const router = Router();

// POST /merchants — Register a new merchant (public)
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, phone, address, city, country } = req.body;

    if (!name || !email) {
      throw new ApiError(400, "name and email are required");
    }

    const existing = await prisma.merchant.findUnique({ where: { email } });
    if (existing) {
      throw new ApiError(409, "A merchant with this email already exists");
    }

    const merchant = await prisma.merchant.create({
      data: { name, email, phone, address, city, country },
    });

    res.status(201).json(merchant);
  } catch (err) {
    next(err);
  }
});

// GET /merchants — List all merchants (public for MVP)
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [merchants, total] = await Promise.all([
      prisma.merchant.findMany({
        where: { active: true },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.merchant.count({ where: { active: true } }),
    ]);

    res.json({ data: merchants, total, page, limit });
  } catch (err) {
    next(err);
  }
});

// GET /merchants/by-email/:email — Lookup merchant by email (for dashboard login)
router.get("/by-email/:email", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const merchant = await prisma.merchant.findUnique({
      where: { email: req.params.email },
      include: { cardTemplates: true },
    });

    if (!merchant) {
      throw new ApiError(404, "No merchant found with this email");
    }

    res.json(merchant);
  } catch (err) {
    next(err);
  }
});

// GET /merchants/:id — Get merchant by ID
router.get("/:id", validateUuid("id"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const merchant = await prisma.merchant.findUnique({
      where: { id: req.params.id },
      include: { cardTemplates: true },
    });

    if (!merchant) {
      throw new ApiError(404, "Merchant not found");
    }

    res.json(merchant);
  } catch (err) {
    next(err);
  }
});

// PATCH /merchants/:id — Update merchant (authenticated, own merchant only)
router.patch("/:id", validateUuid("id"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.merchantId !== req.params.id) {
      throw new ApiError(403, "You can only update your own merchant profile");
    }

    const allowed = ["name", "phone", "address", "city", "country", "settings", "preferredLocale"] as const;
    const data: Record<string, unknown> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        data[key] = req.body[key];
      }
    }

    const merchant = await prisma.merchant.update({
      where: { id: req.params.id },
      data,
    });

    res.json(merchant);
  } catch (err) {
    next(err);
  }
});

export default router;
