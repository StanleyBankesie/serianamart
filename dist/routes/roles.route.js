import express from "express";

import { updateRole, getUserRole } from "../controllers/roles.controller.js";
import {
  requireAuth,
  requirePermission,
  requireCompanyScope,
} from "../middleware/auth.js";
const router = express.Router();

router.put(
  "/role/:id",
  requireAuth,
  requireCompanyScope,
  requirePermission("ADMIN.ROLES.MANAGE"),
  updateRole,
);
router.get("/user/:id", getUserRole);
export default router;
