/**
 * @fileoverview Controller for business intelligence and reporting.
 * @module bi.controller
 */

// Database Dependencies
import { query } from "../db/pool.js";

/**
 * Safely executes a query, returning a fallback array if it fails.
 *
 * @async
 * @param {string} sql - The SQL query to execute.
 * @param {Object} params - The query parameters.
 * @param {Array} fallbackRows - The fallback data to return on failure.
 * @returns {Promise<Array>} The query results or fallback array.
 */
// Utility function to execute a query safely with fallback
async function safeQuery(sql, params, fallbackRows) {
  try {
    const rows = await query(sql, params);
    return Array.isArray(rows) ? rows : fallbackRows;
  } catch {
    return fallbackRows;
  }
}

/**
 * Retrieves overall dashboard statistics for sales, purchases, inventory, and HR.
 *
 * @async
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next middleware function.
 */
// Home Overview Endpoint
export const getHomeOverview = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const p = { companyId, branchId, branchIdsStr: String(branchIdsStr || '') };
    const whereBranch = "(:branchId IS NULL OR branch_id = :branchId OR :branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr) OR branch_id IS NULL)";
    
    const [
      [todaySalesData],
      [thisMonthData],
      [lastMonthData],
      [customersData],
      [allTimeSalesData]
    ] = await Promise.all([
      safeQuery(`SELECT 
          (SELECT COALESCE(SUM(total_amount),0) FROM sal_invoices WHERE (company_id = :companyId OR company_id IS NULL) AND ${whereBranch} AND DATE(invoice_date) = CURDATE() AND status NOT IN ('CANCELLED','DRAFT')) +
          (SELECT COALESCE(SUM(net_amount),0) FROM pos_sales WHERE (company_id = :companyId OR company_id IS NULL) AND ${whereBranch} AND DATE(sale_datetime) = CURDATE() AND status != 'VOID') as total,
          (SELECT COUNT(*) FROM sal_invoices WHERE (company_id = :companyId OR company_id IS NULL) AND ${whereBranch} AND DATE(invoice_date) = CURDATE() AND status NOT IN ('CANCELLED','DRAFT')) +
          (SELECT COUNT(*) FROM pos_sales WHERE (company_id = :companyId OR company_id IS NULL) AND ${whereBranch} AND DATE(sale_datetime) = CURDATE() AND status != 'VOID') as count`, p, [{ total: 0, count: 0 }]),
      safeQuery(`SELECT 
          (SELECT COALESCE(SUM(total_amount),0) FROM sal_invoices WHERE (company_id = :companyId OR company_id IS NULL) AND ${whereBranch} AND MONTH(invoice_date) = MONTH(CURDATE()) AND YEAR(invoice_date) = YEAR(CURDATE()) AND status NOT IN ('CANCELLED','DRAFT')) +
          (SELECT COALESCE(SUM(net_amount),0) FROM pos_sales WHERE (company_id = :companyId OR company_id IS NULL) AND ${whereBranch} AND MONTH(sale_datetime) = MONTH(CURDATE()) AND YEAR(sale_datetime) = YEAR(CURDATE()) AND status != 'VOID') as total`, p, [{ total: 0 }]),
      safeQuery(`SELECT 
          (SELECT COALESCE(SUM(total_amount),0) FROM sal_invoices WHERE (company_id = :companyId OR company_id IS NULL) AND ${whereBranch} AND MONTH(invoice_date) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) AND YEAR(invoice_date) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) AND status NOT IN ('CANCELLED','DRAFT')) +
          (SELECT COALESCE(SUM(net_amount),0) FROM pos_sales WHERE (company_id = :companyId OR company_id IS NULL) AND ${whereBranch} AND MONTH(sale_datetime) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) AND YEAR(sale_datetime) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) AND status != 'VOID') as total`, p, [{ total: 0 }]),
      safeQuery(`SELECT COUNT(*) as count FROM sal_customers WHERE (company_id = :companyId OR company_id IS NULL) AND is_active = 1`, p, [{ count: 0 }]),
      safeQuery(`SELECT 
          (SELECT COALESCE(SUM(total_amount),0) FROM sal_invoices WHERE (company_id = :companyId OR company_id IS NULL) AND ${whereBranch} AND status NOT IN ('CANCELLED','DRAFT')) +
          (SELECT COALESCE(SUM(net_amount),0) FROM pos_sales WHERE (company_id = :companyId OR company_id IS NULL) AND ${whereBranch} AND status != 'VOID') as total,
          (SELECT COUNT(*) FROM sal_invoices WHERE (company_id = :companyId OR company_id IS NULL) AND ${whereBranch} AND status NOT IN ('CANCELLED','DRAFT')) +
          (SELECT COUNT(*) FROM pos_sales WHERE (company_id = :companyId OR company_id IS NULL) AND ${whereBranch} AND status != 'VOID') as count`, p, [{ total: 0, count: 0 }]),
    ]);

    const todaySales = Number(todaySalesData?.total || 0);
    const monthlyRevenue = Number(thisMonthData?.total || 0);
    const lastMonthSales = Number(lastMonthData?.total || 0);
    const totalCustomers = Number(customersData?.count || 0);
    const allTimeRevenue = Number(allTimeSalesData?.total || 0);
    const allTimeCount = Number(allTimeSalesData?.count || 0);
    const averageOrder = allTimeCount > 0 ? (allTimeRevenue / allTimeCount) : 0;

    let growthPct = 0;
    if (lastMonthSales > 0) {
      growthPct = Math.round(((monthlyRevenue - lastMonthSales) / lastMonthSales) * 100);
    } else if (monthlyRevenue > 0) {
      growthPct = 100;
    }

    const badges = {
      "today-sales": { text: `Active Today: ${todaySalesData?.count || 0} txn(s)` },
      "total-customers": { text: "Active" },
      "average-order": { text: `${allTimeCount} Orders Total` },
      "monthly-revenue": { text: `${growthPct >= 0 ? '+' : ''}${growthPct}% vs last mo` },
      "sales-total-revenue": { text: `${growthPct >= 0 ? '+' : ''}${growthPct}% vs last mo` },
    };

    res.json({
      todaySales,
      totalCustomers,
      averageOrder,
      monthlyRevenue,
      allTimeRevenue,
      badges
    });
  } catch (err) {
    next(err);
  }
};

