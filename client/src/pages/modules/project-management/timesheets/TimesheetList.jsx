import React, { useState, useEffect } from "react";
import { Plus, Search, Calendar, Clock, ArrowLeft, Timer, Loader2, Edit3, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";

export default function TimesheetList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);

  const [form, setForm] = useState({
    project_id: "", task_id: "", log_date: new Date().toISOString().split('T')[0], hours: "", description: ""
  });

  const fetchTimesheets = async () => {
    try {
      const res = await api.get("/projects/timesheets");
      setItems(res.data?.items || []);
    } catch { toast.error("Failed to load timesheet history"); }
    finally { setLoading(false); }
  };

  const fetchAuxiliary = async () => {
    try {
      const res = await api.get("/projects/projects");
      setProjects(res.data?.items || []);
    } catch {}
  };

  useEffect(() => { fetchTimesheets(); fetchAuxiliary(); }, []);

  useEffect(() => {
    if (form.project_id) {
      api.get(`/projects/tasks?projectId=${form.project_id}`).then(res => setTasks(res.data?.items || [])).catch(() => {});
    } else setTasks([]);
  }, [form.project_id]);

  const openCreate = () => {
    setEditing(null);
    setForm({ project_id: "", task_id: "", log_date: new Date().toISOString().split('T')[0], hours: "", description: "" });
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({ project_id: item.project_id, task_id: item.task_id, log_date: item.log_date?.split('T')[0] || "", hours: item.hours, description: item.description || "" });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/projects/timesheets/${editing.id}`, form);
        toast.success("Timesheet updated");
      } else {
        await api.post("/projects/timesheets", form);
        toast.success("Hours logged successfully");
      }
      setShowModal(false);
      fetchTimesheets();
    } catch { toast.error("Failed to save timesheet"); }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this timesheet entry?")) return;
    try {
      await api.delete(`/projects/timesheets/${id}`);
      toast.success("Timesheet deleted");
      fetchTimesheets();
    } catch { toast.error("Failed to delete"); }
  };

  const filtered = items.filter(i =>
    (i.task_title || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (i.project_name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );
  const { sorted, sortKey, sortDir, toggle } = useSort(filtered, "log_date", "desc");
  const totalHours = items.reduce((a, c) => a + Number(c.hours), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Link to="/project-management" className="btn btn-secondary p-2"><ArrowLeft size={20} /></Link>
          <div>
            <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">Time Journal</h1>
            <p className="text-slate-500 text-sm">Personal workload and productivity tracking</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Logged</p>
            <p className="text-lg font-bold text-brand-600 mt-1">{totalHours.toFixed(1)}h</p>
          </div>
          <button onClick={openCreate} className="btn-success flex items-center gap-2"><Plus size={20} />+ Log Hours</button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type="text" placeholder="Filter records..." className="input pl-10 pr-4 py-2 w-full" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-900/30">
                <SortableHeader label="Work Reference" sortKey="task_title" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-6 py-4 text-xs font-semibold uppercase tracking-wider" />
                <SortableHeader label="Description" sortKey="description" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-6 py-4 text-xs font-semibold uppercase tracking-wider" />
                <SortableHeader label="Hours" sortKey="hours" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-center" />
                <SortableHeader label="Log Date" sortKey="log_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-6 py-4 text-xs font-semibold uppercase tracking-wider" />
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {loading ? (
                <tr><td colSpan="5" className="px-6 py-20 text-center animate-pulse text-slate-400 font-semibold tracking-wider">Loading Records...</td></tr>
              ) : sorted.length > 0 ? sorted.map((item) => (
                <tr key={item.id} className="group hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-all duration-300">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-slate-900 flex items-center justify-center text-indigo-600 border border-indigo-100 dark:border-slate-700">
                        <Timer size={18} />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white text-sm leading-tight">{item.task_title}</div>
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-tighter mt-1">{item.project_name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs truncate">{item.description || '—'}</p>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-block px-2.5 py-1 bg-slate-100 dark:bg-slate-900 rounded-lg font-bold text-slate-900 dark:text-white text-xs">{Number(item.hours).toFixed(1)}h</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                      <Calendar size={12} className="text-slate-400" />{new Date(item.log_date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(item)} className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors" title="Edit"><Edit3 size={16} /></button>
                      <button onClick={() => handleDelete(item.id)} className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors" title="Delete"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="5" className="px-6 py-20 text-center text-slate-400 font-medium italic opacity-50">No work hours recorded.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="p-6 border-b border-slate-50 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand-600 rounded-lg text-white"><Clock size={18} /></div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{editing ? "Edit Hours" : "Log Work Hours"}</h2>
              </div>
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
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Task</label>
                <select required className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium text-sm" value={form.task_id} onChange={e => setForm({...form, task_id: e.target.value})}>
                  <option value="">Select Task...</option>
                  {tasks.map(t => <option key={t.id} value={t.id}>{t.task_title}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Date</label>
                  <input type="date" required className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm" value={form.log_date} onChange={e => setForm({...form, log_date: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Hours</label>
                  <input type="number" step="0.1" required className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm" placeholder="0.0" value={form.hours} onChange={e => setForm({...form, hours: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Description</label>
                <textarea className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm" rows="2" placeholder="Work details..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
              </div>
              <button type="submit" className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl transition-all font-bold text-sm uppercase tracking-wider shadow-sm">
                {editing ? "Update Entry" : "Confirm Entry"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
