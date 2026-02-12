import express from "express";
import {
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
} from "../middleware/auth.js";
import {
  requirePermission,
  requireAnyPermission,
} from "../middleware/requirePermission.js";
import { query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import { ensureSalesOrderColumns } from "../utils/dbUtils.js";

const router = express.Router();

router.get(
  "/customers",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("SAL.CUSTOMER.VIEW"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const active = String(req.query.active || "")
        .trim()
        .toLowerCase();
      const onlyActive = active === "true" || active === "1";
      const params = { companyId };
      const where = ["c.company_id = :companyId"];
      if (onlyActive) where.push("c.is_active = 1");
      const items = await query(
        `SELECT 
           c.id,
           c.company_id,
           c.branch_id,
           c.customer_code,
           c.customer_name,
           c.customer_type,
           c.price_type_id,
           pt.name AS price_type_name,
           c.contact_person,
           c.email,
           c.phone,
           c.mobile,
           c.credit_limit,
           c.is_active,
           c.address,
           c.city,
           c.state,
           c.zone,
           c.country,
           c.payment_terms,
           c.currency_id
         FROM sal_customers c
         LEFT JOIN sal_price_types pt
           ON pt.id = c.price_type_id AND pt.company_id = c.company_id
         WHERE ${where.join(" AND ")}
         ORDER BY c.customer_name ASC`,
        params,
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/deliveries",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const {
        delivery_no,
        delivery_date,
        customer_id,
        sales_order_id,
        remarks,
        status,
        items,
      } = req.body || {};
      const dno = String(delivery_no || "").trim();
      const ddate = delivery_date ? String(delivery_date).slice(0, 10) : null;
      const custId = Number(customer_id);
      const soId = sales_order_id == null ? null : Number(sales_order_id);
      const st = String(status || "DRAFT")
        .trim()
        .toUpperCase();
      if (!dno || !ddate || !Number.isFinite(custId)) {
        throw httpError(400, "VALIDATION_ERROR", "Invalid payload");
      }
      const result = await query(
        `
        INSERT INTO sal_deliveries
          (company_id, branch_id, delivery_no, delivery_date, customer_id, sales_order_id, remarks, status)
        VALUES
          (:companyId, :branchId, :delivery_no, DATE(:delivery_date), :customer_id, :sales_order_id, :remarks, :status)
        `,
        {
          companyId,
          branchId,
          delivery_no: dno,
          delivery_date: ddate,
          customer_id: custId,
          sales_order_id: Number.isFinite(soId) ? soId : null,
          remarks: remarks || null,
          status: st,
        },
      );
      const deliveryId = result.insertId;
      const arr = Array.isArray(items) ? items : [];
      for (const it of arr) {
        const item_id = Number(it?.item_id);
        const quantity = Number(it?.quantity || 0);
        const unit_price = Number(it?.unit_price || 0);
        const uom = String(it?.uom || "PCS").trim();
        if (!Number.isFinite(item_id) || quantity <= 0) continue;
        await query(
          `
          INSERT INTO sal_delivery_details
            (delivery_id, item_id, quantity, unit_price, uom)
          VALUES
            (:delivery_id, :item_id, :quantity, :unit_price, :uom)
          `,
          {
            delivery_id: deliveryId,
            item_id,
            quantity,
            unit_price,
            uom,
          },
        );
      }
      const [item] = await query(
        `
        SELECT
          d.id,
          d.delivery_no,
          d.delivery_date,
          d.customer_id,
          COALESCE(c.customer_name, '') AS customer_name,
          d.status
        FROM sal_deliveries d
        LEFT JOIN sal_customers c
          ON c.id = d.customer_id AND c.company_id = d.company_id
        WHERE d.id = :id
        LIMIT 1
        `,
        { id: deliveryId },
      ).catch(() => []);
      res.status(201).json({ item });
    } catch (e) {
      next(e);
    }
  },
);

