import express from "express";

import {
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
} from "../middleware/auth.js";
import { query } from "../db/pool.js";
import {
  getDashboards,
  getSalesReport,
  getPurchaseReport,
  getInventoryReport,
  getHomeOverview,
  getModuleAnalytics,
} from "../controllers/bi.controller.js";

const router = express.Router();

// Shared auth middleware for all BI routes
router.use(requireAuth, requireCompanyScope, requireBranchScope);

// Utility: safe query with fallback
async function sq(sql, params, fallback = []) {
  try {
    const rows = await query(sql, params);
    return Array.isArray(rows) ? rows : fallback;
  } catch {
    return fallback;
  }
}

// ===== LEGACY ROUTES =====
router.get("/module-analytics", (req, res, next) => getModuleAnalytics(req, res, next));

router.get("/dashboards", (req, res, next) => getDashboards(req, res, next));
router.get("/home-overview", (req, res, next) => getHomeOverview(req, res, next));
router.get("/sales-report", (req, res, next) => getSalesReport(req, res, next));
router.get("/purchase-report", (req, res, next) => getPurchaseReport(req, res, next));
router.get("/inventory-report", (req, res, next) => getInventoryReport(req, res, next));

// ===== DASHBOARD STATS (legacy for landing page) =====
router.get("/dashboard-stats", async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = "" } = req.scope || {};
    const p = { companyId, branchId, branchIdsStr };

    const [[s], [pu], [inv], [hr]] = await Promise.all([
      sq("SELECT COALESCE(SUM(total_amount),0) as total FROM sal_invoices WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id,:branchIdsStr)) AND invoice_date >= DATE_SUB(NOW(),INTERVAL 30 DAY)", p, [{ total: 0 }]),
      sq("SELECT COALESCE(SUM(total_amount),0) as total FROM pur_orders WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id,:branchIdsStr)) AND po_date >= DATE_SUB(NOW(),INTERVAL 30 DAY)", p, [{ total: 0 }]),
      sq("SELECT COUNT(DISTINCT item_id) as count FROM inv_stock_balances WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id,:branchIdsStr))", p, [{ count: 0 }]),
      sq("SELECT COUNT(*) as count FROM hr_employees WHERE company_id = :companyId AND status IN ('ACTIVE','PROBATION') AND deleted_at IS NULL", p, [{ count: 0 }]),
    ]);

    res.json({
      success: true,
      data: {
        activeDashboards: 1,
        sales30d: Number(s?.total || 0),
        purchase30d: Number(pu?.total || 0),
        inventoryItems: Number(inv?.count || 0),
        hrEmployees: Number(hr?.count || 0),
        reportTypes: 4,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ===== EXECUTIVE DASHBOARD =====
router.get("/executive-dashboard", async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = "" } = req.scope || {};
    const p = { companyId, branchId, branchIdsStr };

    const [
      [revenue], [purchases], [invSummary], [projects], [employees],
      [posSales], [vehicles], [maintenance],
      revTrend, purTrend, projectsByStatus, posTrend,
    ] = await Promise.all([
      sq(`SELECT
          COALESCE(SUM(CASE WHEN MONTH(invoice_date)=MONTH(CURDATE()) AND YEAR(invoice_date)=YEAR(CURDATE()) THEN total_amount ELSE 0 END),0) as thisMonth,
          COALESCE(SUM(CASE WHEN MONTH(invoice_date)=MONTH(DATE_SUB(CURDATE(),INTERVAL 1 MONTH)) AND YEAR(invoice_date)=YEAR(DATE_SUB(CURDATE(),INTERVAL 1 MONTH)) THEN total_amount ELSE 0 END),0) as lastMonth,
          COALESCE(SUM(total_amount),0) as allTime
          FROM sal_invoices WHERE company_id=:companyId AND (:branchIdsStr='' OR FIND_IN_SET(branch_id,:branchIdsStr)) AND status NOT IN ('CANCELLED','DRAFT')`, p, [{ thisMonth: 0, lastMonth: 0, allTime: 0 }]),
      sq(`SELECT
          COALESCE(SUM(CASE WHEN MONTH(po_date)=MONTH(CURDATE()) AND YEAR(po_date)=YEAR(CURDATE()) THEN total_amount ELSE 0 END),0) as thisMonth,
          COALESCE(SUM(total_amount),0) as allTime
          FROM pur_orders WHERE company_id=:companyId AND (:branchIdsStr='' OR FIND_IN_SET(branch_id,:branchIdsStr)) AND status NOT IN ('CANCELLED')`, p, [{ thisMonth: 0, allTime: 0 }]),
      sq(`SELECT COUNT(DISTINCT sb.item_id) as itemCount,
          COALESCE(SUM(sb.qty * COALESCE(ip.unit_price,0)),0) as stockValue,
          SUM(CASE WHEN sb.qty <= COALESCE(r.reorder_level,0) THEN 1 ELSE 0 END) as belowReorder
          FROM inv_stock_balances sb
          LEFT JOIN inv_product_prices ip ON ip.item_id=sb.item_id
          LEFT JOIN inv_reorder_points r ON r.item_id=sb.item_id AND r.company_id=sb.company_id
          WHERE sb.company_id=:companyId AND (:branchIdsStr='' OR FIND_IN_SET(sb.branch_id,:branchIdsStr))`, p, [{ itemCount: 0, stockValue: 0, belowReorder: 0 }]),
      sq(`SELECT COUNT(*) as total,
          SUM(CASE WHEN status IN ('IN_PROGRESS','active') THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END) as completed
          FROM pm_projects WHERE company_id=:companyId AND deleted_at IS NULL`, p, [{ total: 0, active: 0, completed: 0 }]),
      sq(`SELECT COUNT(*) as total, SUM(CASE WHEN status='ACTIVE' THEN 1 ELSE 0 END) as active
          FROM hr_employees WHERE company_id=:companyId AND deleted_at IS NULL`, p, [{ total: 0, active: 0 }]),
      sq(`SELECT COALESCE(SUM(net_amount),0) as today, COUNT(*) as txns
          FROM pos_sales WHERE company_id=:companyId AND (:branchIdsStr='' OR FIND_IN_SET(branch_id,:branchIdsStr)) AND DATE(sale_datetime)=CURDATE() AND status!='VOID'`, p, [{ today: 0, txns: 0 }]),
      sq(`SELECT COUNT(*) as total,
          SUM(CASE WHEN status='AVAILABLE' THEN 1 ELSE 0 END) as available,
          SUM(CASE WHEN status='IN_USE' THEN 1 ELSE 0 END) as inUse
          FROM trans_vehicles WHERE company_id=:companyId AND deleted_at IS NULL`, p, [{ total: 0, available: 0, inUse: 0 }]),
      sq(`SELECT COUNT(*) as open FROM maint_job_orders WHERE company_id=:companyId AND status NOT IN ('COMPLETED','CANCELLED') AND deleted_at IS NULL`, p, [{ open: 0 }]),
      sq(`SELECT DATE_FORMAT(invoice_date,'%Y-%m') as month, COALESCE(SUM(total_amount),0) as revenue
          FROM sal_invoices WHERE company_id=:companyId AND (:branchIdsStr='' OR FIND_IN_SET(branch_id,:branchIdsStr)) AND status NOT IN ('CANCELLED','DRAFT')
          AND invoice_date >= DATE_SUB(CURDATE(),INTERVAL 6 MONTH)
          GROUP BY DATE_FORMAT(invoice_date,'%Y-%m') ORDER BY month ASC`, p, []),
      sq(`SELECT DATE_FORMAT(po_date,'%Y-%m') as month, COALESCE(SUM(total_amount),0) as spend
          FROM pur_orders WHERE company_id=:companyId AND (:branchIdsStr='' OR FIND_IN_SET(branch_id,:branchIdsStr)) AND status NOT IN ('CANCELLED')
          AND po_date >= DATE_SUB(CURDATE(),INTERVAL 6 MONTH)
          GROUP BY DATE_FORMAT(po_date,'%Y-%m') ORDER BY month ASC`, p, []),
      sq(`SELECT status, COUNT(*) as count FROM pm_projects WHERE company_id=:companyId AND deleted_at IS NULL GROUP BY status`, p, []),
      sq(`SELECT DATE(sale_datetime) as day, COALESCE(SUM(net_amount),0) as sales, COUNT(*) as txns
          FROM pos_sales WHERE company_id=:companyId AND (:branchIdsStr='' OR FIND_IN_SET(branch_id,:branchIdsStr)) AND status!='VOID'
          AND sale_datetime >= DATE_SUB(CURDATE(),INTERVAL 7 DAY)
          GROUP BY DATE(sale_datetime) ORDER BY day ASC`, p, []),
    ]);

    const thisMonthRevenue = Number(revenue?.thisMonth || 0);
    const lastMonthRevenue = Number(revenue?.lastMonth || 0);
    const revenueGrowth =
      lastMonthRevenue > 0
        ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue * 100).toFixed(1)
        : thisMonthRevenue > 0 ? 100 : 0;

    res.json({
      success: true,
      data: {
        kpis: {
          revenue: { thisMonth: thisMonthRevenue, lastMonth: lastMonthRevenue, allTime: Number(revenue?.allTime || 0), growth: Number(revenueGrowth) },
          expenses: { thisMonth: Number(purchases?.thisMonth || 0), allTime: Number(purchases?.allTime || 0) },
          grossProfit: { thisMonth: thisMonthRevenue - Number(purchases?.thisMonth || 0) },
          inventory: { itemCount: Number(invSummary?.itemCount || 0), stockValue: Number(invSummary?.stockValue || 0), belowReorder: Number(invSummary?.belowReorder || 0) },
          projects: { total: Number(projects?.total || 0), active: Number(projects?.active || 0), completed: Number(projects?.completed || 0) },
          hr: { total: Number(employees?.total || 0), active: Number(employees?.active || 0) },
          pos: { todaySales: Number(posSales?.today || 0), todayTxns: Number(posSales?.txns || 0) },
          fleet: { total: Number(vehicles?.total || 0), available: Number(vehicles?.available || 0), inUse: Number(vehicles?.inUse || 0) },
          maintenance: { openJobs: Number(maintenance?.open || 0) },
        },
        charts: {
          revenueTrend: revTrend,
          purchaseTrend: purTrend,
          projectsByStatus,
          posDailyTrend: posTrend,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// ===== FINANCIAL ANALYTICS =====
router.get("/financial", async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = "" } = req.scope || {};
    const months = parseInt(req.query.months) || 12;
    const p = { companyId, branchId, branchIdsStr };

    const [revTrend, purTrend, topCustomers, topSuppliers] = await Promise.all([
      sq(`SELECT DATE_FORMAT(invoice_date,'%Y-%m') as month, COALESCE(SUM(total_amount),0) as revenue, COUNT(*) as invoices
          FROM sal_invoices WHERE company_id=:companyId AND (:branchIdsStr='' OR FIND_IN_SET(branch_id,:branchIdsStr)) AND status NOT IN ('CANCELLED','DRAFT')
          AND invoice_date >= DATE_SUB(CURDATE(),INTERVAL ${months} MONTH)
          GROUP BY DATE_FORMAT(invoice_date,'%Y-%m') ORDER BY month ASC`, p, []),
      sq(`SELECT DATE_FORMAT(po_date,'%Y-%m') as month, COALESCE(SUM(total_amount),0) as spend, COUNT(*) as orders
          FROM pur_orders WHERE company_id=:companyId AND (:branchIdsStr='' OR FIND_IN_SET(branch_id,:branchIdsStr)) AND status NOT IN ('CANCELLED')
          AND po_date >= DATE_SUB(CURDATE(),INTERVAL ${months} MONTH)
          GROUP BY DATE_FORMAT(po_date,'%Y-%m') ORDER BY month ASC`, p, []),
      sq(`SELECT c.customer_name, COALESCE(SUM(i.total_amount),0) as revenue, COUNT(*) as invoices
          FROM sal_invoices i JOIN sal_customers c ON i.customer_id=c.id
          WHERE i.company_id=:companyId AND (:branchIdsStr='' OR FIND_IN_SET(i.branch_id,:branchIdsStr)) AND i.status NOT IN ('CANCELLED','DRAFT')
          GROUP BY i.customer_id, c.customer_name ORDER BY revenue DESC LIMIT 10`, p, []),
      sq(`SELECT s.supplier_name, COALESCE(SUM(o.total_amount),0) as spend, COUNT(*) as orders
          FROM pur_orders o JOIN pur_suppliers s ON o.supplier_id=s.id
          WHERE o.company_id=:companyId AND (:branchIdsStr='' OR FIND_IN_SET(o.branch_id,:branchIdsStr)) AND o.status NOT IN ('CANCELLED')
          GROUP BY o.supplier_id, s.supplier_name ORDER BY spend DESC LIMIT 10`, p, []),
    ]);

    res.json({ success: true, data: { revenueTrend: revTrend, purchaseTrend: purTrend, topCustomers, topSuppliers } });
  } catch (err) {
    next(err);
  }
});

// ===== INVENTORY ANALYTICS =====
router.get("/inventory", async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = "" } = req.scope || {};
    const p = { companyId, branchId, branchIdsStr };

    const [byCategory, lowStock, topItems] = await Promise.all([
      sq(`SELECT c.category_name, COUNT(DISTINCT i.id) as itemCount, COALESCE(SUM(sb.qty),0) as totalQty
          FROM inv_items i
          JOIN inv_item_categories c ON i.category_id=c.id
          LEFT JOIN inv_stock_balances sb ON sb.item_id=i.id AND sb.company_id=:companyId AND (:branchIdsStr='' OR FIND_IN_SET(sb.branch_id,:branchIdsStr))
          WHERE i.company_id=:companyId GROUP BY c.id, c.category_name ORDER BY totalQty DESC LIMIT 10`, p, []),
      sq(`SELECT i.item_name, i.item_code, COALESCE(sb.qty,0) as qty, COALESCE(r.reorder_level,0) as reorderLevel
          FROM inv_items i
          LEFT JOIN inv_stock_balances sb ON sb.item_id=i.id AND sb.company_id=:companyId AND (:branchIdsStr='' OR FIND_IN_SET(sb.branch_id,:branchIdsStr))
          LEFT JOIN inv_reorder_points r ON r.item_id=i.id AND r.company_id=:companyId
          WHERE i.company_id=:companyId AND COALESCE(sb.qty,0) <= COALESCE(r.reorder_level,0) AND r.reorder_level IS NOT NULL
          ORDER BY qty ASC LIMIT 20`, p, []),
      sq(`SELECT i.item_name, i.item_code, COALESCE(SUM(ABS(sl.quantity)),0) as moved
          FROM inv_stock_ledger sl JOIN inv_items i ON sl.item_id=i.id
          WHERE sl.company_id=:companyId AND (:branchIdsStr='' OR FIND_IN_SET(sl.branch_id,:branchIdsStr)) AND sl.created_at >= DATE_SUB(CURDATE(),INTERVAL 30 DAY) AND sl.transaction_type IN ('OUT','SALE','ISSUE')
          GROUP BY sl.item_id, i.item_name, i.item_code ORDER BY moved DESC LIMIT 10`, p, []),
    ]);

    res.json({ success: true, data: { byCategory, lowStock, topMovingItems: topItems } });
  } catch (err) {
    next(err);
  }
});

