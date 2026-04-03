import React, { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";

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
    <div className="p-6 space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center">
            <div className="font-semibold">Job Orders</div>
            <div className="flex gap-2">
              <Link to="/maintenance" className="btn btn-secondary">Return to Menu</Link>
              <Link to="/maintenance/job-orders/new" className="btn-success">+ New Job Order</Link>
            </div>
          </div>
        </div>
        <div className="card-body">
          <div className="mb-4">
            <input className="input max-w-md" placeholder="Search by no, asset, technician, status..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>Order No</th><th>Date</th><th>Request Ref</th><th>Asset</th><th>Type</th><th>Scheduled</th><th>Technician</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan="9" className="text-center py-8 text-slate-500">Loading...</td></tr>}
                {!loading && !filtered.length && <tr><td colSpan="9" className="text-center py-8 text-slate-500">No job orders found</td></tr>}
                {!loading && filtered.map(r => (
                  <tr key={r.id}>
                    <td className="font-mono text-sm">{r.order_no}</td>
                    <td>{r.order_date}</td>
                    <td>{r.request_id}</td>
                    <td>{r.asset_name}</td>
                    <td>{r.order_type}</td>
                    <td>{r.scheduled_date}</td>
                    <td>{r.assigned_technician}</td>
                    <td><Badge value={r.status} colorMap={statusColors} /></td>
                    <td className="whitespace-nowrap space-x-2">
                      <Link to={`/maintenance/job-orders/${r.id}`} className="btn-secondary btn-sm">Edit</Link>
                      <Link to={`/maintenance/job-executions/new?job_order_id=${r.id}&order_no=${r.order_no}`} className="btn-primary btn-sm">Create Execution</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