router.put(
  "/deliveries/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const id = Number(req.params.id);
      if (!Number.isFinite(id))
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const {
        delivery_no,
        delivery_date,
        customer_id,
        sales_order_id,
        remarks,
        status,
        items,
      } = req.body || {};
      const dno = String(delivery_no || "").trim();
      const ddate = delivery_date ? String(delivery_date).slice(0, 10) : null;
      const custId = Number(customer_id);
      const soId = sales_order_id == null ? null : Number(sales_order_id);
      const st = String(status || "DRAFT")
        .trim()
        .toUpperCase();
      const [existing] = await query(
        `
        SELECT id FROM sal_deliveries
        WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        LIMIT 1
        `,
        { id, companyId, branchId },
      ).catch(() => []);
      if (!existing) throw httpError(404, "NOT_FOUND", "Delivery not found");
      await query(
        `
        UPDATE sal_deliveries
           SET delivery_no = :delivery_no,
               delivery_date = DATE(:delivery_date),
               customer_id = :customer_id,
               sales_order_id = :sales_order_id,
               remarks = :remarks,
               status = :status
         WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        `,
        {
          id,
          companyId,
          branchId,
          delivery_no: dno,
          delivery_date: ddate,
          customer_id: custId,
          sales_order_id: Number.isFinite(soId) ? soId : null,
          remarks: remarks || null,
          status: st,
        },
      );
      await query(
        `
        DELETE FROM sal_delivery_details
        WHERE delivery_id = :id
        `,
        { id },
      );
      const arr = Array.isArray(items) ? items : [];
      for (const it of arr) {
        const item_id = Number(it?.item_id);
        const quantity = Number(it?.quantity || 0);
        const unit_price = Number(it?.unit_price || 0);
        const uom = String(it?.uom || "PCS").trim();
        if (!Number.isFinite(item_id) || quantity <= 0) continue;
        await query(
          `
          INSERT INTO sal_delivery_details
            (delivery_id, item_id, quantity, unit_price, uom)
          VALUES
            (:delivery_id, :item_id, :quantity, :unit_price, :uom)
          `,
          {
            delivery_id: id,
            item_id,
            quantity,
            unit_price,
            uom,
          },
        );
      }
      res.json({ id });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/price-types",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission([
    "SAL.CUSTOMER.VIEW",
    "SAL.ORDER.VIEW",
    "SAL.INVOICE.VIEW",
  ]),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const active = String(req.query.active || "")
        .trim()
        .toLowerCase();
      const onlyActive = active === "true" || active === "1";
      const params = { companyId };
      const where = ["company_id = :companyId"];
      if (onlyActive) where.push("is_active = 1");
      const items = await query(
        `SELECT id, name, description, is_active
           FROM sal_price_types
          WHERE ${where.join(" AND ")}
          ORDER BY name ASC`,
        params,
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/quotations",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.ORDER.VIEW", "SAL.INVOICE.VIEW"]),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const branchId = req.scope.branchId;
      const items = await query(
        `SELECT 
           q.id,
           q.quotation_no,
           q.quotation_date,
           q.customer_id,
           COALESCE(NULLIF(q.customer_name, ''), c.customer_name, '') AS customer_name,
           COALESCE(q.valid_until, q.quotation_date) AS valid_until,
           q.total_amount,
           q.status,
           q.price_type,
           q.payment_type,
           q.currency_id,
           q.exchange_rate
         FROM sal_quotations q
         LEFT JOIN sal_customers c
           ON c.id = q.customer_id AND c.company_id = q.company_id
         WHERE q.company_id = :companyId AND q.branch_id = :branchId
         ORDER BY q.quotation_date DESC, q.id DESC`,
        { companyId, branchId },
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/quotations/next-no",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.ORDER.VIEW", "SAL.INVOICE.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const rows = await query(
        `
        SELECT quotation_no
        FROM sal_quotations
        WHERE company_id = :companyId
          AND branch_id = :branchId
          AND quotation_no REGEXP '^QN[0-9]{6}$'
        ORDER BY CAST(REPLACE(quotation_no, 'QN', '') AS UNSIGNED) DESC
        LIMIT 1
        `,
        { companyId, branchId },
      );
      let nextNum = 1;
      if (rows.length > 0) {
        const prev = String(rows[0].quotation_no || "");
        const numPart = prev.replace(/^QN/, "");
        const n = parseInt(numPart, 10);
        if (Number.isFinite(n)) nextNum = n + 1;
      }
      const nextNo = `QN${String(nextNum).padStart(6, "0")}`;
      res.json({ nextNo });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/orders",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("SAL.ORDER.VIEW"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const branchId = req.scope.branchId;
      const items = await query(
        `SELECT id, order_no, order_date, customer_id, status, total_amount
           FROM sal_orders
          WHERE company_id = :companyId AND branch_id = :branchId
          ORDER BY order_date DESC, id DESC`,
        { companyId, branchId },
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/orders/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.ORDER.VIEW", "SAL.INVOICE.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const id = Number(req.params.id);
      if (!Number.isFinite(id))
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const items = await query(
        `
        SELECT
          o.id,
          o.order_no,
          o.order_date,
          o.customer_id,
          COALESCE(c.customer_name, '') AS customer_name,
          o.status,
          o.total_amount,
          o.sub_total,
          o.tax_amount,
          o.currency_id,
          o.exchange_rate,
          o.price_type,
          o.payment_type,
          o.warehouse_id,
          o.quotation_id,
          o.remarks
        FROM sal_orders o
        LEFT JOIN sal_customers c
          ON c.id = o.customer_id AND c.company_id = o.company_id
        WHERE o.id = :id AND o.company_id = :companyId AND o.branch_id = :branchId
        LIMIT 1
        `,
        { id, companyId, branchId },
      ).catch(() => []);
      if (!items.length) throw httpError(404, "NOT_FOUND", "Order not found");
      const details = await query(
        `
        SELECT
          d.id,
          d.item_id,
          d.qty AS quantity,
          d.unit_price,
          d.discount_percent,
          d.total_amount,
          d.net_amount,
          d.tax_amount,
          d.uom,
          it.item_code,
          it.item_name
        FROM sal_order_details d
        LEFT JOIN inv_items it
          ON it.id = d.item_id AND it.company_id = :companyId
        WHERE d.order_id = :id
        ORDER BY d.id ASC
        `,
        { id, companyId },
      ).catch(() => []);
      res.json({
        item: items[0],
        details: Array.isArray(details) ? details : [],
      });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/orders",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.ORDER.VIEW", "SAL.INVOICE.VIEW"]),
  async (req, res, next) => {
    try {
      await ensureSalesOrderColumns();
      const { companyId, branchId } = req.scope;
      const body = req.body || {};
      const order_no = String(body.order_no || "").trim();
      const order_date = body.order_date
        ? String(body.order_date).slice(0, 10)
        : null;
      const customer_id = Number(body.customer_id);
      const status = String(body.status || "DRAFT")
        .trim()
        .toUpperCase();
      if (!order_no || !order_date || !Number.isFinite(customer_id)) {
        throw httpError(400, "VALIDATION_ERROR", "Invalid payload");
      }
      const payload = {
        companyId,
        branchId,
        order_no,
        order_date,
        customer_id,
        status,
        total_amount: Number(body.total_amount || 0),
        sub_total: Number(body.sub_total || 0),
        tax_amount: Number(body.tax_amount || 0),
        currency_id: Number(body.currency_id || 4),
        exchange_rate: Number(body.exchange_rate || 1),
        price_type: String(body.price_type || "RETAIL"),
        payment_type: String(body.payment_type || "CASH"),
        warehouse_id:
          body.warehouse_id == null ? null : Number(body.warehouse_id),
        quotation_id:
          body.quotation_id == null ? null : Number(body.quotation_id),
        remarks: body.remarks || null,
      };
      const result = await query(
        `
        INSERT INTO sal_orders
          (company_id, branch_id, order_no, order_date, customer_id, status, total_amount, sub_total, tax_amount, currency_id, exchange_rate, price_type, payment_type, warehouse_id, quotation_id, remarks)
        VALUES
          (:companyId, :branchId, :order_no, DATE(:order_date), :customer_id, :status, :total_amount, :sub_total, :tax_amount, :currency_id, :exchange_rate, :price_type, :payment_type, :warehouse_id, :quotation_id, :remarks)
        `,
        payload,
      );
      const orderId = result.insertId;
      const items = Array.isArray(body.items) ? body.items : [];
      for (const it of items) {
        const item_id = Number(it?.item_id);
        const qty = Number(it?.quantity || 0);
        const unit_price = Number(it?.unit_price || 0);
        const discount_percent = Number(it?.discount_percent || 0);
        const total_amount = Number(it?.total_amount || 0);
        const net_amount = Number(it?.net_amount || 0);
        const tax_amount = Number(it?.tax_amount || 0);
        const uom = String(it?.uom || "PCS").trim();
        if (!Number.isFinite(item_id) || qty <= 0) continue;
        await query(
          `
          INSERT INTO sal_order_details
            (order_id, item_id, qty, unit_price, discount_percent, total_amount, net_amount, tax_amount, uom)
          VALUES
            (:order_id, :item_id, :qty, :unit_price, :discount_percent, :total_amount, :net_amount, :tax_amount, :uom)
          `,
          {
            order_id: orderId,
            item_id,
            qty,
            unit_price,
            discount_percent,
            total_amount,
            net_amount,
            tax_amount,
            uom,
          },
        );
      }
      const [item] = await query(
        `
        SELECT 
          o.id, o.order_no, o.order_date, o.customer_id, c.customer_name,
          o.status, o.total_amount
        FROM sal_orders o
        LEFT JOIN sal_customers c ON c.id = o.customer_id AND c.company_id = o.company_id
        WHERE o.id = :id
        LIMIT 1
        `,
        { id: orderId },
      ).catch(() => []);
      res.status(201).json({ id: orderId, item: item || null });
    } catch (e) {
      next(e);
    }
  },
);

