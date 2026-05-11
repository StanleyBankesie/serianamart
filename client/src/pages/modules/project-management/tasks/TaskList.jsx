import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Search, 
  Loader2, 
  Calendar, 
  CheckCircle2, 
  ArrowLeft,
  ChevronRight,
  User,
  Briefcase,
  Timer,
  Layout,
  Filter
} from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

const StatusBadge = ({ status }) => {
  const styles = {
    PENDING: "bg-amber-50 text-amber-600 border-amber-100",
    IN_PROGRESS: "bg-blue-50 text-blue-600 border-blue-100",
    COMPLETED: "bg-emerald-50 text-emerald-600 border-emerald-100",
    BLOCKED: "bg-rose-50 text-rose-600 border-rose-100",
  };
  return (
    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${styles[status] || styles.PENDING} uppercase tracking-wider`}>
      {status?.replace('_', ' ')}
    </span>
  );
};

const PriorityBadge = ({ priority }) => {
  const styles = {
    CRITICAL: "text-rose-600",
    HIGH: "text-orange-600",
    MEDIUM: "text-blue-600",
    LOW: "text-slate-400",
  };
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-1.5 h-1.5 rounded-full bg-current ${styles[priority] || styles.LOW}`} />
      <span className={`text-[10px] font-bold uppercase tracking-tight ${styles[priority] || styles.LOW}`}>{priority}</span>
    </div>
  );
};

export default function TaskList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchTasks = async () => {
    try {
      const res = await api.get("/projects/tasks");
      setItems(res.data?.items || []);
    } catch (e) {
      toast.error("Failed to load workboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const filteredItems = items.filter(i => 
    i.task_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.project_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Link to="/project-management" className="btn btn-secondary p-2">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">Task Board</h1>
            <p className="text-slate-500 text-sm">WBS execution and progress monitoring</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Filter tasks..." 
              className="input pl-10 pr-4 py-2 w-64"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <Link 
            to="/project-management/tasks/new"
            className="btn-success flex items-center gap-2"
          >
            <Plus size={20} />
            + Add Task
          </Link>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-900/30">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Task Information</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Timeline</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Resources</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {loading ? (
                <tr><td colSpan="5" className="px-6 py-20 text-center animate-pulse text-slate-400 font-semibold tracking-wider">Loading Workboard...</td></tr>
              ) : filteredItems.length > 0 ? filteredItems.map((item) => (
                <tr key={item.id} className="group hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-all duration-300">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 flex items-center justify-center text-indigo-600 shadow-sm">
                        <CheckCircle2 size={18} />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white text-sm leading-tight">{item.task_title}</div>
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight mt-1 flex items-center gap-1">
                           <Layout size={10} /> {item.project_name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                       <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                          <Calendar size={12} className="text-slate-400" />
                          {new Date(item.due_date).toLocaleDateString()}
                       </div>
                       <PriorityBadge priority={item.priority} />
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col items-center gap-1">
                       <span className="text-[10px] font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded-md">
                          {item.actual_hours || 0} / {item.estimated_hours}h
                       </span>
                       <div className="w-16 h-1 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${Math.min((item.actual_hours/item.estimated_hours)*100, 100)}%` }} />
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link 
                      to={`/project-management/tasks/${item.id}`}
                      className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors inline-block"
                    >
                      <ChevronRight size={20} />
                    </Link>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5" className="px-6 py-20 text-center text-slate-400 font-medium italic opacity-50">
                    No tasks found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
