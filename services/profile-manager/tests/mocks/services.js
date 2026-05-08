import { jest } from "@jest/globals";

export function createAuthServiceMock() {
  return {
    registerUser: jest.fn(),
    authenticateUser: jest.fn(),
    createTokensForUser: jest.fn(),
  };
}

export function createOtpServiceMock() {
  return {
    generateOTP: jest.fn(),
    createOTPToken: jest.fn(),
    verifyOTPToken: jest.fn(),
  };
}

export function createTwilioServiceMock() {
  return {
    initTwilio: jest.fn(),
    sendOTPEmail: jest.fn(),
  };
}

export function createProfileServiceMock() {
  return {
    getProfile: jest.fn(),
    getMedicalInfo: jest.fn(),
    updateProfile: jest.fn(),
    deleteProfile: jest.fn(),
    addFcmToken: jest.fn(),
    removeFcmToken: jest.fn(),
  };
}

export function createUserModelMock() {
  return {
    findById: jest.fn(),
    findOne: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    updateMany: jest.fn(),
    create: jest.fn(),
  };
}

export function createLoggerMock() {
  return {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
}
