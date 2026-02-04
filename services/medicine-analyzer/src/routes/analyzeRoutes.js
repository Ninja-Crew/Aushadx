import express from "express";
import analyzeController from "../controllers/analyzeController.js";

const router = express.Router();

router.post("/analyze/:user_id", analyzeController.analyze);


export default router;
