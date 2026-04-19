import { describe, it, expect, beforeEach, jest } from "@jest/globals";

const jwtVerifyMock = jest.fn();
const getSigningKeyMock = jest.fn((kid, cb) =>
  cb(null, { getPublicKey: () => "PUBLIC_KEY" }),
);

jest.unstable_mockModule("jsonwebtoken", () => ({
  default: {
    verify: jwtVerifyMock,
  },
}));

jest.unstable_mockModule("jwks-rsa", () => ({
  default: jest.fn(() => ({
    getSigningKey: getSigningKeyMock,
  })),
}));

const { default: verifyToken, verifyJWT } =
  await import("../../src/middleware/verifyToken.js");

function createReq(headers = {}) {
  return { headers };
}

function createRes() {
  return {
    code: 200,
    body: null,
    status(code) {
      this.code = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe("verifyToken middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("verifyJWT resolves decoded access token", async () => {
    jwtVerifyMock.mockImplementation((_token, _keyProvider, _opts, cb) => {
      cb(null, { sub: "user-1", type: "access" });
    });

    const decoded = await verifyJWT("valid-token");

    expect(decoded.sub).toBe("user-1");
  });

  it("verifyJWT rejects token type mismatch", async () => {
    jwtVerifyMock.mockImplementation((_token, _keyProvider, _opts, cb) => {
      cb(null, { sub: "user-1", type: "refresh" });
    });

    await expect(verifyJWT("refresh-token")).rejects.toThrow(
      "Invalid token type",
    );
  });

  it("returns 401 when auth header is missing", async () => {
    const req = createReq();
    const res = createRes();
    const next = jest.fn();

    verifyToken(req, res, next);

    expect(res.code).toBe(401);
    expect(res.body.message).toContain("Missing Authorization");
    expect(next).not.toHaveBeenCalled();
  });

  it("sets req.user and calls next for valid token", async () => {
    jwtVerifyMock.mockImplementation((_token, _keyProvider, _opts, cb) => {
      cb(null, { sub: "user-1", roles: ["user"], type: "access" });
    });

    const req = createReq({ authorization: "Bearer valid-token" });
    const res = createRes();
    const next = jest.fn();

    verifyToken(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(req.user.sub).toBe("user-1");
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("returns 401 when jwt verification fails", async () => {
    jwtVerifyMock.mockImplementation((_token, _keyProvider, _opts, cb) => {
      cb(new Error("jwt malformed"));
    });

    const req = createReq({ authorization: "Bearer bad-token" });
    const res = createRes();
    const next = jest.fn();

    verifyToken(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(res.code).toBe(401);
    expect(res.body.message).toContain("Invalid token");
    expect(next).not.toHaveBeenCalled();
  });
});
