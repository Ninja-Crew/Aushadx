import jwt from "jsonwebtoken";
import env from "../config/env.js";
import logger from "../config/logger.js";

/**
 * Generate a random 6-digit OTP
 */
export function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Create a signed OTP token (stateless)
 * Token contains: otp, email, purpose (email-verification or password-reset)
 */
export function createOTPToken(otp, email, purpose = "email-verification") {
  try {
    const token = jwt.sign(
      {
        otp,
        email,
        purpose,
        iat: Math.floor(Date.now() / 1000),
      },
      env.OTP_JWT_SECRET,
      { expiresIn: env.OTP_EXPIRES_IN },
    );
    return token;
  } catch (err) {
    logger.error("Error creating OTP token:", err);
    throw err;
  }
}

/**
 * Verify OTP against the token
 * Returns: { valid: boolean, email: string, purpose: string }
 */
export function verifyOTPToken(token, userProvidedOTP) {
  try {
    const decoded = jwt.verify(token, env.OTP_JWT_SECRET);

    // Check if OTP matches
    if (decoded.otp !== userProvidedOTP) {
      return { valid: false, reason: "Invalid OTP" };
    }

    return {
      valid: true,
      email: decoded.email,
      purpose: decoded.purpose,
    };
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return { valid: false, reason: "OTP expired" };
    }
    logger.error("Error verifying OTP token:", err);
    return { valid: false, reason: "Invalid token" };
  }
}

export default {
  generateOTP,
  createOTPToken,
  verifyOTPToken,
};
