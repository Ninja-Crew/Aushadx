import { verifyAccessToken } from "../utils/jwt.js";
import logger from "../config/logger.js";

export default function authMiddleware(req, res, next) {
  // 1. Trust Gateway if present
  const gatewayUserId = req.headers["x-user-id"];
  if (gatewayUserId) {
      req.user = { sub: gatewayUserId, id: gatewayUserId };
      if (req.headers["x-user-roles"]) {
          try {
              req.user.roles = JSON.parse(req.headers["x-user-roles"]);
          } catch (e) {}
      }
      return next();
  }

  // 2. Fallback: Verify Token (e.g. internal dev or direct access)
  const auth =
    req.headers && (req.headers.authorization || req.headers.Authorization);
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Missing Authorization header",
    });
  }
  
  const token = auth.split(" ")[1];

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    return next();
  } catch (err) {
    logger.error("Auth middleware token verification failed:", err);
    return res
      .status(401)
      .json({ success: false, message: "Invalid token", details: err.message });
  }
}
