import express from "express";

import {
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
} from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import * as productionController from "../controllers/production.controller.js";

const router = express.Router();

function toNumber(v, fallback = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// ===== WORK ORDERS =====

router.get(
  "/work-orders",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PROD.WORK_ORDER.VIEW"),
  productionController.listWorkOrders
);

router.get(
  "/work-orders/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PROD.WORK_ORDER.VIEW"),
  productionController.getWorkOrderById
);

router.post(
  "/work-orders",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PROD.WORK_ORDER.MANAGE"),
  productionController.createWorkOrder
);

export default router;