// ===== PROJECT ANALYTICS =====
router.get("/projects", async (req, res, next) => {
  try {
    const { companyId, branchIdsStr = "" } = req.scope || {};
    const p = { companyId, branchIdsStr };

    const [summary, byStatus, recentProjects, budgetAnalysis] = await Promise.all([
      sq(`SELECT COUNT(*) as total,
          SUM(CASE WHEN status IN ('IN_PROGRESS','active') THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status='PENDING' THEN 1 ELSE 0 END) as pending,
          COALESCE(SUM(budget),0) as totalBudget
          FROM pm_projects WHERE company_id=:companyId AND deleted_at IS NULL`, p, [{ total: 0, active: 0, completed: 0, pending: 0, totalBudget: 0 }]),
      sq(`SELECT status, COUNT(*) as count FROM pm_projects WHERE company_id=:companyId AND deleted_at IS NULL GROUP BY status`, p, []),
      sq(`SELECT p.project_name, p.status, p.budget, COALESCE(SUM(e.amount),0) as spent, p.start_date, p.end_date
          FROM pm_projects p LEFT JOIN pm_expenses e ON e.project_id=p.id
          WHERE p.company_id=:companyId AND p.deleted_at IS NULL GROUP BY p.id ORDER BY p.created_at DESC LIMIT 10`, p, []),
      sq(`SELECT p.project_name, p.budget, COALESCE(SUM(e.amount),0) as spent,
          CASE WHEN p.budget > 0 THEN ROUND(COALESCE(SUM(e.amount),0)/p.budget*100,1) ELSE 0 END as budgetUsedPct
          FROM pm_projects p LEFT JOIN pm_expenses e ON e.project_id=p.id
          WHERE p.company_id=:companyId AND p.status IN ('IN_PROGRESS','active') AND p.deleted_at IS NULL
          GROUP BY p.id, p.project_name, p.budget ORDER BY budgetUsedPct DESC LIMIT 10`, p, []),
    ]);

    res.json({ success: true, data: { summary: summary[0], byStatus, recentProjects, budgetAnalysis } });
  } catch (err) {
    next(err);
  }
});

