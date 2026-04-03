import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function LeaveApplicationsList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState({ q: "" });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const r = await api.get("/hr/leave/my-requests");
        setItems(r.data?.items || []);
      } catch {
        toast.error("Failed to load leave requests");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = items.filter((r) => {
    const q = filter.q.trim().toLowerCase();
    if (!q) return true;
    return (
      String(r.type_name || "").toLowerCase().includes(q) ||
      String(r.start_date || "").includes(q) ||
      String(r.end_date || "").includes(q) ||
      String(r.status || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/human-resources/leave" className="btn-secondary text-sm">
            ← Back
          </Link>
          <h1 className="text-xl font-semibold">My Leave Applications</h1>
        </div>
        <div className="flex items-center gap-2">
          <input
            className="input"
            placeholder="Search"
            value={filter.q}
            onChange={(e) => setFilter({ q: e.target.value })}
          />
          <Link className="btn-primary" to="/human-resources/leave/applications/new">
            Make Request
          </Link>
        </div>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded shadow-sm overflow-auto">
        <table className="min-w-full">
          <thead className="bg-slate-50 dark:bg-slate-900/50">
            <tr className="text-left">
              <th className="px-4 py-2 text-xs uppercase">Type</th>
              <th className="px-4 py-2 text-xs uppercase">Start</th>
              <th className="px-4 py-2 text-xs uppercase">End</th>
              <th className="px-4 py-2 text-xs uppercase">Days</th>
              <th className="px-4 py-2 text-xs uppercase">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-2">{r.type_name || "-"}</td>
                <td className="px-4 py-2">{r.start_date}</td>
                <td className="px-4 py-2">{r.end_date}</td>
                <td className="px-4 py-2">{r.total_days}</td>
                <td className="px-4 py-2">
                  <span className={`badge ${r.status === 'SCHEDULED' ? 'badge-warning' : 'badge-info'}`}>
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No records
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

