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

function getDefaultSampleTemplate(type) {
  const commonHead = `
<style>
  :root {
    --brand: #0E3646;
    --brand-50: #f0f7fa;
    --brand-700: #215876;
    --text: #1f2937;
    --muted: #6b7280;
    --border: #e5e7eb;
  }
  body { font-family: Arial, sans-serif; color: var(--text); }
  .doc {
    width: 19cm; margin: 0 auto; padding: 12px;
    border: 1px solid var(--border); border-radius: 6px;
  }
  .header {
    display: grid; grid-template-columns: 100px 1fr; gap: 12px;
    align-items: center; margin-bottom: 8px;
  }
  .logo { height: 80px; object-fit: contain; }
  .company {
    font-size: 12px; line-height: 1.3; text-align: right;
  }
  .company .name { font-weight: 700; font-size: 16px; color: var(--brand); }
  .meta { color: var(--muted); }
  .titlebar { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 8px; margin: 6px 0 10px 0; }
  .line { border-top: 2px solid var(--text); height: 0; }
  .title { font-weight: 700; color: var(--brand); text-align: center; }
  .info {
    display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 8px 0 12px 0;
  }
  .info .card {
    border: 1px solid var(--border); border-radius: 6px; padding: 8px;
  }
  .kv { font-size: 12px; line-height: 1.5; }
  .kv .row { display: grid; grid-template-columns: 130px 1fr; gap: 6px; }
  .kv .label { font-weight: 600; color: #000; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  thead th {
    background: var(--brand-50); color: var(--brand);
    border: 1px solid var(--border); padding: 6px; text-align: left;
  }
  tbody td { border: 1px solid var(--border); padding: 6px; }
  td.num { text-align: right; }
  .totals {
    display: grid; grid-template-columns: 1fr 220px; gap: 12px; margin-top: 10px;
  }
  .totals .box { border: 1px solid var(--border); border-radius: 6px; padding: 8px; }
  .footer {
    margin-top: 18px; font-size: 11px; border-top: 1px solid var(--border); padding-top: 8px;
    display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
  }
  .sign { height: 40px; border-bottom: 1px solid var(--border); }
</style>`;
  if (type === "sales-order") {
    return `
${commonHead}
<div class="doc">
  <div class="header">
    <img class="logo" src="{{company.logo}}" alt="Logo"/>
    <div class="company">
      <div class="name">{{company.name}}</div>
      <div>{{company.address}}</div>
      <div>{{company.address2}}</div>
      <div class="meta">{{company.phone}} • {{company.email}} • {{company.website}}</div>
    </div>
  </div>
  <div class="titlebar">
    <div class="line"></div>
    <div class="title">* Sales Order *</div>
    <div class="line"></div>
  </div>
  <div class="info">
    <div class="card">
      <div class="kv">
        <div class="row"><div class="label">Customer Name:</div><div class="value">{{customer.name}}</div></div>
        <div class="row"><div class="label">Address:</div><div class="value">{{customer.address}}</div></div>
        <div class="row"><div class="label">City:</div><div class="value">{{customer.city}}</div></div>
        <div class="row"><div class="label">State:</div><div class="value">{{customer.state}}</div></div>
        <div class="row"><div class="label">Country:</div><div class="value">{{customer.country}}</div></div>
      </div>
    </div>
    <div class="card">
      <div class="kv">
        <div class="row"><div class="label">Order No.:</div><div class="value">{{sales_order.number}}</div></div>
        <div class="row"><div class="label">Order Date:</div><div class="value">{{sales_order.date}}</div></div>
      </div>
    </div>
  </div>
  <table>
    <thead>
      <tr><th>#</th><th>Code</th><th>Description</th><th>Qty</th><th>UOM</th><th>Price</th><th>Disc%</th><th>Tax</th><th>Amount</th></tr>
    </thead>
    <tbody>
      {{#each sales_order.items}}
      <tr>
        <td>{{@index}}</td><td>{{code}}</td><td>{{name}}</td><td class="num">{{quantity}}</td><td>{{uom}}</td><td class="num">{{price}}</td><td class="num">{{discount}}</td><td class="num">{{tax}}</td><td class="num">{{amount}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>
  <div class="totals">
    <div></div>
    <div class="box">
      <div>Sub Total: {{sales_order.sub_total}}</div>
      <div>Tax: {{sales_order.tax_amount}}</div>
      <div><strong>Total: {{sales_order.total}}</strong></div>
    </div>
  </div>
  <div class="footer">
    <div>
      <div>Prepared By</div>
      <div class="sign"></div>
      <div class="meta">{{prepared_by}}</div>
    </div>
    <div>
      <div>Remarks</div>
      <div class="meta">{{sales_order.remarks}}</div>
    </div>
  </div>
</div>
`;
  }
  if (type === "invoice") {
    return `
${commonHead}
<div class="doc">
  <div class="header">
    <img class="logo" src="{{company.logo}}" alt="Logo"/>
    <div class="company">
      <div class="name">{{company.name}}</div>
      <div>{{company.address}}</div>
      <div>{{company.address2}}</div>
      <div class="meta">{{company.phone}} • {{company.email}} • {{company.website}}</div>
    </div>
  </div>
  <div class="titlebar">
    <div class="line"></div>
    <div class="title">* Sales Invoice *</div>
    <div class="line"></div>
  </div>
  <div class="info">
    <div class="card">
      <div class="kv">
        <div class="row"><div class="label">Customer Name:</div><div class="value">{{customer.name}}</div></div>
        <div class="row"><div class="label">Address:</div><div class="value">{{customer.address}}</div></div>
        <div class="row"><div class="label">City:</div><div class="value">{{customer.city}}</div></div>
        <div class="row"><div class="label">State:</div><div class="value">{{customer.state}}</div></div>
        <div class="row"><div class="label">Country:</div><div class="value">{{customer.country}}</div></div>
      </div>
    </div>
    <div class="card">
      <div class="kv">
        <div class="row"><div class="label">Invoice No.:</div><div class="value">{{invoice.number}}</div></div>
        <div class="row"><div class="label">Invoice Date:</div><div class="value">{{invoice.date}}</div></div>
        <div class="row"><div class="label">Payment Term:</div><div class="value">{{invoice.payment_term}}</div></div>
      </div>
    </div>
  </div>
  <table>
    <thead>
      <tr><th>#</th><th>Code</th><th>Description</th><th>Qty</th><th>UOM</th><th>Price</th><th>Disc%</th><th>Amount</th></tr>
    </thead>
    <tbody>
      {{#each invoice.items}}
      <tr>
        <td>{{@index}}</td><td>{{code}}</td><td>{{name}}</td><td class="num">{{quantity}}</td><td>{{uom}}</td><td class="num">{{price}}</td><td class="num">{{discount}}</td><td class="num">{{amount}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>
  <div class="totals">
    <div></div>
    <div class="box">
      <div>Net Total: {{invoice.net_total}}</div>
      <div><strong>Total: {{invoice.total}}</strong></div>
    </div>
  </div>
  <div class="footer">
    <div>
      <div>Prepared By</div>
      <div class="sign"></div>
      <div class="meta">{{prepared_by}}</div>
    </div>
    <div>
      <div>Remarks</div>
      <div class="meta">{{invoice.remarks}}</div>
    </div>
  </div>
</div>
`;
  }
  if (type === "delivery-note") {
    return `
${commonHead}
<div class="doc">
  <div class="header">
    <img class="logo" src="{{company.logo}}" alt="Logo"/>
    <div class="company">
      <div class="name">{{company.name}}</div>
      <div>{{company.address}}</div>
      <div>{{company.address2}}</div>
      <div class="meta">{{company.phone}} • {{company.email}} • {{company.website}}</div>
    </div>
  </div>
  <div class="title">Delivery Note</div>
  <div class="info">
    <div class="card">
      <div><strong>Customer</strong></div>
      <div>{{customer.name}}</div>
      <div class="meta">{{customer.address}}</div>
    </div>
    <div class="card">
      <div><strong>Delivery Info</strong></div>
      <div>Number: {{delivery_note.number}}</div>
      <div>Date: {{delivery_note.date}}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr><th>#</th><th>Code</th><th>Description</th><th>Qty</th><th>UOM</th></tr>
    </thead>
    <tbody>
      {{#each delivery_note.items}}
      <tr>
        <td>{{@index}}</td><td>{{code}}</td><td>{{name}}</td><td class="num">{{quantity}}</td><td>{{uom}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>
  <div class="footer">
    <div>
      <div>Received By</div>
      <div class="sign"></div>
    </div>
    <div>
      <div>Signature</div>
      <div class="sign"></div>
    </div>
  </div>
</div>
`;
  }
  if (type === "payment-voucher") {
    return `
${commonHead}
<div class="doc">
  <div class="header">
    <img class="logo" src="{{company.logo}}" alt="Logo"/>
    <div class="company">
      <div class="name">{{company.name}}</div>
      <div>{{company.address}}</div>
      <div>{{company.address2}}</div>
      <div class="meta">{{company.phone}} • {{company.email}} • {{company.website}}</div>
    </div>
  </div>
  <div class="titlebar">
    <div class="line"></div>
    <div class="title">* Cash Payment Voucher *</div>
    <div class="line"></div>
  </div>
  <div class="info">
    <div class="card">
      <div><strong>Voucher Info</strong></div>
      <div>Number: {{payment_voucher.number}}</div>
      <div>Date: {{payment_voucher.date}}</div>
      <div class="meta">Type: {{payment_voucher.type_code}} • {{payment_voucher.type_name}}</div>
    </div>
    <div class="card">
      <div><strong>Narration</strong></div>
      <div class="meta">{{payment_voucher.narration}}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr><th>#</th><th>Account Code</th><th>Account Name</th><th>Description</th><th>Debit</th><th>Credit</th><th>Ref</th></tr>
    </thead>
    <tbody>
      {{#each payment_voucher.items}}
      <tr>
        <td>{{@index}}</td><td>{{account_code}}</td><td>{{account_name}}</td><td>{{description}}</td><td class="num">{{debit}}</td><td class="num">{{credit}}</td><td>{{reference_no}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>
  <div class="totals">
    <div></div>
    <div class="box">
      <div>Total Debit: {{payment_voucher.total_debit}}</div>
      <div><strong>Total Credit: {{payment_voucher.total_credit}}</strong></div>
    </div>
  </div>
  <div class="footer">
    <div>
      <div>Prepared By</div>
      <div class="sign"></div>
    </div>
    <div>
      <div>Receiver Signature</div>
      <div class="sign"></div>
    </div>
  </div>
</div>
`;
  }
  if (type === "quotation") {
    return `
${commonHead}
<div class="doc">
  <div class="header">
    <img class="logo" src="{{company.logo}}" alt="Logo"/>
    <div class="company">
      <div class="name">{{company.name}}</div>
      <div>{{company.address}}</div>
      <div>{{company.address2}}</div>
      <div class="meta">{{company.phone}} • {{company.email}} • {{company.website}}</div>
    </div>
  </div>
  <div class="titlebar">
    <div class="line"></div>
    <div class="title">* Quotation *</div>
    <div class="line"></div>
  </div>
  <div class="info">
    <div class="card">
      <div class="kv">
        <div class="row"><div class="label">Customer Name:</div><div class="value">{{customer.name}}</div></div>
        <div class="row"><div class="label">Address:</div><div class="value">{{customer.address}}</div></div>
        <div class="row"><div class="label">City:</div><div class="value">{{customer.city}}</div></div>
        <div class="row"><div class="label">State:</div><div class="value">{{customer.state}}</div></div>
        <div class="row"><div class="label">Country:</div><div class="value">{{customer.country}}</div></div>
      </div>
    </div>
    <div class="card">
      <div class="kv">
        <div class="row"><div class="label">Quotation No.:</div><div class="value">{{quotation.number}}</div></div>
        <div class="row"><div class="label">Quotation Date:</div><div class="value">{{quotation.date}}</div></div>
      </div>
    </div>
  </div>
  <table>
    <thead>
      <tr><th>#</th><th>Code</th><th>Description</th><th>Qty</th><th>UOM</th><th>Price</th><th>Disc%</th><th>Tax</th><th>Amount</th></tr>
    </thead>
    <tbody>
      {{#each quotation.items}}
      <tr>
        <td>{{@index}}</td><td>{{code}}</td><td>{{name}}</td><td class="num">{{quantity}}</td><td>{{uom}}</td><td class="num">{{price}}</td><td class="num">{{discount}}</td><td class="num">{{tax}}</td><td class="num">{{amount}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>
  <div class="totals">
    <div></div>
    <div class="box">
      <div>Sub Total: {{quotation.sub_total}}</div>
      <div>Tax: {{quotation.tax_amount}}</div>
      <div><strong>Total: {{quotation.total}}</strong></div>
    </div>
  </div>
  <div class="footer">
    <div>
      <div>Prepared By</div>
      <div class="sign"></div>
      <div class="meta">{{prepared_by}}</div>
    </div>
    <div>
      <div>Remarks</div>
      <div class="meta">{{quotation.remarks}}</div>
    </div>
  </div>
</div>
`;
  }
  if (type === "receipt-voucher") {
    return `
${commonHead}
<div class="doc">
  <div class="header">
    <img class="logo" src="{{company.logo}}" alt="Logo"/>
    <div class="company">
      <div class="name">{{company.name}}</div>
      <div>{{company.address}}</div>
      <div>{{company.address2}}</div>
      <div class="meta">{{company.phone}} • {{company.email}} • {{company.website}}</div>
    </div>
  </div>
  <div class="titlebar">
    <div class="line"></div>
    <div class="title">* Receipt Voucher *</div>
    <div class="line"></div>
  </div>
  <div class="info">
    <div class="card">
      <div><strong>Voucher Info</strong></div>
      <div>Number: {{receipt_voucher.number}}</div>
      <div>Date: {{receipt_voucher.date}}</div>
      <div class="meta">Type: {{receipt_voucher.type_code}} • {{receipt_voucher.type_name}}</div>
    </div>
    <div class="card">
      <div><strong>Narration</strong></div>
      <div class="meta">{{receipt_voucher.narration}}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr><th>#</th><th>Account Code</th><th>Account Name</th><th>Description</th><th>Debit</th><th>Credit</th><th>Ref</th></tr>
    </thead>
    <tbody>
      {{#each receipt_voucher.items}}
      <tr>
        <td>{{@index}}</td><td>{{account_code}}</td><td>{{account_name}}</td><td>{{description}}</td><td class="num">{{debit}}</td><td class="num">{{credit}}</td><td>{{reference_no}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>
  <div class="totals">
    <div></div>
    <div class="box">
      <div>Total Debit: {{receipt_voucher.total_debit}}</div>
      <div><strong>Total Credit: {{receipt_voucher.total_credit}}</strong></div>
    </div>
  </div>
  <div class="footer">
    <div>
      <div>Prepared By</div>
      <div class="sign"></div>
    </div>
    <div>
      <div>Receiver Signature</div>
      <div class="sign"></div>
    </div>
  </div>
</div>
`;
  }
  return "<div>Define your template here</div>";
}

