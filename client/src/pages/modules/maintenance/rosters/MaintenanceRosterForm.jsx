import React, { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";

const STATUSES = ["DRAFT","ACTIVE","CLOSED"];

export default function MaintenanceRosterForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [form, setForm] = useState({ roster_name: "", period_start: "", period_end: "", team_members: "", shift_details: "", status: "DRAFT" });
  const [saving, setSaving] = useState(false);
  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    let m = true;
    if (isEdit) api.get(`/maintenance/rosters/${id}`).then(r => { const item = r.data?.item || {}; if (m) setForm(p => ({ ...p, ...item, period_start: (item.period_start || "").slice(0,10), period_end: (item.period_end || "").slice(0,10) })); }).catch(() => toast.error("Failed to load"));
    return () => { m = false; };
  }, [id]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.roster_name) { toast.error("Roster name is required"); return; }
    setSaving(true);
    try {
      if (isEdit) { await api.put(`/maintenance/rosters/${id}`, form); toast.success("Roster updated"); }
      else { await api.post("/maintenance/rosters", form); toast.success("Roster created"); }
      navigate("/maintenance/rosters", { state: { refresh: true } });
    } catch (e) { toast.error(e?.response?.data?.message || "Failed to save"); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/maintenance/rosters" className="btn-secondary">← Back</Link>
        <div><h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{isEdit ? "Edit" : "New"} Maintenance Roster</h1></div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="card">
          <div className="card-header bg-brand text-white rounded-t-lg font-semibold">Roster Details</div>
          <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2"><label className="label">Roster Name *</label><input className="input" value={form.roster_name} onChange={e => update("roster_name", e.target.value)} required /></div>
            <div><label className="label">Period Start</label><input className="input" type="date" value={form.period_start} onChange={e => update("period_start", e.target.value)} /></div>
            <div><label className="label">Period End</label><input className="input" type="date" value={form.period_end} onChange={e => update("period_end", e.target.value)} /></div>
            <div><label className="label">Status</label><select className="input" value={form.status} onChange={e => update("status", e.target.value)}>{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            <div className="md:col-span-2"><label className="label">Team Members</label><textarea className="input" rows={3} value={form.team_members} onChange={e => update("team_members", e.target.value)} placeholder="List team members (one per line or comma separated)" /></div>
            <div className="md:col-span-2"><label className="label">Shift Details / Assignments</label><textarea className="input" rows={4} value={form.shift_details} onChange={e => update("shift_details", e.target.value)} placeholder="Shift times, tasks assigned per member..." /></div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Link to="/maintenance/rosters" className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Save Roster"}</button>
        </div>
      </form>
    </div>
  );
}
