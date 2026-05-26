import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Loader2, Plus, Trash2 } from "lucide-react";
import { api } from "api/client";
import { toast } from "react-toastify";

export default function PMMaterialReceiptForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === "new";

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [pendingIssues, setPendingIssues] = useState([]);

  const [form, setForm] = useState({
    receipt_no: "Auto-generated",
    receipt_date: new Date().toISOString().split("T")[0],
    issue_id: "",
    source_doc: "",
    warehouse_id: "",
    department_id: "",
    remarks: "",
    status: "DRAFT"
  });

  const [details, setDetails] = useState([
    { id: 1, item_id: "", item_name: "", uom: "PCS", transfer_qty: 0, receipt_qty: 0, batch_no: "", expiry_date: "", mfg_date: "" }
  ]);

  useEffect(() => {
    Promise.all([
      api.get("/inventory/warehouses").then(r => setWarehouses(r.data?.items || [])).catch(() => {}),
      api.get("/admin/departments").then(r => setDepartments(r.data?.items || [])).catch(() => {}),
    ]);
    if (isNew) {
      api.get("/projects/issue-to-requirement/pm").then(r => {
        setPendingIssues(Array.isArray(r.data?.items) ? r.data.items : []);
      }).catch(() => {});
    }
    if (!isNew && id) fetchReceipt();
  }, [id]);

  const fetchReceipt = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/projects/material-receipts/${id}`);
      const d = res.data?.item;
      if (d) {
        setForm({
          receipt_no: d.receipt_no || "",
          receipt_date: d.receipt_date ? d.receipt_date.split("T")[0] : "",
          issue_id: d.issue_id ? String(d.issue_id) : "",
          source_doc: d.source_doc || "",
          warehouse_id: d.warehouse_id ? String(d.warehouse_id) : "",
          department_id: d.department_id ? String(d.department_id) : "",
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
          transfer_qty: dd.transfer_qty || 0,
          receipt_qty: dd.receipt_qty || 0,
          batch_no: dd.batch_no || "",
          expiry_date: dd.expiry_date ? dd.expiry_date.split("T")[0] : "",
          mfg_date: dd.mfg_date ? dd.mfg_date.split("T")[0] : ""
        })));
      }
    } catch (e) { toast.error("Failed to load"); }
    finally { setLoading(false); }
  };

  const loadIssueDetails = async (issueId) => {
    if (!issueId) {
      setDetails([{ id: 1, item_id: "", item_name: "", uom: "PCS", transfer_qty: 0, receipt_qty: 0, batch_no: "", expiry_date: "", mfg_date: "" }]);
      return;
    }
    try {
      const res = await api.get(`/projects/issue-to-requirement/pm/${issueId}`);
      const src = res.data?.item;
      if (src) {
        setForm(prev => ({
          ...prev,
          issue_id: issueId,
          source_doc: src.issue_no || "",
          warehouse_id: src.warehouse_id ? String(src.warehouse_id) : prev.warehouse_id,
          department_id: src.department_id ? String(src.department_id) : prev.department_id
        }));
      }
      const dets = res.data?.details || [];
      if (dets.length) {
        setDetails(dets.map(dd => ({
          id: dd.id || Date.now() + Math.random(),
          item_id: dd.item_id ? String(dd.item_id) : "",
          item_name: dd.item_name || "",
          uom: dd.uom || "PCS",
          transfer_qty: Number(dd.qty_issued || 0),
          receipt_qty: Number(dd.qty_issued || 0),
          batch_no: dd.batch_number || "",
          expiry_date: "",
          mfg_date: ""
        })));
      }
    } catch (e) {
      toast.error("Failed to load issue details");
    }
  };

  const onIssueSelect = (issueId) => {
    setForm(prev => ({...prev, issue_id: issueId}));
    loadIssueDetails(issueId);
  };

  const addLine = () => {
    setDetails(prev => [...prev, { id: Date.now(), item_id: "", item_name: "", uom: "PCS", transfer_qty: 0, receipt_qty: 0, batch_no: "", expiry_date: "", mfg_date: "" }]);
  };

  const removeLine = (idx) => {
    if (details.length === 1) return;
    setDetails(prev => prev.filter((_, i) => i !== idx));
  };

  const updateLine = (idx, field, val) => {
    setDetails(prev => prev.map((d, i) => i === idx ? { ...d, [field]: val } : d));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, details: details.filter(d => d.item_id) };
      if (isNew) {
        await api.post("/projects/material-receipts", payload);
        toast.success("Receipt created");
      } else {
        await api.put(`/projects/material-receipts/${id}`, payload);
        toast.success("Receipt updated");
      }
      navigate("/project-management/material-receipts");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to save");
    } finally { setSaving(false); }
  };

  if (loading) return <div className="p-20 text-center animate-pulse font-bold text-slate-300 uppercase italic">Loading...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/project-management/material-receipts" className="btn btn-secondary p-2"><ArrowLeft size={20} /></Link>
          <div>
            <h1 className="text-2xl font-bold text-brand-900">{isNew ? "New Materials Receipt" : `Receipt ${form.receipt_no}`}</h1>
            <p className="text-slate-500 text-sm">Receive materials issued from Inventory</p>
          </div>
        </div>
        <button onClick={handleSubmit} disabled={saving} className="btn-success flex items-center gap-2">
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {isNew ? "Create Receipt" : "Update"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-8 space-y-6">
            <h2 className="font-bold uppercase text-xs tracking-wider text-brand-600 border-b pb-3">Receipt Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Receipt No</label>
                <input type="text" className="input w-full bg-slate-50" value={form.receipt_no} readOnly />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date</label>
                <input type="date" className="input w-full" value={form.receipt_date}
                  onChange={e => setForm({...form, receipt_date: e.target.value})} />
              </div>
              {isNew && (
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Source Issue Document</label>
                  <select className="input w-full" value={form.issue_id} onChange={e => onIssueSelect(e.target.value)}>
                    <option value="">Select issue to auto-populate...</option>
                    {pendingIssues.map(iss => (
                      <option key={iss.id} value={iss.id}>{iss.issue_no} - {iss.department_name || "PM Dept"}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Source Doc No</label>
                <input type="text" className="input w-full bg-slate-100" value={form.source_doc} readOnly />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Warehouse</label>
                <select className="input w-full" value={form.warehouse_id} onChange={e => setForm({...form, warehouse_id: e.target.value})}>
                  <option value="">Select warehouse</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.warehouse_name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Department / Location</label>
                <select className="input w-full" value={form.department_id} onChange={e => setForm({...form, department_id: e.target.value})}>
                  <option value="">Select department</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.dept_name}</option>)}
                </select>
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Remarks</label>
                <textarea className="input w-full min-h-[60px]" value={form.remarks} onChange={e => setForm({...form, remarks: e.target.value})} />
              </div>
            </div>
          </div>

          <div className="card p-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold uppercase text-xs tracking-wider text-brand-600">Items</h2>
              <button type="button" onClick={addLine} className="btn btn-sm flex items-center gap-1"><Plus size={14} /> Add Item</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead><tr className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2">Item Name</th>
                  <th className="px-3 py-2">UOM</th>
                  <th className="px-3 py-2 text-right">Transfer Qty</th>
                  <th className="px-3 py-2 text-right">Receipt Qty</th>
                  <th className="px-3 py-2">Batch No</th>
                  <th className="px-3 py-2">Expiry Date</th>
                  <th className="px-3 py-2">Mfg Date</th>
                  <th className="px-3 py-2"></th>
                </tr></thead>
                <tbody className="divide-y">
                  {details.map((d, idx) => (
                    <tr key={d.id}>
                      <td className="px-3 py-2">
                        <input type="text" className="input w-40 text-xs py-1 bg-slate-50"
                          value={d.item_name} readOnly placeholder="Auto-populated" />
                      </td>
                      <td className="px-3 py-2">{d.uom}</td>
                      <td className="px-3 py-2">
                        <input type="number" className="input w-20 text-xs py-1 text-right bg-slate-50"
                          value={d.transfer_qty} readOnly />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" className="input w-20 text-xs py-1 text-right" value={d.receipt_qty}
                          onChange={e => updateLine(idx, "receipt_qty", Number(e.target.value))} />
                      </td>
                      <td className="px-3 py-2">
                        <input type="text" className="input w-24 text-xs py-1" value={d.batch_no}
                          onChange={e => updateLine(idx, "batch_no", e.target.value)} />
                      </td>
                      <td className="px-3 py-2">
                        <input type="date" className="input w-28 text-xs py-1" value={d.expiry_date}
                          onChange={e => updateLine(idx, "expiry_date", e.target.value)} />
                      </td>
                      <td className="px-3 py-2">
                        <input type="date" className="input w-28 text-xs py-1" value={d.mfg_date}
                          onChange={e => updateLine(idx, "mfg_date", e.target.value)} />
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
              <div className="flex justify-between"><span className="text-slate-500">Transfer Qty:</span><span className="font-bold">{details.reduce((s, d) => s + Number(d.transfer_qty || 0), 0)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Receipt Qty:</span><span className="font-bold">{details.reduce((s, d) => s + Number(d.receipt_qty || 0), 0)}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
