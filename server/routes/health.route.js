import express from "express";
import {
  getDbHealthDetails,
  getHealth,
} from "../controllers/get.health.controller.js";
const router = express.Router();

router.get("/health", getHealth);
router.get("/health/db", getDbHealthDetails);
export default router;
