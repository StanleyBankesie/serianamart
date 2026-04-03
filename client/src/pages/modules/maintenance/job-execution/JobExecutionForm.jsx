import React, { useState, useEffect } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";

const COMPLETION = ["IN_PROGRESS","COMPLETED","ON_HOLD","CANCELLED"];
const STATUSES = ["DRAFT","OPEN","COMPLETED","CLOSED"];

export default function JobExecutionForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const isEdit = !!id;

  const [form, setForm] = useState({
    execution_no: "", job_order_id: params.get("job_order_id") || "",
    start_date: new Date().toISOString().slice(0,10), end_date: "",
    technicians: "", work_done: "", materials_used: "",
    completion_status: "IN_PROGRESS", sign_off_by: "", status: "DRAFT", notes: ""
  });
  const [jobOrders, setJobOrders] = useState([]);
  const [saving, setSaving] = useState(false);
  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    let mounted = true;
    api.get("/maintenance/job-orders").then(r => { if (mounted) setJobOrders(Array.isArray(r.data?.items) ? r.data.items : []); }).catch(() => {});
    if (isEdit) {
      api.get(`/maintenance/job-executions/${id}`).then(r => {
        const item = r.data?.item || {};
        if (mounted) setForm(p => ({ ...p, ...item, start_date: (item.start_date || "").slice(0,10), end_date: (item.end_date || "").slice(0,10) }));
      }).catch(() => toast.error("Failed to load execution"));
    }
    return () => { mounted = false; };
  }, [id]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.job_order_id) { toast.error("Please select a job order"); return; }
    setSaving(true);
    try {
      if (isEdit) { await api.put(`/maintenance/job-executions/${id}`, form); toast.success("Execution updated"); }
      else { const r = await api.post("/maintenance/job-executions", form); toast.success(`Execution ${r.data?.execution_no} created`); }
      navigate("/maintenance/job-executions", { state: { refresh: true } });
    } catch (e) { toast.error(e?.response?.data?.message || "Failed to save"); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/maintenance/job-executions" className="btn-secondary">← Back</Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{isEdit ? "Edit" : "New"} Job Execution</h1>
          <p className="text-sm mt-1">Record work done and completion of a job order</p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="card">
          <div className="card-header bg-brand text-white rounded-t-lg font-semibold">Execution Details</div>
          <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="label">Execution No</label><input className="input" value={form.execution_no} onChange={e => update("execution_no", e.target.value)} placeholder="Auto-generated" /></div>
            <div>
              <label className="label">Job Order *</label>
              <select className="input" value={form.job_order_id} onChange={e => update("job_order_id", e.target.value)} required>
                <option value="">-- Select Job Order --</option>
                {jobOrders.map(o => <option key={o.id} value={o.id}>{o.order_no} – {o.asset_name}</option>)}
              </select>
            </div>
            <div><label className="label">Start Date</label><input className="input" type="date" value={form.start_date} onChange={e => update("start_date", e.target.value)} /></div>
            <div><label className="label">End Date</label><input className="input" type="date" value={form.end_date} onChange={e => update("end_date", e.target.value)} /></div>
            <div><label className="label">Technicians</label><input className="input" value={form.technicians} onChange={e => update("technicians", e.target.value)} placeholder="Names of technicians" /></div>
            <div><label className="label">Sign-off By</label><input className="input" value={form.sign_off_by} onChange={e => update("sign_off_by", e.target.value)} placeholder="Supervisor or manager" /></div>
            <div><label className="label">Completion Status</label><select className="input" value={form.completion_status} onChange={e => update("completion_status", e.target.value)}>{COMPLETION.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            <div><label className="label">Status</label><select className="input" value={form.status} onChange={e => update("status", e.target.value)}>{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            <div className="md:col-span-2"><label className="label">Work Done</label><textarea className="input" rows={4} value={form.work_done} onChange={e => update("work_done", e.target.value)} placeholder="Describe work performed..." /></div>
            <div className="md:col-span-2"><label className="label">Materials Used</label><textarea className="input" rows={3} value={form.materials_used} onChange={e => update("materials_used", e.target.value)} placeholder="Parts, materials, tools used..." /></div>
            <div className="md:col-span-2"><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes} onChange={e => update("notes", e.target.value)} /></div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Link to="/maintenance/job-executions" className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Save Execution"}</button>
        </div>
      </form>
    </div>
  );
}
