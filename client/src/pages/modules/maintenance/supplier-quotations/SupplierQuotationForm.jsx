import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";

const STATUSES = ["DRAFT","UNDER_REVIEW","APPROVED","REJECTED"];

function LineRow({ idx, row, taxCodes, onChange, onRemove }) {
  const qty = Number(row.qty || 0), rate = Number(row.rate || 0);
  const disc = Number(row.discount_percent || 0);
  const taxRate = Number((taxCodes.find(t => String(t.id) === String(row.tax_code_id)) || {}).rate_percent || 0);
  const base = qty * rate, discAmt = base * (disc / 100);
  const taxAmt = (base - discAmt) * (taxRate / 100);
  const amount = base - discAmt + taxAmt;
  const set = (k, v) => onChange(idx, { ...row, [k]: v });
  return (
    <tr>
      <td className="p-2">{idx + 1}</td>
      <td className="p-2"><input className="input" value={row.description || ""} onChange={e => set("description", e.target.value)} placeholder="Description" /></td>
      <td className="p-2"><input className="input text-right" type="number" value={row.qty ?? ""} onChange={e => set("qty", e.target.value)} placeholder="1" /></td>
      <td className="p-2"><input className="input text-right" type="number" value={row.rate ?? ""} onChange={e => set("rate", e.target.value)} placeholder="0.00" /></td>
      <td className="p-2"><input className="input text-right" type="number" value={row.discount_percent ?? ""} onChange={e => set("discount_percent", e.target.value)} placeholder="0" /></td>
      <td className="p-2">
        <select className="input" value={row.tax_code_id || ""} onChange={e => set("tax_code_id", e.target.value)}>
          <option value="">None</option>
          {taxCodes.map(t => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
        </select>
      </td>
      <td className="p-2 text-right">{amount.toFixed(2)}</td>
      <td className="p-2"><button type="button" className="btn-danger btn-sm" onClick={() => onRemove(idx)}>Remove</button></td>
    </tr>
  );
}

export default function SupplierQuotationForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const isEdit = !!id;

  const [form, setForm] = useState({
    quotation_no: "", quotation_date: new Date().toISOString().slice(0,10),
    rfq_id: params.get("rfq_id") || "", supplier_id: "", supplier_name: "",
    currency: "GHS", exchange_rate: 1, status: "DRAFT", notes: ""
  });
  const [lines, setLines] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [rfqs, setRfqs] = useState([]);
  const [taxCodes, setTaxCodes] = useState([]);
  const [saving, setSaving] = useState(false);
  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    let mounted = true;
    api.get("/purchase/suppliers").then(r => { if (mounted) setSuppliers(Array.isArray(r.data?.items) ? r.data.items : []); }).catch(() => {});
    api.get("/maintenance/rfqs").then(r => { if (mounted) setRfqs(Array.isArray(r.data?.items) ? r.data.items : []); }).catch(() => {});
    api.get("/finance/tax-codes").then(r => { if (mounted) setTaxCodes(Array.isArray(r.data?.items) ? r.data.items : []); }).catch(() => {});
    if (isEdit) {
      api.get(`/maintenance/supplier-quotations/${id}`).then(r => {
        const item = r.data?.item || {};
        if (mounted) {
          setForm(p => ({ ...p, ...item, quotation_date: (item.quotation_date || "").slice(0,10) }));
          setLines(Array.isArray(r.data?.lines) ? r.data.lines : []);
        }
      }).catch(() => toast.error("Failed to load quotation"));
    }
    return () => { mounted = false; };
  }, [id]);

  const totals = useMemo(() => {
    let sub = 0, disc = 0, tax = 0;
    for (const r of lines) {
      const base = Number(r.qty || 0) * Number(r.rate || 0);
      sub += base;
      const d = base * (Number(r.discount_percent || 0) / 100);
      disc += d;
      const txRate = Number((taxCodes.find(t => String(t.id) === String(r.tax_code_id)) || {}).rate_percent || 0);
      tax += (base - d) * (txRate / 100);
    }
    return { subtotal: sub, discountAmount: disc, taxAmount: tax, total: sub - disc + tax };
  }, [lines, taxCodes]);

  const addLine = () => setLines(p => [...p, { description: "", qty: 1, rate: 0, discount_percent: 0, tax_code_id: "" }]);
  const removeLine = i => setLines(p => p.filter((_, idx) => idx !== i));
  const updateLine = (i, row) => setLines(p => p.map((r, idx) => idx === i ? row : r));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.supplier_id) { toast.error("Please select a supplier"); return; }
    setSaving(true);
    try {
      const payload = { ...form, lines, subtotal: totals.subtotal, tax_amount: totals.taxAmount, total_amount: totals.total };
      if (isEdit) { await api.put(`/maintenance/supplier-quotations/${id}`, payload); toast.success("Quotation updated"); }
      else { const r = await api.post("/maintenance/supplier-quotations", payload); toast.success(`Quotation ${r.data?.quotation_no} recorded`); }
      navigate("/maintenance/supplier-quotations", { state: { refresh: true } });
    } catch (e) { toast.error(e?.response?.data?.message || "Failed to save"); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/maintenance/supplier-quotations" className="btn-secondary">← Back</Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{isEdit ? "Edit" : "New"} Supplier Quotation</h1>
          <p className="text-sm mt-1">Record a supplier's quotation for maintenance services</p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="card">
          <div className="card-header bg-brand text-white rounded-t-lg font-semibold">Quotation Details</div>
          <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="label">Quotation No</label><input className="input" value={form.quotation_no} onChange={e => update("quotation_no", e.target.value)} placeholder="Auto-generated" /></div>
            <div><label className="label">Quotation Date</label><input className="input" type="date" value={form.quotation_date} onChange={e => update("quotation_date", e.target.value)} /></div>
            <div>
              <label className="label">RFQ Reference</label>
              <select className="input" value={form.rfq_id} onChange={e => update("rfq_id", e.target.value)}>
                <option value="">-- None --</option>
                {rfqs.map(r => <option key={r.id} value={r.id}>{r.rfq_no}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Supplier *</label>
              <select className="input" value={form.supplier_id} onChange={e => { const s = suppliers.find(x => String(x.id) === e.target.value); update("supplier_id", e.target.value); update("supplier_name", s?.supplier_name || s?.name || ""); }} required>
                <option value="">-- Select Supplier --</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.supplier_name || s.name}</option>)}
              </select>
            </div>
            <div><label className="label">Currency</label><input className="input" value={form.currency} onChange={e => update("currency", e.target.value)} /></div>
            <div><label className="label">Exchange Rate</label><input className="input text-right" type="number" step="0.000001" value={form.exchange_rate} onChange={e => update("exchange_rate", e.target.value)} /></div>
            <div><label className="label">Status</label><select className="input" value={form.status} onChange={e => update("status", e.target.value)}>{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            <div className="md:col-span-2"><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes} onChange={e => update("notes", e.target.value)} /></div>
          </div>
        </div>
        <div className="card">
          <div className="card-header bg-brand text-white rounded-t-lg font-semibold">Line Items</div>
          <div className="card-body">
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>#</th><th>Description</th><th className="text-right">Qty</th><th className="text-right">Rate</th><th className="text-right">Disc%</th><th>Tax</th><th className="text-right">Amount</th><th></th></tr></thead>
                <tbody>
                  {lines.map((row, i) => <LineRow key={i} idx={i} row={row} taxCodes={taxCodes} onChange={updateLine} onRemove={removeLine} />)}
                  <tr><td colSpan="8"><button type="button" className="btn-success btn-sm" onClick={addLine}>+ Add Line</button></td></tr>
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end">
              <div className="w-72 space-y-1 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>{totals.subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Discount</span><span>-{totals.discountAmount.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Tax</span><span>{totals.taxAmount.toFixed(2)}</span></div>
                <div className="flex justify-between font-bold border-t pt-1"><span>Total</span><span>{totals.total.toFixed(2)}</span></div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Link to="/maintenance/supplier-quotations" className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Save Quotation"}</button>
        </div>
      </form>
    </div>
  );
}