router.put(
  "/orders/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.ORDER.VIEW", "SAL.INVOICE.VIEW"]),
  async (req, res, next) => {
    try {
      await ensureSalesOrderColumns();
      const { companyId, branchId } = req.scope;
      const id = Number(req.params.id);
      if (!Number.isFinite(id))
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const body = req.body || {};
      const order_no = String(body.order_no || "").trim();
      const order_date = body.order_date
        ? String(body.order_date).slice(0, 10)
        : null;
      const customer_id = Number(body.customer_id);
      const status = String(body.status || "DRAFT")
        .trim()
        .toUpperCase();
      if (!order_no || !order_date || !Number.isFinite(customer_id)) {
        throw httpError(400, "VALIDATION_ERROR", "Invalid payload");
      }
      // Ensure order exists
      const [existing] = await query(
        `
        SELECT id FROM sal_orders
        WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        LIMIT 1
        `,
        { id, companyId, branchId },
      ).catch(() => []);
      if (!existing) throw httpError(404, "NOT_FOUND", "Order not found");
      const payload = {
        id,
        companyId,
        branchId,
        order_no,
        order_date,
        customer_id,
        status,
        total_amount: Number(body.total_amount || 0),
        sub_total: Number(body.sub_total || 0),
        tax_amount: Number(body.tax_amount || 0),
        currency_id: Number(body.currency_id || 4),
        exchange_rate: Number(body.exchange_rate || 1),
        price_type: String(body.price_type || "RETAIL"),
        payment_type: String(body.payment_type || "CASH"),
        warehouse_id:
          body.warehouse_id == null ? null : Number(body.warehouse_id),
        quotation_id:
          body.quotation_id == null ? null : Number(body.quotation_id),
        remarks: body.remarks || null,
      };
      await query(
        `
        UPDATE sal_orders
           SET order_no = :order_no,
               order_date = DATE(:order_date),
               customer_id = :customer_id,
               status = :status,
               total_amount = :total_amount,
               sub_total = :sub_total,
               tax_amount = :tax_amount,
               currency_id = :currency_id,
               exchange_rate = :exchange_rate,
               price_type = :price_type,
               payment_type = :payment_type,
               warehouse_id = :warehouse_id,
               quotation_id = :quotation_id,
               remarks = :remarks
         WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        `,
        payload,
      );
      await query(
        `
        DELETE FROM sal_order_details
        WHERE order_id = :id
        `,
        { id },
      );
      const items = Array.isArray(body.items) ? body.items : [];
      for (const it of items) {
        const item_id = Number(it?.item_id);
        const qty = Number(it?.quantity || 0);
        const unit_price = Number(it?.unit_price || 0);
        const discount_percent = Number(it?.discount_percent || 0);
        const total_amount = Number(it?.total_amount || 0);
        const net_amount = Number(it?.net_amount || 0);
        const tax_amount = Number(it?.tax_amount || 0);
        const uom = String(it?.uom || "PCS").trim();
        if (!Number.isFinite(item_id) || qty <= 0) continue;
        await query(
          `
          INSERT INTO sal_order_details
            (order_id, item_id, qty, unit_price, discount_percent, total_amount, net_amount, tax_amount, uom)
          VALUES
            (:order_id, :item_id, :qty, :unit_price, :discount_percent, :total_amount, :net_amount, :tax_amount, :uom)
          `,
          {
            order_id: id,
            item_id,
            qty,
            unit_price,
            discount_percent,
            total_amount,
            net_amount,
            tax_amount,
            uom,
          },
        );
      }
      res.json({ id });
    } catch (e) {
      next(e);
    }
  },
);
router.get(
  "/invoices",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const branchId = req.scope.branchId;
      const items = await query(
        `SELECT 
           i.id,
           i.invoice_no,
           i.invoice_date,
           i.customer_id,
           COALESCE(c.customer_name, '') AS customer_name,
           i.payment_status,
           i.status,
           i.net_amount,
           i.balance_amount,
           i.price_type,
           i.payment_type,
           i.warehouse_id,
           i.sales_order_id,
           i.remarks
         FROM sal_invoices i
         LEFT JOIN sal_customers c
           ON c.id = i.customer_id AND c.company_id = i.company_id
         WHERE i.company_id = :companyId AND i.branch_id = :branchId
         ORDER BY i.invoice_date DESC, i.id DESC`,
        { companyId, branchId },
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/invoices/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const id = Number(req.params.id);
      if (!Number.isFinite(id))
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const items = await query(
        `
        SELECT
          i.id,
          i.invoice_no,
          i.invoice_date,
          i.customer_id,
          COALESCE(c.customer_name, '') AS customer_name,
          i.payment_status,
          i.status,
          i.total_amount,
          i.net_amount,
          i.balance_amount,
          i.price_type,
          i.payment_type,
          i.currency_id,
          i.warehouse_id,
          i.sales_order_id,
          i.remarks
        FROM sal_invoices i
        LEFT JOIN sal_customers c
          ON c.id = i.customer_id AND c.company_id = i.company_id
        WHERE i.id = :id AND i.company_id = :companyId AND i.branch_id = :branchId
        LIMIT 1
        `,
        { id, companyId, branchId },
      ).catch(() => []);
      if (!items.length) throw httpError(404, "NOT_FOUND", "Invoice not found");
      const details = await query(
        `
        SELECT
          d.id,
          d.item_id,
          d.quantity,
          d.unit_price,
          d.discount_percent,
          d.total_amount,
          d.net_amount,
          d.uom,
          it.item_code,
          it.item_name
        FROM sal_invoice_details d
        LEFT JOIN inv_items it
          ON it.id = d.item_id AND it.company_id = :companyId
        WHERE d.invoice_id = :id
        ORDER BY d.id ASC
        `,
        { id, companyId },
      ).catch(() => []);
      res.json({
        item: items[0],
        details: Array.isArray(details) ? details : [],
      });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/invoices/next-no",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const rows = await query(
        `
        SELECT invoice_no
        FROM sal_invoices
        WHERE company_id = :companyId
          AND invoice_no REGEXP '^INV-?[0-9]{6}$'
        ORDER BY CAST(REPLACE(invoice_no, 'INV-', '') AS UNSIGNED) DESC
        LIMIT 1
        `,
        { companyId },
      );
      let nextNum = 1;
      if (rows.length > 0) {
        const prev = String(rows[0].invoice_no || "");
        const numPart = prev.replace(/^INV-?/, "");
        const n = parseInt(numPart, 10);
        if (Number.isFinite(n)) nextNum = n + 1;
      }
      const nextNo = `INV${String(nextNum).padStart(6, "0")}`;
      res.json({ nextNo });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/deliveries",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const items = await query(
        `
        SELECT
          d.id,
          d.delivery_no,
          d.delivery_date,
          d.customer_id,
          COALESCE(c.customer_name, '') AS customer_name,
          d.status
        FROM sal_deliveries d
        LEFT JOIN sal_customers c
          ON c.id = d.customer_id AND c.company_id = d.company_id
        WHERE d.company_id = :companyId AND d.branch_id = :branchId
        ORDER BY d.delivery_date DESC, d.id DESC
        `,
        { companyId, branchId },
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/deliveries/next-no",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const rows = await query(
        `
        SELECT delivery_no
        FROM sal_deliveries
        WHERE company_id = :companyId
          AND branch_id = :branchId
          AND delivery_no REGEXP '^DN-?[0-9]{6}$'
        ORDER BY CAST(REPLACE(delivery_no, 'DN-', '') AS UNSIGNED) DESC
        LIMIT 1
        `,
        { companyId, branchId },
      ).catch(() => []);
      let nextNum = 1;
      if (rows.length > 0) {
        const prev = String(rows[0].delivery_no || "");
        const numPart = prev.replace(/^DN-?/, "");
        const n = parseInt(numPart, 10);
        if (Number.isFinite(n)) nextNum = n + 1;
      }
      const nextNo = `DN${String(nextNum).padStart(6, "0")}`;
      res.json({ nextNo });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/deliveries/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const id = Number(req.params.id);
      if (!Number.isFinite(id))
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const items = await query(
        `
        SELECT
          d.id,
          d.delivery_no,
          d.delivery_date,
          d.customer_id,
          COALESCE(c.customer_name, '') AS customer_name,
          d.status,
          d.sales_order_id,
          d.remarks
        FROM sal_deliveries d
        LEFT JOIN sal_customers c
          ON c.id = d.customer_id AND c.company_id = d.company_id
        WHERE d.id = :id AND d.company_id = :companyId AND d.branch_id = :branchId
        LIMIT 1
        `,
        { id, companyId, branchId },
      ).catch(() => []);
      if (!items.length)
        throw httpError(404, "NOT_FOUND", "Delivery not found");
      const details = await query(
        `
        SELECT
          dd.id,
          dd.item_id,
          dd.quantity,
          dd.unit_price,
          dd.uom,
          it.item_code,
          it.item_name
        FROM sal_delivery_details dd
        LEFT JOIN inv_items it
          ON it.id = dd.item_id AND it.company_id = :companyId
        WHERE dd.delivery_id = :id
        ORDER BY dd.id ASC
        `,
        { id, companyId },
      ).catch(() => []);
      res.json({
        item: items[0],
        details: Array.isArray(details) ? details : [],
      });
    } catch (e) {
      next(e);
    }
  },
);

