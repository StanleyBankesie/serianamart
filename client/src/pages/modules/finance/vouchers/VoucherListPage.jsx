import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";

import { api } from "api/client";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

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
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const isPV = String(voucherTypeCode).toUpperCase() === "PV";
  const isRV = String(voucherTypeCode).toUpperCase() === "RV";
  const isCV = String(voucherTypeCode).toUpperCase() === "CV";
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
    load();
    if (isCV) loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voucherTypeCode]);
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
    return items.filter((v) => {
      const s = search.trim().toLowerCase();
      const matchesSearch =
        !s ||
        String(v.voucher_no || "")
          .toLowerCase()
          .includes(s) ||
        String(v.narration || "")
          .toLowerCase()
          .includes(s);
      const matchesStatus = status === "ALL" || v.status === status;
      return matchesSearch && matchesStatus;
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
    <title>Voucher</title>
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
  const fetchReceiptTemplateHtml = async () => {
    if (receiptTemplateHtml !== null) return receiptTemplateHtml;
    try {
      const res = await api.get("/admin/document-templates/RECEIPT_VOUCHER");
      const tpl = String(res.data?.item?.template_html || "").trim();
      setReceiptTemplateHtml(tpl);
      return tpl;
    } catch {
      setReceiptTemplateHtml("");
      return "";
    }
  };
  const fetchPaymentTemplateHtml = async () => {
    if (paymentTemplateHtml !== null) return paymentTemplateHtml;
    try {
      const res = await api.get("/admin/document-templates/PAYMENT_VOUCHER");
      const tpl = String(res.data?.item?.template_html || "").trim();
      setPaymentTemplateHtml(tpl);
      return tpl;
    } catch {
      setPaymentTemplateHtml("");
      return "";
    }
  };
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
  async function printVoucher(id) {
    try {
      const res = await api.get(`/finance/vouchers/${id}`);
      const v = res.data?.voucher || {};
      const lines = Array.isArray(res.data?.lines) ? res.data.lines : [];
      if (isRV) {
        const tpl = await fetchReceiptTemplateHtml();
        if (tpl) {
          const body = renderTemplateString(
            tpl,
            buildReceiptVoucherTemplateDataFromApi(v, lines),
          );
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
          return;
        }
      } else if (isPV) {
        const tpl = await fetchPaymentTemplateHtml();
        if (tpl) {
          const body = renderTemplateString(
            tpl,
            buildPaymentVoucherTemplateDataFromApi(v, lines),
          );
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
          return;
        }
      }
      window.print();
    } catch {}
  }
  async function downloadVoucherPdf(id) {
    try {
      const res = await api.get(`/finance/vouchers/${id}`);
      const v = res.data?.voucher || {};
      const lines = Array.isArray(res.data?.lines) ? res.data.lines : [];
      let html = "";
      if (isRV) {
        const tpl = await fetchReceiptTemplateHtml();
        const body = tpl
          ? renderTemplateString(
              tpl,
              buildReceiptVoucherTemplateDataFromApi(v, lines),
            )
          : "";
        html = body || "";
      } else if (isPV) {
        const tpl = await fetchPaymentTemplateHtml();
        const body = tpl
          ? renderTemplateString(
              tpl,
              buildPaymentVoucherTemplateDataFromApi(v, lines),
            )
          : "";
        html = body || "";
      }
      if (!html) return;
      const container = document.createElement("div");
      container.style.position = "fixed";
      container.style.left = "-10000px";
      container.style.top = "0";
      container.style.width = "794px";
      container.style.background = "white";
      container.style.padding = "32px";
      container.innerHTML = html;
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
          (isRV ? "ReceiptVoucher_" : isPV ? "PaymentVoucher_" : "Voucher_") +
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
        : "/finance/contra-voucher";
    const synonyms = isPV
      ? ["PAYMENT_VOUCHER", "Payment Voucher", "PV"]
      : isRV
        ? ["RECEIPT_VOUCHER", "Receipt Voucher", "RV"]
        : ["CONTRA_VOUCHER", "Contra Voucher", "CV"];
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
        : "/finance/contra-voucher";
    const synonyms = isPV
      ? ["PAYMENT_VOUCHER", "Payment Voucher", "PV"]
      : isRV
        ? ["RECEIPT_VOUCHER", "Receipt Voucher", "RV"]
        : ["CONTRA_VOUCHER", "Contra Voucher", "CV"];
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
      setItems((prev) =>
        prev.map((x) =>
          x.id === selectedVoucher.id ? { ...x, status: newStatus } : x,
        ),
      );
      setShowForwardModal(false);
      setSelectedVoucher(null);
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
                          <Link
                            to={`/finance/${basePath}/${v.id}?mode=view`}
                            className="text-brand hover:text-brand-600 font-medium text-sm"
                          >
                            View
                          </Link>
                          <Link
                            to={`/finance/${basePath}/${v.id}?mode=edit`}
                            className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                            style={{
                              display:
                                (isPV || isRV) && v.status === "APPROVED"
                                  ? "none"
                                  : "inline",
                            }}
                          >
                            Edit
                          </Link>
                          {(isPV || isRV) && (
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
                          {(isPV || isRV || isCV) &&
                            (v.status === "APPROVED" ? (
                              <span className="ml-3 text-sm font-medium px-2 py-1 rounded bg-green-500 text-white">
                                Approved
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
                          {!isPV && !isRV && !isCV && (
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
