import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../../api/client";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { usePermission } from "../../../../auth/PermissionContext.jsx";

export default function QuotationList() {
  const navigate = useNavigate();
  const { canPerformAction } = usePermission();
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [companyInfo, setCompanyInfo] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    country: "",
    postalCode: "",
    phone: "",
    email: "",
    website: "",
    taxId: "",
    registrationNo: "",
    logoUrl: "",
  });

  useEffect(() => {
    fetchQuotations();
  }, []);

  const fetchQuotations = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await api.get("/sales/quotations");
      const items =
        (response.data && response.data.data && response.data.data.items) ||
        response.data?.items ||
        [];
      setQuotations(Array.isArray(items) ? items : []);
    } catch (error) {
      setError(error?.response?.data?.message || "Error fetching quotations");
      console.error("Error fetching quotations:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    async function fetchCompanyInfo() {
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
          name: item.name || "Company",
          address: item.address || "",
          city: item.city || "",
          state: item.state || "",
          country: item.country || "",
          postalCode: item.postal_code || "",
          phone: item.telephone || "",
          email: item.email || "",
          website: item.website || "",
          taxId: item.tax_id || "",
          registrationNo: item.registration_no || "",
          logoUrl: String(logoUrl || ""),
        });
      } catch {}
    }
    fetchCompanyInfo();
    return () => {
      mounted = false;
    };
  }, []);

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
    <title>Quotation</title>
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
  const buildQuotationTemplateDataFromApi = (header, details) => {
    const logoUrl = String(companyInfo.logoUrl || "").trim();
    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="${escapeHtml(companyInfo.name || "Company")}" style="max-height:80px;object-fit:contain;" />`
      : "";
    const items = (Array.isArray(details) ? details : []).map((d) => {
      const qty = Number(d.qty ?? d.quantity ?? 0);
      const unit = Number(d.unit_price ?? 0);
      const disc = Number(d.discount_percent ?? 0);
      const net = Number(
        d.net_amount ?? qty * unit - (qty * unit * disc) / 100,
      );
      return {
        item_name: String(d.item_name || ""),
        qty: qty.toFixed(2),
        unit_price: unit.toFixed(2),
        discount: disc.toFixed(2),
        net: net.toFixed(2),
      };
    });
    const subtotal = items.reduce(
      (s, it) => s + Number(it.qty) * Number(it.unit_price),
      0,
    );
    const discount = items.reduce(
      (s, it) =>
        s +
        (Number(it.qty) * Number(it.unit_price) * Number(it.discount)) / 100,
      0,
    );
    const netSubtotal = subtotal - discount;
    return {
      company: {
        name: companyInfo.name || "",
        address: companyInfo.address || "",
        city: companyInfo.city || "",
        state: companyInfo.state || "",
        country: companyInfo.country || "",
        postalCode: companyInfo.postalCode || "",
        phone: companyInfo.phone || "",
        email: companyInfo.email || "",
        website: companyInfo.website || "",
        taxId: companyInfo.taxId || "",
        registrationNo: companyInfo.registrationNo || "",
        logoUrl,
        logoHtml,
      },
      quotation: {
        quotation_no: String(header.quotation_no || ""),
        quotation_date: header.quotation_date
          ? String(header.quotation_date).slice(0, 10)
          : "",
        valid_until: header.valid_until
          ? String(header.valid_until).slice(0, 10)
          : "",
        payment_type: String(header.payment_type || ""),
        price_type: String(header.price_type || ""),
      },
      customer: {
        name: String(header.customer_name || ""),
        address: String(header.address || ""),
        city: String(header.city || ""),
        state: String(header.state || ""),
        country: String(header.country || ""),
        phone: String(header.phone || ""),
        email: String(header.email || ""),
      },
      items,
      totals: {
        subtotal: subtotal.toFixed(2),
        discount: discount.toFixed(2),
        netSubtotal: netSubtotal.toFixed(2),
        total: Number(
          header.net_amount ?? header.total_amount ?? netSubtotal,
        ).toFixed(2),
      },
    };
  };
  function renderQuotationHtml(data) {
    const c = data.company || {};
    const q = data.quotation || {};
    const u = data.customer || {};
    const items = Array.isArray(data.items) ? data.items : [];
    const t = data.totals || {};
    return `
      <style>
        .doc { color: #0f172a; font-size: 12px; }
        .doc-header { display: flex; justify-content: space-between; align-items: center; }
        .doc-title { font-weight: 800; font-size: 18px; color: #296d8f; }
        .company-block { display: flex; gap: 12px; align-items: center; }
        .company-logo { max-height: 80px; object-fit: contain; }
        .company-info div { line-height: 1.4; }
        .meta { text-align: right; font-size: 12px; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        table { border-collapse: collapse; width: 100%; font-size: 12px; }
        th, td { border: 1px solid #e2e8f0; padding: 6px 8px; vertical-align: top; }
        th { background: #f8fafc; text-align: left; }
        .totals { display: flex; justify-content: flex-end; margin-top: 12px; }
        .totals table { width: 360px; }
      </style>
      <div class="doc">
        <div class="doc-header">
          <div class="company-block">
            ${c.logoUrl ? `<img src="${c.logoUrl}" alt="${escapeHtml(c.name || "Company")}" class="company-logo" />` : ""}
            <div class="company-info">
              <div>${escapeHtml(c.name || "")}</div>
              <div>${escapeHtml(c.address || "")}</div>
              <div>${escapeHtml(c.city || "")}${c.city ? "," : ""} ${escapeHtml(c.state || "")} ${escapeHtml(c.country || "")}</div>
              <div>${escapeHtml(c.phone || "")} ${escapeHtml(c.email || "")}</div>
              <div>${escapeHtml(c.website || "")}</div>
              <div>${c.taxId ? `Tax ID: ${escapeHtml(c.taxId)}` : ""}</div>
              <div>${c.registrationNo ? `Reg No: ${escapeHtml(c.registrationNo)}` : ""}</div>
            </div>
          </div>
          <div class="meta">
            <div class="doc-title">Quotation</div>
            <div>Quotation No: ${escapeHtml(q.quotation_no || "")}</div>
            <div>Date: ${escapeHtml(q.quotation_date || "")}</div>
            <div>Valid Until: ${escapeHtml(q.valid_until || "")}</div>
          </div>
        </div>
        <div class="grid-2" style="margin-top: 6px;">
          <div>
            <div style="font-weight:700;margin-bottom:4px;">Customer</div>
            <div>${escapeHtml(u.name || "")}</div>
            <div>${escapeHtml(u.address || "")}</div>
            <div>${escapeHtml(u.city || "")}${u.city ? "," : ""} ${escapeHtml(u.state || "")} ${escapeHtml(u.country || "")}</div>
            <div>${escapeHtml(u.phone || "")} ${escapeHtml(u.email || "")}</div>
          </div>
          <div>
            <div style="font-weight:700;margin-bottom:4px;">Payment</div>
            <div>Payment Type: ${escapeHtml(q.payment_type || "")}</div>
            <div>Price Type: ${escapeHtml(q.price_type || "")}</div>
          </div>
        </div>
        <table style="margin-top: 8px;">
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align:right;">Qty</th>
              <th style="text-align:right;">Unit Price</th>
              <th style="text-align:right;">Discount</th>
              <th style="text-align:right;">Net</th>
            </tr>
          </thead>
          <tbody>
            ${items
              .map(
                (it) => `
                <tr>
                  <td>${escapeHtml(it.item_name || "")}</td>
                  <td style="text-align:right;">${escapeHtml(it.qty || "")}</td>
                  <td style="text-align:right;">${escapeHtml(it.unit_price || "")}</td>
                  <td style="text-align:right;">${escapeHtml(it.discount || "")}</td>
                  <td style="text-align:right;">${escapeHtml(it.net || "")}</td>
                </tr>
              `,
              )
              .join("")}
          </tbody>
        </table>
        <div class="totals">
          <table>
            <tbody>
              <tr><td>Subtotal</td><td style="text-align:right;">${escapeHtml(t.subtotal || "")}</td></tr>
              <tr><td>Discount</td><td style="text-align:right;">${escapeHtml(t.discount || "")}</td></tr>
              <tr><td>Net Subtotal</td><td style="text-align:right;">${escapeHtml(t.netSubtotal || "")}</td></tr>
              <tr><td><strong>Total</strong></td><td style="text-align:right;"><strong>${escapeHtml(t.total || "")}</strong></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
  async function printQuotation(id) {
    try {
      const resp = await api.get(`/sales/quotations/${id}`);
      const header = resp.data?.item || {};
      const details = Array.isArray(resp.data?.details)
        ? resp.data.details
        : [];
      const data = buildQuotationTemplateDataFromApi(header, details);
      const html = wrapDoc(renderQuotationHtml(data));
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
  async function downloadQuotationPdf(id) {
    try {
      const resp = await api.get(`/sales/quotations/${id}`);
      const header = resp.data?.item || {};
      const details = Array.isArray(resp.data?.details)
        ? resp.data.details
        : [];
      const data = buildQuotationTemplateDataFromApi(header, details);
      const html = renderQuotationHtml(data);
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
          "Quotation_" +
          (String(header.quotation_no || "").replaceAll(" ", "_") ||
            new Date().toISOString().slice(0, 10)) +
          ".pdf";
        pdf.save(fname);
      } finally {
        document.body.removeChild(container);
      }
    } catch {}
  }
  const getStatusBadge = (status) => {
    const statusClasses = {
      DRAFT: "badge badge-warning",
      SENT: "badge badge-info",
      ACCEPTED: "badge badge-success",
      REJECTED: "badge badge-error",
      EXPIRED:
        "badge bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300",
    };
    return <span className={statusClasses[status] || "badge"}>{status}</span>;
  };

  const filteredQuotations = quotations.filter((quot) => {
    const matchesSearch =
      String(quot.quotation_no || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      String(quot.customer_name || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "ALL" || quot.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  function safeDate(v) {
    const s = String(v || "").trim();
    if (!s) return "-";
    const d = new Date(s);
    return isNaN(d.getTime()) ? "-" : d.toLocaleDateString();
  }
  function safeAmount(v) {
    const n = Number(v);
    if (!isFinite(n)) return "0.00";
    return n.toLocaleString("en-US", { minimumFractionDigits: 2 });
  }

  if (loading) {
    return <div className="text-center py-8">Loading quotations...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                Sales Quotations
              </h1>
              <p className="text-sm mt-1">
                Manage customer quotations and proposals
              </p>
            </div>
            <div className="flex gap-2">
              <Link to="/sales" className="btn btn-secondary">
                Return to Menu
              </Link>
              <Link to="/sales/quotations/new" className="btn-success">
                + New Quotation
              </Link>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      <div className="card">
        <div className="card-body">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by quotation number or customer..."
                className="input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-full md:w-48">
              <select
                className="input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Status</option>
                <option value="DRAFT">Draft</option>
                <option value="SENT">Sent</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="REJECTED">Rejected</option>
                <option value="EXPIRED">Expired</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
              <p className="mt-2">Loading quotations...</p>
            </div>
          ) : filteredQuotations.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-600 dark:text-slate-400">
                No quotations found.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Quotation No</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Valid Until</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuotations.map((quot) => (
                    <tr key={quot.id}>
                      <td className="font-medium">{quot.quotation_no}</td>
                      <td>{safeDate(quot.quotation_date)}</td>
                      <td>{quot.customer_name}</td>
                      <td>{safeDate(quot.valid_until)}</td>
                      <td className="font-semibold">
                        {safeAmount(quot.total_amount)}
                      </td>
                      <td>{getStatusBadge(quot.status)}</td>
                      <td>
                        <div className="flex gap-2">
                          {canPerformAction("sales:quotation", "view") && (
                            <button
                              onClick={() =>
                                navigate(
                                  `/sales/quotations/${quot.id}?mode=view`,
                                )
                              }
                              className="text-brand hover:text-brand-600 font-medium text-sm"
                            >
                              View
                            </button>
                          )}
                          {canPerformAction("sales:quotation", "edit") && (
                            <button
                              onClick={() =>
                                navigate(
                                  `/sales/quotations/${quot.id}?mode=edit`,
                                )
                              }
                              className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                            >
                              Edit
                            </button>
                          )}
                          <button
                            onClick={() => printQuotation(quot.id)}
                            className="inline-flex items-center px-3 py-1.5 rounded bg-green-600 hover:bg-green-700 text-white text-xs font-semibold"
                          >
                            Print
                          </button>
                          <button
                            onClick={() => downloadQuotationPdf(quot.id)}
                            className="inline-flex items-center px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold"
                          >
                            PDF
                          </button>
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
    </div>
  );
}
