import request from "supertest";
import { jest } from "@jest/globals";
import {
  createAccessToken,
  createRefreshToken,
  createRsaKeyPair,
} from "../mocks/auth.js";
import { createJwksMock, createProxyMiddlewareMock } from "../mocks/proxy.js";

const { publicKey, privateKey } = createRsaKeyPair();
const { factory: proxyFactory } = createProxyMiddlewareMock();
const jwksMock = createJwksMock(publicKey);

jest.unstable_mockModule("jwks-rsa", () => ({
  default: jest.fn(() => jwksMock),
}));

jest.unstable_mockModule("http-proxy-middleware", () => ({
  createProxyMiddleware: proxyFactory,
}));

const { default: app } = await import("../../src/app.js");

describe("api-server gateway", () => {
  let validToken;
  let wrongTypeToken;

  beforeEach(() => {
    jest.clearAllMocks();
    validToken = createAccessToken(privateKey);
    wrongTypeToken = createRefreshToken(privateKey);
  });

  describe("public routes", () => {
    it("GET /health returns gateway health", async () => {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: "ok", role: "gateway" });
    });

    it("POST /auth/login is publicly proxied", async () => {
      const res = await request(app).post("/auth/login");
      expect(res.status).toBe(200);
      expect(res.body.proxied).toBe(true);
      expect(res.body.originalUrl).toBe("/auth/login");
    });
  });

  describe("protected route auth", () => {
    it("rejects missing token", async () => {
      const res = await request(app).get("/profile");
      expect(res.status).toBe(401);
      expect(res.body.message).toContain("Missing Authorization");
    });

    it("rejects malformed bearer token", async () => {
      const res = await request(app)
        .get("/profile")
        .set("Authorization", "Bearer malformed-token");

      expect(res.status).toBe(401);
      expect(res.body.message).toContain("Invalid token");
    });

    it("rejects token with invalid type", async () => {
      const res = await request(app)
        .get("/profile")
        .set("Authorization", `Bearer ${wrongTypeToken}`);

      expect(res.status).toBe(401);
      expect(res.body.details).toContain("Invalid token type");
    });
  });

  describe("protected route proxy rewriting", () => {
    it("rewrites /profile to include subject", async () => {
      const res = await request(app)
        .get("/profile")
        .set("Authorization", `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.rewrittenUrl).toBe("/user123");
    });

    it("keeps query params while injecting user id", async () => {
      const res = await request(app)
        .get("/reminders?page=2&limit=5")
        .set("Authorization", `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.rewrittenUrl).toBe("/user123?page=2&limit=5");
    });

    it("rewrites /analyze to include user id", async () => {
      const res = await request(app)
        .get("/analyze")
        .set("Authorization", `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.rewrittenUrl).toBe("/user123");
    });
  });

  describe("agent chat route rewriting", () => {
    it("GET /chats routes to user-specific upstream path", async () => {
      const res = await request(app)
        .get("/chats")
        .set("Authorization", `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.rewrittenUrl).toBe("/chats/user123");
    });

    it("GET /chats/:chatId/messages routes to user-specific message path", async () => {
      const res = await request(app)
        .get("/chats/chat-1/messages")
        .set("Authorization", `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.rewrittenUrl).toBe("/chats/chat-1/messages/user123");
    });

    it("DELETE /chats/:chatId routes with user ownership", async () => {
      const res = await request(app)
        .delete("/chats/chat-1")
        .set("Authorization", `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.rewrittenUrl).toBe("/chats/chat-1/user123");
    });
  });
});
