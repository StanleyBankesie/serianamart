import express from "express";
import { dbConfig } from "../controllers/db.controller.js";
const router = express.Router();

router.get("/db/config", dbConfig);
export default router;
