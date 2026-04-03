import React, { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";

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
    <div className="p-6 space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center">
            <div className="font-semibold">Maintenance Requests</div>
            <div className="flex gap-2">
              <Link to="/maintenance" className="btn btn-secondary">Return to Menu</Link>
              <Link to="/maintenance/maintenance-requests/new" className="btn-success">+ New Request</Link>
            </div>
          </div>
        </div>
        <div className="card-body">
          <div className="mb-4">
            <input className="input max-w-md" placeholder="Search by no, requester, type, status..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Request No</th><th>Date</th><th>Requester</th><th>Department</th>
                  <th>Type</th><th>Priority</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan="8" className="text-center py-8 text-slate-500">Loading...</td></tr>}
                {!loading && !filtered.length && <tr><td colSpan="8" className="text-center py-8 text-slate-500">No maintenance requests found</td></tr>}
                {!loading && filtered.map(r => (
                  <tr key={r.id}>
                    <td className="font-mono text-sm">{r.request_no}</td>
                    <td>{r.request_date}</td>
                    <td>{r.requester_name}</td>
                    <td>{r.department}</td>
                    <td>{r.maintenance_type}</td>
                    <td><Badge value={r.priority} colorMap={priorityColors} /></td>
                    <td><Badge value={r.status} colorMap={statusColors} /></td>
                    <td className="whitespace-nowrap space-x-2">
                      <Link to={`/maintenance/maintenance-requests/${r.id}`} className="btn-secondary btn-sm">Edit</Link>
                      <Link to={`/maintenance/job-orders/new?request_id=${r.id}&request_no=${r.request_no}&asset_name=${encodeURIComponent(r.asset_name||"")}`} className="btn-primary btn-sm">Create Job Order</Link>
                      <Link to={`/maintenance/rfq/new?request_id=${r.id}&request_no=${r.request_no}`} className="btn-sm" style={{background:"#6366f1",color:"white",borderRadius:"0.375rem",padding:"0.25rem 0.75rem",fontSize:"0.75rem"}}>Create RFQ</Link>
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
