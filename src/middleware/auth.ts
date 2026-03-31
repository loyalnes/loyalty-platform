import { Request, Response, NextFunction } from "express";
import prisma from "../prisma";
import { ApiError } from "./errorHandler";

declare global {
  namespace Express {
    interface Request {
      merchantId?: string;
    }
  }
}

/**
 * Authenticates merchants via API key passed in the X-API-Key header.
 * The API key is the merchant's UUID id for simplicity in the MVP.
 * A production system would use hashed API keys stored separately.
 */
export async function authenticateMerchant(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const apiKey = req.header("X-API-Key");
    if (!apiKey) {
      throw new ApiError(401, "Missing X-API-Key header");
    }

    const merchant = await prisma.merchant.findUnique({
      where: { id: apiKey },
    });

    if (!merchant || !merchant.active) {
      throw new ApiError(401, "Invalid or inactive API key");
    }

    req.merchantId = merchant.id;
    next();
  } catch (err) {
    next(err);
  }
}
