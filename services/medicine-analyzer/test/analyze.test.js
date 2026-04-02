import { jest } from "@jest/globals";
import request from "supertest";

// Mock dependencies
jest.unstable_mockModule("../src/services/llmClient.js", () => ({
  default: {
    callStructured: jest.fn().mockResolvedValue({
      is_medicine_label: true,
      drug_name: "Mock Drug",
      recommendations: ["Take with water"],
    }),
    callGeminiStructured: jest.fn().mockResolvedValue({
      is_medicine_label: true,
      drug_name: "Mock Drug",
      recommendations: ["Take with water"],
    }),
  }
}));

jest.unstable_mockModule("../src/services/ragClient.js", () => ({
  default: {
    search: jest.fn().mockResolvedValue([]),
  }
}));

// Mock Env to avoid missing API keys causing issues
jest.unstable_mockModule("../src/config/env.js", () => ({
  default: {
    PORT: 5000,
    PROFILE_SERVICE_URL: "http://localhost:3001",
    GEMINI_API_KEY: "test",
    PINECONE_API_KEY: "test",
    PINECONE_INDEX: "test",
  }
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

// Import app after mocks
const { default: app } = await import("../src/app.js");

describe("Medicine Analyzer API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  it("POST /api/analyze/:user_id should analyze medicine data", async () => {
    // Mock profile response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: true, data: { medical_info: { medical_info: "None" } } }),
    });

    const res = await request(app)
      .post("/api/analyze/user123")
      .send({
        medicine_data: { text: "Aspirin 100mg" },
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.analysis.drug_name).toBe("Mock Drug");
    
    // Verify fetch was called without Auth header (since we removed it)
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const fetchCalls = mockFetch.mock.calls[0];
    expect(fetchCalls[0]).toContain("/profile/medical-info/user123");
    // Verify no Authorization header in headers
    expect(fetchCalls[1].headers).not.toHaveProperty("Authorization");
  });

  it("should return 400 if medicine_data is missing", async () => {
    const res = await request(app).post("/api/analyze/user123").send({});
    expect(res.statusCode).toBe(400);
  });
});
