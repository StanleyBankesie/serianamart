import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Loader2, Calendar, ChevronRight, ArrowLeft, Briefcase, User, Activity, DollarSign, TrendingUp, Clock, Trash2, LayoutDashboard } from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";

const StatusBadge = ({ status }) => {
  const configs = {
    'PLANNING': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    'IN_PROGRESS': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    'ON_HOLD': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    'COMPLETED': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    'CANCELLED': 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
  };
  return <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${configs[status] || 'bg-slate-100 text-slate-500'}`}>{status}</span>;
};

export default function ProjectList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchProjects = async () => {
    try {
      const res = await api.get("/projects/projects");
      setItems(res.data?.items || []);
    } catch { toast.error("Failed to load projects portfolio"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchProjects(); }, []);

  const handleDelete = async (id) => {
    if (!confirm("Delete this project and all its tasks? This cannot be undone.")) return;
    try {
      await api.delete(`/projects/projects/${id}`);
      toast.success("Project deleted");
      fetchProjects();
    } catch { toast.error("Failed to delete project"); }
  };

  const filteredItems = items.filter(p =>
    p.project_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.project_code.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const { sorted: sortedItems, sortKey, sortDir, toggle } = useSort(filteredItems, "created_at", "desc");
  const totalBudget = items.reduce((a, c) => a + Number(c.budget), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Link to="/project-management" className="btn btn-secondary p-2"><ArrowLeft size={20} /></Link>
          <div>
            <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">Project Portfolio</h1>
            <p className="text-slate-500 text-sm">Strategic execution and delivery management</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type="text" placeholder="Search projects..." className="input pl-10 pr-4 py-2 w-64" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <Link to="/project-management/projects/new" className="btn-success flex items-center gap-2"><Plus size={20} />+ New Project</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Active Projects', val: items.filter(p => p.project_status === 'IN_PROGRESS').length, icon: <Activity size={20} />, color: 'text-brand-600 bg-brand-50 dark:bg-brand-900/30' },
          { label: 'Total Portfolio', val: items.length, icon: <Briefcase size={20} />, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30' },
          { label: 'Pending Start', val: items.filter(p => p.project_status === 'PLANNING').length, icon: <Clock size={20} />, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30' },
          { label: 'Total Budget', val: `GHS ${totalBudget.toLocaleString()}`, icon: <DollarSign size={20} />, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30' },
        ].map((stat, i) => (
          <div key={i} className="card p-6 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${stat.color}`}>{stat.icon}</div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{stat.label}</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{stat.val}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-900/30">
                <SortableHeader label="Project Metadata" sortKey="project_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-6 py-4 text-xs font-semibold uppercase tracking-wider" />
                <SortableHeader label="Client & Manager" sortKey="client_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-6 py-4 text-xs font-semibold uppercase tracking-wider" />
                <SortableHeader label="Progress" sortKey="completion_percent" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-center" />
                <SortableHeader label="Budget" sortKey="budget" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-right" />
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Budget Health</th>
                <SortableHeader label="End Date" sortKey="end_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-6 py-4 text-xs font-semibold uppercase tracking-wider" />
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {loading ? (
                <tr><td colSpan="7" className="px-6 py-20 text-center animate-pulse text-slate-400 font-semibold tracking-wider">Loading Portfolio...</td></tr>
              ) : sortedItems.length > 0 ? sortedItems.map((item) => (
                <tr key={item.id} className="group hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-all duration-300">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center justify-center font-bold">
                        <span className="text-[10px] text-indigo-500 uppercase leading-none">{(item.project_code || 'PRJ').split('-')[0]}</span>
                        <span className="text-md text-slate-900 dark:text-white leading-none mt-1">{(item.project_code || '').split('-')[1] || '00'}</span>
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white text-md leading-tight">{item.project_name}</div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <StatusBadge status={item.project_status} />
                          {item.project_priority === 'HIGH' && <span className="bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider">Priority</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                        <User size={14} className="text-slate-400" /> {item.client_name || 'Internal'}
                      </div>
                      <div className="text-[10px] font-medium text-slate-400 uppercase">
                        Managed by <span className="text-indigo-500">{item.manager_name || 'N/A'}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="max-w-[120px] mx-auto space-y-1.5">
                      <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <span>{Number(item.completion_percent || 0).toFixed(0)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-600 rounded-full transition-all duration-1000" style={{ width: `${item.completion_percent || 0}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="font-bold text-sm text-slate-900 dark:text-white">GHS {Number(item.budget).toLocaleString()}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 min-w-[100px]">
                      <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${(item.expense_total || 0) >= item.budget * 0.9 ? 'bg-rose-500' : (item.expense_total || 0) >= item.budget * 0.7 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${item.budget > 0 ? Math.min((item.expense_total || 0) / item.budget * 100, 100) : 0}%` }} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 w-12 text-right">GHS {Number(item.expense_total || 0).toLocaleString()}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                      <Calendar size={12} className="text-slate-400" />{item.end_date ? new Date(item.end_date).toLocaleDateString() : <span className="text-slate-400">—</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link to={`/project-management/projects/${item.id}/dashboard`} className="p-2 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors" title="Dashboard"><LayoutDashboard size={16} /></Link>
                      <Link to={`/project-management/projects/${item.id}`} className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors inline-block"><ChevronRight size={20} /></Link>
                      <button onClick={() => handleDelete(item.id)} className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors" title="Delete"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="7" className="px-6 py-20 text-center text-slate-400 font-medium italic opacity-50">No projects found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
