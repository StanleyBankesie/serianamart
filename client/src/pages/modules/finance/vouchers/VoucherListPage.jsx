import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { toast } from "react-toastify";

import { api } from "api/client";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import ReverseApprovalButton from "../../../../components/ReverseApprovalButton.jsx";
import { filterAndSort } from "@/utils/searchUtils.js";

function StatusBadge({ status }) {
  const cls =
    status === "DRAFT"
      ? "badge badge-warning"
      : status === "APPROVED" || status === "POSTED"
        ? "badge badge-success"
        : status === "REVERSED" || status === "CANCELLED"
          ? "badge badge-error"
          : "badge badge-info";

  return <span className={cls}>{status}</span>;
}

export default function VoucherListPage({ voucherTypeCode, title }) {
  const { canPerformAction } = usePermission();
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const isPV = String(voucherTypeCode).toUpperCase() === "PV";
  const isRV = String(voucherTypeCode).toUpperCase() === "RV";
  const isCV = String(voucherTypeCode).toUpperCase() === "CV";
  const isSV = String(voucherTypeCode).toUpperCase() === "SV";
  const isPUV = String(voucherTypeCode).toUpperCase() === "PUV";
  const isJV = String(voucherTypeCode).toUpperCase() === "JV";
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [wfLoading, setWfLoading] = useState(false);
  const [wfError, setWfError] = useState("");
  const [candidateWorkflow, setCandidateWorkflow] = useState(null);
  const [workflowSteps, setWorkflowSteps] = useState([]);
  const [firstApprover, setFirstApprover] = useState(null);
  const [workflowsCache, setWorkflowsCache] = useState(null);
  const [targetApproverId, setTargetApproverId] = useState(null);
  const [submittingForward, setSubmittingForward] = useState(false);
  const [companyInfo, setCompanyInfo] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    city: "",
    state: "",
    country: "",
    postalCode: "",
    website: "",
    taxId: "",
    registrationNo: "",
    logoUrl: "",
  });
  const [receiptTemplateHtml, setReceiptTemplateHtml] = useState(null);
  const [paymentTemplateHtml, setPaymentTemplateHtml] = useState(null);
  const basePath =
    String(voucherTypeCode).toUpperCase() === "JV"
      ? "journal-voucher"
      : String(voucherTypeCode).toUpperCase() === "PV"
        ? "payment-voucher"
        : String(voucherTypeCode).toUpperCase() === "RV"
          ? "receipt-voucher"
          : String(voucherTypeCode).toUpperCase() === "CV"
            ? "contra-voucher"
            : String(voucherTypeCode).toUpperCase() === "SV"
              ? "sales-voucher"
              : String(voucherTypeCode).toUpperCase() === "PUV"
                ? "purchase-voucher"
                : String(voucherTypeCode).toUpperCase() === "DN"
                  ? "debit-note"
                  : "credit-note";

  async function load() {
    try {
      setLoading(true);
      const res = await api.get("/finance/vouchers", {
        params: { voucherTypeCode },
      });
      setItems(res.data?.items || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load vouchers");
    } finally {
      setLoading(false);
    }
  }

  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  async function loadAccounts() {
    try {
      setAccountsLoading(true);
      const res = await api.get("/finance/accounts", { params: { active: 1 } });
      setAccounts(res.data?.items || []);
    } catch (e) {
      setAccounts([]);
    } finally {
      setAccountsLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        // Trigger a one-time tax-split backfill for SV/PUV lists
        if (isSV || isPUV) {
          await api
            .post("/finance/vouchers/backfill/tax-split")
            .catch(() => null);
        }
      } finally {
        if (!cancelled) {
          load();
          if (isCV) loadAccounts();
        }
      }
    }
    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voucherTypeCode]);
  useEffect(() => {
    const ref = location.state?.highlightRef;
    const hid = location.state?.highlightId;
    const refresh = location.state?.refresh;
    if (!ref && !hid && !refresh) return;
    let cancelled = false;
    async function ensureVisible() {
      const start = Date.now();
      while (!cancelled && Date.now() - start < 5000) {
        try {
          const res = await api.get("/finance/vouchers", {
            params: { voucherTypeCode },
          });
          const arr = Array.isArray(res.data?.items) ? res.data.items : [];
          setItems(arr);
          let hit = false;
          if (ref) {
            hit = arr.some(
              (v) =>
                String(v.voucher_no || "").toLowerCase() ===
                String(ref).toLowerCase(),
            );
          } else if (hid) {
            hit = arr.some((v) => Number(v.id) === Number(hid));
          } else {
            hit = true;
          }
          if (hit) break;
        } catch {}
        await new Promise((r) => setTimeout(r, 300));
      }
    }
    ensureVisible();
    return () => {
      cancelled = true;
    };
  }, [
    location.state?.highlightRef,
    location.state?.highlightId,
    location.state?.refresh,
    voucherTypeCode,
  ]);
  useEffect(() => {
    function onWorkflowStatus(e) {
      try {
        const d = e.detail || {};
        const id = Number(d.documentId || d.document_id);
        const status = String(d.status || "").toUpperCase();
        if (!id || !status) return;
        setItems((prev) =>
          prev.map((x) =>
            Number(x.id) === id
              ? {
                  ...x,
                  status,
                  ...(status === "DRAFT"
                    ? { forwarded_to_username: null }
                    : {}),
                }
              : x,
          ),
        );
      } catch {}
    }
    window.addEventListener("omni.workflow.status", onWorkflowStatus);
    return () =>
      window.removeEventListener("omni.workflow.status", onWorkflowStatus);
  }, []);
  useEffect(() => {
    let mounted = true;
    async function fetchCompanyInfo() {
      try {
        const meResp = await api.get("/admin/me");
        const companyId = meResp.data?.scope?.companyId;
        if (!companyId) return;
        const cResp = await api.get(`/admin/companies/${companyId}`);
        const item = cResp.data?.item || {};
        if (!mounted) return;
        setCompanyInfo((prev) => ({
          ...prev,
          name: item.name || prev.name || "",
          address: item.address || prev.address || "",
          phone: item.telephone || prev.phone || "",
          email: item.email || prev.email || "",
          city: item.city || prev.city || "",
          state: item.state || prev.state || "",
          country: item.country || prev.country || "",
          postalCode: item.postal_code || prev.postalCode || "",
          website: item.website || prev.website || "",
          taxId: item.tax_id || prev.taxId || "",
          registrationNo: item.registration_no || prev.registrationNo || "",
          logoUrl:
            item.has_logo === 1 || item.has_logo === true
              ? `/api/admin/companies/${companyId}/logo`
              : prev.logoUrl || "",
        }));
      } catch {}
    }
    fetchCompanyInfo();
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const base =
      status === "ALL"
        ? items.slice()
        : items.filter((v) => v.status === status);
    const q = String(search || "").trim();
    if (!q) return base;
    return filterAndSort(base, {
      query: q,
      getKeys: (v) => [v.voucher_no, v.narration],
    });
  }, [items, search, status]);

  const accountNameByCode = useMemo(() => {
    const m = new Map();
    for (const a of accounts || []) {
      const code = String(a.code || "");
      const name = String(a.name || "");
      if (code) m.set(code, name);
    }
    return m;
  }, [accounts]);

  function renderNarration(v) {
    const raw = String(v.narration || "");
    if (!isCV || !raw) return raw || "-";
    const parts = raw.split(" | ").map((p) => p.trim());
    let fromVal = "";
    let toVal = "";
    for (const t of parts) {
      if (t.toLowerCase().startsWith("from:")) {
        const val = t.split(":")[1]?.trim() || "";
        const name = accountNameByCode.get(val) || val;
        fromVal = name;
      } else if (t.toLowerCase().startsWith("to:")) {
        const val = t.split(":")[1]?.trim() || "";
        const name = accountNameByCode.get(val) || val;
        toVal = name;
      }
    }
    if (fromVal && toVal) return `${fromVal} → ${toVal}`;
    if (fromVal) return fromVal;
    if (toVal) return toVal;
    return raw || "-";
  }
  function escapeHtml(v) {
    return String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function wrapDoc(bodyHtml) {
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Voucher</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; padding: 24px; color: #0f172a; background: #fff; }
      .vh { font-size: 12px; }
      .vh table { border-collapse: collapse; width: 100%; }
      .vh th, .vh td { border: 1px solid #e2e8f0; padding: 6px 8px; vertical-align: top; }
      .vh th { background: #f8fafc; text-align: left; }
      .vh .right { text-align: right; }
      .vh .center { text-align: center; }
      .vh-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 8px; }
      .vh-logo { min-width: 120px; max-width: 200px; }
      .vh-company { text-align: right; font-size: 11px; line-height: 1.35; }
      .vh-company .name { font-weight: 800; font-size: 14px; }
      .vh-titlebar { display: flex; align-items: center; gap: 10px; color: #0f172a; margin: 4px 0 10px; }
      .vh-titlebar .line { flex: 1; height: 1px; background: #0f172a; }
      .vh-titlebar .title { font-weight: 700; }
      .vh-details { width: 100%; margin-bottom: 10px; border: 1px solid #cbd5e1; }
      .vh-details td { border-color: #cbd5e1; }
      .vh-details .label { width: 32%; color: #475569; }
      .vh-details .label-wide { width: 40%; color: #475569; }
      .vh-items thead th { font-weight: 600; }
      .vh-footer a { color: inherit; text-decoration: underline; }
      @media print { button { display: none; } }
    </style>
  </head>
  <body>${bodyHtml || ""}</body>
</html>`;
  }
  async function waitForImages(rootEl) {
    const imgs = Array.from(rootEl?.querySelectorAll?.("img") || []);
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
  function renderReceiptVoucherHtml(data) {
    const c = data.company || {};
    const r = data.receipt || {};
    const items = Array.isArray(data.items) ? data.items : [];
    const t = data.totals || {};
    return `
    <div class="vh">
      <div class="vh-header">
        <div class="vh-logo">${c.logoHtml || ""}</div>
        <div class="vh-company">
          <div class="name">${escapeHtml(c.name || "")}</div>
          <div>${escapeHtml(c.addressLine1 || "")}</div>
          <div>${escapeHtml(c.addressLine2 || "")}</div>
          <div>Telephone: ${escapeHtml(c.phone || "")}</div>
          <div>${escapeHtml(c.website || "")}</div>
          <div>TIN: ${escapeHtml(c.taxId || "")} &nbsp; Reg: ${escapeHtml(c.registrationNo || "")}</div>
        </div>
      </div>
      <div class="vh-titlebar">
        <div class="line"></div>
        <div class="title">* Receipt Voucher *</div>
        <div class="line"></div>
      </div>
      <table class="vh-details">
        <tr>
          <td style="width:50%;vertical-align:top;border-right:1px solid #cbd5e1;">
            <table style="width:100%;">
              <tr><td class="label-wide">Receipt No</td><td>:</td><td>${escapeHtml(r.receiptNo || "")}</td></tr>
              <tr><td class="label-wide">Date/Time</td><td>:</td><td>${escapeHtml(r.dateTime || "")}</td></tr>
              <tr><td class="label-wide">Method</td><td>:</td><td>${escapeHtml(r.paymentMethod || "")}</td></tr>
            </table>
          </td>
          <td style="width:50%;vertical-align:top;">
            <div style="padding:8px;">
              <div class="label">Narration</div>
              <div>${escapeHtml(r.headerText || "")}</div>
            </div>
          </td>
        </tr>
      </table>
      <table class="vh-items">
        <thead>
          <tr>
            <th>Description</th>
            <th class="right" style="width:22%;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (it) => `
            <tr>
              <td>${escapeHtml(it.name || "")}</td>
              <td class="right">${escapeHtml(it.lineTotal || it.price || "0.00")}</td>
            </tr>
          `,
            )
            .join("")}
          <tr>
            <td class="right"><strong>Subtotal</strong></td>
            <td class="right"><strong>${escapeHtml(Number(t.subtotal || 0).toFixed(2))}</strong></td>
          </tr>
          <tr>
            <td class="right">Tax</td>
            <td class="right">${escapeHtml(Number(t.tax || 0).toFixed(2))}</td>
          </tr>
          <tr>
            <td class="right"><strong>Total</strong></td>
            <td class="right"><strong>${escapeHtml(Number(t.total || t.grand || 0).toFixed(2))}</strong></td>
          </tr>
        </tbody>
      </table>
      <div class="vh-footer" style="margin-top:10px;text-align:center;">
        <div>${escapeHtml(r.footerText || "")}</div>
      </div>
    </div>
    `;
  }
  function renderPaymentVoucherHtml(data) {
    const c = data.company || {};
    const p = data.payment || {};
    const items = Array.isArray(data.items) ? data.items : [];
    const t = data.totals || {};
    return `
    <div class="vh">
      <div class="vh-header">
        <div class="vh-logo">${c.logoHtml || ""}</div>
        <div class="vh-company">
          <div class="name">${escapeHtml(c.name || "")}</div>
          <div>${escapeHtml(c.addressLine1 || "")}</div>
          <div>${escapeHtml(c.addressLine2 || "")}</div>
          <div>Telephone: ${escapeHtml(c.phone || "")}</div>
          <div>${escapeHtml(c.website || "")}</div>
          <div>TIN: ${escapeHtml(c.taxId || "")} &nbsp; Reg: ${escapeHtml(c.registrationNo || "")}</div>
        </div>
      </div>
      <div class="vh-titlebar">
        <div class="line"></div>
        <div class="title">* Payment Voucher *</div>
        <div class="line"></div>
      </div>
      <table class="vh-details">
        <tr>
          <td style="width:50%;vertical-align:top;border-right:1px solid #cbd5e1;">
            <table style="width:100%;">
              <tr><td class="label-wide">Payment No</td><td>:</td><td>${escapeHtml(p.paymentNo || "")}</td></tr>
              <tr><td class="label-wide">Date/Time</td><td>:</td><td>${escapeHtml(p.dateTime || "")}</td></tr>
              <tr><td class="label-wide">Method</td><td>:</td><td>${escapeHtml(p.paymentMethod || "")}</td></tr>
            </table>
          </td>
          <td style="width:50%;vertical-align:top;">
            <div style="padding:8px;">
              <div class="label">Narration</div>
              <div>${escapeHtml(p.headerText || "")}</div>
            </div>
          </td>
        </tr>
      </table>
      <table class="vh-items">
        <thead>
          <tr>
            <th>Description</th>
            <th class="right" style="width:22%;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (it) => `
            <tr>
              <td>${escapeHtml(it.name || "")}</td>
              <td class="right">${escapeHtml(it.lineTotal || it.price || "0.00")}</td>
            </tr>
          `,
            )
            .join("")}
          <tr>
            <td class="right"><strong>Subtotal</strong></td>
            <td class="right"><strong>${escapeHtml(Number(t.subtotal || 0).toFixed(2))}</strong></td>
          </tr>
          <tr>
            <td class="right">Tax</td>
            <td class="right">${escapeHtml(Number(t.tax || 0).toFixed(2))}</td>
          </tr>
          <tr>
            <td class="right"><strong>Total</strong></td>
            <td class="right"><strong>${escapeHtml(Number(t.total || t.grand || 0).toFixed(2))}</strong></td>
          </tr>
        </tbody>
      </table>
      <div class="vh-footer" style="margin-top:10px;text-align:center;">
        <div>${escapeHtml(p.footerText || "")}</div>
      </div>
    </div>
    `;
  }
  function renderJournalVoucherHtml(data) {
    const c = data.company || {};
    const v = data.voucher || {};
    const items = Array.isArray(data.items) ? data.items : [];
    return `
    <div class="vh">
      <div class="vh-header">
        <div class="vh-logo">${c.logoHtml || ""}</div>
        <div class="vh-company">
          <div class="name">${escapeHtml(c.name || "")}</div>
          <div>${escapeHtml(c.addressLine1 || "")}</div>
          <div>${escapeHtml(c.addressLine2 || "")}</div>
          <div>Telephone: ${escapeHtml(c.phone || "")}</div>
          <div>Email: ${escapeHtml(c.email || "")}</div>
          <div>${escapeHtml(c.website || "")}</div>
          <div>TIN: ${escapeHtml(c.taxId || "")} &nbsp; Reg: ${escapeHtml(c.registrationNo || "")}</div>
        </div>
      </div>
      <div class="vh-titlebar">
        <div class="line"></div>
        <div class="title">* Journal Voucher *</div>
        <div class="line"></div>
      </div>
      <table class="vh-details">
        <tr>
          <td style="width:50%;vertical-align:top;border-right:1px solid #cbd5e1;">
            <table style="width:100%;">
              <tr><td class="label-wide">Voucher No</td><td>:</td><td>${escapeHtml(v.voucher_no || "")}</td></tr>
              <tr><td class="label-wide">Date/Time</td><td>:</td><td>${escapeHtml(v.voucher_date ? new Date(v.voucher_date).toLocaleString() : "")}</td></tr>
            </table>
          </td>
          <td style="width:50%;vertical-align:top;">
            <div style="padding:8px;">
              <div class="label">Narration</div>
              <div>${escapeHtml(v.narration || "")}</div>
            </div>
          </td>
        </tr>
      </table>
      <table class="vh-items">
        <thead>
          <tr>
            <th>Account</th>
            <th>Description</th>
            <th class="right" style="width:16%;">Debit</th>
            <th class="right" style="width:16%;">Credit</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (it) => `
            <tr>
              <td>${escapeHtml([it.account_code, it.account_name].filter(Boolean).join(" - "))}</td>
              <td>${escapeHtml(it.description || "")}</td>
              <td class="right">${escapeHtml(Number(it.debit || 0).toFixed(2))}</td>
              <td class="right">${escapeHtml(Number(it.credit || 0).toFixed(2))}</td>
            </tr>
          `,
            )
            .join("")}
          <tr>
            <td colspan="2" class="right"><strong>Totals</strong></td>
            <td class="right"><strong>${escapeHtml(
              Number(
                items.reduce((s, it) => s + Number(it.debit || 0), 0),
              ).toFixed(2),
            )}</strong></td>
            <td class="right"><strong>${escapeHtml(
              Number(
                items.reduce((s, it) => s + Number(it.credit || 0), 0),
              ).toFixed(2),
            )}</strong></td>
          </tr>
        </tbody>
      </table>
      <div class="vh-footer" style="margin-top:10px;text-align:center;">
        <div></div>
      </div>
    </div>
    `;
  }
  function buildReceiptVoucherTemplateDataFromApi(voucher, lines) {
    const logoUrl = String(companyInfo.logoUrl || "").trim();
    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="${escapeHtml(companyInfo.name || "Company")}" style="max-height:80px;object-fit:contain;" />`
      : "";
    const itemsArr = (Array.isArray(lines) ? lines : [])
      .filter((l) => Number(l.credit || 0) > 0)
      .map((l) => {
        const amt = Number(l.credit || 0);
        return {
          name: String(l.description || l.account_name || ""),
          qty: "1.00",
          price: amt.toFixed(2),
          discount: "0.00",
          lineTotal: amt.toFixed(2),
        };
      });
    const totals = itemsArr.reduce(
      (acc, it) => {
        const v = Number(it.lineTotal || 0);
        acc.subtotal += v;
        acc.total += v;
        return acc;
      },
      { subtotal: 0, total: 0 },
    );
    return {
      company: {
        name: companyInfo.name || "",
        addressLine1: companyInfo.address || "",
        addressLine2: [companyInfo.city, companyInfo.state, companyInfo.country]
          .filter(Boolean)
          .join(" • "),
        phone: companyInfo.phone || "",
        website: companyInfo.website || "",
        taxId: companyInfo.taxId || "",
        registrationNo: companyInfo.registrationNo || "",
        logoUrl,
        logoHtml,
      },
      receipt: {
        receiptNo: String(voucher.voucher_no || ""),
        dateTime: voucher.voucher_date
          ? new Date(voucher.voucher_date).toLocaleString()
          : new Date().toLocaleString(),
        paymentMethod: "",
        headerText: "",
        footerText: "",
      },
      items: itemsArr,
      totals: {
        subtotal: totals.subtotal.toFixed(2),
        tax: "0.00",
        total: totals.total.toFixed(2),
      },
    };
  }
  function buildPaymentVoucherTemplateDataFromApi(voucher, lines) {
    const logoUrl = String(companyInfo.logoUrl || "").trim();
    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="${escapeHtml(companyInfo.name || "Company")}" style="max-height:80px;object-fit:contain;" />`
      : "";
    const itemsArr = (Array.isArray(lines) ? lines : [])
      .filter((l) => Number(l.debit || 0) > 0)
      .map((l) => {
        const amt = Number(l.debit || 0);
        return {
          name: String(l.description || l.account_name || ""),
          qty: "1.00",
          price: amt.toFixed(2),
          discount: "0.00",
          lineTotal: amt.toFixed(2),
        };
      });
    const totals = itemsArr.reduce(
      (acc, it) => {
        const v = Number(it.lineTotal || 0);
        acc.subtotal += v;
        acc.total += v;
        return acc;
      },
      { subtotal: 0, total: 0 },
    );
    return {
      company: {
        name: companyInfo.name || "",
        addressLine1: companyInfo.address || "",
        addressLine2: [companyInfo.city, companyInfo.state, companyInfo.country]
          .filter(Boolean)
          .join(" • "),
        phone: companyInfo.phone || "",
        website: companyInfo.website || "",
        taxId: companyInfo.taxId || "",
        registrationNo: companyInfo.registrationNo || "",
        logoUrl,
        logoHtml,
      },
      payment: {
        paymentNo: String(voucher.voucher_no || ""),
        dateTime: voucher.voucher_date
          ? new Date(voucher.voucher_date).toLocaleString()
          : new Date().toLocaleString(),
        paymentMethod: "",
        headerText: "",
        footerText: "",
      },
      items: itemsArr,
      totals: {
        subtotal: totals.subtotal.toFixed(2),
        tax: "0.00",
        total: totals.total.toFixed(2),
      },
    };
  }
  function buildJournalVoucherTemplateDataFromApi(voucher, lines) {
    const logoUrl = String(companyInfo.logoUrl || "").trim();
    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="${escapeHtml(
          companyInfo.name || "Company",
        )}" style="max-height:80px;object-fit:contain;" />`
      : "";
    return {
      company: {
        name: companyInfo.name || "",
        addressLine1: companyInfo.address || "",
        addressLine2: [companyInfo.city, companyInfo.state, companyInfo.country]
          .filter(Boolean)
          .join(" • "),
        phone: companyInfo.phone || "",
        website: companyInfo.website || "",
        taxId: companyInfo.taxId || "",
        registrationNo: companyInfo.registrationNo || "",
        logoUrl,
        logoHtml,
      },
      voucher: {
        id: voucher.id,
        voucher_no: String(voucher.voucher_no || ""),
        voucher_date: voucher.voucher_date || "",
        narration: voucher.narration || "",
        total_debit: Number(voucher.total_debit || 0),
        total_credit: Number(voucher.total_credit || 0),
        type_code: voucher.voucher_type_code || "JV",
        type_name: voucher.voucher_type_name || "Journal Voucher",
      },
      items: (Array.isArray(lines) ? lines : []).map((l) => ({
        account_code: l.account_code,
        account_name: l.account_name,
        description: l.description,
        debit: Number(l.debit || 0),
        credit: Number(l.credit || 0),
      })),
    };
  }
  async function printVoucher(id) {
    try {
      const res = await api.get(`/finance/vouchers/${id}`);
      const v = res.data?.voucher || {};
      const lines = Array.isArray(res.data?.lines) ? res.data.lines : [];
      const body = isRV
        ? renderReceiptVoucherHtml(
            buildReceiptVoucherTemplateDataFromApi(v, lines),
          )
        : isPV
          ? renderPaymentVoucherHtml(
              buildPaymentVoucherTemplateDataFromApi(v, lines),
            )
          : isJV
            ? renderJournalVoucherHtml(
                buildJournalVoucherTemplateDataFromApi(v, lines),
              )
            : "";
      const html = wrapDoc(body);
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
        window.print();
        return;
      }
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
    } catch {}
  }
  async function downloadVoucherPdf(id) {
    try {
      const res = await api.get(`/finance/vouchers/${id}`);
      const v = res.data?.voucher || {};
      const lines = Array.isArray(res.data?.lines) ? res.data.lines : [];
      const body = isRV
        ? renderReceiptVoucherHtml(
            buildReceiptVoucherTemplateDataFromApi(v, lines),
          )
        : isPV
          ? renderPaymentVoucherHtml(
              buildPaymentVoucherTemplateDataFromApi(v, lines),
            )
          : isJV
            ? renderJournalVoucherHtml(
                buildJournalVoucherTemplateDataFromApi(v, lines),
              )
            : "";
      if (!body) return;
      const container = document.createElement("div");
      container.style.position = "fixed";
      container.style.left = "-10000px";
      container.style.top = "0";
      container.style.width = "794px";
      container.style.background = "white";
      container.style.padding = "32px";
      container.innerHTML = body;
      document.body.appendChild(container);
      try {
        await waitForImages(container);
        const canvas = await html2canvas(container, {
          scale: 2,
          useCORS: true,
        });
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
        const fname =
          (isRV
            ? "ReceiptVoucher_"
            : isPV
              ? "PaymentVoucher_"
              : isJV
                ? "JournalVoucher_"
                : "Voucher_") +
          (String(v.voucher_no || "").replaceAll(" ", "_") ||
            new Date().toISOString().slice(0, 10)) +
          ".pdf";
        pdf.save(fname);
      } finally {
        document.body.removeChild(container);
      }
    } catch {}
  }

  async function reverseVoucher(id) {
    try {
      const reason = window.prompt("Reason for reversal (optional):") || "";
      await api.post(`/finance/vouchers/${id}/reverse`, { reason });
      toast.success("Voucher reversed");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to reverse voucher");
    }
  }

  async function openForwardModal(v) {
    setSelectedVoucher(v);
    setShowForwardModal(true);
    setWfError("");
    if (!workflowsCache) {
      try {
        setWfLoading(true);
        const res = await api.get("/workflows");
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        setWorkflowsCache(items);
        await computeCandidateFromList(items);
      } catch (e) {
        setWfError(e?.response?.data?.message || "Failed to load workflows");
      } finally {
        setWfLoading(false);
      }
    } else {
      await computeCandidate();
    }
  }

  async function computeCandidate() {
    if (!workflowsCache || !workflowsCache.length) {
      setCandidateWorkflow(null);
      setFirstApprover(null);
      setWorkflowSteps([]);
      setWfError("");
      return;
    }
    const route = isPV
      ? "/finance/payment-voucher"
      : isRV
        ? "/finance/receipt-voucher"
        : isCV
          ? "/finance/contra-voucher"
          : "/finance/journal-voucher";
    const synonyms = isPV
      ? ["PAYMENT_VOUCHER", "Payment Voucher", "PV"]
      : isRV
        ? ["RECEIPT_VOUCHER", "Receipt Voucher", "RV"]
        : isCV
          ? ["CONTRA_VOUCHER", "Contra Voucher", "CV"]
          : ["JOURNAL_VOUCHER", "Journal Voucher", "JV"];
    const normalize = (s) =>
      String(s || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");
    const chosen =
      workflowsCache.find(
        (w) =>
          Number(w.is_active) === 1 && String(w.document_route || "") === route,
      ) ||
      workflowsCache.find(
        (w) =>
          Number(w.is_active) === 1 &&
          (normalize(w.document_type) === normalize(synonyms[0]) ||
            normalize(w.document_type) === normalize(synonyms[1]) ||
            normalize(w.document_type) === normalize(synonyms[2])),
      ) ||
      null;
    setCandidateWorkflow(chosen || null);
    setFirstApprover(null);
    setTargetApproverId(null);
    setWorkflowSteps([]);
    if (!chosen) return;
    try {
      setWfLoading(true);
      const res = await api.get(`/workflows/${chosen.id}`);
      const item = res?.data?.item || {};
      const steps = Array.isArray(item?.steps) ? item.steps : [];
      setWorkflowSteps(steps);
      const first = steps[0] || null;
      setFirstApprover(
        first
          ? {
              userId: first.approver_user_id,
              name: first.approver_name,
              stepName: first.step_name,
              stepOrder: first.step_order,
              approvalLimit: first.approval_limit,
            }
          : null,
      );
      if (first) {
        const defaultTarget =
          (Array.isArray(first.approvers) && first.approvers.length
            ? first.approvers[0].id
            : first.approver_user_id) || null;
        setTargetApproverId(defaultTarget);
      } else {
        setTargetApproverId(null);
      }
    } catch (e) {
      setWfError(
        e?.response?.data?.message || "Failed to load workflow details",
      );
    } finally {
      setWfLoading(false);
    }
  }

  async function computeCandidateFromList(items) {
    if (!items || !items.length) {
      setCandidateWorkflow(null);
      setFirstApprover(null);
      setWorkflowSteps([]);
      setWfError("");
      return;
    }
    const route = isPV
      ? "/finance/payment-voucher"
      : isRV
        ? "/finance/receipt-voucher"
        : isCV
          ? "/finance/contra-voucher"
          : "/finance/journal-voucher";
    const synonyms = isPV
      ? ["PAYMENT_VOUCHER", "Payment Voucher", "PV"]
      : isRV
        ? ["RECEIPT_VOUCHER", "Receipt Voucher", "RV"]
        : isCV
          ? ["CONTRA_VOUCHER", "Contra Voucher", "CV"]
          : ["JOURNAL_VOUCHER", "Journal Voucher", "JV"];
    const normalize = (s) =>
      String(s || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");
    const chosen =
      items.find(
        (w) =>
          Number(w.is_active) === 1 && String(w.document_route || "") === route,
      ) ||
      items.find(
        (w) =>
          Number(w.is_active) === 1 &&
          (normalize(w.document_type) === normalize(synonyms[0]) ||
            normalize(w.document_type) === normalize(synonyms[1]) ||
            normalize(w.document_type) === normalize(synonyms[2])),
      ) ||
      null;
    setCandidateWorkflow(chosen || null);
    setFirstApprover(null);
    setTargetApproverId(null);
    setWorkflowSteps([]);
    if (!chosen) return;
    try {
      setWfLoading(true);
      const res = await api.get(`/workflows/${chosen.id}`);
      const item = res?.data?.item || {};
      const steps = Array.isArray(item?.steps) ? item.steps : [];
      setWorkflowSteps(steps);
      const first = steps[0] || null;
      setFirstApprover(
        first
          ? {
              userId: first.approver_user_id,
              name: first.approver_name,
              stepName: first.step_name,
              stepOrder: first.step_order,
              approvalLimit: first.approval_limit,
            }
          : null,
      );
      if (first) {
        const defaultTarget =
          (Array.isArray(first.approvers) && first.approvers.length
            ? first.approvers[0].id
            : first.approver_user_id) || null;
        setTargetApproverId(defaultTarget);
      } else {
        setTargetApproverId(null);
      }
    } catch (e) {
      setWfError(
        e?.response?.data?.message || "Failed to load workflow details",
      );
    } finally {
      setWfLoading(false);
    }
  }

  async function forwardDocument() {
    if (!selectedVoucher) return;
    setSubmittingForward(true);
    setWfError("");
    // Optimistic update
    let optimisticApprover = null;
    try {
      const first =
        Array.isArray(workflowSteps) && workflowSteps.length
          ? workflowSteps[0]
          : null;
      const opts = first
        ? Array.isArray(first.approvers) && first.approvers.length
          ? first.approvers.map((u) => ({ id: u.id, name: u.username }))
          : first.approver_user_id
            ? [
                {
                  id: first.approver_user_id,
                  name: first.approver_name || String(first.approver_user_id),
                },
              ]
            : []
        : [];
      if (targetApproverId && opts.length) {
        const hit = opts.find((u) => Number(u.id) === Number(targetApproverId));
        optimisticApprover = hit ? hit.name : null;
      }
    } catch {}
    setItems((prev) =>
      prev.map((x) =>
        x.id === selectedVoucher.id
          ? {
              ...x,
              status: "PENDING_APPROVAL",
              forwarded_to_username:
                optimisticApprover || x.forwarded_to_username || "Approver",
            }
          : x,
      ),
    );
    setShowForwardModal(false);
    setSelectedVoucher(null);
    try {
      const amount =
        selectedVoucher.total_debit === undefined ||
        selectedVoucher.total_debit === null
          ? selectedVoucher.total_credit === undefined ||
            selectedVoucher.total_credit === null
            ? null
            : Number(selectedVoucher.total_credit || 0)
          : Number(selectedVoucher.total_debit || 0);
      const res = await api.post(
        `/finance/vouchers/${selectedVoucher.id}/submit`,
        {
          amount,
          workflow_id: candidateWorkflow ? candidateWorkflow.id : null,
          target_user_id: targetApproverId || null,
        },
      );
      const newStatus = res?.data?.status || "PENDING_APPROVAL";
      let approverName = null;
      try {
        const first =
          Array.isArray(workflowSteps) && workflowSteps.length
            ? workflowSteps[0]
            : null;
        const opts = first
          ? Array.isArray(first.approvers) && first.approvers.length
            ? first.approvers.map((u) => ({
                id: u.id,
                name: u.username,
              }))
            : first.approver_user_id
              ? [
                  {
                    id: first.approver_user_id,
                    name: first.approver_name || String(first.approver_user_id),
                  },
                ]
              : []
          : [];
        if (targetApproverId && opts.length) {
          const hit = opts.find(
            (u) => Number(u.id) === Number(targetApproverId),
          );
          approverName = hit ? hit.name : null;
        }
      } catch {}
      setItems((prev) =>
        prev.map((x) =>
          x.id === selectedVoucher.id
            ? {
                ...x,
                status: newStatus,
                forwarded_to_username:
                  approverName || x.forwarded_to_username || "Approver",
              }
            : x,
        ),
      );
      try {
        toast.success("Voucher forwarded for approval");
      } catch {}
    } catch (e) {
      setWfError(
        e?.response?.data?.message || "Failed to forward for approval",
      );
    } finally {
      setSubmittingForward(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">{title}</h1>
            <p className="text-sm mt-1">List, review, and manage vouchers</p>
          </div>
          <div className="flex gap-2">
            <Link to="/finance" className="btn btn-secondary">
              Return to Menu
            </Link>
            <button
              type="button"
              className="btn-success"
              onClick={load}
              disabled={loading}
            >
              Refresh
            </button>
            <Link to={`./create`} className="btn-success">
              Create New
            </Link>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <input
                className="input"
                placeholder="Search voucher no or narration..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="w-full md:w-56">
              <select
                className="input"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="ALL">All Status</option>
                <option value="DRAFT">Draft</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="APPROVED">Approved</option>
                <option value="POSTED">Posted</option>
                <option value="REVERSED">Reversed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
              <div className="mt-2">Loading...</div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">No vouchers found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Voucher No</th>
                    <th>Date</th>
                    <th>Narration</th>
                    <th className="text-right">Debit</th>
                    <th className="text-right">Credit</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v) => (
                    <tr key={v.id}>
                      <td className="font-medium">{v.voucher_no}</td>
                      <td>{new Date(v.voucher_date).toLocaleDateString()}</td>
                      <td>{renderNarration(v)}</td>
                      <td className="text-right">
                        {`GH₵ ${Number(v.total_debit || 0).toLocaleString()}`}
                      </td>
                      <td className="text-right">
                        {`GH₵ ${Number(v.total_credit || 0).toLocaleString()}`}
                      </td>
                      <td>
                        <StatusBadge status={v.status} />
                      </td>
                      <td>
                        <div className="flex gap-3">
                          {canPerformAction("finance:vouchers", "view") && (
                            <Link
                              to={`/finance/${basePath}/${v.id}?mode=view`}
                              className="text-brand hover:text-brand-600 font-medium text-sm"
                            >
                              View
                            </Link>
                          )}
                          {canPerformAction("finance:vouchers", "edit") &&
                            !["APPROVED", "POSTED"].includes(
                              String(v.status || "").toUpperCase(),
                            ) && (
                              <Link
                                to={`/finance/${basePath}/${v.id}?mode=edit`}
                                className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                              >
                                Edit
                              </Link>
                            )}
                          {(isPV || isRV || isJV) && (
                            <>
                              <button
                                type="button"
                                className="inline-flex items-center px-3 py-1.5 rounded bg-green-600 hover:bg-green-700 text-white text-xs font-semibold"
                                onClick={() => printVoucher(v.id)}
                              >
                                Print
                              </button>
                              <button
                                type="button"
                                className="inline-flex items-center px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold"
                                onClick={() => downloadVoucherPdf(v.id)}
                              >
                                PDF
                              </button>
                            </>
                          )}
                          {(isPV || isRV || isCV || isJV) &&
                            (v.status === "APPROVED" ? (
                              <>
                                <span className="ml-3 text-sm font-medium px-2 py-1 rounded bg-green-500 text-white">
                                  Approved
                                </span>
                                <ReverseApprovalButton
                                  docType={
                                    isPV
                                      ? "PAYMENT_VOUCHER"
                                      : isRV
                                        ? "RECEIPT_VOUCHER"
                                        : isCV
                                          ? "CONTRA_VOUCHER"
                                          : "JOURNAL_VOUCHER"
                                  }
                                  docId={v.id}
                                  className="ml-2 text-indigo-700 hover:text-indigo-800 text-xs font-medium"
                                  onDone={() =>
                                    setItems((prev) =>
                                      prev.map((x) =>
                                        x.id === v.id
                                          ? {
                                              ...x,
                                              status: "REVERSED",
                                              forwarded_to_username: null,
                                            }
                                          : x,
                                      ),
                                    )
                                  }
                                />
                              </>
                            ) : v.forwarded_to_username ? (
                              <span className="ml-3 text-sm font-medium px-2 py-1 rounded bg-amber-500 text-white">
                                Forwarded to {v.forwarded_to_username}
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="ml-3 text-sm font-medium px-2 py-1 rounded bg-brand text-white hover:bg-brand-700 transition-colors"
                                onClick={() => openForwardModal(v)}
                                disabled={
                                  submittingForward ||
                                  v.status === "POSTED" ||
                                  v.status === "REJECTED" ||
                                  v.status === "PENDING_APPROVAL" ||
                                  v.status === "SUBMITTED"
                                }
                              >
                                Forward for Approval
                              </button>
                            ))}
                          {!isPV && !isRV && !isCV && !isJV && (
                            <button
                              type="button"
                              className="text-red-600 hover:text-red-700 font-medium text-sm"
                              onClick={() => reverseVoucher(v.id)}
                              disabled={v.status === "REVERSED"}
                            >
                              Reverse
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {showForwardModal ? (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-erp w/full max-w-md overflow-hidden">
            <div className="p-4 bg-brand text-white flex justify-between items-center">
              <h2 className="text-lg font-bold">Forward for Approval</h2>
              <button
                onClick={() => {
                  setShowForwardModal(false);
                  setSelectedVoucher(null);
                  setCandidateWorkflow(null);
                  setFirstApprover(null);
                  setTargetApproverId(null);
                  setWorkflowSteps([]);
                  setWfError("");
                }}
                className="text-white hover:text-slate-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-sm text-slate-700">
                Voucher:{" "}
                <span className="font-semibold">
                  {selectedVoucher?.voucher_no}
                </span>
              </div>
              <div className="text-sm text-slate-700">
                Workflow:{" "}
                <span className="font-semibold">
                  {candidateWorkflow
                    ? `${candidateWorkflow.workflow_name} (${candidateWorkflow.workflow_code})`
                    : "None (inactive)"}
                </span>
              </div>
              <div>
                {wfLoading ? (
                  <div className="text-sm">Loading workflow...</div>
                ) : null}
                {wfError ? (
                  <div className="text-sm text-red-600">{wfError}</div>
                ) : null}
              </div>
              <div className="text-sm">
                <div className="font-medium">Target Approver</div>
                {(() => {
                  const hasSteps =
                    Array.isArray(workflowSteps) && workflowSteps.length > 0;
                  const first = hasSteps ? workflowSteps[0] : null;
                  const opts = first
                    ? Array.isArray(first.approvers) && first.approvers.length
                      ? first.approvers.map((u) => ({
                          id: u.id,
                          name: u.username,
                        }))
                      : first.approver_user_id
                        ? [
                            {
                              id: first.approver_user_id,
                              name:
                                first.approver_name ||
                                String(first.approver_user_id),
                            },
                          ]
                        : []
                    : [];
                  return opts.length > 0 ? (
                    <div className="mt-1">
                      <select
                        className="input w-full"
                        value={targetApproverId || ""}
                        onChange={(e) =>
                          setTargetApproverId(
                            e.target.value ? Number(e.target.value) : null,
                          )
                        }
                      >
                        <option value="">Select target approver</option>
                        {opts.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                      <div className="text-xs text-slate-600 mt-1">
                        {firstApprover
                          ? `Step ${firstApprover.stepOrder} • ${firstApprover.stepName}${
                              firstApprover.approvalLimit != null
                                ? ` • Limit: ${Number(
                                    firstApprover.approvalLimit,
                                  ).toLocaleString()}`
                                : ""
                            }`
                          : ""}
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-600">
                      {candidateWorkflow
                        ? "No approver found in workflow definition"
                        : "No active workflow; default behavior will apply"}
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2 bg-gray-50">
              <button
                type="button"
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                onClick={() => {
                  setShowForwardModal(false);
                  setSelectedVoucher(null);
                  setCandidateWorkflow(null);
                  setFirstApprover(null);
                  setTargetApproverId(null);
                  setWorkflowSteps([]);
                  setWfError("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-700"
                onClick={forwardDocument}
                disabled={
                  submittingForward ||
                  !selectedVoucher ||
                  (Array.isArray(workflowSteps) &&
                    workflowSteps.length > 0 &&
                    candidateWorkflow &&
                    !targetApproverId)
                }
              >
                {submittingForward ? "Forwarding..." : "Forward"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
