import { query } from "../db/pool.js";

export const getDashboards = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const salesStats = await query(
      `SELECT COUNT(*) as count, SUM(total_amount) as total FROM sal_invoices 
       WHERE company_id = :companyId AND branch_id = :branchId AND invoice_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      { companyId, branchId },
    );
    const purchaseStats = await query(
      `SELECT COUNT(*) as count, SUM(total_amount) as total FROM pur_orders 
       WHERE company_id = :companyId AND branch_id = :branchId AND po_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      { companyId, branchId },
    );
    const inventoryStats = await query(
      `SELECT COUNT(*) as item_count, SUM(qty) as total_qty FROM inv_stock_balances 
       WHERE company_id = :companyId AND branch_id = :branchId`,
      { companyId, branchId },
    );
    const hrStats = await query(
      `SELECT COUNT(*) as employee_count FROM hr_employees 
       WHERE company_id = :companyId AND branch_id = :branchId AND is_active = 1`,
      { companyId, branchId },
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
    const { companyId, branchId } = req.scope;
    const data = await query(
      `SELECT DATE(invoice_date) as date, COUNT(*) as count, SUM(total_amount) as total 
       FROM sal_invoices 
       WHERE company_id = :companyId AND branch_id = :branchId 
       GROUP BY DATE(invoice_date) ORDER BY date DESC LIMIT 30`,
      { companyId, branchId },
    );
    res.json({ items: data });
  } catch (err) {
    next(err);
  }
};

export const getPurchaseReport = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const data = await query(
      `SELECT DATE(po_date) as date, COUNT(*) as count, SUM(total_amount) as total 
       FROM pur_orders 
       WHERE company_id = :companyId AND branch_id = :branchId 
       GROUP BY DATE(po_date) ORDER BY date DESC LIMIT 30`,
      { companyId, branchId },
    );
    res.json({ items: data });
  } catch (err) {
    next(err);
  }
};

export const getInventoryReport = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const data = await query(
      `SELECT i.item_code, i.item_name, sb.qty, i.reorder_level, i.max_stock_level 
       FROM inv_stock_balances sb
       JOIN inv_items i ON sb.item_id = i.id
       WHERE sb.company_id = :companyId AND sb.branch_id = :branchId
       ORDER BY sb.qty ASC LIMIT 50`,
      { companyId, branchId },
    );
    res.json({ items: data });
  } catch (err) {
    next(err);
  }
};
