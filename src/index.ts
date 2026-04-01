import "dotenv/config";
import path from "path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { authenticateMerchant } from "./middleware/auth";
import { errorHandler } from "./middleware/errorHandler";
import merchantRoutes from "./routes/merchants";
import cardRoutes from "./routes/cards";
import pointRoutes from "./routes/points";

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

// Public routes — merchant registration and listing
app.use("/api/merchants", merchantRoutes);

// Authenticated routes — cards and points require a valid merchant API key
app.use("/api/cards", authenticateMerchant, cardRoutes);
app.use("/api/points", authenticateMerchant, pointRoutes);

// Serve the merchant dashboard (production build)
const dashboardPath = path.join(__dirname, "../../dashboard/dist");
app.use(express.static(dashboardPath));
app.get("*", (_req, res) => {
  res.sendFile(path.join(dashboardPath, "index.html"));
});

// Error handler (must be last)
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Loyalty API listening on port ${port}`);
});

export default app;
