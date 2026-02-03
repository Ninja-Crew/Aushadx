import express from "express";
import logger from "../../profile-manager/src/config/logger.js";
import verifyMiddleware from "./middleware/verifyToken.js";

const app = express();

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.get("/protected/:user_id", verifyMiddleware, (req, res) => {
  const user_id = req.params.user_id;
  // Optionally verify that URL user_id matches authenticated user
  if (req.user && req.user.sub !== user_id) {
    return res.status(403).json({ error: "User ID mismatch" });
  }
  res.json({ success: true, user: req.user, user_id });
});

export default app;
