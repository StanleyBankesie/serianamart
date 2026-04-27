import React, { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";

const statusColors = { ACTIVE:"bg-green-100 text-green-700", EXPIRED:"bg-red-100 text-red-600", CANCELLED:"bg-slate-100 text-slate-600", PENDING:"bg-amber-100 text-amber-700" };

export default function MaintenanceContractList() {
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    let m = true;
    setLoading(true);
    api.get("/maintenance/contracts").then(r => { if (m) setItems(Array.isArray(r.data?.items) ? r.data.items : []); })
      .catch(e => toast.error(e?.response?.data?.message || "Failed to load"))
      .finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, [location.state?.refresh]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return items;
    return items.filter(r =>
      String(r.contract_no || "").toLowerCase().includes(q) ||
      String(r.supplier_name || "").toLowerCase().includes(q) ||
      String(r.status || "").toLowerCase().includes(q)
    );
  }, [items, search]);

  function isNearExpiry(endDate, alertDays = 30) {
    if (!endDate) return false;
    const diff = (new Date(endDate) - new Date(today)) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= alertDays;
  }

  return (
    <div className="p-6 space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center">
            <div className="font-semibold">Maintenance Contracts</div>
            <div className="flex gap-2">
              <Link to="/maintenance" className="btn btn-secondary">Return to Menu</Link>
              <Link to="/maintenance/contracts/new" className="btn-success">+ New Contract</Link>
            </div>
          </div>
        </div>
        <div className="card-body">
          <div className="mb-4"><input className="input max-w-md" placeholder="Search by no, supplier, status..." value={search} onChange={e => setSearch(e.target.value)} /></div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Contract No</th><th>Supplier</th><th>Assets Covered</th><th>Start</th><th>End</th><th className="text-right">Value</th><th>Status</th><th>Actions</th>                    <th>Created By</th>
                    <th>Created Date</th>
                    </tr></thead>
              <tbody>
                {loading && <tr><td colSpan="8" className="text-center py-8 text-slate-500">Loading...</td></tr>}
                {!loading && !filtered.length && <tr><td colSpan="8" className="text-center py-8 text-slate-500">No contracts found</td></tr>}
                {!loading && filtered.map(r => (
                  <tr key={r.id} className={isNearExpiry(r.end_date, r.renewal_alert_days) ? "bg-amber-50 dark:bg-amber-900/20" : ""}>
                    <td className="font-mono text-sm">{r.contract_no}</td>
                    <td>{r.supplier_name}</td>
                    <td className="text-sm max-w-xs truncate">{r.asset_names}</td>
                    <td>{r.start_date}</td>
                    <td className={r.end_date < today ? "text-red-600 font-medium" : ""}>{r.end_date}</td>
                    <td className="text-right">{Number(r.contract_value || 0).toFixed(2)}</td>
                    <td><span className={`inline-block px-2 py-0.5 text-xs rounded font-medium ${statusColors[String(r.status || "").toUpperCase()] || "bg-slate-100 text-slate-600"}`}>{r.status}</span></td>
                    <td className="whitespace-nowrap">
                      <Link to={`/maintenance/contracts/${r.id}`} className="btn-secondary btn-sm">Edit</Link>
                      {isNearExpiry(r.end_date, r.renewal_alert_days) && <span className="ml-2 text-xs text-amber-700 font-medium">⚠ Expiring</span>}
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