// ===== HR ANALYTICS =====
router.get("/hr", async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const p = { companyId };

    const [summary, byDept, attendanceToday, recentHires] = await Promise.all([
      sq(`SELECT COUNT(*) as total,
          SUM(CASE WHEN status='ACTIVE' THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN status='PROBATION' THEN 1 ELSE 0 END) as probation
          FROM hr_employees WHERE company_id=:companyId AND deleted_at IS NULL`, p, [{ total: 0, active: 0, probation: 0 }]),
      sq(`SELECT d.department_name, COUNT(e.id) as count
          FROM hr_employees e JOIN hr_departments d ON e.department_id=d.id
          WHERE e.company_id=:companyId AND e.status='ACTIVE' AND e.deleted_at IS NULL
          GROUP BY d.id, d.department_name ORDER BY count DESC LIMIT 10`, p, []),
      sq(`SELECT SUM(CASE WHEN status='PRESENT' THEN 1 ELSE 0 END) as present,
          SUM(CASE WHEN status='ABSENT' THEN 1 ELSE 0 END) as absent,
          SUM(CASE WHEN status='LATE' THEN 1 ELSE 0 END) as late, COUNT(*) as total
          FROM hr_attendance WHERE company_id=:companyId AND DATE(attendance_date)=CURDATE()`, p, [{ present: 0, absent: 0, late: 0, total: 0 }]),
      sq(`SELECT first_name, last_name, date_joined FROM hr_employees
          WHERE company_id=:companyId AND deleted_at IS NULL ORDER BY date_joined DESC LIMIT 5`, p, []),
    ]);

    res.json({ success: true, data: { summary: summary[0], byDepartment: byDept, attendanceToday: attendanceToday[0], recentHires } });
  } catch (err) {
    next(err);
  }
});

