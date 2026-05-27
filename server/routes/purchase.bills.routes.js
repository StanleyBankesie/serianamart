import express from "express";
import {
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
} from "../middleware/auth.js";
import { query } from "../db/pool.js";

const router = express.Router();

// Get outstanding bills for a supplier (for payment voucher linking)
router.get(
  "/outstanding",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const companyId = Number(req.user?.companyId || req.companyId || 0);
      const branchId = Number(req.user?.branchId || req.branchId || 0);
      const supplierId = Number(req.query.supplier_id || 0);
      const statusFilter = req.query.status || "";

      if (!supplierId) {
        return res.json({ items: [] });
      }

      const statuses = statusFilter
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      let sql = `
        SELECT 
          b.id,
          b.bill_no,
          b.bill_date,
          b.supplier_id,
          b.net_amount,
          b.amount_paid,
          COALESCE(b.amount_paid, 0) as amount_paid,
          (b.net_amount - COALESCE(b.amount_paid, 0)) as balance_amount,
          b.payment_status,
          b.status,
          s.supplier_code,
          s.supplier_name
        FROM pur_bills b
        LEFT JOIN pur_suppliers s ON s.id = b.supplier_id 
          AND s.company_id = b.company_id 
        WHERE b.company_id = ?
          AND (b.branch_id = ? OR b.branch_id IS NULL)
          AND b.supplier_id = ?
          AND b.status = 'POSTED'
      `;

      const params = [companyId, branchId, supplierId];

      if (statuses.length > 0) {
        const placeholders = statuses.map(() => "?").join(",");
        sql += ` AND b.payment_status IN (${placeholders})`;
        params.push(...statuses);
      }

      sql += ` ORDER BY b.bill_date ASC, b.bill_no ASC`;
      const rows = await query(sql, params);

      // Fetch bill details for each bill
      const billIds = rows.map((r) => r.id);
      let detailsMap = {};
      if (billIds.length > 0) {
        const placeholders = billIds.map(() => "?").join(",");
        const detailsSql = `
          SELECT 
            bd.bill_id,
            bd.item_id,
            bd.qty,
            bd.unit_price,
            bd.line_total,
            bd.tax_amount,
            i.item_code,
            i.item_name
          FROM pur_bill_details bd
          LEFT JOIN inv_items i ON i.id = bd.item_id
          WHERE bd.bill_id IN (${placeholders})
        `;
        const detailsRows = await query(detailsSql, billIds);
        detailsMap = (detailsRows || []).reduce((acc, d) => {
          if (!acc[d.bill_id]) acc[d.bill_id] = [];
          acc[d.bill_id].push({
            item_id: d.item_id,
            item_code: d.item_code,
            item_name: d.item_name,
            qty: Number(d.qty || 0),
            unit_price: Number(d.unit_price || 0),
            line_total: Number(d.line_total || 0),
            tax_amount: Number(d.tax_amount || 0),
          });
          return acc;
        }, {});
      }

      // Format response
      const items = (rows || []).map((row) => ({
        id: row.id,
        bill_no: row.bill_no,
        bill_date: row.bill_date,
        supplier_id: row.supplier_id,
        supplier_code: row.supplier_code,
        supplier_name: row.supplier_name,
        net_amount: Number(row.net_amount || 0),
        amount_paid: Number(row.amount_paid || 0),
        balance_amount: Number(row.balance_amount || row.net_amount || 0),
        payment_status: row.payment_status || "UNPAID",
        status: row.status,
        details: detailsMap[row.id] || [],
      }));

      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

// Get outstanding bills for a supplier based on account ID
// This endpoint: 1) Gets account code from fin_accounts, 2) Finds supplier with multiple matching strategies, 3) Returns their outstanding bills
router.get(
  "/outstanding-by-account",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const companyId = Number(req.scope.companyId);
      const branchId = Number(req.scope.branchId);
      const { account_id } = req.query;

      if (!account_id) {
        return res.status(400).json({ error: "account_id is required" });
      }

      // Step 1: Get account code from fin_accounts table using account ID
      const accountRows = await query(
        `SELECT code FROM fin_accounts 
         WHERE id = ? AND company_id = ?`,
        [account_id, companyId],
      );

      if (!accountRows || accountRows.length === 0) {
        return res.json({ items: [] });
      }

      const accountCode = String(accountRows[0].code || "").trim();
      if (!accountCode) {
        return res.json({ items: [] });
      }

      // Step 2: Find supplier using multiple matching strategies
      // Primary match: supplier_code = account code
      let supplierRows = await query(
        `SELECT id, supplier_code, supplier_name 
         FROM pur_suppliers 
         WHERE company_id = ? AND supplier_code = ?
         LIMIT 1`,
        [companyId, accountCode],
      );

      // Fallback: try supplier_id if no match found
      if (!supplierRows || supplierRows.length === 0) {
        supplierRows = await query(
          `SELECT id, supplier_code, supplier_name 
           FROM pur_suppliers 
           WHERE company_id = ? AND CAST(supplier_id AS CHAR) = ?
           LIMIT 1`,
          [companyId, accountCode],
        );
      }

      if (!supplierRows || supplierRows.length === 0) {
        return res.json({ items: [] });
      }

      // Use the matching supplier
      const supplierId = supplierRows[0].id;

      // Step 3: Get outstanding bills for this supplier
      // Query pur_bills with payment_status UNPAID or PARTIAL PAYMENT
      const sql = `SELECT b.id, b.bill_no, b.bill_date, b.net_amount, b.amount_paid, 
                (b.net_amount - COALESCE(b.amount_paid, 0)) as balance_amount,
                b.payment_status, b.due_date, s.supplier_name,
                bd.item_id, i.item_name, bd.qty, bd.unit_price, bd.line_total
         FROM pur_bills b
         LEFT JOIN pur_suppliers s ON b.supplier_id = s.id
         LEFT JOIN pur_bill_details bd ON b.id = bd.bill_id
         LEFT JOIN inv_items i ON bd.item_id = i.id
         WHERE b.supplier_id = ? 
           AND b.company_id = ? 
           AND (b.branch_id = ? OR b.branch_id IS NULL)
           AND (b.payment_status = 'UNPAID' OR b.payment_status = 'PARTIAL PAYMENT')
           AND b.status = 'POSTED'
         ORDER BY b.bill_date DESC`;
      const billParams = [supplierId, companyId, branchId];
      const billRows = await query(sql, billParams);

      // Group bill details by bill
      const billsMap = new Map();
      (billRows || []).forEach((row) => {
        if (!billsMap.has(row.id)) {
          billsMap.set(row.id, {
            id: row.id,
            bill_no: row.bill_no,
            bill_date: row.bill_date,
            net_amount: Number(row.net_amount || 0),
            amount_paid: Number(row.amount_paid || 0),
            balance_amount: Number(row.balance_amount || row.net_amount || 0),
            payment_status: row.payment_status,
            due_date: row.due_date,
            supplier_name: row.supplier_name,
            items: [],
          });
        }
        if (row.item_id) {
          billsMap.get(row.id).items.push({
            item_id: row.item_id,
            item_name: row.item_name,
            qty: row.qty,
            unit_price: row.unit_price,
            line_total: row.line_total,
          });
        }
      });

      const bills = Array.from(billsMap.values());

      res.json({
        items: bills,
        supplier: supplierRows[0],
        account_code: accountCode,
      });
    } catch (err) {
      console.error("[outstanding-by-account] Error:", err?.message || err);
      console.error("[outstanding-by-account] Stack:", err?.stack);
      next(err);
    }
  },
);

