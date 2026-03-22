import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import { toast } from "react-toastify";

export default function PayslipList() {
  const { canPerformAction } = usePermission();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [companyInfo, setCompanyInfo] = useState({
    name: "",
    address: "",
    logoUrl: "",
  });

  const loadPayslips = async () => {
    setLoading(true);
    try {
      const res = await api.get("/hr/payslips");
      setItems(res?.data?.items || []);
    } catch {
      toast.error("Failed to load payslips");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayslips();
  }, []);

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

  const sendEmail = async (r) => {
    try {
      await api.post("/hr/payslips/send-email", { payslipId: r.id });
      toast.success(`Payslip sent to ${r.email}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send email");
    }
  };

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
  const buildPayslipData = (r) => {
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
        period: String(r.period || ""),
        employee: String(r.employee || ""),
        netPay: Number(r.netPay || 0).toFixed(2),
        status: String(r.status || ""),
      },
    };
  };
  async function printPayslip(r) {
    const body = `<div>
  <div style="font-weight:800;font-size:18px;">Payslip</div>
  <div>Period: ${escapeHtml(String(r.period || ""))}</div>
  <div>Employee: ${escapeHtml(String(r.employee || ""))}</div>
  <div>Net Pay: ${escapeHtml(Number(r.netPay || 0).toFixed(2))}</div>
  <div>Status: ${escapeHtml(String(r.status || ""))}</div>
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
    const doc = iframe.contentWindow?.document || iframe.contentDocument || null;
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
  async function downloadPayslipPdf(r) {
    const body = `<div>
  <div style="font-weight:800;font-size:18px;">Payslip</div>
  <div>Period: ${escapeHtml(String(r.period || ""))}</div>
  <div>Employee: ${escapeHtml(String(r.employee || ""))}</div>
  <div>Net Pay: ${escapeHtml(Number(r.netPay || 0).toFixed(2))}</div>
  <div>Status: ${escapeHtml(String(r.status || ""))}</div>
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
        (String(r.period || "").replaceAll(" ", "_") ||
          new Date().toISOString().slice(0, 10)) +
        ".pdf";
      pdf.save(fname);
    } finally {
      document.body.removeChild(container);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card"><div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
        <div><h1 className="text-2xl font-bold dark:text-brand-300">Payslips</h1><p className="text-sm mt-1">Payslip configuration (placeholder)</p></div>
        <div className="flex gap-2">
          <Link to="/human-resources" className="btn btn-secondary">Return to Menu</Link>
          <Link to="/human-resources/payslips/new" className="btn-success">+ New</Link>
        </div>
      </div></div>

      <div className="card"><div className="card-body overflow-x-auto">
        <table className="table"><thead><tr><th>Period</th><th>Employee</th><th className="text-right">Net Pay</th><th>Status</th><th /></tr></thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td>{r.period_name}</td>
                <td>
                  <div className="font-medium">{r.first_name} {r.last_name}</div>
                  <div className="text-xs text-slate-500">{r.emp_code}</div>
                </td>
                <td className="text-right font-medium">{Number(r.net_salary || 0).toLocaleString()}</td>
                <td>
                  <span className={`badge ${r.status === 'PAID' ? 'badge-success' : 'badge-warning'}`}>
                    {r.status}
                  </span>
                </td>
                <td className="text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => printPayslip(r)} className="btn btn-ghost btn-xs">Print</button>
                    <button onClick={() => downloadPayslipPdf(r)} className="btn btn-ghost btn-xs">PDF</button>
                    <button onClick={() => sendEmail(r)} className="btn btn-brand btn-xs">Email</button>
                  </div>
                </td>
              </tr>
            ))}
            {!items.length && !loading && (
              <tr><td colSpan={5} className="text-center py-8 text-slate-500">No payslips found</td></tr>
            )}
          </tbody>
        </table>
      </div></div>
    </div>
  );
}






