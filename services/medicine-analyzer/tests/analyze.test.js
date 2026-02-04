import request from "supertest";
import express from "express";
import { jest } from "@jest/globals";

// Mock dependencies
jest.mock("../src/services/llmClient.js", () => ({
  callGeminiStructured: jest.fn().mockResolvedValue({
    drug_name: "Mock Drug",
    recommendations: ["Take with water"],
  }),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

// Import app
import app from "../src/app.js";

describe("Medicine Analyzer API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  it("POST /api/analyze/:user_id should analyze medicine data", async () => {
    // Mock profile response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: true, data: { medical_info: { medical_history: "None" } } }),
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
    expect(fetchCalls[0]).toContain("/profile/user123/medical-info");
    // Verify no Authorization header in headers
    expect(fetchCalls[1].headers).not.toHaveProperty("Authorization");
  });

  it("should return 400 if medicine_data is missing", async () => {
    const res = await request(app).post("/api/analyze/user123").send({});
    expect(res.statusCode).toBe(400);
  });
});
