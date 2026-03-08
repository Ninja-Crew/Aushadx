/**
 * Tests for the LLM provider adapters and llmClient factory.
 *
 * Structure:
 *  1. geminiProvider unit tests
 *  2. openaiProvider unit tests
 *  3. llmClient factory tests (provider dispatch + alias)
 */

import { jest } from "@jest/globals";
import { z } from "zod";

// ─── Shared logger mock (hoisted, used by all modules) ───────────────────────

jest.unstable_mockModule("../src/config/logger.js", () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// ─── 1. geminiProvider ────────────────────────────────────────────────────────

const mockGeminiGenerateContent = jest.fn();

jest.unstable_mockModule("@google/genai", () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent: mockGeminiGenerateContent },
  })),
  HarmCategory: {},
  HarmBlockThreshold: {},
}));

jest.unstable_mockModule("../src/config/env.js", () => ({
  default: {
    GEMINI_API_KEY: "test-gemini-key",
    OPENAI_API_KEY: "test-openai-key",
    LLM_PROVIDER: "gemini",
    LLM_MODEL: "",
  },
}));

const { default: geminiProvider } = await import(
  "../src/services/providers/geminiProvider.js"
);

describe("geminiProvider", () => {
  beforeEach(() => mockGeminiGenerateContent.mockClear());

  it("callStructured returns parsed JSON on success", async () => {
    const payload = { drug_name: "Paracetamol", recommendations: [] };
    mockGeminiGenerateContent.mockResolvedValue({
      candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }],
    });

    const schema = z.object({
      drug_name: z.string(),
      recommendations: z.array(z.string()),
    });

    const result = await geminiProvider.callStructured("test prompt", schema);

    expect(result).toEqual(payload);
    expect(mockGeminiGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        contents: [{ role: "user", parts: [{ text: "test prompt" }] }],
      })
    );
  });

  it("throws after all retries when response has no text", async () => {
    mockGeminiGenerateContent.mockResolvedValue({});
    const schema = z.object({ field: z.string() });
    await expect(
      geminiProvider.callStructured("prompt", schema, 1)
    ).rejects.toThrow("No text found");
  });
});

// ─── 2. openaiProvider ────────────────────────────────────────────────────────

const mockChatCompletionsCreate = jest.fn();

jest.unstable_mockModule("openai", () => ({
  default: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockChatCompletionsCreate } },
  })),
}));

const { default: openaiProvider } = await import(
  "../src/services/providers/openaiProvider.js"
);

describe("openaiProvider", () => {
  beforeEach(() => mockChatCompletionsCreate.mockClear());

  it("callStructured returns parsed JSON on success", async () => {
    const payload = { drug_name: "Ibuprofen", recommendations: ["Take with food"] };
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(payload) } }],
    });

    const schema = z.object({
      drug_name: z.string(),
      recommendations: z.array(z.string()),
    });

    const result = await openaiProvider.callStructured("test prompt", schema);

    expect(result).toEqual(payload);
    expect(mockChatCompletionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: "user", content: "test prompt" }],
        response_format: expect.objectContaining({ type: "json_schema" }),
      })
    );
  });

  it("throws after all retries when response has no text", async () => {
    mockChatCompletionsCreate.mockResolvedValue({});
    const schema = z.object({ field: z.string() });
    await expect(
      openaiProvider.callStructured("prompt", schema, 1)
    ).rejects.toThrow("No text found");
  });
});

// ─── 3. llmClient factory ─────────────────────────────────────────────────────

const mockProviderCallStructured = jest.fn().mockResolvedValue({ drug_name: "Mock Drug" });

jest.unstable_mockModule("../src/services/providers/geminiProvider.js", () => ({
  default: { callStructured: mockProviderCallStructured },
}));

const { default: llmClient } = await import("../src/services/llmClient.js");

describe("llmClient factory", () => {
  beforeEach(() => mockProviderCallStructured.mockClear());

  it("callStructured delegates to the configured provider", async () => {
    const schema = z.object({ drug_name: z.string() });
    const result = await llmClient.callStructured("prompt", schema);
    expect(result).toEqual({ drug_name: "Mock Drug" });
    expect(mockProviderCallStructured).toHaveBeenCalled();
  });

  it("callGeminiStructured is a backwards-compatible alias", async () => {
    const schema = z.object({ drug_name: z.string() });
    const result = await llmClient.callGeminiStructured("prompt", schema);
    expect(result).toEqual({ drug_name: "Mock Drug" });
  });
});
