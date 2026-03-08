import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import * as profileController from "../controllers/profileController.js";

const router = express.Router();

// router.use(authMiddleware);

router.get("/:user_id", profileController.getProfile);
router.get("/medical-info/:user_id", profileController.getMedicalInfo);
router.put("/:user_id", profileController.updateProfile);
router.patch("/fcm-token/:user_id", profileController.updateFcmToken);
router.delete("/:user_id", profileController.deleteProfile);

export default router;
