import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import * as profileController from "../controllers/profileController.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/:user_id", profileController.getProfile);
router.get("/:user_id/medical-info", profileController.getMedicalInfo);
router.put("/:user_id", profileController.updateProfile);
router.delete("/:user_id", profileController.deleteProfile);

export default router;
