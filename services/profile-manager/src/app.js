import express from "express";
import cors from "cors";
import morgan from "morgan";
import authRoutes from "./routes/authRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import errorMiddleware from "./middleware/errorMiddleware.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.use("/auth", authRoutes);
app.use("/profile", profileRoutes);

app.use(errorMiddleware);

export default app;