// Update bill payment status when payment is made
router.post(
  "/update-payment-status",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const companyId = Number(req.user?.companyId || req.companyId || 0);
      const branchId = Number(req.user?.branchId || req.branchId || 0);
      const { billId, paymentAmount } = req.body;

      if (!billId || !(paymentAmount > 0)) {
        return res.status(400).json({
          error: "billId and paymentAmount are required",
        });
      }

      // Get current bill details
      const billRows = await query(
        `SELECT net_amount, amount_paid, payment_status 
         FROM pur_bills 
         WHERE id = ? AND company_id = ? AND (branch_id = ? OR branch_id IS NULL)`,
        [billId, companyId, branchId],
      );

      if (!billRows || billRows.length === 0) {
        return res.status(404).json({ error: "Bill not found" });
      }

      const bill = billRows[0];
      const netAmount = Number(bill.net_amount || 0);
      const currentPaid = Number(bill.amount_paid || 0);
      const newPaid = currentPaid + Number(paymentAmount);

      // Determine new payment status
      let newStatus;
      if (newPaid >= netAmount) {
        newStatus = "FULLY PAID";
      } else if (newPaid > 0) {
        newStatus = "PARTIAL PAYMENT";
      } else {
        newStatus = "UNPAID";
      }

      // Update bill
      await query(
        `UPDATE pur_bills 
         SET amount_paid = ?, 
             payment_status = ?,
             updated_at = NOW()
         WHERE id = ? AND company_id = ? AND (branch_id = ? OR branch_id IS NULL)`,
        [newPaid, newStatus, billId, companyId, branchId],
      );

      res.json({
        success: true,
        billId,
        previousStatus: bill.payment_status,
        newStatus,
        amountPaid: newPaid,
        balanceAmount: Math.max(0, netAmount - newPaid),
      });
    } catch (err) {
      next(err);
    }
  },
);

// Simple test route to verify router is working
router.get("/test", (req, res) => {
  res.json({ message: "Purchase bills router is working!" });
});

export default router;
