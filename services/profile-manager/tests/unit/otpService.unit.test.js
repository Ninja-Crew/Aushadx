import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createLoggerMock } from "../mocks/services.js";

const jwtMock = {
  sign: jest.fn(),
  verify: jest.fn(),
};
const loggerMock = createLoggerMock();

jest.unstable_mockModule("jsonwebtoken", () => ({ default: jwtMock }));
jest.unstable_mockModule("../../src/config/env.js", () => ({
  default: {
    OTP_JWT_SECRET: "otp-secret",
    OTP_EXPIRES_IN: "10m",
  },
}));
jest.unstable_mockModule("../../src/config/logger.js", () => ({
  default: loggerMock,
}));

const otpService = await import("../../src/services/otpService.js");

describe("otpService unit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("generateOTP returns a 6-digit numeric string", () => {
    const otp = otpService.generateOTP();

    expect(otp).toMatch(/^\d{6}$/);
  });

  it("createOTPToken signs with configured secret and expiration", () => {
    jwtMock.sign.mockReturnValue("signed-token");

    const token = otpService.createOTPToken(
      "123456",
      "john@example.com",
      "password-reset",
    );

    expect(token).toBe("signed-token");
    expect(jwtMock.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        otp: "123456",
        email: "john@example.com",
        purpose: "password-reset",
      }),
      "otp-secret",
      { expiresIn: "10m" },
    );
  });

  it("verifyOTPToken returns valid payload when otp matches", () => {
    jwtMock.verify.mockReturnValue({
      otp: "123456",
      email: "john@example.com",
      purpose: "email-verification",
    });

    const result = otpService.verifyOTPToken("token", "123456");

    expect(result).toEqual({
      valid: true,
      email: "john@example.com",
      purpose: "email-verification",
    });
  });

  it("verifyOTPToken returns invalid when otp mismatches", () => {
    jwtMock.verify.mockReturnValue({ otp: "654321" });

    const result = otpService.verifyOTPToken("token", "123456");

    expect(result).toEqual({ valid: false, reason: "Invalid OTP" });
  });

  it("verifyOTPToken handles expired token", () => {
    const err = new Error("expired");
    err.name = "TokenExpiredError";
    jwtMock.verify.mockImplementation(() => {
      throw err;
    });

    const result = otpService.verifyOTPToken("token", "123456");

    expect(result).toEqual({ valid: false, reason: "OTP expired" });
  });

  it("verifyOTPToken handles invalid token", () => {
    jwtMock.verify.mockImplementation(() => {
      throw new Error("invalid");
    });

    const result = otpService.verifyOTPToken("token", "123456");

    expect(result).toEqual({ valid: false, reason: "Invalid token" });
    expect(loggerMock.error).toHaveBeenCalled();
  });
});
