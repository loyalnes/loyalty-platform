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
import pointRoutes from "./routes/points";
import programRoutes from "./routes/programs";
import statsRoutes from "./routes/stats";

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

// Authenticated routes
app.use("/api/cards", authenticateMerchant, cardRoutes);
app.use("/api/points", authenticateMerchant, pointRoutes);
app.use("/api/programs", authenticateMerchant, programRoutes);
app.use("/api/stats", authenticateMerchant, statsRoutes);

// Serve the merchant dashboard at /dashboard (production build)
const dashboardPath = path.join(__dirname, "../../dashboard/dist");
app.use("/dashboard", express.static(dashboardPath));
app.get("/dashboard/*", (_req, res) => {
  res.sendFile(path.join(dashboardPath, "index.html"));
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
