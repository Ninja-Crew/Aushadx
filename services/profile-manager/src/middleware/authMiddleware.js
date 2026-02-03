import { token } from "morgan";
import logger from "../config/logger.js";
import { verifyAccessToken } from "../utils/jwt.js";

export default function authMiddleware(req, res, next) {
  const auth =
    req.headers && (req.headers.authorization || req.headers.Authorization);
  if (!auth) {
    return res.status(401).json({
      success: false,
      message: "Missing Authorization header",
    });
  }
  try {
    const payload = verifyAccessToken(auth);
    req.user = payload;
    return next();
  } catch (err) {
    logger.error("Auth middleware token verification failed:", err);
    return res
      .status(401)
      .json({ success: false, message: "Invalid token", details: err.message });
  }
}
