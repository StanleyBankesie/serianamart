import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "api/client";
import { toast } from "react-toastify";
import PrintPreviewModal from "../../../../components/PrintPreviewModal.jsx";

const DOC_TYPES = [
  { value: "sales-order", label: "Sales Order" },
  { value: "invoice", label: "Invoice" },
  { value: "quotation", label: "Quotation" },
  { value: "delivery-note", label: "Delivery Note" },
  { value: "salary-slip", label: "Salary Slip" },
  { value: "payment-voucher", label: "Payment Voucher" },
  { value: "receipt-voucher", label: "Receipt Voucher" },
];

export default function DocumentTemplatesPage() {
  const [searchParams] = useSearchParams();
  const initialType = useMemo(() => {
    const t = String(searchParams.get("type") || "").trim();
    const match = DOC_TYPES.find((d) => d.value === t);
    return match ? match.value : DOC_TYPES[0].value;
  }, [searchParams]);
  const [docType, setDocType] = useState(initialType);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: "",
    html_content: "",
    is_default: false,
    header_logo_url: "",
    header_name: "",
    header_address: "",
    header_address2: "",
    header_phone: "",
    header_email: "",
    header_website: "",
  });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [sampleId, setSampleId] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, [docType]);

  async function loadTemplates() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get(`/templates/${docType}`);
      const items = Array.isArray(res.data?.items) ? res.data.items : [];
      setTemplates(items);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }

  function startNew() {
    setEditing(null);
    setForm({
      name: "",
      html_content: "",
      is_default: false,
      header_logo_url: "",
      header_name: "",
      header_address: "",
      header_address2: "",
      header_phone: "",
      header_email: "",
      header_website: "",
    });
  }

  function startEdit(t) {
    setEditing(t);
    setForm({
      name: String(t.name || ""),
      html_content: "",
      is_default: Number(t.is_default) === 1,
      header_logo_url: "",
      header_name: "",
      header_address: "",
      header_address2: "",
      header_phone: "",
      header_email: "",
      header_website: "",
    });
    api
      .get(`/templates/item/${t.id}`)
      .then((res) => {
        const item = res.data?.item || {};
        setForm((p) => ({
          ...p,
          html_content: String(item.html_content || ""),
          header_logo_url: String(item.header_logo_url || ""),
          header_name: String(item.header_name || ""),
          header_address: String(item.header_address || ""),
          header_address2: String(item.header_address2 || ""),
          header_phone: String(item.header_phone || ""),
          header_email: String(item.header_email || ""),
          header_website: String(item.header_website || ""),
        }));
      })
      .catch(() => {});
  }

  async function save() {
    try {
      const name = String(form.name || "").trim();
      const content = String(form.html_content || "").trim();
      if (!name || !content) {
        toast.info("Enter name and HTML content");
        return;
      }
      if (!editing) {
        const res = await api.post(`/templates`, {
          name,
          document_type: docType,
          html_content: content,
          is_default: form.is_default ? 1 : 0,
          header_logo_url: form.header_logo_url || "",
          header_name: form.header_name || "",
          header_address: form.header_address || "",
          header_address2: form.header_address2 || "",
          header_phone: form.header_phone || "",
          header_email: form.header_email || "",
          header_website: form.header_website || "",
        });
        toast.success("Template created");
      } else {
        await api.put(`/templates/${editing.id}`, {
          name,
          html_content: content,
          is_default: form.is_default ? 1 : 0,
          header_logo_url: form.header_logo_url || "",
          header_name: form.header_name || "",
          header_address: form.header_address || "",
          header_address2: form.header_address2 || "",
          header_phone: form.header_phone || "",
          header_email: form.header_email || "",
          header_website: form.header_website || "",
        });
        toast.success("Template updated");
      }
      await loadTemplates();
      startNew();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to save");
    }
  }

  async function setDefault(t) {
    try {
      await api.put(`/templates/${t.id}`, {
        name: t.name,
        html_content: t.html_content || "",
        is_default: 1,
      });
      toast.success("Default set");
      await loadTemplates();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to set default");
    }
  }

  async function remove(t) {
    try {
      await api.delete(`/templates/${t.id}`);
      toast.success("Template deleted");
      await loadTemplates();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to delete");
    }
  }

  async function openPreview(t) {
    try {
      const idNum = Number(sampleId);
      const res =
        !Number.isFinite(idNum) || idNum <= 0
          ? await api.post(`/documents/${docType}/preview`, {
              format: "html",
            })
          : await api.post(`/documents/${docType}/${idNum}/render`, {
              format: "html",
            });
      setPreviewHtml(String(res.data || ""));
      setPreviewOpen(true);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to render");
    }
  }

  async function downloadPdf() {
    try {
      setDownloading(true);
      const idNum = Number(sampleId);
      const endpointUrl =
        !Number.isFinite(idNum) || idNum <= 0
          ? `/documents/${docType}/preview?format=pdf`
          : `/documents/${docType}/${idNum}/render?format=pdf`;
      const resp = await api.post(endpointUrl, {}, { responseType: "blob" });
      const blob = resp.data;
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${docType}-${Number.isFinite(idNum) && idNum > 0 ? idNum : "preview"}.pdf`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to download");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/administration/settings"
          className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300 mb-2 inline-block"
        >
          ← Back to Settings
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Document Templates
        </h1>
        <p className="text-sm mt-1">
          Create, edit, preview, and set default templates
        </p>
      </div>

      <div className="card">
        <div className="card-body space-y-4">
          <div className="flex items-center gap-3">
            <label className="label">Document Type</label>
            <select
              className="input w-64"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
            >
              {DOC_TYPES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            <div className="ml-auto flex items-center gap-2">
              <input
                type="number"
                className="input w-40"
                placeholder="Sample ID"
                value={sampleId}
                onChange={(e) => setSampleId(e.target.value)}
              />
              <button
                className="btn-outline"
                disabled={loading}
                onClick={() => loadTemplates()}
              >
                Refresh
              </button>
              <button className="btn-success" onClick={startNew}>
                + New Template
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              {error ? (
                <div className="text-sm text-red-600 mb-3">{error}</div>
              ) : null}
              <div className="overflow-auto border rounded">
                <table className="min-w-full">
                  <thead className="text-black">
                    <tr className="bg-gray-50">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-black">
                        Name
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-black">
                        Default
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-black">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map((t) => (
                      <tr key={t.id} className="border-t">
                        <td className="px-3 py-2 text-sm">{t.name}</td>
                        <td className="px-3 py-2 text-sm">
                          {Number(t.is_default) === 1 ? "Yes" : "No"}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-2">
                            <button
                              className="btn-outline"
                              onClick={() => startEdit(t)}
                            >
                              Edit
                            </button>
                            <button
                              className="btn-outline"
                              onClick={() => openPreview(t)}
                            >
                              Preview
                            </button>
                            {Number(t.is_default) !== 1 ? (
                              <button
                                className="btn-primary"
                                onClick={() => setDefault(t)}
                              >
                                Set Default
                              </button>
                            ) : null}
                            {Number(t.is_default) !== 1 ? (
                              <button
                                className="btn-danger"
                                onClick={() => remove(t)}
                              >
                                Delete
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!templates.length ? (
                      <tr>
                        <td
                          className="px-3 py-3 text-sm text-slate-500"
                          colSpan={3}
                        >
                          No templates for this type
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <div className="space-y-3">
                <div>
                  <label className="label">Name</label>
                  <input
                    className="input"
                    value={form.name}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, name: e.target.value }))
                    }
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Header Company Name</label>
                    <input
                      className="input"
                      value={form.header_name}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          header_name: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="label">Header Phone</label>
                    <input
                      className="input"
                      value={form.header_phone}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          header_phone: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="label">Header Address</label>
                    <input
                      className="input"
                      value={form.header_address}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          header_address: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="label">Header Address 2</label>
                    <input
                      className="input"
                      value={form.header_address2}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          header_address2: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="label">Header Email</label>
                    <input
                      className="input"
                      value={form.header_email}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          header_email: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="label">Header Website</label>
                    <input
                      className="input"
                      value={form.header_website}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          header_website: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="label">Header Logo URL</label>
                    <input
                      className="input"
                      placeholder="/api/admin/companies/{id}/logo"
                      value={form.header_logo_url}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          header_logo_url: e.target.value,
                        }))
                      }
                    />
                    <div className="text-xs text-slate-500 mt-1">
                      Omit to use the company logo automatically
                    </div>
                  </div>
                </div>
                <div>
                  <label className="label">HTML Content</label>
                  <textarea
                    className="input min-h-[280px]"
                    value={form.html_content}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, html_content: e.target.value }))
                    }
                  />
                  <div className="text-xs text-slate-500 mt-1">
                    Use placeholders like {"{{company.name}}"} and loops like{" "}
                    {"{{#each sales_order.items}}"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="default"
                    type="checkbox"
                    className="w-4 h-4"
                    checked={form.is_default}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, is_default: e.target.checked }))
                    }
                  />
                  <label htmlFor="default" className="label">
                    Set as default
                  </label>
                </div>
                <div className="flex gap-2">
                  <button className="btn-primary" onClick={save}>
                    Save
                  </button>
                  <button className="btn-outline" onClick={startNew}>
                    Reset
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      const tpl = getSampleTemplate(docType);
                      setForm((p) => ({ ...p, html_content: tpl }));
                    }}
                  >
                    Use Sample Layout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PrintPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        html={previewHtml}
        downloading={downloading}
        onDownload={downloadPdf}
      />
    </div>
  );
}

function getSampleTemplate(type) {
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
