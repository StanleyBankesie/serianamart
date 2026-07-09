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
    
    const [todaySalesData] = await safeQuery(
      `SELECT SUM(total_amount) as total FROM sal_invoices 
       WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) AND DATE(invoice_date) = CURDATE()`,
      { companyId, branchId, branchIdsStr },
      [{ total: 0 }]
    );
    const [todayPosData] = await safeQuery(
      `SELECT SUM(net_amount) as total FROM pos_sales 
       WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) AND DATE(sale_datetime) = CURDATE() AND status != 'VOID'`,
      { companyId, branchId, branchIdsStr },
      [{ total: 0 }]
    );
    const todaySales = Number(todaySalesData?.total || 0) + Number(todayPosData?.total || 0);

    const [lastMonthSalesData] = await safeQuery(
      `SELECT SUM(total_amount) as total FROM sal_invoices 
       WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) AND DATE(invoice_date) = DATE_SUB(CURDATE(), INTERVAL 1 MONTH)`,
      { companyId, branchId, branchIdsStr },
      [{ total: 0 }]
    );
    const [lastMonthPosData] = await safeQuery(
      `SELECT SUM(net_amount) as total FROM pos_sales 
       WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) AND DATE(sale_datetime) = DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND status != 'VOID'`,
      { companyId, branchId, branchIdsStr },
      [{ total: 0 }]
    );
    const lastMonthSales = Number(lastMonthSalesData?.total || 0) + Number(lastMonthPosData?.total || 0);

    let todaySalesPct = 0;
    if (lastMonthSales > 0) {
      todaySalesPct = Math.round(((todaySales - lastMonthSales) / lastMonthSales) * 100);
    } else if (todaySales > 0) {
      todaySalesPct = 100; // 100% increase if last month was 0 but today is > 0
    }

    const [customersData] = await safeQuery(
      `SELECT COUNT(*) as count FROM sal_customers 
       WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) AND is_active = 1`,
      { companyId, branchId, branchIdsStr },
      [{ count: 0 }]
    );
    const totalCustomers = Number(customersData?.count || 0);

    const [avgOrderData] = await safeQuery(
      `SELECT SUM(total_amount) as total, COUNT(*) as count FROM sal_invoices 
       WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
      { companyId, branchId, branchIdsStr },
      [{ total: 0, count: 0 }]
    );
    const [avgPosData] = await safeQuery(
      `SELECT SUM(net_amount) as total, COUNT(*) as count FROM pos_sales 
       WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) AND status != 'VOID'`,
      { companyId, branchId, branchIdsStr },
      [{ total: 0, count: 0 }]
    );
    const totalOrderAmount = Number(avgOrderData?.total || 0) + Number(avgPosData?.total || 0);
    const totalOrderCount = Number(avgOrderData?.count || 0) + Number(avgPosData?.count || 0);
    const averageOrder = totalOrderCount > 0 ? (totalOrderAmount / totalOrderCount) : 0;

    const [monthlyRevData] = await safeQuery(
      `SELECT SUM(total_amount) as total FROM sal_invoices 
       WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) AND MONTH(invoice_date) = MONTH(CURDATE()) AND YEAR(invoice_date) = YEAR(CURDATE())`,
      { companyId, branchId, branchIdsStr },
      [{ total: 0 }]
    );
    const [monthlyPosData] = await safeQuery(
      `SELECT SUM(net_amount) as total FROM pos_sales 
       WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) AND MONTH(sale_datetime) = MONTH(CURDATE()) AND YEAR(sale_datetime) = YEAR(CURDATE()) AND status != 'VOID'`,
      { companyId, branchId, branchIdsStr },
      [{ total: 0 }]
    );
    const monthlyRevenue = Number(monthlyRevData?.total || 0) + Number(monthlyPosData?.total || 0);

    const badges = {
      "today-sales": { text: `${todaySalesPct >= 0 ? '+' : ''}${todaySalesPct}% vs last month` },
      "total-customers": { text: "Active" },
      "average-order": { text: "" },
      "monthly-revenue": { text: "This Month" },
    };

    res.json({
      todaySales,
      totalCustomers,
      averageOrder,
      monthlyRevenue,
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

