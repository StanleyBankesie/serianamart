import express from "express";
import { requireAuth, requireCompanyScope, requireBranchScope } from "../middleware/auth.js";
import { query } from "../db/pool.js";

const router = express.Router();

// Get outstanding bills for a supplier (for payment voucher linking)
router.get("/outstanding",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const companyId = Number(req.user?.companyId || req.companyId || 0);
      const branchId = Number(req.user?.branchId || req.branchId || 0);
      const supplierId = Number(req.query.supplier_id || 0);
      const statusFilter = req.query.status || "UNPAID,PARTIAL PAYMENT";
      
      if (!supplierId) {
        return res.json({ items: [] });
      }

      const statuses = statusFilter.split(",").map(s => s.trim()).filter(Boolean);
      const statusPlaceholders = statuses.map(() => "?").join(",");
      
      const sql = `
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
          AND (b.branch_id IS NULL OR s.branch_id = b.branch_id)
        WHERE b.company_id = ?
          AND (b.branch_id = ? OR b.branch_id IS NULL)
          AND b.supplier_id = ?
          AND b.payment_status IN (${statusPlaceholders})
          AND b.status = 'POSTED'
        ORDER BY b.bill_date ASC, b.bill_no ASC
      `;
      
      const params = [companyId, branchId, supplierId, ...statuses];
      const rows = await query(sql, params);
      
      // Fetch bill details for each bill
      const billIds = rows.map(r => r.id);
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
            tax_amount: Number(d.tax_amount || 0)
          });
          return acc;
        }, {});
      }
      
      // Format response
      const items = (rows || []).map(row => ({
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
        details: detailsMap[row.id] || []
      }));
      
      res.json({ items });
    } catch (err) {
      next(err);
    }
  }
);

// Update bill payment status when payment is made
router.post("/update-payment-status",
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
          error: "billId and paymentAmount are required" 
        });
      }

      // Get current bill details
      const billRows = await query(
        `SELECT net_amount, amount_paid, payment_status 
         FROM pur_bills 
         WHERE id = ? AND company_id = ? AND (branch_id = ? OR branch_id IS NULL)`,
        [billId, companyId, branchId]
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
        [newPaid, newStatus, billId, companyId, branchId]
      );
      
      res.json({
        success: true,
        billId,
        previousStatus: bill.payment_status,
        newStatus,
        amountPaid: newPaid,
        balanceAmount: Math.max(0, netAmount - newPaid)
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
