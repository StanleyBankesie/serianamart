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
import { ensureTemplateTables, toNumber, hasColumn } from "../utils/dbUtils.js";

const router = express.Router();

// Register Handlebars helpers
Handlebars.registerHelper("formatDate", function (date) {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  return d.toISOString().split("T")[0]; // Returns YYYY-MM-DD
});

function expandDocumentTypeAliases(type) {
  const t = String(type || "")
    .trim()
    .toLowerCase();
  if (
    t === "sales-order" ||
    t === "sales order" ||
    t === "sales_order" ||
    t === "so"
  ) {
    return [
      "sales-order",
      "sales order",
      "sales_order",
      "SALES_ORDER",
      "SALES-ORDER",
      "Sales Order",
      "SO",
    ];
  }
  if (
    t === "invoice" ||
    t === "sales-invoice" ||
    t === "sales invoice" ||
    t === "sales_invoice"
  ) {
    return [
      "invoice",
      "INVOICE",
      "sales-invoice",
      "sales invoice",
      "sales_invoice",
      "Sales Invoice",
    ];
  }
  if (
    t === "delivery-note" ||
    t === "delivery note" ||
    t === "delivery_note" ||
    t === "dn"
  ) {
    return [
      "delivery-note",
      "delivery note",
      "delivery_note",
      "DELIVERY_NOTE",
      "DELIVERY-NOTE",
      "Delivery Note",
      "DN",
    ];
  }
  if (t === "quotation" || t === "quote" || t === "sales-quotation") {
    return [
      "quotation",
      "Quotation",
      "QUOTE",
      "sales-quotation",
      "Sales Quotation",
    ];
  }
  if (t === "payment-voucher" || t === "receipt-voucher" || t === "voucher") {
    return [type]; // leave as-is for now
  }
  return [type];
}

function docTypeSynonymsLower(type) {
  const c = canonicalDocumentType(type).toLowerCase();
  if (c === "sales-order") {
    return [
      "sales-order",
      "sales order",
      "sales_order",
      "sales-orders",
      "sales orders",
      "sales_orders",
      "salesorder",
      "salesorders",
      "salesorder(s)",
      "so",
      "sales_order(s)",
      "sales-order(s)",
      "sales order(s)",
      "sales order document",
    ];
  }
  if (c === "invoice") {
    return [
      "invoice",
      "invoices",
      "sales-invoice",
      "sales invoice",
      "sales_invoice",
      "sales-invoices",
      "sales invoices",
      "sales_invoices",
      "salesinvoice",
      "salesinvoices",
      "sales invoice document",
    ];
  }
  if (c === "delivery-note") {
    return [
      "delivery-note",
      "delivery note",
      "delivery_note",
      "delivery-notes",
      "delivery notes",
      "delivery_notes",
      "deliverynote",
      "deliverynotes",
      "dn",
      "delivery note document",
    ];
  }
  if (c === "quotation") {
    return [
      "quotation",
      "quotations",
      "sales-quotation",
      "sales quotation",
      "sales_quotation",
      "sales-quotations",
      "sales quotations",
      "sales_quotations",
      "quote",
      "quotes",
      "sales quote",
      "sales quotes",
      "sales_quote",
      "sales_quote(s)",
      "quotation document",
    ];
  }
  return [c];
}

