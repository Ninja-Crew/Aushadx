import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";
import { generateKeyPairSync } from "crypto";
import { jest } from "@jest/globals";

// Generate keys for testing
const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

// Mock jwks-rsa
jest.unstable_mockModule("jwks-rsa", () => ({
  default: jest.fn(() => ({
    getSigningKey: jest.fn((kid, cb) => {
      // Return the public key wrapped in an object as expected by getSigningKey
      cb(null, { getPublicKey: () => publicKey });
    }),
  })),
}));

// Mock the proxy middleware for ESM
jest.unstable_mockModule("http-proxy-middleware", () => ({
  createProxyMiddleware: jest.fn(() => (req, res, next) => {
    res.status(200).json({ proxied: true, path: req.originalUrl, url: req.url, headers: req.headers });
  }),
}));

process.env.JWT_PUBLIC_KEY = publicKey; // Kept just in case, though likely unused

// Dynamic import after mocking
const { default: app } = await import("../src/app.js");

describe("API Gateway Auth Rules", () => {
  let validToken;

  beforeAll(() => {
    validToken = jwt.sign({ sub: "user123", roles: ["user"] }, privateKey, {
      algorithm: "RS256",
      expiresIn: "1h",
    });
  });

  describe("Public Routes", () => {
    it("GET /health should be public", async () => {
      const res = await request(app).get("/health");
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe("ok");
    });

    it("POST /auth/login should be public (proxied)", async () => {
      const res = await request(app).post("/auth/login");
      // status 200 because we mocked the proxy to return 200
      expect(res.statusCode).toBe(200); 
      expect(res.body.proxied).toBe(true);
    });

    it("POST /auth/signup should be public (proxied)", async () => {
      const res = await request(app).post("/auth/signup");
      expect(res.statusCode).toBe(200);
      expect(res.body.proxied).toBe(true);
    });
  });

  describe("Protected Routes", () => {
    const protectedPaths = [
      "/profile/123",
      "/reminders",
      "/analyze",
    ];

    protectedPaths.forEach((path) => {
      it(`should reject ${path} without token`, async () => {
        const res = await request(app).get(path); // Method doesn't matter for auth check usually
        expect(res.statusCode).toBe(401);
      });

      it(`should accept ${path} with valid token`, async () => {
        const res = await request(app)
          .get(path)
          .set("Authorization", `Bearer ${validToken}`);
        
        expect(res.statusCode).toBe(200);
        expect(res.body.proxied).toBe(true);
        // Verify userId injected into URL
        expect(res.body.url).toContain("/user123");
      });
    });
  });
});