// ===== POS ANALYTICS =====
router.get("/pos", async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = "" } = req.scope || {};
    const p = { companyId, branchId, branchIdsStr };

    const [[today], [thisMonth], dailyTrend, topProducts, byBranch] = await Promise.all([
      sq(`SELECT COALESCE(SUM(net_amount),0) as sales, COUNT(*) as txns, COALESCE(AVG(net_amount),0) as avgBasket
          FROM pos_sales WHERE company_id=:companyId AND (:branchIdsStr='' OR FIND_IN_SET(branch_id,:branchIdsStr)) AND DATE(sale_datetime)=CURDATE() AND status!='VOID'`, p, [{ sales: 0, txns: 0, avgBasket: 0 }]),
      sq(`SELECT COALESCE(SUM(net_amount),0) as sales, COUNT(*) as txns
          FROM pos_sales WHERE company_id=:companyId AND (:branchIdsStr='' OR FIND_IN_SET(branch_id,:branchIdsStr)) AND MONTH(sale_datetime)=MONTH(CURDATE()) AND YEAR(sale_datetime)=YEAR(CURDATE()) AND status!='VOID'`, p, [{ sales: 0, txns: 0 }]),
      sq(`SELECT DATE(sale_datetime) as day, COALESCE(SUM(net_amount),0) as sales, COUNT(*) as txns
          FROM pos_sales WHERE company_id=:companyId AND (:branchIdsStr='' OR FIND_IN_SET(branch_id,:branchIdsStr)) AND status!='VOID' AND sale_datetime >= DATE_SUB(CURDATE(),INTERVAL 30 DAY)
          GROUP BY DATE(sale_datetime) ORDER BY day ASC`, p, []),
      sq(`SELECT i.item_name, COALESCE(SUM(sl.qty),0) as unitsSold, COALESCE(SUM(sl.subtotal),0) as revenue
          FROM pos_sale_lines sl JOIN inv_items i ON sl.item_id=i.id
          JOIN pos_sales s ON sl.sale_id=s.id
          WHERE s.company_id=:companyId AND (:branchIdsStr='' OR FIND_IN_SET(s.branch_id,:branchIdsStr)) AND s.status!='VOID' AND s.sale_datetime >= DATE_SUB(CURDATE(),INTERVAL 30 DAY)
          GROUP BY sl.item_id, i.item_name ORDER BY revenue DESC LIMIT 10`, p, []),
      sq(`SELECT b.branch_name, COALESCE(SUM(ps.net_amount),0) as sales, COUNT(*) as txns
          FROM pos_sales ps JOIN adm_branches b ON ps.branch_id=b.id
          WHERE ps.company_id=:companyId AND (:branchIdsStr='' OR FIND_IN_SET(ps.branch_id,:branchIdsStr)) AND ps.status!='VOID' AND MONTH(ps.sale_datetime)=MONTH(CURDATE())
          GROUP BY ps.branch_id, b.branch_name ORDER BY sales DESC`, p, []),
    ]);

    res.json({ success: true, data: { today, thisMonth, dailyTrend, topProducts, byBranch } });
  } catch (err) {
    next(err);
  }
});

