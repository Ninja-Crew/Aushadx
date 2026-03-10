import express from "express";
import http from "http";
import morgan from "morgan";
import dotenv from "dotenv";
import { createProxyMiddleware } from "http-proxy-middleware";
import httpProxy from "http-proxy";

const { createProxyServer } = httpProxy;

import verifyToken, { verifyJWT } from "./middleware/verifyToken.js";
import apiLimiter from "./middleware/rateLimit.js";

dotenv.config();

/* ================================
   TIMEOUT CONFIGURATION (from env)
================================ */

const TIMEOUT_AUTH = parseInt(process.env.TIMEOUT_AUTH) || 60000;
const TIMEOUT_PROFILE = parseInt(process.env.TIMEOUT_PROFILE) || 60000;
const TIMEOUT_REMINDERS = parseInt(process.env.TIMEOUT_REMINDERS) || 60000;
const TIMEOUT_ANALYZE = parseInt(process.env.TIMEOUT_ANALYZE) || 300000; // 5 mins
const TIMEOUT_AGENT = parseInt(process.env.TIMEOUT_AGENT) || 60000;

// Global server timeout should be max of all proxy timeouts plus buffer
const SERVER_TIMEOUT = Math.max(TIMEOUT_AUTH, TIMEOUT_PROFILE, TIMEOUT_REMINDERS, TIMEOUT_ANALYZE, TIMEOUT_AGENT) + 5000;

console.log("Timeout Config (ms):");
console.log("- Auth:", TIMEOUT_AUTH);
console.log("- Profile:", TIMEOUT_PROFILE);
console.log("- Reminders:", TIMEOUT_REMINDERS);
console.log("- Analyze:", TIMEOUT_ANALYZE);
console.log("- Agent:", TIMEOUT_AGENT);
console.log("- Server Total:", SERVER_TIMEOUT);

const app = express();
const PORT = process.env.PORT || 3001;

/* ================================
   INTERNAL SERVICE URLS (HTTP)
================================ */
// ... (lines 18-39 unchanged in logic, but let's keep the flow)

/* ================================
   GLOBAL MIDDLEWARE
=============================== */
// ...

/* ================================
   PUBLIC ROUTES
================================ */

app.use(
  "/auth",
  createProxyMiddleware({
    target: PROFILE_SERVICE_URL + "/auth",
    changeOrigin: true,
    proxyTimeout: TIMEOUT_AUTH,
    timeout: TIMEOUT_AUTH,
  })
);

/* ================================
   USER HEADER INJECTION
================================ */
// ...

/* ================================
   PROTECTED REST ROUTES
================================ */

app.use(
  "/profile",
  verifyToken,
  (req, res, next) => {
    injectUserParam(req, res, () => {
      createProxyMiddleware({
        target: PROFILE_SERVICE_URL + "/profile",
        changeOrigin: true,
        onProxyReq: injectUserHeader,
        proxyTimeout: TIMEOUT_PROFILE,
        timeout: TIMEOUT_PROFILE,
      })(req, res, next);
    });
  }
);

app.use(
  "/reminders",
  verifyToken,
  (req, res, next) => {
    injectUserParam(req, res, () => {
      createProxyMiddleware({
        target: MEDICINE_SCHEDULER_URL + "/reminders",
        changeOrigin: true,
        onProxyReq: injectUserHeader,
        proxyTimeout: TIMEOUT_REMINDERS,
        timeout: TIMEOUT_REMINDERS,
      })(req, res, next);
    });
  }
);

app.use(
  "/analyze",
  verifyToken,
  (req, res, next) => {
    injectUserParam(req, res, () => {
      createProxyMiddleware({
        target: MEDICINE_ANALYZER_URL + "/api/analyze",
        changeOrigin: true,
        onProxyReq: injectUserHeader,
        proxyTimeout: TIMEOUT_ANALYZE,
        timeout: TIMEOUT_ANALYZE,
        onError: async (err, req, res) => {
          console.error("Proxy Error:", err);
          try {
             const fs = await import("fs");
             fs.appendFileSync("proxy_error.log", `[${new Date().toISOString()}] ${err.message}\n${err.stack}\n`);
          } catch (e) {}
          if (!res.headersSent) {
             res.status(500).json({ error: "Proxy Error", details: err.message });
          }
        },
      })(req, res, next);
    });
  }
);

const agentHttpUrl = AGENT_SERVICE_URL.replace("ws://", "http://").replace("wss://", "https://");

const agentProxy = createProxyMiddleware({
  target: agentHttpUrl,
  changeOrigin: true,
  onProxyReq: injectUserHeader,
  proxyTimeout: TIMEOUT_AGENT,
  timeout: TIMEOUT_AGENT,
});

app.get("/chats", verifyToken, (req, res, next) => {
  req.url = `/chats/${req.user.sub}`;
  agentProxy(req, res, next);
});

app.get("/chats/:chatId/messages", verifyToken, (req, res, next) => {
  req.url = `/chats/${req.params.chatId}/messages/${req.user.sub}`;
  agentProxy(req, res, next);
});

app.delete("/chats/:chatId", verifyToken, (req, res, next) => {
  req.url = `/chats/${req.params.chatId}/${req.user.sub}`;
  agentProxy(req, res, next);
});

app.put("/chats/:chatId", verifyToken, (req, res, next) => {
  req.url = `/chats/${req.params.chatId}/${req.user.sub}`;
  agentProxy(req, res, next);
});

// Body parser for non-proxy routes (if any)
app.use(express.json());

/* =========================================
   CREATE HTTP SERVER (ALB handles TLS)
========================================= */

const server = http.createServer(app);

// Explicitly set server-level timeouts
server.timeout = SERVER_TIMEOUT;
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

/* =========================================
   WEBSOCKET PROXY (SECURED)
========================================= */

const wsProxy = createProxyServer({
  target: AGENT_SERVICE_URL,
  ws: true,
  changeOrigin: true,
  proxyTimeout: TIMEOUT_AGENT,
  timeout: TIMEOUT_AGENT,
});

server.on("upgrade", async (req, socket, head) => {
  // ... (websocket logic unchanged)
  try {
    if (!req.url.startsWith("/ws")) {
      socket.destroy();
      return;
    }

    let token = "";
    if (req.headers["authorization"]) {
        token = req.headers["authorization"].split(" ")[1];
    } else {
        const url = new URL(req.url, `http://${req.headers.host}`);
        token = url.searchParams.get("token");
    }

    if (!token) throw new Error("Missing token");
    const decoded = await verifyJWT(token);
    req.user = decoded;
    req.headers["x-user-id"] = decoded.sub;
    const separator = req.url.includes("?") ? "&" : "?";
    req.url += `${separator}userId=${decoded.sub}`;

    wsProxy.ws(req, socket, head);

  } catch (err) {
    console.error("WebSocket auth failed:", err.message);
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
  }
});

export { app, server };
export default app;

/* =========================================
   START SERVER
========================================= */

// server.listen(PORT, () => {
//   console.log(`Gateway running on port ${PORT}`);
// });


