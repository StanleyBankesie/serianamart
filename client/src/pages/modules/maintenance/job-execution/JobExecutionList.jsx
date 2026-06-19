import React, { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, Search, ChevronRight, Plus } from "lucide-react";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";

const statusColors = { DRAFT:"bg-slate-100 text-slate-600", IN_PROGRESS:"bg-amber-100 text-amber-700", COMPLETED:"bg-green-100 text-green-700", ON_HOLD:"bg-orange-100 text-orange-700" };
function Badge({ value, colorMap }) {
  const v = String(value || "").toUpperCase();
  return <span className={`inline-block px-2 py-0.5 text-xs rounded font-medium ${colorMap[v] || "bg-slate-100 text-slate-600"}`}>{v}</span>;
}

export default function JobExecutionList() {
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api.get("/maintenance/job-executions").then(r => { if (mounted) setItems(Array.isArray(r.data?.items) ? r.data.items : []); })
      .catch(e => toast.error(e?.response?.data?.message || "Failed to load"))
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [location.state?.refresh]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return items;
    return items.filter(r => String(r.execution_no || "").toLowerCase().includes(q) || String(r.order_no || "").toLowerCase().includes(q) || String(r.status || "").toLowerCase().includes(q));
  }, [items, search]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Link to="/maintenance" className="btn btn-secondary p-2">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">Job Executions</h1>
            <p className="text-slate-500 text-sm">Real-time maintenance work tracking and logs</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              className="input pl-10 pr-4 py-2 w-64" 
              placeholder="Search executions..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
          </div>
          <Link to="/maintenance/job-executions/new" className="btn-success flex items-center gap-2">
            <Plus size={20} />
            + New Execution
          </Link>
        </div>
      </div>

      <div className="card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Execution No</th>
                <th>Job Order</th>
                <th>Timeline</th>
                <th>Technicians</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {loading ? (
                <tr><td colSpan="6" className="px-6 py-20 text-center animate-pulse text-slate-400 font-bold uppercase tracking-widest">Loading Logs...</td></tr>
              ) : filtered.length > 0 ? filtered.map(r => (
                <tr key={r.id} className="group">
                  <td className="px-6 py-4 font-bold text-slate-900 dark:text-white text-sm">{r.execution_no}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-brand-700 dark:text-brand-300">{r.order_no}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    <div>{r.start_date}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{r.end_date}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">{r.technicians}</td>
                  <td className="px-4 py-3 text-sm"><Badge value={r.status} colorMap={statusColors} /></td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link 
                        to={`/maintenance/job-executions/${r.id}`} 
                        className="p-2 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-lg transition-colors"
                      >
                        <ChevronRight size={20} />
                      </Link>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="6" className="px-6 py-20 text-center text-slate-400 font-bold uppercase tracking-widest italic opacity-50">No execution records identified.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
