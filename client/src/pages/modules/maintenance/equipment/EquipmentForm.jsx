import React, { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";

const CATEGORIES = ["HVAC","Electrical","Plumbing","Mechanical","IT","Vehicles","Safety","Other"];
const STATUSES = ["ACTIVE","INACTIVE","UNDER_REPAIR","DECOMMISSIONED"];

export default function EquipmentForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [form, setForm] = useState({
    equipment_code: "", equipment_name: "", category: "", location: "",
    manufacturer: "", model: "", serial_number: "",
    purchase_date: "", warranty_expiry: "", status: "ACTIVE", notes: ""
  });
  const [saving, setSaving] = useState(false);
  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    let m = true;
    if (isEdit) {
      api.get(`/maintenance/equipment/${id}`)
        .then(r => { const item = r.data?.item || {}; if (m) setForm(p => ({ ...p, ...item, purchase_date: (item.purchase_date || "").slice(0,10), warranty_expiry: (item.warranty_expiry || "").slice(0,10) })); })
        .catch(() => toast.error("Failed to load equipment"));
    }
    return () => { m = false; };
  }, [id]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.equipment_name) { toast.error("Equipment name is required"); return; }
    setSaving(true);
    try {
      if (isEdit) { await api.put(`/maintenance/equipment/${id}`, form); toast.success("Equipment updated"); }
      else { await api.post("/maintenance/equipment", form); toast.success("Equipment created"); }
      navigate("/maintenance/equipment", { state: { refresh: true } });
    } catch (e) { toast.error(e?.response?.data?.message || "Failed to save"); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/maintenance/equipment" className="btn-secondary">← Back</Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{isEdit ? "Edit" : "New"} Equipment</h1>
          <p className="text-sm mt-1">Register equipment and assets for maintenance tracking</p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="card">
          <div className="card-header bg-brand text-white rounded-t-lg font-semibold">Equipment Details</div>
          <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="label">Equipment Code</label><input className="input" value={form.equipment_code} onChange={e => update("equipment_code", e.target.value)} placeholder="e.g. EQ-001" /></div>
            <div><label className="label">Equipment Name *</label><input className="input" value={form.equipment_name} onChange={e => update("equipment_name", e.target.value)} placeholder="Equipment name" required /></div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.category} onChange={e => update("category", e.target.value)}>
                <option value="">-- Select Category --</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><label className="label">Location</label><input className="input" value={form.location} onChange={e => update("location", e.target.value)} placeholder="Building, floor, room..." /></div>
            <div><label className="label">Manufacturer</label><input className="input" value={form.manufacturer} onChange={e => update("manufacturer", e.target.value)} /></div>
            <div><label className="label">Model</label><input className="input" value={form.model} onChange={e => update("model", e.target.value)} /></div>
            <div><label className="label">Serial Number</label><input className="input" value={form.serial_number} onChange={e => update("serial_number", e.target.value)} /></div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={e => update("status", e.target.value)}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label className="label">Purchase Date</label><input className="input" type="date" value={form.purchase_date} onChange={e => update("purchase_date", e.target.value)} /></div>
            <div><label className="label">Warranty Expiry</label><input className="input" type="date" value={form.warranty_expiry} onChange={e => update("warranty_expiry", e.target.value)} /></div>
            <div className="md:col-span-2"><label className="label">Notes</label><textarea className="input" rows={3} value={form.notes} onChange={e => update("notes", e.target.value)} /></div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Link to="/maintenance/equipment" className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Save Equipment"}</button>
        </div>
      </form>
    </div>
  );
}
