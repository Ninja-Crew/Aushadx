import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import http from "http";
import assert from "assert";

// Config
const GATEWAY_PORT = 3000;
const PROFILE_PORT = 3001;
const SCHEDULER_PORT = 3003;
// Use a test DB if possible (in a real scenario we'd use a unique DB name)
const MONGO_URI = "mongodb://localhost:27017/profile-manager-test"; 

// Helpers
function startService(name, cwd, envMsgs) {
    console.log(`Starting ${name}...`);
    const p = spawn(process.execPath, ["src/index.js"], {
        cwd: path.resolve(cwd),
        env: { ...process.env, ...envMsgs },
        stdio: "pipe"
    });
    p.stdout.on("data", d => process.stdout.write(`[${name}] ${d}`));
    p.stderr.on("data", d => process.stderr.write(`[${name}] ERR: ${d}`));
    p.on("error", (err) => console.error(`[${name}] Failed to start:`, err));
    return p;
}

function fetch(port, path, options = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: port,
            path: path,
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    const body = data ? JSON.parse(data) : {};
                    resolve({ status: res.statusCode, body, headers: res.headers });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data, headers: res.headers });
                }
            });
        });
        req.on('error', reject);
        if (options.body) {
            req.write(JSON.stringify(options.body));
        }
        req.end();
    });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function runTests() {
    let gateway, profile, scheduler;
    const uniqueUser = `user-${Date.now()}@example.com`;
    const password = "Password123!";
    let accessToken;
    let loginData;

    try {
        // 1. Start Profile Manager
        profile = startService("profile-manager", "../profile-manager", { PORT: PROFILE_PORT, MONGO_URI });
        await sleep(8000); // Increased wait time

        // 2. Start Medicine Scheduler
        scheduler = startService("medicine-scheduler", "../medicine-scheduler", { PORT: SCHEDULER_PORT, MONGO_URI });
        await sleep(8000);

        // 3. Start API Gateway
        gateway = startService("api-server", ".", { 
            PORT: GATEWAY_PORT, 
            PROFILE_SERVICE_URL: `http://localhost:${PROFILE_PORT}`,
            MEDICINE_SCHEDULER_URL: `http://localhost:${SCHEDULER_PORT}`,
            JWKS_URI: `http://localhost:${PROFILE_PORT}/.well-known/jwks.json`
        });
        await sleep(5000);

        console.log("\n--- STARTING TESTS ---\n");

        // Test 0: Health
        const health = await fetch(GATEWAY_PORT, "/health");
        console.log("Health Check:", health.status === 200 ? "PASS" : "FAIL");
        assert.strictEqual(health.status, 200);

        // Test 1: Signup (via Gateway)
        console.log(`\nSignup User: ${uniqueUser}`);
        const signup = await fetch(GATEWAY_PORT, "/auth/signup", {
            method: "POST",
            body: { email: uniqueUser, password, name: "Test User" }
        });
        console.log("Signup Status:", signup.status);
        if (signup.status !== 201) console.log("Signup Body:", signup.body);
        assert.strictEqual(signup.status, 201);
        
        // Test 2: Login (via Gateway)
        console.log(`\nLogin User: ${uniqueUser}`);
        const login = await fetch(GATEWAY_PORT, "/auth/login", {
            method: "POST",
            body: { email: uniqueUser, password }
        });
        console.log("Login Status:", login.status);
        assert.strictEqual(login.status, 200);
        
        loginData = login.body.data || login.body; 
        
        assert.ok(loginData.tokens && loginData.tokens.access, "Access token missing");
        accessToken = loginData.tokens.access;
        console.log("Got Access Token");

        // Test 3: JWKS Endpoint
        const jwks = await fetch(PROFILE_PORT, "/.well-known/jwks.json");
        console.log("\nJWKS Endpoint:", jwks.status === 200 ? "PASS" : "FAIL");
        assert.strictEqual(jwks.status, 200);

        // Test 4: Protected Route (Profile) via Gateway
        console.log("\nAccess Protected Profile (Gateway)...");
        const userId = loginData.user.id;
        const profileReq = await fetch(GATEWAY_PORT, `/profile/${userId}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        console.log("Gateway Profile Status:", profileReq.status);
        assert.strictEqual(profileReq.status, 200);
        console.log("Profile Access: PASS");

        // Test 6: Medicine Scheduler (Protected) via Gateway
        // This validates that Gateway injects X-User-Id and Scheduler uses it.
        console.log("\nTesting Medicine Scheduler via Gateway...");
        const reminderPayload = {
            medicineName: "Test Med",
            dosage: "500mg",
            frequency: "ONCE",
            time: new Date(Date.now() + 3600000).toISOString()
        };
        
        // POST to /reminders (Scheduler expects userId from Headers now)
        const reminderReq = await fetch(GATEWAY_PORT, "/reminders", {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}` },
            body: reminderPayload
        });
        
        console.log("Scheduler Response Status:", reminderReq.status);
        if (reminderReq.status !== 201) console.log("Scheduler Body:", reminderReq.body);
        
        assert.strictEqual(reminderReq.status, 201);
        const reminderData = reminderReq.body;
        // Verify the scheduler used the User ID from the token/header
        assert.strictEqual(reminderData.userId, userId);
        console.log("Scheduler Header Auth: PASS");

        console.log("\n--- ALL TESTS PASSED ---\n");
        process.exit(0);

    } catch (err) {
        console.error("\nTEST FAILED:", err);
        process.exit(1);
    } finally {
        if (gateway) gateway.kill();
        if (profile) profile.kill();
        if (scheduler) scheduler.kill();
    }
}

runTests();
