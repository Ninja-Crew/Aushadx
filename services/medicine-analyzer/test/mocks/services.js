import { jest } from "@jest/globals";

export function createLlmMock() {
  return {
    callStructured: jest.fn(),
    callGeminiStructured: jest.fn(),
  };
}

export function createRagMock() {
  return {
    search: jest.fn(),
  };
}

export function createLoggerMock() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}