function canonicalDocumentType(type) {
  const t = String(type || "")
    .trim()
    .toLowerCase();
  if (
    t === "sales-order" ||
    t === "sales order" ||
    t === "sales_order" ||
    t === "so"
  ) {
    return "sales-order";
  }
  if (
    t === "invoice" ||
    t === "sales-invoice" ||
    t === "sales invoice" ||
    t === "sales_invoice"
  ) {
    return "invoice";
  }
  if (
    t === "delivery-note" ||
    t === "delivery note" ||
    t === "delivery_note" ||
    t === "dn"
  ) {
    return "delivery-note";
  }
  if (t === "quotation" || t === "quote" || t === "sales-quotation") {
    return "quotation";
  }
  return String(type || "").trim();
}

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
  <div class="info" style="grid-template-columns: 1fr 1fr;">
    <div class="card">
      <div class="kv">
        <div class="row"><div class="label">Name:</div><div class="value">{{customer.name}}</div></div>
        <div class="row"><div class="label">Address:</div><div class="value">{{customer.address}}</div></div>
        <div class="row"><div class="label"></div><div class="value">{{customer.address2}}</div></div>
        <div class="row"><div class="label">Mobile:</div><div class="value">{{customer.phone}}</div></div>
        <div class="row"><div class="label">Email:</div><div class="value">{{customer.email}}</div></div>
      </div>
    </div>
    <div class="card">
      <div class="kv">
        <div class="row"><div class="label">Order No.:</div><div class="value">{{sales_order.number}}</div></div>
        <div class="row"><div class="label">Order Date:</div><div class="value">{{formatDate sales_order.date}}</div></div>
        <div class="row"><div class="label">Payment Term:</div><div class="value">{{sales_order.payment_terms}}</div></div>
      </div>
      <div style="text-align:right;margin-top:6px;">
        <img src="{{sales_order.qr_code}}" alt="QR" style="width:90px;height:90px;border:1px solid var(--border);" />
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
      <div>Discount: {{sales_order.discount_amount}}</div>
      <div>Tax: {{sales_order.tax_amount}}</div>
      <div><strong>Net Amount: {{sales_order.net_amount}}</strong></div>
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
  <div class="info" style="grid-template-columns: 1fr 1fr;">
    <div class="card">
      <div class="kv">
        <div class="row"><div class="label">Name:</div><div class="value">{{customer.name}}</div></div>
        <div class="row"><div class="label">Address:</div><div class="value">{{customer.address}}</div></div>
        <div class="row"><div class="label"></div><div class="value">{{customer.address2}}</div></div>
        <div class="row"><div class="label">Phone:</div><div class="value">{{customer.phone}}</div></div>
        <div class="row"><div class="label">Email:</div><div class="value">{{customer.email}}</div></div>
      </div>
    </div>
    <div class="card">
      <div class="kv">
        <div class="row"><div class="label">Invoice No.:</div><div class="value">{{invoice.number}}</div></div>
        <div class="row"><div class="label">Invoice Date:</div><div class="value">{{formatDate invoice.date}}</div></div>
        <div class="row"><div class="label">Payment Term:</div><div class="value">{{invoice.payment_term}}</div></div>
      </div>
      <div style="text-align:right;margin-top:6px;">
        <img src="{{invoice.qr_code}}" alt="QR" style="width:90px;height:90px;border:1px solid var(--border);" />
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
<style> 
   :root { 
     --brand: #0E3646; 
     --brand-50: #f0f7fa; 
     --text: #1f2937; 
     --muted: #6b7280; 
     --border: #e5e7eb; 
     --border-dark: #9ca3af; 
   } 
   @page { size: A4; margin: 0; } 
   body { font-family: Verdana, sans-serif; color: var(--text); font-size: 14px; } 
   .doc { width: 21cm; height: 29.7cm; margin: 0 auto; padding: 16px; box-sizing: border-box; } 
   .header { display: grid; grid-template-columns: 200px auto 1fr; gap: 16px; margin-bottom: 12px; border-bottom: 3px solid var(--brand); padding-bottom: 12px; } 
   .logo { width: 168px; height: auto; } 
   .qr-section { text-align: center; display: flex; align-items: center; justify-content: center; } 
   .qr-code { width: 100px; height: 100px; border: 2px solid var(--brand); background: white; padding: 4px; } 
   .company { font-size: 16px; line-height: 1.4; text-align: right; } 
   .company .name { font-weight: 700; font-size: 22px; color: var(--brand); margin-bottom: 4px; } 
   .title-section { text-align: center; margin: 12px 0; } 
   .title-section h1 { font-size: 21px; font-weight: 700; color: var(--brand); margin: 0 0 4px 0; } 
   .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin: 12px 0; font-size: 12px; } 
   .info-grid .row { display: flex; margin-bottom: 4px; } 
   .info-grid .label { font-weight: 600; min-width: 120px; } 
   .info-grid .value { flex: 1; } 
   table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 12px 0; } 
   thead th { background: var(--brand); color: white; border: 1px solid var(--brand); padding: 6px 4px; text-align: center; font-weight: 600; font-size: 12px; } 
   tbody td { border: 1px solid var(--border-dark); padding: 4px; vertical-align: top; } 
   td.center { text-align: center; } 
   td.right { text-align: right; } 
   tbody tr { min-height: 30px; } 
   .summary { display: grid; grid-template-columns: 1fr 280px; gap: 16px; margin-top: 8px; font-size: 12px; } 
   .summary-box { padding: 8px; margin-bottom: 8px; } 
   .summary-row { display: flex; justify-content: space-between; margin: 3px 0; padding: 2px 0; } 
   .summary-row.total { font-weight: 700; border-top: 1px solid var(--border-dark); margin-top: 4px; padding-top: 4px; } 
   .footer { margin-top: 24px; font-size: 12px; border-top: 2px solid var(--brand); padding-top: 12px; } 
   .footer-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 12px; } 
   .footer-item .label { font-weight: 600; margin-bottom: 4px; color: var(--brand); } 
   .sign-line { border-bottom: 1px solid var(--border-dark); height: 40px; margin: 8px 0 4px 0; } 
   .footer-note { text-align: center; font-size: 14px; color: var(--muted); margin-top: 16px; padding-top: 8px; border-top: 1px solid var(--border); } 
