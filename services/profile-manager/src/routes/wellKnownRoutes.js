import { getJWKS } from "../utils/keys.js";
import express from "express";

const router = express.Router();

router.get("/jwks.json", (req, res) => {
  res.json(getJWKS());
});

export default router;
