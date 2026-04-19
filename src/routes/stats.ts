import { Router, Request, Response, NextFunction } from "express";
import * as statsService from "../services/statsService";

const router = Router();

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const merchantId = req.merchantId!;
    const period = statsService.parsePeriod(req.query.period as string | undefined);

    const stats = await statsService.getDashboardStats(merchantId, period);

    // Add caching headers for mobile PWA
    res.set('Cache-Control', 'private, max-age=300'); // 5 minutes
    res.set('Last-Modified', new Date().toUTCString());

    res.json(stats);
  } catch (err) {
    next(err);
  }
});

router.get("/feedback", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const merchantId = req.merchantId!;
    const period = statsService.parsePeriod(req.query.period as string | undefined);
    const limit = Number(req.query.limit || 6);

    const feedback = await statsService.getRecentFeedback(merchantId, period, limit);

    // Cache feedback for 2 minutes
    res.set('Cache-Control', 'private, max-age=120');

    res.json({ feedback });
  } catch (err) {
    next(err);
  }
});

router.get("/sentiment", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const merchantId = req.merchantId!;
    const period = statsService.parsePeriod(req.query.period as string | undefined);

    const sentiment = await statsService.getSentimentAnalysis(merchantId, period);

    // Cache sentiment for 5 minutes
    res.set('Cache-Control', 'private, max-age=300');

    res.json(sentiment);
  } catch (err) {
    next(err);
  }
});

router.get("/notifications", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const merchantId = req.merchantId!;

    const notifications = await statsService.getNotifications(merchantId);

    res.json({ notifications });
  } catch (err) {
    next(err);
  }
});

export default router;
