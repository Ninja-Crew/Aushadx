import express from "express";
import env from "./config/env.js";
import logger from "./config/logger.js";
import connectDB from "./config/db.js";
import app from "./app.js";

async function tryLoadDotenv() {
  try {
    const dotenv = await import("dotenv");
    dotenv.config();
    logger.info("Loaded .env file using dotenv");
  } catch (err) {
    logger.info("`dotenv` not installed or failed to load; skipping .env load");
  }
}

async function main() {
  await tryLoadDotenv();




  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  let mongoose;
  try {
    mongoose = await connectDB({ logger, env });
  } catch (err) {
    logger.error("Database connection failed, aborting startup", err);
    process.exit(1);
  }

  const port = process.env.PORT || env.PORT || 3001;
  const server = app.listen(port, () =>
    logger.info(`Server listening on port ${port}`),
  );

  async function shutdown(signal) {
    logger.info(`Received ${signal}, shutting down`);
    try {
      server.close(() => logger.info("HTTP server closed"));
      if (mongoose && mongoose.disconnect) {
        await mongoose.disconnect();
        logger.info("MongoDB disconnected");
      }
    } catch (err) {
      logger.error("Error during shutdown", err);
    } finally {
      process.exit(0);
    }
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main();
