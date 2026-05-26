import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Loader2, Plus, Trash2 } from "lucide-react";
import { api } from "api/client";
import { toast } from "react-toastify";

export default function PMMaterialUtilizationForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === "new";

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [availableItems, setAvailableItems] = useState([]);
  const [stockMap, setStockMap] = useState({});

  const [form, setForm] = useState({
    utilization_no: "Auto-generated",
    utilization_date: new Date().toISOString().split("T")[0],
    project_id: "",
    task_id: "",
    task_summary: "",
    location: "",
    remarks: "",
    status: "DRAFT"
  });

  const [details, setDetails] = useState([
    { id: 1, item_id: "", item_name: "", uom: "PCS", required_qty: 0, qty_in_stock: 0, cost_price: 0 }
  ]);

  useEffect(() => {
    Promise.all([
      api.get("/projects/projects").then(r => setProjects(r.data?.items || [])).catch(() => {}),
      api.get("/projects/tasks").then(r => setTasks(r.data?.items || [])).catch(() => {}),
      api.get("/inventory/items").then(r => {
        const items = r.data?.items || [];
        setAvailableItems(items);
        const map = {};
        items.forEach(i => { map[i.id] = i.stock_level || 0; });
        setStockMap(map);
      }).catch(() => {}),
    ]);
    if (!isNew && id) fetchUtil();
  }, [id]);

  const fetchUtil = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/projects/material-utilizations/${id}`);
      const d = res.data?.item;
      if (d) {
        setForm({
          utilization_no: d.utilization_no || "",
          utilization_date: d.utilization_date ? d.utilization_date.split("T")[0] : "",
          project_id: d.project_id ? String(d.project_id) : "",
          task_id: d.task_id ? String(d.task_id) : "",
          task_summary: d.task_summary || "",
          location: d.location || "",
          remarks: d.remarks || "",
          status: d.status || "DRAFT"
        });
      }
      const dets = res.data?.details || [];
      if (dets.length) {
        setDetails(dets.map(dd => ({
          id: dd.id,
          item_id: dd.item_id ? String(dd.item_id) : "",
          item_name: dd.item_name || "",
          uom: dd.uom || "PCS",
          required_qty: dd.required_qty || 0,
          qty_in_stock: dd.qty_in_stock || 0,
          cost_price: dd.cost_price || 0
        })));
      }
    } catch (e) { toast.error("Failed to load"); }
    finally { setLoading(false); }
  };

  const addLine = () => {
    setDetails(prev => [...prev, { id: Date.now(), item_id: "", item_name: "", uom: "PCS", required_qty: 0, qty_in_stock: 0, cost_price: 0 }]);
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
      updateLine(idx, "item_name", item.item_name || "");
      updateLine(idx, "uom", item.uom || "PCS");
      updateLine(idx, "cost_price", item.cost_price || 0);
      updateLine(idx, "qty_in_stock", stockMap[item.id] || 0);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, details: details.filter(d => d.item_id) };
      if (isNew) {
        await api.post("/projects/material-utilizations", payload);
        toast.success("Utilization created");
      } else {
        await api.put(`/projects/material-utilizations/${id}`, payload);
        toast.success("Utilization updated");
      }
      navigate("/project-management/material-utilizations");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to save");
    } finally { setSaving(false); }
  };

  const onProjectChange = (pid) => {
    setForm({...form, project_id: pid, task_id: ""});
    if (pid) {
      api.get(`/projects/tasks?projectId=${pid}`).then(r => setTasks(r.data?.items || [])).catch(() => {});
    } else {
      setTasks([]);
    }
  };

  if (loading) return <div className="p-20 text-center animate-pulse font-bold text-slate-300 uppercase italic">Loading...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/project-management/material-utilizations" className="btn btn-secondary p-2"><ArrowLeft size={20} /></Link>
          <div>
            <h1 className="text-2xl font-bold text-brand-900">{isNew ? "New Material Utilization" : `Utilization ${form.utilization_no}`}</h1>
            <p className="text-slate-500 text-sm">Record material consumption against project tasks</p>
          </div>
        </div>
        <button onClick={handleSubmit} disabled={saving} className="btn-success flex items-center gap-2">
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {isNew ? "Create" : "Update"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-8 space-y-6">
            <h2 className="font-bold uppercase text-xs tracking-wider text-brand-600 border-b pb-3">Header Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Utilization No</label>
                <input type="text" className="input w-full bg-slate-50" value={form.utilization_no} readOnly />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date</label>
                <input type="date" className="input w-full" value={form.utilization_date}
                  onChange={e => setForm({...form, utilization_date: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Project</label>
                <select className="input w-full" value={form.project_id} onChange={e => onProjectChange(e.target.value)}>
                  <option value="">Select project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Task</label>
                <select className="input w-full" value={form.task_id} onChange={e => {
                  setForm({...form, task_id: e.target.value});
                  const t = tasks.find(tt => String(tt.id) === e.target.value);
                  if (t) setForm(prev => ({...prev, task_id: e.target.value, task_summary: t.task_title}));
                }}>
                  <option value="">Select task</option>
                  {tasks.map(t => <option key={t.id} value={t.id}>{t.task_title}</option>)}
                </select>
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Task Summary</label>
                <input type="text" className="input w-full" value={form.task_summary}
                  onChange={e => setForm({...form, task_summary: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Location</label>
                <input type="text" className="input w-full" value={form.location}
                  onChange={e => setForm({...form, location: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Remarks</label>
                <input type="text" className="input w-full" value={form.remarks}
                  onChange={e => setForm({...form, remarks: e.target.value})} />
              </div>
            </div>
          </div>

          <div className="card p-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold uppercase text-xs tracking-wider text-brand-600">Items Consumed</h2>
              <button type="button" onClick={addLine} className="btn btn-sm flex items-center gap-1"><Plus size={14} /> Add Item</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead><tr className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2">Item Name</th>
                  <th className="px-3 py-2">UOM</th>
                  <th className="px-3 py-2 text-right">Required Qty</th>
                  <th className="px-3 py-2 text-right">Qty in Stock</th>
                  <th className="px-3 py-2 text-right">Cost Price</th>
                  <th className="px-3 py-2"></th>
                </tr></thead>
                <tbody className="divide-y">
                  {details.map((d, idx) => (
                    <tr key={d.id}>
                      <td className="px-3 py-2">
                        <select className="input w-48 text-xs py-1" value={d.item_id} onChange={e => onItemSelect(idx, e.target.value)}>
                          <option value="">Select item</option>
                          {availableItems.map(i => <option key={i.id} value={i.id}>{i.item_name}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">{d.uom}</td>
                      <td className="px-3 py-2">
                        <input type="number" className="input w-20 text-xs py-1 text-right" value={d.required_qty}
                          onChange={e => updateLine(idx, "required_qty", Number(e.target.value))} />
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs">{d.qty_in_stock}</td>
                      <td className="px-3 py-2 text-right">
                        <input type="number" step="0.01" className="input w-24 text-xs py-1 text-right" value={d.cost_price}
                          onChange={e => updateLine(idx, "cost_price", Number(e.target.value))} />
                      </td>
                      <td className="px-3 py-2">
                        <button type="button" onClick={() => removeLine(idx)} className="p-1 text-rose-500 hover:text-rose-700"><Trash2 size={14} /></button>
                      </td>
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
              <div className="flex justify-between"><span className="text-slate-500">Items:</span><span className="font-bold">{details.filter(d => d.item_id).length}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Total Qty:</span><span className="font-bold">{details.reduce((s, d) => s + Number(d.required_qty || 0), 0)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Total Cost:</span><span className="font-bold">{details.reduce((s, d) => s + Number(d.cost_price || 0) * Number(d.required_qty || 0), 0).toFixed(2)}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
