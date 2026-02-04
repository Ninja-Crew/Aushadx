import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import morgan from "morgan";
import dotenv from "dotenv";
import verifyToken from "./middleware/verifyToken.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Services URLs
const PROFILE_SERVICE_URL = process.env.PROFILE_SERVICE_URL || "http://localhost:3000";
const MEDICINE_SCHEDULER_URL = process.env.MEDICINE_SCHEDULER_URL || "http://localhost:3002";
const MEDICINE_ANALYZER_URL = process.env.MEDICINE_ANALYZER_URL || "http://localhost:8000"; // Assuming port 8000 for python service or similar? Checking directory structure later, assuming Node.js probably diff port.

app.use(morgan("dev"));

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok", role: "gateway" }));

// Public Routes (Auth) - Proxy to profile-manager
app.use(
  "/auth",
  createProxyMiddleware({
    target: PROFILE_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
      "^/auth": "/auth", // Keep /auth prefix if downstream expects it, or strip it?
      // Profile manager likely has /auth routes. Let's check profile-manager routes.
      // Profile manager routes mostly handled by mounting on /auth probably. 
      // Assuming profile-manager has /auth/login etc.
    },
  })
);

// Protected Routes

// Profile Service
app.use(
  "/profile",
  verifyToken,
  (req, res, next) => {
      // Attach user info to headers if needed
      // http-proxy-middleware options can modify headers but inside the handler is easier before proxy
      next(); 
  },
  createProxyMiddleware({
    target: PROFILE_SERVICE_URL,
    changeOrigin: true,
    onProxyReq: (proxyReq, req, res) => {
        if (req.user) {
            proxyReq.setHeader('X-User-Id', req.user.sub || req.user.id);
            // We can also forward the Token as is, which is default behavior of headers.
        }
    }
  })
);

// Medicine Scheduler Service
app.use(
  "/reminders",
  verifyToken,
  createProxyMiddleware({
    target: MEDICINE_SCHEDULER_URL,
    changeOrigin: true,
    onProxyReq: (proxyReq, req, res) => {
        if (req.user) {
            proxyReq.setHeader('X-User-Id', req.user.sub || req.user.id);
        }
    }
  })
);

// Medicine Analyzer Service
// Assuming it has an endpoint like /analyze
app.use(
    "/analyze",
    verifyToken,
    createProxyMiddleware({
      target: MEDICINE_ANALYZER_URL,
      changeOrigin: true,
      pathRewrite: {
        "^/analyze": "/api/analyze", // Rewrite /analyze to /api/analyze for downstream
      },
      onProxyReq: (proxyReq, req, res) => {
        if (req.user) {
            proxyReq.setHeader('X-User-Id', req.user.sub || req.user.id);
        }
      }
    })
  );

export default app;
