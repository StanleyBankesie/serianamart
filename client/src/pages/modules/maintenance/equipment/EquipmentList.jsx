import React, { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";

const statusColors = { ACTIVE:"bg-green-100 text-green-700", INACTIVE:"bg-slate-100 text-slate-600", DECOMMISSIONED:"bg-red-100 text-red-600" };

export default function EquipmentList() {
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let m = true;
    setLoading(true);
    api.get("/maintenance/equipment").then(r => { if (m) setItems(Array.isArray(r.data?.items) ? r.data.items : []); })
      .catch(e => toast.error(e?.response?.data?.message || "Failed to load"))
      .finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, [location.state?.refresh]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return items;
    return items.filter(r => String(r.equipment_code || "").toLowerCase().includes(q) || String(r.equipment_name || "").toLowerCase().includes(q) || String(r.category || "").toLowerCase().includes(q) || String(r.location || "").toLowerCase().includes(q));
  }, [items, search]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="p-6 space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center">
            <div className="font-semibold">Equipment Setup</div>
            <div className="flex gap-2">
              <Link to="/maintenance" className="btn btn-secondary">Return to Menu</Link>
              <Link to="/maintenance/equipment/new" className="btn-success">+ New Equipment</Link>
            </div>
          </div>
        </div>
        <div className="card-body">
          <div className="mb-4"><input className="input max-w-md" placeholder="Search by code, name, category, location..." value={search} onChange={e => setSearch(e.target.value)} /></div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Code</th><th>Name</th><th>Category</th><th>Location</th><th>Serial No</th><th>Warranty Expiry</th><th>Status</th><th>Actions</th>                    <th>Created By</th>
                    <th>Created Date</th>
                    </tr></thead>
              <tbody>
                {loading && <tr><td colSpan="8" className="text-center py-8 text-slate-500">Loading...</td></tr>}
                {!loading && !filtered.length && <tr><td colSpan="8" className="text-center py-8 text-slate-500">No equipment found</td></tr>}
                {!loading && filtered.map(r => (
                  <tr key={r.id}>
                    <td className="font-mono text-sm">{r.equipment_code}</td>
                    <td className="font-medium">{r.equipment_name}</td>
                    <td>{r.category}</td>
                    <td>{r.location}</td>
                    <td>{r.serial_number}</td>
                    <td className={r.warranty_expiry && r.warranty_expiry < today ? "text-red-600 font-medium" : ""}>{r.warranty_expiry}</td>
                    <td><span className={`inline-block px-2 py-0.5 text-xs rounded font-medium ${statusColors[r.status] || "bg-slate-100 text-slate-600"}`}>{r.status}</span></td>
                    <td><Link to={`/maintenance/equipment/${r.id}`} className="btn-secondary btn-sm">Edit</Link></td>
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
