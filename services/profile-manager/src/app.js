import express from "express";
import cors from "cors";
import morgan from "morgan";
import authRoutes from "./routes/authRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import errorMiddleware from "./middleware/errorMiddleware.js";
import { initTwilio } from "./services/twilioService.js";
import wellKnownRoutes from "./routes/wellKnownRoutes.js";
import { initKeystore, startRotationSchedule } from "./utils/keys.js";

// Initialize keys
await initKeystore();
startRotationSchedule();

// Initialize Twilio
initTwilio();

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "profile-manager" });
});

// Debug Middleware removed

app.use("/.well-known", wellKnownRoutes);
app.use("/auth", authRoutes);
app.use("/profile", profileRoutes);

app.use(errorMiddleware);

export default app;
