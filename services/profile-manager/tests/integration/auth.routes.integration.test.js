import express from "express";
import request from "supertest";
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import {
  createAuthServiceMock,
  createOtpServiceMock,
  createTwilioServiceMock,
  createUserModelMock,
  createLoggerMock,
} from "../mocks/services.js";
import { fixtures } from "../mocks/fixtures.js";

const authServiceMock = createAuthServiceMock();
const otpServiceMock = createOtpServiceMock();
const twilioServiceMock = createTwilioServiceMock();
const userModelMock = createUserModelMock();
const loggerMock = createLoggerMock();
const jwtMock = { verifyRefreshToken: jest.fn() };
const passwordMock = { hashPassword: jest.fn() };

jest.unstable_mockModule(
  "../../src/services/authService.js",
  () => authServiceMock,
);
jest.unstable_mockModule(
  "../../src/services/otpService.js",
  () => otpServiceMock,
);
jest.unstable_mockModule(
  "../../src/services/twilioService.js",
  () => twilioServiceMock,
);
jest.unstable_mockModule("../../src/models/User.js", () => ({
  default: userModelMock,
}));
jest.unstable_mockModule("../../src/config/logger.js", () => ({
  default: loggerMock,
}));
jest.unstable_mockModule("../../src/utils/jwt.js", () => jwtMock);
jest.unstable_mockModule("../../src/utils/password.js", () => passwordMock);

const { default: authRoutes } = await import("../../src/routes/authRoutes.js");

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/auth", authRoutes);
  return app;
}

describe("auth routes integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("POST /auth/signup returns 201 for valid payload", async () => {
    authServiceMock.registerUser.mockResolvedValue(fixtures.user);
    authServiceMock.createTokensForUser.mockReturnValue({
      access: "access",
      refresh: "refresh",
    });

    const response = await request(createApp())
      .post("/auth/signup")
      .send(fixtures.signupBody);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.tokens.refresh).toBe("refresh");
  });

  it("POST /auth/login returns 401 for invalid credentials", async () => {
    authServiceMock.authenticateUser.mockResolvedValue(null);

    const response = await request(createApp())
      .post("/auth/login")
      .send(fixtures.loginBody);

    expect(response.status).toBe(401);
    expect(response.body.message).toContain("Invalid email or password");
  });

  it("POST /auth/refresh returns 200 with new tokens", async () => {
    jwtMock.verifyRefreshToken.mockReturnValue({ sub: fixtures.userId });
    userModelMock.findById.mockResolvedValue(fixtures.user);
    authServiceMock.createTokensForUser.mockReturnValue({
      access: "next-access",
      refresh: "next-refresh",
    });

    const response = await request(createApp())
      .post("/auth/refresh")
      .send({ refreshToken: "valid-refresh" });

    expect(response.status).toBe(200);
    expect(response.body.data.tokens.access).toBe("next-access");
  });

  it("POST /auth/request-otp returns 200 when OTP email is sent", async () => {
    userModelMock.findOne.mockResolvedValue(null);
    otpServiceMock.generateOTP.mockReturnValue("123456");
    otpServiceMock.createOTPToken.mockReturnValue("otp-token");
    twilioServiceMock.sendOTPEmail.mockResolvedValue({ success: true });

    const response = await request(createApp())
      .post("/auth/request-otp")
      .send(fixtures.signupBody);

    expect(response.status).toBe(200);
    expect(response.body.data.otpToken).toBe("otp-token");
  });

  it("POST /auth/verify-reset-otp returns reset session token", async () => {
    otpServiceMock.verifyOTPToken.mockReturnValue({
      valid: true,
      email: fixtures.user.email,
      purpose: "password-reset",
    });
    otpServiceMock.createOTPToken.mockReturnValue("reset-session");
    userModelMock.findOne.mockResolvedValue(fixtures.user);

    const response = await request(createApp())
      .post("/auth/verify-reset-otp")
      .send({
        email: fixtures.user.email,
        otpToken: "otp-token",
        otp: "123456",
      });

    expect(response.status).toBe(200);
    expect(response.body.data.resetSessionToken).toBe("reset-session");
  });
});
