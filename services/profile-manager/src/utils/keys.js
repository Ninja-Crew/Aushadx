import jose from "node-jose";
import fs from "fs";
import path from "path";
import logger from "../config/logger.js";

const KEYSTORE_PATH = path.resolve("keystore.json");
let keystore;

export async function initKeystore() {
  try {
    if (fs.existsSync(KEYSTORE_PATH)) {
      const ksData = fs.readFileSync(KEYSTORE_PATH, "utf8");
      keystore = await jose.JWK.asKeyStore(ksData);
      logger.info("Loaded keystore from disk");
    } else {
      keystore = jose.JWK.createKeyStore();
      await rotateKey(); // Generate first key
      logger.info("Created new keystore");
    }
  } catch (err) {
    logger.error("Failed to initialize keystore", err);
    throw err;
  }
}

export async function rotateKey() {
  try {
    const key = await keystore.generate("RSA", 2048, {
      alg: "RS256",
      use: "sig",
    });
    logger.info(`Generated new RSA key: ${key.kid}`);
    saveKeystore();
    return key;
  } catch (err) {
    logger.error("Failed to rotate key", err);
  }
}

function saveKeystore() {
  const json = keystore.toJSON(true);
  fs.writeFileSync(KEYSTORE_PATH, JSON.stringify(json, null, 2));
}

export function getJWKS() {
  // Return public keys only
  return keystore.toJSON();
}

export function getSigningKey() {
  // Get the most recently added key (last in the array usually, or we can track it)
  // node-jose stores keys in order.
  const all = keystore.all({ use: "sig", alg: "RS256" });
  if (all.length === 0) throw new Error("No signing keys available");
  // Assuming the last one is the newest
  return all[all.length - 1];
}

export function startRotationSchedule(intervalMs = 24 * 60 * 60 * 1000) {
    logger.info(`Starting key rotation schedule (every ${intervalMs}ms)`);
    setInterval(async () => {
        logger.info("Auto-rotating keys...");
        await rotateKey();
    }, intervalMs);
}

export default {
  initKeystore,
  rotateKey,
  getJWKS,
  getSigningKey,
  startRotationSchedule
};
