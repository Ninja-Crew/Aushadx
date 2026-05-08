import sgMail from "@sendgrid/mail";
import env from "../config/env.js";
import logger from "../config/logger.js";

/**
 * Initialize SendGrid client
 */
export function initTwilio() {
  if (!env.SENDGRID_API_KEY) {
    logger.warn(
      "SENDGRID_API_KEY not configured – OTP emails will be logged only (dev mode)",
    );
    return;
  }
  sgMail.setApiKey(env.SENDGRID_API_KEY);
  logger.info("SendGrid email client initialized");
}

/**
 * Send OTP via email using SendGrid
 */
export async function sendOTPEmail(email, otp, purpose = "email-verification") {
  if (!env.SENDGRID_API_KEY) {
    logger.warn("SendGrid not configured, skipping email send");
    logger.info(`[DEV MODE] OTP for ${email}: ${otp}`);
    return { success: true, message: "OTP sent (dev mode)" };
  }

  const subject =
    purpose === "password-reset"
      ? "AushadX – Password Reset OTP"
      : "AushadX – Email Verification OTP";

  const htmlBody = `
    <h2>${subject}</h2>
    <p>Hello,</p>
    <p>Your one-time password (OTP) for ${
      purpose === "password-reset"
        ? "resetting your password"
        : "verifying your email"
    } is:</p>
    <h3 style="color: #007bff; font-size: 24px; letter-spacing: 2px;">${otp}</h3>
    <p>This OTP is valid for 10 minutes.</p>
    <p>If you didn't request this, please ignore this email.</p>
    <p>Best regards,<br/>AushadX Team</p>
  `;

  const textBody = `Your ${subject}: ${otp}. Valid for 10 minutes. If you didn't request this, please ignore this email.`;

  const msg = {
    to: email,
    from: env.SENDGRID_FROM_EMAIL,
    subject,
    text: textBody,
    html: htmlBody,
  };

  try {
    await sgMail.send(msg);
    logger.info(`OTP email sent to ${email}`);
    return { success: true };
  } catch (err) {
    logger.error("Error sending OTP email:", err);
    throw new Error("Failed to send OTP email: " + err.message);
  }
}

export default {
  initTwilio,
  sendOTPEmail,
};
