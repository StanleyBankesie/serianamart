import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";
import { toast } from "react-toastify";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const POS_RECEIPT_SETTINGS_KEY = "pos_receipt_settings";

function escapeHtml(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resolvePath(obj, rawPath) {
  const path = String(rawPath || "")
    .trim()
    .replace(/^\./, "");
  if (!path) return undefined;
  const parts = path.split(".").filter(Boolean);
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function renderTemplateString(templateHtml, data, root = data) {
  let out = String(templateHtml ?? "");

  out = out.replace(
    /{{#each\s+([^}]+)}}([\s\S]*?){{\/each}}/g,
    (_m, expr, inner) => {
      const key = String(expr || "").trim();
      const val = key.startsWith("@root.")
        ? resolvePath(root, key.slice(6))
        : (resolvePath(data, key) ?? resolvePath(root, key));
      const arr = Array.isArray(val) ? val : [];
      return arr
        .map((item) => renderTemplateString(inner, item ?? {}, root))
        .join("");
    },
  );

  out = out.replace(/{{{\s*([^}]+?)\s*}}}/g, (_m, expr) => {
    const key = String(expr || "").trim();
    let val;
    if (key === "this" || key === ".") val = data;
    else if (key.startsWith("@root.")) val = resolvePath(root, key.slice(6));
    else val = resolvePath(data, key) ?? resolvePath(root, key);
    return String(val ?? "");
  });

  out = out.replace(/{{\s*([^}]+?)\s*}}/g, (_m, expr) => {
    const key = String(expr || "").trim();
    let val;
    if (key === "this" || key === ".") val = data;
    else if (key.startsWith("@root.")) val = resolvePath(root, key.slice(6));
    else val = resolvePath(data, key) ?? resolvePath(root, key);
    return escapeHtml(val);
  });

  return out;
}

function wrapDoc(bodyHtml) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Document Template Preview</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; padding: 16px; color: #0f172a; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #e2e8f0; padding: 6px 8px; vertical-align: top; }
      th { background: #f8fafc; text-align: left; }
    </style>
  </head>
  <body>${bodyHtml || ""}</body>
</html>`;
}

async function waitForImages(rootEl) {
  const imgs = Array.from(rootEl.querySelectorAll("img"));
  if (!imgs.length) return;
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) return resolve();
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        }),
    ),
  );
}

const DOC_TYPES = [
  { value: "RECEIPT", label: "Receipt" },
  { value: "RECEIPT_VOUCHER", label: "Receipt Voucher" },
  { value: "PAYMENT_VOUCHER", label: "Payment Voucher" },
  { value: "INVOICE", label: "Invoice" },
  { value: "PAYSLIP", label: "Payslip" },
  { value: "DELIVERY_NOTE", label: "Delivery Note" },
  { value: "SALES_ORDER", label: "Sales Order" },
];

const DEFAULT_TEMPLATES = {
  RECEIPT: `<div style="text-align:center;">
  <div>{{{company.logoHtml}}}</div>
  <div style="font-weight:700;font-size:18px;">{{company.name}}</div>
  <div style="font-size:12px;color:#475569;">{{company.addressLine1}}</div>
  <div style="font-size:12px;color:#475569;">{{company.addressLine2}}</div>
  <div style="font-size:12px;color:#475569;">Mobile: {{company.phone}}</div>
  <div style="font-size:12px;color:#475569;">{{company.website}}</div>
  <div style="font-size:12px;color:#475569;">TIN: {{company.taxId}} &nbsp; Reg: {{company.registrationNo}}</div>
  <div style="margin-top:10px;font-size:12px;color:#475569;">{{receipt.headerText}}</div>
</div>
<hr />
<div style="display:flex;justify-content:space-between;font-size:13px;"><span>Receipt No:</span><span>{{receipt.receiptNo}}</span></div>
<div style="display:flex;justify-content:space-between;font-size:13px;"><span>Date:</span><span>{{receipt.dateTime}}</span></div>
<div style="display:flex;justify-content:space-between;font-size:13px;"><span>Payment:</span><span>{{receipt.paymentMethod}}</span></div>
<div style="margin-top:10px;">
  <table style="font-size:12px;">
    <thead>
      <tr><th>Item</th><th style="text-align:right;">Qty</th><th style="text-align:right;">Price</th><th style="text-align:right;">Disc</th><th style="text-align:right;">Total</th></tr>
    </thead>
    <tbody>
      {{#each items}}
        <tr>
          <td>{{name}}</td>
          <td style="text-align:right;">{{qty}}</td>
          <td style="text-align:right;">{{price}}</td>
          <td style="text-align:right;">{{discount}}</td>
          <td style="text-align:right;">{{lineTotal}}</td>
        </tr>
      {{/each}}
    </tbody>
  </table>
</div>
<div style="margin-top:10px;border-top:1px solid #0f172a;padding-top:6px;">
  <div style="display:flex;justify-content:space-between;font-size:13px;"><span>Subtotal</span><span>{{totals.subtotal}}</span></div>
  <div style="display:flex;justify-content:space-between;font-size:13px;"><span>Tax</span><span>{{totals.tax}}</span></div>
  <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;"><span>Grand Total</span><span>{{totals.total}}</span></div>
</div>
<div style="margin-top:10px;text-align:center;font-size:11px;color:#475569;">{{receipt.footerText}}</div>`,
  INVOICE: `<div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;">
  <div>
    <div>{{{company.logoHtml}}}</div>
    <div style="font-weight:700;font-size:18px;">{{company.name}}</div>
    <div style="font-size:12px;color:#475569;">{{company.address}}</div>
    <div style="font-size:12px;color:#475569;">{{company.city}} {{company.state}} {{company.country}}</div>
    <div style="font-size:12px;color:#475569;">{{company.phone}} {{company.email}}</div>
    <div style="font-size:12px;color:#475569;">{{company.website}}</div>
    <div style="font-size:12px;color:#475569;">TIN: {{company.taxId}} &nbsp; Reg: {{company.registrationNo}}</div>
  </div>
  <div style="text-align:right;">
    <div style="font-weight:800;font-size:20px;">INVOICE</div>
    <div style="font-size:12px;">Invoice #: {{invoice.invoice_no}}</div>
    <div style="font-size:12px;">Date: {{invoice.invoice_date}}</div>
  </div>
</div>
<hr />
<div style="font-size:12px;margin-bottom:8px;">
  <div><strong>Customer:</strong> {{customer.name}} {{customer.code}}</div>
  <div>{{customer.address}}</div>
  <div>{{customer.city}} {{customer.state}} {{customer.country}}</div>
  <div>{{customer.phone}} {{customer.mobile}} {{customer.email}}</div>
  <div>{{customer.contactPerson}}</div>
</div>
<table style="font-size:12px;">
  <thead>
    <tr>
      <th>Description</th>
      <th style="text-align:right;">Qty</th>
      <th style="text-align:right;">Unit Price</th>
      <th style="text-align:right;">Total</th>
    </tr>
  </thead>
  <tbody>
    {{#each items}}
      <tr>
        <td>{{item_name}}</td>
        <td style="text-align:right;">{{qty}}</td>
        <td style="text-align:right;">{{unit_price}}</td>
        <td style="text-align:right;">{{total}}</td>
      </tr>
    {{/each}}
  </tbody>
</table>
<div style="margin-top:12px;display:flex;justify-content:flex-end;">
  <table style="width:320px;font-size:12px;">
    <tbody>
      <tr><td>Subtotal</td><td style="text-align:right;">{{totals.subtotal}}</td></tr>
      <tr><td>Discount</td><td style="text-align:right;">{{totals.discount}}</td></tr>
      <tr><td><strong>Total</strong></td><td style="text-align:right;"><strong>{{totals.total}}</strong></td></tr>
    </tbody>
  </table>
</div>`,
  PAYSLIP: `<div style="display:flex;justify-content:space-between;align-items:flex-start;">
  <div>
    <div>{{{company.logoHtml}}}</div>
    <div style="font-weight:800;font-size:18px;">{{company.name}}</div>
    <div style="font-size:12px;color:#475569;">{{company.address}}</div>
  </div>
  <div style="text-align:right;">
    <div style="font-weight:800;font-size:20px;">PAYSLIP</div>
    <div style="font-size:12px;">Period: {{payslip.period}}</div>
  </div>
</div>
<hr />
<div style="font-size:12px;margin-bottom:10px;"><strong>Employee:</strong> {{payslip.employee}}</div>
<table style="font-size:12px;">
  <tbody>
    <tr><td>Net Pay</td><td style="text-align:right;">{{payslip.netPay}}</td></tr>
    <tr><td>Status</td><td style="text-align:right;">{{payslip.status}}</td></tr>
  </tbody>
</table>`,
  DELIVERY_NOTE: `<div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;">
  <div>
    <div>{{{company.logoHtml}}}</div>
    <div style="font-weight:700;font-size:18px;">{{company.name}}</div>
    <div style="font-size:12px;color:#475569;">{{company.address}}</div>
    <div style="font-size:12px;color:#475569;">{{company.city}} {{company.state}} {{company.country}}</div>
    <div style="font-size:12px;color:#475569;">{{company.phone}} {{company.email}}</div>
    <div style="font-size:12px;color:#475569;">{{company.website}}</div>
    <div style="font-size:12px;color:#475569;">TIN: {{company.taxId}} &nbsp; Reg: {{company.registrationNo}}</div>
  </div>
  <div style="text-align:right;">
    <div style="font-weight:800;font-size:20px;">DELIVERY NOTE</div>
    <div style="font-size:12px;">Delivery #: {{delivery.delivery_no}}</div>
    <div style="font-size:12px;">Date: {{delivery.delivery_date}}</div>
  </div>
</div>
<hr />
<div style="font-size:12px;margin-bottom:8px;">
  <div><strong>Customer:</strong> {{customer.name}} {{customer.code}}</div>
  <div>{{customer.address}}</div>
  <div>{{customer.city}} {{customer.state}} {{customer.country}}</div>
  <div>{{customer.phone}} {{customer.mobile}} {{customer.email}}</div>
  <div>{{customer.contactPerson}}</div>
</div>
<table style="font-size:12px;">
  <thead>
    <tr>
      <th>Description</th>
      <th style="text-align:right;">Qty</th>
      <th style="text-align:right;">Unit Price</th>
      <th style="text-align:right;">Total</th>
    </tr>
  </thead>
  <tbody>
    {{#each items}}
      <tr>
        <td>{{item_name}}</td>
        <td style="text-align:right;">{{qty}}</td>
        <td style="text-align:right;">{{unit_price}}</td>
        <td style="text-align:right;">{{total}}</td>
      </tr>
    {{/each}}
  </tbody>
</table>
<div style="margin-top:12px;display:flex;justify-content:flex-end;">
  <table style="width:320px;font-size:12px;">
    <tbody>
      <tr><td><strong>Total</strong></td><td style="text-align:right;"><strong>{{totals.total}}</strong></td></tr>
    </tbody>
  </table>
</div>`,
  SALES_ORDER: `<div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;">
  <div>
    <div>{{{company.logoHtml}}}</div>
    <div style="font-weight:700;font-size:18px;">{{company.name}}</div>
    <div style="font-size:12px;color:#475569;">{{company.address}}</div>
    <div style="font-size:12px;color:#475569;">{{company.city}} {{company.state}} {{company.country}}</div>
    <div style="font-size:12px;color:#475569;">{{company.phone}} {{company.email}}</div>
    <div style="font-size:12px;color:#475569;">{{company.website}}</div>
    <div style="font-size:12px;color:#475569;">TIN: {{company.taxId}} &nbsp; Reg: {{company.registrationNo}}</div>
  </div>
  <div style="text-align:right;">
    <div style="font-weight:800;font-size:20px;">SALES ORDER</div>
    <div style="font-size:12px;">Order #: {{salesOrder.order_no}}</div>
    <div style="font-size:12px;">Date: {{salesOrder.order_date}}</div>
    <div style="font-size:12px;">Status: {{salesOrder.status}}</div>
  </div>
</div>
<hr />
<div style="font-size:12px;margin-bottom:8px;">
  <div><strong>Customer:</strong> {{customer.name}} {{customer.code}}</div>
  <div>{{customer.address}}</div>
  <div>{{customer.city}} {{customer.state}} {{customer.country}}</div>
  <div>{{customer.phone}} {{customer.mobile}} {{customer.email}}</div>
  <div>{{customer.contactPerson}}</div>
</div>
<table style="font-size:12px;">
  <thead>
    <tr>
      <th>Description</th>
      <th style="text-align:right;">Qty</th>
      <th style="text-align:right;">Unit Price</th>
      <th style="text-align:right;">Total</th>
    </tr>
  </thead>
  <tbody>
    {{#each items}}
      <tr>
        <td>{{item_name}}</td>
        <td style="text-align:right;">{{qty}}</td>
        <td style="text-align:right;">{{unit_price}}</td>
        <td style="text-align:right;">{{total}}</td>
      </tr>
    {{/each}}
  </tbody>
</table>
<div style="margin-top:12px;display:flex;justify-content:flex-end;">
  <table style="width:320px;font-size:12px;">
    <tbody>
      <tr><td>Subtotal</td><td style="text-align:right;">{{totals.subtotal}}</td></tr>
      <tr><td>Discount</td><td style="text-align:right;">{{totals.discount}}</td></tr>
      <tr><td>Tax</td><td style="text-align:right;">{{totals.tax}}</td></tr>
      <tr><td><strong>Total</strong></td><td style="text-align:right;"><strong>{{totals.total}}</strong></td></tr>
    </tbody>
  </table>
</div>`,
};

export default function SettingsPage() {
  const [docType, setDocType] = useState("RECEIPT");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [templateHtml, setTemplateHtml] = useState("");
  const [companyInfo, setCompanyInfo] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    phone: "",
    email: "",
    website: "",
    taxId: "",
    registrationNo: "",
    logoUrl: "",
  });

  const [posReceiptSettings, setPosReceiptSettings] = useState(null);

  const [sections, setSections] = useState([
    "companyHeader",
    "documentHeader",
    "customerBlock",
    "itemsTable",
    "totalsBlock",
    "footer",
  ]);

  useEffect(() => {
    let mounted = true;
    async function loadCompany() {
      try {
        const meResp = await api.get("/admin/me");
        const companyId = meResp.data?.scope?.companyId;
        if (!companyId) return;
        const cResp = await api.get(`/admin/companies/${companyId}`);
        const item = cResp.data?.item || {};
        const logoUrl =
          item.has_logo === 1 || item.has_logo === true
            ? `/api/admin/companies/${companyId}/logo`
            : "";
        if (!mounted) return;
        setCompanyInfo({
          name: item.name || "",
          address: item.address || "",
          city: item.city || "",
          state: item.state || "",
          postalCode: item.postal_code || "",
          country: item.country || "",
          phone: item.telephone || "",
          email: item.email || "",
          website: item.website || "",
          taxId: item.tax_id || "",
          registrationNo: item.registration_no || "",
          logoUrl,
        });
      } catch {}
    }
    loadCompany();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadPosReceiptSettings() {
      try {
        const res = await api.get("/pos/receipt-settings");
        const item = res.data?.item || null;
        if (!mounted) return;
        if (!item) {
          setPosReceiptSettings({});
          return;
        }
        setPosReceiptSettings({
          showLogo:
            item.show_logo === 1 ||
            item.show_logo === true ||
            String(item.show_logo).toLowerCase() === "true",
          headerText: item.header_text || "",
          footerText: item.footer_text || "",
          contactNumber: item.contact_number || "",
          addressLine1: item.address_line1 || "",
          addressLine2: item.address_line2 || "",
          logoUrl: item.logo_url || "",
        });
      } catch {
        if (!mounted) return;
        setPosReceiptSettings({});
      }
    }
    loadPosReceiptSettings();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setSections([
      "companyHeader",
      "documentHeader",
      "customerBlock",
      "itemsTable",
      "totalsBlock",
      "footer",
    ]);
  }, [docType]);

  const sectionTemplates = useMemo(() => {
    if (docType === "RECEIPT_VOUCHER") {
      return {
        companyHeader: `<div style="text-align:center;">
  <div>{{{company.logoHtml}}}</div>
  <div style="font-weight:700;font-size:18px;">{{company.name}}</div>
  <div style="font-size:12px;color:#475569;">{{company.addressLine1}}</div>
  <div style="font-size:12px;color:#475569;">{{company.addressLine2}}</div>
  <div style="font-size:12px;color:#475569;">Mobile: {{company.phone}}</div>
  <div style="font-size:12px;color:#475569;">{{company.website}}</div>
  <div style="font-size:12px;color:#475569;">TIN: {{company.taxId}} &nbsp; Reg: {{company.registrationNo}}</div>
</div>`,
        documentHeader: `<div style="text-align:center;margin-top:6px;font-size:14px;font-weight:800;">RECEIPT VOUCHER</div>
<div style="text-align:center;margin-top:6px;font-size:12px;color:#475569;">{{receipt.headerText}}</div>`,
        customerBlock: ``,
        itemsTable: `<table style="font-size:12px;margin-top:10px;">
  <thead>
    <tr><th>Description</th><th style="text-align:right;">Amount</th></tr>
  </thead>
  <tbody>
    {{#each items}}
      <tr>
        <td>{{name}}</td>
        <td style="text-align:right;">{{lineTotal}}</td>
      </tr>
    {{/each}}
  </tbody>
</table>`,
        totalsBlock: `<div style="margin-top:10px;border-top:1px solid #0f172a;padding-top:6px;">
  <div style="display:flex;justify-content:space-between;font-size:13px;"><span>Subtotal</span><span>{{totals.subtotal}}</span></div>
  <div style="display:flex;justify-content:space-between;font-size:13px;"><span>Tax</span><span>{{totals.tax}}</span></div>
  <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;"><span>Grand Total</span><span>{{totals.total}}</span></div>
</div>`,
        footer: `<div style="margin-top:10px;text-align:center;font-size:11px;color:#475569;">{{receipt.footerText}}</div>`,
      };
    }
    if (docType === "PAYMENT_VOUCHER") {
      return {
        companyHeader: `<div style="text-align:center;">
  <div>{{{company.logoHtml}}}</div>
  <div style="font-weight:700;font-size:18px;">{{company.name}}</div>
  <div style="font-size:12px;color:#475569;">{{company.addressLine1}}</div>
  <div style="font-size:12px;color:#475569;">{{company.addressLine2}}</div>
  <div style="font-size:12px;color:#475569;">Mobile: {{company.phone}}</div>
  <div style="font-size:12px;color:#475569;">{{company.website}}</div>
  <div style="font-size:12px;color:#475569;">TIN: {{company.taxId}} &nbsp; Reg: {{company.registrationNo}}</div>
</div>`,
        documentHeader: `<div style="text-align:center;margin-top:6px;font-size:14px;font-weight:800;">PAYMENT VOUCHER</div>
<div style="text-align:center;margin-top:6px;font-size:12px;color:#475569;">{{payment.headerText}}</div>`,
        customerBlock: ``,
        itemsTable: `<table style="font-size:12px;margin-top:10px;">
  <thead>
    <tr><th>Description</th><th style="text-align:right;">Amount</th></tr>
  </thead>
  <tbody>
    {{#each items}}
      <tr>
        <td>{{name}}</td>
        <td style="text-align:right;">{{lineTotal}}</td>
      </tr>
    {{/each}}
  </tbody>
</table>`,
        totalsBlock: `<div style="margin-top:10px;border-top:1px solid #0f172a;padding-top:6px;">
  <div style="display:flex;justify-content:space-between;font-size:13px;"><span>Subtotal</span><span>{{totals.subtotal}}</span></div>
  <div style="display:flex;justify-content:space-between;font-size:13px;"><span>Tax</span><span>{{totals.tax}}</span></div>
  <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;"><span>Grand Total</span><span>{{totals.total}}</span></div>
</div>`,
        footer: `<div style="margin-top:10px;text-align:center;font-size:11px;color:#475569;">{{payment.footerText}}</div>`,
      };
    }
    if (docType === "RECEIPT") {
      return {
        companyHeader: `<div style="text-align:center;">
  <div>{{{company.logoHtml}}}</div>
  <div style="font-weight:700;font-size:18px;">{{company.name}}</div>
  <div style="font-size:12px;color:#475569;">{{company.addressLine1}}</div>
  <div style="font-size:12px;color:#475569;">{{company.addressLine2}}</div>
  <div style="font-size:12px;color:#475569;">Mobile: {{company.phone}}</div>
  <div style="font-size:12px;color:#475569;">{{company.website}}</div>
  <div style="font-size:12px;color:#475569;">TIN: {{company.taxId}} &nbsp; Reg: {{company.registrationNo}}</div>
</div>`,
        documentHeader: `<div style="text-align:center;margin-top:6px;font-size:12px;color:#475569;">{{receipt.headerText}}</div>`,
        customerBlock: ``,
        itemsTable: `<table style="font-size:12px;margin-top:10px;">
  <thead>
    <tr><th>Item</th><th style="text-align:right;">Qty</th><th style="text-align:right;">Price</th><th style="text-align:right;">Disc</th><th style="text-align:right;">Total</th></tr>
  </thead>
  <tbody>
    {{#each items}}
      <tr>
        <td>{{name}}</td>
        <td style="text-align:right;">{{qty}}</td>
        <td style="text-align:right;">{{price}}</td>
        <td style="text-align:right;">{{discount}}</td>
        <td style="text-align:right;">{{lineTotal}}</td>
      </tr>
    {{/each}}
  </tbody>
</table>`,
        totalsBlock: `<div style="margin-top:10px;border-top:1px solid #0f172a;padding-top:6px;">
  <div style="display:flex;justify-content:space-between;font-size:13px;"><span>Subtotal</span><span>{{totals.subtotal}}</span></div>
  <div style="display:flex;justify-content:space-between;font-size:13px;"><span>Tax</span><span>{{totals.tax}}</span></div>
  <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;"><span>Grand Total</span><span>{{totals.total}}</span></div>
</div>`,
        footer: `<div style="margin-top:10px;text-align:center;font-size:11px;color:#475569;">{{receipt.footerText}}</div>`,
      };
    }
    if (docType === "INVOICE") {
      return {
        companyHeader: `<div>
  <div>{{{company.logoHtml}}}</div>
  <div style="font-weight:700;font-size:18px;">{{company.name}}</div>
  <div style="font-size:12px;color:#475569;">{{company.address}}</div>
  <div style="font-size:12px;color:#475569;">{{company.city}} {{company.state}} {{company.country}}</div>
  <div style="font-size:12px;color:#475569;">{{company.phone}} {{company.email}}</div>
  <div style="font-size:12px;color:#475569;">{{company.website}}</div>
  <div style="font-size:12px;color:#475569;">TIN: {{company.taxId}} &nbsp; Reg: {{company.registrationNo}}</div>
</div>`,
        documentHeader: `<div style="text-align:right;">
  <div style="font-weight:800;font-size:20px;">INVOICE</div>
  <div style="font-size:12px;">Invoice #: {{invoice.invoice_no}}</div>
  <div style="font-size:12px;">Date: {{invoice.invoice_date}}</div>
</div>`,
        customerBlock: `<div style="font-size:12px;margin-bottom:8px;">
  <div><strong>Customer:</strong> {{customer.name}} {{customer.code}}</div>
  <div>{{customer.address}}</div>
  <div>{{customer.city}} {{customer.state}} {{customer.country}}</div>
  <div>{{customer.phone}} {{customer.mobile}} {{customer.email}}</div>
  <div>{{customer.contactPerson}}</div>
</div>`,
        itemsTable: `<table style="font-size:12px;">
  <thead>
    <tr>
      <th>Description</th>
      <th style="text-align:right;">Qty</th>
      <th style="text-align:right;">Unit Price</th>
      <th style="text-align:right;">Total</th>
    </tr>
  </thead>
  <tbody>
    {{#each items}}
      <tr>
        <td>{{item_name}}</td>
        <td style="text-align:right;">{{qty}}</td>
        <td style="text-align:right;">{{unit_price}}</td>
        <td style="text-align:right;">{{total}}</td>
      </tr>
    {{/each}}
  </tbody>
</table>`,
        totalsBlock: `<div style="margin-top:12px;display:flex;justify-content:flex-end;">
  <table style="width:320px;font-size:12px;">
    <tbody>
      <tr><td>Subtotal</td><td style="text-align:right;">{{totals.subtotal}}</td></tr>
      <tr><td>Discount</td><td style="text-align:right;">{{totals.discount}}</td></tr>
      <tr><td><strong>Total</strong></td><td style="text-align:right;"><strong>{{totals.total}}</strong></td></tr>
    </tbody>
  </table>
</div>`,
        footer: ``,
      };
    }
    if (docType === "DELIVERY_NOTE") {
      return {
        companyHeader: `<div>
  <div>{{{company.logoHtml}}}</div>
  <div style="font-weight:700;font-size:18px;">{{company.name}}</div>
  <div style="font-size:12px;color:#475569;">{{company.address}}</div>
  <div style="font-size:12px;color:#475569;">{{company.city}} {{company.state}} {{company.country}}</div>
  <div style="font-size:12px;color:#475569;">{{company.phone}} {{company.email}}</div>
  <div style="font-size:12px;color:#475569;">{{company.website}}</div>
  <div style="font-size:12px;color:#475569;">TIN: {{company.taxId}} &nbsp; Reg: {{company.registrationNo}}</div>
</div>`,
        documentHeader: `<div style="text-align:right;">
  <div style="font-weight:800;font-size:20px;">DELIVERY NOTE</div>
  <div style="font-size:12px;">Delivery #: {{delivery.delivery_no}}</div>
  <div style="font-size:12px;">Date: {{delivery.delivery_date}}</div>
</div>`,
        customerBlock: `<div style="font-size:12px;margin-bottom:8px;">
  <div><strong>Customer:</strong> {{customer.name}} {{customer.code}}</div>
  <div>{{customer.address}}</div>
  <div>{{customer.city}} {{customer.state}} {{customer.country}}</div>
  <div>{{customer.phone}} {{customer.mobile}} {{customer.email}}</div>
  <div>{{customer.contactPerson}}</div>
</div>`,
        itemsTable: `<table style="font-size:12px;">
  <thead>
    <tr>
      <th>Description</th>
      <th style="text-align:right;">Qty</th>
      <th style="text-align:right;">Unit Price</th>
      <th style="text-align:right;">Total</th>
    </tr>
  </thead>
  <tbody>
    {{#each items}}
      <tr>
        <td>{{item_name}}</td>
        <td style="text-align:right;">{{qty}}</td>
        <td style="text-align:right;">{{unit_price}}</td>
        <td style="text-align:right;">{{total}}</td>
      </tr>
    {{/each}}
  </tbody>
</table>`,
        totalsBlock: `<div style="margin-top:12px;display:flex;justify-content:flex-end;">
  <table style="width:320px;font-size:12px;">
    <tbody>
      <tr><td><strong>Total</strong></td><td style="text-align:right;"><strong>{{totals.total}}</strong></td></tr>
    </tbody>
  </table>
</div>`,
        footer: ``,
      };
    }
    if (docType === "SALES_ORDER") {
      return {
        companyHeader: `<div>
  <div>{{{company.logoHtml}}}</div>
  <div style="font-weight:700;font-size:18px;">{{company.name}}</div>
  <div style="font-size:12px;color:#475569;">{{company.address}}</div>
  <div style="font-size:12px;color:#475569;">{{company.city}} {{company.state}} {{company.country}}</div>
  <div style="font-size:12px;color:#475569;">{{company.phone}} {{company.email}}</div>
  <div style="font-size:12px;color:#475569;">{{company.website}}</div>
  <div style="font-size:12px;color:#475569;">TIN: {{company.taxId}} &nbsp; Reg: {{company.registrationNo}}</div>
</div>`,
        documentHeader: `<div style="text-align:right;">
  <div style="font-weight:800;font-size:20px;">SALES ORDER</div>
  <div style="font-size:12px;">Order #: {{salesOrder.order_no}}</div>
  <div style="font-size:12px;">Date: {{salesOrder.order_date}}</div>
  <div style="font-size:12px;">Status: {{salesOrder.status}}</div>
</div>`,
        customerBlock: `<div style="font-size:12px;margin-bottom:8px;">
  <div><strong>Customer:</strong> {{customer.name}} {{customer.code}}</div>
  <div>{{customer.address}}</div>
  <div>{{customer.city}} {{customer.state}} {{customer.country}}</div>
  <div>{{customer.phone}} {{customer.mobile}} {{customer.email}}</div>
  <div>{{customer.contactPerson}}</div>
</div>`,
        itemsTable: `<table style="font-size:12px;">
  <thead>
    <tr>
      <th>Description</th>
      <th style="text-align:right;">Qty</th>
      <th style="text-align:right;">Unit Price</th>
      <th style="text-align:right;">Total</th>
    </tr>
  </thead>
  <tbody>
    {{#each items}}
      <tr>
        <td>{{item_name}}</td>
        <td style="text-align:right;">{{qty}}</td>
        <td style="text-align:right;">{{unit_price}}</td>
        <td style="text-align:right;">{{total}}</td>
      </tr>
    {{/each}}
  </tbody>
</table>`,
        totalsBlock: `<div style="margin-top:12px;display:flex;justify-content:flex-end;">
  <table style="width:320px;font-size:12px;">
    <tbody>
      <tr><td>Subtotal</td><td style="text-align:right;">{{totals.subtotal}}</td></tr>
      <tr><td>Discount</td><td style="text-align:right;">{{totals.discount}}</td></tr>
      <tr><td>Tax</td><td style="text-align:right;">{{totals.tax}}</td></tr>
      <tr><td><strong>Total</strong></td><td style="text-align:right;"><strong>{{totals.total}}</strong></td></tr>
    </tbody>
  </table>
</div>`,
        footer: ``,
      };
    }
    return {};
  }, [docType]);

  const composedTemplate = useMemo(() => {
    const parts = sections.map((k) => sectionTemplates[k]).filter(Boolean);
    const body = parts.join("\n<hr />\n");
    if (
      docType === "INVOICE" ||
      docType === "DELIVERY_NOTE" ||
      docType === "SALES_ORDER"
    ) {
      return `<div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;">${sectionTemplates.companyHeader || ""}${sectionTemplates.documentHeader || ""}</div><hr />${sectionTemplates.customerBlock || ""}${sectionTemplates.itemsTable || ""}${sectionTemplates.totalsBlock || ""}${sectionTemplates.footer || ""}`;
    }
    return body;
  }, [sections, sectionTemplates, docType]);

  const sampleData = useMemo(() => {
    const logoUrl = String(companyInfo.logoUrl || "").trim();
    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="${escapeHtml(companyInfo.name || "Company")}" style="max-height:80px;object-fit:contain;" />`
      : "";
    const companyBase = {
      name: companyInfo.name || "OmniSuite Ltd",
      address: companyInfo.address || "123 Business Rd",
      city: companyInfo.city || "Accra",
      state: companyInfo.state || "Greater Accra",
      country: companyInfo.country || "Ghana",
      phone: companyInfo.phone || "+233 000 000 000",
      email: companyInfo.email || "info@example.com",
      website: companyInfo.website || "https://example.com",
      postalCode: companyInfo.postalCode || "00233",
      taxId: companyInfo.taxId || "TIN-000000",
      registrationNo: companyInfo.registrationNo || "REG-000000",
      logoUrl,
      logoHtml,
    };

    const pos = posReceiptSettings || {};

    if (docType === "RECEIPT_VOUCHER") {
      return {
        company: {
          name: companyBase.name,
          addressLine1: companyBase.address,
          addressLine2: `${companyBase.city} • ${companyBase.country}`,
          phone: companyBase.phone,
          website: companyBase.website,
          taxId: companyBase.taxId,
          registrationNo: companyBase.registrationNo,
          logoUrl,
          logoHtml,
        },
        receipt: {
          receiptNo: "RCPT-000001",
          dateTime: new Date().toLocaleString(),
          paymentMethod: "Cash",
          headerText: "Thank you",
          footerText: "Processed by Finance",
        },
        items: [
          {
            name: "Payment A",
            qty: "1",
            price: "10.00",
            discount: "0.00",
            lineTotal: "10.00",
          },
          {
            name: "Payment B",
            qty: "1",
            price: "15.00",
            discount: "0.00",
            lineTotal: "15.00",
          },
        ],
        totals: { subtotal: "25.00", tax: "0.00", total: "25.00" },
      };
    }
    if (docType === "PAYMENT_VOUCHER") {
      return {
        company: {
          name: companyBase.name,
          addressLine1: companyBase.address,
          addressLine2: `${companyBase.city} • ${companyBase.country}`,
          phone: companyBase.phone,
          website: companyBase.website,
          taxId: companyBase.taxId,
          registrationNo: companyBase.registrationNo,
          logoUrl,
          logoHtml,
        },
        payment: {
          paymentNo: "PV-000001",
          dateTime: new Date().toLocaleString(),
          paymentMethod: "Cash",
          headerText: "Supplier Payment",
          footerText: "Processed by Finance",
        },
        items: [
          {
            name: "Expense A",
            qty: "1",
            price: "20.00",
            discount: "0.00",
            lineTotal: "20.00",
          },
          {
            name: "Expense B",
            qty: "1",
            price: "15.00",
            discount: "0.00",
            lineTotal: "15.00",
          },
        ],
        totals: { subtotal: "35.00", tax: "0.00", total: "35.00" },
      };
    }
    if (docType === "INVOICE") {
      return {
        company: companyBase,
        invoice: { invoice_no: "INV-000001", invoice_date: "2026-01-29" },
        customer: {
          code: "CUST001",
          name: "Customer Name",
          address: "123 Customer Street",
          city: "Accra",
          state: "Greater Accra",
          zone: "Accra",
          country: "Ghana",
          phone: "0200000000",
          mobile: "0200000000",
          email: "customer@example.com",
          contactPerson: "John Customer",
          type: "BUSINESS",
          paymentTerms: "Net 30",
          creditLimit: "0.00",
        },
        items: [
          {
            item_name: "Item A",
            qty: "2.00",
            unit_price: "10.00",
            total: "20.00",
          },
          {
            item_name: "Item B",
            qty: "1.00",
            unit_price: "15.00",
            total: "15.00",
          },
        ],
        totals: { subtotal: "35.00", discount: "0.00", total: "35.00" },
      };
    }

    if (docType === "PAYSLIP") {
      return {
        company: {
          name: companyBase.name,
          address: companyBase.address,
          logoUrl,
          logoHtml,
        },
        payslip: {
          period: "2026-01",
          employee: "John Doe",
          netPay: "2500.00",
          status: "GENERATED",
        },
      };
    }

    if (docType === "DELIVERY_NOTE") {
      return {
        company: companyBase,
        delivery: { delivery_no: "DN-000001", delivery_date: "2026-01-29" },
        customer: {
          code: "CUST001",
          name: "Customer Name",
          address: "123 Customer Street",
          city: "Accra",
          state: "Greater Accra",
          zone: "Accra",
          country: "Ghana",
          phone: "0200000000",
          mobile: "0200000000",
          email: "customer@example.com",
          contactPerson: "John Customer",
          type: "BUSINESS",
          paymentTerms: "Net 30",
          creditLimit: "0.00",
        },
        items: [
          {
            item_name: "Item A",
            qty: "2.00",
            unit_price: "10.00",
            total: "20.00",
          },
          {
            item_name: "Item B",
            qty: "1.00",
            unit_price: "15.00",
            total: "15.00",
          },
        ],
        totals: { total: "35.00" },
      };
    }

    if (docType === "SALES_ORDER") {
      return {
        company: companyBase,
        salesOrder: {
          order_no: "SO-000001",
          order_date: "2026-01-29",
          status: "DRAFT",
        },
        customer: {
          code: "CUST001",
          name: "Customer Name",
          address: "123 Customer Street",
          city: "Accra",
          state: "Greater Accra",
          zone: "Accra",
          country: "Ghana",
          phone: "0200000000",
          mobile: "0200000000",
          email: "customer@example.com",
          contactPerson: "John Customer",
          type: "BUSINESS",
          paymentTerms: "Net 30",
          creditLimit: "0.00",
        },
        items: [
          {
            item_name: "Item A",
            qty: "2.00",
            unit_price: "10.00",
            total: "20.00",
          },
          {
            item_name: "Item B",
            qty: "1.00",
            unit_price: "15.00",
            total: "15.00",
          },
        ],
        totals: {
          subtotal: "35.00",
          discount: "0.00",
          tax: "0.00",
          total: "35.00",
        },
      };
    }

    return {
      company: {
        name: String(pos.companyName || companyBase.name),
        addressLine1: String(pos.addressLine1 || companyBase.address),
        addressLine2: String(
          pos.addressLine2 || `${companyBase.city} • ${companyBase.country}`,
        ),
        phone: String(pos.contactNumber || companyBase.phone),
        website: companyBase.website,
        taxId: companyBase.taxId,
        registrationNo: companyBase.registrationNo,
        logoUrl,
        logoHtml,
      },
      receipt: {
        receiptNo: "RCPT-000001",
        dateTime: new Date().toLocaleString(),
        paymentMethod: "Cash",
        headerText: String(pos.headerText || "Thank you for your purchase"),
        footerText: String(pos.footerText || "Please visit again"),
      },
      items: [
        {
          name: "Item A",
          qty: "2",
          price: "10.00",
          discount: "0.00",
          lineTotal: "20.00",
        },
        {
          name: "Item B",
          qty: "1",
          price: "15.00",
          discount: "0.00",
          lineTotal: "15.00",
        },
      ],
      totals: { subtotal: "35.00", tax: "0.00", total: "35.00" },
    };
  }, [docType, companyInfo, posReceiptSettings]);

  const previewDoc = useMemo(() => {
    const html = renderTemplateString(composedTemplate, sampleData);
    return wrapDoc(html);
  }, [composedTemplate, sampleData]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await api.get(`/admin/document-templates/${docType}`);
        const item = res.data?.item || null;
        const html = String(item?.template_html || "");
        if (mounted) {
          setTemplateHtml(html || "");
        }
      } catch (e) {
        if (mounted) {
          setError(
            e?.response?.data?.message ||
              e?.message ||
              "Failed to load template",
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [docType]);

  async function save() {
    setSaving(true);
    setError("");
    try {
      await api.put(`/admin/document-templates/${docType}`, {
        templateHtml: composedTemplate,
      });
      toast.success("Template saved");
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "Failed to save");
      toast.error("Failed to save template");
    } finally {
      setSaving(false);
    }
  }

  function onDragStart(e, index) {
    e.dataTransfer.setData("text/plain", String(index));
  }
  function onDragOver(e) {
    e.preventDefault();
  }
  function onDrop(e, index) {
    const from = Number(e.dataTransfer.getData("text/plain"));
    if (!Number.isFinite(from)) return;
    if (from === index) return;
    const next = sections.slice();
    const [moved] = next.splice(from, 1);
    next.splice(index, 0, moved);
    setSections(next);
  }
  function resetDefault() {
    setSections([
      "companyHeader",
      "documentHeader",
      "customerBlock",
      "itemsTable",
      "totalsBlock",
      "footer",
    ]);
  }

  async function printPreview() {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
    const doc =
      iframe.contentWindow?.document || iframe.contentDocument || null;
    if (!doc) {
      document.body.removeChild(iframe);
      return;
    }
    const html = wrapDoc(renderTemplateString(composedTemplate, sampleData));
    doc.open();
    doc.write(html);
    doc.close();
    const win = iframe.contentWindow || window;
    const doPrint = () => {
      win.focus();
      try {
        win.print();
      } catch {}
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 100);
    };
    setTimeout(doPrint, 200);
  }

  async function downloadPreview() {
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-10000px";
    container.style.top = "0";
    container.style.width = "794px";
    container.style.background = "white";
    container.style.padding = "32px";
    container.innerHTML = renderTemplateString(composedTemplate, sampleData);
    document.body.appendChild(container);
    try {
      await waitForImages(container);
      const canvas = await html2canvas(container, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let rendered = 0;
      while (rendered < imgHeight) {
        pdf.addImage(imgData, "PNG", 0, -rendered, imgWidth, imgHeight);
        rendered += pageHeight;
        if (rendered < imgHeight) pdf.addPage();
      }
      pdf.save(`${docType.toLowerCase()}-template-preview.pdf`);
    } finally {
      document.body.removeChild(container);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                Administration Settings
              </h1>
              <p className="text-sm mt-1">
                Configure document templates used for print and PDF
              </p>
            </div>
            <div className="flex gap-2">
              <Link to="/administration" className="btn btn-secondary">
                Return to Menu
              </Link>
              <button
                type="button"
                className="btn-success"
                disabled={saving || loading}
                onClick={save}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      ) : null}

      <div className="card">
        <div className="card-body space-y-4">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Document
              </div>
              <select
                className="input w-56"
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                disabled={loading || saving}
              >
                {DOC_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400">
              Use {"{{field}}"}, blocks like {"{{#each items}}...{{/each}}"},
              and logo as {"{{{company.logoHtml}}}"}.
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Arrange Sections
              </div>
              <div className="space-y-2">
                <ul className="space-y-2">
                  {sections.map((k, idx) => (
                    <li
                      key={k + "_" + idx}
                      draggable
                      onDragStart={(e) => onDragStart(e, idx)}
                      onDragOver={onDragOver}
                      onDrop={(e) => onDrop(e, idx)}
                      className="px-3 py-2 rounded-lg border border-slate-200 bg-white dark:bg-slate-800 cursor-move"
                    >
                      {k === "companyHeader" && "Company Header"}
                      {k === "documentHeader" && "Document Header"}
                      {k === "customerBlock" && "Customer Block"}
                      {k === "itemsTable" && "Items Table"}
                      {k === "totalsBlock" && "Totals Block"}
                      {k === "footer" && "Footer"}
                    </li>
                  ))}
                </ul>
                <div>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={resetDefault}
                  >
                    Reset Default
                  </button>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Preview
              </div>
              <iframe
                title="Template Preview"
                className="w-full h-[520px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white"
                srcDoc={previewDoc}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
