import * as authService from "../services/authService.js";
import { success, error } from "../utils/response.js";
import { verifyRefreshToken } from "../utils/jwt.js";
import logger from "../config/logger.js";
import User from "../models/User.js";

export async function signup(req, res) {
  try {
    const { email, password, name } = req.body;

    // Validate input
    if (!email || !password || !name) {
      return error(
        res,
        (message = "Email, password, and name are required"),
        (status = 400),
      );
    }

    const user = await authService.registerUser({ email, password, name });
    const tokens = authService.createTokensForUser(user);
    return success(
      res,
      { user: { id: user._id, email: user.email, name: user.name }, tokens },
      201,
    );
  } catch (err) {
    logger.error("Signup error:", err.message);

    // Handle specific error cases
    if (err.message.includes("User already exists")) {
      return error(
        res,
        "Email already registered. Please login or use a different email.",
        409,
      );
    }

    if (
      err.message.includes("validation failed") ||
      err.name === "ValidationError"
    ) {
      return error(res, "Invalid input: " + err.message, 400);
    }

    // Generic error
    return error(res, "Signup failed. Please try again.", 500);
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return error(res, "Email and password are required", 400);
    }

    const user = await authService.authenticateUser({ email, password });
    if (!user) {
      return error(res, "Invalid email or password", 401);
    }

    const tokens = authService.createTokensForUser(user);
    return success(res, {
      user: { id: user._id, email: user.email, name: user.name },
      tokens,
    });
  } catch (err) {
    logger.error("Login error:", err.message);
    return error(res, "Login failed. Please try again.", 500);
  }
}

export async function refresh(req, res) {
  try {
    const { refreshToken } = req.body;
    const user_id = req.params.user_id;
    if (!refreshToken) return error(res, "Missing refresh token", 400);
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
      logger.debug("Refresh token verified");
    } catch (err) {
      return error(res, "Invalid refresh token", 401, err.message);
    }

    const userId = user_id || payload.sub;
    // ensure user exists
    const user = await User.findById(userId);
    if (!user) return error(res, "User not found", 404);

    // in production, verify refresh token against a store or rotation mechanism
    const tokens = authService.createTokensForUser(user);
    return success(res, { tokens });
  } catch (err) {
    return error(res, "Invalid refresh token", 401, err.message);
  }
}

export async function verify(req, res) {
  // if middleware attached user, just return ok
  const user_id = req.params.user_id;
  if (req.user) {
    // Optionally verify that URL user_id matches authenticated user
    if (user_id && req.user.sub !== user_id) {
      return error(res, "User ID mismatch", 403);
    }
    return success(res, { user: req.user });
  }
  return error(res, "Not authenticated", 401);
}

export default { signup, login, refresh, verify };
