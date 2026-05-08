import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockReq, createMockRes } from "../mocks/http.js";
import { fixtures } from "../mocks/fixtures.js";
import {
  createAuthServiceMock,
  createOtpServiceMock,
  createTwilioServiceMock,
  createUserModelMock,
  createLoggerMock,
} from "../mocks/services.js";

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
jest.unstable_mockModule("../../src/utils/jwt.js", () => jwtMock);
jest.unstable_mockModule("../../src/models/User.js", () => ({
  default: userModelMock,
}));
jest.unstable_mockModule("../../src/config/logger.js", () => ({
  default: loggerMock,
}));
jest.unstable_mockModule("../../src/utils/password.js", () => passwordMock);

const authController = await import("../../src/controllers/authController.js");

function expectSuccess(res, statusCode) {
  expect(res.statusCode).toBe(statusCode);
  expect(res.body.success).toBe(true);
}

function expectError(res, statusCode, message) {
  expect(res.statusCode).toBe(statusCode);
  expect(res.body.success).toBe(false);
  expect(res.body.message).toContain(message);
}

describe("authController unit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("signup returns 400 when required fields are missing", async () => {
    const req = createMockReq({ body: { email: "john@example.com" } });
    const res = createMockRes();

    await authController.signup(req, res);

    expectError(res, 400, "required");
  });

  it("signup returns 201 with user and tokens", async () => {
    const req = createMockReq({ body: fixtures.signupBody });
    const res = createMockRes();
    authServiceMock.registerUser.mockResolvedValue(fixtures.user);
    authServiceMock.createTokensForUser.mockReturnValue({
      access: "access-token",
      refresh: "refresh-token",
    });

    await authController.signup(req, res);

    expectSuccess(res, 201);
    expect(res.body.data.user.email).toBe(fixtures.user.email);
    expect(authServiceMock.registerUser).toHaveBeenCalledWith(
      fixtures.signupBody,
    );
  });

  it("signup returns 409 when user already exists", async () => {
    const req = createMockReq({ body: fixtures.signupBody });
    const res = createMockRes();
    authServiceMock.registerUser.mockRejectedValue(
      new Error("User already exists"),
    );

    await authController.signup(req, res);

    expectError(res, 409, "Email already registered");
  });

  it("login returns 400 for missing credentials", async () => {
    const req = createMockReq({ body: { email: fixtures.loginBody.email } });
    const res = createMockRes();

    await authController.login(req, res);

    expectError(res, 400, "required");
  });

  it("login returns 401 for invalid credentials", async () => {
    const req = createMockReq({ body: fixtures.loginBody });
    const res = createMockRes();
    authServiceMock.authenticateUser.mockResolvedValue(null);

    await authController.login(req, res);

    expectError(res, 401, "Invalid email or password");
  });

  it("login returns tokens for valid credentials", async () => {
    const req = createMockReq({ body: fixtures.loginBody });
    const res = createMockRes();
    authServiceMock.authenticateUser.mockResolvedValue(fixtures.user);
    authServiceMock.createTokensForUser.mockReturnValue({
      access: "access-token",
      refresh: "refresh-token",
    });

    await authController.login(req, res);

    expectSuccess(res, 200);
    expect(res.body.data.tokens.access).toBe("access-token");
  });

  it("refresh returns 400 when token is missing", async () => {
    const req = createMockReq({ body: {} });
    const res = createMockRes();

    await authController.refresh(req, res);

    expectError(res, 400, "Missing refresh token");
  });

  it("refresh returns 404 when user does not exist", async () => {
    const req = createMockReq({ body: { refreshToken: "valid-token" } });
    const res = createMockRes();
    jwtMock.verifyRefreshToken.mockReturnValue({ sub: fixtures.userId });
    userModelMock.findById.mockResolvedValue(null);

    await authController.refresh(req, res);

    expectError(res, 404, "User not found");
  });

  it("refresh returns new tokens for valid refresh token", async () => {
    const req = createMockReq({ body: { refreshToken: "valid-token" } });
    const res = createMockRes();
    jwtMock.verifyRefreshToken.mockReturnValue({ sub: fixtures.userId });
    userModelMock.findById.mockResolvedValue(fixtures.user);
    authServiceMock.createTokensForUser.mockReturnValue({
      access: "new-access",
      refresh: "new-refresh",
    });

    await authController.refresh(req, res);

    expectSuccess(res, 200);
    expect(res.body.data.tokens.access).toBe("new-access");
  });

  it("verify returns 403 on user mismatch", async () => {
    const req = createMockReq({
      params: { user_id: "other-id" },
      user: { sub: fixtures.userId },
    });
    const res = createMockRes();

    await authController.verify(req, res);

    expectError(res, 403, "mismatch");
  });

  it("requestOTP returns 409 for existing email", async () => {
    const req = createMockReq({ body: fixtures.signupBody });
    const res = createMockRes();
    userModelMock.findOne.mockResolvedValue(fixtures.user);

    await authController.requestOTP(req, res);

    expectError(res, 409, "Email already registered");
  });

  it("requestOTP returns otp token when email is available", async () => {
    const req = createMockReq({ body: fixtures.signupBody });
    const res = createMockRes();
    userModelMock.findOne.mockResolvedValue(null);
    otpServiceMock.generateOTP.mockReturnValue("123456");
    otpServiceMock.createOTPToken.mockReturnValue("otp-token");
    twilioServiceMock.sendOTPEmail.mockResolvedValue({ success: true });

    await authController.requestOTP(req, res);

    expectSuccess(res, 200);
    expect(res.body.data.otpToken).toBe("otp-token");
  });

  it("verifyOTP returns 400 on email mismatch", async () => {
    const req = createMockReq({
      body: {
        email: "abc@example.com",
        password: "Password@123",
        name: "ABC",
        otpToken: "token",
        otp: "123456",
      },
    });
    const res = createMockRes();
    otpServiceMock.verifyOTPToken.mockReturnValue({
      valid: true,
      email: "different@example.com",
      purpose: "email-verification",
    });

    await authController.verifyOTP(req, res);

    expectError(res, 400, "Email mismatch");
  });

  it("verifyOTP creates verified user and returns tokens", async () => {
    const req = createMockReq({
      body: {
        email: fixtures.signupBody.email,
        password: fixtures.signupBody.password,
        name: fixtures.signupBody.name,
        otpToken: "token",
        otp: "123456",
      },
    });
    const res = createMockRes();
    const user = { ...fixtures.user, emailVerified: false, save: jest.fn() };

    otpServiceMock.verifyOTPToken.mockReturnValue({
      valid: true,
      email: fixtures.signupBody.email,
      purpose: "email-verification",
    });
    userModelMock.findOne.mockResolvedValue(null);
    authServiceMock.registerUser.mockResolvedValue(user);
    authServiceMock.createTokensForUser.mockReturnValue({
      access: "a",
      refresh: "r",
    });

    await authController.verifyOTP(req, res);

    expectSuccess(res, 201);
    expect(user.save).toHaveBeenCalled();
    expect(res.body.data.message).toContain("verified");
  });

  it("forgotPassword returns 404 for unknown email", async () => {
    const req = createMockReq({ body: { email: "missing@example.com" } });
    const res = createMockRes();
    userModelMock.findOne.mockResolvedValue(null);

    await authController.forgotPassword(req, res);

    expectError(res, 404, "Email not found");
  });

  it("verifyResetOTP returns reset session token", async () => {
    const req = createMockReq({
      body: { email: fixtures.user.email, otpToken: "token", otp: "123456" },
    });
    const res = createMockRes();

    otpServiceMock.verifyOTPToken.mockReturnValue({
      valid: true,
      email: fixtures.user.email,
      purpose: "password-reset",
    });
    userModelMock.findOne.mockResolvedValue(fixtures.user);
    otpServiceMock.createOTPToken.mockReturnValue("reset-session-token");

    await authController.verifyResetOTP(req, res);

    expectSuccess(res, 200);
    expect(res.body.data.resetSessionToken).toBe("reset-session-token");
  });

  it("resetPassword updates password on valid reset session token", async () => {
    const req = createMockReq({
      body: {
        email: fixtures.user.email,
        newPassword: "NewPassword@123",
        resetSessionToken: "session-token",
      },
    });
    const res = createMockRes();
    const user = { ...fixtures.user, save: jest.fn() };

    otpServiceMock.verifyOTPToken.mockReturnValue({
      valid: true,
      email: fixtures.user.email,
      purpose: "password-reset-authorized",
    });
    userModelMock.findOne.mockResolvedValue(user);
    passwordMock.hashPassword.mockResolvedValue("new-hash");

    await authController.resetPassword(req, res);

    expectSuccess(res, 200);
    expect(passwordMock.hashPassword).toHaveBeenCalledWith("NewPassword@123");
    expect(user.password).toBe("new-hash");
    expect(user.save).toHaveBeenCalled();
  });
});
