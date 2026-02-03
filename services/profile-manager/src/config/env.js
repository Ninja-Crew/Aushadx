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
  // Optional: provide a JSON string in MONGO_OPTIONS_JSON to pass options to mongoose.connect
  MONGO_OPTIONS: process.env.MONGO_OPTIONS_JSON
    ? JSON.parse(process.env.MONGO_OPTIONS_JSON)
    : undefined,
};

export function requireEnv(key) {
  if (!env[key]) {
    throw new Error(`Required environment variable ${key} is missing`);
  }
  return env[key];
}

export default env;