</style> 
<div class="doc"> 
  <div class="header"> 
    <div><img class="logo" src="{{company.logo}}" alt="Logo" /></div> 
    <div class="qr-section"><div class="qr-code"><img src="{{delivery.qr_code}}" style="width:100%;height:100%" alt="QR Code" /></div></div> 
    <div class="company"> 
      <div class="name">{{company.name}}</div> 
      <div>{{company.address}}</div> 
      <div>{{company.address2}}</div> 
      <div>Tel: {{company.phone}}</div> 
      <div>Email: {{company.email}}</div> 
      <div>{{company.registration}}</div> 
    </div> 
  </div> 
  <div class="title-section"><h1>*** Delivery Note ***</h1></div> 
  <div class="info-grid"> 
    <div> 
      <div class="row"><div class="label">Deliver To:</div><div class="value">{{customer.name}}</div></div> 
      <div class="row"><div class="label">Address:</div><div class="value">{{customer.address}}</div></div> 
      <div class="row"><div class="label"></div><div class="value">{{customer.address2}}</div></div> 
      <div class="row"><div class="label">Contact Person:</div><div class="value">{{customer.contact_person}}</div></div> 
      <div class="row"><div class="label">Tel:</div><div class="value">{{customer.phone}}</div></div> 
    </div> 
    <div> 
      <div class="row"><div class="label">D/N No:</div><div class="value">{{delivery.number}}</div></div> 
      <div class="row"><div class="label">D/N Date:</div><div class="value">{{delivery.date}}</div></div> 
      <div class="row"><div class="label">Invoice Ref:</div><div class="value">{{delivery.invoice_ref}}</div></div> 
      <div class="row"><div class="label">Order No:</div><div class="value">{{delivery.order_number}}</div></div> 
      <div class="row"><div class="label">Vehicle No:</div><div class="value">{{delivery.vehicle_number}}</div></div> 
      <div class="row"><div class="label">Driver:</div><div class="value">{{delivery.driver_name}}</div></div> 
    </div> 
  </div> 
  <table> 
    <thead> 
      <tr> 
        <th style="width:30px">No.</th> 
        <th style="width:80px">Code</th> 
        <th>Description</th> 
        <th style="width:60px">Qty Ordered</th> 
        <th style="width:60px">Qty Delivered</th> 
        <th style="width:40px">UOM</th> 
        <th style="width:60px">Batch / Serial No.</th> 
        <th style="width:80px">Remarks</th> 
      </tr> 
    </thead> 
    <tbody> 
      {{#each delivery.items}} 
      <tr> 
        <td class="center">{{@index}}</td> 
        <td>{{code}}</td> 
        <td>{{description}}</td> 
        <td class="right">{{qty_ordered}}</td> 
        <td class="right">{{qty_delivered}}</td> 
        <td class="center">{{uom}}</td> 
        <td class="center">{{batch_serial}}</td> 
        <td>{{remarks}}</td> 
      </tr> 
      {{/each}} 
      <tr><td colspan="8" style="height:20px;border:none"></td></tr> 
      <tr><td colspan="8" style="height:20px;border:none"></td></tr> 
    </tbody> 
  </table> 
  <div class="summary"> 
    <div class="summary-left"> 
      <div class="summary-box"><div style="font-weight:600;margin-bottom:4px;color:var(--brand)">Delivery Instructions:</div><div>{{delivery.instructions}}</div></div> 
      <div class="summary-box"><div style="font-weight:600;margin-bottom:4px;color:var(--brand)">Terms and Conditions:</div><div>{{delivery.terms_and_conditions}}</div></div> 
    </div> 
    <div class="summary-right"> 
      <div class="summary-box"> 
        <div class="summary-row"><span>Total Items:</span><span>{{delivery.total_items}}</span></div> 
        <div class="summary-row"><span>Total Qty Ordered:</span><span>{{delivery.total_qty_ordered}}</span></div> 
        <div class="summary-row total" style="color:var(--brand)"><span>Total Qty Delivered:</span><span>{{delivery.total_qty_delivered}}</span></div> 
      </div> 
    </div> 
  </div> 
  <div class="footer"> 
    <div class="footer-grid"> 
      <div class="footer-item"><div class="label">Prepared By: {{system.created_by}}</div><div class="sign-line"></div><div style="text-align:center;color:var(--muted)">Signature / Date</div></div> 
      <div class="footer-item"><div class="label">Dispatched By:</div><div class="sign-line"></div><div style="text-align:center;color:var(--muted)">Signature / Date</div></div> 
      <div class="footer-item"><div class="label">Received By:</div><div class="sign-line"></div><div style="text-align:center;color:var(--muted)">Name / Signature / Date</div></div> 
    </div> 
    <div class="footer-note">This is a computer-generated delivery note. Powered by Stanness Technologies<br />{{company.footer_text}}</div> 
  </div> 
</div>`;
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
        o.price_type,
        o.payment_type,
        o.warehouse_id,
        o.expected_delivery_date,
        o.actual_delivery_date,
        o.payment_terms,
        o.priority,
        o.discount_amount,
        o.shipping_charges,
        o.internal_notes,
        o.customer_notes,
        COALESCE(c.customer_name, '') AS customer_name,
        COALESCE(c.address, '') AS customer_address,
        COALESCE(c.city, '') AS customer_city,
        COALESCE(c.state, '') AS customer_state,
        COALESCE(c.country, '') AS customer_country,
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
    const extra = await query(
      `
      SELECT 
        w.warehouse_name,
        cur.code AS currency_code
      FROM adm_companies ac
      LEFT JOIN inv_warehouses w
        ON w.id = :wid AND w.company_id = ac.id
      LEFT JOIN fin_currencies cur
        ON cur.id = :cid
      WHERE ac.id = :companyId
      LIMIT 1
      `,
      {
        companyId,
        wid: order.warehouse_id || null,
        cid: order.currency_id || null,
      },
    ).catch(() => []);
    const extraRow = extra?.[0] || {};
    const items = Array.isArray(details) ? details : [];
    const soObj = {
      company: company || {},
      customer: {
        name: order.customer_name,
        address: order.customer_address,
        address2: '',
        city: order.customer_city,
        state: order.customer_state,
        country: order.customer_country,
        phone: order.customer_phone,
        email: order.customer_email,
      },
      employee: employee || undefined,
      prepared_by: employee?.username || employee?.name || undefined,
      sales_order: {
        id: order.id,
        number: order.order_no,
        date: order.order_date ? String(order.order_date).slice(0, 10) : null,
        status: order.status,
        expected_delivery_date: order.expected_delivery_date,
        actual_delivery_date: order.actual_delivery_date,
        payment_terms: order.payment_terms,
        priority: order.priority,
        sub_total: order.sub_total,
        tax_amount: order.tax_amount,
        total: order.total_amount,
        net_amount: order.total_amount,
        remarks: order.remarks,
        price_type: order.price_type || null,
        payment_type: order.payment_type || null,
        warehouse_id: order.warehouse_id || null,
        warehouse_name: extraRow?.warehouse_name || null,
        currency_id: order.currency_id || null,
        currency_code: extraRow?.currency_code || null,
        exchange_rate: order.exchange_rate || null,
        discount_amount: order.discount_amount || 0,
        shipping_charges: order.shipping_charges || 0,
        internal_notes: order.internal_notes || null,
        customer_notes: order.customer_notes || null,
        items: items.map((d) => ({
          name: d.item_name,
          description: d.item_name,
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
    // Attach QR code (unique per document) using a lightweight external generator
    try {
      const qrPayload = encodeURIComponent(
        `SALES_ORDER|${order.id}|${order.order_no || ""}|${order.order_date || ""}|${order.customer_name || ""}`,
      );
      soObj.sales_order.qr_code = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${qrPayload}`;
    } catch {}
    // Aliases for template compatibility
    soObj.document = soObj.sales_order;
    soObj.order = soObj.sales_order;
    soObj.items = soObj.sales_order.items;
    return soObj;
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
        i.price_type,
        i.payment_type,
        i.currency_id,
        i.exchange_rate,
        i.warehouse_id,
        COALESCE(c.customer_name, '') AS customer_name,
        COALESCE(c.address, '') AS customer_address,
        COALESCE(c.city, '') AS customer_city,
        COALESCE(c.state, '') AS customer_state,
        COALESCE(c.country, '') AS customer_country,
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
        d.tax_amount,
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
    const extra = await query(
      `
      SELECT 
        w.warehouse_name,
        cur.code AS currency_code
      FROM adm_companies ac
      LEFT JOIN inv_warehouses w
        ON w.id = :wid AND w.company_id = ac.id
      LEFT JOIN fin_currencies cur
        ON cur.id = :cid
      WHERE ac.id = :companyId
      LIMIT 1
      `,
      {
        companyId,
        wid: inv.warehouse_id || null,
        cid: inv.currency_id || null,
      },
    ).catch(() => []);
    const extraRow = extra?.[0] || {};
    const items = Array.isArray(details) ? details : [];
    const invObj = {
      company: company || {},
      customer: {
        name: inv.customer_name,
        address: inv.customer_address,
        address2: '',
        city: inv.customer_city,
        state: inv.customer_state,
        country: inv.customer_country,
        phone: inv.customer_phone,
        email: inv.customer_email,
      },
      employee: employee || undefined,
      prepared_by: employee?.username || employee?.name || undefined,
      invoice: {
        id: inv.id,
        number: inv.invoice_no,
        date: inv.invoice_date ? String(inv.invoice_date).slice(0, 10) : null,
        payment_term: inv.payment_type || null,
        status: inv.status,
        payment_status: inv.payment_status,
        price_type: inv.price_type || null,
        payment_type: inv.payment_type || null,
        currency_id: inv.currency_id || null,
        currency_code: extraRow?.currency_code || null,
        exchange_rate: inv.exchange_rate || null,
        warehouse_id: inv.warehouse_id || null,
        warehouse_name: extraRow?.warehouse_name || null,
        net_total: inv.net_amount,
        total: inv.total_amount,
        remarks: inv.remarks,
        items: items.map((d) => ({
          name: d.item_name,
          description: d.item_name,
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
    // Attach QR code (unique per document) using a lightweight external generator
    try {
      const qrPayload = encodeURIComponent(
        `INVOICE|${inv.id}|${inv.invoice_no || ""}|${inv.invoice_date || ""}|${inv.customer_name || ""}`,
      );
      invObj.invoice.qr_code = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${qrPayload}`;
    } catch {}
    invObj.document = invObj.invoice;
    invObj.items = invObj.invoice.items;
    return invObj;
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
        d.sales_order_id,
        d.invoice_id,
        COALESCE(c.customer_name, '') AS customer_name,
        COALESCE(c.address, '') AS customer_address,
        COALESCE(c.city, '') AS customer_city,
        COALESCE(c.state, '') AS customer_state,
        COALESCE(c.country, '') AS customer_country,
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
    // Derive currency/warehouse from linked invoice or order if available
    const dnExtra = await query(
      `
      SELECT 
        COALESCE(i.currency_id, o.currency_id) AS currency_id,
        COALESCE(i.exchange_rate, o.exchange_rate) AS exchange_rate,
        COALESCE(i.price_type, o.price_type) AS price_type,
        COALESCE(i.payment_type, o.payment_type) AS payment_type,
        COALESCE(i.warehouse_id, o.warehouse_id) AS warehouse_id
      FROM sal_deliveries d
      LEFT JOIN sal_invoices i ON i.id = d.invoice_id AND i.company_id = d.company_id
      LEFT JOIN sal_orders o ON o.id = d.sales_order_id AND o.company_id = d.company_id
      WHERE d.id = :id
      LIMIT 1
      `,
      { id },
    ).catch(() => []);
    const ex = dnExtra?.[0] || {};
    const extra = await query(
      `
      SELECT 
        w.warehouse_name,
        cur.code AS currency_code
      FROM adm_companies ac
      LEFT JOIN inv_warehouses w
        ON w.id = :wid AND w.company_id = ac.id
      LEFT JOIN fin_currencies cur
        ON cur.id = :cid
      WHERE ac.id = :companyId
      LIMIT 1
      `,
      {
        companyId,
        wid: ex?.warehouse_id || null,
        cid: ex?.currency_id || null,
      },
    ).catch(() => []);
    const extraRow = extra?.[0] || {};
    const items = Array.isArray(details) ? details : [];
    // Load related order/invoice references for template fields
    let orderMeta = {};
    if (dn.sales_order_id) {
      const [ord] = await query(
        `
        SELECT order_no, vehicle_number, driver_name, delivery_instructions
        FROM sal_orders
        WHERE id = :oid AND company_id = :companyId
        LIMIT 1
        `,
        { oid: dn.sales_order_id, companyId },
      ).catch(() => []);
      if (ord) orderMeta = ord;
    }
    let invoiceMeta = {};
    if (dn.invoice_id) {
      const [invh] = await query(
        `
        SELECT invoice_no
        FROM sal_invoices
        WHERE id = :iid AND company_id = :companyId
        LIMIT 1
        `,
        { iid: dn.invoice_id, companyId },
      ).catch(() => []);
      if (invh) invoiceMeta = invh;
    }
    // Build ordered qty map if linked to an order
    let orderedQtyMap = new Map();
    if (dn.sales_order_id) {
      const ordRows = await query(
        `
        SELECT item_id, qty
        FROM sal_order_details
        WHERE order_id = :oid
        `,
        { oid: dn.sales_order_id },
      ).catch(() => []);
      (ordRows || []).forEach((r) => {
        const idNum = Number(r.item_id);
        const qtyNum = Number(r.qty || 0);
        if (Number.isFinite(idNum)) orderedQtyMap.set(idNum, qtyNum);
      });
    }
    const totalQtyDelivered = items.reduce(
      (acc, d) => acc + Number(d.quantity || 0),
      0,
    );
    const totalQtyOrdered = items.reduce(
      (acc, d) => acc + Number(orderedQtyMap.get(Number(d.item_id)) || 0),
      0,
    );
    const dnObj = {
      company: company || {},
      customer: {
        name: dn.customer_name,
        address: dn.customer_address,
        city: dn.customer_city,
        state: dn.customer_state,
        country: dn.customer_country,
        phone: dn.customer_phone,
        email: dn.customer_email,
      },
      employee: employee || undefined,
      prepared_by: employee?.username || employee?.name || undefined,
      system: { created_by: employee?.username || employee?.name || "" },
      delivery_note: {
        id: dn.id,
        number: dn.delivery_no,
        date: dn.delivery_date,
        status: dn.status,
        remarks: dn.remarks,
        qr_code: "",
        order_number: orderMeta?.order_no || null,
        vehicle_number: orderMeta?.vehicle_number || null,
        driver_name: orderMeta?.driver_name || null,
        invoice_ref: invoiceMeta?.invoice_no || null,
        instructions: orderMeta?.delivery_instructions || null,
        terms_and_conditions: null,
        total_items: items.length,
        total_qty_ordered: totalQtyOrdered,
        total_qty_delivered: totalQtyDelivered,
        price_type: ex?.price_type || null,
        payment_type: ex?.payment_type || null,
        currency_id: ex?.currency_id || null,
        currency_code: extraRow?.currency_code || null,
        exchange_rate: ex?.exchange_rate || null,
        warehouse_id: ex?.warehouse_id || null,
        warehouse_name: extraRow?.warehouse_name || null,
        items: items.map((d) => ({
          name: d.item_name,
          description: d.item_name,
          code: d.item_code,
          quantity: d.quantity,
          qty_delivered: d.quantity,
          qty_ordered:
            orderedQtyMap.get(Number(d.item_id)) ??
            (dn.sales_order_id ? null : d.quantity),
          price: d.unit_price,
          uom: d.uom,
          batch_serial: "",
          remarks: "",
        })),
      },
    };
    // Attach QR code (unique per document) using a lightweight external generator
    try {
      const qrPayload = encodeURIComponent(
        `DELIVERY_NOTE|${dn.id}|${dn.delivery_no || ""}|${dn.delivery_date || ""}|${dn.customer_name || ""}`,
      );
      dnObj.delivery_note.qr_code = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${qrPayload}`;
    } catch {}
    dnObj.document = dnObj.delivery_note;
    dnObj.delivery = dnObj.delivery_note;
    dnObj.items = dnObj.delivery_note.items;
    return dnObj;
  }
  if (type === "quotation") {
    const [q] = await query(
      `
      SELECT
        q.id,
        q.quotation_no,
        q.quotation_date,
        q.customer_id,
        q.created_by,
        q.price_type,
        q.payment_type,
        q.currency_id,
        q.exchange_rate,
        q.warehouse_id,
        q.status,
        q.total_amount,
        q.net_amount,
        q.remarks,
        COALESCE(NULLIF(q.customer_name, ''), c.customer_name, '') AS customer_name,
        COALESCE(c.address, '') AS customer_address,
        COALESCE(c.city, '') AS customer_city,
        COALESCE(c.state, '') AS customer_state,
        COALESCE(c.country, '') AS customer_country,
        COALESCE(c.phone, '') AS customer_phone,
        COALESCE(c.email, '') AS customer_email
      FROM sal_quotations q
      LEFT JOIN sal_customers c
        ON c.id = q.customer_id AND c.company_id = q.company_id
      WHERE q.id = :id AND q.company_id = :companyId AND q.branch_id = :branchId
      LIMIT 1
      `,
      { id, companyId, branchId },
    ).catch(() => []);
    if (!q) throw httpError(404, "NOT_FOUND", "Document not found");
    let employee = null;
    if (q.created_by) {
      const [u] = await query(
        `
        SELECT id, username, email, full_name
        FROM adm_users
        WHERE id = :uid
        LIMIT 1
        `,
        { uid: q.created_by },
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
        d.net_amount,
        d.tax_amount,
        d.uom,
        it.item_code,
        it.item_name
      FROM sal_quotation_details d
      LEFT JOIN inv_items it
        ON it.id = d.item_id AND it.company_id = :companyId
      WHERE d.quotation_id = :id
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
    const extra = await query(
      `
      SELECT 
        w.warehouse_name,
        cur.code AS currency_code
      FROM adm_companies ac
      LEFT JOIN inv_warehouses w
        ON w.id = :wid AND w.company_id = ac.id
      LEFT JOIN fin_currencies cur
        ON cur.id = :cid
      WHERE ac.id = :companyId
      LIMIT 1
      `,
      {
        companyId,
        wid: q.warehouse_id || null,
        cid: q.currency_id || null,
      },
    ).catch(() => []);
    const extraRow = extra?.[0] || {};
    const items = Array.isArray(details) ? details : [];
    const qObj = {
      company: company || {},
      customer: {
        name: q.customer_name,
        address: q.customer_address,
        city: q.customer_city,
        state: q.customer_state,
        country: q.customer_country,
        phone: q.customer_phone,
        email: q.customer_email,
      },
      employee: employee || undefined,
      prepared_by: employee?.username || employee?.name || undefined,
      quotation: {
        id: q.id,
        number: q.quotation_no,
        date: q.quotation_date,
        status: q.status,
        price_type: q.price_type || null,
        payment_type: q.payment_type || null,
        currency_id: q.currency_id || null,
        currency_code: extraRow?.currency_code || null,
        exchange_rate: q.exchange_rate || null,
        warehouse_id: q.warehouse_id || null,
        warehouse_name: extraRow?.warehouse_name || null,
        sub_total: q.net_amount,
        tax_amount: items.reduce(
          (acc, d) => acc + Number(d.tax_amount || 0),
          0,
        ),
        total: q.total_amount,
        remarks: q.remarks,
        items: items.map((d) => ({
          name: d.item_name,
          description: d.item_name,
          code: d.item_code,
          quantity: d.quantity,
          price: d.unit_price,
          discount: d.discount_percent,
          amount: Number(d.net_amount || 0) + Number(d.tax_amount || 0),
          net: d.net_amount,
          tax: d.tax_amount,
          uom: d.uom,
        })),
      },
    };
    qObj.document = qObj.quotation;
    qObj.quote = qObj.quotation;
    qObj.items = qObj.quotation.items;
    return qObj;
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
      // Optional override: explicit template_id
      const templateId =
        req.query && req.query.template_id
          ? Number(req.query.template_id)
          : req.body && req.body.template_id
            ? Number(req.body.template_id)
            : null;
      let tplObj = null;
      if (templateId && Number.isFinite(templateId)) {
        const [row] = await query(
          `
          SELECT id, html_content,
                 header_logo_url, header_name, header_address, header_address2, header_phone, header_email, header_website,
                 document_type
          FROM document_templates
          WHERE id = :id AND company_id = :companyId
          LIMIT 1
          `,
          { id: templateId, companyId },
        ).catch(() => []);
        // Only accept if the template type matches aliases for safety
        if (row) {
          const aliases = expandDocumentTypeAliases(type);
          if (
            aliases
              .map((v) => String(v).toLowerCase())
              .includes(String(row.document_type || "").toLowerCase())
          ) {
            tplObj = row;
          }
        }
      }
      // Resolve template with alias support when override not provided/invalid
      const aliasesLower = tplObj ? [] : docTypeSynonymsLower(type);
      // Try default template first
      if (!tplObj) {
        const placeholders = aliasesLower.map((_, i) => `:dt${i}`).join(", ");
        const params = { companyId };
        aliasesLower.forEach((val, i) => (params[`dt${i}`] = val));
        const items = await query(
          `
          SELECT id, html_content,
                 header_logo_url, header_name, header_address, header_address2, header_phone, header_email, header_website
          FROM document_templates 
          WHERE company_id = :companyId AND LOWER(document_type) IN (${placeholders}) AND is_default = 1
          LIMIT 1
          `,
          params,
        ).catch(() => []);
        if (Array.isArray(items) && items.length) tplObj = items[0];
      }
      // Strict requirement: must have default template configured (unless explicit override used)
      if (!tplObj) {
        // Auto-seed a default from the built-in sample into Administration templates
        const canonical = canonicalDocumentType(type);
        const name =
          canonical === "sales-order"
            ? "Default Sales Order Template"
            : canonical === "invoice"
              ? "Default Invoice Template"
              : canonical === "delivery-note"
                ? "Default Delivery Note Template"
                : "Default Template";
        const html = getDefaultSampleTemplate(canonical);
        try {
          const ins = await query(
            `
            INSERT INTO document_templates 
              (company_id, name, document_type, html_content, is_default, created_by,
               header_logo_url, header_name, header_address, header_address2, header_phone, header_email, header_website)
            VALUES
              (:companyId, :name, :dt, :html, 1, :createdBy, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
            `,
            {
              companyId,
              name,
              dt: canonical,
              html,
              createdBy: req.user?.id || null,
            },
          ).catch(() => null);
          if (ins && ins.insertId) {
            // Ensure uniqueness of default flag
            await query(
              `
              UPDATE document_templates 
                 SET is_default = 0 
               WHERE company_id = :companyId AND document_type = :dt AND id <> :id
              `,
              { companyId, dt: canonical, id: ins.insertId },
            ).catch(() => null);
            const [row] = await query(
              `
              SELECT id, html_content,
                     header_logo_url, header_name, header_address, header_address2, header_phone, header_email, header_website
              FROM document_templates
              WHERE id = :id AND company_id = :companyId
              LIMIT 1
              `,
              { id: ins.insertId, companyId },
            ).catch(() => []);
            if (row) tplObj = row;
          }
        } catch {}
        if (!tplObj) {
          throw httpError(404, "NOT_FOUND", "Default template not found");
        }
      }
      const data = await loadData(type, id, companyId, branchId);
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
      let html = "";
      try {
        const tmpl = Handlebars.compile(String(tplObj.html_content || ""));
        html = tmpl(data);
      } catch (e) {
        try {
          const fallback = getDefaultSampleTemplate(type);
          const tmpl2 = Handlebars.compile(String(fallback || ""));
          html = tmpl2(data);
        } catch {
          html = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif}</style></head><body>
          <h3>${String(type).toUpperCase()} Document</h3>
          <pre>${JSON.stringify(data, null, 2)}</pre>
          </body></html>`;
        }
      }
      // Post-process to remove any "Tax ID" blocks or labels from arbitrary templates
      try {
        // Remove div.row blocks that contain "Tax ID"
        html = html.replace(
          /<div[^>]*class=["'][^"']*row[^"']*["'][^>]*>[\s\S]*?Tax\s*ID[\s\S]*?<\/div>/gi,
          "",
        );
        // Remove table rows that contain "Tax ID"
        html = html.replace(/<tr[^>]*>[\s\S]*?Tax\s*ID[\s\S]*?<\/tr>/gi, "");
        // Remove standalone "Tax ID:" labels
        html = html.replace(/Tax\s*ID\s*:?\s*/gi, "");
      } catch {}
      // Ensure background colors render in browser print and PDF
      const printStyle = `<style>
          @media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          * { print-color-adjust: exact; }
          .doc { height: auto !important; min-height: auto !important; }
          .titlebar, .title-section, .info, .info-grid { margin-top: 6px !important; margin-bottom: 6px !important; }
          table { margin-top: 6px !important; }
        </style>`;
      html = printStyle + html;
      const format = String(
        req.query.format || req.body?.format || "html",
      ).toLowerCase();
      if (format === "pdf") {
        try {
          const cleaned = sanitizeHtml(html, {
            allowedTags: (sanitizeHtml.defaults?.allowedTags || []).concat([
              "style",
            ]),
            allowedAttributes: {
              "*": ["class", "style"],
              img: ["src", "alt", "class", "style"],
              a: ["href", "class", "style"],
            },
            allowVulnerableTags: true,
          });
          const head = `<meta charset="utf-8"><style>
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            img { max-width: 100%; height: auto; }
          </style>`;
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
      try {
        const type = String(req.params.type || "").trim();
        const { companyId } = req.scope || {};
        const fallback = getDefaultSampleTemplate(type);
        const data = { company: { name: "", address: "", address2: "", phone: "", email: "", logo: `/api/admin/companies/${companyId}/logo` } };
        const html = Handlebars.compile(String(fallback || ""))(data);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.status(200).send(html);
      } catch {
        res.status(200).send("<html><body><h3>Document</h3><p>Unable to render template; minimal fallback shown.</p></body></html>");
      }
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
      // Resolve template with alias support for preview
      const aliasesLower = docTypeSynonymsLower(type);
      let tplObj = null;
      {
        const placeholders = aliasesLower.map((_, i) => `:dt${i}`).join(", ");
        const params = { companyId };
        aliasesLower.forEach((val, i) => (params[`dt${i}`] = val));
        const items = await query(
          `
          SELECT id, html_content,
                 header_logo_url, header_name, header_address, header_address2, header_phone, header_email, header_website
          FROM document_templates 
          WHERE company_id = :companyId AND LOWER(document_type) IN (${placeholders}) AND is_default = 1
          LIMIT 1
          `,
          params,
        ).catch(() => []);
        if (Array.isArray(items) && items.length) tplObj = items[0];
      }
      if (!tplObj) {
        const placeholders = aliasesLower.map((_, i) => `:dt${i}`).join(", ");
        const params = { companyId };
        aliasesLower.forEach((val, i) => (params[`dt${i}`] = val));
        const items = await query(
          `
          SELECT id, html_content,
                 header_logo_url, header_name, header_address, header_address2, header_phone, header_email, header_website
          FROM document_templates 
          WHERE company_id = :companyId AND LOWER(document_type) IN (${placeholders})
          ORDER BY is_default DESC, updated_at DESC
          LIMIT 1
          `,
          params,
        ).catch(() => []);
        if (Array.isArray(items) && items.length) tplObj = items[0];
      }
      if (!tplObj) {
        tplObj = {
          id: 0,
          html_content: getDefaultSampleTemplate(type),
          header_logo_url: null,
          header_name: null,
          header_address: null,
          header_address2: null,
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
      let html = "";
      try {
        const tmpl = Handlebars.compile(String(tplObj.html_content || ""));
        html = tmpl(data);
      } catch (e) {
        try {
          const fallback = getDefaultSampleTemplate(type);
          const tmpl2 = Handlebars.compile(String(fallback || ""));
          html = tmpl2(data);
        } catch {
          html = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif}</style></head><body>
          <h3>${String(type).toUpperCase()} Document Preview</h3>
          <pre>${JSON.stringify(data, null, 2)}</pre>
          </body></html>`;
        }
      }
      try {
        html = html.replace(
          /<div[^>]*class=["'][^"']*row[^"']*["'][^>]*>[\s\S]*?Tax\s*ID[\s\S]*?<\/div>/gi,
          "",
        );
        html = html.replace(/<tr[^>]*>[\s\S]*?Tax\s*ID[\s\S]*?<\/tr>/gi, "");
        html = html.replace(/Tax\s*ID\s*:?\s*/gi, "");
      } catch {}
      function esc(v) {
        return String(v ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
      }
      if (type === "sales-order" || type === "invoice") {
        const cust = data?.customer || null;
        const keyName = type === "sales-order" ? "sales_order" : "invoice";
        const qr = data?.[keyName]?.qr_code || "";
        const probe = String(cust?.name || "").trim();
        if (cust && (!probe || !html.includes(probe)) && !html.includes('data-auto="customer-info"')) {
          const block =
            `<div data-auto="customer-info" style="margin:8px 0;font-size:12px">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div>
                  <div><strong>Name:</strong> ${esc(cust.name || "")}</div>
                  <div><strong>Address:</strong> ${esc(cust.address || "")} ${esc(cust.address2 || "")}</div>
                  <div><strong>Phone:</strong> ${esc(cust.phone || "")}</div>
                  <div><strong>Email:</strong> ${esc(cust.email || "")}</div>
                </div>
                <div style="text-align:right">${qr ? `<img src="${esc(qr)}" style="width:90px;height:90px;border:1px solid #e5e7eb" />` : ""}</div>
              </div>
            </div>`;
          const tag = '<div class="doc"';
          const p = html.indexOf(tag);
          if (p !== -1) {
            const gt = html.indexOf(">", p);
            if (gt !== -1) {
              html = html.slice(0, gt + 1) + block + html.slice(gt + 1);
            } else {
              html = block + html;
            }
          } else {
            html = block + html;
          }
        }
      }
      const printStyle = `<style>
          @media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          * { print-color-adjust: exact; }
          .doc { height: auto !important; min-height: auto !important; }
          .titlebar, .title-section, .info, .info-grid { margin-top: 6px !important; margin-bottom: 6px !important; }
          table { margin-top: 6px !important; }
        </style>`;
      html = printStyle + html;
      const format = String(
        req.query.format || req.body?.format || "html",
      ).toLowerCase();
      if (format === "pdf") {
        try {
          const cleaned = sanitizeHtml(html, {
            allowedTags: (sanitizeHtml.defaults?.allowedTags || []).concat([
              "style",
            ]),
            allowedAttributes: {
              "*": ["class", "style"],
              img: ["src", "alt", "class", "style"],
              a: ["href", "class", "style"],
            },
            allowVulnerableTags: true,
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
      try {
        const type = String(req.params.type || "").trim();
        const { companyId } = req.scope || {};
        const fallback = getDefaultSampleTemplate(type);
        const data = { company: { name: "", address: "", address2: "", phone: "", email: "", logo: `/api/admin/companies/${companyId}/logo` } };
        const html = Handlebars.compile(String(fallback || ""))(data);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.status(200).send(html);
      } catch {
        res.status(200).send("<html><body><h3>Document Preview</h3><p>Unable to render template; minimal fallback shown.</p></body></html>");
      }
    }
  },
);

async function ensureDocumentAttachmentsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS adm_document_attachments (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      document_type VARCHAR(50) NOT NULL,
      document_id BIGINT UNSIGNED NOT NULL,
      file_url VARCHAR(500) NOT NULL,
      file_name VARCHAR(255) NULL,
      uploaded_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_doc (company_id, branch_id, document_type, document_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  // Backward-compatible metadata columns
  if (!(await hasColumn("adm_document_attachments", "title"))) {
    await query(
      `ALTER TABLE adm_document_attachments ADD COLUMN title VARCHAR(255) NULL AFTER file_name`,
    );
  }
  if (!(await hasColumn("adm_document_attachments", "description"))) {
    await query(
      `ALTER TABLE adm_document_attachments ADD COLUMN description TEXT NULL AFTER title`,
    );
  }
  if (!(await hasColumn("adm_document_attachments", "category"))) {
    await query(
      `ALTER TABLE adm_document_attachments ADD COLUMN category VARCHAR(100) NULL AFTER description`,
    );
  }
  if (!(await hasColumn("adm_document_attachments", "tags"))) {
    await query(
      `ALTER TABLE adm_document_attachments ADD COLUMN tags TEXT NULL AFTER category`,
    );
  }
  if (!(await hasColumn("adm_document_attachments", "mime_type"))) {
    await query(
      `ALTER TABLE adm_document_attachments ADD COLUMN mime_type VARCHAR(100) NULL AFTER tags`,
    );
  }
  if (!(await hasColumn("adm_document_attachments", "file_size"))) {
    await query(
      `ALTER TABLE adm_document_attachments ADD COLUMN file_size BIGINT NULL AFTER mime_type`,
    );
  }
}

router.get(
  "/:type/:id/attachments",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureDocumentAttachmentsTable();
      const { companyId, branchId } = req.scope;
      const type = String(req.params.type || "").trim();
      const id = toNumber(req.params.id);
      if (!type || !id)
        throw httpError(400, "VALIDATION_ERROR", "Invalid request");
      const rawItems = await query(
        `
        SELECT id, file_url, file_name, uploaded_by, created_at
               , title, description, category, tags, mime_type, file_size
        FROM adm_document_attachments
        WHERE company_id = :companyId
          AND branch_id = :branchId
          AND document_type = :type
          AND document_id = :id
        ORDER BY id DESC
        `,
        { companyId, branchId, type, id },
      ).catch(() => []);
      const origin = `${req.protocol}://${req.get("host")}`;
      const items = Array.isArray(rawItems)
        ? rawItems.map((r) => {
            try {
              const s = String(r.file_url || "");
              if (/^https?:\/\//i.test(s)) {
                return r;
              }
              if (s.startsWith("/uploads")) {
                return { ...r, file_url: `${origin}${s}` };
              }
              if (s.startsWith("uploads")) {
                return { ...r, file_url: `${origin}/${s}` };
              }
              // Legacy rows may contain only the bare filename like "file-123.png"
              if (s && !s.includes("/") && !s.includes("\\")) {
                return { ...r, file_url: `${origin}/uploads/${s}` };
              }
              return { ...r, file_url: s };
            } catch {
              return r;
            }
          })
        : [];
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/:type/:id/attachments",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureDocumentAttachmentsTable();
      const { companyId, branchId } = req.scope;
      const type = String(req.params.type || "").trim();
      const id = toNumber(req.params.id);
      if (!type || !id)
        throw httpError(400, "VALIDATION_ERROR", "Invalid request");
      const body = req.body || {};
      const fileUrl = String(body.url || body.file_url || "").trim();
      const fileName = body.name || body.file_name || null;
      const title = body.title ? String(body.title).trim() : null;
      const description = body.description
        ? String(body.description).trim()
        : null;
      const category = body.category ? String(body.category).trim() : null;
      const tags = body.tags ? String(body.tags).trim() : null;
      const mimeType = body.mime_type ? String(body.mime_type).trim() : null;
      const fileSize = body.file_size != null ? Number(body.file_size) : null;
      const uploadedBy = req.user?.sub ? Number(req.user.sub) : null;
      if (!fileUrl) throw httpError(400, "VALIDATION_ERROR", "url required");
      const result = await query(
        `
        INSERT INTO adm_document_attachments
          (company_id, branch_id, document_type, document_id, file_url, file_name, uploaded_by, title, description, category, tags, mime_type, file_size)
        VALUES
          (:companyId, :branchId, :type, :id, :fileUrl, :fileName, :uploadedBy, :title, :description, :category, :tags, :mimeType, :fileSize)
        `,
        {
          companyId,
          branchId,
          type,
          id,
          fileUrl,
          fileName,
          uploadedBy,
          title,
          description,
          category,
          tags,
          mimeType,
          fileSize,
        },
      ).catch(() => null);
      res.status(201).json({
        id: result?.insertId || null,
        file_url: fileUrl,
        file_name: fileName,
        title,
        description,
        category,
        tags,
        mime_type: mimeType,
        file_size: fileSize,
      });
    } catch (err) {
      next(err);
    }
  },
);

import crypto from "crypto";

router.delete(
  "/:type/:id/attachments/:attId",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureDocumentAttachmentsTable();
      const { companyId, branchId } = req.scope;
      const type = String(req.params.type || "").trim();
      const id = toNumber(req.params.id);
      const attId = toNumber(req.params.attId);
      if (!type || !id || !attId)
        throw httpError(400, "VALIDATION_ERROR", "Invalid request");
      const rows = await query(
        `
        SELECT file_url FROM adm_document_attachments
        WHERE id = :attId
          AND company_id = :companyId
          AND branch_id = :branchId
          AND document_type = :type
          AND document_id = :id
        LIMIT 1
        `,
        { attId, companyId, branchId, type, id },
      );
      const fileUrl = rows?.[0]?.file_url || null;
      await query(
        `
        DELETE FROM adm_document_attachments
        WHERE id = :attId
          AND company_id = :companyId
          AND branch_id = :branchId
          AND document_type = :type
          AND document_id = :id
        `,
        { attId, companyId, branchId, type, id },
      ).catch(() => null);

      // Attempt Cloudinary deletion if URL is a Cloudinary asset
      try {
        if (
          fileUrl &&
          /^https?:\/\/res\.cloudinary\.com\//i.test(String(fileUrl))
        ) {
          async function getSetting(key) {
            const r = await query(
              `
              SELECT setting_value FROM adm_system_settings
              WHERE setting_key = :key
                AND (company_id = :companyId OR company_id IS NULL)
                AND (branch_id = :branchId OR branch_id IS NULL)
              ORDER BY company_id DESC, branch_id DESC
              LIMIT 1
              `,
              { key, companyId: companyId ?? null, branchId: branchId ?? null },
            ).catch(() => []);
            return r?.[0]?.setting_value || null;
          }
          const cloud_name = await getSetting("CLOUDINARY_CLOUD_NAME");
          const api_key = await getSetting("CLOUDINARY_API_KEY");
          const api_secret = await getSetting("CLOUDINARY_API_SECRET");
          if (cloud_name && api_key && api_secret) {
            const url = new URL(fileUrl);
            const parts = url.pathname.split("/").filter(Boolean);
            const idxUpload = parts.findIndex((p) => p === "upload");
            const resourceType =
              parts.find((p) => p === "image" || p === "video") || "image";
            let remainder = parts.slice(idxUpload + 1);
            if (remainder[0] && /^v\d+$/i.test(remainder[0])) {
              remainder = remainder.slice(1);
            }
            const last = remainder[remainder.length - 1] || "";
            const withoutExt = last.includes(".")
              ? last.slice(0, last.lastIndexOf("."))
              : last;
            const public_id =
              remainder.length > 1
                ? remainder.slice(0, -1).concat(withoutExt).join("/")
                : withoutExt;
            if (public_id) {
              const timestamp = Math.floor(Date.now() / 1000);
              const signatureBase = `public_id=${public_id}&timestamp=${timestamp}`;
              const signature = crypto
                .createHash("sha1")
                .update(signatureBase + api_secret)
                .digest("hex");
              const destroyEndpoint = `https://api.cloudinary.com/v1_1/${cloud_name}/${resourceType}/destroy`;
              const body = new URLSearchParams();
              body.append("public_id", public_id);
              body.append("api_key", api_key);
              body.append("timestamp", String(timestamp));
              body.append("signature", signature);
              await fetch(destroyEndpoint, {
                method: "POST",
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: body.toString(),
              }).catch(() => null);
            }
          }
        }
      } catch {}

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
