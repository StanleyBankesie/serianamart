import React, { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";
import { Guard } from "../../../../hooks/usePermissions";

const statusColors = { DRAFT:"bg-slate-100 text-slate-600", OPEN:"bg-blue-100 text-blue-700", IN_PROGRESS:"bg-amber-100 text-amber-700", COMPLETED:"bg-green-100 text-green-700", CANCELLED:"bg-red-100 text-red-600" };
function Badge({ value, colorMap }) {
  const v = String(value || "").toUpperCase();
  return <span className={`inline-block px-2 py-0.5 text-xs rounded font-medium ${colorMap[v] || "bg-slate-100 text-slate-600"}`}>{v}</span>;
}

export default function MaintenanceJobOrdersList() {
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function load() {
    try {
      setLoading(true);
      const res = await api.get("/maintenance/job-orders");
      setItems(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch (e) { toast.error(e?.response?.data?.message || "Failed to load job orders"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [location.state?.refresh]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return items;
    return items.filter(r =>
      String(r.order_no || "").toLowerCase().includes(q) ||
      String(r.asset_name || "").toLowerCase().includes(q) ||
      String(r.assigned_technician || "").toLowerCase().includes(q) ||
      String(r.status || "").toLowerCase().includes(q)
    );
  }, [items, search]);

  return (
    <Guard moduleKey="maintenance">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Job Orders</h1>
            <p className="text-sm text-slate-500">Track and manage maintenance job orders</p>
          </div>
          <div className="flex gap-2">
            <Link to="/maintenance" className="btn-secondary">Back to Menu</Link>
            <Link to="/maintenance/job-orders/new" className="btn-primary">+ New Job Order</Link>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <input className="input max-w-md" placeholder="Search by no, asset, technician, status..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-[#f8fafc] dark:bg-slate-900/50">
                <tr className="text-left bg-slate-50 dark:bg-slate-900/50">
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Order No</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Date</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Request Ref</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Asset</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Type</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Scheduled</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Technician</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {loading && <tr><td colSpan="9" className="px-4 py-8 text-center text-slate-500">Loading...</td></tr>}
                {!loading && !filtered.length && <tr><td colSpan="9" className="px-4 py-8 text-center text-slate-500">No job orders found</td></tr>}
                {!loading && filtered.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-sm">{r.order_no}</td>
                    <td className="px-4 py-3 text-sm">{r.order_date}</td>
                    <td className="px-4 py-3 text-sm">{r.request_id}</td>
                    <td className="px-4 py-3 text-sm">{r.asset_name}</td>
                    <td className="px-4 py-3 text-sm">{r.order_type}</td>
                    <td className="px-4 py-3 text-sm">{r.scheduled_date}</td>
                    <td className="px-4 py-3 text-sm">{r.assigned_technician}</td>
                    <td className="px-4 py-3 text-sm"><Badge value={r.status} colorMap={statusColors} /></td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap space-x-2">
                      <Link to={`/maintenance/job-orders/${r.id}`} className="text-brand hover:underline mr-3">Edit</Link>
                      <Link to={`/maintenance/job-executions/new?job_order_id=${r.id}&order_no=${r.order_no}`} className="text-emerald-600 hover:underline">Create Execution</Link>
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
