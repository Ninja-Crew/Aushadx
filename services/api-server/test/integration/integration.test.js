import request from "supertest";
import jwt from "jsonwebtoken";
import { generateKeyPairSync } from "crypto";
import http from "http";

const PROFILE_PORT = 3001;
const SCHEDULER_PORT = 3003;

process.env.PROFILE_SERVICE_URL = `http://127.0.0.1:${PROFILE_PORT}`;
process.env.MEDICINE_SCHEDULER_URL = `http://127.0.0.1:${SCHEDULER_PORT}`;

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

process.env.JWT_PUBLIC_KEY = publicKey;
process.env.JWKS_URI = `http://127.0.0.1:${PROFILE_PORT}/.well-known/jwks.json`;

describe("System Integration Tests (Mocked Upstreams)", () => {
  let validToken;
  let app;
  const userId = "test-user-id";
  let profileServer, schedulerServer;

  beforeAll(async () => {
    // Start dummy Profile Service
    profileServer = http.createServer((req, res) => {
      if (req.url === "/auth/signup") {
        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "Created" }));
      } else if (req.url.startsWith("/profile/")) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ id: userId, name: "Test User" }));
      } else if (req.url === "/.well-known/jwks.json") {
        // Just return a dummy response; verifyToken uses jest mock
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ keys: [] }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    profileServer.listen(PROFILE_PORT, "127.0.0.1");

    // Start dummy Scheduler Service
    schedulerServer = http.createServer((req, res) => {
      if (req.url.startsWith("/reminders/")) {
        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ userId, medicineName: "Test Med" }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    schedulerServer.listen(SCHEDULER_PORT, "127.0.0.1");

    // Mock jwks-rsa before importing app
    const { jest } = await import("@jest/globals");
    jest.unstable_mockModule("jwks-rsa", () => ({
      default: jest.fn(() => ({
        getSigningKey: (kid, cb) => cb(null, { getPublicKey: () => publicKey })
      }))
    }));

    // Import app after env vars and mocks are set
    const { default: importedApp } = await import("../../src/app.js");
    app = importedApp;

    const payload = {
      sub: userId,
      email: "test@example.com",
      roles: ["user"],
      type: "access"
    };
    validToken = jwt.sign(payload, privateKey, { algorithm: "RS256", expiresIn: "1h", keyid: "mock-kid" });
  });

  afterAll((done) => {
    profileServer.close(() => {
      schedulerServer.close(done);
    });
  });

  it("should signup a new user via proxy", async () => {
    const signup = await request(app)
      .post("/auth/signup")
      .send({ email: "test@example.com", password: "Password123!", name: "Test User" });

    expect(signup.status).toBe(201);
  });

  it("should access protected profile route via gateway with token", async () => {
    const profileReq = await request(app)
      .get(`/profile/${userId}`)
      .set("Authorization", `Bearer ${validToken}`);

    expect(profileReq.status).toBe(200);
  });

  it("should create a medicine reminder via gateway", async () => {
    const reminderPayload = {
      medicineName: "Test Med",
      dosage: "500mg",
      frequency: "ONCE",
      time: new Date().toISOString(),
    };

    const reminderReq = await request(app)
      .post("/reminders")
      .set("Authorization", `Bearer ${validToken}`)
      .send(reminderPayload);

    expect(reminderReq.status).toBe(201);
  });
});
