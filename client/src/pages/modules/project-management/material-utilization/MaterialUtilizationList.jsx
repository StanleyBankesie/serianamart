import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Search, ChevronRight } from "lucide-react";
import { api } from "api/client";
import { filterAndSort } from "@/utils/searchUtils.js";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";

export default function PMMaterialUtilizationList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api.get("/projects/material-utilizations")
      .then(res => { if (mounted) setItems(Array.isArray(res.data?.items) ? res.data.items : []); })
      .catch(e => setError(e?.response?.data?.message || "Failed to load"))
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return items.slice();
    return filterAndSort(items, { query: searchTerm, getKeys: (r) => [r.utilization_no, r.project_name, r.task_summary, r.location] });
  }, [items, searchTerm]);

  const { sorted, sortKey, sortDir, toggle } = useSort(filtered, "created_at", "desc");

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/project-management" className="btn btn-secondary p-2"><ArrowLeft size={20} /></Link>
          <div>
            <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">Material Utilization</h1>
            <p className="text-slate-500 text-sm">Track material consumption against projects and tasks</p>
          </div>
        </div>
        <Link to="/project-management/material-utilizations/new" className="btn-success flex items-center gap-2">
          <Plus size={20} /> + New Utilization
        </Link>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type="text" placeholder="Search utilization..." className="input pl-10 pr-4 py-2 w-full" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-900/30">
                <SortableHeader label="Utilization No" sortKey="utilization_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-6 py-4 text-xs font-semibold uppercase tracking-wider" />
                <SortableHeader label="Date" sortKey="utilization_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-6 py-4 text-xs font-semibold uppercase tracking-wider" />
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Project</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Location</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Task Summary</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {loading ? (
                <tr><td colSpan="6" className="px-6 py-20 text-center animate-pulse text-slate-400 dark:text-slate-500 font-semibold">Loading...</td></tr>
              ) : sorted.length > 0 ? sorted.map(r => (
                <tr key={r.id} className="group hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-all duration-300">
                  <td className="px-6 py-4 font-medium text-sm text-slate-900 dark:text-white">{r.utilization_no}</td>
                  <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">{r.utilization_date ? new Date(r.utilization_date).toLocaleDateString() : "—"}</td>
                  <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">{r.project_name || "—"}</td>
                  <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">{r.location || "—"}</td>
                  <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300 max-w-[200px] truncate">{r.task_summary || "—"}</td>
                  <td className="px-6 py-4 text-right">
                    <Link to={`/project-management/material-utilizations/${r.id}`}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition-colors inline-block">
                      <ChevronRight size={18} />
                    </Link>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="6" className="px-6 py-20 text-center text-slate-400 dark:text-slate-500 italic">No utilization records found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
