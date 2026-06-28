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
// GET /dashboards - Retrieve configured dashboards for the user
router.get(
  "/dashboards",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("BI.DASHBOARD.VIEW"),
  (req, res, next) => getDashboards(req, res, next),
);

// ===== REPORTS =====

// GET /sales-report - Fetch aggregate sales report data
router.get(
  "/sales-report",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("BI.REPORT.VIEW"),
  (req, res, next) => getSalesReport(req, res, next),
);

// GET /purchase-report - Fetch aggregate purchase report data
router.get(
  "/purchase-report",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("BI.REPORT.VIEW"),
  (req, res, next) => getPurchaseReport(req, res, next),
);

// GET /inventory-report - Fetch aggregate inventory stock data
router.get(
  "/inventory-report",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("BI.REPORT.VIEW"),
  (req, res, next) => getInventoryReport(req, res, next),
);

// ===== DASHBOARD STATS =====
// GET /dashboard-stats - Fetch quick KPI statistics for BI dashboard
router.get("/dashboard-stats", requireAuth, requireCompanyScope, requireBranchScope, async (req, res, next) => {
  try {
    // Extract multi-branch access context
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    let dashboards = 0;
    let salesTotal = 0;
    let purchaseTotal = 0;
    let inventoryItems = 0;
    let hrEmployees = 0;
    try {
      // Calculate total sales amount and count for last 30 days
      const [s] = await query(
        "SELECT COUNT(*) as count, COALESCE(SUM(total_amount),0) as total FROM sal_invoices WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) AND invoice_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)",
        { companyId, branchId },
      );
      dashboards = 1;
      salesTotal = Number(s.total || 0);
    } catch {}
    try {
      // Calculate total purchase amount for last 30 days
      const [p] = await query(
        "SELECT COALESCE(SUM(total_amount),0) as total FROM pur_orders WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) AND po_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)",
        { companyId, branchId },
      );
      purchaseTotal = Number(p.total || 0);
    } catch {}
    try {
      // Get unique inventory item count
      const [inv] = await query(
        "SELECT COUNT(DISTINCT item_id) as count FROM inv_stock_balances WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))",
        { companyId, branchId },
      );
      inventoryItems = Number(inv.count || 0);
    } catch {}
    try {
      // Get active employee count
      const [hr] = await query(
        "SELECT COUNT(*) as count FROM hr_employees WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) AND status IN ('ACTIVE','PROBATION') AND deleted_at IS NULL",
        { companyId, branchId },
      );
      hrEmployees = Number(hr.count || 0);
    } catch {}
    
    // Return aggregated KPI data
    res.json({
      success: true,
      data: {
        activeDashboards: dashboards,
        sales30d: Math.round(salesTotal * 100) / 100,
        purchase30d: Math.round(purchaseTotal * 100) / 100,
        inventoryItems,
        hrEmployees,
        reportTypes: 4,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
