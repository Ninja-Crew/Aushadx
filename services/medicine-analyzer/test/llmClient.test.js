import { jest } from '@jest/globals';
import { z } from 'zod';

// Use unstable_mockModule for ESM mocking
jest.unstable_mockModule('@google/genai', () => ({
  GoogleGenAI: jest.fn(function() {
    this.models = {
      generateContent: jest.fn(),
    };
  }),
  HarmCategory: {},
  HarmBlockThreshold: {},
}));

jest.unstable_mockModule('../src/config/env.js', () => ({
  default: {
    GEMINI_API_KEY: 'test-api-key',
    MOCK_LLM: 'false',
  }
}));

jest.unstable_mockModule('../src/config/logger.js', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }
}));

// Import modules AFTER mocking
const { GoogleGenAI } = await import('@google/genai');
const { default: llmClient } = await import('../src/services/llmClient.js');

// Capture the instance immediately after import, before any test clearing
const clientInstance = GoogleGenAI.mock.instances[0];
const mockGenerateContent = clientInstance?.models?.generateContent;

describe('llmClient', () => {

  beforeEach(() => {
    // Only clear the method mock, not the class mock which tracks instances
    if (mockGenerateContent) mockGenerateContent.mockClear();
  });

  it('callGeminiStructured should return parsed JSON', async () => {
    if (!mockGenerateContent) throw new Error("Mock not captured");

    const mockResponseText = JSON.stringify({
      drug_name: 'Test Drug',
      recommendations: ['Take care'],
    });

    mockGenerateContent.mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [{ text: mockResponseText }],
          },
        },
      ],
    });

    const schema = z.object({
      drug_name: z.string(),
      recommendations: z.array(z.string()),
    });

    const result = await llmClient.callGeminiStructured('Test prompt', schema);

    expect(result).toEqual({
      drug_name: 'Test Drug',
      recommendations: ['Take care'],
    });
    expect(mockGenerateContent).toHaveBeenCalledWith(expect.objectContaining({
        contents: [{ role: "user", parts: [{ text: 'Test prompt' }] }],
    }));
  });

  it('should throw error if response is empty', async () => {
    mockGenerateContent.mockResolvedValue({});

    const schema = z.object({ field: z.string() });

    await expect(llmClient.callGeminiStructured('prompt', schema)).rejects.toThrow('No text found');
  });
});
