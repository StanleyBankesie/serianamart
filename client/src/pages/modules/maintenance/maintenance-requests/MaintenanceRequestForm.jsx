import React, { useState, useEffect } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";

const MAINT_TYPES = ["Corrective","Preventive","Predictive","Emergency","Routine"];
const PRIORITIES = ["LOW","NORMAL","HIGH","CRITICAL"];
const STATUSES = ["DRAFT","OPEN","IN_PROGRESS","COMPLETED","CANCELLED"];

export default function MaintenanceRequestForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const isEdit = !!id;
  const [form, setForm] = useState({
    request_no: "", request_date: new Date().toISOString().slice(0,10),
    requester_name: "", department: "", asset_name: "",
    maintenance_type: "", priority: "NORMAL", description: "",
    status: "DRAFT", notes: ""
  });
  const [departments, setDepartments] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [saving, setSaving] = useState(false);

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    let mounted = true;
    api.get("/admin/departments").then(r => { if (mounted) setDepartments(Array.isArray(r.data?.items) ? r.data.items : []); }).catch(() => {});
    api.get("/maintenance/equipment").then(r => { if (mounted) setEquipment(Array.isArray(r.data?.items) ? r.data.items : []); }).catch(() => {});
    if (isEdit) {
      api.get(`/maintenance/maintenance-requests/${id}`).then(r => {
        const item = r.data?.item || {};
        if (mounted) setForm(p => ({ ...p, ...item, request_date: (item.request_date || "").slice(0,10) }));
      }).catch(() => toast.error("Failed to load request"));
    }
    return () => { mounted = false; };
  }, [id]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.requester_name || !form.maintenance_type || !form.description) {
      toast.error("Please fill all required fields"); return;
    }
    setSaving(true);
    try {
      const payload = { ...form };
      if (isEdit) {
        await api.put(`/maintenance/maintenance-requests/${id}`, payload);
        toast.success("Request updated");
      } else {
        const r = await api.post("/maintenance/maintenance-requests", payload);
        toast.success(`Request ${r.data?.request_no} created`);
      }
      navigate("/maintenance/maintenance-requests", { state: { refresh: true } });
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to save");
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/maintenance/maintenance-requests" className="btn-secondary">← Back</Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {isEdit ? "Edit" : "New"} Maintenance Request
          </h1>
          <p className="text-sm mt-1">Record and track an internal maintenance request</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="card">
          <div className="card-header bg-brand text-white rounded-t-lg font-semibold">Request Details</div>
          <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">Request No</label>
              <input className="input" value={form.request_no} onChange={e => update("request_no", e.target.value)} placeholder="Auto-generated" />
            </div>
            <div>
              <label className="label">Request Date *</label>
              <input className="input" type="date" value={form.request_date} onChange={e => update("request_date", e.target.value)} required />
            </div>
            <div>
              <label className="label">Requester Name *</label>
              <input className="input" value={form.requester_name} onChange={e => update("requester_name", e.target.value)} placeholder="Full name" required />
            </div>
            <div>
              <label className="label">Department</label>
              <select className="input" value={form.department} onChange={e => update("department", e.target.value)}>
                <option value="">-- Select --</option>
                {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Equipment / Asset</label>
              <select className="input" value={form.asset_name} onChange={e => update("asset_name", e.target.value)}>
                <option value="">-- Select Equipment --</option>
                {equipment.map(eq => <option key={eq.id} value={eq.equipment_name}>{eq.equipment_code} – {eq.equipment_name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Maintenance Type *</label>
              <select className="input" value={form.maintenance_type} onChange={e => update("maintenance_type", e.target.value)} required>
                <option value="">-- Select Type --</option>
                {MAINT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select className="input" value={form.priority} onChange={e => update("priority", e.target.value)}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={e => update("status", e.target.value)}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">Description *</label>
              <textarea className="input" rows={4} value={form.description} onChange={e => update("description", e.target.value)} placeholder="Describe the issue or maintenance needed" required />
            </div>
            <div className="md:col-span-2">
              <label className="label">Notes</label>
              <textarea className="input" rows={2} value={form.notes} onChange={e => update("notes", e.target.value)} placeholder="Additional notes" />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Link to="/maintenance/maintenance-requests" className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Save Request"}</button>
        </div>
      </form>
    </div>
  );
}
