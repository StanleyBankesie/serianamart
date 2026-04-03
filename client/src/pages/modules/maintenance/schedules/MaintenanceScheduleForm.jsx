import React, { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";

const FREQUENCIES = ["Daily","Weekly","Biweekly","Monthly","Quarterly","Biannual","Annual"];
const STATUSES = ["ACTIVE","INACTIVE","SUSPENDED"];

export default function MaintenanceScheduleForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [form, setForm] = useState({ schedule_name: "", asset_name: "", frequency: "Monthly", next_due_date: "", assigned_to: "", description: "", status: "ACTIVE" });
  const [equipment, setEquipment] = useState([]);
  const [saving, setSaving] = useState(false);
  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    let m = true;
    api.get("/maintenance/equipment").then(r => { if (m) setEquipment(Array.isArray(r.data?.items) ? r.data.items : []); }).catch(() => {});
    if (isEdit) api.get(`/maintenance/schedules/${id}`).then(r => { const item = r.data?.item || {}; if (m) setForm(p => ({ ...p, ...item, next_due_date: (item.next_due_date || "").slice(0,10) })); }).catch(() => toast.error("Failed to load"));
    return () => { m = false; };
  }, [id]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.schedule_name) { toast.error("Schedule name is required"); return; }
    setSaving(true);
    try {
      if (isEdit) { await api.put(`/maintenance/schedules/${id}`, form); toast.success("Schedule updated"); }
      else { await api.post("/maintenance/schedules", form); toast.success("Schedule created"); }
      navigate("/maintenance/schedules", { state: { refresh: true } });
    } catch (e) { toast.error(e?.response?.data?.message || "Failed to save"); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/maintenance/schedules" className="btn-secondary">← Back</Link>
        <div><h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{isEdit ? "Edit" : "New"} Maintenance Schedule</h1></div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="card">
          <div className="card-header bg-brand text-white rounded-t-lg font-semibold">Schedule Details</div>
          <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2"><label className="label">Schedule Name *</label><input className="input" value={form.schedule_name} onChange={e => update("schedule_name", e.target.value)} placeholder="e.g. Monthly Generator Service" required /></div>
            <div><label className="label">Equipment / Asset</label><select className="input" value={form.asset_name} onChange={e => update("asset_name", e.target.value)}><option value="">-- Select --</option>{equipment.map(eq => <option key={eq.id} value={eq.equipment_name}>{eq.equipment_code} – {eq.equipment_name}</option>)}</select></div>
            <div><label className="label">Frequency</label><select className="input" value={form.frequency} onChange={e => update("frequency", e.target.value)}>{FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}</select></div>
            <div><label className="label">Next Due Date</label><input className="input" type="date" value={form.next_due_date} onChange={e => update("next_due_date", e.target.value)} /></div>
            <div><label className="label">Assigned To</label><input className="input" value={form.assigned_to} onChange={e => update("assigned_to", e.target.value)} placeholder="Team or technician" /></div>
            <div><label className="label">Status</label><select className="input" value={form.status} onChange={e => update("status", e.target.value)}>{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            <div className="md:col-span-2"><label className="label">Description</label><textarea className="input" rows={3} value={form.description} onChange={e => update("description", e.target.value)} /></div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Link to="/maintenance/schedules" className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Save Schedule"}</button>
        </div>
      </form>
    </div>
  );
}
