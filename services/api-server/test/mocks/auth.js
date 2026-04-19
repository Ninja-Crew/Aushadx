import jwt from "jsonwebtoken";
import { generateKeyPairSync } from "crypto";

export function createRsaKeyPair() {
  return generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
}

export function createAccessToken(privateKey, overrides = {}) {
  const payload = {
    sub: "user123",
    roles: ["user"],
    type: "access",
    ...overrides,
  };
  return jwt.sign(payload, privateKey, {
    algorithm: "RS256",
    expiresIn: "1h",
    keyid: "test-kid",
  });
}

export function createRefreshToken(privateKey, overrides = {}) {
  const payload = {
    sub: "user123",
    type: "refresh",
    ...overrides,
  };
  return jwt.sign(payload, privateKey, {
    algorithm: "RS256",
    expiresIn: "1h",
    keyid: "test-kid",
  });
}
