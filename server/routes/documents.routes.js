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
import { join } from "path";
import { existsSync } from "fs";
import crypto from "crypto";

async function resolveTaxSummary(items, companyId) {
  const summary = {}; // name -> { amount, rate }
  const taxCodeIds = [...new Set(items.map((i) => i.tax_code_id).filter(Boolean))];
  if (taxCodeIds.length === 0) return [];

  // Fetch all active tax components for these codes
  const compRows = await query(`SELECT c.tax_code_id, td.component_name as name, c.rate_percent as rate, c.compound_level,
          c.created_at,
          u.username AS created_by_name
         FROM fin_tax_components c
     JOIN fin_tax_details td ON td.id = c.tax_detail_id
        LEFT JOIN adm_users u ON u.id = c.created_by
         WHERE c.company_id = :companyId AND c.is_active = 1
     ORDER BY c.compound_level ASC, c.sort_order ASC`,
    { companyId },
  );

  const compsByCode = {};
  compRows.forEach((c) => {
    if (!taxCodeIds.includes(c.tax_code_id)) return;
    if (!compsByCode[c.tax_code_id]) compsByCode[c.tax_code_id] = [];
    compsByCode[c.tax_code_id].push(c);
  });

  items.forEach((item) => {
    const netAmount = Number(item.amount || item.total_net_amount || 0);
    const comps = compsByCode[item.tax_code_id] || [];
    if (comps.length === 0) return;

    const levels = {};
    comps.forEach((c) => {
      const lvl = c.compound_level || 0;
      if (!levels[lvl]) levels[lvl] = [];
      levels[lvl].push(c);
    });

    const sortedLevels = Object.keys(levels)
      .map(Number)
      .sort((a, b) => a - b);
    let currentBase = netAmount;

    sortedLevels.forEach((lvl) => {
      let levelTax = 0;
      levels[lvl].forEach((c) => {
        const tax = currentBase * (Number(c.rate) / 100);
        levelTax += tax;
        if (!summary[c.name]) summary[c.name] = { amount: 0, rate: c.rate };
        summary[c.name].amount += tax;
      });
      currentBase += levelTax;
    });
  });

  return Object.entries(summary).map(([name, data]) => ({
    name,
    rate: data.rate,
    amount: data.amount.toFixed(2),
  }));
}

const router = express.Router();

// Register Handlebars helpers
Handlebars.registerHelper("formatDate", function (date) {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  return d.toISOString().split("T")[0];
});
Handlebars.registerHelper("inc", function (value) {
  return parseInt(value) + 1;
});
Handlebars.registerHelper("salary_slip_amount", function (val) {
  const n = Number(val || 0);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
});

function canonicalDocumentType(type) {
  const t = String(type || "")
    .trim()
    .toLowerCase();
  if (
    t === "general-template" ||
    t === "general template" ||
    t === "general_template" ||
    t === "general" ||
    t === "header" ||
    t === "report-header"
  ) {
    return "general-template";
  }
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
  if (t === "quotation" || t === "sales-quotation" || t === "quote") {
    return "quotation";
  }
  if (
    t === "payment-voucher" ||
    t === "payment voucher" ||
    t === "payment_voucher" ||
    t === "pv"
  ) {
    return "payment-voucher";
  }
  if (t === "salary-slip" || t === "salaryslip" || t === "payslip") {
    return "salary-slip";
  }
  if (
    t === "purchase-bill" ||
    t === "purchase bill" ||
    t === "purchase_bill" ||
    t === "pbill" ||
    t === "bill" ||
    t === "purchaseinvoice" ||
    t === "purchase-invoice" ||
    t === "PURCHASE_BILL"
  ) {
    return "purchase-bill";
  }
  if (
    t === "grn" ||
    t === "GRN" ||
    t === "goods receipt note" ||
    t === "goods-receipt-note" ||
    t === "goods_receipt_note" ||
    t === "goods receipt" ||
    t === "GOODS_RECEIPT_NOTE"
  ) {
    return "grn";
  }
  if (
    t === "purchase-order" ||
    t === "purchase order" ||
    t === "purchase_order" ||
    t === "po" ||
    t === "po-local" ||
    t === "po-import" ||
    t === "purchase-order-local" ||
    t === "purchase-order-import" ||
    t === "PURCHASE_ORDER"
  ) {
    return "purchase-order";
  }
  if (t === "maintenance-bill" || t === "mbl" || t === "maint-bill") {
    return "maintenance-bill";
  }
  if (t === "service-bill" || t === "svc-bill" || t === "service_bill") {
    return "service-bill";
  }
  if (t === "supplier-quotation" || t === "msq" || t === "maint-quotation") {
    return "supplier-quotation";
  }
  if (t === "direct-purchase" || t === "dp" || t === "direct_purchase") {
    return "direct-purchase";
  }
  if (
    t === "direct-purchase" ||
    t === "direct purchase" ||
    t === "direct_purchase" ||
    t === "directpurchase" ||
    t === "DIRECT_PURCHASE"
  ) {
    return "direct-purchase";
  }
  if (t === "maintenance-bill" || t === "maintenance bill" || t === "maintenance_bill") {
    return "maintenance-bill";
  }
  if (t === "service-bill" || t === "service bill" || t === "service_bill") {
    return "service-bill";
  }
  if (t === "supplier-quotation" || t === "supplier quotation" || t === "supplier_quotation") {
    return "supplier-quotation";
  }
  return t || "general-template";
}