// ===== TRANSPORT ANALYTICS =====
router.get("/transport", async (req, res, next) => {
  try {
    const { companyId, branchIdsStr = "" } = req.scope || {};
    const p = { companyId, branchIdsStr };

    const [[vehicleSummary], [tripSummary], tripsTrend, topDrivers] = await Promise.all([
      sq(`SELECT COUNT(*) as total,
          SUM(CASE WHEN status='AVAILABLE' THEN 1 ELSE 0 END) as available,
          SUM(CASE WHEN status='IN_USE' THEN 1 ELSE 0 END) as inUse,
          SUM(CASE WHEN status='MAINTENANCE' THEN 1 ELSE 0 END) as maintenance
          FROM trans_vehicles WHERE company_id=:companyId AND deleted_at IS NULL`, p, [{ total: 0, available: 0, inUse: 0, maintenance: 0 }]),
      sq(`SELECT COUNT(*) as total,
          SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status='IN_PROGRESS' THEN 1 ELSE 0 END) as inProgress,
          SUM(CASE WHEN DATE(trip_date)=CURDATE() THEN 1 ELSE 0 END) as today
          FROM trans_trips WHERE company_id=:companyId AND (:branchIdsStr='' OR FIND_IN_SET(branch_id,:branchIdsStr))`, p, [{ total: 0, completed: 0, inProgress: 0, today: 0 }]),
      sq(`SELECT DATE_FORMAT(trip_date,'%Y-%m') as month, COUNT(*) as trips
          FROM trans_trips WHERE company_id=:companyId AND (:branchIdsStr='' OR FIND_IN_SET(branch_id,:branchIdsStr)) AND trip_date >= DATE_SUB(CURDATE(),INTERVAL 6 MONTH)
          GROUP BY DATE_FORMAT(trip_date,'%Y-%m') ORDER BY month ASC`, p, []),
      sq(`SELECT d.driver_name, COUNT(t.id) as trips, SUM(CASE WHEN t.status='COMPLETED' THEN 1 ELSE 0 END) as completed
          FROM trans_trips t JOIN trans_drivers d ON t.driver_id=d.id
          WHERE t.company_id=:companyId AND (:branchIdsStr='' OR FIND_IN_SET(t.branch_id,:branchIdsStr)) AND t.trip_date >= DATE_SUB(CURDATE(),INTERVAL 30 DAY)
          GROUP BY t.driver_id, d.driver_name ORDER BY trips DESC LIMIT 10`, p, []),
    ]);

    res.json({ success: true, data: { vehicles: vehicleSummary, trips: tripSummary, tripsTrend, topDrivers } });
  } catch (err) {
    next(err);
  }
});

