import env from "./config/env.js";
import logger from "./config/logger.js";
import connectDB from "./config/db.js";
import app from "./app.js";

async function start() {
  try {
    // Note: dotenv may have been loaded by src/index.js if used; safe to rely on process.env
    await connectDB({ logger, env });
    const port = env.PORT || process.env.PORT || 3000;
    app.listen(port, () =>
      logger.info(`Server running on http://localhost:${port}`),
    );
  } catch (err) {
    logger.error("Failed to start server", err);
    process.exit(1);
  }
}

start();
