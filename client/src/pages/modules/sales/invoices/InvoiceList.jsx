import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../../api/client";
import { toast } from "react-toastify";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { usePermission } from "../../../../auth/PermissionContext.jsx";

export default function InvoiceList() {
  const navigate = useNavigate();
  const { canPerformAction } = usePermission();
  const [invoices, setInvoices] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [submittingId, setSubmittingId] = useState(null);
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
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError("");
      const [invRes, curRes, whRes] = await Promise.all([
        api.get("/sales/invoices"),
        api.get("/finance/currencies"),
        api.get("/inventory/warehouses"),
      ]);
      setInvoices(Array.isArray(invRes.data?.items) ? invRes.data.items : []);
      setCurrencies(Array.isArray(curRes.data?.items) ? curRes.data.items : []);
      setWarehouses(Array.isArray(whRes.data?.items) ? whRes.data.items : []);
    } catch (error) {
      setError(error?.response?.data?.message || "Error fetching invoices");
      console.error("Error fetching invoices:", error);
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
        if (!companyId) {
          if (!mounted) return;
          return;
        }
        const cResp = await api.get(`/admin/companies/${companyId}`);
        const item = cResp.data?.item || {};
        if (!mounted) return;
        setCompanyInfo((prev) => ({
          ...prev,
          name: item.name || prev.name || "",
          address: item.address || prev.address || "",
          city: item.city || prev.city || "",
          state: item.state || prev.state || "",
          country: item.country || prev.country || "",
          postalCode: item.postal_code || prev.postalCode || "",
          phone: item.telephone || prev.phone || "",
          email: item.email || prev.email || "",
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
    <title>Invoice</title>
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
  const buildInvoiceTemplateDataFromApi = (header, details) => {
    const items = (Array.isArray(details) ? details : []).map((d) => {
      const qty = Number(d.quantity || d.qty || 0);
      const unit = Number(d.unit_price || 0);
      const disc = Number(d.discount_percent || 0);
      const total = Number(d.total_amount || qty * unit);
      const net = Number(d.net_amount || total - (qty * unit * disc) / 100);
      return {
        item_name: String(d.item_name || ""),
        qty: qty.toFixed(2),
        unit_price: unit.toFixed(2),
        total: total.toFixed(2),
        discount: Number(disc || 0).toFixed(2),
        net: net.toFixed(2),
      };
    });
    const currencyCode =
      currencies.find((c) => String(c.id) === String(header.currency_id))
        ?.code || "";
    return {
      company: {
        name: companyInfo.name || "Company",
        address: companyInfo.address || "",
        city: companyInfo.city || "",
        state: companyInfo.state || "",
        postalCode: companyInfo.postalCode || "",
        country: companyInfo.country || "",
        phone: companyInfo.phone || "",
        email: companyInfo.email || "",
        website: companyInfo.website || "",
        taxId: companyInfo.taxId || "",
        registrationNo: companyInfo.registrationNo || "",
        logoUrl: String(companyInfo.logoUrl || ""),
      },
      invoice: {
        invoice_no: String(header.invoice_no || ""),
        invoice_date: header.invoice_date
          ? String(header.invoice_date).slice(0, 10)
          : "",
        due_date: String(header.due_date || ""),
        payment_type: String(header.payment_type || ""),
        price_type: String(header.price_type || ""),
        currency: String(currencyCode || ""),
        prepared_by: "",
      },
      customer: {
        id: String(header.customer_id || ""),
        code: "",
        name: String(header.customer_name || ""),
        type: "",
        contactPerson: "",
        email: "",
        phone: String(header.phone || ""),
        mobile: "",
        address: String(header.address || ""),
        city: String(header.city || ""),
        state: String(header.state || ""),
        zone: "",
        country: String(header.country || ""),
        paymentTerms: "",
        creditLimit: "0.00",
      },
      items,
      totals: {
        subtotal: Number(
          items.reduce((s, it) => s + Number(it.total || 0), 0),
        ).toFixed(2),
        discount: Number(
          items.reduce((s, it) => s + Number(it.discount || 0), 0),
        ).toFixed(2),
        netSubtotal: Number(
          items.reduce((s, it) => s + Number(it.net || 0), 0),
        ).toFixed(2),
        tax: "0.00",
        total: Number(header.net_amount || header.total_amount || 0).toFixed(2),
      },
    };
  };
  function renderInvoiceHtml(data) {
    const company = data.company || {};
    const inv = data.invoice || {};
    const cust = data.customer || {};
    const items = Array.isArray(data.items) ? data.items : [];
    const totals = data.totals || {};
    return `
      <style>
        .doc { color: #0f172a; font-size: 12px; }
        .doc-header { display: flex; justify-content: space-between; align-items: center; }
        .doc-title { font-weight: 800; font-size: 18px; color: #296d8f; }
        .company-block { display: flex; gap: 12px; align-items: center; }
        .company-logo { max-height: 80px; object-fit: contain; }
        .company-info div { line-height: 1.4; }
        .meta { text-align: right; font-size: 12px; }
        .section-title { font-weight: 700; margin-top: 8px; margin-bottom: 4px; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        table { border-collapse: collapse; width: 100%; font-size: 12px; }
        th, td { border: 1px solid #e2e8f0; padding: 6px 8px; vertical-align: top; }
        th { background: #f8fafc; text-align: left; }
        .totals { display: flex; justify-content: flex-end; margin-top: 12px; }
        .totals table { width: 320px; }
      </style>
      <div class="doc">
        <div class="doc-header">
          <div class="company-block">
            ${company.logoUrl ? `<img src="${company.logoUrl}" alt="${escapeHtml(company.name || "Company")}" class="company-logo" />` : ""}
            <div class="company-info">
              <div>${escapeHtml(company.name || "")}</div>
              <div>${escapeHtml(company.address || "")}</div>
              <div>${escapeHtml(company.city || "")}${company.city ? "," : ""} ${escapeHtml(company.state || "")} ${escapeHtml(company.country || "")}</div>
              <div>${escapeHtml(company.phone || "")} ${escapeHtml(company.email || "")}</div>
              <div>${escapeHtml(company.website || "")}</div>
              <div>${company.taxId ? `Tax ID: ${escapeHtml(company.taxId)}` : ""}</div>
              <div>${company.registrationNo ? `Reg No: ${escapeHtml(company.registrationNo)}` : ""}</div>
            </div>
          </div>
          <div class="meta">
            <div class="doc-title">Invoice</div>
            <div>Invoice No: ${escapeHtml(inv.invoice_no || "")}</div>
            <div>Invoice Date: ${escapeHtml(inv.invoice_date || "")}</div>
            <div>Due Date: ${escapeHtml(inv.due_date || "")}</div>
            <div>Status: ${escapeHtml(String(inv.status || ""))}</div>
          </div>
        </div>

        <div class="grid-2" style="margin-top: 6px;">
          <div>
            <div class="section-title">Customer</div>
            <div>${escapeHtml(cust.name || "")}</div>
            <div>${escapeHtml(cust.address || "")}</div>
            <div>${escapeHtml(cust.city || "")}${cust.city ? "," : ""} ${escapeHtml(cust.state || "")} ${escapeHtml(cust.country || "")}</div>
            <div>${escapeHtml(cust.phone || "")} ${escapeHtml(cust.email || "")}</div>
          </div>
          <div>
            <div class="section-title">Payment</div>
            <div>Currency: ${escapeHtml(inv.currency || "")}</div>
            <div>Payment Type: ${escapeHtml(inv.payment_type || "")}</div>
            <div>Price Type: ${escapeHtml(inv.price_type || "")}</div>
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
              <tr><td>Subtotal</td><td style="text-align:right;">${escapeHtml(totals.subtotal || "")}</td></tr>
              <tr><td>Discount</td><td style="text-align:right;">${escapeHtml(totals.discount || "")}</td></tr>
              <tr><td>Net Subtotal</td><td style="text-align:right;">${escapeHtml(totals.netSubtotal || "")}</td></tr>
              <tr><td>Tax</td><td style="text-align:right;">${escapeHtml(totals.tax || "")}</td></tr>
              <tr><td><strong>Total</strong></td><td style="text-align:right;"><strong>${escapeHtml(totals.total || "")}</strong></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
  async function printInvoice(id) {
    try {
      const resp = await api.get(`/sales/invoices/${id}`);
      const header = resp.data?.item || {};
      const details = Array.isArray(resp.data?.details)
        ? resp.data.details
        : [];
      const data = buildInvoiceTemplateDataFromApi(header, details);
      const html = wrapDoc(renderInvoiceHtml(data));
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
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to print invoice");
    }
  }
  async function downloadInvoicePdf(id) {
    try {
      const resp = await api.get(`/sales/invoices/${id}`);
      const header = resp.data?.item || {};
      const details = Array.isArray(resp.data?.details)
        ? resp.data.details
        : [];
      const data = buildInvoiceTemplateDataFromApi(header, details);
      const html = renderInvoiceHtml(data);
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
          "Invoice_" +
          (String(header.invoice_no || "").replaceAll(" ", "_") ||
            new Date().toISOString().slice(0, 10)) +
          ".pdf";
        pdf.save(fname);
      } finally {
        document.body.removeChild(container);
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to download invoice");
    }
  }
  const getStatusBadge = (status) => {
    const statusClasses = {
      DRAFT: "badge badge-warning",
      POSTED: "badge badge-success",
      CANCELLED: "badge badge-error",
    };
    return <span className={statusClasses[status] || "badge"}>{status}</span>;
  };

  const getPaymentStatusBadge = (pstatus) => {
    const classes = {
      UNPAID: "badge badge-error",
      PARTIALLY_PAID: "badge badge-warning",
      PAID: "badge badge-success",
    };
    const label = String(pstatus || "").trim() || "UNPAID";
    return <span className={classes[label] || "badge"}>{label}</span>;
  };

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoice_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.customer_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                Sales Invoices
              </h1>
              <p className="text-sm mt-1">
                Generate and manage customer invoices
              </p>
            </div>
            <div className="flex gap-2">
              <Link to="/sales" className="btn btn-secondary">
                Return to Menu
              </Link>
              <Link to="/sales/invoices/new" className="btn-success">
                + New Invoice
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by invoice number or customer..."
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
                <option value="POSTED">Posted</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
              <p className="mt-2">Loading invoices...</p>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-600 dark:text-slate-400">
                No invoices found.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Invoice No</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th>Net Amount</th>
                    <th>Actions</th>
                    <th>Payment Type</th>
                    <th>Price Type</th>
                    <th>Warehouse</th>
                    <th className="text-right">Balance</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((inv) => (
                    <tr key={inv.id}>
                      <td className="font-medium">{inv.invoice_no}</td>
                      <td>{new Date(inv.invoice_date).toLocaleDateString()}</td>
                      <td>{inv.customer_name}</td>
                      <td>{getPaymentStatusBadge(inv.payment_status)}</td>
                      <td>{getStatusBadge(inv.status)}</td>
                      <td className="font-semibold">
                        {inv.net_amount.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td>
                        <div className="flex gap-2">
                          {canPerformAction("sales:invoices", "view") && (
                            <button
                              onClick={() =>
                                navigate(`/sales/invoices/${inv.id}?mode=view`)
                              }
                              className="text-brand hover:text-brand-600 font-medium text-sm"
                            >
                              View
                            </button>
                          )}
                          {inv.status !== "POSTED" &&
                            canPerformAction("sales:invoices", "edit") && (
                              <button
                                onClick={() =>
                                  navigate(`/sales/invoices/${inv.id}`)
                                }
                                className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                              >
                                Edit
                              </button>
                            )}
                          <button
                            onClick={() => printInvoice(inv.id)}
                            className="inline-flex items-center px-3 py-1.5 rounded bg-green-600 hover:bg-green-700 text-white text-xs font-semibold"
                          >
                            Print
                          </button>
                          <button
                            onClick={() => downloadInvoicePdf(inv.id)}
                            className="inline-flex items-center px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold"
                          >
                            PDF
                          </button>
                        </div>
                      </td>
                      <td>{inv.payment_type || ""}</td>
                      <td>{inv.price_type || ""}</td>
                      <td>
                        {warehouses.find(
                          (w) => String(w.id) === String(inv.warehouse_id),
                        )?.warehouse_name || ""}
                      </td>
                      <td className="text-right">
                        {Number(inv.balance_amount || 0).toLocaleString(
                          "en-US",
                          {
                            minimumFractionDigits: 2,
                          },
                        )}
                      </td>
                      <td>{inv.remarks || ""}</td>
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