// ===== MAINTENANCE ANALYTICS =====
router.get("/maintenance-analytics", async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const p = { companyId };

    const [[jobSummary], [assetSummary], recentJobs] = await Promise.all([
      sq(`SELECT COUNT(*) as total,
          SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status NOT IN ('COMPLETED','CANCELLED') THEN 1 ELSE 0 END) as open
          FROM maint_job_orders WHERE company_id=:companyId AND deleted_at IS NULL`, p, [{ total: 0, completed: 0, open: 0 }]),
      sq(`SELECT COUNT(*) as total,
          SUM(CASE WHEN status='ACTIVE' THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN status='UNDER_MAINTENANCE' THEN 1 ELSE 0 END) as underMaintenance
          FROM maint_assets WHERE company_id=:companyId AND deleted_at IS NULL`, p, [{ total: 0, active: 0, underMaintenance: 0 }]),
      sq(`SELECT job_number, description, status, priority, created_at FROM maint_job_orders
          WHERE company_id=:companyId AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 10`, p, []),
    ]);

    res.json({ success: true, data: { jobs: jobSummary, assets: assetSummary, recentJobs } });
  } catch (err) {
    next(err);
  }
});

// ===== PURCHASE ANALYTICS =====
router.get("/purchase", async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = "" } = req.scope || {};
    const months = parseInt(req.query.months) || 6;
    const p = { companyId, branchId, branchIdsStr };
    const [[summary], byStatus, spendTrend, topSuppliers] = await Promise.all([
      sq("SELECT COUNT(*) as total, SUM(CASE WHEN status IN ('APPROVED','RECEIVED') THEN 1 ELSE 0 END) as approved, SUM(CASE WHEN status='PENDING' THEN 1 ELSE 0 END) as pending, SUM(CASE WHEN status='CANCELLED' THEN 1 ELSE 0 END) as cancelled, COALESCE(SUM(total_amount),0) as totalSpend, COALESCE(AVG(total_amount),0) as avgOrder FROM pur_orders WHERE company_id=:companyId AND (:branchIdsStr='' OR FIND_IN_SET(branch_id,:branchIdsStr))", p, [{total:0,approved:0,pending:0,cancelled:0,totalSpend:0,avgOrder:0}]),
      sq("SELECT status, COUNT(*) as count FROM pur_orders WHERE company_id=:companyId AND (:branchIdsStr='' OR FIND_IN_SET(branch_id,:branchIdsStr)) GROUP BY status", p, []),
      sq(`SELECT DATE_FORMAT(po_date,'%Y-%m') as month, COALESCE(SUM(total_amount),0) as spend, COUNT(*) as orders FROM pur_orders WHERE company_id=:companyId AND (:branchIdsStr='' OR FIND_IN_SET(branch_id,:branchIdsStr)) AND status NOT IN ('CANCELLED') AND po_date >= DATE_SUB(CURDATE(),INTERVAL ${months} MONTH) GROUP BY DATE_FORMAT(po_date,'%Y-%m') ORDER BY month ASC`, p, []),
      sq("SELECT s.supplier_name, COUNT(o.id) as orders, COALESCE(SUM(o.total_amount),0) as spend FROM pur_orders o JOIN pur_suppliers s ON o.supplier_id=s.id WHERE o.company_id=:companyId AND (:branchIdsStr='' OR FIND_IN_SET(o.branch_id,:branchIdsStr)) AND o.status NOT IN ('CANCELLED') GROUP BY o.supplier_id, s.supplier_name ORDER BY spend DESC LIMIT 10", p, []),
    ]);
    res.json({ success: true, data: { summary, byStatus, spendTrend, topSuppliers } });
  } catch (err) { next(err); }
});

// ===== PRODUCTION ANALYTICS =====
router.get("/production", async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const p = { companyId };
    const [[summary], byStatus, outputTrend] = await Promise.all([
      sq("SELECT COUNT(*) as total, SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END) as completed, SUM(CASE WHEN status='IN_PROGRESS' THEN 1 ELSE 0 END) as inProgress, SUM(CASE WHEN status='PENDING' THEN 1 ELSE 0 END) as pending, COALESCE(SUM(CASE WHEN status='COMPLETED' THEN quantity_produced ELSE 0 END),0) as totalProduced FROM prod_work_orders WHERE company_id=:companyId AND deleted_at IS NULL", p, [{total:0,completed:0,inProgress:0,pending:0,totalProduced:0}]),
      sq("SELECT status, COUNT(*) as count FROM prod_work_orders WHERE company_id=:companyId AND deleted_at IS NULL GROUP BY status", p, []),
      sq("SELECT DATE_FORMAT(created_at,'%Y-%m') as month, COUNT(*) as orders, COALESCE(SUM(quantity_produced),0) as produced FROM prod_work_orders WHERE company_id=:companyId AND deleted_at IS NULL AND status='COMPLETED' AND created_at >= DATE_SUB(CURDATE(),INTERVAL 6 MONTH) GROUP BY DATE_FORMAT(created_at,'%Y-%m') ORDER BY month ASC", p, []),
    ]);
    res.json({ success: true, data: { summary, byStatus, outputTrend } });
  } catch (err) { next(err); }
});

