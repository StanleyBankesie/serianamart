import React, { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Search, Loader2, Calendar, CheckCircle2, ArrowLeft, ChevronRight, User, Layout, Timer, Paperclip, Percent, Clock, AlertTriangle, Trash2, Link2 } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import DocumentAttachmentsModal from "@/components/attachments/DocumentAttachmentsModal.jsx";

const StatusBadge = ({ status }) => {
  const styles = {
    PENDING: "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800/50",
    IN_PROGRESS: "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800/50",
    COMPLETED: "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/50",
    BLOCKED: "bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800/50",
  };
  return <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${styles[status] || styles.PENDING} uppercase tracking-wider`}>{status?.replace('_', ' ')}</span>;
};

const PriorityBadge = ({ priority }) => {
  const colors = { CRITICAL: "text-rose-600 dark:text-rose-400", HIGH: "text-orange-600 dark:text-orange-400", MEDIUM: "text-blue-600 dark:text-blue-400", LOW: "text-slate-400 dark:text-slate-500" };
  return <div className="flex items-center gap-1.5"><div className={`w-1.5 h-1.5 rounded-full bg-current ${colors[priority] || colors.LOW}`} /><span className={`text-[10px] font-bold uppercase tracking-tight ${colors[priority] || colors.LOW}`}>{priority}</span></div>;
};

const CompletionSlider = ({ value, taskId, onUpdate }) => {
  const [localVal, setLocalVal] = useState(value);
  const [saving, setSaving] = useState(false);
  const timerRef = useRef(null);
  useEffect(() => { setLocalVal(value); }, [value]);
  const handleChange = (e) => {
    const v = Number(e.target.value); setLocalVal(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setSaving(true);
      try { await api.put(`/projects/tasks/${taskId}`, { completion_percent: v }); if (onUpdate) onUpdate(taskId, v); }
      catch { toast.error("Failed to update completion %"); }
      finally { setSaving(false); }
    }, 400);
  };
  const getColor = () => { if (localVal >= 100) return "bg-emerald-500"; if (localVal >= 50) return "bg-blue-500"; if (localVal >= 25) return "bg-amber-500"; return "bg-slate-400"; };
  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <div className="relative flex-1 h-2 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
        <div className={`absolute left-0 top-0 h-full rounded-full transition-all duration-300 ${getColor()}`} style={{ width: `${localVal}%` }} />
        <input type="range" min="0" max="100" step="1" value={localVal} onChange={handleChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
      </div>
      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 w-9 text-right tabular-nums">{localVal}%</span>
      {saving && <Loader2 size={12} className="animate-spin text-slate-400" />}
    </div>
  );
};

export default function TaskList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAttach, setShowAttach] = useState(false);
  const [activeDocId, setActiveDocId] = useState(null);
  const [expandedDesc, setExpandedDesc] = useState({});
  const [expandedDelay, setExpandedDelay] = useState({});

  const fetchTasks = async () => {
    try {
      const [tasksRes, depsRes] = await Promise.all([
        api.get("/projects/tasks"),
        api.get("/projects/task-dependencies")
      ]);
      const tasks = tasksRes.data?.items || [];
      const deps = depsRes.data?.items || [];
      const depMap = {};
      deps.forEach(d => {
        if (!depMap[d.task_id]) depMap[d.task_id] = [];
        depMap[d.task_id].push(d.predecessor_title);
      });
      setItems(tasks.map(t => ({ ...t, dependencies: depMap[t.id] || [] })));
    } catch { toast.error("Failed to load workboard"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTasks(); }, []);

  const handleDelete = async (id) => {
    if (!confirm("Delete this task? This cannot be undone.")) return;
    try {
      await api.delete(`/projects/tasks/${id}`);
      toast.success("Task deleted");
      fetchTasks();
    } catch { toast.error("Failed to delete task"); }
  };

  const filteredItems = items.filter(i =>
    i.task_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (i.project_name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );
  const { sorted: sortedItems, sortKey, sortDir, toggle } = useSort(filteredItems, "created_at", "desc");
  const handleCompletionUpdate = useCallback((taskId, val) => {
    setItems(prev => prev.map(i => i.id === taskId ? { ...i, completion_percent: val } : i));
  }, []);
  const toggleDesc = (id) => setExpandedDesc(p => ({ ...p, [id]: !p[id] }));
  const toggleDelay = (id) => setExpandedDelay(p => ({ ...p, [id]: !p[id] }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Link to="/project-management" className="btn btn-secondary p-2"><ArrowLeft size={20} /></Link>
          <div>
            <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">Task Board</h1>
            <p className="text-slate-500 text-sm">WBS execution and progress monitoring</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type="text" placeholder="Filter tasks..." className="input pl-10 pr-4 py-2 w-64" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <Link to="/project-management/tasks/new" className="btn-success flex items-center gap-2"><Plus size={20} />+ Add Task</Link>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-900/30">
                <SortableHeader label="Task" sortKey="task_title" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-6 py-4 text-xs font-semibold uppercase tracking-wider" />
                <SortableHeader label="Start Date" sortKey="start_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-6 py-4 text-xs font-semibold uppercase tracking-wider" />
                <SortableHeader label="Due Date" sortKey="due_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-6 py-4 text-xs font-semibold uppercase tracking-wider" />
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Assignee</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Dependencies</th>
                <SortableHeader label="Completion" sortKey="completion_percent" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-6 py-4 text-xs font-semibold uppercase tracking-wider" />
                <SortableHeader label="Hours" sortKey="estimated_hours" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-center" />
                <SortableHeader label="Status" sortKey="status" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-6 py-4 text-xs font-semibold uppercase tracking-wider" />
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Docs</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {loading ? (
                <tr><td colSpan="10" className="px-6 py-20 text-center animate-pulse text-slate-400 font-semibold tracking-wider">Loading Workboard...</td></tr>
              ) : sortedItems.length > 0 ? sortedItems.map((item) => (
                <tr key={item.id} className="group hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-all duration-300">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
                        <CheckCircle2 size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 dark:text-white text-sm leading-tight truncate max-w-[200px]">{item.task_title}</div>
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight mt-1 flex items-center gap-1"><Layout size={10} /> {item.project_name || "—"}</div>
                        <div className="mt-1"><PriorityBadge priority={item.priority} /></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                      <Calendar size={12} className="text-slate-400 shrink-0" />{item.start_date ? new Date(item.start_date).toLocaleDateString() : <span className="text-slate-400">—</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                      <Calendar size={12} className="text-slate-400 shrink-0" />{item.due_date ? new Date(item.due_date).toLocaleDateString() : <span className="text-slate-400">—</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {item.assigned_to_name ? (
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                        <User size={12} className="text-slate-400 shrink-0" />{item.assigned_to_name}
                      </div>
                    ) : <span className="text-xs text-slate-400 italic">—</span>}
                  </td>
                  <td className="px-6 py-4">
                    {item.dependencies && item.dependencies.length > 0 ? (
                      <div className="flex flex-col gap-0.5">
                        {item.dependencies.map((dep, idx) => (
                          <span key={idx} className="flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                            <Link2 size={10} />{dep}
                          </span>
                        ))}
                      </div>
                    ) : <span className="text-xs text-slate-400 italic">—</span>}
                  </td>
                  <td className="px-6 py-4">
                    <CompletionSlider value={item.completion_percent || 0} taskId={item.id} onUpdate={handleCompletionUpdate} />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded-md">{item.actual_hours || 0} / {item.estimated_hours || 0}h</span>
                      <div className="w-16 h-1 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${Math.min((item.actual_hours / (item.estimated_hours || 1)) * 100, 100)}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4"><StatusBadge status={item.status} /></td>
                  <td className="px-6 py-4 text-center">
                    <button type="button" onClick={() => { setActiveDocId(item.id); setShowAttach(true); }} className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors inline-flex" title="Attachments"><Paperclip size={16} /></button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link to={`/project-management/tasks/${item.id}`} className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors inline-block"><ChevronRight size={20} /></Link>
                      <button onClick={() => handleDelete(item.id)} className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors" title="Delete"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="10" className="px-6 py-20 text-center text-slate-400 font-medium italic opacity-50">No tasks found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DocumentAttachmentsModal open={showAttach} onClose={() => { setShowAttach(false); setActiveDocId(null); }} docType="task" docId={activeDocId} />
    </div>
  );
}
