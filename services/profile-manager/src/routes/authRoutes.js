import express from "express";
import * as authController from "../controllers/authController.js";

const router = express.Router();

// Existing routes
router.post("/signup", authController.signup);
router.post("/login", authController.login);
router.post("/refresh", authController.refresh);
router.get("/verify/:user_id", authController.verify);

// New OTP-based registration flow routes
router.post("/request-otp", authController.requestOTP);
router.post("/verify-otp", authController.verifyOTP);

// Forgot password flow routes
router.post("/forgot-password", authController.forgotPassword);
router.post("/verify-reset-otp", authController.verifyResetOTP);
router.post("/reset-password", authController.resetPassword);

export default router;
