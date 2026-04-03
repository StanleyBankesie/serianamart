import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";

const STATUSES = ["DRAFT","PENDING","APPROVED","PAID","CANCELLED"];
const PAYMENT_STATUSES = ["UNPAID","PAID","OVERDUE"];
const PAYMENT_METHODS = [{ key:"cash",label:"Cash" },{ key:"bank",label:"Bank Transfer" },{ key:"card",label:"Card" },{ key:"mobile",label:"Mobile Money" }];

function LineRow({ idx, row, taxCodes, onChange, onRemove }) {
  const qty = Number(row.qty || 0), rate = Number(row.rate || 0);
  const disc = Number(row.discount_percent || 0);
  const taxRate = Number((taxCodes.find(t => String(t.id) === String(row.tax_code_id)) || {}).rate_percent || 0);
  const base = qty * rate, discAmt = base * (disc / 100);
  const amount = base - discAmt + (base - discAmt) * (taxRate / 100);
  const set = (k, v) => onChange(idx, { ...row, [k]: v });
  return (
    <tr>
      <td className="p-2">{idx + 1}</td>
      <td className="p-2"><input className="input" value={row.description || ""} onChange={e => set("description", e.target.value)} placeholder="Service description" /></td>
      <td className="p-2"><input className="input" value={row.category || ""} onChange={e => set("category", e.target.value)} placeholder="Category" /></td>
      <td className="p-2"><input className="input text-right" type="number" value={row.qty ?? ""} onChange={e => set("qty", e.target.value)} /></td>
      <td className="p-2"><input className="input text-right" type="number" value={row.rate ?? ""} onChange={e => set("rate", e.target.value)} /></td>
      <td className="p-2"><input className="input text-right" type="number" step="0.01" value={row.discount_percent ?? ""} onChange={e => set("discount_percent", e.target.value)} /></td>
      <td className="p-2"><select className="input" value={row.tax_code_id || ""} onChange={e => set("tax_code_id", e.target.value)}><option value="">None</option>{taxCodes.map(t => <option key={t.id} value={String(t.id)}>{t.name}</option>)}</select></td>
      <td className="p-2 text-right">{amount.toFixed(2)}</td>
      <td className="p-2"><button type="button" className="btn-danger btn-sm" onClick={() => onRemove(idx)}>Remove</button></td>
    </tr>
  );
}

