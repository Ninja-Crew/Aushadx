import express from "express";
import analyzeRoutes from "./routes/analyzeRoutes.js";
import logger from "./config/logger.js";

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api", analyzeRoutes);

app.use((err, _req, res, _next) => {
  logger.error("Unhandled error", err);
  res.status(500).json({ error: err.message || "internal" });
});

export default app;
