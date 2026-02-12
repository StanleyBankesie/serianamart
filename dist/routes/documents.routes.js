import express from "express";
import Handlebars from "handlebars";
import sanitizeHtml from "sanitize-html";
import {
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
} from "../middleware/auth.js";
import { query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import { ensureTemplateTables, toNumber } from "../utils/dbUtils.js";

const router = express.Router();

async function loadData(type, id, companyId, branchId) {
  if (type === "sales-order") {
    const [order] = await query(
      `
      SELECT
        o.id,
        o.order_no,
        o.order_date,
        o.customer_id,
        COALESCE(c.customer_name, '') AS customer_name,
        COALESCE(c.address, '') AS customer_address,
        COALESCE(c.phone, '') AS customer_phone,
        COALESCE(c.email, '') AS customer_email,
        o.status,
        o.total_amount,
        o.sub_total,
        o.tax_amount,
        o.currency_id,
        o.exchange_rate,
        o.remarks
      FROM sal_orders o
      LEFT JOIN sal_customers c
        ON c.id = o.customer_id AND c.company_id = o.company_id
      WHERE o.id = :id AND o.company_id = :companyId AND o.branch_id = :branchId
      LIMIT 1
      `,
      { id, companyId, branchId },
    ).catch(() => []);
    if (!order) throw httpError(404, "NOT_FOUND", "Document not found");
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
    const [company] = await query(
      `
      SELECT id, name, address, city, state, postal_code, country, telephone, email, website
      FROM adm_companies
      WHERE id = :companyId
      LIMIT 1
      `,
      { companyId },
    ).catch(() => []);
    const items = Array.isArray(details) ? details : [];
    return {
      company: company || {},
      customer: {
        name: order.customer_name,
        address: order.customer_address,
        phone: order.customer_phone,
        email: order.customer_email,
      },
      sales_order: {
        id: order.id,
        number: order.order_no,
        date: order.order_date,
        status: order.status,
        sub_total: order.sub_total,
        tax_amount: order.tax_amount,
        total: order.total_amount,
        remarks: order.remarks,
        items: items.map((d) => ({
          name: d.item_name,
          code: d.item_code,
          quantity: d.quantity,
          price: d.unit_price,
          discount: d.discount_percent,
          amount: d.total_amount,
          net: d.net_amount,
          tax: d.tax_amount,
          uom: d.uom,
        })),
      },
    };
  }
  if (type === "invoice") {
    const [inv] = await query(
      `
      SELECT
        i.id,
        i.invoice_no,
        i.invoice_date,
        i.customer_id,
        COALESCE(c.customer_name, '') AS customer_name,
        COALESCE(c.address, '') AS customer_address,
        COALESCE(c.phone, '') AS customer_phone,
        COALESCE(c.email, '') AS customer_email,
        i.status,
        i.payment_status,
        i.total_amount,
        i.net_amount,
        i.remarks
      FROM sal_invoices i
      LEFT JOIN sal_customers c
        ON c.id = i.customer_id AND c.company_id = i.company_id
      WHERE i.id = :id AND i.company_id = :companyId AND i.branch_id = :branchId
      LIMIT 1
      `,
      { id, companyId, branchId },
    ).catch(() => []);
    if (!inv) throw httpError(404, "NOT_FOUND", "Document not found");
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
    const [company] = await query(
      `
      SELECT id, name, address, city, state, postal_code, country, telephone, email, website
      FROM adm_companies
      WHERE id = :companyId
      LIMIT 1
      `,
      { companyId },
    ).catch(() => []);
    const items = Array.isArray(details) ? details : [];
    return {
      company: company || {},
      customer: {
        name: inv.customer_name,
        address: inv.customer_address,
        phone: inv.customer_phone,
        email: inv.customer_email,
      },
      invoice: {
        id: inv.id,
        number: inv.invoice_no,
        date: inv.invoice_date,
        status: inv.status,
        payment_status: inv.payment_status,
        net_total: inv.net_amount,
        total: inv.total_amount,
        remarks: inv.remarks,
        items: items.map((d) => ({
          name: d.item_name,
          code: d.item_code,
          quantity: d.quantity,
          price: d.unit_price,
          discount: d.discount_percent,
          amount: d.total_amount,
          net: d.net_amount,
          uom: d.uom,
        })),
      },
    };
  }
  if (type === "delivery-note") {
    const [dn] = await query(
      `
      SELECT
        d.id,
        d.delivery_no,
        d.delivery_date,
        d.customer_id,
        COALESCE(c.customer_name, '') AS customer_name,
        COALESCE(c.address, '') AS customer_address,
        COALESCE(c.phone, '') AS customer_phone,
        COALESCE(c.email, '') AS customer_email,
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
    if (!dn) throw httpError(404, "NOT_FOUND", "Document not found");
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
    const [company] = await query(
      `
      SELECT id, name, address, city, state, postal_code, country, telephone, email, website
      FROM adm_companies
      WHERE id = :companyId
      LIMIT 1
      `,
      { companyId },
    ).catch(() => []);
    const items = Array.isArray(details) ? details : [];
    return {
      company: company || {},
      customer: {
        name: dn.customer_name,
        address: dn.customer_address,
        phone: dn.customer_phone,
        email: dn.customer_email,
      },
      delivery_note: {
        id: dn.id,
        number: dn.delivery_no,
        date: dn.delivery_date,
        status: dn.status,
        remarks: dn.remarks,
        items: items.map((d) => ({
          name: d.item_name,
          code: d.item_code,
          quantity: d.quantity,
          uom: d.uom,
        })),
      },
    };
  }
  if (type === "payment-voucher") {
    const [voucher] = await query(
      `
      SELECT 
        v.id,
        v.voucher_no,
        v.voucher_date,
        v.narration,
        v.total_debit,
        v.total_credit,
        vt.code AS voucher_type_code,
        vt.name AS voucher_type_name
      FROM fin_vouchers v
      JOIN fin_voucher_types vt ON vt.id = v.voucher_type_id
      WHERE v.id = :id AND v.company_id = :companyId AND v.branch_id = :branchId
      LIMIT 1
      `,
      { id, companyId, branchId },
    ).catch(() => []);
    if (!voucher) throw httpError(404, "NOT_FOUND", "Document not found");
    const lines = await query(
      `
      SELECT 
        l.id,
        l.line_no,
        a.code AS account_code,
        a.name AS account_name,
        l.description,
        l.debit,
        l.credit,
        l.reference_no
      FROM fin_voucher_lines l
      JOIN fin_accounts a ON a.id = l.account_id
      WHERE l.voucher_id = :id
      ORDER BY l.line_no ASC
      `,
      { id },
    ).catch(() => []);
    const [company] = await query(
      `
      SELECT id, name, address, city, state, postal_code, country, telephone, email, website
      FROM adm_companies
      WHERE id = :companyId
      LIMIT 1
      `,
      { companyId },
    ).catch(() => []);
    return {
      company: company || {},
      payment_voucher: {
        id: voucher.id,
        number: voucher.voucher_no,
        date: voucher.voucher_date,
        narration: voucher.narration,
        total_debit: voucher.total_debit,
        total_credit: voucher.total_credit,
        type_code: voucher.voucher_type_code,
        type_name: voucher.voucher_type_name,
        items: (Array.isArray(lines) ? lines : []).map((l) => ({
          account_code: l.account_code,
          account_name: l.account_name,
          description: l.description,
          debit: l.debit,
          credit: l.credit,
          reference_no: l.reference_no,
        })),
      },
    };
  }
  throw httpError(400, "VALIDATION_ERROR", "Unsupported type");
}

router.post(
  "/:type/:id/render",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureTemplateTables();
      const { companyId, branchId } = req.scope;
      const type = String(req.params.type || "").trim();
      const id = toNumber(req.params.id);
      if (!type || !id)
        throw httpError(400, "VALIDATION_ERROR", "Invalid request");
      const [tpl] = await query(
        `
        SELECT id, html_content,
               header_logo_url, header_name, header_address, header_phone, header_email, header_website
        FROM document_templates 
        WHERE company_id = :companyId AND document_type = :type AND is_default = 1
        LIMIT 1
        `,
        { companyId, type },
      ).catch(() => []);
      if (!tpl) throw httpError(404, "NOT_FOUND", "Default template not found");
      const data = await loadData(type, id, companyId, branchId);
      if (data && data.company) {
        const logoDefault = `/api/admin/companies/${companyId}/logo`;
        const merged = {
          ...data.company,
          name: tpl.header_name || data.company.name,
          address: tpl.header_address || data.company.address,
          phone:
            tpl.header_phone || data.company.telephone || data.company.phone,
          email: tpl.header_email || data.company.email,
          website: tpl.header_website || data.company.website,
          logo: tpl.header_logo_url || logoDefault,
        };
        // expose normalized fields
        data.company = { ...merged, telephone: merged.phone };
      }
      const tmpl = Handlebars.compile(String(tpl.html_content || ""));
      const html = tmpl(data);
      const format = String(
        req.query.format || req.body?.format || "html",
      ).toLowerCase();
      if (format === "pdf") {
        try {
          const cleaned = sanitizeHtml(html, {
            allowedTags: false,
            allowedAttributes: false,
          });
          const head = `<meta charset="utf-8"><style>html,body{margin:0;padding:24px} @page{margin:12mm} img{max-width:100%}</style>`;
          const doc = `<!DOCTYPE html><html><head>${head}</head><body>${cleaned}</body></html>`;
          const mod = await import("puppeteer");
          const puppeteer = mod.default || mod;
          const browser = await puppeteer.launch({
            headless: "new",
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
          });
          const page = await browser.newPage();
          await page.setContent(doc, { waitUntil: "networkidle0" });
          const pdf = await page.pdf({
            format: "A4",
            printBackground: true,
            margin: {
              top: "12mm",
              bottom: "12mm",
              left: "12mm",
              right: "12mm",
            },
          });
          await browser.close();
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader("Content-Length", pdf.length);
          res.send(pdf);
          return;
        } catch (e) {
          throw httpError(501, "NOT_IMPLEMENTED", "PDF rendering unavailable");
        }
      }
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
