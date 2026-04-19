import { generateKeyPairSync } from "crypto";
import jwt from "jsonwebtoken";
import request from "supertest";
import http from "http";

function generateKeys() {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { publicKey, privateKey };
}

describe("Auth Integration Tests", () => {
  let privateKey;
  let publicKey;
  let app;
  let validToken;
  let profileServer;

  beforeAll(async () => {
    const keys = generateKeys();
    publicKey = keys.publicKey;
    privateKey = keys.privateKey;

    process.env.JWT_PUBLIC_KEY = publicKey;
    process.env.JWKS_URI = "http://127.0.0.1:3002/.well-known/jwks.json";
    process.env.PROFILE_SERVICE_URL = "http://127.0.0.1:3002"; // use 3002 to avoid port conflict

    profileServer = http.createServer((req, res) => {
      if (req.url.startsWith("/profile/")) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise(resolve => profileServer.listen(3002, "127.0.0.1", resolve));
    
    // Mock jwks-rsa before importing app
    const { jest } = await import("@jest/globals");
    jest.unstable_mockModule("jwks-rsa", () => ({
      default: jest.fn(() => ({
        getSigningKey: (kid, cb) => cb(null, { getPublicKey: () => publicKey })
      }))
    }));

    // dynamically import app after setting env var and mocks
    const imported = await import("../../src/app.js");
    app = imported.default;

    const payload = {
      sub: "test-user-id",
      email: "test@example.com",
      roles: ["user"],
      type: "access"
    };
    validToken = jwt.sign(payload, privateKey, {
      algorithm: "RS256",
      expiresIn: "1h",
      keyid: "mock-kid"
    });
  });
  
  afterAll((done) => {
    profileServer.close(done);
  });

  it("should accept valid token and proxy to profile", async () => {
    const res = await request(app)
      .get("/profile/test-user-id")
      .set("Authorization", `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
