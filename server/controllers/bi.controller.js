import { query } from "../db/pool.js";

async function safeQuery(sql, params, fallbackRows) {
  try {
    const rows = await query(sql, params);
    return Array.isArray(rows) ? rows : fallbackRows;
  } catch {
    return fallbackRows;
  }
}

export const getDashboards = async (req, res, next) => {
  try {
    const { companyId, branchId, branchIdsStr } = req.scope;
    const salesStats = await safeQuery(
      `SELECT COUNT(*) as count, SUM(total_amount) as total FROM sal_invoices 
       WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) AND invoice_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      { companyId, branchId, branchIdsStr },
      [{ count: 0, total: 0 }],
    );
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

export const getSalesReport = async (req, res, next) => {
  try {
    const { companyId, branchId, branchIdsStr } = req.scope;
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

export const getPurchaseReport = async (req, res, next) => {
  try {
    const { companyId, branchId, branchIdsStr } = req.scope;
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

export const getInventoryReport = async (req, res, next) => {
  try {
    const { companyId, branchId, branchIdsStr } = req.scope;
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

