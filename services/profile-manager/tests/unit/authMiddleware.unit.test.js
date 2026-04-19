import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockReq, createMockRes } from "../mocks/http.js";
import { createLoggerMock } from "../mocks/services.js";

const jwtMock = { verifyAccessToken: jest.fn() };
const loggerMock = createLoggerMock();

jest.unstable_mockModule("../../src/utils/jwt.js", () => jwtMock);
jest.unstable_mockModule("../../src/config/logger.js", () => ({
  default: loggerMock,
}));

const { default: authMiddleware } =
  await import("../../src/middleware/authMiddleware.js");

describe("authMiddleware unit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("trusts gateway headers and calls next", () => {
    const req = createMockReq({
      headers: {
        "x-user-id": "u1",
        "x-user-roles": JSON.stringify(["user"]),
      },
    });
    const res = createMockRes();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(req.user).toEqual({ sub: "u1", id: "u1", roles: ["user"] });
    expect(next).toHaveBeenCalled();
  });

  it("returns 401 when authorization header is missing", () => {
    const req = createMockReq();
    const res = createMockRes();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toContain("Missing Authorization header");
    expect(next).not.toHaveBeenCalled();
  });

  it("verifies bearer token and calls next", () => {
    const req = createMockReq({
      headers: { authorization: "Bearer token-123" },
    });
    const res = createMockRes();
    const next = jest.fn();
    jwtMock.verifyAccessToken.mockReturnValue({
      sub: "u1",
      email: "john@example.com",
    });

    authMiddleware(req, res, next);

    expect(req.user.sub).toBe("u1");
    expect(next).toHaveBeenCalled();
  });

  it("returns 401 for invalid token", () => {
    const req = createMockReq({
      headers: { Authorization: "Bearer invalid" },
    });
    const res = createMockRes();
    const next = jest.fn();
    jwtMock.verifyAccessToken.mockImplementation(() => {
      throw new Error("bad token");
    });

    authMiddleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toContain("Invalid token");
    expect(loggerMock.error).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
