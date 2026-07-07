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

router.get("/home-overview", requireAuth, requireCompanyScope, requireBranchScope, async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = "" } = req.scope || {};

    const pct = (cur, prev) => {
      const a = Number(cur || 0);
      const b = Number(prev || 0);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
      if (b === 0) return null;
      return ((a - b) * 100) / b;
    };

    const badgeFromPct = (pctValue, suffix) => {
      const p = Number(pctValue);
      if (!Number.isFinite(p)) return "";
      const rounded = Math.round(Math.abs(p) * 10) / 10;
      if (rounded === 0) return `— ${suffix}`;
      const arrow = p > 0 ? "↑" : "↓";
      return `${arrow} ${rounded}% ${suffix}`;
    };

    const [todaySalesRow] = await query(
      `SELECT COALESCE(SUM(total_amount),0) AS total, COUNT(*) AS count
       FROM sal_invoices
       WHERE company_id = :companyId
         AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
         AND DATE(invoice_date) = CURDATE()`,
      { companyId, branchId, branchIdsStr },
    ).catch(() => [{ total: 0, count: 0 }]);
    const [yesterdaySalesRow] = await query(
      `SELECT COALESCE(SUM(total_amount),0) AS total
       FROM sal_invoices
       WHERE company_id = :companyId
         AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
         AND DATE(invoice_date) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)`,
      { companyId, branchId, branchIdsStr },
    ).catch(() => [{ total: 0 }]);
    const [monthSalesRow] = await query(
      `SELECT COALESCE(SUM(total_amount),0) AS total, COUNT(*) AS count
       FROM sal_invoices
       WHERE company_id = :companyId
         AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
         AND YEAR(invoice_date) = YEAR(CURDATE())
         AND MONTH(invoice_date) = MONTH(CURDATE())`,
      { companyId, branchId, branchIdsStr },
    ).catch(() => [{ total: 0, count: 0 }]);
    const [lastMonthSalesRow] = await query(
      `SELECT COALESCE(SUM(total_amount),0) AS total, COUNT(*) AS count
       FROM sal_invoices
       WHERE company_id = :companyId
         AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
         AND YEAR(invoice_date) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
         AND MONTH(invoice_date) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))`,
      { companyId, branchId, branchIdsStr },
    ).catch(() => [{ total: 0, count: 0 }]);
    const [customersRow] = await query(
      `SELECT COUNT(*) AS count
       FROM sal_customers
       WHERE company_id = :companyId`,
      { companyId },
    ).catch(() => [{ count: 0 }]);
    const [newCustomersThisMonthRow] = await query(
      `SELECT COUNT(*) AS count
       FROM sal_customers
       WHERE company_id = :companyId
         AND YEAR(created_at) = YEAR(CURDATE())
         AND MONTH(created_at) = MONTH(CURDATE())`,
      { companyId },
    ).catch(() => [{ count: 0 }]);
    const [newCustomersLastMonthRow] = await query(
      `SELECT COUNT(*) AS count
       FROM sal_customers
       WHERE company_id = :companyId
         AND YEAR(created_at) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
         AND MONTH(created_at) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))`,
      { companyId },
    ).catch(() => [{ count: 0 }]);

    const todaySales = Math.round(Number(todaySalesRow?.total || 0) * 100) / 100;
    const yesterdaySales = Math.round(Number(yesterdaySalesRow?.total || 0) * 100) / 100;
    const monthlyRevenue = Math.round(Number(monthSalesRow?.total || 0) * 100) / 100;
    const lastMonthRevenue = Math.round(Number(lastMonthSalesRow?.total || 0) * 100) / 100;
    const monthCount = Number(monthSalesRow?.count || 0) || 0;
    const lastMonthCount = Number(lastMonthSalesRow?.count || 0) || 0;
    const averageOrder = monthCount > 0 ? Math.round((monthlyRevenue / monthCount) * 100) / 100 : 0;
    const lastMonthAverageOrder = lastMonthCount > 0 ? Math.round((lastMonthRevenue / lastMonthCount) * 100) / 100 : 0;

    const totalCustomers = Number(customersRow?.count || 0) || 0;
    const newCustomersThisMonth = Number(newCustomersThisMonthRow?.count || 0) || 0;
    const newCustomersLastMonth = Number(newCustomersLastMonthRow?.count || 0) || 0;

    const badges = {
      "today-sales": {
        text: badgeFromPct(pct(todaySales, yesterdaySales), "VS YESTERDAY"),
      },
      "total-customers": {
        text:
          newCustomersLastMonth > 0
            ? badgeFromPct(pct(newCustomersThisMonth, newCustomersLastMonth), "NEW VS LAST MONTH")
            : newCustomersThisMonth > 0
              ? `↑ ${newCustomersThisMonth} NEW THIS MONTH`
              : "— NEW THIS MONTH",
      },
      "average-order": {
        text: badgeFromPct(pct(averageOrder, lastMonthAverageOrder), "VS LAST MONTH"),
      },
      "monthly-revenue": {
        text: badgeFromPct(pct(monthlyRevenue, lastMonthRevenue), "VS LAST MONTH"),
      },
    };

    res.json({
      todaySales,
      totalCustomers,
      averageOrder,
      monthlyRevenue,
      badges,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