// ===== SERVICE ANALYTICS =====
router.get("/service", async (req, res, next) => {
  try {
    const { companyId, branchIdsStr = "" } = req.scope || {};
    const p = { companyId, branchIdsStr };
    const [[summary], recentRequests] = await Promise.all([
      sq("SELECT COUNT(*) as total, SUM(CASE WHEN status IN ('OPEN','PENDING') THEN 1 ELSE 0 END) as open, SUM(CASE WHEN status IN ('COMPLETED','CLOSED') THEN 1 ELSE 0 END) as completed, SUM(CASE WHEN status='IN_PROGRESS' THEN 1 ELSE 0 END) as inProgress FROM sm_service_orders WHERE company_id=:companyId", p, [{total:0,open:0,completed:0,inProgress:0}]),
      sq("SELECT so_number, description, status, priority, created_at FROM sm_service_orders WHERE company_id=:companyId ORDER BY created_at DESC LIMIT 10", p, []),
    ]);
    res.json({ success: true, data: { summary, recentRequests } });
  } catch (err) { next(err); }
});

// ===== ADMINISTRATION ANALYTICS =====
router.get("/administration", async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const p = { companyId };
    const [[userSummary], roleDistribution] = await Promise.all([
      sq("SELECT COUNT(*) as total, SUM(CASE WHEN is_active=1 THEN 1 ELSE 0 END) as active, SUM(CASE WHEN is_active=0 THEN 1 ELSE 0 END) as inactive FROM adm_users WHERE company_id=:companyId AND deleted_at IS NULL", p, [{total:0,active:0,inactive:0}]),
      sq("SELECT r.role_name, COUNT(u.id) as userCount FROM adm_roles r LEFT JOIN adm_users u ON u.role_id=r.id AND u.company_id=:companyId AND u.deleted_at IS NULL WHERE r.company_id=:companyId GROUP BY r.id, r.role_name ORDER BY userCount DESC LIMIT 10", p, []),
    ]);
    res.json({ success: true, data: { users: userSummary, roleDistribution } });
  } catch (err) { next(err); }
});

// ===== CROSS MODULE ANALYTICS =====
router.get("/cross-module", async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = "" } = req.scope || {};
    const p = { companyId, branchId, branchIdsStr };
    const [projectProfitability, inventoryPosSales] = await Promise.all([
      sq("SELECT p.project_name, COALESCE((SELECT SUM(amount) FROM pm_income WHERE project_id=p.id),0) as revenue, COALESCE((SELECT SUM(amount) FROM pm_expenses WHERE project_id=p.id),0) as cost FROM pm_projects p WHERE p.company_id=:companyId AND p.status='COMPLETED' AND p.deleted_at IS NULL ORDER BY revenue DESC LIMIT 10", p, []),
      sq("SELECT i.item_name, COALESCE(SUM(sl.qty),0) as unitsSold, COALESCE(SUM(sl.subtotal),0) as posRevenue FROM pos_sale_lines sl JOIN pos_sales s ON sl.sale_id=s.id AND s.company_id=:companyId AND s.status!='VOID' JOIN inv_items i ON sl.item_id=i.id WHERE s.sale_datetime >= DATE_SUB(CURDATE(),INTERVAL 30 DAY) GROUP BY sl.item_id, i.item_name ORDER BY posRevenue DESC LIMIT 10", p, []),
    ]);
    res.json({ success: true, data: { projectProfitability, inventoryPosSales } });
  } catch (err) { next(err); }
});

