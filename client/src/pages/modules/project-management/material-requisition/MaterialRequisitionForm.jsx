import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Loader2, Plus, Trash2, ChevronDown, Calendar, Search } from "lucide-react";
import { api } from "api/client";
import { toast } from "react-toastify";

export default function PMMaterialRequisitionForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === "new";
  const isView = new URLSearchParams(window.location.search).get("view") === "1";

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [projects, setProjects] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [availableItems, setAvailableItems] = useState([]);

  const [form, setForm] = useState({
    requisition_no: "Auto-generated",
    requisition_date: new Date().toISOString().split("T")[0],
    project_id: "",
    warehouse_id: "",
    department_id: "",
    priority: "MEDIUM",
    requested_by: "",
    remarks: "",
    status: "DRAFT"
  });

  const [details, setDetails] = useState([
    { id: 1, item_id: "", item_code: "", item_name: "", qty_requested: 0, qty_received: 0, uom: "PCS", batch_no: "" }
  ]);

  useEffect(() => {
    Promise.all([
      api.get("/projects/projects").then(r => setProjects(r.data?.items || [])).catch(() => {}),
      api.get("/inventory/warehouses").then(r => setWarehouses(r.data?.items || [])).catch(() => {}),
      api.get("/admin/departments").then(r => setDepartments(r.data?.items || [])).catch(() => {}),
      api.get("/inventory/items").then(r => setAvailableItems(r.data?.items || [])).catch(() => {}),
    ]);
    if (!isNew && id) fetchReq();
  }, [id]);

  const fetchReq = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/projects/material-requisitions/${id}`);
      const d = res.data?.item;
      if (d) {
        setForm({
          requisition_no: d.requisition_no || "",
          requisition_date: d.requisition_date ? d.requisition_date.split("T")[0] : "",
          project_id: d.project_id ? String(d.project_id) : "",
          warehouse_id: d.warehouse_id ? String(d.warehouse_id) : "",
          department_id: d.department_id ? String(d.department_id) : "",
          priority: d.priority || "MEDIUM",
          requested_by: d.requested_by || "",
          remarks: d.remarks || "",
          status: d.status || "DRAFT"
        });
      }
      const dets = res.data?.details || [];
      if (dets.length) {
        setDetails(dets.map(dd => ({
          id: dd.id,
          item_id: dd.item_id ? String(dd.item_id) : "",
          item_code: dd.item_code || "",
          item_name: dd.item_name || "",
          qty_requested: dd.qty_requested || 0,
          qty_received: dd.qty_received || 0,
          uom: dd.uom || "PCS",
          batch_no: dd.batch_no || ""
        })));
      }
    } catch (e) { toast.error("Failed to load"); }
    finally { setLoading(false); }
  };

  const addLine = () => {
    setDetails(prev => [...prev, { id: Date.now(), item_id: "", item_code: "", item_name: "", qty_requested: 0, qty_received: 0, uom: "PCS", batch_no: "" }]);
  };

  const removeLine = (idx) => {
    if (details.length === 1) return;
    setDetails(prev => prev.filter((_, i) => i !== idx));
  };

  const updateLine = (idx, field, val) => {
    setDetails(prev => prev.map((d, i) => i === idx ? { ...d, [field]: val } : d));
  };

  const onItemSelect = (idx, itemId) => {
    const item = availableItems.find(i => String(i.id) === itemId);
    updateLine(idx, "item_id", itemId);
    if (item) {
      updateLine(idx, "item_code", item.item_code || "");
      updateLine(idx, "item_name", item.item_name || "");
      updateLine(idx, "uom", item.uom || "PCS");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, details: details.filter(d => d.item_id) };
      if (isNew) {
        await api.post("/projects/material-requisitions", payload);
        toast.success("Requisition created");
      } else {
        await api.put(`/projects/material-requisitions/${id}`, payload);
        toast.success("Requisition updated");
      }
      navigate("/project-management/material-requisitions");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to save");
    } finally { setSaving(false); }
  };

  if (loading) return <div className="p-20 text-center animate-pulse font-bold text-slate-300 uppercase italic">Loading...</div>;

  const readOnly = isView || (form.status !== "DRAFT");

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/project-management/material-requisitions" className="btn btn-secondary p-2"><ArrowLeft size={20} /></Link>
          <div>
            <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">{isNew ? "New Material Requisition" : `Requisition ${form.requisition_no}`}</h1>
            <p className="text-slate-500 text-sm">{isNew ? "Request materials for your project" : `Status: ${form.status}`}</p>
          </div>
        </div>
        {!readOnly && (
          <button onClick={handleSubmit} disabled={saving} className="btn-success flex items-center gap-2">
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {isNew ? "Create Requisition" : "Update"}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-8 space-y-6">
            <h2 className="font-bold uppercase text-xs tracking-wider text-brand-600 border-b pb-3">Requisition Details</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Requisition No</label>
                <input type="text" className="input w-full bg-slate-50" value={form.requisition_no} readOnly />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Date</label>
                <input type="date" className="input w-full" value={form.requisition_date}
                  onChange={e => setForm({...form, requisition_date: e.target.value})} disabled={readOnly} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Project</label>
                <select className="input w-full" value={form.project_id} onChange={e => setForm({...form, project_id: e.target.value})} disabled={readOnly}>
                  <option value="">Select project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Priority</label>
                <select className="input w-full" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})} disabled={readOnly}>
                  {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Warehouse</label>
                <select className="input w-full" value={form.warehouse_id} onChange={e => setForm({...form, warehouse_id: e.target.value})} disabled={readOnly}>
                  <option value="">Select warehouse</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.warehouse_name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Department</label>
                <select className="input w-full" value={form.department_id} onChange={e => setForm({...form, department_id: e.target.value})} disabled={readOnly}>
                  <option value="">Select department</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.dept_name}</option>)}
                </select>
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Requested By</label>
                <input type="text" className="input w-full" value={form.requested_by} onChange={e => setForm({...form, requested_by: e.target.value})} disabled={readOnly} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Remarks</label>
                <textarea className="input w-full min-h-[60px]" value={form.remarks} onChange={e => setForm({...form, remarks: e.target.value})} disabled={readOnly} />
              </div>
            </div>
          </div>

          <div className="card p-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold uppercase text-xs tracking-wider text-brand-600">Items</h2>
              {!readOnly && (
                <button type="button" onClick={addLine} className="btn btn-sm flex items-center gap-1"><Plus size={14} /> Add Item</button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead><tr className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">UOM</th>
                  <th className="px-3 py-2 text-right">Qty Requested</th>
                  <th className="px-3 py-2 text-right">Qty Received</th>
                  <th className="px-3 py-2">Batch No</th>
                  {!readOnly && <th className="px-3 py-2"></th>}
                </tr></thead>
                <tbody className="divide-y">
                  {details.map((d, idx) => (
                    <tr key={d.id}>
                      <td className="px-3 py-2">
                        {readOnly ? (
                          <span>{d.item_name}</span>
                        ) : (
                          <select className="input w-48 text-xs py-1" value={d.item_id} onChange={e => onItemSelect(idx, e.target.value)}>
                            <option value="">Select item</option>
                            {availableItems.map(i => <option key={i.id} value={i.id}>{i.item_name}</option>)}
                          </select>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">{d.item_code}</td>
                      <td className="px-3 py-2">{d.uom}</td>
                      <td className="px-3 py-2">
                        <input type="number" className="input w-20 text-xs py-1 text-right" value={d.qty_requested}
                          onChange={e => updateLine(idx, "qty_requested", Number(e.target.value))} disabled={readOnly} />
                      </td>
                      <td className="px-3 py-2 text-right">{d.qty_received}</td>
                      <td className="px-3 py-2">
                        <input type="text" className="input w-24 text-xs py-1" value={d.batch_no}
                          onChange={e => updateLine(idx, "batch_no", e.target.value)} disabled={readOnly} />
                      </td>
                      {!readOnly && (
                        <td className="px-3 py-2">
                          <button type="button" onClick={() => removeLine(idx)} className="p-1 text-rose-500 hover:text-rose-700"><Trash2 size={14} /></button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6 space-y-4">
            <h2 className="font-bold uppercase text-xs tracking-wider text-slate-500">Summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Total Items:</span><span className="font-bold">{details.filter(d => d.item_id).length}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Total Qty:</span><span className="font-bold">{details.reduce((s, d) => s + Number(d.qty_requested || 0), 0)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Status:</span><span className="font-bold uppercase text-xs">{form.status}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
