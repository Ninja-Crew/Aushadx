import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createUserModelMock } from "../mocks/services.js";

const userModelMock = createUserModelMock();
const passwordMock = {
  hashPassword: jest.fn(),
  comparePassword: jest.fn(),
};
const jwtMock = {
  signAccessToken: jest.fn(),
  signRefreshToken: jest.fn(),
};

jest.unstable_mockModule("../../src/models/User.js", () => ({
  default: userModelMock,
}));
jest.unstable_mockModule("../../src/utils/password.js", () => passwordMock);
jest.unstable_mockModule("../../src/utils/jwt.js", () => jwtMock);

const authService = await import("../../src/services/authService.js");

describe("authService unit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("registerUser throws if email already exists", async () => {
    userModelMock.findOne.mockResolvedValue({ _id: "existing" });

    await expect(
      authService.registerUser({
        email: "john@example.com",
        password: "pass",
        name: "John",
      }),
    ).rejects.toThrow("User already exists");
  });

  it("registerUser hashes password and creates user with defaults", async () => {
    userModelMock.findOne.mockResolvedValue(null);
    passwordMock.hashPassword.mockResolvedValue("hashed");
    userModelMock.create.mockResolvedValue({ _id: "new-user" });

    await authService.registerUser({
      email: "john@example.com",
      password: "pass",
      name: "John",
    });

    expect(passwordMock.hashPassword).toHaveBeenCalledWith("pass");
    expect(userModelMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "john@example.com",
        password: "hashed",
        name: "John",
        medicalInfo: {
          bloodType: "unknown",
          allergies: [],
          medical_history: [],
        },
      }),
    );
  });

  it("authenticateUser returns null when user not found", async () => {
    userModelMock.findOne.mockResolvedValue(null);

    const result = await authService.authenticateUser({
      email: "john@example.com",
      password: "pass",
    });

    expect(result).toBeNull();
  });

  it("authenticateUser returns null when password mismatch", async () => {
    userModelMock.findOne.mockResolvedValue({ password: "hashed" });
    passwordMock.comparePassword.mockResolvedValue(false);

    const result = await authService.authenticateUser({
      email: "john@example.com",
      password: "wrong",
    });

    expect(result).toBeNull();
  });

  it("authenticateUser returns user when password matches", async () => {
    const user = { _id: "u1", password: "hashed" };
    userModelMock.findOne.mockResolvedValue(user);
    passwordMock.comparePassword.mockResolvedValue(true);

    const result = await authService.authenticateUser({
      email: "john@example.com",
      password: "pass",
    });

    expect(result).toEqual(user);
  });

  it("createTokensForUser signs access and refresh tokens", () => {
    jwtMock.signAccessToken.mockReturnValue("access");
    jwtMock.signRefreshToken.mockReturnValue("refresh");

    const result = authService.createTokensForUser({
      _id: "507f1f77bcf86cd799439011",
      email: "john@example.com",
      roles: ["user"],
    });

    expect(jwtMock.signAccessToken).toHaveBeenCalledWith({
      sub: "507f1f77bcf86cd799439011",
      email: "john@example.com",
      roles: ["user"],
    });
    expect(jwtMock.signRefreshToken).toHaveBeenCalledWith({
      sub: "507f1f77bcf86cd799439011",
    });
    expect(result).toEqual({ access: "access", refresh: "refresh" });
  });
});