// ===== AI INSIGHTS =====
router.get("/insights", async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = "" } = req.scope || {};
    const p = { companyId, branchId, branchIdsStr };
    const insights = [];
    const [[rev], lowStock, overBudget, openMaint] = await Promise.all([
      sq("SELECT COALESCE(SUM(CASE WHEN MONTH(invoice_date)=MONTH(CURDATE()) AND YEAR(invoice_date)=YEAR(CURDATE()) THEN total_amount ELSE 0 END),0) as thisMonth, COALESCE(SUM(CASE WHEN MONTH(invoice_date)=MONTH(DATE_SUB(CURDATE(),INTERVAL 1 MONTH)) AND YEAR(invoice_date)=YEAR(DATE_SUB(CURDATE(),INTERVAL 1 MONTH)) THEN total_amount ELSE 0 END),0) as lastMonth FROM sal_invoices WHERE company_id=:companyId AND (:branchIdsStr='' OR FIND_IN_SET(branch_id,:branchIdsStr)) AND status NOT IN ('CANCELLED','DRAFT')", p, [{thisMonth:0,lastMonth:0}]),
      sq("SELECT COUNT(*) as cnt FROM inv_items i LEFT JOIN inv_stock_balances sb ON sb.item_id=i.id AND sb.company_id=:companyId LEFT JOIN inv_reorder_points r ON r.item_id=i.id AND r.company_id=:companyId WHERE i.company_id=:companyId AND COALESCE(sb.qty,0) <= COALESCE(r.reorder_level,0) AND r.reorder_level IS NOT NULL", p, [{cnt:0}]),
      sq("SELECT COUNT(*) as cnt FROM pm_projects p WHERE p.company_id=:companyId AND p.status IN ('IN_PROGRESS','active') AND p.budget > 0 AND p.deleted_at IS NULL AND (SELECT COALESCE(SUM(amount),0) FROM pm_expenses WHERE project_id=p.id) > p.budget", p, [{cnt:0}]),
      sq("SELECT COUNT(*) as cnt FROM maint_job_orders WHERE company_id=:companyId AND status NOT IN ('COMPLETED','CANCELLED') AND deleted_at IS NULL", p, [{cnt:0}]),
    ]);
    if (rev.lastMonth > 0) {
      const pct = ((rev.thisMonth - rev.lastMonth) / rev.lastMonth * 100).toFixed(1);
      if (Math.abs(pct) >= 5) insights.push({ type: pct >= 0 ? "positive" : "warning", category: "Revenue", title: "Revenue " + (pct >= 0 ? "increased" : "declined") + " by " + Math.abs(pct) + "%", description: "This month vs last month shows a " + Math.abs(pct) + "% " + (pct >= 0 ? "increase" : "decrease") + ".", recommendation: pct >= 0 ? "Sustain momentum by analyzing top-performing products." : "Investigate sales pipeline and customer churn." });
    }
    if (Number(lowStock[0]?.cnt||0) > 0) insights.push({ type: "warning", category: "Inventory", title: lowStock[0].cnt + " items below reorder level", description: "Immediate restocking required to prevent stockouts.", recommendation: "Generate purchase orders for affected items." });
    if (Number(overBudget[0]?.cnt||0) > 0) insights.push({ type: "critical", category: "Projects", title: overBudget[0].cnt + " projects exceeding budget", description: "Active projects have overspent their allocated budget.", recommendation: "Review project expenditures and request budget revisions." });
    if (Number(openMaint[0]?.cnt||0) > 5) insights.push({ type: "warning", category: "Maintenance", title: openMaint[0].cnt + " open maintenance jobs", description: "High volume of unresolved maintenance tasks.", recommendation: "Assign additional maintenance personnel to clear the backlog." });
    res.json({ success: true, data: { insights, generatedAt: new Date().toISOString() } });
  } catch (err) { next(err); }
});

// ===== ALERTS CENTER =====
router.get("/alerts", async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = "" } = req.scope || {};
    const p = { companyId, branchId, branchIdsStr };
    const alerts = [];
    const [lowStock, overBudget, vehicles, openMaint, pendingPOs] = await Promise.all([
      sq("SELECT i.item_name, COALESCE(sb.qty,0) as qty, COALESCE(r.reorder_level,0) as reorder FROM inv_items i LEFT JOIN inv_stock_balances sb ON sb.item_id=i.id AND sb.company_id=:companyId AND (:branchIdsStr='' OR FIND_IN_SET(sb.branch_id,:branchIdsStr)) LEFT JOIN inv_reorder_points r ON r.item_id=i.id AND r.company_id=:companyId WHERE i.company_id=:companyId AND COALESCE(sb.qty,0) <= COALESCE(r.reorder_level,0) AND r.reorder_level IS NOT NULL LIMIT 20", p, []),
      sq("SELECT p.project_name, p.budget, COALESCE(SUM(e.amount),0) as spent FROM pm_projects p LEFT JOIN pm_expenses e ON e.project_id=p.id WHERE p.company_id=:companyId AND p.status IN ('IN_PROGRESS','active') AND p.budget > 0 AND p.deleted_at IS NULL GROUP BY p.id, p.project_name, p.budget HAVING spent > p.budget LIMIT 10", p, []),
      sq("SELECT vehicle_number, model FROM trans_vehicles WHERE company_id=:companyId AND status='MAINTENANCE' AND deleted_at IS NULL LIMIT 10", p, []),
      sq("SELECT COUNT(*) as cnt FROM maint_job_orders WHERE company_id=:companyId AND status NOT IN ('COMPLETED','CANCELLED') AND deleted_at IS NULL", p, [{cnt:0}]),
      sq("SELECT COUNT(*) as cnt FROM pur_orders WHERE company_id=:companyId AND (:branchIdsStr='' OR FIND_IN_SET(branch_id,:branchIdsStr)) AND status='PENDING'", p, [{cnt:0}]),
    ]);
    lowStock.forEach(i => alerts.push({ severity: "warning", category: "Inventory", message: i.item_name + " is below reorder level (" + i.qty + " / " + i.reorder + ")" }));
    overBudget.forEach(ob => alerts.push({ severity: "critical", category: "Projects", message: 'Project "' + ob.project_name + '" exceeded budget' }));
    vehicles.forEach(v => alerts.push({ severity: "info", category: "Fleet", message: "Vehicle " + v.vehicle_number + " (" + v.model + ") is under maintenance" }));
    if (Number(openMaint[0]?.cnt||0) > 3) alerts.push({ severity: "warning", category: "Maintenance", message: openMaint[0].cnt + " open maintenance jobs need attention" });
    if (Number(pendingPOs[0]?.cnt||0) > 0) alerts.push({ severity: "info", category: "Purchase", message: pendingPOs[0].cnt + " purchase orders pending approval" });
    res.json({ success: true, data: { alerts, count: alerts.length, generatedAt: new Date().toISOString() } });
  } catch (err) { next(err); }
});


export default router;
