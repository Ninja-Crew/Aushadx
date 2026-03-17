import * as authService from "../services/authService.js";
import * as otpService from "../services/otpService.js";
import * as twilioService from "../services/twilioService.js";
import { success, error } from "../utils/response.js";
import { verifyRefreshToken } from "../utils/jwt.js";
import logger from "../config/logger.js";
import User from "../models/User.js";
import { hashPassword } from "../utils/password.js";

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
    const refreshToken = req.body.refreshToken;
    if (!refreshToken) return error(res, "Missing refresh token", 400);
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
      logger.debug("Refresh token verified");
    } catch (err) {
      return error(res, "Invalid refresh token", 401, err.message);
    }

    const userId = payload.sub;
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

/**
 * Request OTP for email verification during registration
 * POST /auth/request-otp
 * Body: { email, password, name }
 * Returns: { otpToken, message, expiresIn }
 */
export async function requestOTP(req, res) {
  try {
    const { email, password, name } = req.body;

    // Validate input
    if (!email || !password || !name) {
      return error(res, "Email, password, and name are required", 400);
    }

    // Check if email already registered
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return error(res, "Email already registered. Please login.", 409);
    }

    // Generate OTP
    const otp = otpService.generateOTP();
    logger.info(`OTP generated for ${email}: ${otp}`);

    // Send OTP via email
    try {
      await twilioService.sendOTPEmail(email, otp, "email-verification");
    } catch (emailErr) {
      logger.error("Failed to send OTP email:", emailErr);
      return error(res, "Failed to send OTP. Please try again.", 500);
    }

    // Create OTP token (stateless)
    const otpToken = otpService.createOTPToken(
      otp,
      email,
      "email-verification",
    );

    // Store password temporarily in the token payload (will be hashed after verification)
    // Note: We're assuming secure transport (HTTPS)
    return success(
      res,
      {
        otpToken,
        message: "OTP sent to your email",
        expiresIn: "10 minutes",
        email: email, // Send back for UI confirmation
      },
      200,
    );
  } catch (err) {
    logger.error("Request OTP error:", err.message);
    return error(res, "Failed to request OTP. Please try again.", 500);
  }
}

/**
 * Verify OTP and complete registration
 * POST /auth/verify-otp
 * Body: { email, password, name, otpToken, otp }
 * Returns: { user, tokens }
 */
export async function verifyOTP(req, res) {
  try {
    const { email, password, name, otpToken, otp } = req.body;

    // Validate input
    if (!email || !password || !name || !otpToken || !otp) {
      return error(res, "All fields are required", 400);
    }

    // Verify OTP token and OTP
    const verification = otpService.verifyOTPToken(otpToken, otp);
    if (!verification.valid) {
      return error(res, `OTP verification failed: ${verification.reason}`, 401);
    }

    // Ensure email in token matches request
    if (verification.email.toLowerCase() !== email.toLowerCase()) {
      return error(res, "Email mismatch", 400);
    }

    // Check if email was already registered (race condition check)
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return error(res, "Email already registered. Please login.", 409);
    }

    // Create user
    const user = await authService.registerUser({ email, password, name });

    // Mark email as verified
    user.emailVerified = true;
    await user.save();

    // Create tokens
    const tokens = authService.createTokensForUser(user);

    return success(
      res,
      {
        user: { id: user._id, email: user.email, name: user.name },
        tokens,
        message: "Email verified successfully",
      },
      201,
    );
  } catch (err) {
    logger.error("Verify OTP error:", err.message);

    if (err.message.includes("User already exists")) {
      return error(res, "Email already registered. Please login.", 409);
    }

    return error(res, "OTP verification failed. Please try again.", 500);
  }
}

/**
 * Request OTP for password reset
 * POST /auth/forgot-password
 * Body: { email }
 * Returns: { otpToken, message, expiresIn }
 */
