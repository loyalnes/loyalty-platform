import "dotenv/config";
import path from "path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { authenticateMerchant } from "./middleware/auth";
import { errorHandler } from "./middleware/errorHandler";
import authRoutes from "./routes/auth";
import merchantRoutes from "./routes/merchants";
import cardRoutes from "./routes/cards";
import customerRoutes from "./routes/customers";
import pointRoutes from "./routes/points";
import programRoutes from "./routes/programs";
import statsRoutes from "./routes/stats";
import gamificationRoutes from "./routes/gamification";
import campaignRoutes from "./routes/campaigns";
import walletRoutes from "./routes/wallet";

const app = express();
const port = parseInt(process.env.PORT || "3000", 10);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());

// Health check (available at both /health and /api/health for Docker healthcheck compatibility)
const healthHandler = (_req: express.Request, res: express.Response) => {
  res.json({ status: "ok" });
};
app.get("/health", healthHandler);
app.get("/api/health", healthHandler);

// Public routes
app.use("/api/auth", authRoutes);
app.use("/api/merchants", merchantRoutes);
app.use("/api/gamification", gamificationRoutes);
app.use("/api/wallet", walletRoutes);

// Authenticated routes
app.use("/api/cards", authenticateMerchant, cardRoutes);
app.use("/api/customers", authenticateMerchant, customerRoutes);
app.use("/api/points", authenticateMerchant, pointRoutes);
app.use("/api/programs", authenticateMerchant, programRoutes);
app.use("/api/stats", authenticateMerchant, statsRoutes);
app.use("/api/campaigns", authenticateMerchant, campaignRoutes);

// Serve the merchant dashboard at /dashboard (production build)
const dashboardPath = path.join(__dirname, "../../dashboard/dist");
app.use("/dashboard", express.static(dashboardPath, {
  etag: false,
  maxAge: 0,
}));
app.get("/dashboard/*", (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(dashboardPath, "index.html"));
});

// Serve the customer gamification app at /app/play/:merchantId and /app/join/:merchantId
const customerPath = path.join(__dirname, "../../customer/public");
app.get("/app/play/:merchantId", (_req, res) => {
  res.sendFile(path.join(customerPath, "play.html"));
});
app.get("/app/join/:merchantId", (_req, res) => {
  res.sendFile(path.join(customerPath, "play.html"));
});
app.get("/app/loyalty/:token", (_req, res) => {
  res.sendFile(path.join(customerPath, "loyalty.html"));
});

// Serve the marketing website at root /
const marketingPath = path.join(__dirname, "../../marketing");
app.use(express.static(marketingPath));
app.get("*", (_req, res) => {
  res.sendFile(path.join(marketingPath, "index.html"));
});

// Error handler (must be last)
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Loyalty API listening on port ${port}`);
});

export default app;
