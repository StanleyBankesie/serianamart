import express from "express";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { getUsers } from "../controllers/users.controller.js";
const router = express.Router();

router.get(
  "/users",
  requireAuth,
  requirePermission("ADMIN.USERS.VIEW"),
  getUsers,
);