function expandDocumentTypeAliases(type) {
  const c = canonicalDocumentType(type);
  if (c === "general-template") {
    return [
      "general-template",
      "general template",
      "general_template",
      "general",
      "header",
      "report-header",
    ];
  }
  if (c === "sales-order") {
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
  if (c === "invoice") {
    return [
      "invoice",
      "INVOICE",
      "sales-invoice",
      "sales invoice",
      "sales_invoice",
      "Sales Invoice",
    ];
  }
  if (c === "delivery-note") {
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
  if (c === "quotation") {
    return [
      "quotation",
      "Quotation",
      "QUOTE",
      "quotes",
      "sales-quotation",
      "Sales Quotation",
    ];
  }
  if (c === "payment-voucher") {
    return [
      "payment-voucher",
      "payment voucher",
      "payment_voucher",
      "PAYMENT_VOUCHER",
      "PV",
    ];
  }
  if (c === "salary-slip") {
    return [
      "salary-slip",
      "salaryslip",
      "salary slip",
      "salary_slip",
      "payslip",
      "payslips",
    ];
  }
  if (c === "purchase-bill") {
    return [
      "purchase-bill",
      "purchase bill",
      "purchase_bill",
      "pbill",
      "bill",
      "purchase-invoice",
      "purchaseinvoice",
      "PURCHASE_BILL",
      "Purchase Bill",
    ];
  }
  if (c === "grn") {
    return [
      "grn",
      "GRN",
      "goods receipt note",
      "goods-receipt-note",
      "goods_receipt_note",
      "goods receipt",
      "GOODS_RECEIPT_NOTE",
      "Goods Receipt Note",
    ];
  }
  if (c === "purchase-order") {
    return [
      "purchase-order",
      "purchase order",
      "purchase_order",
      "po",
      "PO",
      "PO_LOCAL",
      "PO_IMPORT",
      "PURCHASE_ORDER",
      "Purchase Order",
    ];
  }
  if (c === "direct-purchase") {
    return [
      "direct-purchase",
      "direct purchase",
      "direct_purchase",
      "directpurchase",
      "DIRECT_PURCHASE",
      "Direct Purchase",
    ];
  }
  if (c === "maintenance-bill") {
    return ["maintenance-bill", "maintenance bill", "Maintenance Bill", "MAINTENANCE_BILL"];
  }
  if (c === "service-bill") {
    return ["service-bill", "service bill", "Service Bill", "SERVICE_BILL"];
  }
  if (c === "supplier-quotation") {
    return ["supplier-quotation", "supplier quotation", "Supplier Quotation", "SUPPLIER_QUOTATION"];
  }
  return [c];
}

function docTypeSynonymsLower(type) {
  return expandDocumentTypeAliases(type).map((v) =>
    String(v).trim().toLowerCase(),
  );
}

function getDefaultSampleTemplate(type) {
  const canonical = canonicalDocumentType(type);
  const head = `<style>
    * { box-sizing: border-box; font-family: Arial, sans-serif; }
    .doc { max-width: 800px; margin: 0 auto; padding: 12px; }
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .logo { height: 60px; object-fit: contain; }
    .company { text-align: right; font-size: 12px; }
    .company .name { font-weight: bold; font-size: 18px; }
    .titlebar { display: flex; align-items: center; justify-content: center; gap: 12px; margin: 12px 0; }
    .line { flex: 1; border-top: 2px solid #000; }
    .title { font-weight: bold; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
  </style>`;
  const header = `
    <div class="header">
      <img class="logo" src="{{company.logo}}" alt="Logo"/>
      <div class="company">
        <div class="name">{{company.name}}</div>
        <div>{{company.address}}</div>
        <div>{{company.address2}}</div>
        <div>{{company.phone}} • {{company.email}} • {{company.website}}</div>
      </div>
    </div>
  `;
  const title = (t) =>
    `<div class="titlebar"><div class="line"></div><div class="title">${t}</div><div class="line"></div></div>`;
  if (canonical === "sales-order") {
    return `${head}<div class="doc">${header}${title("* Sales Order *")}<table><thead><tr><th>#</th><th>Code</th><th>Description</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead><tbody>{{#each sales_order.items}}<tr><td>{{inc @index}}</td><td>{{code}}</td><td>{{name}}</td><td>{{quantity}}</td><td>{{price}}</td><td>{{amount}}</td></tr>{{/each}}</tbody></table></div>`;
  }
  if (canonical === "invoice") {
    return `${head}<div class="doc">${header}${title("* Sales Invoice *")}<table><thead><tr><th>#</th><th>Code</th><th>Description</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead><tbody>{{#each invoice.items}}<tr><td>{{inc @index}}</td><td>{{code}}</td><td>{{name}}</td><td>{{quantity}}</td><td>{{price}}</td><td>{{amount}}</td></tr>{{/each}}</tbody></table></div>`;
  }
  if (canonical === "delivery-note") {
    return `${head}<div class="doc">${header}${title("* Delivery Note *")}<table><thead><tr><th>#</th><th>Code</th><th>Description</th><th>Ordered</th><th>Delivered</th></tr></thead><tbody>{{#each delivery.items}}<tr><td>{{inc @index}}</td><td>{{code}}</td><td>{{name}}</td><td>{{qty_ordered}}</td><td>{{qty_delivered}}</td></tr>{{/each}}</tbody></table></div>`;
  }
  if (canonical === "quotation") {
    return `${head}<div class="doc">${header}${title("* Quotation *")}<table><thead><tr><th>#</th><th>Code</th><th>Description</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead><tbody>{{#each quotation.items}}<tr><td>{{inc @index}}</td><td>{{code}}</td><td>{{name}}</td><td>{{quantity}}</td><td>{{price}}</td><td>{{amount}}</td></tr>{{/each}}</tbody></table></div>`;
  }
  if (canonical === "payment-voucher") {
    return `${head}<div class="doc">${header}${title("* Payment Voucher *")}<table><thead><tr><th>#</th><th>Account</th><th>Description</th><th>Debit</th><th>Credit</th></tr></thead><tbody>{{#each payment_voucher.items}}<tr><td>{{inc @index}}</td><td>{{account_name}}</td><td>{{description}}</td><td>{{debit}}</td><td>{{credit}}</td></tr>{{/each}}</tbody></table></div>`;
  }
  if (canonical === "salary-slip") {
    return `${head}<div class="doc">${header}${title("* Salary Slip *")}<table><thead><tr><th>Description</th><th>Amount</th></tr></thead><tbody>{{#each payslip.rows}}<tr><td>{{earning_label}}</td><td>{{salary_slip_amount earning_amount}}</td></tr>{{/each}}</tbody></table><div style="margin-top:8px;display:flex;gap:12px"><div><strong>Total Earnings:</strong> {{salary_slip_amount salary_slip.total_earnings}}</div><div><strong>Total Deductions:</strong> {{salary_slip_amount salary_slip.total_deductions}}</div></div></div>`;
  }
  if (canonical === "purchase-order") {
    return `${head}<div class="doc">${header}${title("* Purchase Order *")}<table><thead><tr><th>#</th><th>Code</th><th>Description</th><th>Qty</th><th>UOM</th><th>Price</th><th>Amount</th></tr></thead><tbody>{{#each purchase_order.items}}<tr><td>{{inc @index}}</td><td>{{code}}</td><td>{{name}}</td><td class="num">{{quantity}}</td><td>{{uom}}</td><td class="num">{{price}}</td><td class="num">{{amount}}</td></tr>{{/each}}</tbody></table></div>`;
  }
  if (canonical === "direct-purchase") {
    return `${head}<div class="doc">${header}${title("* Direct Purchase *")}<table><thead><tr><th>#</th><th>Code</th><th>Description</th><th>Qty</th><th>UOM</th><th>Price</th><th>Amount</th></tr></thead><tbody>{{#each direct_purchase.items}}<tr><td>{{inc @index}}</td><td>{{code}}</td><td>{{name}}</td><td class="num">{{quantity}}</td><td>{{uom}}</td><td class="num">{{price}}</td><td class="num">{{amount}}</td></tr>{{/each}}</tbody></table></div>`;
  }
  if (canonical === "purchase-bill") {
    return `${head}<div class="doc">${header}${title("* Purchase Bill *")}<table><thead><tr><th>#</th><th>Code</th><th>Description</th><th>Qty</th><th>UOM</th><th>Price</th><th>Amount</th></tr></thead><tbody>{{#each purchase_bill.items}}<tr><td>{{inc @index}}</td><td>{{code}}</td><td>{{name}}</td><td class="num">{{quantity}}</td><td>{{uom}}</td><td class="num">{{price}}</td><td class="num">{{amount}}</td></tr>{{/each}}</tbody></table></div>`;
  }
  if (canonical === "grn") {
    return `${head}<div class="doc">${header}${title("* Goods Receipt Note *")}<table><thead><tr><th>#</th><th>Code</th><th>Description</th><th>Ordered</th><th>Received</th><th>Accepted</th><th>UOM</th><th>Price</th><th>Amount</th></tr></thead><tbody>{{#each grn.items}}<tr><td>{{inc @index}}</td><td>{{code}}</td><td>{{name}}</td><td class="num">{{ordered}}</td><td class="num">{{received}}</td><td class="num">{{accepted}}</td><td>{{uom}}</td><td class="num">{{price}}</td><td class="num">{{amount}}</td></tr>{{/each}}</tbody></table></div>`;
  }
  return `${head}<div class="doc">${header}${title("* Document *")}</div>`;
}

// Browser singleton for PDF rendering
let _browser = null;

async function launchBrowser() {
  if (_browser) return _browser;

  const { default: puppeteer } = await import("puppeteer");

  const launchArgs = {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  };

  // Try known executable paths first (Windows)
  const candidatePaths = [
    join(
      "C:",
      "Users",
      "stanl",
      ".cache",
      "puppeteer",
      "chrome",
      "win64-146.0.7680.153",
      "chrome-win64",
      "chrome.exe",
    ),
    join(
      process.cwd(),
      "node_modules",
      "puppeteer",
      ".local-chromium",
      "win64-123456",
      "chrome-win64",
      "chrome.exe",
    ),
  ];

  let executablePath;
  for (const p of candidatePaths) {
    if (existsSync(p)) {
      executablePath = p;
      break;
    }
  }

  try {
    _browser = await puppeteer.launch({ ...launchArgs, executablePath });
    _browser.on("disconnected", () => {
      _browser = null;
    });
  } catch {
    _browser = await puppeteer.launch({
      ...launchArgs,
      executablePath: undefined,
    });
    _browser.on("disconnected", () => {
      _browser = null;
    });
  }

  return _browser;
}

async function getCompanyLogoDataUri(companyId) {
  try {
    const rows = await query(
      "SELECT logo FROM adm_companies WHERE id = :companyId LIMIT 1",
      { companyId },
    ).catch(() => []);
    const buf = rows?.[0]?.logo;
    if (!buf) return null;
    const logoBuffer = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
    let mime = "application/octet-stream";
    if (
      logoBuffer.length >= 8 &&
      logoBuffer[0] === 0x89 &&
      logoBuffer[1] === 0x50 &&
      logoBuffer[2] === 0x4e &&
      logoBuffer[3] === 0x47 &&
      logoBuffer[4] === 0x0d &&
      logoBuffer[5] === 0x0a &&
      logoBuffer[6] === 0x1a &&
      logoBuffer[7] === 0x0a
    ) {
      mime = "image/png";
    } else if (
      logoBuffer.length >= 3 &&
      logoBuffer[0] === 0xff &&
      logoBuffer[1] === 0xd8 &&
      logoBuffer[2] === 0xff
    ) {
      mime = "image/jpeg";
    } else if (
      logoBuffer.length >= 6 &&
      logoBuffer[0] === 0x47 &&
      logoBuffer[1] === 0x49 &&
      logoBuffer[2] === 0x46 &&
      logoBuffer[3] === 0x38 &&
      (logoBuffer[4] === 0x39 || logoBuffer[4] === 0x37) &&
      logoBuffer[5] === 0x61
    ) {
      mime = "image/gif";
    }
    const base64 = logoBuffer.toString("base64");
    return `data:${mime};base64,${base64}`;
  } catch {
    return null;
  }
}

async function loadPreviewData(type, companyId, branchId) {
  const [company] = await query(`
    SELECT id, name, address, city, state, postal_code, country, telephone, email, website,
          created_at,
          u.username AS created_by_name
         FROM adm_companies
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :companyId
    LIMIT 1
    `,
    { companyId },
  ).catch(() => []);

  if (type === "sales-order") {
    return {
      company: company || {},
      customer: {
        name: "John Doe",
        address: "123 Main Street",
        address2: "Suite 100",
        city: "Accra",
        state: "Greater Accra",
        country: "Ghana",
        phone: "+233 55 123 4567",
        email: "john.doe@example.com",
      },
      sales_order: {
        id: 0,
        number: "SO-PREVIEW",
        date: new Date().toDateString(),
        status: "DRAFT",
        sub_total: 0,
        tax_amount: 0,
        total: 0,
        remarks: "",
        qr_code: `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent("SALES_ORDER|PREVIEW|SO-PREVIEW|" + new Date().toISOString().slice(0, 10))}`,
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
        name: "John Doe",
        address: "123 Main Street",
        address2: "Suite 100",
        city: "Accra",
        state: "Greater Accra",
        country: "Ghana",
        phone: "+233 55 123 4567",
        email: "john.doe@example.com",
      },
      invoice: {
        id: 0,
        number: "INV-PREVIEW",
        date: new Date().toDateString(),
        status: "DRAFT",
        payment_status: "PENDING",
        sub_total: 300,
        tax_amount: 0,
        total: 300,
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
        name: "John Doe",
        address: "123 Main Street",
        address2: "Suite 100",
        phone: "+233 55 123 4567",
        email: "john.doe@example.com",
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
        total_debit: 250,
        total_credit: 250,
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
        name: "John Doe",
        address: "123 Main Street",
        address2: "Suite 100",
        phone: "+233 55 123 4567",
        email: "john.doe@example.com",
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
  if (type === "salary-slip") {
    return {
      company: company || {
        name: "Acme Ghana Ltd",
        address: "123 Business Lane, Accra",
        phone: "+233 50 123 4567",
        email: "info@acmeghana.com",
        logo: `/api/admin/companies/${companyId}/logo`,
      },
      employee: {
        name: "Jane Smith",
        code: "EMP-001",
        email: "jane@example.com",
        department: "Engineering",
        branch: "Headquarters",
        job_title: "Senior Engineer",
        bank_name: "Ecobank Ghana",
        bank_account_no: "1441000123456",
      },
      payslip: {
        id: "1024",
        period_name: "October 2023",
        paid_at: new Date().toLocaleDateString(),
        basic_salary: "5000.00",
        allowances: "1500.00",
        deductions: "800.00",
        gross_pay: "6500.00",
        net_salary: "5700.00",
        status: "PAID",
        qr_code: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent("PREVIEW_PAYSLIP")}`,
      },
      salary_slip: {
        pay_period: "October 2023",
        pay_date: new Date().toLocaleDateString(),
        earnings: [
          { name: "Basic Salary", amount: "5000.00" },
          { name: "Housing Allowance", amount: "1000.00" },
          { name: "Transport Allowance", amount: "500.00" },
        ],
        deductions: [
          { name: "Income Tax (PAYE)", amount: "450.00" },
          { name: "SSF (Employee)", amount: "250.00" },
          { name: "Tier 3", amount: "100.00" },
        ],
        total_earnings: "6500.00",
        total_deductions: "800.00",
        net_pay: "5700.00",
        net_pay_in_words: "Five Thousand Seven Hundred Ghana Cedis Only",
      },
    };
  }
  if (type === "purchase-order") {
    return {
      company: company || {},
      supplier: {
        name: "Sample Supplier Ltd",
        address: "Industrial Area, Accra",
        phone: "+233 20 000 0000",
        email: "supplier@example.com",
      },
      purchase_order: {
        id: 0,
        number: "PO-PREVIEW",
        date: new Date().toDateString(),
        status: "DRAFT",
        remarks: "",
        items: [
          {
            name: "Sample Item",
            code: "ITEM001",
            quantity: 2,
            uom: "PCS",
            price: 100,
            amount: 200,
          },
          {
            name: "Sample Item 2",
            code: "ITEM002",
            quantity: 1,
            uom: "PCS",
            price: 50,
            amount: 50,
          },
        ],
        sub_total: 250,
        tax_amount: 0,
        total: 250,
      },
    };
  }
  if (type === "direct-purchase") {
    return {
      company: company || {},
      supplier: {
        name: "Sample Supplier Ltd",
        address: "Industrial Area, Accra",
        phone: "+233 20 000 0000",
        email: "supplier@example.com",
      },
      direct_purchase: {
        id: 0,
        number: "DP-PREVIEW",
        date: new Date().toDateString(),
        status: "DRAFT",
        remarks: "",
        items: [
          {
            name: "Sample Item",
            code: "ITEM001",
            quantity: 3,
            uom: "PCS",
            price: 80,
            amount: 240,
          },
          {
            name: "Sample Item 2",
            code: "ITEM002",
            quantity: 2,
            uom: "PCS",
            price: 50,
            amount: 100,
          },
        ],
        sub_total: 340,
        tax_amount: 0,
        total: 340,
      },
    };
  }
  throw httpError(400, "VALIDATION_ERROR", "Unsupported type");
}

async function loadData(type, id, companyId, branchId) {
  if (type === "sales-order") {
    const [order] = await query(`
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
        o.remarks,
          o.created_at,
          u.username AS created_by_name
         FROM sal_orders o
      LEFT JOIN sal_customers c
        ON c.id = o.customer_id AND c.company_id = o.company_id
        LEFT JOIN adm_users u ON u.id = o.created_by
         WHERE o.id = :id AND o.company_id = :companyId AND o.branch_id = :branchId
      LIMIT 1
      `,
      { id, companyId, branchId },
    ).catch(() => []);
    if (!order) throw httpError(404, "NOT_FOUND", "Document not found");
    let employee = null;
    if (order.created_by) {
      const [u] = await query(`
        SELECT id, username, email, full_name,
          created_at,
          u.username AS created_by_name
         FROM adm_users
        LEFT JOIN adm_users u ON u.id = created_by
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
    const details = await query(`
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
        d.tax_code_id,
        it.item_code,
        it.item_name,
          d.created_at,
          u.username AS created_by_name
         FROM sal_order_details d
      LEFT JOIN inv_items it
        ON it.id = d.item_id AND it.company_id = :companyId
        LEFT JOIN adm_users u ON u.id = d.created_by
         WHERE d.order_id = :id
      ORDER BY d.id ASC
      `,
      { id, companyId },
    ).catch(() => []);

    const tax_summary = await resolveTaxSummary(details, companyId);
    const [company] = await query(`
      SELECT id, name, address, city, state, postal_code, country, telephone, email, website,
          created_at,
          u.username AS created_by_name
         FROM adm_companies
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :companyId
      LIMIT 1
      `,
      { companyId },
    ).catch(() => []);
    const extra = await query(`
      SELECT 
        w.warehouse_name,
        cur.code AS currency_code,
          ac.created_at,
          u.username AS created_by_name
         FROM adm_companies ac
      LEFT JOIN inv_warehouses w
        ON w.id = :wid AND w.company_id = ac.id
      LEFT JOIN fin_currencies cur
        ON cur.id = :cid
        LEFT JOIN adm_users u ON u.id = ac.created_by
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
        address2: "",
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
        tax_summary,
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
    try {
      const qrPayload = encodeURIComponent(
        `SALES_ORDER|${order.id}|${order.order_no || ""}|${order.order_date || ""}|${order.customer_name || ""}`,
      );
      soObj.sales_order.qr_code = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${qrPayload}`;
    } catch {}
    // Keep tax_summary at root for templates that iterate {{#each tax_summary}}.
    soObj.tax_summary = tax_summary;
    soObj.document = soObj.sales_order;
    soObj.order = soObj.sales_order;
    soObj.items = soObj.sales_order.items;
    return soObj;
  }
  if (type === "invoice") {
    const [inv] = await query(`
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
        i.remarks,
          i.created_at,
          u.username AS created_by_name
         FROM sal_invoices i
      LEFT JOIN sal_customers c
        ON c.id = i.customer_id AND c.company_id = i.company_id
        LEFT JOIN adm_users u ON u.id = i.created_by
         WHERE i.id = :id AND i.company_id = :companyId AND i.branch_id = :branchId
      LIMIT 1
      `,
      { id, companyId, branchId },
    ).catch(() => []);
    if (!inv) throw httpError(404, "NOT_FOUND", "Document not found");
    let employee = null;
    if (inv.created_by) {
      const [u] = await query(`
        SELECT id, username, email, full_name,
          created_at,
          u.username AS created_by_name
         FROM adm_users
        LEFT JOIN adm_users u ON u.id = created_by
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
    const details = await query(`
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
        d.tax_type AS tax_code_id,
        it.item_code,
        it.item_name,
          d.created_at,
          u.username AS created_by_name
         FROM sal_invoice_details d
      LEFT JOIN inv_items it
        ON it.id = d.item_id AND it.company_id = :companyId
        LEFT JOIN adm_users u ON u.id = d.created_by
         WHERE d.invoice_id = :id
      ORDER BY d.id ASC
      `,
      { id, companyId },
    ).catch(() => []);
    
    const tax_summary = await resolveTaxSummary(details, companyId);
    const [company] = await query(`
      SELECT id, name, address, city, state, postal_code, country, telephone, email, website,
          created_at,
          u.username AS created_by_name
         FROM adm_companies
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :companyId
      LIMIT 1
      `,
      { companyId },
    ).catch(() => []);
    const extra = await query(`
      SELECT 
        w.warehouse_name,
        cur.code AS currency_code,
          ac.created_at,
          u.username AS created_by_name
         FROM adm_companies ac
      LEFT JOIN inv_warehouses w
        ON w.id = :wid AND w.company_id = ac.id
      LEFT JOIN fin_currencies cur
        ON cur.id = :cid
        LEFT JOIN adm_users u ON u.id = ac.created_by
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
        address2: "",
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
        tax_summary,
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
    try {
      const qrPayload = encodeURIComponent(
        `INVOICE|${inv.id}|${inv.invoice_no || ""}|${inv.invoice_date || ""}|${inv.customer_name || ""}`,
      );
      invObj.invoice.qr_code = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${qrPayload}`;
    } catch {}
    // Keep tax_summary at root for templates that iterate {{#each tax_summary}}.
    invObj.tax_summary = tax_summary;
    invObj.document = invObj.invoice;
    invObj.items = invObj.invoice.items;
    return invObj;
  }
  if (type === "purchase-order") {
    const [po] = await query(`
      SELECT 
        p.id, p.po_no, p.po_date, p.status, p.po_type,
        p.supplier_id, s.supplier_name, s.address AS supplier_address, s.phone AS supplier_phone, s.email AS supplier_email,
        p.currency, p.exchange_rate, p.warehouse_id, p.remarks, p.total_amount,
          p.created_at,
          u.username AS created_by_name
         FROM pur_orders p
      LEFT JOIN pur_suppliers s ON s.id = p.supplier_id
        LEFT JOIN adm_users u ON u.id = p.created_by
         WHERE p.id = :id AND p.company_id = :companyId AND p.branch_id = :branchId
      LIMIT 1
      `,
      { id, companyId, branchId },
    ).catch(() => []);
    if (!po) throw httpError(404, "NOT_FOUND", "Document not found");
    const details = await query(`
      SELECT d.id, d.item_id, d.qty, d.uom, d.unit_price, d.discount_percent, d.tax_percent, d.line_total, i.item_code, i.item_name,
          d.created_at,
          u.username AS created_by_name
         FROM pur_order_details d
      LEFT JOIN inv_items i ON i.id = d.item_id
        LEFT JOIN adm_users u ON u.id = d.created_by
         WHERE d.po_id = :id
      ORDER BY d.id ASC
      `,
      { id },
    ).catch(() => []);
    const [company] = await query(`
      SELECT id, name, address, city, state, postal_code, country, telephone, email, website,
          created_at,
          u.username AS created_by_name
         FROM adm_companies
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :companyId
      LIMIT 1
      `,
      { companyId },
    ).catch(() => []);
    const items = Array.isArray(details) ? details : [];
    const poObj = {
      company: company || {},
      supplier: {
        name: po.supplier_name,
        address: po.supplier_address || "",
        phone: po.supplier_phone || "",
        email: po.supplier_email || "",
      },
      purchase_order: {
        id: po.id,
        number: po.po_no,
        date: po.po_date ? String(po.po_date).slice(0, 10) : null,
        status: po.status,
        remarks: po.remarks || "",
        total: po.total_amount || 0,
        items: items.map((d) => ({
          name: d.item_name,
          description: d.item_name,
          code: d.item_code,
          quantity: d.qty,
          uom: d.uom,
          price: d.unit_price,
          discount: d.discount_percent || 0,
          tax: d.tax_percent || 0,
          amount:
            d.line_total != null
              ? d.line_total
              : Number(d.qty || 0) *
                Number(d.unit_price || 0) *
                (1 - Number(d.discount_percent || 0) / 100) *
                (1 + Number(d.tax_percent || 0) / 100),
        })),
      },
    };
    poObj.document = poObj.purchase_order;
    poObj.items = poObj.purchase_order.items;
    return poObj;
  }
  if (type === "direct-purchase") {
    const [hdr] = await query(`
      SELECT h.*, s.supplier_name, s.address AS supplier_address, s.phone AS supplier_phone, s.email AS supplier_email,
          h.created_at,
          u.username AS created_by_name
         FROM pur_direct_purchase_hdr h
      LEFT JOIN pur_suppliers s ON s.id = h.supplier_id
        LEFT JOIN adm_users u ON u.id = h.created_by
         WHERE h.id = :id AND h.company_id = :companyId AND h.branch_id = :branchId
      LIMIT 1
      `,
      { id, companyId, branchId },
    ).catch(() => []);
    if (!hdr) throw httpError(404, "NOT_FOUND", "Document not found");
    const details = await query(`
      SELECT d.id, d.item_id, d.qty, d.uom, d.unit_price, d.discount_percent, d.tax_percent, d.line_total, d.tax_code_id, i.item_code, i.item_name,
          d.created_at,
          u.username AS created_by_name
         FROM pur_direct_purchase_dtl d
      LEFT JOIN inv_items i ON i.id = d.item_id
        LEFT JOIN adm_users u ON u.id = d.created_by
         WHERE d.hdr_id = :id
      ORDER BY d.id ASC
      `,
      { id },
    ).catch(() => []);
    
    const tax_summary = await resolveTaxSummary(details || [], companyId);
    const [company] = await query(`
      SELECT id, name, address, city, state, postal_code, country, telephone, email, website,
          created_at,
          u.username AS created_by_name
         FROM adm_companies
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :companyId
      LIMIT 1
      `,
      { companyId },
    ).catch(() => []);
    const items = Array.isArray(details) ? details : [];
    const dpObj = {
      company: company || {},
      supplier: {
        name: hdr.supplier_name,
        address: hdr.supplier_address || "",
        phone: hdr.supplier_phone || "",
        email: hdr.supplier_email || "",
      },
      direct_purchase: {
        id: hdr.id,
        number: hdr.dp_no,
        date: hdr.dp_date ? String(hdr.dp_date).slice(0, 10) : null,
        status: hdr.status,
        remarks: hdr.remarks || "",
        total: hdr.net_amount || 0,
        items: items.map((d) => ({
          name: d.item_name,
          description: d.item_name,
          code: d.item_code,
          quantity: d.qty,
          uom: d.uom,
          price: d.unit_price,
          discount: d.discount_percent || 0,
          tax: d.tax_percent || 0,
          amount:
            d.line_total != null
              ? d.line_total
              : Number(d.qty || 0) * Number(d.unit_price || 0),
        })),
      },
    };
    dpObj.document = dpObj.direct_purchase;
    dpObj.items = dpObj.direct_purchase.items;
    return dpObj;
  }
  if (type === "purchase-bill") {
    const [hdr] = await query(`
      SELECT b.*, s.supplier_name, s.address AS supplier_address, s.phone AS supplier_phone, s.email AS supplier_email,
          b.created_at,
          u.username AS created_by_name
         FROM pur_bills b
      LEFT JOIN pur_suppliers s ON s.id = b.supplier_id
        LEFT JOIN adm_users u ON u.id = b.created_by
         WHERE b.id = :id AND b.company_id = :companyId AND b.branch_id = :branchId
      LIMIT 1
      `,
      { id, companyId, branchId },
    ).catch(() => []);
    if (!hdr) throw httpError(404, "NOT_FOUND", "Document not found");
    const details = await query(`
      SELECT d.id, d.item_id, d.qty, d.uom, d.unit_price, d.tax_percent, d.discount_percent, d.line_total, d.tax_code_id, i.item_code, i.item_name,
          d.created_at,
          u.username AS created_by_name
         FROM pur_bill_items d
      LEFT JOIN inv_items i ON i.id = d.item_id
        LEFT JOIN adm_users u ON u.id = d.created_by
         WHERE d.bill_id = :id
      ORDER BY d.id ASC
      `,
      { id },
    ).catch(() => []);
    
    const tax_summary = await resolveTaxSummary(details || [], companyId);
    const [company] = await query(`
      SELECT id, name, address, city, state, postal_code, country, telephone, email, website,
          created_at,
          u.username AS created_by_name
         FROM adm_companies
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :companyId
      LIMIT 1
      `,
      { companyId },
    ).catch(() => []);
    const items = Array.isArray(details) ? details : [];
    const billObj = {
      company: company || {},
      supplier: {
        name: hdr.supplier_name,
        address: hdr.supplier_address || "",
        phone: hdr.supplier_phone || "",
        email: hdr.supplier_email || "",
      },
      purchase_bill: {
        id: hdr.id,
        number: hdr.bill_no,
        date: hdr.bill_date ? String(hdr.bill_date).slice(0, 10) : null,
        status: hdr.status,
        remarks: hdr.remarks || "",
        total: hdr.net_amount || hdr.total_amount || 0,
        tax_summary,
        items: items.map((d) => ({
          name: d.item_name,
          description: d.item_name,
          code: d.item_code,
          quantity: d.qty,
          uom: d.uom,
          price: d.unit_price,
          discount: d.discount_percent || 0,
          tax: d.tax_percent || 0,
          amount:
            d.line_total != null
              ? d.line_total
              : Number(d.qty || 0) *
                Number(d.unit_price || 0) *
                (1 - Number(d.discount_percent || 0) / 100) *
                (1 + Number(d.tax_percent || 0) / 100),
        })),
      },
    };
    billObj.document = billObj.purchase_bill;
    billObj.items = billObj.purchase_bill.items;
    return billObj;
  }
  if (type === "grn") {
    const [hdr] = await query(`
      SELECT g.*, s.supplier_name, s.address AS supplier_address, s.phone AS supplier_phone, s.email AS supplier_email,
          g.created_at,
          u.username AS created_by_name
         FROM inv_goods_receipt_notes g
      LEFT JOIN pur_suppliers s ON s.id = g.supplier_id
        LEFT JOIN adm_users u ON u.id = g.created_by
         WHERE g.id = :id AND g.company_id = :companyId AND g.branch_id = :branchId
      LIMIT 1
      `,
      { id, companyId, branchId },
    ).catch(() => []);
    if (!hdr) throw httpError(404, "NOT_FOUND", "Document not found");
    const details = await query(`
      SELECT d.id, d.item_id, d.qty_ordered, d.qty_received, d.qty_accepted, d.uom, d.unit_price, d.line_amount, i.item_code, i.item_name,
          d.created_at,
          u.username AS created_by_name
         FROM inv_goods_receipt_note_details d
      LEFT JOIN inv_items i ON i.id = d.item_id
        LEFT JOIN adm_users u ON u.id = d.created_by
         WHERE d.grn_id = :id
      ORDER BY d.id ASC
      `,
      { id },
    ).catch(() => []);
    const [company] = await query(`
      SELECT id, name, address, city, state, postal_code, country, telephone, email, website,
          created_at,
          u.username AS created_by_name
         FROM adm_companies
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :companyId
      LIMIT 1
      `,
      { companyId },
    ).catch(() => []);
    const items = Array.isArray(details) ? details : [];
    const grnObj = {
      company: company || {},
      supplier: {
        name: hdr.supplier_name,
        address: hdr.supplier_address || "",
        phone: hdr.supplier_phone || "",
        email: hdr.supplier_email || "",
      },
      grn: {
        id: hdr.id,
        number: hdr.grn_no,
        date: hdr.grn_date ? String(hdr.grn_date).slice(0, 10) : null,
        status: hdr.status,
        remarks: hdr.remarks || "",
        total: hdr.net_amount || 0,
        items: items.map((d) => ({
          name: d.item_name,
          description: d.item_name,
          code: d.item_code,
          ordered: d.qty_ordered,
          received: d.qty_received,
          accepted: d.qty_accepted,
          uom: d.uom,
          price: d.unit_price,
          amount:
            d.line_amount != null
              ? d.line_amount
              : Number(d.qty_accepted || 0) * Number(d.unit_price || 0),
        })),
      },
    };
    grnObj.document = grnObj.grn;
    grnObj.items = grnObj.grn.items;
    return grnObj;
  }
  if (type === "delivery-note") {
    const [dn] = await query(`
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
        d.remarks,
        d.delivery_instructions,
        d.terms_and_conditions,
        d.total_tax,
        d.invoice_amount,
          d.created_at,
          u.username AS created_by_name
         FROM sal_deliveries d
      LEFT JOIN sal_customers c
        ON c.id = d.customer_id AND c.company_id = d.company_id
        LEFT JOIN adm_users u ON u.id = d.created_by
         WHERE d.id = :id AND d.company_id = :companyId AND d.branch_id = :branchId
      LIMIT 1
      `,
      { id, companyId, branchId },
    ).catch(() => []);
    if (!dn) throw httpError(404, "NOT_FOUND", "Document not found");
    let employee = null;
    if (dn.created_by) {
      const [u] = await query(`
        SELECT id, username, email, full_name,
          created_at,
          u.username AS created_by_name
         FROM adm_users
        LEFT JOIN adm_users u ON u.id = created_by
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
    const details = await query(`
      SELECT
        dd.id,
        dd.item_id,
        dd.quantity,
        dd.unit_price,
        dd.uom,
        it.item_code,
        it.item_name,
          dd.created_at,
          u.username AS created_by_name
         FROM sal_delivery_details dd
      LEFT JOIN inv_items it
        ON it.id = dd.item_id AND it.company_id = :companyId
        LEFT JOIN adm_users u ON u.id = dd.created_by
         WHERE dd.delivery_id = :id
      ORDER BY dd.id ASC
      `,
      { id, companyId },
    ).catch(() => []);
    const [company] = await query(`
      SELECT id, name, address, city, state, postal_code, country, telephone, email, website,
          created_at,
          u.username AS created_by_name
         FROM adm_companies
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :companyId
      LIMIT 1
      `,
      { companyId },
    ).catch(() => []);
    const dnExtra = await query(`
      SELECT 
        COALESCE(i.currency_id, o.currency_id) AS currency_id,
        COALESCE(i.exchange_rate, o.exchange_rate) AS exchange_rate,
        COALESCE(i.price_type, o.price_type) AS price_type,
        COALESCE(i.payment_type, o.payment_type) AS payment_type,
        COALESCE(i.warehouse_id, o.warehouse_id) AS warehouse_id,
          d.created_at,
          u.username AS created_by_name
         FROM sal_deliveries d
      LEFT JOIN sal_invoices i ON i.id = d.invoice_id AND i.company_id = d.company_id
      LEFT JOIN sal_orders o ON o.id = d.sales_order_id AND o.company_id = d.company_id
        LEFT JOIN adm_users u ON u.id = d.created_by
         WHERE d.id = :id
      LIMIT 1
      `,
      { id },
    ).catch(() => []);
    const ex = dnExtra?.[0] || {};
    const extra = await query(`
      SELECT 
        w.warehouse_name,
        cur.code AS currency_code,
          ac.created_at,
          u.username AS created_by_name
         FROM adm_companies ac
      LEFT JOIN inv_warehouses w
        ON w.id = :wid AND w.company_id = ac.id
      LEFT JOIN fin_currencies cur
        ON cur.id = :cid
        LEFT JOIN adm_users u ON u.id = ac.created_by
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
    let orderMeta = {};
    if (dn.sales_order_id) {
      const [ord] = await query(`
        SELECT order_no, vehicle_number, driver_name, delivery_instructions,
          created_at,
          u.username AS created_by_name
         FROM sal_orders
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :oid AND company_id = :companyId
        LIMIT 1
        `,
        { oid: dn.sales_order_id, companyId },
      ).catch(() => []);
      if (ord) orderMeta = ord;
    }
    let invoiceMeta = {};
    if (dn.invoice_id) {
      const [invh] = await query(`
        SELECT invoice_no,
          created_at,
          u.username AS created_by_name
         FROM sal_invoices
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :iid AND company_id = :companyId
        LIMIT 1
        `,
        { iid: dn.invoice_id, companyId },
      ).catch(() => []);
      if (invh) invoiceMeta = invh;
    }
    let orderedQtyMap = new Map();
    if (dn.sales_order_id) {
      const ordRows = await query(`
        SELECT item_id, qty,
          created_at,
          u.username AS created_by_name
         FROM sal_order_details
        LEFT JOIN adm_users u ON u.id = created_by
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
        qr_code: `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`DELIVERY|${dn.id}|${dn.delivery_no || ""}|${dn.delivery_date || ""}|${dn.customer_name || ""}`)}`,
        order_number: orderMeta?.order_no || null,
        vehicle_number: orderMeta?.vehicle_number || null,
        driver_name: orderMeta?.driver_name || null,
        invoice_ref: invoiceMeta?.invoice_no || null,
        instructions: dn.delivery_instructions || orderMeta?.delivery_instructions || null,
        terms_and_conditions: dn.terms_and_conditions || null,
        total_tax: dn.total_tax || 0,
        invoice_amount: dn.invoice_amount || 0,
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
  if (type === "purchase-order") {
    const [po] = await query(`
      SELECT h.*, s.supplier_name, s.address AS supplier_address, s.email AS supplier_email, s.telephone AS supplier_phone,
          h.created_at,
          u.username AS created_by_name
         FROM pur_orders h
      LEFT JOIN pur_suppliers s ON s.id = h.supplier_id
        LEFT JOIN adm_users u ON u.id = h.created_by
         WHERE h.id = :id AND h.company_id = :companyId AND h.branch_id = :branchId
      LIMIT 1
      `,
      { id, companyId, branchId },
    ).catch(() => []);
    if (!po) throw httpError(404, "NOT_FOUND", "Purchase Order not found");
    const details = await query(`
      SELECT d.*, it.item_code, it.item_name,
          d.created_at,
          u.username AS created_by_name
         FROM pur_order_details d
      LEFT JOIN inv_items it ON it.id = d.item_id
        LEFT JOIN adm_users u ON u.id = d.created_by
         WHERE d.order_id = :id
      ORDER BY d.id ASC
      `,
      { id },
    ).catch(() => []);
    
    const tax_summary = await resolveTaxSummary(details || [], companyId);

    const [company] = await query(`SELECT *,
          created_at,
          u.username AS created_by_name
         FROM adm_companies
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :companyId LIMIT 1`,
      { companyId },
    ).catch(() => []);
    const poObj = {
      company: company || {},
      supplier: {
        name: po.supplier_name,
        address: po.supplier_address,
        email: po.supplier_email,
        phone: po.supplier_phone,
      },
      purchase_order: {
        id: po.id,
        number: po.po_no,
        date: po.po_date,
        status: po.status,
        currency: po.currency_id,
        exchange_rate: po.exchange_rate,
        sub_total: po.sub_total,
        tax_amount: po.tax_amount,
        total: po.total_amount,
        remarks: po.remarks,
        tax_summary,
        items: (details || []).map((d) => ({
          code: d.item_code,
          name: d.item_name,
          quantity: d.qty,
          uom: d.uom,
          price: d.unit_price,
          discount: d.discount_percent,
          tax: d.tax_amount,
          amount: d.line_total,
        })),
      },
    };
    poObj.document = poObj.purchase_order;
    poObj.items = poObj.purchase_order.items;
    return poObj;
  }
  if (type === "grn") {
    const [grn] = await query(`
      SELECT h.*, s.supplier_name, s.address AS supplier_address, s.email AS supplier_email, s.telephone AS supplier_phone,
          h.created_at,
          u.username AS created_by_name
         FROM inv_grn h
      LEFT JOIN pur_suppliers s ON s.id = h.supplier_id
        LEFT JOIN adm_users u ON u.id = h.created_by
         WHERE h.id = :id AND h.company_id = :companyId AND h.branch_id = :branchId
      LIMIT 1
      `,
      { id, companyId, branchId },
    ).catch(() => []);
    if (!grn) throw httpError(404, "NOT_FOUND", "GRN not found");
    const details = await query(`
      SELECT d.*, it.item_code, it.item_name,
          d.created_at,
          u.username AS created_by_name
         FROM inv_grn_details d
      LEFT JOIN inv_items it ON it.id = d.item_id
        LEFT JOIN adm_users u ON u.id = d.created_by
         WHERE d.grn_id = :id
      ORDER BY d.id ASC
      `,
      { id },
    ).catch(() => []);
    const [company] = await query(`SELECT *,
          created_at,
          u.username AS created_by_name
         FROM adm_companies
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :companyId LIMIT 1`,
      { companyId },
    ).catch(() => []);
    const grnObj = {
      company: company || {},
      supplier: {
        name: grn.supplier_name,
        address: grn.supplier_address,
        email: grn.supplier_email,
        phone: grn.supplier_phone,
      },
      grn: {
        id: grn.id,
        number: grn.grn_no,
        date: grn.grn_date,
        status: grn.status,
        remarks: grn.remarks,
        delivery_no: grn.delivery_number,
        items: (details || []).map((d) => ({
          code: d.item_code,
          name: d.item_name,
          quantity: d.qty,
          uom: d.uom,
          price: d.unit_price,
          amount: d.amount,
          batch: d.batch_serial,
        })),
      },
    };
    grnObj.document = grnObj.grn;
    grnObj.items = grnObj.grn.items;
    return grnObj;
  }
  if (type === "purchase-bill") {
    const [bill] = await query(`
      SELECT h.*, s.supplier_name, s.address AS supplier_address, s.email AS supplier_email, s.telephone AS supplier_phone,
          h.created_at,
          u.username AS created_by_name
         FROM pur_bills h
      LEFT JOIN pur_suppliers s ON s.id = h.supplier_id
        LEFT JOIN adm_users u ON u.id = h.created_by
         WHERE h.id = :id AND h.company_id = :companyId AND h.branch_id = :branchId
      LIMIT 1
      `,
      { id, companyId, branchId },
    ).catch(() => []);
    if (!bill) throw httpError(404, "NOT_FOUND", "Purchase Bill not found");
    const details = await query(`
      SELECT d.*, it.item_code, it.item_name,
          d.created_at,
          u.username AS created_by_name
         FROM pur_bill_details d
      LEFT JOIN inv_items it ON it.id = d.item_id
        LEFT JOIN adm_users u ON u.id = d.created_by
         WHERE d.bill_id = :id
      ORDER BY d.id ASC
      `,
      { id },
    ).catch(() => []);
    const [company] = await query(`SELECT *,
          created_at,
          u.username AS created_by_name
         FROM adm_companies
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :companyId LIMIT 1`,
      { companyId },
    ).catch(() => []);
    const billObj = {
      company: company || {},
      supplier: {
        name: bill.supplier_name,
        address: bill.supplier_address,
        email: bill.supplier_email,
        phone: bill.supplier_phone,
      },
      purchase_bill: {
        id: bill.id,
        number: bill.bill_no,
        date: bill.bill_date ? String(bill.bill_date).slice(0, 10) : null,
        status: bill.status,
        sub_total: bill.sub_total,
        tax_amount: bill.tax_amount,
        total: bill.net_amount,
        remarks: bill.remarks,
        items: (details || []).map((d) => ({
          code: d.item_code,
          name: d.item_name,
          quantity: d.qty,
          uom: d.uom,
          price: d.unit_price,
          discount: d.discount_percent,
          tax: d.tax_amount,
          amount: d.line_total,
        })),
      },
    };
    billObj.document = billObj.purchase_bill;
    billObj.items = billObj.purchase_bill.items;
    return billObj;
  }
  if (type === "direct-purchase") {
    const [dp] = await query(`
      SELECT h.*, s.supplier_name, s.address AS supplier_address, s.email AS supplier_email, s.telephone AS supplier_phone,
          h.created_at,
          u.username AS created_by_name
         FROM pur_direct_purchase_hdr h
      LEFT JOIN pur_suppliers s ON s.id = h.supplier_id
        LEFT JOIN adm_users u ON u.id = h.created_by
         WHERE h.id = :id AND h.company_id = :companyId AND h.branch_id = :branchId
      LIMIT 1
      `,
      { id, companyId, branchId },
    ).catch(() => []);
    if (!dp) throw httpError(404, "NOT_FOUND", "Direct Purchase not found");
    const details = await query(`
      SELECT d.*, it.item_code, it.item_name,
          d.created_at,
          u.username AS created_by_name
         FROM pur_direct_purchase_dtl d
      LEFT JOIN inv_items it ON it.id = d.item_id
        LEFT JOIN adm_users u ON u.id = d.created_by
         WHERE d.hdr_id = :id
      ORDER BY d.id ASC
      `,
      { id },
    ).catch(() => []);
    const [company] = await query(`SELECT *,
          created_at,
          u.username AS created_by_name
         FROM adm_companies
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :companyId LIMIT 1`,
      { companyId },
    ).catch(() => []);
    const dpObj = {
      company: company || {},
      supplier: {
        name: dp.supplier_name,
        address: dp.supplier_address,
        email: dp.supplier_email,
        phone: dp.supplier_phone,
      },
      direct_purchase: {
        id: dp.id,
        number: dp.dp_no,
        date: dp.dp_date,
        status: dp.status,
        sub_total: dp.subtotal,
        tax_amount: dp.tax_amount,
        total: dp.net_amount,
        remarks: dp.remarks,
        items: (details || []).map((d) => ({
          code: d.item_code,
          name: d.item_name,
          quantity: d.qty,
          uom: d.uom,
          price: d.unit_price,
          discount: d.discount_percent,
          tax: d.tax_percent,
          amount: d.line_total,
        })),
      },
    };
    dpObj.document = dpObj.direct_purchase;
    dpObj.items = dpObj.direct_purchase.items;
    return dpObj;
  }
  if (type === "quotation") {
    const [q] = await query(`
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
        COALESCE(c.email, '') AS customer_email,
          q.created_at,
          u.username AS created_by_name
         FROM sal_quotations q
      LEFT JOIN sal_customers c
        ON c.id = q.customer_id AND c.company_id = q.company_id
        LEFT JOIN adm_users u ON u.id = q.created_by
         WHERE q.id = :id AND q.company_id = :companyId AND q.branch_id = :branchId
      LIMIT 1
      `,
      { id, companyId, branchId },
    ).catch(() => []);
    if (!q) throw httpError(404, "NOT_FOUND", "Document not found");
    let employee = null;
    if (q.created_by) {
      const [u] = await query(`
        SELECT id, username, email, full_name,
          created_at,
          u.username AS created_by_name
         FROM adm_users
        LEFT JOIN adm_users u ON u.id = created_by
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
    const details = await query(`
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
        d.tax_type AS tax_code_id,
        it.item_code,
        it.item_name,
          d.created_at,
          u.username AS created_by_name
         FROM sal_quotation_details d
      LEFT JOIN inv_items it
        ON it.id = d.item_id AND it.company_id = :companyId
        LEFT JOIN adm_users u ON u.id = d.created_by
         WHERE d.quotation_id = :id
      ORDER BY d.id ASC
      `,
      { id, companyId },
    ).catch(() => []);

    const tax_summary = await resolveTaxSummary(details, companyId);
    const [company] = await query(`
      SELECT id, name, address, city, state, postal_code, country, telephone, email, website,
          created_at,
          u.username AS created_by_name
         FROM adm_companies
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :companyId
      LIMIT 1
      `,
      { companyId },
    ).catch(() => []);
    const extra = await query(`
      SELECT 
        w.warehouse_name,
        cur.code AS currency_code,
          ac.created_at,
          u.username AS created_by_name
         FROM adm_companies ac
      LEFT JOIN inv_warehouses w
        ON w.id = :wid AND w.company_id = ac.id
      LEFT JOIN fin_currencies cur
        ON cur.id = :cid
        LEFT JOIN adm_users u ON u.id = ac.created_by
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
        tax_summary,
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
    try {
      const qrPayload = encodeURIComponent(
        `QUOTATION|${q.id}|${q.quotation_no || ""}|${q.quotation_date || ""}|${q.customer_name || ""}|${q.total_amount || ""}`,
      );
      qObj.quotation.qr_code = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${qrPayload}`;
    } catch {}
    // Keep tax_summary at root for templates that iterate {{#each tax_summary}}.
    qObj.tax_summary = tax_summary;
    qObj.document = qObj.quotation;
    qObj.quote = qObj.quotation;
    qObj.items = qObj.quotation.items;
    return qObj;
  }
  if (type === "payment-voucher") {
    const [voucher] = await query(`
      SELECT 
        v.id,
        v.voucher_no,
        v.voucher_date,
        v.narration,
        v.total_debit,
        v.total_credit,
        v.created_by,
        vt.code AS voucher_type_code,
        vt.name AS voucher_type_name,
          v.created_at,
          u.username AS created_by_name
         FROM fin_vouchers v
      JOIN fin_voucher_types vt ON vt.id = v.voucher_type_id
        LEFT JOIN adm_users u ON u.id = v.created_by
         WHERE v.id = :id AND v.company_id = :companyId AND v.branch_id = :branchId
      LIMIT 1
      `,
      { id, companyId, branchId },
    ).catch(() => []);
    if (!voucher) throw httpError(404, "NOT_FOUND", "Document not found");
    let employee = null;
    if (voucher.created_by) {
      const [u] = await query(`
        SELECT id, username, email, full_name,
          created_at,
          u.username AS created_by_name
         FROM adm_users
        LEFT JOIN adm_users u ON u.id = created_by
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
    const lines = await query(`
      SELECT 
        l.id,
        l.line_no,
        a.code AS account_code,
        a.name AS account_name,
        l.description,
        l.debit,
        l.credit,
        l.reference_no,
          l.created_at,
          u.username AS created_by_name
         FROM fin_voucher_lines l
      LEFT JOIN fin_accounts a ON a.id = l.account_id
        LEFT JOIN adm_users u ON u.id = l.created_by
         WHERE l.voucher_id = :id
      ORDER BY l.line_no ASC
      `,
      { id },
    ).catch(() => []);
    const [company] = await query(`SELECT id, name, address, city, state, postal_code, country, telephone, email, website,
          created_at,
          u.username AS created_by_name
         FROM adm_companies
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :companyId LIMIT 1`,
      { companyId },
    ).catch(() => []);
    const voucherObj = {
      company: company || {},
      employee: employee || undefined,
      prepared_by: employee?.username || employee?.name || undefined,
      payment_voucher: {
        id: voucher.id,
        number: voucher.voucher_no,
        date: voucher.voucher_date
          ? String(voucher.voucher_date).slice(0, 10)
          : null,
        narration: voucher.narration,
        total_debit: voucher.total_debit,
        total_credit: voucher.total_credit,
        type_code: voucher.voucher_type_code,
        type_name: voucher.voucher_type_name,
        items: (lines || []).map((l) => ({
          account_code: l.account_code,
          account_name: l.account_name,
          description: l.description,
          debit: l.debit,
          credit: l.credit,
          reference_no: l.reference_no,
        })),
      },
    };
    try {
      const qrPayload = encodeURIComponent(
        `${voucher.voucher_type_name.toUpperCase()}|${voucher.id}|${voucher.voucher_no || ""}|${voucher.voucher_date || ""}|${voucher.total_credit || voucher.total_debit || ""}`,
      );
      voucherObj.payment_voucher.qr_code = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${qrPayload}`;
    } catch {}
    voucherObj.document = voucherObj.payment_voucher;
    voucherObj.voucher = voucherObj.payment_voucher;
    voucherObj.items = voucherObj.payment_voucher.items;
    return voucherObj;
  }
  if (type === "salary-slip") {
    const [payslip] = await query(`
      SELECT
        p.id, p.period_id, p.status, p.paid_at, p.remarks,
        p.basic_salary, p.allowances, p.deductions, p.net_salary,
        p.ssf_employee, p.tier3_employee, p.income_tax, p.loan_deductions_total,
        p.working_days, p.days_present, p.leave_taken,
        e.emp_code, e.first_name, e.last_name, e.email, e.joining_date,
        e.ssnit_no, e.tin, e.bank_name, e.bank_account_no,
        d.dept_name AS dept_name,
        b.name AS branch_name,
        pos.pos_name AS position_name,
        per.period_name AS period_name,
          p.created_at,
          u.username AS created_by_name
         FROM hr_payslips p
      JOIN hr_employees e ON e.id = p.employee_id AND e.company_id = :companyId
      LEFT JOIN hr_departments d ON d.id = e.dept_id
      LEFT JOIN adm_branches b ON b.id = e.branch_id
      LEFT JOIN hr_positions pos ON pos.id = e.pos_id
      LEFT JOIN hr_payroll_periods per ON per.id = p.period_id
        LEFT JOIN adm_users u ON u.id = p.created_by
         WHERE p.id = :id AND e.company_id = :companyId
      LIMIT 1
      `,
      { id, companyId },
    ).catch(() => []);
    if (!payslip) throw httpError(404, "NOT_FOUND", "Payslip not found");
    const [company] = await query(`SELECT id, name, address, address2, city, state, postal_code, country, telephone, email, website, logo,
          created_at,
          u.username AS created_by_name
         FROM adm_companies
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :companyId LIMIT 1`,
      { companyId },
    ).catch(() => []);

    let earnings = [];
    if (Number(payslip.basic_salary) > 0) {
      earnings.push({
        label: "Basic Salary",
        amount: Number(payslip.basic_salary),
      });
    }
    if (Number(payslip.allowances) > 0) {
      earnings.push({
        label: "Allowances",
        amount: Number(payslip.allowances),
      });
    }

    let deductions = [];
    if (Number(payslip.ssf_employee) > 0) {
      deductions.push({
        label: "SSF (Emp)",
        amount: Number(payslip.ssf_employee),
      });
    }
    if (Number(payslip.tier3_employee) > 0) {
      deductions.push({
        label: "Tier 3",
        amount: Number(payslip.tier3_employee),
      });
    }
    if (Number(payslip.income_tax) > 0) {
      deductions.push({
        label: "PAYE Tax",
        amount: Number(payslip.income_tax),
      });
    }
    if (Number(payslip.loan_deductions_total) > 0) {
      deductions.push({
        label: "Loan Deductions",
        amount: Number(payslip.loan_deductions_total),
      });
    }

    earnings = earnings.filter((e) => e.amount > 0);
    deductions = deductions.filter((d) => d.amount > 0);

    const maxLen = Math.max(earnings.length, deductions.length);
    const rows = [];
    for (let i = 0; i < maxLen; i++) {
      rows.push({
        earning_label: earnings[i] ? earnings[i].label : "",
        earning_amount: earnings[i] ? earnings[i].amount.toFixed(2) : "",
        deduction_label: deductions[i] ? deductions[i].label : "",
        deduction_amount: deductions[i] ? deductions[i].amount.toFixed(2) : "",
      });
    }

    const qrData = JSON.stringify({
      id: payslip.id,
      emp: payslip.emp_code,
      period: payslip.period_id,
      net: payslip.net_salary,
    });
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}`;

    return {
      company: company || {},
      employee: {
        id: payslip.emp_code || "-",
        name: `${payslip.first_name || ""} ${payslip.last_name || ""}`.trim(),
        code: payslip.emp_code || "-",
        email: payslip.email || "-",
        department: payslip.dept_name || "-",
        branch: payslip.branch_name || "-",
        designation: payslip.position_name || "-",
        job_title: payslip.position_name || "-",
        joining_date: payslip.joining_date
          ? String(payslip.joining_date).slice(0, 10)
          : null,
        ssnit_no: payslip.ssnit_no || "-",
        tin: payslip.tin || "-",
        bank_name: payslip.bank_name || "-",
        bank_account: payslip.bank_account_no || "-",
        bank_account_no: payslip.bank_account_no || "-",
      },
      payslip: {
        id: payslip.id,
        period_name: payslip.period_name,
        paid_at: payslip.paid_at,
        basic_salary: Number(payslip.basic_salary || 0).toFixed(2),
        allowances: Number(payslip.allowances || 0).toFixed(2),
        deductions: Number(payslip.deductions || 0).toFixed(2),
        gross_pay: (
          Number(payslip.basic_salary || 0) + Number(payslip.allowances || 0)
        ).toFixed(2),
        net_salary: Number(payslip.net_salary || 0).toFixed(2),
        net_in_words: "",
        status: payslip.status,
        working_days: payslip.working_days || 0,
        days_present: payslip.days_present || 0,
        leave_taken: payslip.leave_taken || 0,
        remarks: payslip.remarks || "-",
        qr_code: qrCodeUrl,
        rows: rows,
        has_earnings: earnings.length > 0,
        has_deductions: deductions.length > 0,
      },
      salary_slip: {
        pay_period: payslip.period_name,
        pay_date: payslip.paid_at,
        earnings: earnings.map((e) => ({
          name: String(e.label || ""),
          amount: Number(e.amount || 0).toFixed(2),
        })),
        deductions: deductions.map((d) => ({
          name: String(d.label || ""),
          amount: Number(d.amount || 0).toFixed(2),
        })),
        total_earnings: (
          Number(payslip.basic_salary || 0) + Number(payslip.allowances || 0)
        ).toFixed(2),
        total_deductions: Number(payslip.deductions || 0).toFixed(2),
        net_pay: Number(payslip.net_salary || 0).toFixed(2),
        net_pay_in_words: "",
      },
    };
  }
  if (type === "maintenance-bill") {
    const [hdr] = await query(`
      SELECT b.*, s.supplier_name, s.address AS supplier_address, s.phone AS supplier_phone, s.email AS supplier_email,
          b.created_at,
          u.username AS created_by_name
         FROM maint_bills b
      LEFT JOIN pur_suppliers s ON s.id = b.supplier_id
        LEFT JOIN adm_users u ON u.id = b.created_by
         WHERE b.id = :id AND b.company_id = :companyId AND b.branch_id = :branchId
      LIMIT 1
      `,
      { id, companyId, branchId },
    ).catch(() => []);
    if (!hdr) throw httpError(404, "NOT_FOUND", "Document not found");
    const details = await query(`SELECT *,
          created_at,
          u.username AS created_by_name
         FROM maint_bill_lines
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE bill_id = :id ORDER BY id ASC`,
      { id },
    ).catch(() => []);
    const [company] = await query(`SELECT *,
          created_at,
          u.username AS created_by_name
         FROM adm_companies
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :companyId LIMIT 1`,
      { companyId },
    ).catch(() => []);
    const tax_summary = await resolveTaxSummary(details || [], companyId);
    return {
      company: company || {},
      supplier: {
        name: hdr.supplier_name,
        address: hdr.supplier_address || "",
        phone: hdr.supplier_phone || "",
        email: hdr.supplier_email || "",
      },
      maintenance_bill: {
        id: hdr.id,
        number: hdr.bill_no,
        date: hdr.bill_date ? String(hdr.bill_date).slice(0, 10) : null,
        status: hdr.status,
        remarks: hdr.notes || "",
        sub_total: hdr.subtotal || 0,
        tax_amount: hdr.tax_amount || 0,
        total: hdr.total_amount || 0,
        tax_summary,
        items: (details || []).map((d) => ({
          name: d.description,
          description: d.description,
          code: d.category || "SERVICE",
          quantity: d.qty,
          price: d.rate,
          discount: d.discount_percent || 0,
          amount: d.amount,
        })),
      },
    };
  }
  if (type === "service-bill") {
    const [hdr] = await query(`
      SELECT b.*,
          b.created_at,
          u.username AS created_by_name
         FROM pur_service_bills b
        LEFT JOIN adm_users u ON u.id = b.created_by
         WHERE b.id = :id AND b.company_id = :companyId AND b.branch_id = :branchId
      LIMIT 1
      `,
      { id, companyId, branchId },
    ).catch(() => []);
    if (!hdr) throw httpError(404, "NOT_FOUND", "Document not found");
    const details = await query(`SELECT *,
          created_at,
          u.username AS created_by_name
         FROM pur_service_bill_details
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE bill_id = :id ORDER BY id ASC`,
      { id },
    ).catch(() => []);
    const [company] = await query(`SELECT *,
          created_at,
          u.username AS created_by_name
         FROM adm_companies
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :companyId LIMIT 1`,
      { companyId },
    ).catch(() => []);
    const tax_summary = await resolveTaxSummary(details || [], companyId);
    return {
      company: company || {},
      client: {
        name: hdr.client_name,
        company: hdr.client_company,
        address: hdr.client_address,
        phone: hdr.client_phone,
        email: hdr.client_email,
      },
      service_bill: {
        id: hdr.id,
        number: hdr.bill_no,
        date: hdr.bill_date ? String(hdr.bill_date).slice(0, 10) : null,
        status: hdr.status,
        remarks: hdr.notes || "",
        sub_total: hdr.subtotal || 0,
        tax_amount: hdr.tax_amount || 0,
        total: hdr.total_amount || 0,
        tax_summary,
        items: (details || []).map((d) => ({
          name: d.description,
          description: d.description,
          code: d.category || "SERVICE",
          quantity: d.qty,
          price: d.rate,
          discount: d.discount_percent || 0,
          amount: d.amount,
        })),
      },
    };
  }
  if (type === "supplier-quotation") {
    const [hdr] = await query(`
      SELECT q.*, s.supplier_name, s.address AS supplier_address, s.phone AS supplier_phone, s.email AS supplier_email,
          q.created_at,
          u.username AS created_by_name
         FROM maint_supplier_quotations q
      LEFT JOIN pur_suppliers s ON s.id = q.supplier_id
        LEFT JOIN adm_users u ON u.id = q.created_by
         WHERE q.id = :id AND q.company_id = :companyId AND q.branch_id = :branchId
      LIMIT 1
      `,
      { id, companyId, branchId },
    ).catch(() => []);
    if (!hdr) throw httpError(404, "NOT_FOUND", "Document not found");
    const details = await query(`SELECT *,
          created_at,
          u.username AS created_by_name
         FROM maint_quotation_lines
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE quotation_id = :id ORDER BY id ASC`,
      { id },
    ).catch(() => []);
    const [company] = await query(`SELECT *,
          created_at,
          u.username AS created_by_name
         FROM adm_companies
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :companyId LIMIT 1`,
      { companyId },
    ).catch(() => []);
    const tax_summary = await resolveTaxSummary(details || [], companyId);
    return {
      company: company || {},
      supplier: {
        name: hdr.supplier_name,
        address: hdr.supplier_address || "",
        phone: hdr.supplier_phone || "",
        email: hdr.supplier_email || "",
      },
      supplier_quotation: {
        id: hdr.id,
        number: hdr.quotation_no,
        date: hdr.quotation_date ? String(hdr.quotation_date).slice(0, 10) : null,
        status: hdr.status,
        remarks: hdr.notes || "",
        sub_total: hdr.subtotal || 0,
        tax_amount: hdr.tax_amount || 0,
        total: hdr.total_amount || 0,
        tax_summary,
        items: (details || []).map((d) => ({
          name: d.description,
          description: d.description,
          code: "SERVICE",
          quantity: d.qty,
          price: d.rate,
          discount: d.discount_percent || 0,
          amount: d.amount,
        })),
      },
    };
  }
  throw httpError(400, "VALIDATION_ERROR", "Unsupported document type");
}

// ─── GET /:type/:id ──────────────────────────────────────────────────────────
router.get(
  "/:type/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureTemplateTables();
      const { companyId, branchId } = req.scope;
      const type = canonicalDocumentType(String(req.params.type || "").trim());
      const id = toNumber(req.params.id);
      if (!type || !id)
        throw httpError(400, "VALIDATION_ERROR", "Invalid request");

      const templateId = req.query?.template_id
        ? Number(req.query.template_id)
        : req.body?.template_id
          ? Number(req.body.template_id)
          : null;

      let tplObj = null;

      // Explicit template override
      if (templateId && Number.isFinite(templateId)) {
        const [row] = await query(`SELECT id, html_content,
                  header_logo_url, header_name, header_address, header_address2, header_phone, header_email, header_website,
                  document_type,
          created_at,
          u.username AS created_by_name
         FROM document_templates
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :id AND company_id = :companyId
           LIMIT 1`,
          { id: templateId, companyId },
        ).catch(() => []);
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

      // Priority name lookup for specific types
      if (!tplObj) {
        const canonical = canonicalDocumentType(type);
        if (canonical === "payment-voucher" || canonical === "sales-order") {
          const priorityName =
            canonical === "payment-voucher"
              ? "Default payment-voucher"
              : "Sales Order";
          const [namedRow] = await query(`SELECT id, html_content,
                    header_logo_url, header_name, header_address, header_address2, header_phone, header_email, header_website,
                    document_type,
          created_at,
          u.username AS created_by_name
         FROM document_templates
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE name = :priorityName AND company_id = :companyId
             LIMIT 1`,
            { priorityName, companyId },
          ).catch(() => []);
          if (namedRow) tplObj = namedRow;
        }
      }

      // Strict name-based template selection for key document types
      // Always prefer templates with exact names for these document types
      const nameMap = {
        "sales-order": "Sales Order",
        invoice: "Invoice",
        "delivery-note": "Delivery Note",
        "salary-slip": "Salary Slip",
        "payment-voucher": "Payment voucher",
        "receipt-voucher": "Receipt Voucher",
        "purchase-bill": "Purchase Bill",
        grn: "Goods Receipt Note",
        "general-template": "Default General Template",
        "purchase-order": "Purchase Order",
        "direct-purchase": "Direct Purchase",
      };
      const strictName = nameMap[type] || null;

      // Always try to get the strict-named template, even if we already found another template
      if (strictName) {
        const [rowByName] = await query(`SELECT id, html_content,
                  header_logo_url, header_name, header_address, header_address2, header_phone, header_email, header_website,
                  document_type, name,
          created_at,
          u.username AS created_by_name
         FROM document_templates
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId AND LOWER(TRIM(name)) = LOWER(TRIM(:strictName))
           ORDER BY updated_at DESC, id DESC
           LIMIT 1`,
          { companyId, strictName },
        ).catch(() => []);
        if (rowByName) {
          tplObj = rowByName;
        } else {
          const fmt = String(
            req.query.format || req.body?.format || "html",
          ).toLowerCase();
          if (fmt === "pdf") {
            let browser = null;
            try {
              browser = await launchBrowser();
              const page = await browser.newPage();
              await page.setContent(
                "<!DOCTYPE html><html><head></head><body></body></html>",
                { waitUntil: "domcontentloaded" },
              );
              const pdf = await page.pdf({
                printBackground: true,
                preferCSSPageSize: true,
                margin: { top: "0", bottom: "0", left: "0", right: "0" },
              });
              res.setHeader("Content-Type", "application/pdf");
              res.setHeader(
                "Content-Length",
                Buffer.byteLength(Buffer.from(pdf)),
              );
              res.setHeader(
                "Content-Disposition",
                `attachment; filename="${type}-${id}.pdf"`,
              );
              res.send(Buffer.from(pdf));
              return;
            } finally {
              if (browser) await browser.close().catch(() => {});
            }
          }
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.status(200).send("");
          return;
        }
      }

      const aliasesLower = tplObj ? [] : docTypeSynonymsLower(type);

      // Default template
      if (!tplObj) {
        const placeholders = aliasesLower.map((_, i) => `:dt${i}`).join(", ");
        const params = { companyId };
        aliasesLower.forEach((val, i) => (params[`dt${i}`] = val));
        const items = await query(`SELECT id, html_content,
                  header_logo_url, header_name, header_address, header_address2, header_phone, header_email, header_website,
          created_at,
          u.username AS created_by_name
         FROM document_templates
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId AND LOWER(TRIM(document_type)) IN (${placeholders}) AND is_default = 1
           ORDER BY updated_at DESC
           LIMIT 1`,
          params,
        ).catch(() => []);
        if (Array.isArray(items) && items.length) tplObj = items[0];
      }

      // Any matching template
      if (!tplObj) {
        const placeholders = aliasesLower.map((_, i) => `:dtx${i}`).join(", ");
        const paramsAny = { companyId };
        aliasesLower.forEach((val, i) => (paramsAny[`dtx${i}`] = val));
        const anyItems = await query(`SELECT id, html_content,
                  header_logo_url, header_name, header_address, header_address2, header_phone, header_email, header_website,
                  document_type, is_default, updated_at,
          created_at,
          u.username AS created_by_name
         FROM document_templates
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId AND LOWER(TRIM(document_type)) IN (${placeholders})
           ORDER BY is_default DESC, updated_at DESC, id DESC
           LIMIT 1`,
          paramsAny,
        ).catch(() => []);
        if (Array.isArray(anyItems) && anyItems.length) tplObj = anyItems[0];
      }

      // If no template, return blank output without altering UI
      if (!tplObj) {
        const fmt = String(
          req.query.format || req.body?.format || "html",
        ).toLowerCase();
        if (fmt === "pdf") {
          let browser = null;
          try {
            browser = await launchBrowser();
            const page = await browser.newPage();
            await page.setContent(
              "<!DOCTYPE html><html><head></head><body></body></html>",
              {
                waitUntil: "domcontentloaded",
              },
            );
            const pdf = await page.pdf({
              printBackground: true,
              preferCSSPageSize: true,
              margin: { top: "0", bottom: "0", left: "0", right: "0" },
            });
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader(
              "Content-Length",
              Buffer.byteLength(Buffer.from(pdf)),
            );
            res.setHeader(
              "Content-Disposition",
              `attachment; filename="${type}-${id}.pdf"`,
            );
            res.send(Buffer.from(pdf));
            return;
          } finally {
            if (browser) await browser.close().catch(() => {});
          }
        }
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.status(200).send("");
        return;
      }

      // Set template type header
      try {
        res.setHeader(
          "X-Template-Document-Type",
          String(tplObj.document_type || canonicalDocumentType(type)),
        );
      } catch {}

      // Load general/header template
      let generalTpl = null;
      try {
        const aliasesLowerG = docTypeSynonymsLower("general-template");
        const placeholdersG = aliasesLowerG.map((_, i) => `:gt${i}`).join(", ");
        const paramsG = { companyId };
        aliasesLowerG.forEach((val, i) => (paramsG[`gt${i}`] = val));
        const rows = await query(`SELECT id,
                  header_logo_url, header_name, header_address, header_address2, header_phone, header_email, header_website,
                  document_type,
          created_at,
          u.username AS created_by_name
         FROM document_templates
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId AND LOWER(document_type) IN (${placeholdersG}) AND is_default = 1
           LIMIT 1`,
          paramsG,
        ).catch(() => []);
        if (rows && rows.length) {
          generalTpl = rows[0];
        } else {
          const ins = await query(`INSERT INTO document_templates
               (company_id, name, document_type, html_content, is_default, created_by,
                header_logo_url, header_name, header_address, header_address2, header_phone, header_email, header_website)
             VALUES
               (:companyId, :name, :dt, :html, 1, :createdBy, NULL, NULL, NULL, NULL, NULL, NULL, NULL)`,
            {
              companyId,
              name: "Default General Template",
              dt: "general-template",
              html: getDefaultSampleTemplate("general-template"),
              createdBy: req.user?.id || null,
            },
          ).catch(() => null);
          if (ins && ins.insertId) {
            await query(`UPDATE document_templates SET is_default = 0
               WHERE company_id = :companyId AND LOWER(document_type) IN (${placeholdersG}) AND id <> :id`,
              { ...paramsG, id: ins.insertId },
            ).catch(() => null);
            const [row] = await query(`SELECT id,
                      header_logo_url, header_name, header_address, header_address2, header_phone, header_email, header_website,
                      document_type,
          created_at,
          u.username AS created_by_name
         FROM document_templates
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :id AND company_id = :companyId
               LIMIT 1`,
              { id: ins.insertId, companyId },
            ).catch(() => []);
            if (row) generalTpl = row;
          }
        }
      } catch {}

      const data = await loadData(type, id, companyId, branchId);

      // Merge company header fields
      if (data && data.company) {
        const logoDefault = `/api/admin/companies/${companyId}/logo`;
        const embeddedLogo = tplObj.header_logo_url
          ? null
          : await getCompanyLogoDataUri(companyId);
        const merged = {
          ...data.company,
          name:
            tplObj.header_name || generalTpl?.header_name || data.company.name,
          address:
            tplObj.header_address ||
            generalTpl?.header_address ||
            data.company.address,
          address2:
            tplObj.header_address2 ||
            generalTpl?.header_address2 ||
            data.company.address2,
          phone:
            tplObj.header_phone ||
            generalTpl?.header_phone ||
            data.company.telephone ||
            data.company.phone,
          email:
            tplObj.header_email ||
            generalTpl?.header_email ||
            data.company.email,
          website:
            tplObj.header_website ||
            generalTpl?.header_website ||
            data.company.website,
          logo:
            embeddedLogo ||
            tplObj.header_logo_url ||
            generalTpl?.header_logo_url ||
            logoDefault,
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
        html = "";
      }

      // Escape helper
      function esc(v) {
        return String(v ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
      }

      // Auto-inject customer info block if missing
      const cust = data?.customer || null;
      const probe = String(cust?.name || "").trim();
      if (
        cust &&
        (!probe || !html.includes(probe)) &&
        !html.includes('data-auto="customer-info"')
      ) {
        const keyName =
          type === "sales-order"
            ? "sales_order"
            : type === "delivery-note"
              ? "delivery_note"
              : type;
        const qr = data?.[keyName]?.qr_code || "";
        const block = `<div data-auto="customer-info" style="margin:8px 0;font-size:12px">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <div>
                <div><strong>Name:</strong> ${esc(cust.name || "")}</div>
                <div><strong>Address:</strong> ${esc(cust.address || "")} ${esc(cust.address2 || "")}</div>
                ${cust.city || cust.state ? `<div><strong>City/State:</strong> ${esc(cust.city || "")} ${esc(cust.state || "")}</div>` : ""}
                ${cust.country ? `<div><strong>Country:</strong> ${esc(cust.country || "")}</div>` : ""}
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

      // Inject print styles
      const hasFullHtmlDoc =
        String(html).trimStart().toLowerCase().startsWith("<!doctype") ||
        String(html).trimStart().toLowerCase().startsWith("<html");
      if (!hasFullHtmlDoc) {
        const printStyle = `<style>
          @media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          * { print-color-adjust: exact; }
          .doc { height: auto !important; min-height: auto !important; }
          .titlebar, .title-section, .info, .info-grid { margin-top: 6px !important; margin-bottom: 6px !important; }
          table { margin-top: 6px !important; }
        </style>`;
        html = printStyle + html;
      } else {
        const printStyle = `<style>
          @media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          * { print-color-adjust: exact; }
        </style>`;
        html = html.replace("</head>", `${printStyle}</head>`);
      }

      const format = String(
        req.query.format || req.body?.format || "html",
      ).toLowerCase();

      if (format === "pdf") {
        try {
          const cleaned = sanitizeHtml(html, {
            allowedTags: [
              "div",
              "p",
              "span",
              "br",
              "strong",
              "em",
              "b",
              "i",
              "u",
              "h1",
              "h2",
              "h3",
              "h4",
              "h5",
              "h6",
              "table",
              "thead",
              "tbody",
              "tfoot",
              "tr",
              "td",
              "th",
              "img",
              "a",
              "style",
            ],
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
          let pdf = null;
          let browser = null;
          try {
            browser = await launchBrowser();
            const page = await browser.newPage();
            page.setDefaultNavigationTimeout(30000);
            page.setDefaultTimeout(30000);
            await page.setContent(doc, {
              waitUntil: "domcontentloaded",
              timeout: 15000,
            });
            await page.emulateMediaType("screen");
            pdf = await page.pdf({
              preferCSSPageSize: true,
              printBackground: true,
              margin: {
                top: "20mm",
                bottom: "20mm",
                left: "20mm",
                right: "20mm",
              },
            });
          } catch (renderErr) {
            console.error("PDF Render Error:", renderErr);
            throw httpError(
              500,
              "PDF_RENDER_ERROR",
              `Failed to render PDF: ${renderErr.message}`,
            );
          } finally {
            if (browser) await browser.close().catch(() => {});
          }
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader("Content-Length", Buffer.byteLength(Buffer.from(pdf)));
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="${type}-${id}.pdf"`,
          );
          res.send(Buffer.from(pdf));
          return;
        } catch (e) {
          throw e;
        }
      }

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } catch (err) {
      const format = String(
        req.query.format || req.body?.format || "",
      ).toLowerCase();
      if (format === "pdf") return next(err);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(200).send("");
    }
  },
);

// ─── POST /:type/:id/render ──────────────────────────────────────────────────
router.post(
  "/:type/:id/render",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureTemplateTables();
      const { companyId, branchId } = req.scope;
      const type = canonicalDocumentType(String(req.params.type || "").trim());
      const id = toNumber(req.params.id);
      if (!type || !id)
        throw httpError(400, "VALIDATION_ERROR", "Invalid request");

      const templateId = req.query?.template_id
        ? Number(req.query.template_id)
        : req.body?.template_id
          ? Number(req.body.template_id)
          : null;

      let tplObj = null;

      // Explicit template override
      if (templateId && Number.isFinite(templateId)) {
        const [row] = await query(`SELECT id, html_content,
                  header_logo_url, header_name, header_address, header_address2, header_phone, header_email, header_website,
                  document_type,
          created_at,
          u.username AS created_by_name
         FROM document_templates
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :id AND company_id = :companyId
           LIMIT 1`,
          { id: templateId, companyId },
        ).catch(() => []);
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

      const canonical = canonicalDocumentType(type);
      if (!tplObj) {
        if (canonical === "payment-voucher" || canonical === "sales-order") {
          const priorityName =
            canonical === "payment-voucher"
              ? "Default payment-voucher"
              : "Sales Order";
          const [namedRow] = await query(`SELECT id, html_content,
                    header_logo_url, header_name, header_address, header_address2, header_phone, header_email, header_website,
                    document_type,
          created_at,
          u.username AS created_by_name
         FROM document_templates
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE name = :priorityName AND company_id = :companyId
             LIMIT 1`,
            { priorityName, companyId },
          ).catch(() => []);
          if (namedRow) tplObj = namedRow;
        }
      }

      const nameMap = {
        "sales-order": "Sales Order",
        invoice: "Invoice",
        "delivery-note": "Delivery Note",
        "salary-slip": "Salary Slip",
        "payment-voucher": "Payment voucher",
        "receipt-voucher": "Receipt Voucher",
      };
      const strictName = nameMap[canonical] || null;
      if (strictName) {
        const [rowByName] = await query(`SELECT id, html_content,
                  header_logo_url, header_name, header_address, header_address2, header_phone, header_email, header_website,
                  document_type, name,
          created_at,
          u.username AS created_by_name
         FROM document_templates
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId AND LOWER(TRIM(name)) = LOWER(TRIM(:strictName))
           ORDER BY updated_at DESC, id DESC
           LIMIT 1`,
          { companyId, strictName },
        ).catch(() => []);
        if (rowByName) {
          tplObj = rowByName;
        }
      }

      const aliasesLower = tplObj ? [] : docTypeSynonymsLower(type);
      if (!tplObj) {
        const placeholders = aliasesLower.map((_, i) => `:dt${i}`).join(", ");
        const params = { companyId };
        aliasesLower.forEach((val, i) => (params[`dt${i}`] = val));
        const items = await query(`SELECT id, html_content,
                  header_logo_url, header_name, header_address, header_address2, header_phone, header_email, header_website,
          created_at,
          u.username AS created_by_name
         FROM document_templates
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId AND LOWER(TRIM(document_type)) IN (${placeholders}) AND is_default = 1
           ORDER BY updated_at DESC
           LIMIT 1`,
          params,
        ).catch(() => []);
        if (Array.isArray(items) && items.length) tplObj = items[0];
      }

      if (!tplObj) {
        const placeholders = aliasesLower.map((_, i) => `:dtx${i}`).join(", ");
        const paramsAny = { companyId };
        aliasesLower.forEach((val, i) => (paramsAny[`dtx${i}`] = val));
        const anyItems = await query(`SELECT id, html_content,
                  header_logo_url, header_name, header_address, header_address2, header_phone, header_email, header_website,
                  document_type, is_default, updated_at,
          created_at,
          u.username AS created_by_name
         FROM document_templates
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId AND LOWER(TRIM(document_type)) IN (${placeholders})
           ORDER BY is_default DESC, updated_at DESC, id DESC
           LIMIT 1`,
          paramsAny,
        ).catch(() => []);
        if (Array.isArray(anyItems) && anyItems.length) tplObj = anyItems[0];
      }

      if (!tplObj) {
        const fmt = String(
          req.query.format || req.body?.format || "html",
        ).toLowerCase();
        if (fmt === "pdf") {
          let browser = null;
          try {
            browser = await launchBrowser();
            const page = await browser.newPage();
            await page.setContent(
              "<!DOCTYPE html><html><head></head><body></body></html>",
              { waitUntil: "domcontentloaded" },
            );
            const pdf = await page.pdf({
              printBackground: true,
              preferCSSPageSize: true,
              margin: { top: "0", bottom: "0", left: "0", right: "0" },
            });
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader(
              "Content-Length",
              Buffer.byteLength(Buffer.from(pdf)),
            );
            res.setHeader(
              "Content-Disposition",
              `attachment; filename="${type}-${id}.pdf"`,
            );
            res.send(Buffer.from(pdf));
            return;
          } finally {
            if (browser) await browser.close().catch(() => {});
          }
        }
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.status(200).send("");
        return;
      }

      // Set template type header
      try {
        res.setHeader(
          "X-Template-Document-Type",
          String(tplObj.document_type || canonicalDocumentType(type)),
        );
      } catch {}

      // Load general/header template
      let generalTpl = null;
      try {
        const aliasesLowerG = docTypeSynonymsLower("general-template");
        const placeholdersG = aliasesLowerG.map((_, i) => `:gt${i}`).join(", ");
        const paramsG = { companyId };
        aliasesLowerG.forEach((val, i) => (paramsG[`gt${i}`] = val));
        const rows = await query(`SELECT id,
                  header_logo_url, header_name, header_address, header_address2, header_phone, header_email, header_website,
                  document_type,
          created_at,
          u.username AS created_by_name
         FROM document_templates
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId AND LOWER(document_type) IN (${placeholdersG}) AND is_default = 1
           LIMIT 1`,
          paramsG,
        ).catch(() => []);
        if (rows && rows.length) {
          generalTpl = rows[0];
        } else {
          const ins = await query(`INSERT INTO document_templates
               (company_id, name, document_type, html_content, is_default, created_by,
                header_logo_url, header_name, header_address, header_address2, header_phone, header_email, header_website)
             VALUES
               (:companyId, :name, :dt, :html, 1, :createdBy, NULL, NULL, NULL, NULL, NULL, NULL, NULL)`,
            {
              companyId,
              name: "Default General Template",
              dt: "general-template",
              html: getDefaultSampleTemplate("general-template"),
              createdBy: req.user?.id || null,
            },
          ).catch(() => null);
          if (ins && ins.insertId) {
            await query(`UPDATE document_templates SET is_default = 0
               WHERE company_id = :companyId AND LOWER(document_type) IN (${placeholdersG}) AND id <> :id`,
              { ...paramsG, id: ins.insertId },
            ).catch(() => null);
            const [row] = await query(`SELECT id,
                      header_logo_url, header_name, header_address, header_address2, header_phone, header_email, header_website,
                      document_type,
          created_at,
          u.username AS created_by_name
         FROM document_templates
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :id AND company_id = :companyId
               LIMIT 1`,
              { id: ins.insertId, companyId },
            ).catch(() => []);
            if (row) generalTpl = row;
          }
        }
      } catch {}

      const data = await loadData(type, id, companyId, branchId);

      // Merge company header fields (no general template)
      if (data && data.company) {
        const origin = `${req.protocol}://${req.get("host")}`;
        const absolutize = (s) => {
          const v = String(s || "").trim();
          if (!v) return v;
          if (/^https?:\/\//i.test(v)) return v;
          if (v.startsWith("/")) return `${origin}${v}`;
          return `${origin}/${v}`;
        };
        const logoDefault = `/api/admin/companies/${companyId}/logo`;
        const embeddedLogo = tplObj.header_logo_url
          ? null
          : await getCompanyLogoDataUri(companyId);
        const merged = {
          ...data.company,
          name: tplObj.header_name || data.company.name,
          address: tplObj.header_address || data.company.address,
          address2: tplObj.header_address2 || data.company.address2,
          phone:
            tplObj.header_phone || data.company.telephone || data.company.phone,
          email: tplObj.header_email || data.company.email,
          website: tplObj.header_website || data.company.website,
          logo:
            embeddedLogo || absolutize(tplObj.header_logo_url || logoDefault),
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
        html = "";
      }

      // Do not alter UI formatting; return template-rendered HTML as-is

      const format = String(
        req.query.format || req.body?.format || "html",
      ).toLowerCase();

      if (format === "pdf") {
        try {
          const content =
            String(html).trim().toLowerCase().startsWith("<!doctype") ||
            String(html).trim().toLowerCase().startsWith("<html")
              ? html
              : `<!DOCTYPE html><html><head></head><body>${html || ""}</body></html>`;
          let pdf = null;
          let browser = null;
          try {
            browser = await launchBrowser();
            const page = await browser.newPage();
            await page.setContent(content, { waitUntil: "domcontentloaded" });
            pdf = await page.pdf({
              preferCSSPageSize: true,
              printBackground: true,
              margin: { top: "0", bottom: "0", left: "0", right: "0" },
            });
          } finally {
            if (browser) await browser.close().catch(() => {});
          }
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader("Content-Length", Buffer.byteLength(Buffer.from(pdf)));
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="${type}-${id}.pdf"`,
          );
          res.send(Buffer.from(pdf));
          return;
        } catch (e) {
          throw e;
        }
      }

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } catch (err) {
      const format = String(
        req.query.format || req.body?.format || "",
      ).toLowerCase();
      if (format === "pdf") return next(err);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(200).send("");
    }
  },
);

// ─── POST /:type/preview ─────────────────────────────────────────────────────
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

      const origin = `${req.protocol}://${req.get("host")}`;
      const absolutize = (s) => {
        const v = String(s || "").trim();
        if (!v) return v;
        if (/^https?:\/\//i.test(v)) return v;
        if (v.startsWith("/")) return `${origin}${v}`;
        return `${origin}/${v}`;
      };

      const aliasesLower = docTypeSynonymsLower(type);
      let tplObj = null;

      // Priority name lookup for preview
      const canonical = canonicalDocumentType(type);
      if (canonical === "payment-voucher" || canonical === "sales-order") {
        const priorityName =
          canonical === "payment-voucher"
            ? "Default payment-voucher"
            : "Sales Order";
        const [namedRow] = await query(`SELECT id, html_content,
                  header_logo_url, header_name, header_address, header_address2, header_phone, header_email, header_website,
          created_at,
          u.username AS created_by_name
         FROM document_templates
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE name = :priorityName AND company_id = :companyId
           LIMIT 1`,
          { priorityName, companyId },
        ).catch(() => []);
        if (namedRow) tplObj = namedRow;
      }

      // Strict name-based template selection for mapped types
      // Always prefer templates with exact names for these document types
      const nameMap = {
        "sales-order": "Sales Order",
        invoice: "Invoice",
        "delivery-note": "Delivery Note",
        "salary-slip": "Salary Slip",
        "payment-voucher": "Payment voucher",
        "receipt-voucher": "Receipt Voucher",
      };
      const strictName = nameMap[canonical] || null;

      // Always try to get the strict-named template, even if we already found another template
      if (strictName) {
        const [rowByName] = await query(`SELECT id, html_content,
                  header_logo_url, header_name, header_address, header_address2, header_phone, header_email, header_website,
                  document_type, name,
          created_at,
          u.username AS created_by_name
         FROM document_templates
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId AND LOWER(TRIM(name)) = LOWER(TRIM(:strictName))
           ORDER BY updated_at DESC, id DESC
           LIMIT 1`,
          { companyId, strictName },
        ).catch(() => []);
        if (rowByName) tplObj = rowByName;
      }

      if (!tplObj) {
        const placeholders = aliasesLower.map((_, i) => `:dt${i}`).join(", ");
        const params = { companyId };
        aliasesLower.forEach((val, i) => (params[`dt${i}`] = val));
        const items = await query(`SELECT id, html_content,
                  header_logo_url, header_name, header_address, header_address2, header_phone, header_email, header_website,
          created_at,
          u.username AS created_by_name
         FROM document_templates
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId AND LOWER(TRIM(document_type)) IN (${placeholders}) AND is_default = 1
           LIMIT 1`,
          params,
        ).catch(() => []);
        if (Array.isArray(items) && items.length) tplObj = items[0];
      }

      if (!tplObj) {
        const placeholders = aliasesLower.map((_, i) => `:dt${i}`).join(", ");
        const params = { companyId };
        aliasesLower.forEach((val, i) => (params[`dt${i}`] = val));
        const items = await query(`SELECT id, html_content,
                  header_logo_url, header_name, header_address, header_address2, header_phone, header_email, header_website,
          created_at,
          u.username AS created_by_name
         FROM document_templates
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId AND LOWER(TRIM(document_type)) IN (${placeholders})
           ORDER BY is_default DESC, updated_at DESC
           LIMIT 1`,
          params,
        ).catch(() => []);
        if (Array.isArray(items) && items.length) tplObj = items[0];
      }

      // If strict name requested and still not found, return blank
      if (!tplObj && strictName) {
        const fmt = String(
          req.query.format || req.body?.format || "html",
        ).toLowerCase();
        if (fmt === "pdf") {
          let browser = null;
          try {
            browser = await launchBrowser();
            const page = await browser.newPage();
            await page.setContent(
              "<!DOCTYPE html><html><head></head><body></body></html>",
              {
                waitUntil: "domcontentloaded",
              },
            );
            const pdf = await page.pdf({
              printBackground: true,
              preferCSSPageSize: true,
              margin: { top: "0", bottom: "0", left: "0", right: "0" },
            });
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader(
              "Content-Length",
              Buffer.byteLength(Buffer.from(pdf)),
            );
            res.setHeader(
              "Content-Disposition",
              `attachment; filename="${canonical}-preview.pdf"`,
            );
            res.send(Buffer.from(pdf));
            return;
          } finally {
            if (browser) await browser.close().catch(() => {});
          }
        }
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.status(200).send("");
        return;
      }

      let generalTpl = null;
      try {
        const aliasesLowerG = docTypeSynonymsLower("general-template");
        const placeholdersG = aliasesLowerG.map((_, i) => `:gt${i}`).join(", ");
        const paramsG = { companyId };
        aliasesLowerG.forEach((val, i) => (paramsG[`gt${i}`] = val));
        const rows = await query(`SELECT id,
                  header_logo_url, header_name, header_address, header_address2, header_phone, header_email, header_website,
                  document_type,
          created_at,
          u.username AS created_by_name
         FROM document_templates
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId AND LOWER(document_type) IN (${placeholdersG}) AND is_default = 1
           LIMIT 1`,
          paramsG,
        ).catch(() => []);
        if (rows && rows.length) {
          generalTpl = rows[0];
        } else {
          const ins = await query(`INSERT INTO document_templates
               (company_id, name, document_type, html_content, is_default, created_by,
                header_logo_url, header_name, header_address, header_address2, header_phone, header_email, header_website)
             VALUES
               (:companyId, :name, :dt, :html, 1, :createdBy, NULL, NULL, NULL, NULL, NULL, NULL, NULL)`,
            {
              companyId,
              name: "Default General Template",
              dt: "general-template",
              html: getDefaultSampleTemplate("general-template"),
              createdBy: req.user?.id || null,
            },
          ).catch(() => null);
          if (ins && ins.insertId) {
            await query(`UPDATE document_templates SET is_default = 0
               WHERE company_id = :companyId AND LOWER(document_type) IN (${placeholdersG}) AND id <> :id`,
              { ...paramsG, id: ins.insertId },
            ).catch(() => null);
            const [row] = await query(`SELECT id,
                      header_logo_url, header_name, header_address, header_address2, header_phone, header_email, header_website,
                      document_type,
          created_at,
          u.username AS created_by_name
         FROM document_templates
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :id AND company_id = :companyId
               LIMIT 1`,
              { id: ins.insertId, companyId },
            ).catch(() => []);
            if (row) generalTpl = row;
          }
        }
      } catch {}

      const data = await loadPreviewData(type, companyId, branchId);

      if (data && data.company) {
        const logoDefault = `/api/admin/companies/${companyId}/logo`;
        const merged = {
          ...data.company,
          name:
            tplObj.header_name || generalTpl?.header_name || data.company.name,
          address:
            tplObj.header_address ||
            generalTpl?.header_address ||
            data.company.address,
          address2:
            tplObj.header_address2 ||
            generalTpl?.header_address2 ||
            data.company.address2,
          phone:
            tplObj.header_phone ||
            generalTpl?.header_phone ||
            data.company.telephone ||
            data.company.phone,
          email:
            tplObj.header_email ||
            generalTpl?.header_email ||
            data.company.email,
          website:
            tplObj.header_website ||
            generalTpl?.header_website ||
            data.company.website,
          logo: absolutize(
            tplObj.header_logo_url ||
              generalTpl?.header_logo_url ||
              logoDefault,
          ),
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
          <p>Error: ${e.message}</p>
          <pre>${JSON.stringify(data, null, 2)}</pre>
          </body></html>`;
        }
      }

      // Do not alter UI formatting; keep template HTML as-is

      const format = String(
        req.query.format || req.body?.format || "html",
      ).toLowerCase();

      if (format === "pdf") {
        try {
          const content =
            String(html).trim().toLowerCase().startsWith("<!doctype") ||
            String(html).trim().toLowerCase().startsWith("<html")
              ? html
              : `<!DOCTYPE html><html><head></head><body>${html || ""}</body></html>`;
          let pdf = null;
          let browser = null;
          try {
            browser = await launchBrowser();
            const page = await browser.newPage();
            await page.setContent(content, { waitUntil: "domcontentloaded" });
            pdf = await page.pdf({
              preferCSSPageSize: true,
              printBackground: true,
              margin: { top: "0", bottom: "0", left: "0", right: "0" },
            });
          } finally {
            if (browser) await browser.close().catch(() => {});
          }
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader("Content-Length", Buffer.byteLength(Buffer.from(pdf)));
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="${canonical}-preview.pdf"`,
          );
          res.send(Buffer.from(pdf));
          return;
        } catch (e) {
          throw e;
        }
      }

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } catch (err) {
      const format = String(
        req.query.format || req.body?.format || "",
      ).toLowerCase();
      if (format === "pdf") return next(err);
      try {
        const type = String(req.params.type || "").trim();
        const { companyId } = req.scope || {};
        const fallback = getDefaultSampleTemplate(type);
        const data = {
          company: {
            name: "",
            address: "",
            address2: "",
            phone: "",
            email: "",
            logo: `/api/admin/companies/${companyId}/logo`,
          },
        };
        const html = Handlebars.compile(String(fallback || ""))(data);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.status(200).send(html);
      } catch {
        res
          .status(200)
          .send(
            "<html><body><h3>Document Preview</h3><p>Unable to render template; minimal fallback shown.</p></body></html>",
          );
      }
    }
  },
);

// ─── GET /:type/:id/attachments ───────────────────────────────────────────────
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
  if (!(await hasColumn("adm_document_attachments", "title"))) {
    await query(`ALTER TABLE adm_document_attachments ADD COLUMN title VARCHAR(255) NULL AFTER file_name`,
    );
  }
  if (!(await hasColumn("adm_document_attachments", "description"))) {
    await query(`ALTER TABLE adm_document_attachments ADD COLUMN description TEXT NULL AFTER title`,
    );
  }
  if (!(await hasColumn("adm_document_attachments", "category"))) {
    await query(`ALTER TABLE adm_document_attachments ADD COLUMN category VARCHAR(100) NULL AFTER description`,
    );
  }
  if (!(await hasColumn("adm_document_attachments", "tags"))) {
    await query(`ALTER TABLE adm_document_attachments ADD COLUMN tags TEXT NULL AFTER category`,
    );
  }
  if (!(await hasColumn("adm_document_attachments", "mime_type"))) {
    await query(`ALTER TABLE adm_document_attachments ADD COLUMN mime_type VARCHAR(100) NULL AFTER tags`,
    );
  }
  if (!(await hasColumn("adm_document_attachments", "file_size"))) {
    await query(`ALTER TABLE adm_document_attachments ADD COLUMN file_size BIGINT NULL AFTER mime_type`,
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
      const rawItems = await query(`
        SELECT id, file_url, file_name, uploaded_by, created_at,
               title, description, category, tags, mime_type, file_size,
          created_at,
          u.username AS created_by_name
         FROM adm_document_attachments
        LEFT JOIN adm_users u ON u.id = created_by
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
              if (/^https?:\/\//i.test(s)) return r;
              if (s.startsWith("/uploads"))
                return { ...r, file_url: `${origin}${s}` };
              if (s.startsWith("uploads"))
                return { ...r, file_url: `${origin}/${s}` };
              if (s && !s.includes("/") && !s.includes("\\"))
                return { ...r, file_url: `${origin}/uploads/${s}` };
              return r;
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
      const result = await query(`
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
      const rows = await query(`
        SELECT file_url,
          created_at,
          u.username AS created_by_name
         FROM adm_document_attachments
        LEFT JOIN adm_users u ON u.id = created_by
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
      await query(`
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
            const r = await query(`
              SELECT setting_value,
          created_at,
          u.username AS created_by_name
         FROM adm_system_settings
        LEFT JOIN adm_users u ON u.id = created_by
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
            if (remainder[0] && /^v\d+$/i.test(remainder[0]))
              remainder = remainder.slice(1);
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

router.post("/raw-html-to-pdf", requireAuth, async (req, res, next) => {
  try {
    const html = typeof req.body.html === "string" ? req.body.html : "";

    // Extract style tags from the original HTML to preserve styling
    const styleTags = [];
    const styleRegex = /<style[^>]*>[\s\S]*?<\/style>/gi;
    let match;
    while ((match = styleRegex.exec(html)) !== null) {
      styleTags.push(match[0]);
    }

    // Preserve color adjustment for logos and images
    const colorAdjustStyle = `<style>
      @media print {
        img, svg {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
    </style>`;

    const doc =
      String(html).trim().toLowerCase().startsWith("<!doctype") ||
      String(html).trim().toLowerCase().startsWith("<html")
        ? html.replace(
            /<head[^>]*>([\s\S]*?)<\/head>/i,
            (match, headContent) => {
              // Add our color adjustment styles to existing head
              return `<head>${headContent}${colorAdjustStyle}</head>`;
            },
          )
        : `<!DOCTYPE html><html><head>${colorAdjustStyle}${styleTags.join("")}</head><body>${html || ""}</body></html>`;

    let pdf = null;
    let browser = null;
    try {
      browser = await launchBrowser();
      const page = await browser.newPage();
      await page.setContent(doc, { waitUntil: "domcontentloaded" });
      pdf = await page.pdf({
        preferCSSPageSize: true,
        printBackground: true,
        margin: { top: "0", bottom: "0", left: "0", right: "0" },
      });
    } catch (err) {
      console.error("raw-html-to-pdf error:", err);
      throw httpError(500, "RENDER_ERROR", "Failed to generate PDF from HTML");
    } finally {
      if (browser) await browser.close().catch(() => {});
    }

    if (!pdf) throw httpError(500, "RENDER_FAILED", "Failed to generate PDF");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", Buffer.byteLength(Buffer.from(pdf)));
    res.send(Buffer.from(pdf));
  } catch (err) {
    next(err);
  }
});

export default router;