async function loadPreviewData(type, companyId, branchId) {
  const [company] = await query(
    `
    SELECT id, name, address, city, state, postal_code, country, telephone, email, website
    FROM adm_companies
    WHERE id = :companyId
    LIMIT 1
    `,
    { companyId },
  ).catch(() => []);
  if (type === "sales-order") {
    return {
      company: company || {},
      customer: {
        name: "Customer Name",
        address: "",
        city: "",
        state: "",
        country: "",
        phone: "",
        email: "",
      },
      sales_order: {
        id: 0,
        number: "",
        date: new Date().toDateString(),
        status: "DRAFT",
        sub_total: 0,
        tax_amount: 0,
        total: 0,
        remarks: "",
        items: [
          {
            name: "Sample Item",
            code: "ITEM001",
            quantity: 2,
            price: 100,
            discount: 0,
            amount: 200,
            net: 200,
            tax: 0,
            uom: "PCS",
          },
          {
            name: "Sample Item 2",
            code: "ITEM002",
            quantity: 1,
            price: 50,
            discount: 0,
            amount: 50,
            net: 50,
            tax: 0,
            uom: "PCS",
          },
        ],
      },
    };
  }
  if (type === "invoice") {
    return {
      company: company || {},
      customer: {
        name: "Customer Name",
        address: "",
        city: "",
        state: "",
        country: "",
        phone: "",
        email: "",
      },
      invoice: {
        id: 0,
        number: "",
        date: new Date().toDateString(),
        status: "DRAFT",
        payment_status: "PENDING",
        payment_term: "credit",
        net_total: 0,
        total: 0,
        remarks: "",
        items: [
          {
            name: "Sample Item",
            code: "ITEM001",
            quantity: 2,
            price: 100,
            discount: 0,
            amount: 200,
            net: 200,
            uom: "PCS",
          },
          {
            name: "Sample Item 2",
            code: "ITEM002",
            quantity: 1,
            price: 50,
            discount: 0,
            amount: 50,
            net: 50,
            uom: "PCS",
          },
        ],
      },
    };
  }
  if (type === "delivery-note") {
    return {
      company: company || {},
      customer: {
        name: "Customer Name",
        address: "",
        phone: "",
        email: "",
      },
      delivery_note: {
        id: 0,
        number: "",
        date: new Date().toDateString(),
        status: "DRAFT",
        remarks: "",
        items: [
          { name: "Sample Item", code: "ITEM001", quantity: 2, uom: "PCS" },
          { name: "Sample Item 2", code: "ITEM002", quantity: 1, uom: "PCS" },
        ],
      },
    };
  }
  if (type === "payment-voucher") {
    return {
      company: company || {},
      payment_voucher: {
        id: 0,
        number: "",
        date: new Date().toDateString(),
        narration: "",
        total_debit: 0,
        total_credit: 0,
        type_code: "PV",
        type_name: "Payment Voucher",
        items: [
          {
            account_code: "1000",
            account_name: "Cash",
            description: "Sample",
            debit: 250,
            credit: 0,
            reference_no: "",
          },
          {
            account_code: "4000",
            account_name: "Sales",
            description: "Sample",
            debit: 0,
            credit: 250,
            reference_no: "",
          },
        ],
      },
    };
  }
  if (type === "quotation") {
    return {
      company: company || {},
      customer: {
        name: "Customer Name",
        address: "",
        phone: "",
        email: "",
      },
      quotation: {
        id: 0,
        number: "",
        date: new Date().toDateString(),
        status: "DRAFT",
        sub_total: 0,
        tax_amount: 0,
        total: 0,
        remarks: "",
        items: [
          {
            name: "Sample Item",
            code: "ITEM001",
            quantity: 2,
            price: 100,
            discount: 0,
            amount: 200,
            net: 200,
            tax: 0,
            uom: "PCS",
          },
          {
            name: "Sample Item 2",
            code: "ITEM002",
            quantity: 1,
            price: 50,
            discount: 0,
            amount: 50,
            net: 50,
            tax: 0,
            uom: "PCS",
          },
        ],
      },
    };
  }
  if (type === "receipt-voucher") {
    return {
      company: company || {},
      receipt_voucher: {
        id: 0,
        number: "",
        date: new Date().toDateString(),
        narration: "",
        total_debit: 0,
        total_credit: 0,
        type_code: "RV",
        type_name: "Receipt Voucher",
        items: [
          {
            account_code: "1000",
            account_name: "Cash",
            description: "Sample",
            debit: 250,
            credit: 0,
            reference_no: "",
          },
          {
            account_code: "1100",
            account_name: "Receivables",
            description: "Sample",
            debit: 0,
            credit: 250,
            reference_no: "",
          },
        ],
      },
    };
  }
  throw httpError(400, "VALIDATION_ERROR", "Unsupported type");
}

