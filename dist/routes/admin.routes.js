import express from "express";
import {
  getRoles,
  createRole,
  updateRole,
  getRoleModules,
  saveRoleModules,
  getRolePermissions,
  saveRolePermissions,
} from "../controllers/rbac.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// ROLES ROUTES
router.get("/roles", requireAuth, getRoles);
router.post("/roles", requireAuth, createRole);
router.put("/roles/:id", requireAuth, updateRole);

// ROLE MODULES ROUTES
router.get("/role-modules/:roleId", requireAuth, getRoleModules);
router.post("/role-modules", requireAuth, saveRoleModules);

// ROLE PERMISSIONS ROUTES
router.get("/role-permissions/:roleId", requireAuth, getRolePermissions);
router.post("/role-permissions", requireAuth, saveRolePermissions);

export default router;
