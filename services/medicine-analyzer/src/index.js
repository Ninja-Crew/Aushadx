import app from "./app.js";
import env from "./config/env.js";
import logger from "./config/logger.js";

const port = env.PORT || 5000;
const server = app.listen(port, () =>
  logger.info(`medicine-analyzer listening on ${port}`)
);

process.on("SIGINT", () => {
  logger.info("Shutting down");
  server.close(() => process.exit(0));
});
