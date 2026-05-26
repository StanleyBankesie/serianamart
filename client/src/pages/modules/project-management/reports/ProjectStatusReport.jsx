import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Download, RefreshCw } from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

const statusStyles = {
  PLANNING: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  IN_PROGRESS: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  ON_HOLD: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  COMPLETED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  CANCELLED: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
};

export default function ProjectStatusReport() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await api.get("/projects/reports/project-status");
      setItems(res.data?.items || []);
    } catch (e) {
      toast.error("Failed to load report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport(); }, []);

  const overallCompletion = items.length
    ? (items.reduce((s, p) => s + Number(p.completion_percent || 0), 0) / items.length).toFixed(1)
    : 0;

  const totalBudget = items.reduce((s, p) => s + Number(p.budget || 0), 0);
  const totalHours = items.reduce((s, p) => s + Number(p.total_estimated_hours || 0), 0);
  const totalActualHours = items.reduce((s, p) => s + Number(p.total_actual_hours || 0), 0);

  const exportCsv = () => {
    const headers = ["Project Code", "Project Name", "Status", "Completion %", "Manager", "Client", "Budget", "Total Tasks", "Completed", "In Progress", "Blocked", "Pending", "Est. Hours", "Actual Hours"];
    const rows = items.map(p => [
      p.project_code, p.project_name, p.project_status, p.completion_percent,
      p.manager_name, p.client_name, p.budget, p.total_tasks, p.completed_tasks,
      p.in_progress_tasks, p.blocked_tasks, p.pending_tasks,
      p.total_estimated_hours, p.total_actual_hours
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `project-status-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/project-management" className="btn btn-secondary p-2"><ArrowLeft size={20} /></Link>
          <div>
            <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">Project Status Report</h1>
            <p className="text-slate-500 text-sm">Overview of all projects with completion metrics and task breakdown</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchReport} className="btn btn-secondary p-2"><RefreshCw size={18} /></button>
          <button onClick={exportCsv} className="btn-success flex items-center gap-2"><Download size={18} /> Export CSV</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 text-center"><div className="text-2xl font-bold text-brand-600 dark:text-brand-400">{items.length}</div><div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mt-1">Total Projects</div></div>
        <div className="card p-4 text-center"><div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{overallCompletion}%</div><div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mt-1">Avg Completion</div></div>
        <div className="card p-4 text-center"><div className="text-lg font-bold text-slate-700 dark:text-slate-300">{Number(totalBudget).toLocaleString()}</div><div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mt-1">Total Budget</div></div>
        <div className="card p-4 text-center">
          <div className="text-lg font-bold text-slate-700 dark:text-slate-300">{Number(totalActualHours).toFixed(1)}h / {Number(totalHours).toFixed(1)}h</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mt-1">Hours (Actual/Est.)</div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-900/30">
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Project</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center">Progress</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center">Tasks</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center">Completed</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center">Blocked</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Est. Hours</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Actual Hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {loading ? (
                <tr><td colSpan="8" className="px-6 py-20 text-center animate-pulse text-slate-400 dark:text-slate-500 font-semibold">Loading...</td></tr>
              ) : items.length > 0 ? items.map(p => {
                const pct = Number(p.completion_percent || 0);
                const color = pct >= 100 ? "bg-emerald-500" : pct >= 50 ? "bg-blue-500" : pct >= 25 ? "bg-amber-500" : "bg-slate-400";
                return (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-all duration-300">
                    <td className="px-6 py-4">
                      <div className="font-bold text-sm text-slate-900 dark:text-white">{p.project_name}</div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase">{p.project_code} {p.manager_name ? `· ${p.manager_name}` : ""}</div>
                    </td>
                    <td className="px-6 py-4"><span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${statusStyles[p.project_status] || statusStyles.PLANNING}`}>{p.project_status}</span></td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-16 h-2 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-slate-900 dark:text-white">{p.total_tasks || 0}</td>
                    <td className="px-6 py-4 text-center"><span className="text-emerald-600 dark:text-emerald-400 font-bold">{p.completed_tasks || 0}</span></td>
                    <td className="px-6 py-4 text-center"><span className="text-rose-600 dark:text-rose-400 font-bold">{p.blocked_tasks || 0}</span></td>
                    <td className="px-6 py-4 text-right font-mono text-sm text-slate-700 dark:text-slate-300">{Number(p.total_estimated_hours || 0).toFixed(1)}h</td>
                    <td className="px-6 py-4 text-right font-mono text-sm text-slate-700 dark:text-slate-300">{Number(p.total_actual_hours || 0).toFixed(1)}h</td>
                  </tr>
                );
              }) : (
                <tr><td colSpan="8" className="px-6 py-20 text-center text-slate-400 dark:text-slate-500 italic">No projects found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