router.put(
  "/deliveries/:id/status",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const id = Number(req.params.id);
      if (!Number.isFinite(id))
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const status = String(req.body?.status || "")
        .trim()
        .toUpperCase();
      const allowed = new Set(["DRAFT", "DELIVERED", "CANCELLED"]);
      if (!allowed.has(status))
        throw httpError(400, "VALIDATION_ERROR", "Invalid status");
      const [existing] = await query(
        `
        SELECT id FROM sal_deliveries
        WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        LIMIT 1
        `,
        { id, companyId, branchId },
      ).catch(() => []);
      if (!existing) throw httpError(404, "NOT_FOUND", "Delivery not found");
      await query(
        `
        UPDATE sal_deliveries
           SET status = :status
         WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        `,
        { id, companyId, branchId, status },
      );
      res.json({ id, status });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/prices/standard",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const items = await query(
        `SELECT 
           i.id AS product_id,
           i.selling_price
         FROM inv_items i
         WHERE i.company_id = :companyId
         ORDER BY i.id ASC`,
        { companyId },
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/prices/best-price",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const productId = Number(req.body?.product_id);
      const priceTypeInput = req.body?.price_type;
      if (!Number.isFinite(productId) || productId <= 0) {
        return res.status(400).json({ message: "Invalid product_id" });
      }
      let priceTypeId = null;
      if (priceTypeInput != null) {
        const asNum = Number(priceTypeInput);
        if (Number.isFinite(asNum) && asNum > 0) {
          priceTypeId = asNum;
        } else {
          const name = String(priceTypeInput || "").trim();
          if (name) {
            const [pt] = await query(
              `
              SELECT id
              FROM sal_price_types
              WHERE company_id = :companyId AND UPPER(name) = UPPER(:name)
              LIMIT 1
              `,
              { companyId, name },
            ).catch(() => []);
            if (pt?.id) priceTypeId = Number(pt.id);
          }
        }
      }
      let priceRow = null;
      if (priceTypeId != null) {
        const [row] = await query(
          `
          SELECT selling_price
          FROM sal_standard_prices
          WHERE company_id = :companyId
            AND (branch_id = :branchId OR branch_id IS NULL)
            AND product_id = :productId
            AND price_type_id = :priceTypeId
          ORDER BY (branch_id IS NULL) ASC, COALESCE(effective_date, DATE('1900-01-01')) DESC, id DESC
          LIMIT 1
          `,
          { companyId, branchId, productId, priceTypeId },
        ).catch(() => []);
        priceRow = row || null;
      } else {
        const [row] = await query(
          `
          SELECT selling_price
          FROM sal_standard_prices
          WHERE company_id = :companyId
            AND (branch_id = :branchId OR branch_id IS NULL)
            AND product_id = :productId
          ORDER BY (branch_id IS NULL) ASC, COALESCE(effective_date, DATE('1900-01-01')) DESC, id DESC
          LIMIT 1
          `,
          { companyId, branchId, productId },
        ).catch(() => []);
        priceRow = row || null;
      }
      if (priceRow && priceRow.selling_price != null) {
        return res.json({ price: Number(priceRow.selling_price) });
      }
      const [fallback] = await query(
        `
        SELECT selling_price
        FROM inv_items
        WHERE company_id = :companyId AND id = :productId
        LIMIT 1
        `,
        { companyId, productId },
      ).catch(() => []);
      const price = Number(fallback?.selling_price ?? 0);
      return res.json({ price: Number.isFinite(price) ? price : 0 });
    } catch (e) {
      next(e);
    }
  },
);

