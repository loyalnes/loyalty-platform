import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import prisma from "../prisma";
import { ApiError } from "../middleware/errorHandler";
import { registerRateLimiter, authRateLimiter } from "../middleware/rateLimiter";

const router = Router();

// POST /auth/signup — Register a new merchant with password
router.post("/signup", registerRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      throw new ApiError(400, "name, email, and password are required");
    }

    if (password.length < 6) {
      throw new ApiError(400, "Password must be at least 6 characters");
    }

    const existing = await prisma.merchant.findUnique({ where: { email } });
    if (existing) {
      throw new ApiError(409, "A merchant with this email already exists");
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const merchant = await prisma.merchant.create({
      data: { name, email, passwordHash },
    });

    res.status(201).json({
      merchant: {
        id: merchant.id,
        name: merchant.name,
        email: merchant.email,
        plan: merchant.plan,
        preferredLocale: merchant.preferredLocale,
        active: merchant.active,
        createdAt: merchant.createdAt,
      },
      apiKey: merchant.id,
    });
  } catch (err) {
    next(err);
  }
});

// POST /auth/login — Login with email and password
router.post("/login", authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new ApiError(400, "email and password are required");
    }

    const merchant = await prisma.merchant.findUnique({ where: { email } });
    if (!merchant || !merchant.active) {
      throw new ApiError(401, "Invalid email or password");
    }

    if (!merchant.passwordHash) {
      throw new ApiError(401, "Invalid email or password");
    }

    const valid = await bcrypt.compare(password, merchant.passwordHash);
    if (!valid) {
      throw new ApiError(401, "Invalid email or password");
    }

    res.json({
      merchant: {
        id: merchant.id,
        name: merchant.name,
        email: merchant.email,
        plan: merchant.plan,
        preferredLocale: merchant.preferredLocale,
        active: merchant.active,
        createdAt: merchant.createdAt,
      },
      apiKey: merchant.id,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
