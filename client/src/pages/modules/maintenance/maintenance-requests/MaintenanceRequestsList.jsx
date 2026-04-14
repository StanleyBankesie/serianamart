import React, { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
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
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Maintenance Requests</h1>
            <p className="text-sm text-slate-500">Track and manage maintenance requests</p>
          </div>
          <div className="flex gap-2">
            <Link to="/maintenance" className="btn-secondary">Back to Menu</Link>
            <Link to="/maintenance/maintenance-requests/new" className="btn-primary">+ New Request</Link>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <input className="input max-w-md" placeholder="Search by no, requester, type, status..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-[#f8fafc] dark:bg-slate-900/50">
                <tr className="text-left bg-slate-50 dark:bg-slate-900/50">
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Request No</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Date</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Requester</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Department</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Type</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Priority</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {loading && <tr><td colSpan="8" className="px-4 py-8 text-center text-slate-500">Loading...</td></tr>}
                {!loading && !filtered.length && <tr><td colSpan="8" className="px-4 py-8 text-center text-slate-500">No maintenance requests found</td></tr>}
                {!loading && filtered.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-sm">{r.request_no}</td>
                    <td className="px-4 py-3 text-sm">{r.request_date}</td>
                    <td className="px-4 py-3 text-sm">{r.requester_name}</td>
                    <td className="px-4 py-3 text-sm">{r.department}</td>
                    <td className="px-4 py-3 text-sm">{r.maintenance_type}</td>
                    <td className="px-4 py-3 text-sm"><Badge value={r.priority} colorMap={priorityColors} /></td>
                    <td className="px-4 py-3 text-sm"><Badge value={r.status} colorMap={statusColors} /></td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap space-x-2">
                      <Link to={`/maintenance/maintenance-requests/${r.id}`} className="text-brand hover:underline mr-3">Edit</Link>
                      <Link to={`/maintenance/job-orders/new?request_id=${r.id}&request_no=${r.request_no}&asset_name=${encodeURIComponent(r.asset_name||"")}`} className="text-emerald-600 hover:underline mr-3">Create Job Order</Link>
                      <Link to={`/maintenance/rfq/new?request_id=${r.id}&request_no=${r.request_no}`} className="text-indigo-600 hover:underline">Create RFQ</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Guard>
  );
}
