import { jest } from "@jest/globals";
import request from "supertest";
import http from "http";

const MOCK_PROFILE_PORT = 3004;
process.env.PROFILE_SERVICE_URL = `http://127.0.0.1:${MOCK_PROFILE_PORT}`;
process.env.LLM_PROVIDER = "gemini"; // Ensure we don't fail config checks
process.env.GEMINI_API_KEY = "dummy-key-for-test";
process.env.PINECONE_API_KEY = "dummy-key-for-test";
process.env.PINECONE_INDEX = "dummy";
process.env.PINECONE_INDEX_HOST = "dummy";

// Mock the LLM and RAG clients for a predictable integration test
const mockLlmClient = {
  callStructured: jest.fn().mockResolvedValue({
    is_medicine_label: true,
    drug_name: "Integration Test Drug",
    recommendations: ["Take with water"],
  }),
  callGeminiStructured: jest.fn().mockResolvedValue({
    is_medicine_label: true,
    drug_name: "Integration Test Drug",
    recommendations: ["Take with water"],
  })
};

const mockRagClient = {
  search: jest.fn().mockResolvedValue([])
};

jest.unstable_mockModule("../../src/services/llmClient.js", () => ({ default: mockLlmClient }));
jest.unstable_mockModule("../../src/services/ragClient.js", () => ({ default: mockRagClient }));

describe("Medicine Analyzer System Integration", () => {
  let app;
  let profileServer;

  beforeAll(async () => {
    // Start a real dummy HTTP server for profile manager to simulate cross-service HTTP
    profileServer = http.createServer((req, res) => {
      if (req.url.match(/\/profile\/.*\/medical-info/) && req.method === 'GET') {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          status: true,
          data: {
            medical_info: {
              medical_info: "Patient has history of asthma."
            }
          }
        }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise(resolve => profileServer.listen(MOCK_PROFILE_PORT, "127.0.0.1", resolve));

    // Dynamic import app after mocks and env vars
    const imported = await import("../../src/app.js");
    app = imported.default;
  });

  afterAll((done) => {
    profileServer.close(done);
  });

  it("should return 200 on health check", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("should process an analysis request via HTTP integration with profile-manager", async () => {
    const payload = {
      medicine_data: {
        ocr_text: "Test medicine text"
      }
    };

    const res = await request(app)
      .post("/api/analyze/testuser123")
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.analysis.drug_name).toBe("Integration Test Drug");
    expect(mockLlmClient.callStructured).toHaveBeenCalled();
  });
});
