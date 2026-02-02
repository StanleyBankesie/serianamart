import express from "express";

import {
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
} from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import * as projectsController from "../controllers/projects.controller.js";

const router = express.Router();

function toNumber(v, fallback = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// ===== PROJECTS =====

router.get(
  "/projects",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PM.PROJECT.VIEW"),
  projectsController.listProjects
);

router.get(
  "/projects/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PM.PROJECT.VIEW"),
  projectsController.getProjectById
);

router.post(
  "/projects",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PM.PROJECT.MANAGE"),
  projectsController.createProject
);

export default router;
