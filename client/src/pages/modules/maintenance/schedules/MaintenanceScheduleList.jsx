import React, { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";

export default function MaintenanceScheduleList() {
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let m = true;
    setLoading(true);
    api.get("/maintenance/schedules").then(r => { if (m) setItems(Array.isArray(r.data?.items) ? r.data.items : []); })
      .catch(e => toast.error(e?.response?.data?.message || "Failed to load"))
      .finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, [location.state?.refresh]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return items;
    return items.filter(r => String(r.schedule_name || "").toLowerCase().includes(q) || String(r.asset_name || "").toLowerCase().includes(q) || String(r.frequency || "").toLowerCase().includes(q));
  }, [items, search]);

  return (
    <div className="p-6 space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center">
            <div className="font-semibold">Maintenance Schedules</div>
            <div className="flex gap-2">
              <Link to="/maintenance" className="btn btn-secondary">Return to Menu</Link>
              <Link to="/maintenance/schedules/new" className="btn-success">+ New Schedule</Link>
            </div>
          </div>
        </div>
        <div className="card-body">
          <div className="mb-4"><input className="input max-w-md" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} /></div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Schedule Name</th><th>Asset</th><th>Frequency</th><th>Next Due</th><th>Assigned To</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan="7" className="text-center py-8 text-slate-500">Loading...</td></tr>}
                {!loading && !filtered.length && <tr><td colSpan="7" className="text-center py-8 text-slate-500">No schedules found</td></tr>}
                {!loading && filtered.map(r => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.schedule_name}</td>
                    <td>{r.asset_name}</td>
                    <td className="capitalize">{r.frequency}</td>
                    <td>{r.next_due_date}</td>
                    <td>{r.assigned_to}</td>
                    <td><span className={`inline-block px-2 py-0.5 text-xs rounded font-medium ${r.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>{r.status}</span></td>
                    <td><Link to={`/maintenance/schedules/${r.id}`} className="btn-secondary btn-sm">Edit</Link></td>
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
