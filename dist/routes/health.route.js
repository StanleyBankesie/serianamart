import express from "express";
import { getHealth } from "../controllers/get.health.controller.js";
const router = express.Router();

router.get("/health", getHealth);
export default router;
