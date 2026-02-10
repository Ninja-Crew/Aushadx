import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";
import { generateKeyPairSync } from "crypto";
import { jest } from "@jest/globals";

// Mock the proxy middleware to avoid actual network calls or 504s
jest.mock("http-proxy-middleware", () => ({
  createProxyMiddleware: jest.fn(() => (req, res, next) => {
    res.status(200).json({ proxied: true, path: req.originalUrl, headers: req.headers });
  }),
}));

// Generate keys for testing
const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

process.env.JWT_PUBLIC_KEY = publicKey;

// Import app AFTER setting env and mocking
import app from "../src/app.js";

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
        // Verify X-User-Id header logic if possible?
        // The mock proxy prints headers, but http-proxy-middleware `onProxyReq` logic 
        // happens *inside* the real middleware which we mocked OUT.
        // So we can't easily test `onProxyReq` logic with this mock.
        // But we verified the "Gate" works.
      });
    });
  });
});