// ===== DISCOUNT SCHEMES =====
// Minimal list endpoint to avoid 404 for client DiscountSchemeList
router.get(
  "/discount-schemes",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const items = await query(
        `
        SELECT 
          id,
          scheme_code,
          scheme_name,
          discount_type,
          discount_value,
          effective_from,
          effective_to,
          min_quantity,
          min_purchase_amount,
          max_discount_amount,
          description,
          is_active
        FROM sal_discount_schemes
        WHERE company_id = :companyId
        ORDER BY id DESC
        `,
        { companyId },
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/sales-register",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const from = req.query.from ? String(req.query.from) : null;
      const to = req.query.to ? String(req.query.to) : null;
      const items = await query(
        `
        SELECT 
          i.id,
          i.invoice_date,
          i.invoice_no,
          COALESCE(c.customer_name, '') AS customer_name,
          (SELECT COUNT(*) FROM sal_invoice_details d WHERE d.invoice_id = i.id) AS items_count,
          i.total_amount,
          i.status
        FROM sal_invoices i
        LEFT JOIN sal_customers c
          ON c.id = i.customer_id AND c.company_id = i.company_id
        WHERE i.company_id = :companyId
          AND i.branch_id = :branchId
          AND (:from IS NULL OR i.invoice_date >= :from)
          AND (:to IS NULL OR i.invoice_date <= :to)
        ORDER BY i.invoice_date DESC, i.id DESC
        `,
        { companyId, branchId, from, to },
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/delivery-register",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const from = req.query.from ? String(req.query.from) : null;
      const to = req.query.to ? String(req.query.to) : null;
      const items = await query(
        `
        SELECT
          d.id,
          d.delivery_date,
          d.delivery_no,
          COALESCE(c.customer_name, '') AS customer_name,
          it.item_code,
          it.item_name,
          dd.quantity AS qty
        FROM sal_deliveries d
        JOIN sal_delivery_details dd ON dd.delivery_id = d.id
        LEFT JOIN sal_customers c ON c.id = d.customer_id AND c.company_id = d.company_id
        LEFT JOIN inv_items it ON it.id = dd.item_id AND it.company_id = d.company_id
        WHERE d.company_id = :companyId
          AND d.branch_id = :branchId
          AND (:from IS NULL OR d.delivery_date >= :from)
          AND (:to IS NULL OR d.delivery_date <= :to)
        ORDER BY d.delivery_date DESC, d.id DESC, dd.id ASC
        `,
        { companyId, branchId, from, to },
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/sales-return",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const from = req.query.from ? String(req.query.from) : null;
      const to = req.query.to ? String(req.query.to) : null;
      const items = await query(
        `
        SELECT
          r.id,
          r.return_date,
          r.return_no,
          COALESCE(c.customer_name, '') AS customer_name,
          it.item_code,
          it.item_name,
          rd.qty_returned AS qty,
          rd.total_amount AS amount
        FROM sal_returns r
        JOIN sal_return_details rd ON rd.return_id = r.id
        LEFT JOIN sal_customers c ON c.id = r.customer_id AND c.company_id = r.company_id
        LEFT JOIN inv_items it ON it.id = rd.item_id AND it.company_id = r.company_id
        WHERE r.company_id = :companyId
          AND r.branch_id = :branchId
          AND (:from IS NULL OR r.return_date >= :from)
          AND (:to IS NULL OR r.return_date <= :to)
        ORDER BY r.return_date DESC, r.id DESC, rd.id ASC
        `,
        { companyId, branchId, from, to },
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/debtors-balance",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("SAL.CUSTOMER.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const asOf = req.query.asOf ? String(req.query.asOf) : null;
      const items = await query(
        `
        SELECT
          c.id,
          c.customer_name,
          0 AS opening,
          COALESCE(SUM(i.net_amount), 0) AS invoiced,
          COALESCE(SUM(i.net_amount - i.balance_amount), 0) AS received,
          COALESCE(SUM(i.balance_amount), 0) AS outstanding
        FROM sal_customers c
        LEFT JOIN sal_invoices i
          ON i.customer_id = c.id
         AND i.company_id = c.company_id
         AND i.branch_id = :branchId
         AND (:asOf IS NULL OR i.invoice_date <= :asOf)
        WHERE c.company_id = :companyId
        GROUP BY c.id, c.customer_name
        HAVING outstanding <> 0 OR invoiced <> 0 OR received <> 0
        ORDER BY c.customer_name ASC
        `,
        { companyId, branchId, asOf },
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/sales-profitability",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const from = req.query.from ? String(req.query.from) : null;
      const to = req.query.to ? String(req.query.to) : null;
      const items = await query(
        `
        SELECT
          i.id,
          i.invoice_date,
          i.invoice_no,
          COALESCE(c.customer_name, '') AS customer_name,
          COALESCE(i.net_amount, i.total_amount, 0) AS net_sales,
          COALESCE((
            SELECT SUM(d.quantity * COALESCE(it.cost_price, 0))
            FROM sal_invoice_details d
            LEFT JOIN inv_items it
              ON it.id = d.item_id AND it.company_id = i.company_id
            WHERE d.invoice_id = i.id
          ), 0) AS cost
        FROM sal_invoices i
        LEFT JOIN sal_customers c
          ON c.id = i.customer_id AND c.company_id = i.company_id
        WHERE i.company_id = :companyId
          AND i.branch_id = :branchId
          AND (:from IS NULL OR i.invoice_date >= :from)
          AND (:to IS NULL OR i.invoice_date <= :to)
        ORDER BY i.invoice_date DESC, i.id DESC
        `,
        { companyId, branchId, from, to },
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/sales-tracking",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const from = req.query.from ? String(req.query.from) : null;
      const to = req.query.to ? String(req.query.to) : null;
      const items = await query(
        `
        SELECT * FROM (
          SELECT
            'QUOTATION' AS stage,
            q.quotation_no AS ref_no,
            COALESCE(NULLIF(q.customer_name, ''), c.customer_name, '') AS customer_name,
            q.quotation_date AS txn_date,
            q.status AS status,
            q.total_amount AS total_value
          FROM sal_quotations q
          LEFT JOIN sal_customers c
            ON c.id = q.customer_id AND c.company_id = q.company_id
          WHERE q.company_id = :companyId
            AND q.branch_id = :branchId
            AND (:from IS NULL OR q.quotation_date >= :from)
            AND (:to IS NULL OR q.quotation_date <= :to)
          UNION ALL
          SELECT
            'ORDER' AS stage,
            o.order_no AS ref_no,
            COALESCE(c.customer_name, '') AS customer_name,
            o.order_date AS txn_date,
            o.status AS status,
            o.total_amount AS total_value
          FROM sal_orders o
          LEFT JOIN sal_customers c
            ON c.id = o.customer_id AND c.company_id = o.company_id
          WHERE o.company_id = :companyId
            AND o.branch_id = :branchId
            AND (:from IS NULL OR o.order_date >= :from)
            AND (:to IS NULL OR o.order_date <= :to)
          UNION ALL
          SELECT
            'DELIVERY' AS stage,
            d.delivery_no AS ref_no,
            COALESCE(c.customer_name, '') AS customer_name,
            d.delivery_date AS txn_date,
            d.status AS status,
            COALESCE(o.total_amount, 0) AS total_value
          FROM sal_deliveries d
          LEFT JOIN sal_orders o
            ON o.id = d.sales_order_id AND o.company_id = d.company_id
          LEFT JOIN sal_customers c
            ON c.id = d.customer_id AND c.company_id = d.company_id
          WHERE d.company_id = :companyId
            AND d.branch_id = :branchId
            AND (:from IS NULL OR d.delivery_date >= :from)
            AND (:to IS NULL OR d.delivery_date <= :to)
          UNION ALL
          SELECT
            'INVOICE' AS stage,
            i.invoice_no AS ref_no,
            COALESCE(c.customer_name, '') AS customer_name,
            i.invoice_date AS txn_date,
            i.status AS status,
            COALESCE(i.net_amount, i.total_amount, 0) AS total_value
          FROM sal_invoices i
          LEFT JOIN sal_customers c
            ON c.id = i.customer_id AND c.company_id = i.company_id
          WHERE i.company_id = :companyId
            AND i.branch_id = :branchId
            AND (:from IS NULL OR i.invoice_date >= :from)
            AND (:to IS NULL OR i.invoice_date <= :to)
        ) t
        ORDER BY txn_date DESC
        LIMIT 2000
        `,
        { companyId, branchId, from, to },
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

export default router;
