import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "api/client";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

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
    <title>Payslip</title>
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

async function waitForImages(container) {
  const imgs = Array.from(container?.querySelectorAll?.("img") || []);
  if (imgs.length === 0) return;
  await Promise.race([
    Promise.all(
      imgs.map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete) return resolve();
            const done = () => resolve();
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
          }),
      ),
    ),
    new Promise((r) => setTimeout(r, 1500)),
  ]);
}

export default function PayslipForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    period: "",
    employee: "",
    netPay: 0,
    status: "GENERATED",
  });
  const [templateHtml, setTemplateHtml] = useState(null);
  const [companyInfo, setCompanyInfo] = useState({
    name: "",
    address: "",
    logoUrl: "",
  });

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    setTimeout(() => {
      setForm({
        period: "2025-01",
        employee: "John Doe",
        netPay: 2500,
        status: "GENERATED",
      });
      setLoading(false);
    }, 150);
  }, [isEdit]);

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
          name: String(item.name || ""),
          address: String(item.address || ""),
          logoUrl: String(logoUrl || ""),
        });
      } catch {}
    }
    loadCompany();
    return () => {
      mounted = false;
    };
  }, []);

  const sampleData = useMemo(() => {
    const logoUrl = String(companyInfo.logoUrl || "").trim();
    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="${escapeHtml(companyInfo.name || "Company")}" style="max-height:80px;object-fit:contain;" />`
      : "";
    return {
      company: {
        name: companyInfo.name || "OmniSuite Ltd",
        address: companyInfo.address || "123 Business Rd",
        logoUrl,
        logoHtml,
      },
      payslip: {
        period: String(form.period || ""),
        employee: String(form.employee || ""),
        netPay: Number(form.netPay || 0).toFixed(2),
        status: String(form.status || ""),
      },
    };
  }, [form, companyInfo]);

  function update(name, value) {
    setForm((p) => ({ ...p, [name]: value }));
  }

  const fetchPayslipTemplateHtml = async () => {
    if (templateHtml !== null) return templateHtml;
    try {
      const res = await api.get("/admin/document-templates/PAYSLIP");
      const tpl = String(res.data?.item?.template_html || "").trim();
      setTemplateHtml(tpl);
      return tpl;
    } catch {
      setTemplateHtml("");
      return "";
    }
  };

  async function printPayslip() {
    const tpl = await fetchPayslipTemplateHtml();
    const body = tpl
      ? renderTemplateString(tpl, sampleData)
      : `<div>
  <div style="font-weight:800;font-size:18px;">Payslip</div>
  <div>Period: ${escapeHtml(sampleData.payslip.period)}</div>
  <div>Employee: ${escapeHtml(sampleData.payslip.employee)}</div>
  <div>Net Pay: ${escapeHtml(sampleData.payslip.netPay)}</div>
  <div>Status: ${escapeHtml(sampleData.payslip.status)}</div>
</div>`;
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
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();
    const win = iframe.contentWindow || window;
    const handlePrint = () => {
      win.focus();
      try {
        win.print();
      } catch {}
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 100);
    };
    setTimeout(handlePrint, 200);
  }

  async function downloadPayslipPdf() {
    const tpl = await fetchPayslipTemplateHtml();
    const body = tpl
      ? renderTemplateString(tpl, sampleData)
      : `<div>
  <div style="font-weight:800;font-size:18px;">Payslip</div>
  <div>Period: ${escapeHtml(sampleData.payslip.period)}</div>
  <div>Employee: ${escapeHtml(sampleData.payslip.employee)}</div>
  <div>Net Pay: ${escapeHtml(sampleData.payslip.netPay)}</div>
  <div>Status: ${escapeHtml(sampleData.payslip.status)}</div>
</div>`;
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
      const fname =
        "Payslip_" +
        (sampleData.payslip.period || new Date().toISOString().slice(0, 10)) +
        ".pdf";
      pdf.save(fname);
    } finally {
      document.body.removeChild(container);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      navigate("/human-resources/payslips");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              {isEdit ? "Edit Payslip" : "New Payslip"}
            </h1>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={printPayslip}
            >
              Print
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={downloadPayslipPdf}
            >
              Download PDF
            </button>
            <Link to="/human-resources/payslips" className="btn-success">
              Back
            </Link>
          </div>
        </div>
      </div>

      <form onSubmit={submit}>
        <div className="card">
          <div className="card-body space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Period *</label>
                <input
                  className="input"
                  value={form.period}
                  onChange={(e) => update("period", e.target.value)}
                  required
                  placeholder="YYYY-MM"
                />
              </div>
              <div>
                <label className="label">Employee *</label>
                <input
                  className="input"
                  value={form.employee}
                  onChange={(e) => update("employee", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Net Pay</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.netPay}
                  onChange={(e) => update("netPay", Number(e.target.value))}
                />
              </div>
              <div>
                <label className="label">Status</label>
                <select
                  className="input"
                  value={form.status}
                  onChange={(e) => update("status", e.target.value)}
                >
                  <option value="GENERATED">Generated</option>
                  <option value="PAID">Paid</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Link to="/human-resources/payslips" className="btn-success">
                Cancel
              </Link>
              <button className="btn-success" disabled={loading}>
                {loading ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