async function loadData(type, id, companyId, branchId) {
  if (type === "sales-order") {
    const [order] = await query(
      `
      SELECT
        o.id,
        o.order_no,
        o.order_date,
        o.customer_id,
        o.created_by,
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
    let employee = null;
    if (order.created_by) {
      const [u] = await query(
        `
        SELECT id, username, email, full_name
        FROM adm_users
        WHERE id = :uid
        LIMIT 1
        `,
        { uid: order.created_by },
      ).catch(() => []);
      if (u) {
        employee = {
          id: u.id,
          username: u.username,
          email: u.email,
          name: u.full_name || u.username,
        };
      }
    }
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
      employee: employee || undefined,
      prepared_by: employee?.username || employee?.name || undefined,
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
        i.created_by,
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
    let employee = null;
    if (inv.created_by) {
      const [u] = await query(
        `
        SELECT id, username, email, full_name
        FROM adm_users
        WHERE id = :uid
        LIMIT 1
        `,
        { uid: inv.created_by },
      ).catch(() => []);
      if (u) {
        employee = {
          id: u.id,
          username: u.username,
          email: u.email,
          name: u.full_name || u.username,
        };
      }
    }
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
      employee: employee || undefined,
      prepared_by: employee?.username || employee?.name || undefined,
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
        d.created_by,
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
    let employee = null;
    if (dn.created_by) {
      const [u] = await query(
        `
        SELECT id, username, email, full_name
        FROM adm_users
        WHERE id = :uid
        LIMIT 1
        `,
        { uid: dn.created_by },
      ).catch(() => []);
      if (u) {
        employee = {
          id: u.id,
          username: u.username,
          email: u.email,
          name: u.full_name || u.username,
        };
      }
    }
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
      employee: employee || undefined,
      prepared_by: employee?.username || employee?.name || undefined,
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
        v.created_by,
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
    let employee = null;
    if (voucher.created_by) {
      const [u] = await query(
        `
        SELECT id, username, email, full_name
        FROM adm_users
        WHERE id = :uid
        LIMIT 1
        `,
        { uid: voucher.created_by },
      ).catch(() => []);
      if (u) {
        employee = {
          id: u.id,
          username: u.username,
          email: u.email,
          name: u.full_name || u.username,
        };
      }
    }
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
      employee: employee || undefined,
      prepared_by: employee?.username || employee?.name || undefined,
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
               header_logo_url, header_name, header_address, header_address2, header_phone, header_email, header_website
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
          address2: tpl.header_address2 || data.company.address2,
          phone:
            tpl.header_phone || data.company.telephone || data.company.phone,
          email: tpl.header_email || data.company.email,
          website: tpl.header_website || data.company.website,
          logo: tpl.header_logo_url || logoDefault,
        };
        // expose normalized fields
        data.company = { ...merged, telephone: merged.phone };
      }
      const preparedBy =
        (req.user &&
          (req.user.username ||
            req.user.full_name ||
            req.user.name ||
            req.user.email)) ||
        "";
      if (!data.prepared_by) data.prepared_by = preparedBy;
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

router.post(
  "/:type/preview",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureTemplateTables();
      const { companyId, branchId } = req.scope;
      const type = String(req.params.type || "").trim();
      if (!type) throw httpError(400, "VALIDATION_ERROR", "Invalid request");
      const [tpl] = await query(
        `
        SELECT id, html_content,
               header_logo_url, header_name, header_address, header_address2, header_phone, header_email, header_website
        FROM document_templates 
        WHERE company_id = :companyId AND document_type = :type AND is_default = 1
        LIMIT 1
        `,
        { companyId, type },
      ).catch(() => []);
      let tplObj = tpl;
      if (!tplObj) {
        tplObj = {
          id: 0,
          html_content: getDefaultSampleTemplate(type),
          header_logo_url: null,
          header_name: null,
          header_address: null,
          header_phone: null,
          header_email: null,
          header_website: null,
        };
      }
      const data = await loadPreviewData(type, companyId, branchId);
      if (data && data.company) {
        const logoDefault = `/api/admin/companies/${companyId}/logo`;
        const merged = {
          ...data.company,
          name: tplObj.header_name || data.company.name,
          address: tplObj.header_address || data.company.address,
          address2: tplObj.header_address2 || data.company.address2,
          phone:
            tplObj.header_phone || data.company.telephone || data.company.phone,
          email: tplObj.header_email || data.company.email,
          website: tplObj.header_website || data.company.website,
          logo: tplObj.header_logo_url || logoDefault,
        };
        data.company = { ...merged, telephone: merged.phone };
      }
      const preparedBy =
        (req.user &&
          (req.user.username ||
            req.user.full_name ||
            req.user.name ||
            req.user.email)) ||
        "";
      if (!data.prepared_by) data.prepared_by = preparedBy;
      const tmpl = Handlebars.compile(String(tplObj.html_content || ""));
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
