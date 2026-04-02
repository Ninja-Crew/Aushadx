import { spawn } from "child_process";
import http from "http";
import assert from "assert";

const PORT = process.env.PORT || 3000; // Ensure this matches environment or test config

function startServer() {
  return new Promise((resolve, reject) => {
    // Start index.js (gateway)
    const serverProcess = spawn("node", ["src/index.js"], {
      stdio: "inherit", // Pipe output to see logs
      env: { ...process.env, PORT: String(PORT) },
    });

    // Wait for server to listen (naive delay or checking output)
    // Better: wait for health check to pass
    setTimeout(() => resolve(serverProcess), 2000);
  });
}

function fetch(path, options) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: PORT,
            path: path,
            ...options
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
        });
        req.on('error', reject);
        if (options && options.body) {
            req.write(options.body);
        }
        req.end();
    });
}

async function runTests() {
  console.log("Starting API Server for tests...");
  let serverProcess;
  try {
    serverProcess = await startServer();
    console.log("Server started. Running tests...");

    // Test 1: Health
    const health = await fetch("/health");
    console.log("Health Check:", health.status === 200 ? "PASS" : "FAIL");
    assert.strictEqual(health.status, 200);

    // Test 2: Auth public (should proxy or at least not 401)
    // Note: Proxy might 504 if downstream is closed, but it MUST NOT be 401.
    const auth = await fetch("/auth/login", { method: "POST" });
    console.log("Auth Route (Public):", auth.status !== 401 ? "PASS" : "FAIL", `(${auth.status})`);
    assert.notStrictEqual(auth.status, 401);

    // Test 3: Profile protected (should 401)
    const profile = await fetch("/profile/123", { method: "GET" });
    console.log("Profile Route (Protected):", profile.status === 401 ? "PASS" : "FAIL", `(${profile.status})`);
    assert.strictEqual(profile.status, 401);

    console.log("All manual tests passed!");
    process.exit(0);
  } catch (err) {
    console.error("Tests Failed:", err);
    process.exit(1);
  } finally {
    if (serverProcess) {
        serverProcess.kill();
    }
  }
}

runTests();
