import jwt from "jsonwebtoken";
import env from "../config/env.js";

const ACCESS_SECRET =
  process.env.JWT_SECRET ||
  process.env.JWT_ACCESS_SECRET ||
  env.JWT_ACCESS_SECRET ||
  env.JWT_SECRET;
const REFRESH_SECRET =
  process.env.JWT_SECRET ||
  process.env.JWT_REFRESH_SECRET ||
  env.JWT_REFRESH_SECRET ||
  env.JWT_SECRET;

const ACCESS_EXPIRES_IN =
  process.env.JWT_ACCESS_EXPIRES_IN || env.JWT_ACCESS_EXPIRES_IN || "15m";
const REFRESH_EXPIRES_IN =
  process.env.JWT_REFRESH_EXPIRES_IN || env.JWT_REFRESH_EXPIRES_IN || "7d";

function ensureSecret(name, value) {
  if (!value)
    throw new Error(`JWT secret not provided: set ${name} or JWT_SECRET`);
}

export function signAccessToken(payload) {
  ensureSecret("JWT_ACCESS_SECRET or JWT_SECRET", ACCESS_SECRET);
  return jwt.sign(payload, ACCESS_SECRET, {
    algorithm: "HS256",
    expiresIn: ACCESS_EXPIRES_IN,
  });
}

export function signRefreshToken(payload) {
  ensureSecret("JWT_REFRESH_SECRET or JWT_SECRET", REFRESH_SECRET);
  return jwt.sign(payload, REFRESH_SECRET, {
    algorithm: "HS256",
    expiresIn: REFRESH_EXPIRES_IN,
  });
}

export function verifyAccessToken(token) {
  ensureSecret("JWT_ACCESS_SECRET or JWT_SECRET", ACCESS_SECRET);
  return jwt.verify(token, ACCESS_SECRET, { algorithms: ["HS256"] });
}

export function verifyRefreshToken(token) {
  ensureSecret("JWT_REFRESH_SECRET or JWT_SECRET", REFRESH_SECRET);
  return jwt.verify(token, REFRESH_SECRET, { algorithms: ["HS256"] });
}

export function decode(token) {
  return jwt.decode(token);
}

export default {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  decode,
};
