import React, { useState, useEffect } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";

const STATUSES = ["DRAFT","SENT","RESPONDED","CLOSED"];

export default function MaintenanceRFQForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const isEdit = !!id;

  const [form, setForm] = useState({
    rfq_no: "", rfq_date: new Date().toISOString().slice(0,10),
    request_id: params.get("request_id") || "",
    scope_of_work: "", response_deadline: "", status: "DRAFT", notes: ""
  });
  const [suppliers, setSuppliers] = useState([{ supplier_id: "", supplier_name: "" }]);
  const [allSuppliers, setAllSuppliers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [saving, setSaving] = useState(false);
  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    let mounted = true;
    api.get("/purchase/suppliers").then(r => { if (mounted) setAllSuppliers(Array.isArray(r.data?.items) ? r.data.items : []); }).catch(() => {});
    api.get("/maintenance/maintenance-requests").then(r => { if (mounted) setRequests(Array.isArray(r.data?.items) ? r.data.items : []); }).catch(() => {});
    if (isEdit) {
      api.get(`/maintenance/rfqs/${id}`).then(r => {
        const item = r.data?.item || {};
        if (mounted) {
          setForm(p => ({ ...p, ...item, rfq_date: (item.rfq_date || "").slice(0,10), response_deadline: (item.response_deadline || "").slice(0,10) }));
          if (Array.isArray(r.data?.suppliers) && r.data.suppliers.length) setSuppliers(r.data.suppliers);
        }
      }).catch(() => toast.error("Failed to load RFQ"));
    }
    return () => { mounted = false; };
  }, [id]);

  const addSupplier = () => setSuppliers(p => [...p, { supplier_id: "", supplier_name: "" }]);
  const removeSupplier = i => setSuppliers(p => p.filter((_, idx) => idx !== i));
  const updateSupplier = (i, sid) => {
    const found = allSuppliers.find(s => String(s.id) === String(sid));
    setSuppliers(p => p.map((x, idx) => idx === i ? { supplier_id: sid, supplier_name: found?.supplier_name || found?.name || "" } : x));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.scope_of_work) { toast.error("Scope of work is required"); return; }
    setSaving(true);
    try {
      const payload = { ...form, suppliers };
      if (isEdit) { await api.put(`/maintenance/rfqs/${id}`, payload); toast.success("RFQ updated"); }
      else { const r = await api.post("/maintenance/rfqs", payload); toast.success(`RFQ ${r.data?.rfq_no} created`); }
      navigate("/maintenance/rfq", { state: { refresh: true } });
    } catch (e) { toast.error(e?.response?.data?.message || "Failed to save"); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/maintenance/rfq" className="btn-secondary">← Back</Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{isEdit ? "Edit" : "New"} Request for Quotation</h1>
          <p className="text-sm mt-1">Send to external service providers for maintenance quotations</p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="card">
          <div className="card-header bg-brand text-white rounded-t-lg font-semibold">RFQ Details</div>
          <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="label">RFQ No</label><input className="input" value={form.rfq_no} onChange={e => update("rfq_no", e.target.value)} placeholder="Auto-generated" /></div>
            <div><label className="label">RFQ Date</label><input className="input" type="date" value={form.rfq_date} onChange={e => update("rfq_date", e.target.value)} /></div>
            <div>
              <label className="label">Linked Request</label>
              <select className="input" value={form.request_id} onChange={e => update("request_id", e.target.value)}>
                <option value="">-- None --</option>
                {requests.map(r => <option key={r.id} value={r.id}>{r.request_no} – {r.requester_name}</option>)}
              </select>
            </div>
            <div><label className="label">Response Deadline</label><input className="input" type="date" value={form.response_deadline} onChange={e => update("response_deadline", e.target.value)} /></div>
            <div><label className="label">Status</label><select className="input" value={form.status} onChange={e => update("status", e.target.value)}>{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            <div className="md:col-span-2"><label className="label">Scope of Work *</label><textarea className="input" rows={4} value={form.scope_of_work} onChange={e => update("scope_of_work", e.target.value)} placeholder="Describe maintenance work required..." required /></div>
            <div className="md:col-span-2"><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes} onChange={e => update("notes", e.target.value)} /></div>
          </div>
        </div>
        <div className="card">
          <div className="card-header bg-brand text-white rounded-t-lg font-semibold">Invited Suppliers</div>
          <div className="card-body space-y-2">
            {suppliers.map((s, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select className="input flex-1" value={s.supplier_id} onChange={e => updateSupplier(i, e.target.value)}>
                  <option value="">-- Select Supplier --</option>
                  {allSuppliers.map(sup => <option key={sup.id} value={sup.id}>{sup.supplier_name || sup.name}</option>)}
                </select>
                <button type="button" className="btn-danger btn-sm" onClick={() => removeSupplier(i)}>Remove</button>
              </div>
            ))}
            <button type="button" className="btn-secondary btn-sm" onClick={addSupplier}>+ Add Supplier</button>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Link to="/maintenance/rfq" className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Save RFQ"}</button>
        </div>
      </form>
    </div>
  );
}