export default function MaintenanceBillForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const isEdit = !!id;

  const [form, setForm] = useState({
    bill_no: "", bill_date: new Date().toISOString().slice(0,10), due_date: "",
    execution_id: params.get("execution_id") || "", supplier_id: "", supplier_name: "",
    currency: "GHS", exchange_rate: 1, other_charges: 0,
    payment_terms: "30", payment_method: "bank", payment_reference: "",
    payment_status: "UNPAID", status: "DRAFT", notes: ""
  });
  const [lines, setLines] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [taxCodes, setTaxCodes] = useState([]);
  const [saving, setSaving] = useState(false);
  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    let mounted = true;
    api.get("/purchase/suppliers").then(r => { if (mounted) setSuppliers(Array.isArray(r.data?.items) ? r.data.items : []); }).catch(() => {});
    api.get("/maintenance/job-executions").then(r => { if (mounted) setExecutions(Array.isArray(r.data?.items) ? r.data.items : []); }).catch(() => {});
    api.get("/finance/tax-codes").then(r => { if (mounted) setTaxCodes(Array.isArray(r.data?.items) ? r.data.items : []); }).catch(() => {});
    if (!isEdit) {
      api.get("/maintenance/bills/next-no").then(r => { if (mounted && r.data?.nextNo) update("bill_no", r.data.nextNo); }).catch(() => {});
    }
    if (isEdit) {
      api.get(`/maintenance/bills/${id}`).then(r => {
        const item = r.data?.item || {};
        if (mounted) {
          setForm(p => ({ ...p, ...item, bill_date: (item.bill_date || "").slice(0,10), due_date: (item.due_date || "").slice(0,10) }));
          setLines(Array.isArray(r.data?.lines) ? r.data.lines : []);
        }
      }).catch(() => toast.error("Failed to load bill"));
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
    const other = Number(form.other_charges || 0);
    return { subtotal: sub, discountAmount: disc, taxAmount: tax, otherCharges: other, total: sub - disc + tax + other };
  }, [lines, taxCodes, form.other_charges]);

  const addLine = () => setLines(p => [...p, { description: "", category: "", qty: 1, rate: 0, discount_percent: 0, tax_code_id: "" }]);
  const removeLine = i => setLines(p => p.filter((_, idx) => idx !== i));
  const updateLine = (i, row) => setLines(p => p.map((r, idx) => idx === i ? row : r));

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, lines, subtotal: totals.subtotal, discount_amount: totals.discountAmount, tax_amount: totals.taxAmount, total_amount: totals.total };
      if (isEdit) { await api.put(`/maintenance/bills/${id}`, payload); toast.success("Bill updated"); }
      else { const r = await api.post("/maintenance/bills", payload); toast.success(`Bill ${r.data?.bill_no} created`); }
      navigate("/maintenance/bills", { state: { refresh: true } });
    } catch (e) { toast.error(e?.response?.data?.message || "Failed to save"); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/maintenance/bills" className="btn-secondary">← Back</Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{isEdit ? "Edit" : "New"} Maintenance Bill</h1>
            <p className="text-sm mt-1">Raise a payment bill for completed maintenance work</p>
          </div>
        </div>
        <div className="text-right"><div className="text-xs text-slate-500">Bill No</div><div className="text-lg font-semibold">{form.bill_no}</div></div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="card">
          <div className="card-header bg-brand text-white rounded-t-lg font-semibold">Bill Details</div>
          <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="label">Bill No</label><input className="input" value={form.bill_no} onChange={e => update("bill_no", e.target.value)} /></div>
            <div><label className="label">Bill Date</label><input className="input" type="date" value={form.bill_date} onChange={e => update("bill_date", e.target.value)} /></div>
            <div><label className="label">Due Date</label><input className="input" type="date" value={form.due_date} onChange={e => update("due_date", e.target.value)} /></div>
            <div>
              <label className="label">Job Execution</label>
              <select className="input" value={form.execution_id} onChange={e => update("execution_id", e.target.value)}>
                <option value="">-- None --</option>
                {executions.map(ex => <option key={ex.id} value={ex.id}>{ex.execution_no}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Supplier / Contractor</label>
              <select className="input" value={form.supplier_id} onChange={e => { const s = suppliers.find(x => String(x.id) === e.target.value); update("supplier_id", e.target.value); update("supplier_name", s?.supplier_name || s?.name || ""); }}>
                <option value="">-- Select --</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.supplier_name || s.name}</option>)}
              </select>
            </div>
            <div><label className="label">Currency</label><input className="input" value={form.currency} onChange={e => update("currency", e.target.value)} /></div>
            <div><label className="label">Exchange Rate</label><input className="input text-right" type="number" step="0.000001" value={form.exchange_rate} onChange={e => update("exchange_rate", e.target.value)} /></div>
            <div><label className="label">Payment Terms (Days)</label><input className="input" type="number" value={form.payment_terms} onChange={e => update("payment_terms", e.target.value)} /></div>
            <div><label className="label">Payment Method</label><select className="input" value={form.payment_method} onChange={e => update("payment_method", e.target.value)}>{PAYMENT_METHODS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}</select></div>
            <div><label className="label">Payment Reference</label><input className="input" value={form.payment_reference} onChange={e => update("payment_reference", e.target.value)} /></div>
            <div><label className="label">Payment Status</label><select className="input" value={form.payment_status} onChange={e => update("payment_status", e.target.value)}>{PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            <div><label className="label">Status</label><select className="input" value={form.status} onChange={e => update("status", e.target.value)}>{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            <div className="md:col-span-2"><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes} onChange={e => update("notes", e.target.value)} /></div>
          </div>
        </div>
        <div className="card">
          <div className="card-header bg-brand text-white rounded-t-lg font-semibold">Bill Lines</div>
          <div className="card-body">
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>#</th><th>Description</th><th>Category</th><th className="text-right">Qty</th><th className="text-right">Rate</th><th className="text-right">Disc%</th><th>Tax</th><th className="text-right">Amount</th><th></th></tr></thead>
                <tbody>
                  {lines.map((row, i) => <LineRow key={i} idx={i} row={row} taxCodes={taxCodes} onChange={updateLine} onRemove={removeLine} />)}
                  <tr><td colSpan="9"><button type="button" className="btn-success btn-sm" onClick={addLine}>+ Add Line</button></td></tr>
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end">
              <div className="w-72 space-y-1 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>{totals.subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Discount</span><span>-{totals.discountAmount.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Tax</span><span>{totals.taxAmount.toFixed(2)}</span></div>
                <div className="flex justify-between items-center"><span>Other Charges</span><input className="input w-28 text-right" type="number" value={form.other_charges} onChange={e => update("other_charges", e.target.value)} /></div>
                <div className="flex justify-between font-bold border-t pt-1 text-base"><span>Total</span><span>{totals.total.toFixed(2)}</span></div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Link to="/maintenance/bills" className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Save Bill"}</button>
        </div>
      </form>
    </div>
  );
}
