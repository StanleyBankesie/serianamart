import React, { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";

const STATUSES = ["ACTIVE","PENDING","EXPIRED","CANCELLED"];

export default function MaintenanceContractForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [form, setForm] = useState({
    contract_no: "", supplier_id: "", supplier_name: "",
    start_date: "", end_date: "", contract_value: 0,
    scope: "", payment_terms: "30 days", renewal_alert_days: 30,
    status: "ACTIVE", notes: ""
  });
  const [assets, setAssets] = useState([{ asset_id: "", asset_name: "" }]);
  const [suppliers, setSuppliers] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [saving, setSaving] = useState(false);
  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    let m = true;
    api.get("/purchase/suppliers").then(r => { if (m) setSuppliers(Array.isArray(r.data?.items) ? r.data.items : []); }).catch(() => {});
    api.get("/maintenance/equipment").then(r => { if (m) setEquipment(Array.isArray(r.data?.items) ? r.data.items : []); }).catch(() => {});
    if (isEdit) {
      api.get(`/maintenance/contracts/${id}`).then(r => {
        const item = r.data?.item || {};
        if (m) {
          setForm(p => ({ ...p, ...item, start_date: (item.start_date || "").slice(0,10), end_date: (item.end_date || "").slice(0,10) }));
          if (Array.isArray(r.data?.assets) && r.data.assets.length) setAssets(r.data.assets);
        }
      }).catch(() => toast.error("Failed to load contract"));
    }
    return () => { m = false; };
  }, [id]);

  const addAsset = () => setAssets(p => [...p, { asset_id: "", asset_name: "" }]);
  const removeAsset = i => setAssets(p => p.filter((_, idx) => idx !== i));
  const updateAsset = (i, eid) => {
    const eq = equipment.find(e => String(e.id) === String(eid));
    setAssets(p => p.map((a, idx) => idx === i ? { asset_id: eid, asset_name: eq?.equipment_name || "" } : a));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.supplier_id) { toast.error("Please select a supplier"); return; }
    setSaving(true);
    try {
      const payload = { ...form, assets };
      if (isEdit) { await api.put(`/maintenance/contracts/${id}`, payload); toast.success("Contract updated"); }
      else { const r = await api.post("/maintenance/contracts", payload); toast.success(`Contract ${r.data?.contract_no} created`); }
      navigate("/maintenance/contracts", { state: { refresh: true } });
    } catch (e) { toast.error(e?.response?.data?.message || "Failed to save"); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/maintenance/contracts" className="btn-secondary">← Back</Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{isEdit ? "Edit" : "New"} Maintenance Contract</h1>
          <p className="text-sm mt-1">Manage external maintenance service contracts</p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="card">
          <div className="card-header bg-brand text-white rounded-t-lg font-semibold">Contract Details</div>
          <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="label">Contract No</label><input className="input" value={form.contract_no} onChange={e => update("contract_no", e.target.value)} placeholder="Auto-generated" /></div>
            <div>
              <label className="label">Supplier *</label>
              <select className="input" value={form.supplier_id} onChange={e => { const s = suppliers.find(x => String(x.id) === e.target.value); update("supplier_id", e.target.value); update("supplier_name", s?.supplier_name || s?.name || ""); }} required>
                <option value="">-- Select Supplier --</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.supplier_name || s.name}</option>)}
              </select>
            </div>
            <div><label className="label">Start Date</label><input className="input" type="date" value={form.start_date} onChange={e => update("start_date", e.target.value)} /></div>
            <div><label className="label">End Date</label><input className="input" type="date" value={form.end_date} onChange={e => update("end_date", e.target.value)} /></div>
            <div><label className="label">Contract Value</label><input className="input text-right" type="number" step="0.01" value={form.contract_value} onChange={e => update("contract_value", e.target.value)} /></div>
            <div><label className="label">Payment Terms</label><input className="input" value={form.payment_terms} onChange={e => update("payment_terms", e.target.value)} /></div>
            <div><label className="label">Renewal Alert (days before end)</label><input className="input" type="number" value={form.renewal_alert_days} onChange={e => update("renewal_alert_days", e.target.value)} /></div>
            <div><label className="label">Status</label><select className="input" value={form.status} onChange={e => update("status", e.target.value)}>{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            <div className="md:col-span-2"><label className="label">Scope of Contract</label><textarea className="input" rows={4} value={form.scope} onChange={e => update("scope", e.target.value)} placeholder="Services covered, response times, exclusions..." /></div>
            <div className="md:col-span-2"><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes} onChange={e => update("notes", e.target.value)} /></div>
          </div>
        </div>
        <div className="card">
          <div className="card-header bg-brand text-white rounded-t-lg font-semibold">Covered Assets / Equipment</div>
          <div className="card-body space-y-2">
            {assets.map((a, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select className="input flex-1" value={a.asset_id} onChange={e => updateAsset(i, e.target.value)}>
                  <option value="">-- Select Equipment --</option>
                  {equipment.map(eq => <option key={eq.id} value={eq.id}>{eq.equipment_code} – {eq.equipment_name}</option>)}
                </select>
                <button type="button" className="btn-danger btn-sm" onClick={() => removeAsset(i)}>Remove</button>
              </div>
            ))}
            <button type="button" className="btn-secondary btn-sm" onClick={addAsset}>+ Add Asset</button>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Link to="/maintenance/contracts" className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Save Contract"}</button>
        </div>
      </form>
    </div>
  );
}
