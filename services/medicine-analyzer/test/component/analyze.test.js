import { jest } from "@jest/globals";
import request from "supertest";
import {
  analyzeInput,
  profileResponse,
  successfulAnalysis,
} from "../mocks/fixtures.js";
import { testEnv } from "../mocks/env.js";
import { createLlmMock, createRagMock } from "../mocks/services.js";

const llmMock = createLlmMock();
const ragMock = createRagMock();

jest.unstable_mockModule("../../src/services/llmClient.js", () => ({
  default: llmMock,
}));
jest.unstable_mockModule("../../src/services/ragClient.js", () => ({
  default: ragMock,
}));

jest.unstable_mockModule("../../src/config/env.js", () => ({ default: testEnv }));

const mockFetch = jest.fn();
global.fetch = mockFetch;

// Import app after mocks
const { default: app } = await import("../../src/app.js");

describe("Medicine Analyzer API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    ragMock.search.mockResolvedValue([]);
    llmMock.callStructured.mockResolvedValue(successfulAnalysis);
    llmMock.callGeminiStructured.mockResolvedValue(successfulAnalysis);
  });

  it("POST /api/analyze/:user_id returns 200 for valid payload", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => profileResponse,
    });

    const res = await request(app)
      .post("/api/analyze/user123")
      .send(analyzeInput);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.input_type).toBe("medicine_label");
    expect(res.body.analysis.drug_name).toBe("Mock Drug");
    expect(res.body.medicines).toBeInstanceOf(Array);
    expect(res.body.medicines[0].drug_name).toBe("Mock Drug");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(ragMock.search).toHaveBeenCalledWith("Aspirin 100mg");
    expect(llmMock.callStructured).toHaveBeenCalled();
  });

  it("returns 400 when medicine_data is missing", async () => {
    const res = await request(app).post("/api/analyze/user123").send({});
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain("medicine_data is required");
  });

  it("returns 422 when llm flags payload as non-medicine label", async () => {
    llmMock.callStructured.mockResolvedValue({
      input_type: "unknown",
      is_medicine_label: false,
      medicines: []
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => profileResponse,
    });

    const res = await request(app)
      .post("/api/analyze/user123")
      .send(analyzeInput);

    expect(res.statusCode).toBe(422);
    expect(res.body.error).toBe("NOT_MEDICINE_LABEL");
  });

  it("returns 500 when llm service throws", async () => {
    llmMock.callStructured.mockRejectedValue(new Error("llm unavailable"));
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => profileResponse,
    });

    const res = await request(app)
      .post("/api/analyze/user123")
      .send(analyzeInput);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toContain("llm unavailable");
  });

  it("continues analysis when profile service returns non-OK", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({ success: false }),
    });

    const res = await request(app)
      .post("/api/analyze/user123")
      .send(analyzeInput);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("continues analysis when RAG search fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => profileResponse,
    });
    ragMock.search.mockRejectedValue(new Error("pinecone timeout"));

    const res = await request(app)
      .post("/api/analyze/user123")
      .send(analyzeInput);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
