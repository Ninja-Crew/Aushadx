/**
 * src/config/env.js
 * Centralized environment configuration for profile-manager.
 */

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: process.env.PORT ? Number(process.env.PORT) : 3000,
  MONGO_URI: process.env.MONGO_URI || "",
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
  JWT_SECRET:
    process.env.JWT_SECRET || "default-secret-key-change-in-production",
  JWT_ACCESS_SECRET:
    process.env.JWT_ACCESS_SECRET ||
    process.env.JWT_SECRET ||
    "default-access-secret-key",
  JWT_REFRESH_SECRET:
    process.env.JWT_REFRESH_SECRET ||
    process.env.JWT_SECRET ||
    "default-refresh-secret-key",
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  OTP_JWT_SECRET:
    process.env.OTP_JWT_SECRET || "otp-secret-key-change-in-production",
  OTP_EXPIRES_IN: process.env.OTP_EXPIRES_IN || "10m",
  // SendGrid email configuration
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY || "",
  SENDGRID_FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL || "noreply@aushadx.com",
  // Optional: provide a JSON string in MONGO_OPTIONS_JSON to pass options to mongoose.connect
  MONGO_OPTIONS: process.env.MONGO_OPTIONS_JSON
    ? JSON.parse(process.env.MONGO_OPTIONS_JSON)
    : undefined,
  MEDICINE_SCHEDULER_URL:
    process.env.MEDICINE_SCHEDULER_URL || "http://medicine-scheduler:3002",
};

export function requireEnv(key) {
  if (!env[key]) {
    throw new Error(`Required environment variable ${key} is missing`);
  }
  return env[key];
}

export default env;
