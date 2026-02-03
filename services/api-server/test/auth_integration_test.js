import { generateKeyPairSync } from "crypto";
import jwt from "jsonwebtoken";
import app from "../src/app.js";
import http from "http";

function generateKeys() {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { publicKey, privateKey };
}

async function runTest() {
  const { publicKey, privateKey } = generateKeys();

  // start API server with public key in env
  process.env.JWT_PUBLIC_KEY = publicKey;
  const server = http.createServer(app);
  await new Promise((res) => server.listen(0, res));
  const port = server.address().port;

  // sign a token with private key
  const payload = {
    sub: "test-user-id",
    email: "test@example.com",
    roles: ["user"],
  };
  const token = jwt.sign(payload, privateKey, {
    algorithm: "RS256",
    expiresIn: "1h",
  });

  const options = {
    hostname: "127.0.0.1",
    port,
    path: "/protected",
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  };

  const result = await new Promise((resolve) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", (err) => resolve({ error: err }));
    req.end();
  });

  server.close();

  if (result.error) {
    console.error("Test failed", result.error);
    process.exit(1);
  }
  if (result.status === 200) {
    console.log(
      "Integration test passed — protected endpoint accepted valid token"
    );
    console.log("Response body:", result.body);
    process.exit(0);
  }
  console.error("Integration test failed — status", result.status, result.body);
  process.exit(1);
}

runTest();