// Dashboard Endpoint - Main Statistics
export const getDashboards = async (req, res, next) => {
  try {
    // Extract scope variables for filtering
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    
    // Fetch sales metrics
    const salesStats = await safeQuery(
      `SELECT COUNT(*) as count, SUM(total_amount) as total FROM sal_invoices 
       WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) AND invoice_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      { companyId, branchId, branchIdsStr },
      [{ count: 0, total: 0 }],
    );
    
    // Fetch purchase metrics
    const purchaseStats = await safeQuery(
      `SELECT COUNT(*) as count, SUM(total_amount) as total FROM pur_orders 
       WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) AND po_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      { companyId, branchId, branchIdsStr },
      [{ count: 0, total: 0 }],
    );
    const inventoryStats = await safeQuery(
      `SELECT COUNT(*) as item_count, SUM(qty) as total_qty FROM inv_stock_balances 
       WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
      { companyId, branchId, branchIdsStr },
      [{ item_count: 0, total_qty: 0 }],
    );
    const hrStats = await safeQuery(
      `SELECT COUNT(*) as employee_count FROM hr_employees 
       WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) AND is_active = 1`,
      { companyId, branchId, branchIdsStr },
      [{ employee_count: 0 }],
    );
    const dashboardData = {
      summary: {
        sales: {
          documents: salesStats[0]?.count || 0,
          total: salesStats[0]?.total || 0,
        },
        purchase: {
          documents: purchaseStats[0]?.count || 0,
          total: purchaseStats[0]?.total || 0,
        },
        inventory: {
          items: inventoryStats[0]?.item_count || 0,
          quantity: inventoryStats[0]?.total_qty || 0,
        },
        hr: {
          employees: hrStats[0]?.employee_count || 0,
        },
      },
    };
    res.json(dashboardData);
  } catch (err) {
    next(err);
  }
};

/**
 * Retrieves the sales report data for the last 30 days.
 *
 * @async
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next middleware function.
 */
// Sales Report Endpoint
export const getSalesReport = async (req, res, next) => {
  try {
    // Extract scope variables for filtering
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    
    // Fetch sales report data grouped by date
    const data = await safeQuery(
      `SELECT DATE(invoice_date) as date, COUNT(*) as count, SUM(total_amount) as total 
       FROM sal_invoices 
       WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) 
       GROUP BY DATE(invoice_date) ORDER BY date DESC LIMIT 30`,
      { companyId, branchId, branchIdsStr },
      [],
    );
    res.json({ items: data });
  } catch (err) {
    next(err);
  }
};

/**
 * Retrieves the purchase report data for the last 30 days.
 *
 * @async
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next middleware function.
 */
// Purchase Report Endpoint
export const getPurchaseReport = async (req, res, next) => {
  try {
    // Extract scope variables for filtering
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    
    // Fetch purchase report data grouped by date
    const data = await safeQuery(
      `SELECT DATE(po_date) as date, COUNT(*) as count, SUM(total_amount) as total 
       FROM pur_orders 
       WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) 
       GROUP BY DATE(po_date) ORDER BY date DESC LIMIT 30`,
      { companyId, branchId, branchIdsStr },
      [],
    );
    res.json({ items: data });
  } catch (err) {
    next(err);
  }
};

/**
 * Retrieves the inventory report detailing stock balances, along with permissions.
 *
 * @async
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next middleware function.
 */
// Inventory Report Endpoint
export const getInventoryReport = async (req, res, next) => {
  try {
    // Extract scope variables for filtering
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    
    // Fetch inventory report data ordered by lowest stock quantity
    const data = await safeQuery(
      `SELECT i.item_code, i.item_name, sb.qty, i.reorder_level, i.max_stock_level 
       FROM inv_stock_balances sb
       JOIN inv_items i ON sb.item_id = i.id
       WHERE sb.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(sb.branch_id, :branchIdsStr))
       ORDER BY sb.qty ASC LIMIT 50`,
      { companyId, branchId, branchIdsStr },
      [],
    );
    const permissions = await safeQuery(
      `SELECT can_edit, can_view, can_delete, can_create 
       FROM adm_user_permissions 
       WHERE user_id = :userId AND module = 'inventory'`,
      { userId: req.user.id },
      [],
    );

    res.json({
      items: data,
      permissions: permissions[0] || {},
    });
  } catch (err) {
    next(err);
  }
};


export const getModuleAnalytics = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const p = { companyId, branchId, branchIdsStr };

    const queries = [];
    const keys = [];

    // Admin
    queries.push(safeQuery(`SELECT COUNT(*) as v FROM adm_users WHERE company_id=:companyId AND is_active='Y'`, p, [{v:0}]));
    keys.push('admin-active-users');
    queries.push(safeQuery(`SELECT COUNT(*) as v FROM adm_roles WHERE company_id=:companyId`, p, [{v:0}]));
    keys.push('admin-role-count');
    queries.push(safeQuery(`SELECT COUNT(*) as v FROM adm_user_sessions WHERE company_id=:companyId AND login_time >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`, p, [{v:0}]));
    keys.push('admin-recent-logins');

    // Sales
    queries.push(safeQuery(`SELECT (SELECT COALESCE(SUM(net_amount),0) FROM sal_invoices WHERE company_id=:companyId AND status != 'VOID') + (SELECT COALESCE(SUM(gross_amount + tax_amount - discount_amount),0) FROM pos_sales WHERE company_id=:companyId AND status != 'VOID') as v`, p, [{v:0}]));
    keys.push('sales-total-revenue');
    queries.push(safeQuery(`SELECT COUNT(*) as v FROM sal_orders WHERE company_id=:companyId AND status='PENDING'`, p, [{v:0}]));
    keys.push('sales-pending-orders');
    queries.push(safeQuery(`SELECT COUNT(*) as v FROM sal_customers WHERE company_id=:companyId AND is_active=1`, p, [{v:0}]));
    keys.push('sales-active-customers');

    // Purchase
    queries.push(safeQuery(`SELECT COALESCE(SUM(total_amount),0) as v FROM pur_orders WHERE company_id=:companyId AND status != 'CANCELLED'`, p, [{v:0}]));
    keys.push('purchase-total-value');
    queries.push(safeQuery(`SELECT COUNT(*) as v FROM pur_orders WHERE company_id=:companyId AND status='PENDING'`, p, [{v:0}]));
    keys.push('purchase-pending-pos');
    queries.push(safeQuery(`SELECT COUNT(*) as v FROM pur_suppliers WHERE company_id=:companyId AND is_active=1`, p, [{v:0}]));
    keys.push('purchase-active-suppliers');

    // Inventory
    queries.push(safeQuery(`SELECT COUNT(*) as v FROM inv_items WHERE company_id=:companyId`, p, [{v:0}]));
    keys.push('inventory-total-items');
    queries.push(safeQuery(`SELECT COUNT(*) as v FROM inv_stock_balances b JOIN inv_reorder_points r ON b.item_id=r.item_id WHERE b.company_id=:companyId AND b.qty <= r.reorder_level`, p, [{v:0}]));
    keys.push('inventory-low-stock');
    queries.push(safeQuery(`SELECT COUNT(*) as v FROM inv_warehouses WHERE company_id=:companyId`, p, [{v:0}]));
    keys.push('inventory-warehouses');

    // Finance
    queries.push(safeQuery(`SELECT COALESCE(SUM(current_balance),0) as v FROM fin_accounts WHERE company_id=:companyId AND account_type='CASH'`, p, [{v:0}]));
    keys.push('finance-cash-balance');
    queries.push(safeQuery(`SELECT COALESCE(SUM(balance_amount),0) as v FROM sal_invoices WHERE company_id=:companyId AND balance_amount > 0`, p, [{v:0}]));
    keys.push('finance-ar');
    queries.push(safeQuery(`SELECT COALESCE(SUM(balance_amount),0) as v FROM pur_bills WHERE company_id=:companyId AND balance_amount > 0`, p, [{v:0}]));
    keys.push('finance-ap');

    // HR
    queries.push(safeQuery(`SELECT COUNT(*) as v FROM hr_employees WHERE company_id=:companyId AND status='ACTIVE'`, p, [{v:0}]));
    keys.push('hr-total-employees');
    queries.push(safeQuery(`SELECT COUNT(*) as v FROM hr_leave_applications WHERE company_id=:companyId AND status='APPROVED' AND CURDATE() BETWEEN start_date AND end_date`, p, [{v:0}]));
    keys.push('hr-on-leave');
    queries.push(safeQuery(`SELECT COUNT(*) as v FROM hr_employees WHERE company_id=:companyId AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`, p, [{v:0}]));
    keys.push('hr-new-hires');

    // Maintenance
    queries.push(safeQuery(`SELECT COUNT(*) as v FROM maint_work_orders WHERE company_id=:companyId AND status='OPEN'`, p, [{v:0}]));
    keys.push('maint-open-work-orders');
    queries.push(safeQuery(`SELECT COUNT(*) as v FROM maint_assets WHERE company_id=:companyId AND status='MAINTENANCE'`, p, [{v:0}]));
    keys.push('maint-assets-in-maint');
    queries.push(safeQuery(`SELECT COUNT(*) as v FROM maint_assets WHERE company_id=:companyId`, p, [{v:0}]));
    keys.push('maint-total-assets');

    // Production
    queries.push(safeQuery(`SELECT COUNT(*) as v FROM prd_orders WHERE company_id=:companyId AND status='IN_PROGRESS'`, p, [{v:0}]));
    keys.push('prod-active-orders');
    queries.push(safeQuery(`SELECT COUNT(*) as v FROM prd_orders WHERE company_id=:companyId AND status='COMPLETED'`, p, [{v:0}]));
    keys.push('prod-completed-orders');
    queries.push(safeQuery(`SELECT COALESCE(AVG(yield_percentage),0) as v FROM prd_orders WHERE company_id=:companyId AND status='COMPLETED'`, p, [{v:0}]));
    keys.push('prod-yield');

    // Project Management
    queries.push(safeQuery(`SELECT COUNT(*) as v FROM pm_projects WHERE company_id=:companyId AND project_status='IN_PROGRESS'`, p, [{v:0}]));
    keys.push('pm-active-projects');
    queries.push(safeQuery(`SELECT COUNT(*) as v FROM pm_tasks WHERE company_id=:companyId AND due_status='OVERDUE'`, p, [{v:0}]));
    keys.push('pm-overdue-tasks');
    queries.push(safeQuery(`SELECT COUNT(*) as v FROM pm_milestones WHERE company_id=:companyId`, p, [{v:0}]));
    keys.push('pm-total-milestones');

    // POS
    queries.push(safeQuery(`SELECT COALESCE(SUM(COALESCE(gross_amount,0) + COALESCE(tax_amount,0) - COALESCE(discount_amount,0)),0) as v FROM pos_sales WHERE company_id=:companyId AND DATE(sale_datetime)=CURDATE() AND status!='VOID'`, p, [{v:0}]));
    keys.push('pos-today-sales');
    queries.push(safeQuery(`SELECT COUNT(*) as v FROM pos_sales WHERE company_id=:companyId`, p, [{v:0}]));
    keys.push('pos-total-transactions');
    queries.push(safeQuery(`SELECT COALESCE(AVG(COALESCE(gross_amount,0) + COALESCE(tax_amount,0) - COALESCE(discount_amount,0)),0) as v FROM pos_sales WHERE company_id=:companyId AND status!='VOID'`, p, [{v:0}]));
    keys.push('pos-avg-order');

    // BI
    queries.push(safeQuery(`SELECT (SELECT COALESCE(SUM(net_amount),0) FROM sal_invoices WHERE company_id=:companyId AND status != 'VOID') + (SELECT COALESCE(SUM(gross_amount + tax_amount - discount_amount),0) FROM pos_sales WHERE company_id=:companyId AND status != 'VOID') as v`, p, [{v:0}]));
    keys.push('bi-company-revenue');
    queries.push(safeQuery(`SELECT 25.5 as v`, p, [{v:25.5}])); // Mock profit margin for now
    keys.push('bi-profit-margin');
    queries.push(safeQuery(`SELECT 'Standard Product' as str_v`, p, [{str_v:'Standard Product'}])); // Mock
    keys.push('bi-top-product');

    // Executive
    queries.push(safeQuery(`SELECT COALESCE(SUM(net_amount)*0.3,0) as v FROM sal_invoices WHERE company_id=:companyId`, p, [{v:0}])); // Mock
    keys.push('exec-gross-profit');
    queries.push(safeQuery(`SELECT COALESCE(SUM(net_amount)*0.15,0) as v FROM sal_invoices WHERE company_id=:companyId`, p, [{v:0}])); // Mock
    keys.push('exec-net-income');
    queries.push(safeQuery(`SELECT COALESCE(SUM(total_amount),0) as v FROM pur_bills WHERE company_id=:companyId`, p, [{v:0}]));
    keys.push('exec-total-expenses');

    // Service Management
    queries.push(safeQuery(`SELECT COUNT(*) as v FROM srv_contracts WHERE company_id=:companyId AND status='ACTIVE'`, p, [{v:0}]));
    keys.push('sm-active-contracts');
    queries.push(safeQuery(`SELECT COUNT(*) as v FROM srv_invoices WHERE company_id=:companyId AND status='UNPAID'`, p, [{v:0}]));
    keys.push('sm-pending-invoices');
    queries.push(safeQuery(`SELECT COALESCE(SUM(total_amount),0) as v FROM srv_invoices WHERE company_id=:companyId`, p, [{v:0}]));
    keys.push('sm-total-revenue');

    // Transport
    queries.push(safeQuery(`SELECT COUNT(*) as v FROM trans_vehicles WHERE company_id=:companyId AND status='ACTIVE'`, p, [{v:0}]));
    keys.push('trans-active-vehicles');
    queries.push(safeQuery(`SELECT COUNT(*) as v FROM trans_trips WHERE company_id=:companyId AND status='IN_PROGRESS'`, p, [{v:0}]));
    keys.push('trans-ongoing-trips');
    queries.push(safeQuery(`SELECT COUNT(*) as v FROM trans_vehicles WHERE company_id=:companyId AND status='MAINTENANCE'`, p, [{v:0}]));
    keys.push('trans-pending-maint');

    // System
    queries.push(safeQuery(`SELECT 45 as v`, p, [{v:45}])); // Mock CPU
    keys.push('sys-cpu-usage');
    queries.push(safeQuery(`SELECT 62 as v`, p, [{v:62}])); // Mock Memory
    keys.push('sys-memory-usage');
    queries.push(safeQuery(`SELECT COUNT(*) as v FROM adm_user_sessions WHERE company_id=:companyId`, p, [{v:0}]));
    keys.push('sys-active-sessions');

    const results = await Promise.all(queries);
    const data = {};
    for (let i = 0; i < keys.length; i++) {
      const row = results[i][0];
      data[keys[i]] = row.v !== undefined ? row.v : row.str_v;
    }

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
