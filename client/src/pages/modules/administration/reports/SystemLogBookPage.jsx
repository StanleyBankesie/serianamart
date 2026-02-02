import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";
import { api } from "api/client";

export default function SystemLogBookPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  async function run() {
    try {
      setLoading(true);
      const res = await api.get("/admin/reports/system-log-book", {
        params: { from: from || null, to: to || null },
      });
      setItems(res.data?.items || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    run();
  }, []);

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">System Log Book</h1>
            <p className="text-sm mt-1">Application events and user activity across modules</p>
          </div>
          <Link to="/administration" className="btn btn-secondary">Return to Menu</Link>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="label">From</label>
              <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="label">To</label>
              <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="md:col-span-2 flex items-end gap-2">
              <button type="button" className="btn-success" onClick={run} disabled={loading}>
                {loading ? "Running..." : "Run Report"}
              </button>
              <button type="button" className="btn-success" onClick={() => { setFrom(""); setTo(""); }} disabled={loading}>
                Clear
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Date/Time</th>
                  <th>User</th>
                  <th>Module</th>
                  <th>Action</th>
                  <th>Reference</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id}>
                    <td>{r.event_time ? new Date(r.event_time).toLocaleString() : "-"}</td>
                    <td>{r.user_name || "-"}</td>
                    <td>{r.module_name || "-"}</td>
                    <td>{r.action || "-"}</td>
                    <td className="font-medium">{r.ref_no || "-"}</td>
                    <td>{r.message || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {items.length === 0 && !loading ? <div className="text-center py-10">No rows.</div> : null}
        </div>
      </div>
    </div>
  );
}

