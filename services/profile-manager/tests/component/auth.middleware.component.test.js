import express from "express";
import request from "supertest";
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createLoggerMock } from "../mocks/services.js";

const jwtMock = { verifyAccessToken: jest.fn() };
const loggerMock = createLoggerMock();

jest.unstable_mockModule("../../src/utils/jwt.js", () => jwtMock);
jest.unstable_mockModule("../../src/config/logger.js", () => ({
  default: loggerMock,
}));

const { default: authMiddleware } =
  await import("../../src/middleware/authMiddleware.js");

function createApp() {
  const app = express();
  app.get("/component/protected", authMiddleware, (req, res) => {
    res.status(200).json({ success: true, user: req.user });
  });
  return app;
}

describe("auth middleware component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("authenticates with gateway headers", async () => {
    const response = await request(createApp())
      .get("/component/protected")
      .set("x-user-id", "gateway-user")
      .set("x-user-roles", JSON.stringify(["user"]));

    expect(response.status).toBe(200);
    expect(response.body.user.sub).toBe("gateway-user");
    expect(response.body.user.roles).toEqual(["user"]);
  });

  it("authenticates with bearer token fallback", async () => {
    jwtMock.verifyAccessToken.mockReturnValue({
      sub: "token-user",
      roles: ["admin"],
    });

    const response = await request(createApp())
      .get("/component/protected")
      .set("Authorization", "Bearer token-123");

    expect(response.status).toBe(200);
    expect(response.body.user.sub).toBe("token-user");
  });

  it("returns 401 when token verification fails", async () => {
    jwtMock.verifyAccessToken.mockImplementation(() => {
      throw new Error("invalid");
    });

    const response = await request(createApp())
      .get("/component/protected")
      .set("Authorization", "Bearer invalid-token");

    expect(response.status).toBe(401);
    expect(response.body.message).toContain("Invalid token");
  });
});
