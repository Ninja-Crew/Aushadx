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

const app = express();
const PORT = process.env.PORT || 3001;

/* ================================
   INTERNAL SERVICE URLS (HTTP)
================================ */

const PROFILE_SERVICE_URL =
  process.env.PROFILE_SERVICE_URL || "http://localhost:3001";

const MEDICINE_SCHEDULER_URL =
  process.env.MEDICINE_SCHEDULER_URL || "http://localhost:3003";

const MEDICINE_ANALYZER_URL =
  process.env.MEDICINE_ANALYZER_URL || "http://localhost:3002";

const AGENT_SERVICE_URL =
  process.env.AGENT_SERVICE_URL || "ws://localhost:3004"; // Defaulting agent service to 3004 based on main.py

console.log("Services Config:");
console.log("- Profile:", PROFILE_SERVICE_URL);
console.log("- Scheduler:", MEDICINE_SCHEDULER_URL);
console.log("- Analyzer:", MEDICINE_ANALYZER_URL);
console.log("- Agent:", AGENT_SERVICE_URL);

import cors from "cors";

/* ================================
   GLOBAL MIDDLEWARE
================================ */

app.use(cors());
app.use(morgan("combined"));
app.use(apiLimiter);
// app.use(express.json()); // Moved after proxies to avoid stream consumption issues

app.get("/health", (_req, res) =>
  res.status(200).json({ status: "ok", role: "gateway" })
);

/* ================================
   PUBLIC ROUTES
================================ */

app.use(
  "/auth",
  createProxyMiddleware({
    target: PROFILE_SERVICE_URL + "/auth",
    changeOrigin: true,
    proxyTimeout: 5000,
  })
);

/* ================================
   USER HEADER INJECTION
================================ */

const injectUserHeader = (proxyReq, req) => {
  if (req.user) {
    proxyReq.setHeader("X-User-Id", req.user.sub);
    // Profile Manager's JWKS might return 'sub' or 'id', adjust based on actual token claim
    if (req.user.roles) {
      proxyReq.setHeader(
        "X-User-Roles",
        JSON.stringify(req.user.roles)
      );
    }
  }
};

const injectUserParam = (req, res, next) => {
  if (req.user && req.user.sub) {
    const url = req.url;
    const qIndex = url.indexOf("?");

    let path;
    let query;

    if (qIndex >= 0) {
      path = url.substring(0, qIndex);
      query = url.substring(qIndex);
    } else {
      path = url;
      query = "";
    }

    if (path.endsWith("/")) {
      req.url = path + req.user.sub + query;
    } else {
      req.url = path + "/" + req.user.sub + query;
    }
  }
  next();
};

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
        proxyTimeout: 5000,
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
        proxyTimeout: 5000,
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
        proxyTimeout: 5 * 60000,
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

// Body parser for non-proxy routes (if any)
app.use(express.json());

/* =========================================
   CREATE HTTP SERVER (ALB handles TLS)
========================================= */

const server = http.createServer(app);

/* =========================================
   WEBSOCKET PROXY (SECURED)
========================================= */

const wsProxy = createProxyServer({
  target: AGENT_SERVICE_URL,
  ws: true,
  changeOrigin: true,
});

server.on("upgrade", async (req, socket, head) => {
  try {
    // Only allow /ws path
    if (!req.url.startsWith("/ws")) {
      socket.destroy();
      return;
    }

    // Extract token
    // WebSocket connect URL might be /ws?token=... or headers. 
    // Standard JS WebSocket doesn't support headers easily, usually query param or protocol.
    // User request showed: const authHeader = req.headers["authorization"];
    // This implies using a client that supports headers or passing it some other way.
    // We will support both Query Param and Header for flexibility.
    
    let token = "";
    if (req.headers["authorization"]) {
        token = req.headers["authorization"].split(" ")[1];
    } else {
        // Fallback to query param ?token=...
        const url = new URL(req.url, `http://${req.headers.host}`);
        token = url.searchParams.get("token");
    }

    if (!token) throw new Error("Missing token");

    // Verify JWT using shared JWKS
    const decoded = await verifyJWT(token);

    req.user = decoded;

    // Inject user info for agent
    req.headers["x-user-id"] = decoded.sub;

    // Pass userId as param in the url
    const separator = req.url.includes("?") ? "&" : "?";
    req.url += `${separator}userId=${decoded.sub}`;

    wsProxy.ws(req, socket, head);

  } catch (err) {
    console.error("WebSocket auth failed:", err.message);
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
  }
});

/* =========================================
   START SERVER
========================================= */

// server.listen(PORT, () => {
//   console.log(`Gateway running on port ${PORT}`);
// });

export { app, server };
export default app;
