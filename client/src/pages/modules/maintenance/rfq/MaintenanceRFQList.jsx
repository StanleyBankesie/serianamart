import React, { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";

const statusColors = { DRAFT:"bg-slate-100 text-slate-600", SENT:"bg-blue-100 text-blue-700", RESPONDED:"bg-green-100 text-green-700", CLOSED:"bg-slate-200 text-slate-700" };
function Badge({ value, colorMap }) {
  const v = String(value || "").toUpperCase();
  return <span className={`inline-block px-2 py-0.5 text-xs rounded font-medium ${colorMap[v] || "bg-slate-100 text-slate-600"}`}>{v}</span>;
}

export default function MaintenanceRFQList() {
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api.get("/maintenance/rfqs").then(r => { if (mounted) setItems(Array.isArray(r.data?.items) ? r.data.items : []); })
      .catch(e => toast.error(e?.response?.data?.message || "Failed to load RFQs"))
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [location.state?.refresh]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return items;
    return items.filter(r => String(r.rfq_no || "").toLowerCase().includes(q) || String(r.status || "").toLowerCase().includes(q) || String(r.supplier_names || "").toLowerCase().includes(q));
  }, [items, search]);

  return (
    <div className="p-6 space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center">
            <div className="font-semibold">Request for Quotations (RFQ)</div>
            <div className="flex gap-2">
              <Link to="/maintenance" className="btn btn-secondary">Return to Menu</Link>
              <Link to="/maintenance/rfq/new" className="btn-success">+ New RFQ</Link>
            </div>
          </div>
        </div>
        <div className="card-body">
          <div className="mb-4">
            <input className="input max-w-md" placeholder="Search by no, status, supplier..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>RFQ No</th><th>Date</th><th>Request Ref</th><th>Suppliers Invited</th><th>Deadline</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan="7" className="text-center py-8 text-slate-500">Loading...</td></tr>}
                {!loading && !filtered.length && <tr><td colSpan="7" className="text-center py-8 text-slate-500">No RFQs found</td></tr>}
                {!loading && filtered.map(r => (
                  <tr key={r.id}>
                    <td className="font-mono text-sm">{r.rfq_no}</td>
                    <td>{r.rfq_date}</td>
                    <td>{r.request_id}</td>
                    <td className="text-sm">{r.supplier_names}</td>
                    <td>{r.response_deadline}</td>
                    <td><Badge value={r.status} colorMap={statusColors} /></td>
                    <td className="whitespace-nowrap space-x-2">
                      <Link to={`/maintenance/rfq/${r.id}`} className="btn-secondary btn-sm">Edit</Link>
                      <Link to={`/maintenance/supplier-quotations/new?rfq_id=${r.id}&rfq_no=${r.rfq_no}`} className="btn-primary btn-sm">Record Quotation</Link>
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
