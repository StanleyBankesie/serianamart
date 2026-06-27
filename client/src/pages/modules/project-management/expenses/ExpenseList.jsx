import React, { useState, useEffect } from "react";
import { Plus, Loader2, DollarSign } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";

export default function ExpenseList() {
  const [items, setItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    project_id: "", expense_date: new Date().toISOString().split('T')[0],
    category: "OTHER", amount: "", currency: "GHS", description: "", status: "PENDING"
  });

  const fetchExpenses = async () => {
    try {
      const res = await api.get("/projects/expenses");
      setItems(res.data?.items || []);
    } catch { toast.error("Failed to load expenses"); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchExpenses();
    api.get("/projects/projects").then(r => setProjects(r.data?.items || [])).catch(() => {});
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ project_id: "", expense_date: new Date().toISOString().split('T')[0], category: "OTHER", amount: "", currency: "GHS", description: "", status: "PENDING" });
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({ project_id: item.project_id, expense_date: item.expense_date?.split('T')[0] || "", category: item.category, amount: item.amount, currency: item.currency || "GHS", description: item.description || "", status: item.status });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/projects/expenses/${editing.id}`, form);
        toast.success("Expense updated");
      } else {
        await api.post("/projects/expenses", form);
        toast.success("Expense recorded");
      }
      setShowModal(false);
      fetchExpenses();
    } catch { toast.error("Failed to save expense"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this expense?")) return;
    try {
      await api.delete(`/projects/expenses/${id}`);
      toast.success("Expense deleted");
      fetchExpenses();
    } catch { toast.error("Failed to delete"); }
  };

  const filtered = items.filter(i =>
    (i.project_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (i.category || "").toLowerCase().includes(searchTerm.toLowerCase())
  );
  const { sorted, sortKey, sortDir, toggle } = useSort(filtered, "expense_date", "desc");
  const totalExpenses = items.reduce((a, c) => a + Number(c.amount), 0);

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Project Expenses</h1>
              <p className="text-sm mt-1">Track and manage project-related costs</p>
            </div>
            <div className="flex gap-2">
              <Link to="/project-management" className="btn btn-secondary">Return to Menu</Link>
              <button onClick={openCreate} className="btn-success flex items-center gap-2"><Plus size={16} />Record Expense</button>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <input type="text" placeholder="Search expenses..." className="input" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg border">
              <DollarSign size={16} className="text-slate-400" />
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Total: GHS {totalExpenses.toLocaleString()}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <SortableHeader label="Project" sortKey="project_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Date" sortKey="expense_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Category" sortKey="category" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Description" sortKey="description" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Amount" sortKey="amount" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <SortableHeader label="Status" sortKey="status" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-center" />
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="7" className="text-center py-8 text-slate-400">Loading...</td></tr>
                ) : sorted.length > 0 ? sorted.map((item) => (
                  <tr key={item.id}>
                    <td className="font-medium">
                      <div className="font-bold text-sm">{item.project_name || "—"}</div>
                      <div className="text-[10px] text-slate-400">{item.created_by_name || ""}</div>
                    </td>
                    <td className="text-sm whitespace-nowrap">{item.expense_date ? new Date(item.expense_date).toLocaleDateString() : "—"}</td>
                    <td><span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-semibold uppercase">{item.category}</span></td>
                    <td className="text-sm text-slate-600 max-w-[200px] truncate">{item.description || "—"}</td>
                    <td className="text-right font-semibold">GHS {Number(item.amount).toLocaleString()}</td>
                    <td className="text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        item.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600' :
                        item.status === 'REJECTED' ? 'bg-rose-50 text-rose-600' :
                        'bg-amber-50 text-amber-600'
                      }`}>{item.status || 'PENDING'}</span>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(item)} className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200">Edit</button>
                        <button onClick={() => handleDelete(item.id)} className="px-3 py-1.5 text-xs font-medium text-white bg-red-700 rounded-lg hover:bg-red-800">Delete</button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="7" className="text-center py-8 text-slate-400">No expenses recorded.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="p-6 border-b border-slate-50 dark:border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{editing ? "Edit Expense" : "Record Expense"}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Project</label>
                <select required className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium text-sm" value={form.project_id} onChange={e => setForm({...form, project_id: e.target.value})}>
                  <option value="">Select Project...</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Date</label>
                  <input type="date" required className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm" value={form.expense_date} onChange={e => setForm({...form, expense_date: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Amount (GHS)</label>
                  <input type="number" step="0.01" required className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Category</label>
                <select className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium text-sm" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                  {['MATERIALS', 'LABOR', 'EQUIPMENT', 'TRAVEL', 'SUBCONTRACTOR', 'ADMIN', 'OTHER'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Description</label>
                <textarea className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm" rows="2" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
              </div>
              <button type="submit" disabled={saving} className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl transition-all font-bold text-sm uppercase tracking-wider shadow-sm">
                {saving ? <Loader2 size={18} className="animate-spin mx-auto" /> : editing ? "Update Expense" : "Confirm Expense"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
