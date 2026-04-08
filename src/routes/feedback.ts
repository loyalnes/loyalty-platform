import { Router, Request, Response, NextFunction } from "express";
import prisma from "../prisma";

const router = Router();

// Helper to generate random redemption code (6 chars alphanumeric)
function generateRedemptionCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

/**
 * GET /api/feedback/:merchantId/config
 * Public endpoint - Get merchant configuration for review flow
 */
router.get("/:merchantId/config", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { merchantId } = req.params;

    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      select: {
        id: true,
        name: true,
        settings: true,
        preferredLocale: true,
      },
    });

    if (!merchant) {
      return res.status(404).json({ error: "Merchant not found" });
    }

    // Parse settings JSON to extract Google Maps URL
    let settings: any = {};
    try {
      settings = JSON.parse(merchant.settings);
    } catch {
      settings = {};
    }

    const googleMapsUrl = settings.googleMapsUrl || null;
    const reviewFlowEnabled = settings.reviewFlowEnabled !== false; // Default true

    res.json({
      merchantId: merchant.id,
      merchantName: merchant.name,
      googleMapsUrl,
      reviewFlowEnabled,
      locale: merchant.preferredLocale,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/feedback/:merchantId
 * Public endpoint - Save detailed feedback (rating 1-4)
 */
router.post("/:merchantId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { merchantId } = req.params;
    const {
      rating,
      foodRating,
      serviceRating,
      atmosphereRating,
      text,
      email,
      firstName,
      lastName,
    } = req.body;

    // Validation
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    // Validate detailed ratings if provided
    const detailedRatings = [foodRating, serviceRating, atmosphereRating].filter((r) => r !== undefined && r !== null);
    for (const r of detailedRatings) {
      if (r < 1 || r > 5) {
        return res.status(400).json({ error: "Detailed ratings must be between 1 and 5" });
      }
    }

    // Verify merchant exists
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
    });

    if (!merchant) {
      return res.status(404).json({ error: "Merchant not found" });
    }

    // Find or create customer if email provided
    let customerId: string | null = null;

    if (email && firstName) {
      const cleanEmail = email.trim().toLowerCase();
      const cleanFirstName = firstName.trim();

      let customer = await prisma.customer.findUnique({
        where: { email: cleanEmail },
      });

      if (!customer) {
        // Create new customer
        customer = await prisma.customer.create({
          data: {
            email: cleanEmail,
            firstName: cleanFirstName,
            lastName: lastName?.trim() || null,
            preferredLocale: merchant.preferredLocale,
            acquisitionSource: "REVIEW_FLOW",
          },
        });
      }

      customerId = customer.id;
    }

    // Create feedback
    const feedback = await prisma.merchantFeedback.create({
      data: {
        merchantId,
        customerId,
        rating,
        foodRating: foodRating || null,
        serviceRating: serviceRating || null,
        atmosphereRating: atmosphereRating || null,
        text: text?.trim() || "No additional comments",
        source: "DIRECT",
      },
    });

    res.json({
      success: true,
      feedbackId: feedback.id,
      message: "Thank you for your feedback!",
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/feedback/:merchantId/google-redirect
 * Public endpoint - Track Google Maps redirect (rating 5)
 */
router.post("/:merchantId/google-redirect", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { merchantId } = req.params;
    const { rating, email } = req.body;

    // Verify merchant exists and has Google Maps URL
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      select: {
        id: true,
        name: true,
        settings: true,
      },
    });

    if (!merchant) {
      return res.status(404).json({ error: "Merchant not found" });
    }

    // Parse settings to get Google Maps URL
    let settings: any = {};
    try {
      settings = JSON.parse(merchant.settings);
    } catch {
      settings = {};
    }

    const googleMapsUrl = settings.googleMapsUrl;

    if (!googleMapsUrl) {
      return res.status(400).json({
        error: "Google Maps URL not configured for this merchant",
        fallback: true,
      });
    }

    // Find customer if email provided
    let customerId: string | null = null;

    if (email) {
      const cleanEmail = email.trim().toLowerCase();
      const customer = await prisma.customer.findUnique({
        where: { email: cleanEmail },
      });

      if (customer) {
        customerId = customer.id;
      }
    }

    // Track redirect with placeholder feedback
    await prisma.merchantFeedback.create({
      data: {
        merchantId,
        customerId,
        rating: 5,
        text: "Redirected to Google Maps for review",
        source: "GOOGLE_MAPS",
      },
    });

    res.json({
      success: true,
      redirectUrl: googleMapsUrl,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
