import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";

const STATUSES = ["DRAFT","UNDER_REVIEW","APPROVED","REJECTED"];


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
  const [newItem, setNewItem] = useState({
    description: "",
    qty: 1,
    rate: 0,
    discount_percent: 0,
    tax_code_id: "",
  });
  const [suppliers, setSuppliers] = useState([]);
  const [rfqs, setRfqs] = useState([]);
  const [taxCodes, setTaxCodes] = useState([]);
  const [taxComponentsByCode, setTaxComponentsByCode] = useState({});
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
  const fetchTaxComponentsForCode = async (taxCodeId) => {
    const key = String(taxCodeId || "");
    if (!key) return;
    try {
      const resp = await api.get(`/finance/tax-codes/${taxCodeId}/components`);
      const items = Array.isArray(resp.data?.items) ? resp.data.items : [];
      setTaxComponentsByCode((prev) => ({ ...prev, [key]: items }));
    } catch {}
  };

  useEffect(() => {
    const uniqueTaxIds = Array.from(
      new Set([
        ...lines.map((l) => String(l.tax_code_id)).filter(Boolean),
        newItem.tax_code_id ? String(newItem.tax_code_id) : null,
      ].filter(Boolean)),
    );
    const missing = uniqueTaxIds.filter((id) => !(id in taxComponentsByCode));
    if (missing.length) {
      Promise.all(missing.map((id) => fetchTaxComponentsForCode(id)));
    }
  }, [lines, newItem.tax_code_id]);

  const calcNewItemTaxBreakdown = () => {
    const qty = Number(newItem.qty || 0);
    const rate = Number(newItem.rate || 0);
    const discP = Number(newItem.discount_percent || 0);
    const gross = qty * rate;
    const disc = gross * (discP / 100);
    const taxableTotal = Math.max(0, gross - disc);

    const components = [];
    let taxTotal = 0;
    const comps = taxComponentsByCode[String(newItem.tax_code_id)] || [];

    if (comps.length > 0) {
      comps.forEach((c) => {
        const r = Number(c.rate_percent) || 0;
        const amt = (taxableTotal * r) / 100;
        components.push({ name: c.component_name, rate: r, amount: amt });
        taxTotal += amt;
      });
    } else if (newItem.tax_code_id) {
      const tc = taxCodes.find((t) => String(t.id) === String(newItem.tax_code_id));
      const r = tc ? Number(tc.rate_percent) || 0 : 0;
      const amt = (taxableTotal * r) / 100;
      if (r > 0) {
        components.push({ name: "Tax", rate: r, amount: amt });
        taxTotal = amt;
      }
    }
    return { components, taxTotal, taxableTotal };
  };

  const addItemToLines = () => {
    if (!newItem.description || !newItem.qty) return;
    const { taxTotal, taxableTotal } = calcNewItemTaxBreakdown();
    setLines((p) => [
      ...p,
      {
        ...newItem,
        id: Date.now(),
        tax_amount: taxTotal,
        amount: taxableTotal + taxTotal,
      },
    ]);
    setNewItem({
      description: "",
      qty: 1,
      rate: 0,
      discount_percent: 0,
      tax_code_id: "",
    });
  };

  const totals = useMemo(() => {
    let sub = 0, disc = 0;
    const compTotals = {};
    for (const r of lines) {
      const base = Number(r.qty || 0) * Number(r.rate || 0);
      sub += base;
      const d = base * (Number(r.discount_percent || 0) / 100);
      disc += d;
      const taxable = base - d;

      const taxCodeId = r.tax_code_id;
      const comps = taxComponentsByCode[String(taxCodeId)] || [];
      if (comps.length > 0) {
        comps.forEach((c) => {
          const rate = Number(c.rate_percent) || 0;
          const amt = (taxable * rate) / 100;
          const name = c.component_name;
          if (!compTotals[name]) {
            compTotals[name] = { amount: 0, rate, sort_order: c.sort_order || 0 };
          }
          compTotals[name].amount += amt;
        });
      } else {
        const txRate = Number((taxCodes.find((t) => String(t.id) === String(taxCodeId)) || {}).rate_percent || 0);
        const taxVal = taxable * (txRate / 100);
        if (txRate > 0) {
          const name = "Tax";
          if (!compTotals[name]) compTotals[name] = { amount: 0, rate: txRate, sort_order: 99 };
          compTotals[name].amount += taxVal;
        }
      }
    }
    const components = Object.keys(compTotals).map(name => ({
      name,
      amount: compTotals[name].amount,
      rate: compTotals[name].rate,
      sort_order: compTotals[name].sort_order
    })).sort((a, b) => a.sort_order - b.sort_order);

    const taxTotal = components.reduce((s, c) => s + c.amount, 0);
    return { subtotal: sub, discountAmount: disc, taxAmount: taxTotal, total: sub - disc + taxTotal, components };
  }, [lines, taxCodes, taxComponentsByCode]);

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
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg mb-6">
              <h4 className="text-sm font-semibold mb-3 text-brand">Add Item Line</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-3">
                <div className="md:col-span-2">
                  <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Description *</label>
                  <input
                    className="input text-sm"
                    value={newItem.description}
                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                    placeholder="Enter item details"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Qty</label>
                  <input
                    type="number"
                    className="input text-sm"
                    value={newItem.qty}
                    onChange={(e) => setNewItem({ ...newItem, qty: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Rate</label>
                  <input
                    type="number"
                    className="input text-sm"
                    value={newItem.rate}
                    onChange={(e) => setNewItem({ ...newItem, rate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Disc %</label>
                  <input
                    type="number"
                    className="input text-sm"
                    value={newItem.discount_percent}
                    onChange={(e) => setNewItem({ ...newItem, discount_percent: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Tax Code</label>
                  <select
                    className="input text-sm"
                    value={newItem.tax_code_id}
                    onChange={(e) => setNewItem({ ...newItem, tax_code_id: e.target.value })}
                  >
                    <option value="">No Tax</option>
                    {taxCodes.map((t) => (
                      <option key={t.id} value={String(t.id)}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-1">
                   {newItem.tax_code_id && calcNewItemTaxBreakdown().components.length > 0 && (
                     <div className="border border-brand/20 bg-brand/5 rounded-md p-2 text-[11px] mt-1">
                       <span className="font-bold block border-b border-brand/10 mb-1">Tax Calculation:</span>
                       {calcNewItemTaxBreakdown().components.map(c => (
                         <div key={c.name} className="flex justify-between">
                           <span>{c.name}:</span>
                           <span className="font-semibold">{c.amount.toFixed(2)}</span>
                         </div>
                       ))}
                       <div className="flex justify-between border-t border-brand/10 mt-1 pt-1 font-bold italic">
                         <span>Total Tax:</span>
                         <span>{calcNewItemTaxBreakdown().taxTotal.toFixed(2)}</span>
                       </div>
                     </div>
                   )}
                </div>
                <div className="md:col-span-1 flex items-end justify-end">
                  <button
                    type="button"
                    className="btn btn-primary px-4 py-1.5 text-xs flex items-center gap-2"
                    onClick={addItemToLines}
                    disabled={!newItem.description || !newItem.qty}
                  >
                    <span>+</span> Add Line
                  </button>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead className="bg-[#f8f9fa]">
                  <tr>
                    <th>#</th>
                    <th>Description</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Rate</th>
                    <th className="text-right">Disc%</th>
                    <th className="text-right">Tax</th>
                    <th className="text-right">Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center py-10 text-slate-400 bg-slate-50 italic">
                        No quotation lines added yet.
                      </td>
                    </tr>
                  ) : (
                    lines.map((row, i) => {
                       const gross = (Number(row.qty) || 0) * (Number(row.rate) || 0);
                       const disc = gross * (Number(row.discount_percent || 0) / 100);
                       const net = gross - disc;
                       const tax = (Number(row.amount) || 0) - net;
                       return (
                         <tr key={row.id || i} className="hover:bg-slate-50">
                           <td>{i + 1}</td>
                           <td className="font-medium text-[#0E3646]">{row.description}</td>
                           <td className="text-right font-semibold">{row.qty}</td>
                           <td className="text-right font-mono">{Number(row.rate).toFixed(2)}</td>
                           <td className="text-right text-red-500">{row.discount_percent}%</td>
                           <td className="text-right text-slate-500">{tax.toFixed(2)}</td>
                           <td className="text-right font-bold text-[#0E3646]">{Number(row.amount).toFixed(2)}</td>
                           <td className="text-center">
                             <button type="button" className="text-red-500 hover:text-red-800 transition-colors" onClick={() => removeLine(i)}>Remove</button>
                           </td>
                         </tr>
                       );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end">
              <div className="w-72 space-y-1 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>{totals.subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Discount</span><span>-{totals.discountAmount.toFixed(2)}</span></div>
                <div className="flex justify-between py-1 border-b border-slate-200"><span>Tax</span><span className="font-bold">{totals.taxAmount.toFixed(2)}</span></div>
                {(totals.components || []).map((c) => (
                  <div key={c.name} className="flex justify-between text-xs text-slate-500 pl-4">
                    <span>{c.name} ({c.rate}%):</span>
                    <span>{Number(c.amount || 0).toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold border-t pt-1 text-base text-[#0E3646]"><span>Total</span><span>{totals.total.toFixed(2)}</span></div>
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
