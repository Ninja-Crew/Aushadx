import jwt from "jsonwebtoken";
import env from "../config/env.js";
import { getSigningKey } from "./keys.js";

const ACCESS_EXPIRES_IN =
  process.env.JWT_ACCESS_EXPIRES_IN || env.JWT_ACCESS_EXPIRES_IN || "15m";
const REFRESH_EXPIRES_IN =
  process.env.JWT_REFRESH_EXPIRES_IN || env.JWT_REFRESH_EXPIRES_IN || "7d";

export function signAccessToken(payload) {
  const key = getSigningKey();
  const options = {
    algorithm: "RS256",
    expiresIn: ACCESS_EXPIRES_IN,
    header: {
      kid: key.kid,
    },
  };
  return jwt.sign(payload, key.toPEM(true), options);
}

export function signRefreshToken(payload) {
  const key = getSigningKey();
  const options = {
    algorithm: "RS256",
    expiresIn: REFRESH_EXPIRES_IN,
    header: {
      kid: key.kid,
    },
  };
  return jwt.sign(payload, key.toPEM(true), options);
}

export function verifyAccessToken(token) {
  // For internal use, verification can be done via node-jose or public key
  // Here we just use jwt.verify with the public key of the signing key (simplification)
  // In a real scenario, we should look up key by kid from the keystore.
  // However, Profile Manager is the issuer, so it has access to the keys.
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || !decoded.header.kid) throw new Error("Invalid token");
  
  const key = getSigningKey(); // Ideally find by kid
  // For now, let's assume we verify against *current* signing key or we can implement find by kid later if needed for rotation support internal
  return jwt.verify(token, key.toPEM(false), { algorithms: ["RS256"] });
}

export function verifyRefreshToken(token) {
   const decoded = jwt.decode(token, { complete: true });
  if (!decoded || !decoded.header.kid) throw new Error("Invalid token");
  
  const key = getSigningKey(); 
  return jwt.verify(token, key.toPEM(false), { algorithms: ["RS256"] });
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
