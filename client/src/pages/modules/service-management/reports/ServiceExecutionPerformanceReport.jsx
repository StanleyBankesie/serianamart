import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";

export default function ServiceExecutionPerformanceReport() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [technician, setTechnician] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get(
        "/service-management/reports/execution-performance",
        {
          params: {
            from: from || null,
            to: to || null,
            technician: technician || null,
          },
        },
      );
      setItems(Array.isArray(res?.data?.items) ? res.data.items : []);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load report");
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
            <h1 className="text-2xl font-bold dark:text-brand-300">
              Service Execution Performance
            </h1>
            <p className="text-sm mt-1">Measure technician productivity</p>
          </div>
          <div className="flex gap-2">
            <Link to="/service-management" className="btn btn-secondary">
              Return to Menu
            </Link>
          </div>
        </div>
        <div className="card-body">
          {error ? (
            <div className="text-red-600 text-sm mb-3">{error}</div>
          ) : null}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="label">Technician</label>
              <input
                className="input"
                value={technician}
                onChange={(e) => setTechnician(e.target.value)}
                placeholder="Technician..."
              />
            </div>
            <div>
              <label className="label">From</label>
              <input
                className="input"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="label">To</label>
              <input
                className="input"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                className="btn"
                onClick={run}
                disabled={loading}
              >
                {loading ? "Running..." : "Run"}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="p-4 rounded-lg border border-slate-200">
              <div className="text-xs text-slate-500">Total Executions</div>
              <div className="text-2xl font-bold">
                {items.reduce((a, r) => a + Number(r.total_executions || 0), 0)}
              </div>
            </div>
            <div className="p-4 rounded-lg border border-slate-200">
              <div className="text-xs text-slate-500">Completed Jobs</div>
              <div className="text-2xl font-bold">
                {items.reduce((a, r) => a + Number(r.completed_jobs || 0), 0)}
              </div>
            </div>
            <div className="p-4 rounded-lg border border-slate-200">
              <div className="text-xs text-slate-500">Pending Jobs</div>
              <div className="text-2xl font-bold">
                {items.reduce((a, r) => a + Number(r.pending_jobs || 0), 0)}
              </div>
            </div>
            <div className="p-4 rounded-lg border border-slate-200">
              <div className="text-xs text-slate-500">Avg Completion Time</div>
              <div className="text-2xl font-bold">0h</div>
            </div>
            <div className="p-4 rounded-lg border border-slate-200">
              <div className="text-xs text-slate-500">Total Labor Hours</div>
              <div className="text-2xl font-bold">0</div>
            </div>
            <div className="p-4 rounded-lg border border-slate-200">
              <div className="text-xs text-slate-500">First-Time Fix Rate</div>
              <div className="text-2xl font-bold">
                {(() => {
                  const total = items.reduce(
                    (a, r) => a + Number(r.total_executions || 0),
                    0,
                  );
                  const done = items.reduce(
                    (a, r) => a + Number(r.completed_jobs || 0),
                    0,
                  );
                  return total > 0
                    ? `${Math.round((done * 100) / total)}%`
                    : "0%";
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
