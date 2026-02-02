import express from "express";

import {
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
} from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { query } from "../db/pool.js";
import {
  getDashboards,
  getSalesReport,
  getPurchaseReport,
  getInventoryReport,
} from "../controllers/bi.controller.js";

const router = express.Router();

// ===== DASHBOARDS =====

router.get(
  "/dashboards",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("BI.DASHBOARD.VIEW"),
  (req, res, next) => getDashboards(req, res, next),
);

// ===== REPORTS =====

router.get(
  "/sales-report",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("BI.REPORT.VIEW"),
  (req, res, next) => getSalesReport(req, res, next),
);

router.get(
  "/purchase-report",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("BI.REPORT.VIEW"),
  (req, res, next) => getPurchaseReport(req, res, next),
);

router.get(
  "/inventory-report",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("BI.REPORT.VIEW"),
  (req, res, next) => getInventoryReport(req, res, next),
);

export default router;
