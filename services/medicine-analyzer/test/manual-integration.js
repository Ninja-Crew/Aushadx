import "dotenv/config";
import fs from "fs";
import { spawn } from "child_process";
import http from "http";
import assert from "assert";

const PORT = 3003; // Choosing a port for test, or rely on default env? 
// Original code default port? Need to check index.js.
// Assuming port 3003 (scheduler is 3002, api is 3001, profile is 3000). 
// But wait, Gateway app.js used 8000 for medicine-analyzer in my guess?
// Let's check medicine-analyzer/src/index.js.
// If it listens on PORT env var, we can set it.

const MOCK_PROFILE_PORT = 3004;

function startMockProfileServer() {
    const server = http.createServer((req, res) => {
        console.log(`[MockProfile] Received ${req.method} ${req.url}`);
        
        // Handle /profile/:id/medical-info
        if (req.url.match(/\/profile\/.*\/medical-info/) && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: true,
                data: {
                    medical_info: {
                        medical_history: "Patient has history of asthma."
                    }
                }
            }));
            return;
        }

        res.writeHead(404);
        res.end();
    });

    return new Promise((resolve) => {
        server.listen(MOCK_PROFILE_PORT, () => {
            console.log(`Mock Profile Server running on ${MOCK_PROFILE_PORT}`);
            resolve(server);
        });
    });
}

function startServer() {
  return new Promise((resolve, reject) => {
    const serverProcess = spawn("node", ["src/index.js"], {
      stdio: "inherit",
      env: { 
          ...process.env, 
          PORT: "3003", 
          MEDICINE_SCHEDULER_URL: "http://localhost:3002",
           // Point to our mock server
          PROFILE_SERVICE_URL: `http://localhost:${MOCK_PROFILE_PORT}`
          // MOCK_LLM removed to use real LLM logic (if API key present) 
          // or fail if missing, as per "only mock profile-manager" instruction.
      }, 
    });
    setTimeout(() => resolve(serverProcess), 5000);
  });
}

function fetch(path, options) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: 3003,
            path: path,
            ...options
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
        });
        req.on('error', reject);
        if (options && options.body) {
            req.write(options.body);
        }
        req.end();
    });
}

async function runTests() {
  console.log("Starting Medicine Analyzer for tests...");
  console.log("GEMINI_API_KEY Present:", process.env.GEMINI_API_KEY ? "Yes" : "No");
  let serverProcess;
  let mockProfileServer;

  try {
    // Start Mock Profile Service first
    mockProfileServer = await startMockProfileServer();

    serverProcess = await startServer();
    console.log("Server started on 3003. Running tests...");

    // Test 1: Health
    const health = await fetch("/health");
    console.log("Health Check:", health.status === 200 ? "PASS" : "FAIL");
    assert.strictEqual(health.status, 200);

    // Test 2: Validation Error (Missing data)
    const validation = await fetch("/api/analyze/testuser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}) 
    });
    console.log("Validation Check (400):", validation.status === 400 ? "PASS" : "FAIL", `(${validation.status})`);
    assert.strictEqual(validation.status, 400);

    // Test 3: Analysis with OCR Text (Real LLM call, mocking Profile)
    // Note: This requires GEMINI_API_KEY in process.env
    if (!process.env.GEMINI_API_KEY) {
        console.warn("SKIPPING Test 3: No GEMINI_API_KEY found. Real LLM call would fail.");
    } else {
        const analysisReq = await fetch("/api/analyze/testuser", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                medicine_data: {
                    ocr_text: "CIPROFLOXACIN INJECTION IP 40mg/ml A MODERN LABORATORIES FOR VETERINARY USE ONLY FOR EXPORT ONLY"
                }
            })
        });

        console.log("Analysis Check (200):", analysisReq.status === 200 ? "PASS" : "FAIL", `(${analysisReq.status})`);
        
        if (analysisReq.status === 200) {
            const data = JSON.parse(analysisReq.body);
            console.log("Response Success:", data.success === true ? "PASS" : "FAIL");
            fs.writeFileSync("response.json", JSON.stringify(data, null, 2));
            console.log("DEBUG: Response Data written to response.json");
            // Check for structure since content is dynamic from real LLM
            console.log("Drug Name Present:", data.analysis && data.analysis.drug_name ? "PASS" : "FAIL");
            
            assert.ok(data.success);
            assert.ok(data.analysis.drug_name); // Expecting some drug name found
        } else {
            console.error("Analysis Request Failed body:", analysisReq.body);
            assert.fail(`Analysis request failed with status ${analysisReq.status}`);
        }    
    }

    console.log("All manual tests passed!");
    process.exit(0);
  } catch (err) {
    console.error("Tests Failed:", err);
    process.exit(1);
  } finally {
    if (serverProcess) serverProcess.kill();
    if (mockProfileServer) mockProfileServer.close();
  }
}

runTests();
