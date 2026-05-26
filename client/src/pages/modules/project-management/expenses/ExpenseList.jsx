import React, { useState, useEffect } from "react";
import { Plus, Search, ArrowLeft, DollarSign, Calendar, Loader2, Trash2, Edit3 } from "lucide-react";
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
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Link to="/project-management" className="btn btn-secondary p-2"><ArrowLeft size={20} /></Link>
          <div>
            <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">Project Expenses</h1>
            <p className="text-slate-500 text-sm">Track and manage project-related costs</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Expenses</p>
            <p className="text-lg font-bold text-brand-600 mt-1">GHS {totalExpenses.toLocaleString()}</p>
          </div>
          <button onClick={openCreate} className="btn-success flex items-center gap-2"><Plus size={20} />+ Record Expense</button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type="text" placeholder="Search expenses..." className="input pl-10 pr-4 py-2 w-full" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-900/30">
                <SortableHeader label="Project" sortKey="project_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-6 py-4 text-xs font-semibold uppercase tracking-wider" />
                <SortableHeader label="Date" sortKey="expense_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-6 py-4 text-xs font-semibold uppercase tracking-wider" />
                <SortableHeader label="Category" sortKey="category" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-6 py-4 text-xs font-semibold uppercase tracking-wider" />
                <SortableHeader label="Description" sortKey="description" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-6 py-4 text-xs font-semibold uppercase tracking-wider" />
                <SortableHeader label="Amount" sortKey="amount" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-right" />
                <SortableHeader label="Status" sortKey="status" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-center" />
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {loading ? (
                <tr><td colSpan="7" className="px-6 py-20 text-center animate-pulse text-slate-400 font-semibold tracking-wider">Loading Expenses...</td></tr>
              ) : sorted.length > 0 ? sorted.map((item) => (
                <tr key={item.id} className="group hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-all duration-300">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-slate-900 flex items-center justify-center text-emerald-600 border border-emerald-100 dark:border-slate-700">
                        <DollarSign size={18} />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white text-sm">{item.project_name || "—"}</div>
                        <div className="text-[10px] font-semibold text-slate-400">{item.created_by_name || ""}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                      <Calendar size={12} className="text-slate-400" />{item.expense_date ? new Date(item.expense_date).toLocaleDateString() : "—"}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-900 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">{item.category}</span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[200px] truncate">{item.description || "—"}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">GHS {Number(item.amount).toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${
                      item.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                      item.status === 'REJECTED' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                      'bg-amber-50 text-amber-600 border-amber-100'
                    }`}>{item.status || 'PENDING'}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(item)} className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors" title="Edit"><Edit3 size={16} /></button>
                      <button onClick={() => handleDelete(item.id)} className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors" title="Delete"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="7" className="px-6 py-20 text-center text-slate-400 font-medium italic opacity-50">No expenses recorded.</td></tr>
              )}
            </tbody>
          </table>
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