export async function forgotPassword(req, res) {
  try {
    const { email } = req.body;

    // Validate input
    if (!email) {
      return error(res, "Email is required", 400);
    }

    // Check if user exists
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // User requested explicit feedback on whether the email is registered
      return error(res, "Email not found. Please check and try again.", 404);
    }

    // Generate OTP
    const otp = otpService.generateOTP();
    logger.info(`Password reset OTP generated for ${email}: ${otp}`);

    // Send OTP via email
    try {
      await twilioService.sendOTPEmail(email, otp, "password-reset");
    } catch (emailErr) {
      logger.error("Failed to send password reset OTP:", emailErr);
      return error(res, "Failed to send OTP. Please try again.", 500);
    }

    // Create OTP token (stateless)
    const otpToken = otpService.createOTPToken(otp, email, "password-reset");

    return success(
      res,
      {
        otpToken,
        message: "OTP sent to your email",
        expiresIn: "10 minutes",
        email: email,
      },
      200,
    );
  } catch (err) {
    logger.error("Forgot password error:", err.message);
    return error(
      res,
      "Failed to process forgot password. Please try again.",
      500,
    );
  }
}

/**
 * Reset password using the 10m authorized session token
 * POST /auth/reset-password
 * Body: { email, newPassword, resetSessionToken }
 * Returns: { message }
 */
export async function resetPassword(req, res) {
  try {
    const { email, newPassword, resetSessionToken } = req.body;

    // Validate input
    if (!email || !newPassword || !resetSessionToken) {
      return error(res, "All fields are required", 400);
    }

    // Verify the authorized session token
    const verification = otpService.verifyOTPToken(resetSessionToken, "AUTHORIZED");
    if (!verification.valid) {
      if (verification.reason === "OTP expired") {
        return error(res, "Password reset session has expired (exceeded 10 minutes). Please request a new OTP.", 401);
      }
      return error(res, `Session verification failed: ${verification.reason}`, 401);
    }

    // Ensure email in token matches request
    if (verification.email.toLowerCase() !== email.toLowerCase()) {
      return error(res, "Email mismatch", 400);
    }

    // Ensure purpose is password-reset-authorized
    if (verification.purpose !== "password-reset-authorized") {
      return error(res, "Invalid session token purpose", 400);
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return error(res, "User not found", 404);
    }

    // Hash and update password
    const hashedPassword = await hashPassword(newPassword);
    user.password = hashedPassword;
    await user.save();

    logger.info(`Password reset for ${email}`);

    return success(
      res,
      {
        message: "Password reset successfully",
      },
      200,
    );
  } catch (err) {
    logger.error("Reset password error:", err.message);
    return error(res, "Failed to reset password. Please try again.", 500);
  }
}

/**
 * Verify OTP for password reset and return a 10m authorized session token
 * POST /auth/verify-reset-otp
 * Body: { email, otpToken, otp }
 * Returns: { resetSessionToken, message }
 */
export async function verifyResetOTP(req, res) {
  try {
    const { email, otpToken, otp } = req.body;

    // Validate input
    if (!email || !otpToken || !otp) {
      return error(res, "All fields are required", 400);
    }

    // Verify OTP token and OTP
    const verification = otpService.verifyOTPToken(otpToken, otp);
    if (!verification.valid) {
      return error(res, `OTP verification failed: ${verification.reason}`, 401);
    }

    // Ensure email in token matches request
    if (verification.email.toLowerCase() !== email.toLowerCase()) {
      return error(res, "Email mismatch", 400);
    }

    // Ensure purpose is password-reset
    if (verification.purpose !== "password-reset") {
      return error(res, "Invalid OTP token purpose", 400);
    }

    // Find user to make sure they exist
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return error(res, "User not found", 404);
    }

    // Generate a new 10-minute JWT token for the actual password reset step
    // OTP field is meaningless here, so we put a dummy string "AUTHORIZED"
    const resetSessionToken = otpService.createOTPToken(
      "AUTHORIZED",
      email,
      "password-reset-authorized",
    );

    return success(
      res,
      {
        resetSessionToken,
        message: "OTP verified successfully. Proceed to reset password.",
      },
      200,
    );
  } catch (err) {
    logger.error("Verify reset OTP error:", err.message);
    return error(res, "Failed to verify OTP. Please try again.", 500);
  }
}

export default {
  signup,
  login,
  refresh,
  verify,
  requestOTP,
  verifyOTP,
  forgotPassword,
  verifyResetOTP,
  resetPassword,
};
