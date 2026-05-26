import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Save, Loader2, User, Layout, ChevronDown, DollarSign, Activity, Briefcase, Clock } from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function PMSetup() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [managerName, setManagerName] = useState("");
  const [defaultBudget, setDefaultBudget] = useState(0);
  const [users, setUsers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    Promise.all([fetchProjects(), fetchUsers(), fetchStats()]).finally(() => setLoading(false));
  }, []);

  const fetchProjects = async () => {
    try { const res = await api.get("/projects/projects"); setProjects(res.data?.items || []); } catch {}
  };
  const fetchUsers = async () => {
    try { const res = await api.get("/admin/users", { params: { active: 1 } }); setUsers((res?.data?.data?.items) || (res?.data?.items) || []); } catch {}
  };
  const fetchStats = async () => {
    try { const res = await api.get("/projects/dashboard/detail"); setStats(res.data); } catch {}
  };

  const handleProjectChange = (e) => {
    const pid = e.target.value; setSelectedProject(pid);
    const proj = projects.find(p => String(p.id) === pid);
    setManagerName(proj?.manager_name || ""); setDefaultBudget(proj?.budget || 0);
  };

  const handleSave = async () => {
    if (!selectedProject) { toast.error("Select a project"); return; }
    setSaving(true);
    try {
      await api.put(`/projects/projects/${selectedProject}`, { manager_name: managerName, budget: defaultBudget });
      toast.success("Project configuration updated");
      fetchProjects(); fetchStats();
    } catch { toast.error("Failed to update"); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="p-20 text-center animate-pulse font-bold text-slate-300 text-2xl uppercase italic">Loading Configuration...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center gap-4">
        <Link to="/project-management" className="btn btn-secondary p-2"><ArrowLeft size={20} /></Link>
        <div>
          <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">PM Configuration Hub</h1>
          <p className="text-slate-500 text-sm">Project settings, managers, and default budgets</p>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="card p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl text-brand-600 bg-brand-50 dark:bg-brand-900/30"><Briefcase size={20} /></div>
            <div><p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Projects</p><p className="text-lg font-bold text-slate-900 dark:text-white">{stats.projects?.total || 0}</p></div>
          </div>
          <div className="card p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl text-blue-600 bg-blue-50 dark:bg-blue-900/30"><Activity size={20} /></div>
            <div><p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active</p><p className="text-lg font-bold text-slate-900 dark:text-white">{stats.projects?.active || 0}</p></div>
          </div>
          <div className="card p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30"><DollarSign size={20} /></div>
            <div><p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Budget</p><p className="text-lg font-bold text-slate-900 dark:text-white">GHS {Number(stats.projects?.total_budget || 0).toLocaleString()}</p></div>
          </div>
          <div className="card p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl text-amber-600 bg-amber-50 dark:bg-amber-900/30"><Clock size={20} /></div>
            <div><p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Logged Hours</p><p className="text-lg font-bold text-slate-900 dark:text-white">{Number(stats.totalLoggedHours).toFixed(1)}h</p></div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="card p-8 space-y-6">
          <div className="flex items-center gap-3 text-brand-600 border-b border-slate-50 dark:border-slate-700 pb-3">
            <User size={18} /><h2 className="font-bold uppercase text-xs tracking-wider">Project Manager & Budget</h2>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Select Project</label>
            <div className="relative">
              <select className="input w-full pr-10 appearance-none" value={selectedProject} onChange={handleProjectChange}>
                <option value="">Choose project...</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.project_name} ({p.project_code})</option>)}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Project Manager</label>
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select className="input w-full pl-9 pr-4 appearance-none" value={managerName} onChange={e => setManagerName(e.target.value)}>
                <option value="">Select manager...</option>
                {users.map(u => <option key={u.id} value={u.username}>{u.username}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Budget (GHS)</label>
            <div className="relative">
              <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input type="number" className="input w-full pl-9" value={defaultBudget} onChange={e => setDefaultBudget(e.target.value)} />
            </div>
          </div>
          <button onClick={handleSave} disabled={saving} className="btn-success flex items-center gap-2">
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}Save Configuration
          </button>
        </div>

        <div className="card p-8 space-y-6">
          <div className="flex items-center gap-3 text-brand-600 border-b border-slate-50 dark:border-slate-700 pb-3">
            <Layout size={18} /><h2 className="font-bold uppercase text-xs tracking-wider">Quick Actions</h2>
          </div>
          <div className="space-y-2">
            <Link to="/project-management/projects/new" className="block px-4 py-3 bg-slate-50 dark:bg-slate-900 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors font-medium text-sm">+ Create New Project</Link>
            <Link to="/project-management/tasks/new" className="block px-4 py-3 bg-slate-50 dark:bg-slate-900 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors font-medium text-sm">+ Add New Task</Link>
            <Link to="/project-management/projects" className="block px-4 py-3 bg-slate-50 dark:bg-slate-900 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors font-medium text-sm">View All Projects</Link>
            <Link to="/project-management/tasks" className="block px-4 py-3 bg-slate-50 dark:bg-slate-900 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors font-medium text-sm">View Task Board</Link>
            <Link to="/project-management/reports/project-status" className="block px-4 py-3 bg-slate-50 dark:bg-slate-900 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors font-medium text-sm">Generate Status Report</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
