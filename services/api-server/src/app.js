import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import morgan from "morgan";
import dotenv from "dotenv";
import verifyToken from "./middleware/verifyToken.js";
import apiLimiter from "./middleware/rateLimit.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Services URLs
const PROFILE_SERVICE_URL = process.env.PROFILE_SERVICE_URL || "http://localhost:3000";
const MEDICINE_SCHEDULER_URL = process.env.MEDICINE_SCHEDULER_URL || "http://localhost:3002";
const MEDICINE_ANALYZER_URL = process.env.MEDICINE_ANALYZER_URL || "http://localhost:8000";

app.use(morgan("dev"));

// 1. Rate Limiting (Global or per-route)
app.use(apiLimiter);

// 2. Health Check
app.get("/health", (_req, res) => res.json({ status: "ok", role: "gateway" }));

// 3. Public Routes (Auth) - Proxy to profile-manager
// No verification here, Profile Manager handles login/signup
app.use(
  "/auth",
  createProxyMiddleware({
    target: PROFILE_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path, req) => '/auth' + path, // Explicitly prepend /auth
  })
);

// 4. Protected Routes
// All subsequent routes require a valid JWT signed by Profile Manager

// Middleware to inject user ID into headers
const injectUserHeader = (proxyReq, req, res) => {
    if (req.user) {
        // Injecting 'sub' as X-User-Id is standard OIDC practice
        proxyReq.setHeader('X-User-Id', req.user.sub || req.user.id);
        // We can also inject roles if needed
        if (req.user.roles) {
            proxyReq.setHeader('X-User-Roles', JSON.stringify(req.user.roles));
        }
    }
};

// Profile Service (Protected)
app.use(
  "/profile",
  verifyToken,
  createProxyMiddleware({
    target: PROFILE_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path, req) => '/profile' + path, // Explicitly prepend /profile
    onProxyReq: injectUserHeader
  })
);

// Medicine Scheduler Service
app.use(
  "/reminders",
  verifyToken,
  createProxyMiddleware({
    target: MEDICINE_SCHEDULER_URL,
    changeOrigin: true,
    pathRewrite: (path, req) => '/reminders' + path, // Explicitly prepend /reminders
    onProxyReq: injectUserHeader
  })
);

// Medicine Analyzer Service
app.use(
    "/analyze",
    verifyToken,
    createProxyMiddleware({
      target: MEDICINE_ANALYZER_URL,
      changeOrigin: true,
      pathRewrite: (path, req) => '/api/analyze' + path,
      onProxyReq: injectUserHeader
    })
  );

export default app;
