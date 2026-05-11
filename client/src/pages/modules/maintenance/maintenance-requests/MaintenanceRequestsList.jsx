import React, { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, Search, Plus, ChevronRight } from "lucide-react";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";
import { Guard } from "../../../../hooks/usePermissions";

const STATUSES = ["DRAFT","OPEN","IN_PROGRESS","COMPLETED","CANCELLED"];
const PRIORITIES = ["LOW","NORMAL","HIGH","CRITICAL"];

function Badge({ value, colorMap }) {
  const v = String(value || "").toUpperCase();
  const cls = colorMap[v] || "bg-slate-100 text-slate-700";
  return <span className={`inline-block px-2 py-0.5 text-xs rounded font-medium ${cls}`}>{v}</span>;
}

const statusColors = { DRAFT:"bg-slate-100 text-slate-600", OPEN:"bg-blue-100 text-blue-700", IN_PROGRESS:"bg-amber-100 text-amber-700", COMPLETED:"bg-green-100 text-green-700", CANCELLED:"bg-red-100 text-red-600" };
const priorityColors = { LOW:"bg-slate-100 text-slate-600", NORMAL:"bg-blue-100 text-blue-700", HIGH:"bg-orange-100 text-orange-700", CRITICAL:"bg-red-100 text-red-700" };

export default function MaintenanceRequestsList() {
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function load() {
    try {
      setLoading(true);
      const res = await api.get("/maintenance/maintenance-requests");
      setItems(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load maintenance requests");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [location.state?.refresh]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return items;
    return items.filter(r =>
      String(r.request_no || "").toLowerCase().includes(q) ||
      String(r.requester_name || "").toLowerCase().includes(q) ||
      String(r.maintenance_type || "").toLowerCase().includes(q) ||
      String(r.status || "").toLowerCase().includes(q)
    );
  }, [items, search]);

  return (
    <Guard moduleKey="maintenance">
      <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Link to="/maintenance" className="btn btn-secondary p-2">
               <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">Maintenance Requests</h1>
              <p className="text-slate-500 text-sm">Track and manage service tickets and fault reports</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <div className="relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
               <input 
                 className="input pl-10 pr-4 py-2 w-64" 
                 placeholder="Search requests..." 
                 value={search} 
                 onChange={e => setSearch(e.target.value)} 
               />
             </div>
             <Link to="/maintenance/maintenance-requests/new" className="btn-success flex items-center gap-2">
                <Plus size={20} />
                + New Request
             </Link>
          </div>
        </div>

        <div className="card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Request Details</th>
                  <th>Requester</th>
                  <th>Department</th>
                  <th>Type</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {loading ? (
                   <tr><td colSpan="7" className="px-6 py-20 text-center animate-pulse text-slate-400 font-bold uppercase tracking-widest">Fetching Tickets...</td></tr>
                ) : filtered.length > 0 ? filtered.map(r => (
                  <tr key={r.id} className="group">
                    <td className="px-6 py-4">
                       <div className="font-bold text-slate-900 dark:text-white text-sm leading-tight">{r.request_no}</div>
                       <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">{r.request_date}</div>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200">{r.requester_name}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{r.department}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{r.maintenance_type}</td>
                    <td className="px-4 py-3 text-sm"><Badge value={r.priority} colorMap={priorityColors} /></td>
                    <td className="px-4 py-3 text-sm"><Badge value={r.status} colorMap={statusColors} /></td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link 
                          to={`/maintenance/maintenance-requests/${r.id}`} 
                          className="p-2 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-lg transition-colors"
                          title="Edit Request"
                        >
                          <ChevronRight size={20} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="7" className="px-6 py-20 text-center text-slate-400 font-bold uppercase tracking-widest italic opacity-50">No maintenance tickets found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Guard>
  );
}
